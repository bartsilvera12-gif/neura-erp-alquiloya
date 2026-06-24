import { NextResponse } from "next/server";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { queryWithRetry } from "@/lib/supabase/pg-retry";
import { successResponse, errorResponse } from "@/lib/api/response";
import { getAuthUserForApiRoute } from "@/lib/auth/get-auth-user-for-api-route";
import { createServiceRoleClient } from "@/lib/supabase/service-admin";
import { resolveUsuarioErpFromAuthUser } from "@/lib/auth/resolve-usuario-erp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALQUILOYA_EMPRESA_ID = "cf5df6fb-7705-4c4e-b29c-97bf5f314d8f";
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Cache module-level: una vez que confirmamos que la tabla existe (o la
// bootstrapeamos), no volvemos a hacer la check. Se invalida con el cold
// start del proceso (deploy o reinicio del container).
let solicitudesServicioReady = false;

// Espejo idempotente de supabase/migrations/20260626120000_alquiloya_solicitudes_servicio.sql
// Se ejecuta on-demand si la tabla no existe en la DB de produccion.
// Mantener sincronizado con el archivo de migracion.
const BOOTSTRAP_SOLICITUDES_SERVICIO_SQL = `
CREATE SCHEMA IF NOT EXISTS alquiloya;

CREATE TABLE IF NOT EXISTS alquiloya.solicitudes_servicio (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid NOT NULL,
  kind            text NOT NULL CHECK (kind IN ('cambio_plan','impulsos','verificacion')),
  nombre          text NOT NULL,
  email           text,
  telefono        text,
  propiedad_id    uuid,
  propietario_id  uuid,
  agente_id       uuid,
  plan_tier       text,
  pack_id         text,
  pack_qty        int,
  monto           numeric(14,2),
  mensaje         text,
  estado          text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','aprobada','rechazada')),
  motivo_rechazo  text,
  revisado_por    uuid,
  revisado_at     timestamptz,
  resultado_id    uuid,
  metadata        jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS solicitudes_servicio_empresa_idx
  ON alquiloya.solicitudes_servicio (empresa_id);
CREATE INDEX IF NOT EXISTS solicitudes_servicio_estado_idx
  ON alquiloya.solicitudes_servicio (empresa_id, estado, created_at DESC);
CREATE INDEX IF NOT EXISTS solicitudes_servicio_kind_idx
  ON alquiloya.solicitudes_servicio (empresa_id, kind);

CREATE OR REPLACE FUNCTION alquiloya.solicitudes_servicio_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $func$
BEGIN NEW.updated_at := now(); RETURN NEW; END
$func$;

DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'solicitudes_servicio_set_updated_at'
      AND tgrelid = 'alquiloya.solicitudes_servicio'::regclass
  ) THEN
    EXECUTE 'CREATE TRIGGER solicitudes_servicio_set_updated_at
             BEFORE UPDATE ON alquiloya.solicitudes_servicio
             FOR EACH ROW EXECUTE FUNCTION alquiloya.solicitudes_servicio_set_updated_at()';
  END IF;
END
$do$;
`;

type Kind = "cambio_plan" | "impulsos" | "verificacion";

function s(v: unknown, max = 500): string | null {
  if (typeof v !== "string") return null;
  const x = v.trim();
  if (!x) return null;
  return x.slice(0, max);
}
function uuid(v: unknown): string | null {
  const x = s(v, 40);
  return x && uuidRe.test(x) ? x : null;
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

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    const kindRaw = s(body.kind, 20);
    if (kindRaw !== "cambio_plan" && kindRaw !== "impulsos" && kindRaw !== "verificacion") {
      return NextResponse.json(errorResponse("kind invalido"), { status: 400 });
    }
    const kind = kindRaw as Kind;

    const nombre = s(body.nombre, 160);
    const email = s(body.email, 160);
    const telefono = s(body.telefono, 40);
    if (!nombre) return NextResponse.json(errorResponse("nombre requerido"), { status: 400 });
    if (!email && !telefono) {
      return NextResponse.json(errorResponse("ingresá email o telefono"), { status: 400 });
    }

    let planTier: string | null = null;
    let packId: string | null = null;
    let packQty: number | null = null;
    const monto: number | null = num(body.monto);
    let propiedadId: string | null = null;
    const mensaje = s(body.mensaje, 1200);

    if (kind === "cambio_plan") {
      planTier = s(body.plan_tier, 40);
      if (!planTier) return NextResponse.json(errorResponse("plan_tier requerido"), { status: 400 });
    }
    if (kind === "impulsos") {
      packId = s(body.pack_id, 40);
      packQty = int(body.pack_qty);
      if (!packId || !packQty || packQty <= 0) {
        return NextResponse.json(errorResponse("pack_id y pack_qty requeridos"), { status: 400 });
      }
    }
    if (kind === "verificacion") {
      propiedadId = uuid(body.propiedad_id);
      // propiedad_id puede ser null si el usuario aún no la registró; el ERP la vincula al revisar.
    }

    // Si el caller esta autenticado (panel propietario o agente), resolvemos
    // su agente_id / propietario_id desde alquiloya.usuarios. Lo guardamos en
    // la fila para que el modal de aprobacion en /dashboard/solicitudes-servicio
    // pueda preseleccionar al titular correcto sin tener que hacer fuzzy match
    // por email/telefono. Es OPCIONAL — anonimos (publico) siguen funcionando.
    let resolvedAgenteId: string | null = null;
    let resolvedPropietarioId: string | null = null;
    try {
      const authUser = await getAuthUserForApiRoute(request);
      if (authUser?.id) {
        const supabase = createServiceRoleClient();
        const usuarioErp = await resolveUsuarioErpFromAuthUser(supabase, authUser);
        if (usuarioErp && usuarioErp.empresa_id === ALQUILOYA_EMPRESA_ID) {
          const { data: uExt } = await supabase
            .from("usuarios")
            .select("agente_id, propietario_id")
            .eq("id", usuarioErp.id)
            .limit(1)
            .maybeSingle();
          resolvedAgenteId = (uExt as { agente_id?: string | null } | null)?.agente_id ?? null;
          resolvedPropietarioId = (uExt as { propietario_id?: string | null } | null)?.propietario_id ?? null;
        }
      }
    } catch (authErr) {
      // No bloqueamos: si falla la autenticacion, dejamos los ids en null y
      // el admin los selecciona manualmente con el fuzzy-match por email.
      console.warn(
        "[api/public/alquiloya/solicitudes-servicio] auth lookup fail:",
        authErr instanceof Error ? authErr.message : authErr
      );
    }

    const pool = getChatPostgresPool();
    if (!pool) return NextResponse.json(errorResponse("Pool no disponible"), { status: 500 });

    // Verificamos que la tabla exista; si no, la bootstrapeamos en el momento.
    // Asi el cliente que apreta "Comprar impulsos" no se queda colgado por una
    // migracion que nadie corrio en la DB de produccion. Toda la DDL es
    // idempotente (CREATE TABLE/INDEX/TRIGGER IF NOT EXISTS), asi que llamarla
    // varias veces no rompe nada — pero igual cacheamos el resultado en memoria
    // del proceso para evitar overhead en el caso comun (tabla ya existe).
    if (!solicitudesServicioReady) {
      const { rows: existsRows } = await queryWithRetry<{ exists: boolean }>(
        pool,
        `SELECT EXISTS (
           SELECT 1 FROM pg_class c
           JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'alquiloya' AND c.relname = 'solicitudes_servicio' AND c.relkind = 'r'
         ) AS exists`,
        []
      );
      if (!existsRows[0]?.exists) {
        try {
          await queryWithRetry(pool, BOOTSTRAP_SOLICITUDES_SERVICIO_SQL, []);
        } catch (bootErr) {
          // Si el bootstrap falla, le devolvemos al cliente un mensaje claro
          // y el codigo SQLSTATE para soporte. No retry-eamos automaticamente.
          const code = (bootErr as { code?: string })?.code ?? "";
          console.error(
            "[api/public/alquiloya/solicitudes-servicio] bootstrap fail",
            "code=" + code,
            bootErr instanceof Error ? bootErr.message : bootErr
          );
          return NextResponse.json(
            errorResponse(
              "No pudimos preparar el modulo de solicitudes. Contactanos por WhatsApp para coordinar tu compra." +
                (code ? ` (codigo ${code})` : "")
            ),
            { status: 503 }
          );
        }
      }
      solicitudesServicioReady = true;
    }

    // Bootstrap idempotente de columnas referral_link_id / referral_partner_id.
    try {
      await queryWithRetry(pool, `ALTER TABLE "alquiloya"."solicitudes_servicio" ADD COLUMN IF NOT EXISTS referral_link_id uuid`, []);
      await queryWithRetry(pool, `ALTER TABLE "alquiloya"."solicitudes_servicio" ADD COLUMN IF NOT EXISTS referral_partner_id uuid`, []);
    } catch (e) {
      console.warn("[solicitudes-servicio] bootstrap referral cols:", e instanceof Error ? e.message : e);
    }

    // Atribucion de referido: si el visitante tiene cookie aly_ref
    // (seteada por /r/{slug}), buscamos el ultimo click suyo para sacar
    // link_id + partner_id y dejarlos en la solicitud para que al
    // aprobarla se registre la conversion.
    let referralLinkId: string | null = null;
    let referralPartnerId: string | null = null;
    try {
      const cookieHdr = request.headers.get("cookie") ?? "";
      const aly = /(?:^|;\s*)aly_ref=([A-Za-z0-9_-]{16,64})/.exec(cookieHdr);
      if (aly?.[1]) {
        const { rows: clk } = await queryWithRetry<{ link_id: string; partner_id: string }>(
          pool,
          `SELECT c.link_id, l.partner_id
             FROM "alquiloya"."referral_clicks" c
             JOIN "alquiloya"."referral_links" l ON l.id = c.link_id
            WHERE c.empresa_id = $1::uuid AND c.visitor_cookie = $2
            ORDER BY c.created_at DESC LIMIT 1`,
          [ALQUILOYA_EMPRESA_ID, aly[1]]
        );
        if (clk[0]) { referralLinkId = clk[0].link_id; referralPartnerId = clk[0].partner_id; }
      }
    } catch (e) {
      console.warn("[solicitudes-servicio] resolver aly_ref:", e instanceof Error ? e.message : e);
    }

    const { rows } = await queryWithRetry<{ id: string }>(
      pool,
      `INSERT INTO "alquiloya"."solicitudes_servicio"
         (empresa_id, kind, nombre, email, telefono,
          propiedad_id, propietario_id, agente_id,
          plan_tier, pack_id, pack_qty, monto, mensaje, estado,
          referral_link_id, referral_partner_id)
       VALUES ($1::uuid, $2, $3, $4, $5,
               $6, $7, $8,
               $9, $10, $11, $12, $13, 'pendiente',
               $14::uuid, $15::uuid)
       RETURNING id`,
      [
        ALQUILOYA_EMPRESA_ID, kind, nombre, email, telefono,
        propiedadId, resolvedPropietarioId, resolvedAgenteId,
        planTier, packId, packQty, monto, mensaje,
        referralLinkId, referralPartnerId,
      ]
    );
    return NextResponse.json(successResponse({ id: rows[0].id }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // pg error con code: SQLSTATE conocidos para devolver mensajes
    // mas accionables al cliente (sin filtrar internals sensibles).
    const code = (err as { code?: string })?.code ?? "";
    console.error(
      "[api/public/alquiloya/solicitudes-servicio POST]",
      "code=" + code,
      "msg=" + msg
    );
    // 42P01 = undefined_table, 42703 = undefined_column, 23502 = NOT NULL,
    // 23503 = FK violation, 23514 = CHECK constraint.
    let userMsg = "No se pudo registrar la solicitud";
    if (code === "42P01") userMsg = "El modulo de solicitudes aun no esta configurado en la base. Contactanos por WhatsApp.";
    else if (code === "42703") userMsg = "Hay un campo desactualizado en la base. Avisanos por WhatsApp.";
    else if (code === "23502") userMsg = "Falta un dato requerido. Revisa el formulario o coordina por WhatsApp.";
    else if (code === "23514") userMsg = "El tipo de solicitud no es valido. Coordina por WhatsApp.";
    return NextResponse.json(
      errorResponse(userMsg + (code ? ` (codigo ${code})` : "")),
      { status: 500 }
    );
  }
}
