import {
  getUserAndEmpresa,
  type UsuarioConEmpresa,
} from "@/lib/middleware/auth";
import { createTenantPgChatSupabaseShim } from "@/lib/chat/tenant-pg-chat-supabase-shim";
import {
  createServiceRoleClientForEmpresa,
  fetchDataSchemaForEmpresaId,
} from "@/lib/supabase/empresa-data-schema";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { isLikelyUnexposedTenantChatSchema } from "@/lib/supabase/chat-data-schema";
import { createServiceRoleClient } from "@/lib/supabase/service-admin";
import { SUPABASE_APP_SCHEMA, type AppSupabaseClient } from "@/lib/supabase/schema";

const LOG = "[facturas-service-client]";

/**
 * Service role contra el schema de datos de la empresa para Facturación ERP (no SIFEN).
 *
 * Cubre tablas: `facturas`, `factura_items`, `pagos`, `suscripciones`, `planes`,
 * `cliente_perfil_tributario`, `clientes`.
 *
 * - `data_schema` vacío o `zentra_erp` → cliente service role estándar (PostgREST con `db.schema`).
 * - `data_schema = erp_*` no expuesto → shim Postgres (mismo pool DIRECT_URL que chat/SIFEN/Clientes).
 *
 * El shim también implementa `rpc("next_numero_factura_empresa", ...)` ejecutando
 * la función en el schema correcto (no en `zentra_erp`), preservando el contador
 * `<schema>.factura_correlativos` por tenant.
 *
 * Evita errores `PGRST106 Invalid schema` en `/api/facturas[*]` y
 * `/api/clientes/[id]/facturacion[/emitir]` para tenants `erp_*`.
 */
export async function getFacturasServiceClientForEmpresa(
  empresaId: string
): Promise<AppSupabaseClient> {
  const schema = await fetchDataSchemaForEmpresaId(empresaId);
  const pool = getChatPostgresPool();

  // Forzamos PG-shim para CUALQUIER tenant con pool disponible: PostgREST en
  // self-hosted mantiene cache del schema que tarda en refrescarse despues
  // de ALTER TABLE. El endpoint firmar lee certificado_password_encrypted via
  // empresa_sifen_config — si PostgREST cachea el schema viejo, devuelve la
  // fila sin esa columna y el firmar tira "No hay contraseña del certificado".
  // Bypaseando PostgREST en todo el modulo facturas + SIFEN aseguramos
  // consistencia ante ALTER TABLE recientes.
  if (pool && schema !== SUPABASE_APP_SCHEMA) {
    const catalog = createServiceRoleClient();
    console.info(LOG, "modo", "postgres_shim", {
      empresa_id: empresaId,
      data_schema: schema,
      motivo: isLikelyUnexposedTenantChatSchema(schema)
        ? "unexposed_tenant"
        : "force_bypass_postgrest_cache",
    });
    return createTenantPgChatSupabaseShim({
      pool,
      schema,
      storageDelegate: catalog,
      rpcDelegate: catalog as AppSupabaseClient,
    }) as unknown as AppSupabaseClient;
  }

  if (!pool && isLikelyUnexposedTenantChatSchema(schema)) {
    console.error(LOG, "tenant_sin_pool_postgrest_suele_fallar", {
      empresa_id: empresaId,
      data_schema: schema,
      hint:
        "Faltan SUPABASE_DB_URL / DIRECT_URL en el servidor. " +
        "Schemas erp_* no están expuestos en PostgREST; se requiere PG directo para leer/escribir facturas.",
    });
    throw new Error(
      "Falta SUPABASE_DB_URL o DIRECT_URL en el servidor. " +
        "Sin conexión directa a Postgres no se puede leer/escribir facturas en el schema de esta empresa (erp_*)."
    );
  }

  return createServiceRoleClientForEmpresa(empresaId);
}

/** Auth + cliente. Drop-in para `getTenantSupabaseFromAuth` en rutas de facturación ERP. */
export async function getFacturasSupabaseFromAuth(
  request?: Request | null
): Promise<{ auth: UsuarioConEmpresa; supabase: AppSupabaseClient } | null> {
  const auth = await getUserAndEmpresa(request);
  if (!auth) return null;
  const supabase = await getFacturasServiceClientForEmpresa(auth.empresa_id);
  return { auth, supabase };
}
