import { NextRequest, NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { listPublicPropiedades } from "@/lib/alquiloya/public-api";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { getAuthUserForApiRoute } from "@/lib/auth/get-auth-user-for-api-route";
import { createServiceRoleClient } from "@/lib/supabase/service-admin";
import { resolveUsuarioErpFromAuthUser } from "@/lib/auth/resolve-usuario-erp";
import { extractPlanLimits } from "@/lib/alquiloya/plan-limits";
import { notifyAdminNuevaPropiedadPendiente } from "@/lib/alquiloya/notify-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALQUILOYA_EMPRESA_ID = "cf5df6fb-7705-4c4e-b29c-97bf5f314d8f";

export async function GET(request: NextRequest) {
  return listPublicPropiedades(request);
}

// ─── POST público — "Publicar gratis" desde la web ──────────────────────────
// Crea propiedad + propietario + fotos + características.
// La propiedad queda inactiva / no visible_web hasta que el admin la revise.
const TIPOS_OK = new Set([
  "departamento", "casa", "duplex", "duplex_ph", "terreno",
  "local_comercial", "oficina", "deposito", "casa_independiente",
  "salon_comercial", "alquiler_temporal",
]);
const OPERACIONES_OK = new Set(["alquiler", "venta"]);
const MAX_FOTOS = 20;
const MAX_CARAC = 30;

// Extrae la URL real cuando el campo viene como HTML embed (postimg, imgbb, etc.)
// IMPORTANTE: los data: URLs (subida desde dispositivo) pueden pesar cientos de KB.
// Si los truncamos a 1024 chars la imagen queda rota. Damos un cap muy alto para esos
// (10 MB de base64 ≈ 7 MB de imagen, que ya es absurdamente grande) y mantenemos
// el cap chico para URLs http/https normales.
const DATA_URL_MAX = 10 * 1024 * 1024;
function sanitizeImageUrl(v: unknown, max = 2048): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  if (!trimmed) return null;
  // 1) data URL de imagen: pasa tal cual, sin truncar (con cap defensivo de 10MB).
  if (/^data:image\//i.test(trimmed)) {
    return trimmed.slice(0, DATA_URL_MAX);
  }
  // 2) HTML embed (postimg, imgbb): extraer la URL real.
  if (/[<>]/.test(trimmed)) {
    const img = trimmed.match(/<img[^>]+src\s*=\s*["']([^"']+)["']/i);
    if (img?.[1]) return img[1].trim().slice(0, max);
    const href = trimmed.match(/<a[^>]+href\s*=\s*["']([^"']+)["']/i);
    if (href?.[1]) return href[1].trim().slice(0, max);
    const url = trimmed.match(/https?:\/\/[^\s"'<>]+/i);
    return url ? url[0].slice(0, max) : trimmed.slice(0, max);
  }
  // 3) URL simple: respetar el cap normal.
  return trimmed.slice(0, max);
}
function s(v: unknown, max = 1024): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
}
function n(v: unknown): number | null {
  if (v == null || v === "") return null;
  const x = Number(v);
  return Number.isFinite(x) && x >= 0 ? x : null;
}
// Coordenadas: NO pueden usar n() porque Paraguay esta en lat/lng NEGATIVAS
// (lat ~-25, lng ~-57). n() exige x >= 0 y nuleaba ambas, por eso las
// propiedades se guardaban sin ubicacion y el mapa de la ficha quedaba vacio.
function coord(v: unknown, kind: "lat" | "lng"): number | null {
  if (v == null || v === "") return null;
  const x = Number(v);
  if (!Number.isFinite(x)) return null;
  const limit = kind === "lat" ? 90 : 180;
  return Math.abs(x) <= limit ? x : null;
}
function i(v: unknown): number | null {
  const x = n(v);
  return x == null ? null : Math.trunc(x);
}
function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}
function normalizeTipo(raw: string | null): string | null {
  if (!raw) return null;
  const t = raw.trim().toLowerCase().replace(/\s+/g, "_");
  if (t === "depto") return "departamento";
  if (t === "salon") return "salon_comercial";
  if (t === "temporal") return "alquiler_temporal";
  if (t === "local") return "local_comercial";
  return TIPOS_OK.has(t) ? t : null;
}
function normalizeOperacion(raw: string | null): string {
  if (!raw) return "alquiler";
  const o = raw.trim().toLowerCase();
  if (o === "venta") return "venta";
  // 'permanente', 'temporal', 'alquiler', cualquier otro → alquiler
  return "alquiler";
}

