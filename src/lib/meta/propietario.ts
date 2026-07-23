// Helpers compartidos para las routes de /api/integraciones/meta/*.
// Autoriza al propietario logueado y devuelve su propietario_id, empresa_id.

import { NextResponse } from "next/server";
import { getAuthUserForApiRoute } from "@/lib/auth/get-auth-user-for-api-route";
import { resolveUsuarioErpFromAuthUser } from "@/lib/auth/resolve-usuario-erp";
import { createServiceRoleClient } from "@/lib/supabase/service-admin";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";

export const ALQUILOYA_EMPRESA_ID = "cf5df6fb-7705-4c4e-b29c-97bf5f314d8f";

export type PropietarioAuthContext = {
  authUserId: string;
  usuarioErpId: string;
  propietarioId: string;
  empresaId: string;
};

export async function requirePropietarioContext(
  request: Request,
): Promise<PropietarioAuthContext | NextResponse> {
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
    .select("propietario_id")
    .eq("id", usuario.id)
    .limit(1)
    .maybeSingle();
  const propietarioId = (data as { propietario_id?: string | null } | null)?.propietario_id ?? null;
  if (!propietarioId) {
    return NextResponse.json(
      { error: "Este usuario no tiene un propietario asociado" },
      { status: 403 },
    );
  }

  return {
    authUserId: user.id,
    usuarioErpId: usuario.id,
    propietarioId,
    empresaId: usuario.empresa_id,
  };
}

export function getPool() {
  const pool = getChatPostgresPool();
  if (!pool) throw new Error("Pool Postgres no disponible");
  return pool;
}

export function sanitizeError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? "");
  return raw
    .replace(/access_token=[^&\s]+/gi, "access_token=***")
    .replace(/appsecret_proof=[^&\s]+/gi, "appsecret_proof=***")
    .slice(0, 500);
}
