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
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function t(table: string): string {
  return `"${ALQUILOYA_SCHEMA}"."${table}"`;
}
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

// Sanitiza HTML del post: solo deja tags con sentido editorial. Aplica a
// POST y PATCH antes de guardar. Tag whitelist coincide con el toolbar del
// frontend (BlogContentEditor en admin.jsx) y con los estilos .post-html
// definidos en /alquiloya-legacy/index.html.
// NO es un sanitizer perfecto (sin DOMPurify por costo en serverless) pero
// elimina los vectores de XSS clasicos: script, iframe, style, on* handlers,
// javascript: URLs.
export function sanitizeBlogHtml(input: string | null): string | null {
  if (input == null) return null;
  let h = input;
  // Drop tags peligrosos enteros.
  h = h.replace(/<(script|iframe|style|object|embed|link|meta|form|input|button)[\s\S]*?<\/\1>/gi, "");
  // Drop tags self-closing peligrosos.
  h = h.replace(/<(script|iframe|style|object|embed|link|meta|input)[^>]*\/?>/gi, "");
  // Drop event handlers on*= en cualquier atributo.
  h = h.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  // Drop javascript: y data: URLs en href/src.
  h = h.replace(/(\s(?:href|src|action)\s*=\s*)(["'])\s*(javascript|data|vbscript):[^"']*\2/gi, '$1$2#$2');
  return h;
}

async function resolveAgenteId(request: Request): Promise<{ ok: false; res: NextResponse } | { ok: true; agenteId: string }> {
  const user = await getAuthUserForApiRoute(request);
  if (!user?.id) return { ok: false, res: NextResponse.json({ error: "No autenticado" }, { status: 401 }) };
  const supabase = createServiceRoleClient();
  const usuario = await resolveUsuarioErpFromAuthUser(supabase, user);
  if (!usuario || usuario.empresa_id !== ALQUILOYA_EMPRESA_ID) {
    return { ok: false, res: NextResponse.json({ error: "Usuario no resuelto" }, { status: 404 }) };
  }
  const { data: uExt } = await supabase
    .from("usuarios")
    .select("agente_id")
    .eq("id", usuario.id)
    .limit(1)
    .maybeSingle();
  const agenteId = (uExt as { agente_id?: string | null } | null)?.agente_id ?? null;
  if (!agenteId || !uuidRe.test(agenteId)) {
    return { ok: false, res: NextResponse.json({ error: "Tu cuenta no está vinculada a un agente" }, { status: 403 }) };
  }
  return { ok: true, agenteId };
}

export async function GET(request: Request) {
  try {
    const auth = await resolveAgenteId(request);
    if (!auth.ok) return auth.res;
    const pool = getChatPostgresPool();
    if (!pool) return NextResponse.json({ error: "Pool no disponible" }, { status: 500 });
    try {
      const { rows } = await queryWithRetry(
        pool,
        `SELECT id, slug, titulo, resumen, contenido, cover_url,
                publicado, destacado, orden,
                publicado_at::text AS publicado_at,
                created_at::text AS created_at,
                updated_at::text AS updated_at
           FROM ${t("agente_posts")}
          WHERE empresa_id = $1::uuid AND agente_id = $2::uuid
          ORDER BY updated_at DESC NULLS LAST`,
        [ALQUILOYA_EMPRESA_ID, auth.agenteId]
      );
      return NextResponse.json({ success: true, posts: rows ?? [] });
    } catch (e) {
      // Tabla aun no migrada: devolvemos lista vacia con flag para UI mas amigable.
      const msg = e instanceof Error ? e.message : String(e);
      if (/does not exist|relation .* does not exist/i.test(msg)) {
        return NextResponse.json({
          success: true,
          posts: [],
          notice: "El blog aún no está activo. Pedile al admin que corra la migración de agente_posts.",
        });
      }
      throw e;
    }
  } catch (err) {
    console.error("[api/agente/posts GET]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await resolveAgenteId(request);
    if (!auth.ok) return auth.res;
    const pool = getChatPostgresPool();
    if (!pool) return NextResponse.json({ error: "Pool no disponible" }, { status: 500 });

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
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
      `INSERT INTO ${t("agente_posts")}
         (empresa_id, agente_id, slug, titulo, resumen, contenido, cover_url,
          publicado, destacado, orden, publicado_at)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10,
               CASE WHEN $8::boolean THEN now() ELSE NULL END)
       RETURNING id`,
      [ALQUILOYA_EMPRESA_ID, auth.agenteId, slug, titulo, resumen, contenido, coverUrl,
       publicado, destacado, orden]
    );
    return NextResponse.json({ success: true, id: rows[0].id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    if (/unique|duplicate/i.test(msg)) {
      return NextResponse.json({ error: "Ya tenés un post con ese slug" }, { status: 409 });
    }
    console.error("[api/agente/posts POST]", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
