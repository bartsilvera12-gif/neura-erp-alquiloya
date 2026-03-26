import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { searchHistoryContacts } from "@/lib/chat/history-service";
import { getAuthWithRol } from "@/lib/middleware/auth";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase no configurado");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthWithRol();
    if (!auth?.empresa_id) {
      return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
    }

    const q = request.nextUrl.searchParams.get("q") ?? "";
    const channelId = request.nextUrl.searchParams.get("channel") ?? undefined;
    const from = request.nextUrl.searchParams.get("from") ?? undefined;
    const to = request.nextUrl.searchParams.get("to") ?? undefined;

    if (!q.trim()) return NextResponse.json({ ok: true, items: [] });

    const supabase = getSupabaseAdmin();
    const items = await searchHistoryContacts(supabase, auth.empresa_id, q, {
      channelId,
      from,
      to,
    });

    return NextResponse.json({ ok: true, items });
  } catch (e) {
    console.error("[api/chat/history/search]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