type CaracIn = { nombre?: string; valor?: string | null; icono?: string | null };
type FotoIn = { url?: string; alt?: string | null; es_portada?: boolean | null };
type Body = {
  titulo?: string; tipo?: string; operacion?: string; descripcion?: string;
  lat?: number | string | null;
  lng?: number | string | null;
  ciudad?: string; barrio?: string; direccion?: string;
  precio?: number | string; moneda?: string;
  dormitorios?: number | string; banos?: number | string; cocheras?: number | string;
  superficie_m2?: number | string; terreno_m2?: number | string;
  fotos?: FotoIn[];
  caracteristicas?: CaracIn[];
  propietario_nombre?: string;
  propietario_email?: string;
  propietario_telefono?: string;
  // Numero PUBLICO que aparece en la ficha (boton "Consultar por WhatsApp").
  // Si NO lo manda, se usa propietario_telefono como fallback.
  propietario_telefono_contacto?: string;
  propietario_documento?: string;
  plan_publicacion_id?: string | null;
  notas_propietario?: string;
};

export async function POST(request: Request) {
  try {
    // ── Gate de cuenta ───────────────────────────────────────────────────────
    // Politica del cliente (junio 2026): los propietarios pueden publicar SIN
    // crear cuenta — el flujo se trata como solicitud anonima, y mas abajo se
    // crea/encuentra la fila en alquiloya.propietarios por email/telefono del
    // body. La cuenta SI sigue siendo obligatoria para agentes (porque la
    // propiedad se les vincula y se valida cuota del plan), pero como no
    // sabemos el rol de antemano la regla es: si NO hay sesion -> path
    // propietario anonimo; si HAY sesion -> mantenemos las validaciones de
    // perfil/plan del usuario (agente o propietario linkeado).
    const authUser = await getAuthUserForApiRoute(request);
    const supabase = createServiceRoleClient();

    let agenteId: string | null = null;
    let usuarioPropietarioId: string | null = null;

    if (authUser?.id) {
      const usuarioErp = await resolveUsuarioErpFromAuthUser(supabase, authUser);
      if (!usuarioErp || usuarioErp.empresa_id !== ALQUILOYA_EMPRESA_ID) {
        // Sesion de otra empresa -> degradamos a anonimo para no bloquear.
      } else {
        const { data: uExt } = await supabase
          .from("usuarios")
          .select("agente_id, propietario_id, email")
          .eq("id", usuarioErp.id)
          .limit(1)
          .maybeSingle();
        agenteId = (uExt as { agente_id?: string | null } | null)?.agente_id ?? null;
        usuarioPropietarioId = (uExt as { propietario_id?: string | null } | null)?.propietario_id ?? null;

        // Fallback: si no hay propietario_id linkeado pero el usuario tiene
        // email que matchea con un propietarios.email existente, lo resolvemos
        // por email y auto-vinculamos.
        if (!agenteId && !usuarioPropietarioId) {
          const candidateEmails = [
            (uExt as { email?: string | null } | null)?.email ?? null,
            authUser.email ?? null,
          ].filter((e): e is string => typeof e === "string" && e.trim().length > 0);
          for (const em of candidateEmails) {
            const { data: pr } = await supabase
              .from("propietarios")
              .select("id")
              .ilike("email", em.trim())
              .eq("empresa_id", ALQUILOYA_EMPRESA_ID)
              .limit(1)
              .maybeSingle();
            const prId = (pr as { id?: string } | null)?.id ?? null;
            if (prId) {
              usuarioPropietarioId = prId;
              await supabase
                .from("usuarios")
                .update({ propietario_id: prId })
                .eq("id", usuarioErp.id);
              break;
            }
          }
        }
      }
    }
    // Si no resolvimos perfil (anonimo o sesion sin perfil) seguimos como
    // path propietario y mas abajo encontramos/creamos la fila por email/tel.

    // Limits del plan que aplican al actor (agente o propietario). Se llenan
    // mas abajo segun el path y los usamos para capear fotos al insertar.
    let actorPlanLimits: { propiedadesActivas: number | null; fotosPorInmueble: number | null } = {
      propiedadesActivas: null,
      fotosPorInmueble: null,
    };

    // Path agente: validar que el agente este activo, con plan asignado y
    // sin haber agotado la cuota de propiedades activas.
    if (agenteId) {
      const { data: agRow } = await supabase
        .from("agentes")
        .select("id, activo, plan_publicacion_id, plan_vencimiento_at")
        .eq("id", agenteId)
        .eq("empresa_id", ALQUILOYA_EMPRESA_ID)
        .limit(1)
        .maybeSingle();
      if (!agRow || (agRow as { activo?: boolean }).activo !== true) {
        return NextResponse.json(
          { error: "Tu cuenta de agente esta inactiva. Contactanos para reactivarla." },
          { status: 403 }
        );
      }
      const planId = (agRow as { plan_publicacion_id?: string | null }).plan_publicacion_id ?? null;
      if (!planId) {
        return NextResponse.json(
          { error: "Necesitas un plan activo para publicar. Elegi un plan desde tu panel.", code: "sin_plan" },
          { status: 402 }
        );
      }
      const venc = (agRow as { plan_vencimiento_at?: string | null }).plan_vencimiento_at ?? null;
      if (venc && new Date(venc).getTime() < Date.now()) {
        return NextResponse.json(
          { error: "Tu plan esta vencido. Renovalo para volver a publicar.", code: "plan_vencido" },
          { status: 402 }
        );
      }
      // Cuota: leemos el bullet "N propiedades activas" del plan y contamos
      // las propiedades visibles del agente. Si alcanzo el limite, bloquea.
      const { data: planRow } = await supabase
        .from("planes_publicacion")
        .select("bullets")
        .eq("id", planId)
        .eq("empresa_id", ALQUILOYA_EMPRESA_ID)
        .limit(1)
        .maybeSingle();
      const limits = extractPlanLimits((planRow as { bullets?: unknown } | null)?.bullets);
      actorPlanLimits = limits;
      if (limits.propiedadesActivas != null) {
        const { count: activeCount } = await supabase
          .from("propiedades")
          .select("id", { count: "exact", head: true })
          .eq("empresa_id", ALQUILOYA_EMPRESA_ID)
          .eq("agente_id", agenteId)
          .eq("activo", true)
          .eq("visible_web", true);
        const used = typeof activeCount === "number" ? activeCount : 0;
        if (used >= limits.propiedadesActivas) {
          return NextResponse.json(
            {
              error: `Llegaste al limite de tu plan (${used}/${limits.propiedadesActivas} propiedades activas). Pausa una propiedad o pasa a un plan superior.`,
              code: "limite_alcanzado",
              activas: used,
              limite: limits.propiedadesActivas,
            },
            { status: 402 }
          );
        }
      }
    } else if (usuarioPropietarioId) {
      // Path propietario LOGUEADO: validar plan (vencimiento + cuota) si tiene
      // plan_publicacion_id asignado. NO chequeamos `activo`: política del
      // cliente — los propietarios publican sin cuenta, no se les bloquea por
      // estado de cuenta. Si está anónimo (sin usuarioPropietarioId) salteamos
      // este bloque entero y la fila de propietario se crea/encuentra abajo
      // por email/teléfono.
      const { data: prRow } = await supabase
        .from("propietarios")
        .select("id, plan_publicacion_id, plan_vencimiento_at")
        .eq("id", usuarioPropietarioId)
        .eq("empresa_id", ALQUILOYA_EMPRESA_ID)
        .limit(1)
        .maybeSingle();
      const pPlanId = (prRow as { plan_publicacion_id?: string | null } | null)?.plan_publicacion_id ?? null;
      if (pPlanId) {
        const venc = (prRow as { plan_vencimiento_at?: string | null }).plan_vencimiento_at ?? null;
        if (venc && new Date(venc).getTime() < Date.now()) {
          return NextResponse.json(
            { error: "Tu plan esta vencido. Renovalo para volver a publicar.", code: "plan_vencido" },
            { status: 402 }
          );
        }
        const { data: planRow } = await supabase
          .from("planes_publicacion")
          .select("bullets")
          .eq("id", pPlanId)
          .eq("empresa_id", ALQUILOYA_EMPRESA_ID)
          .limit(1)
          .maybeSingle();
        const limits = extractPlanLimits((planRow as { bullets?: unknown } | null)?.bullets);
        actorPlanLimits = limits;
        if (limits.propiedadesActivas != null) {
          const { count: activeCount } = await supabase
            .from("propiedades")
            .select("id", { count: "exact", head: true })
            .eq("empresa_id", ALQUILOYA_EMPRESA_ID)
            .eq("propietario_id", usuarioPropietarioId!)
            .eq("activo", true);
          const used = typeof activeCount === "number" ? activeCount : 0;
          if (used >= limits.propiedadesActivas) {
            return NextResponse.json(
              {
                error: `Llegaste al limite de tu plan (${used}/${limits.propiedadesActivas} propiedades activas). Pausa una propiedad o pasa a un plan superior.`,
                code: "limite_alcanzado",
                activas: used,
                limite: limits.propiedadesActivas,
              },
              { status: 402 }
            );
          }
        }
      }
    }

    const body = (await request.json().catch(() => ({}))) as Body;

    // Sanitización + validaciones
    const titulo = s(body.titulo, 240);
    const tipo = normalizeTipo(s(body.tipo, 60));
    const operacion = normalizeOperacion(s(body.operacion, 30));
    const ciudad = s(body.ciudad, 120);
    const precio = n(body.precio);
    const propNombre = s(body.propietario_nombre, 240);
    const propEmail = s(body.propietario_email, 240);
    const propTelefono = s(body.propietario_telefono, 60);
    const propTelefonoContacto = s(body.propietario_telefono_contacto, 60);

    if (!titulo) return NextResponse.json({ error: "titulo requerido" }, { status: 400 });
    if (!tipo) return NextResponse.json({ error: "tipo invalido" }, { status: 400 });
    if (!OPERACIONES_OK.has(operacion)) return NextResponse.json({ error: "operacion invalida" }, { status: 400 });
    if (!ciudad) return NextResponse.json({ error: "ciudad requerida" }, { status: 400 });
    if (operacion === "alquiler" || operacion === "venta") {
      if (precio == null || precio < 0) {
        return NextResponse.json({ error: "precio requerido" }, { status: 400 });
      }
    }
    if (!propNombre) return NextResponse.json({ error: "Nombre del propietario requerido" }, { status: 400 });
    if (!propEmail && !propTelefono) {
      return NextResponse.json({ error: "Necesitamos email o teléfono del propietario" }, { status: 400 });
    }
    if (propEmail && !isEmail(propEmail)) {
      return NextResponse.json({ error: "email invalido" }, { status: 400 });
    }

    // Cap de fotos = min(hard MAX_FOTOS, limite del plan). Si el cliente
    // mando mas, devolvemos 402 con el limite — preferimos error explicito
    // a silenciosamente truncar, asi el frontend muestra "tu plan permite N".
    const fotosLimitFromPlan = actorPlanLimits.fotosPorInmueble;
    const effectiveFotosCap =
      fotosLimitFromPlan != null ? Math.min(MAX_FOTOS, fotosLimitFromPlan) : MAX_FOTOS;
    const rawFotos = Array.isArray(body.fotos) ? body.fotos : [];
    if (rawFotos.length > effectiveFotosCap) {
      return NextResponse.json(
        {
          error: `Tu plan permite hasta ${effectiveFotosCap} fotos por inmueble. Estas subiendo ${rawFotos.length}. Quitá fotos o pasá a un plan superior.`,
          code: "limite_fotos",
          fotos: rawFotos.length,
          limite: effectiveFotosCap,
        },
        { status: 402 }
      );
    }
    const fotos = rawFotos.slice(0, effectiveFotosCap);
    const carac = Array.isArray(body.caracteristicas) ? body.caracteristicas.slice(0, MAX_CARAC) : [];

    const pool = getChatPostgresPool();
    if (!pool) return NextResponse.json({ error: "Pool no disponible" }, { status: 500 });

    const client: PoolClient = await pool.connect();
    try {
      await client.query("BEGIN");

      // Bootstrap idempotente: aseguramos que la columna telefono_contacto
      // exista en alquiloya.propietarios. Mirror de la migracion
      // 20260704120000. Sin esto, si la DB de prod todavia no corrio la
      // migracion el INSERT de abajo explota con "column does not exist".
      await client.query(
        `ALTER TABLE "alquiloya"."propietarios"
           ADD COLUMN IF NOT EXISTS telefono_contacto text`
      );

      // 1. Resolver propietario_id.
      //   - Si el usuario es propietario directo (usuarioPropietarioId set),
      //     usamos esa fila — la propiedad es PARA ese propietario.
      //   - Si es agente publicando para un tercero, buscamos por email/telefono
      //     del body y, si no existe, creamos abajo.
      let propietarioId: string | null = usuarioPropietarioId;
      if (!propietarioId && propEmail) {
        const r = await client.query<{ id: string }>(
          `SELECT id FROM "alquiloya"."propietarios"
            WHERE empresa_id=$1::uuid AND lower(email)=lower($2) LIMIT 1`,
          [ALQUILOYA_EMPRESA_ID, propEmail]
        );
        if (r.rows[0]) propietarioId = r.rows[0].id;
      }
      if (!propietarioId && propTelefono) {
        const r = await client.query<{ id: string }>(
          `SELECT id FROM "alquiloya"."propietarios"
            WHERE empresa_id=$1::uuid AND telefono=$2 LIMIT 1`,
          [ALQUILOYA_EMPRESA_ID, propTelefono]
        );
        if (r.rows[0]) propietarioId = r.rows[0].id;
      }

      // plan_publicacion_id puede llegar como UUID directo o como tier slug (ej. "gratuito-owner").
      // Si no es UUID, resolvemos contra planes_publicacion por tier; si tampoco existe, queda null.
      const planRaw = s(body.plan_publicacion_id, 80);
      let planId: string | null = null;
      let planEsGratis = false;
      if (planRaw) {
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(planRaw)) {
          planId = planRaw;
          const r = await client.query<{ billing: string | null; tier: string | null }>(
            `SELECT billing, tier FROM "alquiloya"."planes_publicacion"
              WHERE id = $1::uuid AND empresa_id = $2::uuid LIMIT 1`,
            [planId, ALQUILOYA_EMPRESA_ID]
          );
          const row = r.rows[0];
          planEsGratis = row?.billing === "gratis" || (row?.tier ?? "").toLowerCase().startsWith("gratuito");
        } else {
          const r = await client.query<{ id: string; billing: string | null; tier: string | null }>(
            `SELECT id, billing, tier FROM "alquiloya"."planes_publicacion"
              WHERE empresa_id = $1::uuid AND tier = $2 AND activo = true
              LIMIT 1`,
            [ALQUILOYA_EMPRESA_ID, planRaw]
          );
          const row = r.rows[0];
          planId = row?.id ?? null;
          planEsGratis = row?.billing === "gratis" || (row?.tier ?? "").toLowerCase().startsWith("gratuito");
        }
      }
      const notas = s(body.notas_propietario, 1000);

      if (!propietarioId) {
        const r = await client.query<{ id: string }>(
          `INSERT INTO "alquiloya"."propietarios" (
             empresa_id, nombre, email, telefono, telefono_contacto, documento,
             estado, activo, plan_publicacion_id, observaciones
           )
           VALUES ($1::uuid, $2, $3, $4, $5, $6, 'pendiente', true, $7, $8)
           RETURNING id`,
          [
            ALQUILOYA_EMPRESA_ID,
            propNombre,
            propEmail,
            propTelefono,
            propTelefonoContacto,
            s(body.propietario_documento, 60),
            planId,
            notas,
          ]
        );
        propietarioId = r.rows[0].id;
      } else if (planId || notas || propTelefonoContacto) {
        // Actualizar plan / observaciones / telefono_contacto si llegaron y la fila ya existia
        await client.query(
          `UPDATE "alquiloya"."propietarios"
              SET plan_publicacion_id = COALESCE($1, plan_publicacion_id),
                  observaciones       = COALESCE($2, observaciones),
                  telefono_contacto   = COALESCE($3, telefono_contacto),
                  updated_at = now()
            WHERE id = $4::uuid`,
          [planId, notas, propTelefonoContacto, propietarioId]
        );
      }

      // 1bis. Gate plan gratis: 1 propiedad activa por propietario cada 30 dias.
      // Si el plan resuelto en este request es gratis (o no se mando plan pero el
      // propietario ya tenia uno gratis), chequeamos si tiene una propiedad
      // activa creada hace menos de 30 dias. Si si, bloqueamos: tiene que comprar
      // un plan pago para publicar otra. La regla aplica por propietario_id
      // (vale tanto si publica un dueño directo como un agente publicando
      // para ese propietario).
      let efectivoPlanEsGratis = planEsGratis;
      if (!efectivoPlanEsGratis) {
        // Si no llego planId en este request, mirar el plan actual del propietario.
        const propPlan = await client.query<{ billing: string | null; tier: string | null }>(
          `SELECT pp.billing, pp.tier
             FROM "alquiloya"."propietarios" p
             LEFT JOIN "alquiloya"."planes_publicacion" pp ON pp.id = p.plan_publicacion_id
            WHERE p.id = $1::uuid LIMIT 1`,
          [propietarioId]
        );
        const row = propPlan.rows[0];
        efectivoPlanEsGratis = row?.billing === "gratis" || (row?.tier ?? "").toLowerCase().startsWith("gratuito");
      }
      if (efectivoPlanEsGratis) {
        const dup = await client.query<{ n: number }>(
          `SELECT count(*)::int AS n
             FROM "alquiloya"."propiedades"
            WHERE empresa_id = $1::uuid
              AND propietario_id = $2::uuid
              AND activo = true
              AND created_at > now() - interval '30 days'`,
          [ALQUILOYA_EMPRESA_ID, propietarioId]
        );
        if ((dup.rows[0]?.n ?? 0) >= 1) {
          await client.query("ROLLBACK");
          return NextResponse.json(
            {
              error:
                "Ya tenés una publicación gratuita activa de los últimos 30 días. " +
                "Comprá un plan pago para publicar más propiedades.",
              code: "FREE_PLAN_LIMIT",
            },
            { status: 409 }
          );
        }
      }

      // 2. Insertar propiedad — siempre como NO publicada/inactiva, linkeada
      // al agente_id resuelto desde la sesion (ya no se crea con agente_id=NULL).
      const ins = await client.query<{ id: string; codigo: string | null }>(
        `INSERT INTO "alquiloya"."propiedades" (
           empresa_id, propietario_id, agente_id, codigo, titulo, descripcion,
           tipo, operacion, estado, ciudad, barrio, direccion,
           precio, moneda, dormitorios, banos, cocheras,
           superficie_m2, terreno_m2,
           destacada, visible_web, activo, lat, lng, video_url
         )
         VALUES (
           $1::uuid, $2::uuid, $3::uuid,
           'AY-PUB-' || to_char(now(),'YYYYMMDDHH24MISS') || '-' || floor(random()*1000)::int,
           $4, $5, $6, $7,
           'inactiva',
           $8, $9, $10,
           $11, COALESCE($12,'PYG'), $13, $14, $15,
           $16, $17,
           false, false, false, $18, $19, $20
         )
         RETURNING id, codigo`,
        [
          ALQUILOYA_EMPRESA_ID,
          propietarioId,
          agenteId,
          titulo,
          s(body.descripcion, 4000),
          tipo,
          operacion,
          ciudad,
          s(body.barrio, 120),
          s(body.direccion, 240),
          precio,
          s(body.moneda, 10),
          i(body.dormitorios),
          i(body.banos),
          i(body.cocheras),
          n(body.superficie_m2),
          n(body.terreno_m2),
          coord(body.lat, "lat"),
          coord(body.lng, "lng"),
          s(body.video_url, 1024),
        ]
      );
      const propId = ins.rows[0].id;

      // 3. Fotos
      let orden = 0;
      for (const f of fotos) {
        const url = sanitizeImageUrl(f?.url, 1024);
        if (!url) continue;
        await client.query(
          `INSERT INTO "alquiloya"."propiedad_fotos"
             (empresa_id, propiedad_id, url, alt, orden, es_portada, activo)
           VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, true)`,
          [
            ALQUILOYA_EMPRESA_ID, propId, url,
            s(f?.alt, 240),
            orden,
            orden === 0 ? true : !!f?.es_portada,
          ]
        );
        orden++;
      }

      // 4. Características
      let cOrden = 0;
      for (const c of carac) {
        const nombre = s(c?.nombre, 120);
        if (!nombre) continue;
        await client.query(
          `INSERT INTO "alquiloya"."propiedad_caracteristicas"
             (empresa_id, propiedad_id, nombre, valor, icono, orden, activo)
           VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, true)`,
          [
            ALQUILOYA_EMPRESA_ID, propId, nombre,
            s(c?.valor, 240),
            s(c?.icono, 60),
            cOrden,
          ]
        );
        cOrden++;
      }

      await client.query("COMMIT");
      // Aviso al admin: nueva propiedad pendiente de aprobacion. Fire-and-forget,
      // no bloquea la respuesta y no falla si SMTP no esta configurado.
      void notifyAdminNuevaPropiedadPendiente({
        propiedadId: propId,
        codigo: ins.rows[0].codigo,
        titulo,
        tipo,
        operacion,
        ciudad,
        precio,
        moneda: s(body.moneda, 10) || "PYG",
        propietario: {
          nombre: propNombre || null,
          email: propEmail || null,
          telefono: propTelefonoContacto || propTelefono || null,
        },
        requestHeaders: request.headers,
      }).catch((err) => {
        console.warn("[notifyAdminNuevaPropiedadPendiente] error:", err instanceof Error ? err.message : err);
      });
      return NextResponse.json({
        success: true,
        propiedad_id: propId,
        codigo: ins.rows[0].codigo,
        propietario_id: propietarioId,
        estado: "inactiva",
        visible_web: false,
        activo: false,
        message: "Tu propiedad fue enviada para revisión. El equipo de AlquiloYa la revisará antes de publicarla.",
      });
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("[api public alquiloya/propiedades POST]", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}
