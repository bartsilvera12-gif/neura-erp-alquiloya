import { NextResponse } from "next/server";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { queryWithRetry } from "@/lib/supabase/pg-retry";
import { getAuthUserForApiRoute } from "@/lib/auth/get-auth-user-for-api-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALQUILOYA_EMPRESA_ID = "cf5df6fb-7705-4c4e-b29c-97bf5f314d8f";

function s(v: unknown, max = 80): string | null {
  if (typeof v !== "string") return null;
  const x = v.trim();
  return x ? x.slice(0, max) : null;
}
function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const x = Number(v);
  return Number.isFinite(x) && x >= 0 ? x : null;
}
function int(v: unknown): number | null {
  const x = num(v);
  return x == null ? null : Math.trunc(x);
}

export async function GET(request: Request) {
  try {
    const user = await getAuthUserForApiRoute(request);
    if (!user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    const pool = getChatPostgresPool();
    if (!pool) return NextResponse.json({ error: "Pool no disponible" }, { status: 500 });

    // Detectar si la tabla existe (para tolerar instancias sin la migration corrida).
    const { rows: exists } = await queryWithRetry<{ exists: boolean }>(
      pool,
      `SELECT EXISTS (
         SELECT 1 FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'alquiloya' AND c.relname = 'impulsos_packs' AND c.relkind = 'r'
       ) AS exists`,
      []
    );
    if (!exists?.[0]?.exists) {
      return NextResponse.json({
        success: true,
        data: { packs: [] },
        warning: "La tabla alquiloya.impulsos_packs todavía no existe. Corré la migration 20260628120000_alquiloya_impulsos_packs.sql en Supabase.",
      });
    }

    const { rows } = await queryWithRetry(
      pool,
      `SELECT id, codigo, qty, precio::float8 AS precio, moneda, badge, orden, activo
         FROM "alquiloya"."impulsos_packs"
        WHERE empresa_id = $1::uuid
        ORDER BY orden ASC, qty ASC`,
      [ALQUILOYA_EMPRESA_ID]
    );
    return NextResponse.json({ success: true, data: { packs: rows ?? [] } });
  } catch (err) {
    console.error("[api/dashboard/alquiloya-impulsos-packs GET]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthUserForApiRoute(request);
    if (!user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    const pool = getChatPostgresPool();
    if (!pool) return NextResponse.json({ error: "Pool no disponible" }, { status: 500 });

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const codigo = s(body.codigo, 40);
    const qty = int(body.qty);
    const precio = num(body.precio);
    const badge = s(body.badge, 20);
    const orden = int(body.orden) ?? 0;
    const moneda = s(body.moneda, 8) ?? "PYG";
    if (!codigo) return NextResponse.json({ error: "codigo requerido" }, { status: 400 });
    if (!qty || qty <= 0) return NextResponse.json({ error: "qty > 0 requerido" }, { status: 400 });
    if (precio == null) return NextResponse.json({ error: "precio requerido" }, { status: 400 });
    const badgeFinal = badge === "popular" || badge === "best" ? badge : null;

    const { rows } = await queryWithRetry<{ id: string }>(
      pool,
      `INSERT INTO "alquiloya"."impulsos_packs"
         (empresa_id, codigo, qty, precio, moneda, badge, orden, activo)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, true)
       RETURNING id`,
      [ALQUILOYA_EMPRESA_ID, codigo, qty, precio, moneda, badgeFinal, orden]
    );
    return NextResponse.json({ success: true, id: rows[0].id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    if (/duplicate key|unique/i.test(msg)) {
      return NextResponse.json({ error: "Ya existe un pack con ese código" }, { status: 409 });
    }
    console.error("[api/dashboard/alquiloya-impulsos-packs POST]", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
