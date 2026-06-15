import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-admin";
import { getAuthUserForApiRoute } from "@/lib/auth/get-auth-user-for-api-route";
import { resolveUsuarioErpFromAuthUser } from "@/lib/auth/resolve-usuario-erp";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { queryWithRetry } from "@/lib/supabase/pg-retry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALQUILOYA_SCHEMA = "alquiloya";
const ALQUILOYA_EMPRESA_ID = "cf5df6fb-7705-4c4e-b29c-97bf5f314d8f";

function t(table: string): string {
  return `"${ALQUILOYA_SCHEMA}"."${table}"`;
}

// Debe coincidir con el CHECK de alquiloya.agente_captaciones.etapa
// (migración 20260620120000) y con el selector de etapa del panel del agente.
const ETAPAS_ORDER = [
  "nuevo",
  "contacto",
  "negocio_activo",
  "cerrado",
  "rechazado",
] as const;

export async function GET(request: Request) {
  try {
    const user = await getAuthUserForApiRoute(request);
    if (!user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    const supabase = createServiceRoleClient();
    const usuario = await resolveUsuarioErpFromAuthUser(supabase, user);
    if (!usuario || usuario.empresa_id !== ALQUILOYA_EMPRESA_ID) {
      return NextResponse.json({ error: "Usuario no resuelto" }, { status: 404 });
    }
    const { data: uExt } = await supabase
      .from("usuarios")
      .select("agente_id")
      .eq("id", usuario.id)
      .limit(1)
      .maybeSingle();
    const agenteId = (uExt as { agente_id?: string | null } | null)?.agente_id ?? null;

    const out = ETAPAS_ORDER.map((etapa) => ({ etapa, count: 0 }));
    if (!agenteId) return NextResponse.json({ success: true, embudo: out });

    const pool = getChatPostgresPool();
    if (!pool) return NextResponse.json({ error: "Pool no disponible" }, { status: 500 });

    // Captaciones por etapa (origen propietarios captados por el agente).
    try {
      const { rows } = await queryWithRetry<{ etapa: string; n: number }>(
        pool,
        `SELECT etapa, count(*)::int AS n
           FROM ${t("agente_captaciones")}
          WHERE empresa_id = $1::uuid AND agente_id = $2::uuid
          GROUP BY etapa`,
        [ALQUILOYA_EMPRESA_ID, agenteId]
      );
      const map = new Map(rows.map((r) => [r.etapa, r.n]));
      out.forEach((e) => { e.count = map.get(e.etapa) ?? 0; });
    } catch {
      // tabla puede no existir o ser otra structure — no abortar
    }

    return NextResponse.json({ success: true, embudo: out });
  } catch (err) {
    console.error("[api/agente/embudo]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
