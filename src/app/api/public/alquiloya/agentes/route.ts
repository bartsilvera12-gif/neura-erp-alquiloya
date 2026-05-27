import { listPublicAgentes } from "@/lib/alquiloya/public-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return listPublicAgentes();
}
