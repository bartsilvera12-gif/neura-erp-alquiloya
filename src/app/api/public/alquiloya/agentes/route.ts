import { listPublicAgentes } from "@/lib/alquiloya/public-api";

export const runtime = "nodejs";
// Cache 60s — la lista pública de agentes cambia con baja frecuencia.
export const revalidate = 60;

export async function GET() {
  return listPublicAgentes();
}
