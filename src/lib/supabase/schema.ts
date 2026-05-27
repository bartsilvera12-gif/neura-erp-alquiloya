import type { SupabaseClient } from "@supabase/supabase-js";
import { getClientSchema } from "@/lib/env/instance-mode";

/**
 * Esquema Postgres de datos del ERP.
 *
 * Requiere en Supabase: Settings → API → "Exposed schemas" incluir el schema configurado
 * (default `zentra_erp`, override via `NEURA_CLIENT_SCHEMA`), además de auth/storage.
 *
 * El valor se resuelve al cargar el módulo a partir de `NEURA_CLIENT_SCHEMA`; si la variable
 * no está seteada se mantiene el legado `zentra_erp` (comportamiento idéntico al anterior).
 */
export const SUPABASE_APP_SCHEMA: string = getClientSchema();

/**
 * Schema PostgREST para tablas de negocio de una empresa (`clientes`, `productos`, `chat_*` en tenant, etc.).
 *
 * - Valor en `empresas.data_schema` (tras trim) → ese schema (`erp_*` u otro explícito).
 * - `null`, `undefined` o string vacío → legado: datos en plantilla compartida `zentra_erp`.
 *
 * No requiere migraciones manuales por empresa: el fallback es automático.
 */
export function resolveEmpresaDataSchema(dataSchema: string | null | undefined): string {
  const t = typeof dataSchema === "string" ? dataSchema.trim() : "";
  return t.length > 0 ? t : SUPABASE_APP_SCHEMA;
}

/**
 * Cliente Supabase con cualquier esquema PostgREST (`zentra_erp`, `erp_*`, etc.).
 * Con @supabase/supabase-js ≥2.99 los genéricos de `SupabaseClient` son varios y condicionales;
 * acotar alguno a `string` o `"public"` rompe la asignación entre instancias (p. ej. Vercel TS).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AppSupabaseClient = SupabaseClient<any, any, any, any, any>;

export const supabaseDbSchemaOption = {
  db: { schema: SUPABASE_APP_SCHEMA },
} as const;

/** Cliente service role estándar (API routes, webhooks, jobs). */
export const supabaseServiceRoleClientOptions = {
  auth: { autoRefreshToken: false, persistSession: false },
  ...supabaseDbSchemaOption,
} as const;
