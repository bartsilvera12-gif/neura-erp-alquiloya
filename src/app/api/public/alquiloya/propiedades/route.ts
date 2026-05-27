import { NextRequest } from "next/server";
import { listPublicPropiedades } from "@/lib/alquiloya/public-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return listPublicPropiedades(request);
}
