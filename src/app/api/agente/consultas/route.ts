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
    if (!agenteId) {
      return NextResponse.json({ success: true, consultas: [] });
    }
    const pool = getChatPostgresPool();
    if (!pool) return NextResponse.json({ error: "Pool no disponible" }, { status: 500 });

    const url = new URL(request.url);
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") ?? "20") || 20));

    const { rows } = await queryWithRetry(
      pool,
      `SELECT c.id, c.nombre, c.email, c.telefono, c.mensaje, c.canal, c.estado,
              c.created_at::text AS created_at,
              c.propiedad_id, p.titulo AS propiedad_titulo, p.ciudad AS propiedad_ciudad
         FROM ${t("consultas")} c
         LEFT JOIN ${t("propiedades")} p
           ON p.empresa_id = c.empresa_id AND p.id = c.propiedad_id
        WHERE c.empresa_id = $1::uuid AND (c.agente_id = $2::uuid OR p.agente_id = $2::uuid)
        ORDER BY c.created_at DESC NULLS LAST
        LIMIT ${limit}`,
      [ALQUILOYA_EMPRESA_ID, agenteId]
    );
    return NextResponse.json({ success: true, consultas: rows ?? [] });
  } catch (err) {
    console.error("[api/agente/consultas]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
