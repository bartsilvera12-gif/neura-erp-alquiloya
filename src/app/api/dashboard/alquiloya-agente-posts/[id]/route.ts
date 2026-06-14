import { NextResponse } from "next/server";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { queryWithRetry } from "@/lib/supabase/pg-retry";
import { getAuthUserForApiRoute } from "@/lib/auth/get-auth-user-for-api-route";
import { sanitizeBlogHtml } from "../../../agente/posts/route";

function slugify(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALQUILOYA_EMPRESA_ID = "cf5df6fb-7705-4c4e-b29c-97bf5f314d8f";
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function s(v: unknown, max = 5000): string | null {
  if (typeof v !== "string") return null;
  const x = v.trim();
  return x ? x.slice(0, max) : null;
}
function b(v: unknown): boolean | undefined {
  if (typeof v === "boolean") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return undefined;
}
function i(v: unknown): number | undefined {
  if (v == null || v === "") return undefined;
  const x = Number(v);
  return Number.isFinite(x) ? Math.trunc(x) : undefined;
}

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const user = await getAuthUserForApiRoute(request);
    if (!user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    const { id } = await ctx.params;
    if (!uuidRe.test(id)) return NextResponse.json({ error: "id invalido" }, { status: 400 });
    const pool = getChatPostgresPool();
    if (!pool) return NextResponse.json({ error: "Pool no disponible" }, { status: 500 });

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const sets: string[] = [];
    const vals: unknown[] = [];
    function push(col: string, val: unknown) {
      vals.push(val);
      sets.push(`${col} = $${vals.length}`);
    }
    let nuevoTitulo: string | null = null;
    if ("titulo" in body) {
      const v = s(body.titulo, 240);
      if (!v) return NextResponse.json({ error: "titulo vacio" }, { status: 400 });
      push("titulo", v);
      nuevoTitulo = v;
    }
    if ("slug" in body) {
      const v = s(body.slug, 80);
      if (v) push("slug", v);
      else if (nuevoTitulo) push("slug", slugify(nuevoTitulo));
    }
    if ("resumen" in body) push("resumen", s(body.resumen, 500));
    if ("contenido" in body) push("contenido", sanitizeBlogHtml(s(body.contenido, 50000)));
    if ("cover_url" in body) push("cover_url", s(body.cover_url, 500));
    if ("publicado" in body) {
      const v = b(body.publicado);
      if (v !== undefined) {
        push("publicado", v);
        // Si pasa a publicado, sincronizamos publicado_at si era null.
        if (v === true) sets.push("publicado_at = COALESCE(publicado_at, now())");
      }
    }
    if ("destacado" in body) {
      const v = b(body.destacado);
      if (v !== undefined) push("destacado", v);
    }
    if ("orden" in body) {
      const v = i(body.orden);
      if (v !== undefined) push("orden", v);
    }
    if (sets.length === 0) return NextResponse.json({ error: "sin cambios" }, { status: 400 });

    vals.push(ALQUILOYA_EMPRESA_ID);
    vals.push(id);
    const sql = `UPDATE "alquiloya"."agente_posts" SET ${sets.join(", ")}
                  WHERE empresa_id=$${vals.length - 1}::uuid AND id=$${vals.length}::uuid
                  RETURNING id`;
    const r = await queryWithRetry<{ id: string }>(pool, sql, vals);
    if (!r.rows || r.rows.length === 0) return NextResponse.json({ error: "no encontrado" }, { status: 404 });
    return NextResponse.json({ success: true, id: r.rows[0].id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    if (/unique|duplicate/i.test(msg)) {
      return NextResponse.json({ error: "Slug duplicado" }, { status: 409 });
    }
    console.error("[api/dashboard/alquiloya-agente-posts/[id] PATCH]", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: Request, ctx: Ctx) {
  try {
    const user = await getAuthUserForApiRoute(request);
    if (!user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    const { id } = await ctx.params;
    if (!uuidRe.test(id)) return NextResponse.json({ error: "id invalido" }, { status: 400 });
    const pool = getChatPostgresPool();
    if (!pool) return NextResponse.json({ error: "Pool no disponible" }, { status: 500 });
    const r = await queryWithRetry<{ id: string }>(
      pool,
      `DELETE FROM "alquiloya"."agente_posts"
        WHERE empresa_id=$1::uuid AND id=$2::uuid
        RETURNING id`,
      [ALQUILOYA_EMPRESA_ID, id]
    );
    if (!r.rows || r.rows.length === 0) return NextResponse.json({ error: "no encontrado" }, { status: 404 });
    return NextResponse.json({ success: true, id: r.rows[0].id });
  } catch (err) {
    console.error("[api/dashboard/alquiloya-agente-posts/[id] DELETE]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
