// GET /api/dashboard/integraciones-sociales
//
// Lista publicaciones sociales (jobs Meta) para el panel admin.
// Filtros por query params: propietario, agente, network, status, desde, hasta.
// Ademas devuelve contadores agregados y una vista de "cuentas conectadas".

import { NextResponse } from "next/server";
import { getAuthUserForApiRoute } from "@/lib/auth/get-auth-user-for-api-route";
import { resolveUsuarioErpFromAuthUser } from "@/lib/auth/resolve-usuario-erp";
import { createServiceRoleClient } from "@/lib/supabase/service-admin";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { queryWithRetry } from "@/lib/supabase/pg-retry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALQUILOYA_EMPRESA_ID = "cf5df6fb-7705-4c4e-b29c-97bf5f314d8f";
const ADMIN_ROLES = new Set(["super_admin", "admin", "administrador", "supervisor"]);

type PublicacionRow = {
  id: string;
  network: string;
  status: string;
  attempt_count: number;
  last_error_code: string | null;
  last_error_message: string | null;
  external_post_id: string | null;
  external_post_url: string | null;
  caption: string | null;
  published_at: string | null;
  next_retry_at: string | null;
  created_at: string;
  inmueble_id: string;
  inmueble_titulo: string | null;
  inmueble_codigo: string | null;
  owner_type: "propietario" | "agente";
  owner_id: string;
  owner_nombre: string | null;
  owner_email: string | null;
  account_name: string | null;
  account_username: string | null;
};

type Counts = {
  pending: number;
  processing: number;
  published: number;
  failed: number;
  cuentas_conectadas: number;
  cuentas_expired: number;
};

export async function GET(request: Request) {
  try {
    const user = await getAuthUserForApiRoute(request);
    if (!user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    const supabase = createServiceRoleClient();
    const usuario = await resolveUsuarioErpFromAuthUser(supabase, user);
    if (!usuario || usuario.empresa_id !== ALQUILOYA_EMPRESA_ID) {
      return NextResponse.json({ error: "Usuario no resuelto" }, { status: 403 });
    }
    if (!ADMIN_ROLES.has(String(usuario.rol || "").toLowerCase())) {
      return NextResponse.json({ error: "Solo admin" }, { status: 403 });
    }

    const pool = getChatPostgresPool();
    if (!pool) return NextResponse.json({ error: "Pool no disponible" }, { status: 500 });

    const url = new URL(request.url);
    const network = url.searchParams.get("network");
    const status = url.searchParams.get("status");
    const propietarioId = url.searchParams.get("propietario_id");
    const agenteId = url.searchParams.get("agente_id");
    const desde = url.searchParams.get("desde");
    const hasta = url.searchParams.get("hasta");
    const limit = Math.min(Number(url.searchParams.get("limit") || 100), 500);

    // WHERE dinamico con placeholders posicionales
    const params: Array<string | number> = [ALQUILOYA_EMPRESA_ID];
    let where = "ps.empresa_id = $1::uuid";
    if (network === "facebook" || network === "instagram") {
      params.push(network);
      where += " AND ps.network = $" + params.length;
    }
    if (status && ["pending","processing","published","failed","cancelled"].includes(status)) {
      params.push(status);
      where += " AND ps.status = $" + params.length;
    }
    if (propietarioId) {
      params.push(propietarioId);
      where += " AND ps.propietario_id = $" + params.length + "::uuid";
    }
    if (agenteId) {
      params.push(agenteId);
      where += " AND ps.agente_id = $" + params.length + "::uuid";
    }
    if (desde) {
      params.push(desde);
      where += " AND ps.created_at >= $" + params.length + "::timestamptz";
    }
    if (hasta) {
      params.push(hasta);
      where += " AND ps.created_at <= $" + params.length + "::timestamptz";
    }
    params.push(limit);

    const { rows: publicaciones } = await queryWithRetry<PublicacionRow>(
      pool,
      "SELECT ps.id, ps.network, ps.status, ps.attempt_count," +
      "       ps.last_error_code, ps.last_error_message," +
      "       ps.external_post_id, ps.external_post_url, ps.caption," +
      "       ps.published_at::text AS published_at," +
      "       ps.next_retry_at::text AS next_retry_at," +
      "       ps.created_at::text AS created_at," +
      "       ps.inmueble_id," +
      "       p.titulo AS inmueble_titulo, p.codigo AS inmueble_codigo," +
      "       CASE WHEN ps.agente_id IS NOT NULL THEN 'agente' ELSE 'propietario' END AS owner_type," +
      "       COALESCE(ps.agente_id, ps.propietario_id) AS owner_id," +
      "       COALESCE(ag.nombre, pr.nombre) AS owner_nombre," +
      "       COALESCE(ag.email, pr.email) AS owner_email," +
      "       rs.account_name, rs.username AS account_username" +
      "  FROM \"alquiloya\".\"publicaciones_sociales\" ps" +
      "  LEFT JOIN \"alquiloya\".\"propiedades\" p ON p.id = ps.inmueble_id" +
      "  LEFT JOIN \"alquiloya\".\"propietarios\" pr ON pr.id = ps.propietario_id" +
      "  LEFT JOIN \"alquiloya\".\"agentes\" ag ON ag.id = ps.agente_id" +
      "  LEFT JOIN \"alquiloya\".\"propietario_redes_sociales\" rs ON rs.id = ps.social_account_id" +
      " WHERE " + where +
      " ORDER BY ps.created_at DESC" +
      " LIMIT $" + params.length,
      params,
    );

    // Contadores agregados (siempre sobre TODAS las filas del tenant, no
    // filtrados — el widget de arriba muestra "el total del sistema")
    const { rows: countRows } = await queryWithRetry<{ status: string; c: number }>(
      pool,
      "SELECT status, count(*)::int AS c" +
      "  FROM \"alquiloya\".\"publicaciones_sociales\"" +
      " WHERE empresa_id = $1::uuid" +
      " GROUP BY status",
      [ALQUILOYA_EMPRESA_ID],
    );
    const { rows: cuentaRows } = await queryWithRetry<{ status: string; c: number }>(
      pool,
      "SELECT status, count(*)::int AS c" +
      "  FROM \"alquiloya\".\"propietario_redes_sociales\"" +
      " WHERE empresa_id = $1::uuid" +
      " GROUP BY status",
      [ALQUILOYA_EMPRESA_ID],
    );
    const counts: Counts = {
      pending: 0, processing: 0, published: 0, failed: 0,
      cuentas_conectadas: 0, cuentas_expired: 0,
    };
    for (const r of countRows) {
      if (r.status === "pending") counts.pending = r.c;
      else if (r.status === "processing") counts.processing = r.c;
      else if (r.status === "published") counts.published = r.c;
      else if (r.status === "failed") counts.failed = r.c;
    }
    for (const r of cuentaRows) {
      if (r.status === "connected") counts.cuentas_conectadas = r.c;
      else if (r.status === "expired" || r.status === "revoked" || r.status === "error") {
        counts.cuentas_expired += r.c;
      }
    }

    return NextResponse.json({ success: true, publicaciones, counts });
  } catch (err) {
    console.error("[api/dashboard/integraciones-sociales]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
