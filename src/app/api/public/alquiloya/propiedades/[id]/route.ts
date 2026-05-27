import { NextRequest } from "next/server";
import { getPublicPropiedad } from "@/lib/alquiloya/public-api";

type RouteCtx = { params: Promise<{ id: string }> };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, ctx: RouteCtx) {
  const { id } = await ctx.params;
  return getPublicPropiedad(id);
}
