import { NextResponse } from "next/server";
import { getAuthUserForApiRoute } from "@/lib/auth/get-auth-user-for-api-route";
import { listErpSolicitudesAcceso } from "@/lib/alquiloya/erp-solicitudes-acceso";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await getAuthUserForApiRoute(request);
    if (!user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    const rows = await listErpSolicitudesAcceso();
    return NextResponse.json({ success: true, data: { solicitudes: rows } });
  } catch (err) {
    console.error("[api/dashboard/alquiloya-solicitudes-acceso GET]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
