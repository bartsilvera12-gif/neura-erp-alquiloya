import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/sign-out
 *
 * Cierra la sesión Supabase del navegador (limpia las cookies sb-*).
 * Lo usa la web legacy (public/alquiloya-legacy/shared.jsx) para tener un
 * botón "Cerrar sesión" sin necesidad de cargar @supabase/supabase-js en el
 * cliente.
 *
 * supabase.auth.signOut() vía el server client elimina las cookies usando
 * el adapter de @supabase/ssr (ver src/lib/supabase/server.ts), así que el
 * navegador queda deslogueado de verdad — no es solo un UI reset.
 */
export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[api/auth/sign-out]", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al cerrar sesion" },
      { status: 500 }
    );
  }
}
