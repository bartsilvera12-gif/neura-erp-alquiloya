import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-admin";
import { getAuthUserForApiRoute } from "@/lib/auth/get-auth-user-for-api-route";
import { resolveUsuarioErpFromAuthUser } from "@/lib/auth/resolve-usuario-erp";
import { extractPlanLimits } from "@/lib/alquiloya/plan-limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALQUILOYA_EMPRESA_ID = "cf5df6fb-7705-4c4e-b29c-97bf5f314d8f";

/**
 * GET /api/agente/me
 *
 * Resuelve la sesión Supabase del navegador a una fila de `alquiloya.usuarios`
 * y, si tiene `agente_id`, devuelve también el perfil público del agente
 * (`alquiloya.agentes`). Pensado para reemplazar el hardcode `AG-001` del
 * panel `/publico#admin-agent`.
 *
 * Responses:
 *   200 { agente, usuario }  → usuario con agente_id vinculado
 *   200 { agente: null, usuario } → usuario válido pero sin agente_id
 *   401 { error: "No autenticado" }
 *   404 { error: "Usuario no resuelto" }
 */
export async function GET(request: Request) {
  try {
    const user = await getAuthUserForApiRoute(request);
    if (!user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const supabase = createServiceRoleClient();
    const usuario = await resolveUsuarioErpFromAuthUser(supabase, user);
    if (!usuario) {
      return NextResponse.json({ error: "Usuario no resuelto" }, { status: 404 });
    }

    // Solo resolvemos perfil agente si el usuario pertenece a AlquiloYa.
    let agente: Record<string, unknown> | null = null;
    if (usuario.empresa_id === ALQUILOYA_EMPRESA_ID) {
      // Lectura directa de `usuarios.agente_id` (resolver no la trae).
      const { data: uExt } = await supabase
        .from("usuarios")
        .select("agente_id")
        .eq("id", usuario.id)
        .limit(1)
        .maybeSingle();
      const agenteId = (uExt as { agente_id?: string | null } | null)?.agente_id ?? null;
      if (agenteId) {
        const { data: ag } = await supabase
          .from("agentes")
          .select("id, nombre, email, telefono, whatsapp, foto_url, cargo, bio, orden, activo, plan_publicacion_id, plan_vencimiento_at, impulsos_saldo")
          .eq("id", agenteId)
          .eq("empresa_id", ALQUILOYA_EMPRESA_ID)
          .limit(1)
          .maybeSingle();
        if (ag) {
          agente = ag as Record<string, unknown>;
          // Plan info + cuota: lee el plan asignado y cuenta propiedades activas
          // del agente para que el panel publico sepa si puede publicar o no.
          const planId = (ag as { plan_publicacion_id?: string | null }).plan_publicacion_id ?? null;
          let plan: Record<string, unknown> | null = null;
          let propiedadesActivas: number | null = null;
          let limiteActivas: number | null = null;
          let limiteFotos: number | null = null;
          if (planId) {
            const { data: pl } = await supabase
              .from("planes_publicacion")
              .select("id, tier, nombre, billing, bullets, activo")
              .eq("id", planId)
              .eq("empresa_id", ALQUILOYA_EMPRESA_ID)
              .limit(1)
              .maybeSingle();
            if (pl) {
              plan = pl as Record<string, unknown>;
              const limits = extractPlanLimits((pl as { bullets?: unknown }).bullets);
              limiteActivas = limits.propiedadesActivas;
              limiteFotos = limits.fotosPorInmueble;
            }
          }
          const { count } = await supabase
            .from("propiedades")
            .select("id", { count: "exact", head: true })
            .eq("empresa_id", ALQUILOYA_EMPRESA_ID)
            .eq("agente_id", agenteId)
            .eq("activo", true)
            .eq("visible_web", true);
          propiedadesActivas = typeof count === "number" ? count : 0;
          (agente as Record<string, unknown>).plan = plan;
          (agente as Record<string, unknown>).propiedades_activas = propiedadesActivas;
          (agente as Record<string, unknown>).plan_limite_activas = limiteActivas;
          (agente as Record<string, unknown>).plan_limite_fotos = limiteFotos;
          (agente as Record<string, unknown>).puede_publicar =
            !!plan &&
            (limiteActivas == null || (propiedadesActivas ?? 0) < limiteActivas);
        }
      }
    }

    return NextResponse.json({
      success: true,
      usuario: {
        id: usuario.id,
        empresa_id: usuario.empresa_id,
        rol: usuario.rol,
      },
      agente,
    });
  } catch (err) {
    console.error("[api/agente/me]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}

/**
 * PATCH /api/agente/me
 *
 * Permite al agente autenticado actualizar sus campos publicos del perfil:
 * nombre, telefono, whatsapp, cargo, bio. Otros campos (verificado, plan,
 * activo) NO son editables por el propio agente.
 */
export async function PATCH(request: Request) {
  try {
    const user = await getAuthUserForApiRoute(request);
    if (!user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const supabase = createServiceRoleClient();
    const usuario = await resolveUsuarioErpFromAuthUser(supabase, user);
    if (!usuario || usuario.empresa_id !== ALQUILOYA_EMPRESA_ID) {
      return NextResponse.json({ error: "Usuario no autorizado" }, { status: 403 });
    }
    const { data: uExt } = await supabase
      .from("usuarios")
      .select("agente_id")
      .eq("id", usuario.id)
      .limit(1)
      .maybeSingle();
    const agenteId = (uExt as { agente_id?: string | null } | null)?.agente_id ?? null;
    if (!agenteId) return NextResponse.json({ error: "Sin perfil de agente" }, { status: 404 });

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    function clean(v: unknown, max = 200): string | null | undefined {
      if (v === undefined) return undefined;
      if (v === null) return null;
      if (typeof v !== "string") return undefined;
      const x = v.trim();
      if (!x) return null;
      return x.slice(0, max);
    }
    const patch: Record<string, unknown> = {};
    const nombre = clean(body.nombre, 160);
    if (nombre !== undefined) {
      if (nombre === null) return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });
      patch.nombre = nombre;
    }
    const telefono = clean(body.telefono, 40);
    if (telefono !== undefined) patch.telefono = telefono;
    const whatsapp = clean(body.whatsapp, 40);
    if (whatsapp !== undefined) patch.whatsapp = whatsapp;
    const cargo = clean(body.cargo, 120);
    if (cargo !== undefined) patch.cargo = cargo;
    const bio = clean(body.bio, 1000);
    if (bio !== undefined) patch.bio = bio;

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "Sin cambios" }, { status: 400 });
    }

    const { data: updated, error: updErr } = await supabase
      .from("agentes")
      .update(patch)
      .eq("id", agenteId)
      .eq("empresa_id", ALQUILOYA_EMPRESA_ID)
      .select("id, nombre, email, telefono, whatsapp, cargo, bio")
      .limit(1)
      .maybeSingle();
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

    return NextResponse.json({ success: true, agente: updated });
  } catch (err) {
    console.error("[api/agente/me PATCH]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
