import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getContactHistory } from "@/lib/chat/history-service";
import { getAuthWithRol } from "@/lib/middleware/auth";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase no configurado");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ contactId: string }> }
) {
  try {
    const auth = await getAuthWithRol();
    if (!auth?.empresa_id) {
      return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
    }

    const params = await context.params;
    const contactId = params.contactId;
    if (!contactId) {
      return NextResponse.json({ ok: false, error: "contactId requerido" }, { status: 400 });
    }

    const channelId = request.nextUrl.searchParams.get("channel") ?? undefined;
    const from = request.nextUrl.searchParams.get("from") ?? undefined;
    const to = request.nextUrl.searchParams.get("to") ?? undefined;

    const supabase = getSupabaseAdmin();
    const detail = await getContactHistory(supabase, auth.empresa_id, contactId, {
      channelId,
      from,
      to,
    });

    if (!detail) {
      return NextResponse.json({ ok: false, error: "Contacto no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, detail });
  } catch (e) {
    console.error("[api/chat/history/contact]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
