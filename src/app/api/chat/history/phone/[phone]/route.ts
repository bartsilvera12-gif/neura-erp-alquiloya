import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getContactHistory, normalizePhone } from "@/lib/chat/history-service";
import { getAuthWithRol } from "@/lib/middleware/auth";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase no configurado");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ phone: string }> }
) {
  try {
    const auth = await getAuthWithRol();
    if (!auth?.empresa_id) {
      return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
    }

    const params = await context.params;
    const phone = normalizePhone(params.phone ?? "");
    if (!phone) {
      return NextResponse.json({ ok: false, error: "phone inválido" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: contact } = await supabase
      .from("chat_contacts")
      .select("id")
      .eq("empresa_id", auth.empresa_id)
      .or(`phone_normalized.eq.${phone},phone_number.eq.${phone}`)
      .maybeSingle();

    if (!contact?.id) {
      return NextResponse.json({ ok: false, error: "Contacto no encontrado" }, { status: 404 });
    }

    const detail = await getContactHistory(supabase, auth.empresa_id, contact.id as string);
    if (!detail) {
      return NextResponse.json({ ok: false, error: "Contacto no encontrado" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, detail });
  } catch (e) {
    console.error("[api/chat/history/phone]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
