import { NextResponse } from "next/server";
import { getAuthUserForApiRoute } from "@/lib/auth/get-auth-user-for-api-route";
import { listErpAgenteResenas } from "@/lib/alquiloya/erp-agente-resenas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getAuthUserForApiRoute(request);
  if (!user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  try {
    const rows = await listErpAgenteResenas();
    return NextResponse.json({ success: true, data: { resenas: rows } });
  } catch (err) {
    console.error("[api/dashboard/alquiloya-agente-resenas GET]", err);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
