// Helpers compartidos para todas las routes de /api/integraciones/meta/*.
// Autoriza al usuario logueado y resuelve si es PROPIETARIO o AGENTE.
// Regla: un usuario en alquiloya.usuarios tiene o propietario_id o agente_id,
// nunca ambos (regla de negocio confirmada por Karen 2026-07).

import { NextResponse } from "next/server";
import { getAuthUserForApiRoute } from "@/lib/auth/get-auth-user-for-api-route";
import { resolveUsuarioErpFromAuthUser } from "@/lib/auth/resolve-usuario-erp";
import { createServiceRoleClient } from "@/lib/supabase/service-admin";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";

export const ALQUILOYA_EMPRESA_ID = "cf5df6fb-7705-4c4e-b29c-97bf5f314d8f";

export type OwnerType = "propietario" | "agente";

export type OwnerAuthContext = {
  authUserId: string;
  usuarioErpId: string;
  ownerType: OwnerType;
  ownerId: string;              // propietario_id o agente_id segun ownerType
  empresaId: string;
};

/** Resuelve el owner (propietario o agente) del usuario logueado. */
export async function requireOwnerContext(
  request: Request,
): Promise<OwnerAuthContext | NextResponse> {
  const user = await getAuthUserForApiRoute(request);
  if (!user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  const supabase = createServiceRoleClient();
  const usuario = await resolveUsuarioErpFromAuthUser(supabase, user);
  if (!usuario || usuario.empresa_id !== ALQUILOYA_EMPRESA_ID) {
    return NextResponse.json({ error: "Usuario no resuelto" }, { status: 403 });
  }

  const { data } = await supabase
    .from("usuarios")
    .select("propietario_id, agente_id")
    .eq("id", usuario.id)
    .limit(1)
    .maybeSingle();
  const propietarioId = (data as { propietario_id?: string | null } | null)?.propietario_id ?? null;
  const agenteId = (data as { agente_id?: string | null } | null)?.agente_id ?? null;

  // Regla XOR: prioridad al que este seteado. Si hay ambos (data corrupta),
  // preferimos agente (mas comun) pero seria bug en la DB.
  let ownerType: OwnerType;
  let ownerId: string;
  if (agenteId) {
    ownerType = "agente";
    ownerId = agenteId;
  } else if (propietarioId) {
    ownerType = "propietario";
    ownerId = propietarioId;
  } else {
    return NextResponse.json(
      { error: "Este usuario no tiene un propietario ni un agente asociado" },
      { status: 403 },
    );
  }

  return {
    authUserId: user.id,
    usuarioErpId: usuario.id,
    ownerType,
    ownerId,
    empresaId: usuario.empresa_id,
  };
}

export function getPool() {
  const pool = getChatPostgresPool();
  if (!pool) throw new Error("Pool Postgres no disponible");
  return pool;
}

/** Sanitiza el mensaje de error de Meta para logs/DB (recorta tokens obvios). */
export function sanitizeError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? "");
  return raw
    .replace(/access_token=[^&\s]+/gi, "access_token=***")
    .replace(/appsecret_proof=[^&\s]+/gi, "appsecret_proof=***")
    .slice(0, 500);
}

/**
 * Devuelve las 2 columnas WHERE segun ownerType para reusar en queries.
 * Ejemplo: whereByOwner(ctx) -> { col: "propietario_id", nullCol: "agente_id" }
 */
export function ownerColumns(ctx: OwnerAuthContext): { col: string; nullCol: string } {
  if (ctx.ownerType === "agente") {
    return { col: "agente_id", nullCol: "propietario_id" };
  }
  return { col: "propietario_id", nullCol: "agente_id" };
}
