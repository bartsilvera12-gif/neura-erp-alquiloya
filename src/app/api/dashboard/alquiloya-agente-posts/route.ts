import { NextResponse } from "next/server";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { queryWithRetry } from "@/lib/supabase/pg-retry";
import { getAuthUserForApiRoute } from "@/lib/auth/get-auth-user-for-api-route";
import { listErpAgentePosts } from "@/lib/alquiloya/erp-agente-posts";
import { sanitizeBlogHtml } from "../../agente/posts/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALQUILOYA_EMPRESA_ID = "cf5df6fb-7705-4c4e-b29c-97bf5f314d8f";
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function s(v: unknown, max = 5000): string | null {
  if (typeof v !== "string") return null;
  const x = v.trim();
  return x ? x.slice(0, max) : null;
}
function b(v: unknown, def: boolean): boolean {
  if (typeof v === "boolean") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return def;
}
function i(v: unknown, def: number): number {
  if (v == null || v === "") return def;
  const x = Number(v);
  return Number.isFinite(x) ? Math.trunc(x) : def;
}
function slugify(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

export async function GET(request: Request) {
  try {
    const user = await getAuthUserForApiRoute(request);
    if (!user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    const rows = await listErpAgentePosts();
    return NextResponse.json({ success: true, data: { posts: rows } });
  } catch (err) {
    console.error("[api/dashboard/alquiloya-agente-posts GET]", err);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthUserForApiRoute(request);
    if (!user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    const pool = getChatPostgresPool();
    if (!pool) return NextResponse.json({ error: "Pool no disponible" }, { status: 500 });

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const agenteId = s(body.agente_id, 40);
    if (!agenteId || !uuidRe.test(agenteId)) {
      return NextResponse.json({ error: "agente_id requerido" }, { status: 400 });
    }
    const titulo = s(body.titulo, 240);
    if (!titulo) return NextResponse.json({ error: "titulo requerido" }, { status: 400 });
    const slug = s(body.slug, 80) ?? slugify(titulo);
    const contenido = sanitizeBlogHtml(s(body.contenido, 50000));
    const resumen = s(body.resumen, 500);
    const coverUrl = s(body.cover_url, 500);
    const publicado = b(body.publicado, false);
    const destacado = b(body.destacado, false);
    const orden = i(body.orden, 0);

    const { rows } = await queryWithRetry<{ id: string }>(
      pool,
      `INSERT INTO "alquiloya"."agente_posts"
         (empresa_id, agente_id, slug, titulo, resumen, contenido, cover_url,
          publicado, destacado, orden, publicado_at)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10,
               CASE WHEN $8::boolean THEN now() ELSE NULL END)
       RETURNING id`,
      [ALQUILOYA_EMPRESA_ID, agenteId, slug, titulo, resumen, contenido, coverUrl,
       publicado, destacado, orden]
    );
    return NextResponse.json({ success: true, id: rows[0].id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    if (/unique|duplicate/i.test(msg)) {
      return NextResponse.json({ error: "Ya existe un post con ese slug para este agente" }, { status: 409 });
    }
    console.error("[api/dashboard/alquiloya-agente-posts POST]", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
