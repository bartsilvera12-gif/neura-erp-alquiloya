import { NextResponse } from "next/server";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { queryWithRetry } from "@/lib/supabase/pg-retry";
import { getAuthUserForApiRoute } from "@/lib/auth/get-auth-user-for-api-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALQUILOYA_SCHEMA = "alquiloya";
const ALQUILOYA_EMPRESA_ID = "cf5df6fb-7705-4c4e-b29c-97bf5f314d8f";

function t(table: string): string {
  return `"${ALQUILOYA_SCHEMA}"."${table}"`;
}

function s(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const x = v.trim();
  return x.length > 0 ? x : null;
}
function b(v: unknown, def: boolean): boolean {
  if (typeof v === "boolean") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return def;
}
function i(v: unknown, def = 0): number {
  if (v == null || v === "") return def;
  const x = Number(v);
  return Number.isFinite(x) ? Math.trunc(x) : def;
}

type PostBody = {
  nombre?: string;
  email?: string | null;
  telefono?: string | null;
  whatsapp?: string | null;
  cargo?: string | null;
  bio?: string | null;
  foto_url?: string | null;
  orden?: number | string | null;
  activo?: boolean;
};

export async function POST(request: Request) {
  try {
    const user = await getAuthUserForApiRoute(request);
    if (!user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    const pool = getChatPostgresPool();
    if (!pool) return NextResponse.json({ error: "Pool no disponible" }, { status: 500 });

    const body = (await request.json().catch(() => ({}))) as PostBody;
    const nombre = s(body.nombre);
    if (!nombre) return NextResponse.json({ error: "nombre requerido" }, { status: 400 });

    const { rows } = await queryWithRetry<{ id: string }>(
      pool,
      `INSERT INTO ${t("agentes")} (
         empresa_id, nombre, email, telefono, whatsapp,
         cargo, bio, foto_url, orden, activo,
         verificado, nivel, idiomas, tiempo_respuesta, tasa_respuesta
       )
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10,
               $11, $12, $13, $14, $15)
       RETURNING id`,
      [
        ALQUILOYA_EMPRESA_ID,
        nombre,
        s(body.email),
        s(body.telefono),
        s(body.whatsapp),
        s(body.cargo),
        s(body.bio),
        s(body.foto_url),
        i(body.orden, 0),
        b(body.activo, true),
        b((body as Record<string, unknown>).verificado, false),
        s((body as Record<string, unknown>).nivel),
        s((body as Record<string, unknown>).idiomas),
        s((body as Record<string, unknown>).tiempo_respuesta),
        s((body as Record<string, unknown>).tasa_respuesta),
      ]
    );
    return NextResponse.json({ success: true, id: rows[0].id });
  } catch (err) {
    console.error("[api/dashboard/alquiloya-agentes POST]", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}
