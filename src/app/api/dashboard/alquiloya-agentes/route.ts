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

    // Detectamos columnas opcionales (perfil agente) para tolerar instancias sin la migration.
    const { rows: cols } = await queryWithRetry<{ column_name: string }>(
      pool,
      `SELECT column_name FROM information_schema.columns
         WHERE table_schema='alquiloya' AND table_name='agentes'`,
      []
    );
    const colSet = new Set(cols.map((c) => c.column_name));
    const extras: { col: string; val: unknown }[] = [];
    if (colSet.has("logo_empresa_url"))
      extras.push({ col: "logo_empresa_url", val: s((body as Record<string, unknown>).logo_empresa_url) });
    if (colSet.has("verificado"))
      extras.push({ col: "verificado", val: b((body as Record<string, unknown>).verificado, false) });
    if (colSet.has("nivel")) extras.push({ col: "nivel", val: s((body as Record<string, unknown>).nivel) });
    if (colSet.has("idiomas")) extras.push({ col: "idiomas", val: s((body as Record<string, unknown>).idiomas) });
    if (colSet.has("tiempo_respuesta"))
      extras.push({ col: "tiempo_respuesta", val: s((body as Record<string, unknown>).tiempo_respuesta) });
    if (colSet.has("tasa_respuesta"))
      extras.push({ col: "tasa_respuesta", val: s((body as Record<string, unknown>).tasa_respuesta) });

    // Plan de publicacion (opcional) y fecha de vencimiento. Permite asignar
    // el plan al CREAR el agente, sin obligar a entrar despues al modal de
    // "Cambiar plan". Si el body manda un uuid invalido, devolvemos 400 en
    // vez de ignorarlo silenciosamente.
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (colSet.has("plan_publicacion_id")) {
      const raw = (body as Record<string, unknown>).plan_publicacion_id;
      if (typeof raw === "string" && raw.trim() !== "") {
        if (!uuidRe.test(raw.trim())) {
          return NextResponse.json({ error: "plan_publicacion_id invalido" }, { status: 400 });
        }
        extras.push({ col: "plan_publicacion_id", val: raw.trim() });
      }
    }
    if (colSet.has("plan_vencimiento_at")) {
      const raw = (body as Record<string, unknown>).plan_vencimiento_at;
      if (typeof raw === "string" && raw.trim() !== "") {
        const d = new Date(raw);
        if (Number.isNaN(d.getTime())) {
          return NextResponse.json({ error: "plan_vencimiento_at invalido" }, { status: 400 });
        }
        extras.push({ col: "plan_vencimiento_at", val: d.toISOString() });
      }
    }

    const baseCols = ["empresa_id", "nombre", "email", "telefono", "whatsapp",
                      "cargo", "bio", "foto_url", "orden", "activo"];
    const allCols = [...baseCols, ...extras.map((e) => e.col)];
    const baseVals: unknown[] = [
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
    ];
    const allVals = [...baseVals, ...extras.map((e) => e.val)];
    const placeholders = allCols
      .map((_, i) => (i === 0 ? `$${i + 1}::uuid` : `$${i + 1}`))
      .join(", ");
    const sql = `INSERT INTO ${t("agentes")} (${allCols.join(", ")})
                 VALUES (${placeholders}) RETURNING id`;
    const { rows } = await queryWithRetry<{ id: string }>(pool, sql, allVals);
    return NextResponse.json({ success: true, id: rows[0].id });
  } catch (err) {
    console.error("[api/dashboard/alquiloya-agentes POST]", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}
