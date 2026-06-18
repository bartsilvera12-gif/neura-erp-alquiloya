import { SUPABASE_APP_SCHEMA } from "@/lib/supabase/schema";
import { isSingleClientMode, getClientSchema } from "@/lib/env/instance-mode";

/** Slug + sufijo hex de empresa (p. ej. erp_demo_audit_3b885371). */
const RE_ERP = /^erp_[a-zA-Z0-9_]+$/;
const RE_ER_UUID = /^er_[0-9a-f]{32}$/;
/** Identificador SQL conservador para schemas explícitamente whitelistados. */
const RE_SAFE_IDENT = /^[a-z_][a-z0-9_]{0,62}$/;

/** Schemas del sistema que nunca deben ser destinos de SQL dinámico. */
const SYSTEM_SCHEMAS = new Set([
  "pg_catalog",
  "pg_toast",
  "information_schema",
  "auth",
  "storage",
  "supabase_functions",
  "graphql",
  "graphql_public",
  "extensions",
  "realtime",
  "vault",
  "_realtime",
  "net",
  "cron",
  "pgsodium",
  "pgsodium_masks",
]);

/**
 * Schema de datos del cliente para single-client. En modo `single_client` el
 * env NEURA_CLIENT_SCHEMA define el schema donde viven las tablas operativas
 * (p. ej. `alquiloya`). Solo lo evaluamos en server-side para no exponerlo al
 * bundle del cliente.
 */
function getSingleClientSchema(): string | null {
  if (typeof window !== "undefined") return null; // solo server
  if (!isSingleClientMode()) return null;
  try {
    const s = getClientSchema().trim().toLowerCase();
    return s && RE_SAFE_IDENT.test(s) && !SYSTEM_SCHEMAS.has(s) ? s : null;
  } catch {
    return null;
  }
}

/**
 * Valida nombre de schema Postgres para interpolación segura en SQL (solo datos chat).
 * Acepta:
 *   - `public` y `SUPABASE_APP_SCHEMA` (catálogo legacy).
 *   - Tenants estilo `erp_*` o `er_<hex>` del modo multi-tenant.
 *   - El schema configurado por env en modo `single_client` (p. ej. `alquiloya`).
 * Bloquea schemas del sistema (`auth`, `storage`, `pg_catalog`, etc.).
 */
export function assertAllowedChatDataSchema(schema: string): string {
  const s = schema.trim();
  if (!s) throw new Error("schema vacío");
  if (SYSTEM_SCHEMAS.has(s.toLowerCase())) {
    throw new Error(`schema no permitido (sistema): ${s}`);
  }
  if (s === "public" || s === SUPABASE_APP_SCHEMA) return s;
  if (RE_ERP.test(s) || RE_ER_UUID.test(s)) return s;
  const single = getSingleClientSchema();
  if (single && s.toLowerCase() === single) return s;
  throw new Error(`schema no permitido: ${s}`);
}

/** Esquema tenant donde PostgREST suele fallar si no está en "Exposed schemas". */
export function isLikelyUnexposedTenantChatSchema(schema: string): boolean {
  const s = schema.trim();
  if (!s || s === SUPABASE_APP_SCHEMA || s === "public") return false;
  // El schema single-client (alquiloya) SÍ esta expuesto en PostgREST por
  // configuración del deploy, así que NO entra al fallback PG-shim.
  const single = getSingleClientSchema();
  if (single && s.toLowerCase() === single) return false;
  return RE_ERP.test(s) || RE_ER_UUID.test(s);
}
