/**
 * Configuración de instancia (multi-cliente vs monocliente).
 *
 * Las funciones aquí leen variables de entorno opcionales. Si no están seteadas
 * el comportamiento default es `multi_client` con schema `zentra_erp`, igual al legado.
 *
 * Variables soportadas:
 * - NEURA_INSTANCE_MODE   "multi_client" (default) | "single_client"
 * - NEURA_CLIENT_SCHEMA   Schema PostgREST de la instancia (ej. "alquiloya"). Default: "zentra_erp".
 * - NEURA_CLIENT_NAME     Nombre humano del cliente (ej. "AlquiloYa"). Solo para UI/branding.
 */

export type InstanceMode = "multi_client" | "single_client";

export const DEFAULT_CLIENT_SCHEMA = "zentra_erp";

function readTrimmed(value: string | undefined | null): string {
  return typeof value === "string" ? value.trim() : "";
}

export function getInstanceMode(): InstanceMode {
  const raw = readTrimmed(process.env.NEURA_INSTANCE_MODE).toLowerCase();
  return raw === "single_client" ? "single_client" : "multi_client";
}

export function isSingleClientMode(): boolean {
  return getInstanceMode() === "single_client";
}

/**
 * Schema PostgREST configurado para la instancia.
 * Devuelve el valor de NEURA_CLIENT_SCHEMA si está seteado, sino el default ("zentra_erp").
 */
export function getClientSchema(): string {
  const v = readTrimmed(process.env.NEURA_CLIENT_SCHEMA);
  return v.length > 0 ? v : DEFAULT_CLIENT_SCHEMA;
}

/**
 * Nombre humano del cliente para branding/UI. Vacío si no está configurado.
 */
export function getClientName(): string {
  return readTrimmed(process.env.NEURA_CLIENT_NAME);
}
