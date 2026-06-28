import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { queryWithRetry } from "@/lib/supabase/pg-retry";
import { getAuthUserForApiRoute } from "@/lib/auth/get-auth-user-for-api-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALQUILOYA_EMPRESA_ID = "cf5df6fb-7705-4c4e-b29c-97bf5f314d8f";

type Body = {
  tipo?: "agente" | "propietario" | "referido_partner";
  id?: string;
  password?: string;
};

export async function POST(request: Request) {
  try {
    const user = await getAuthUserForApiRoute(request);
    if (!user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const body = (await request.json().catch(() => ({}))) as Body;
    const tipo = body.tipo;
    const id = body.id?.trim();
    const password = body.password?.trim() ?? "";
    if (!tipo || !id) return NextResponse.json({ error: "tipo + id requeridos" }, { status: 400 });
    if (password.length < 8) return NextResponse.json({ error: "password debe tener al menos 8 caracteres" }, { status: 400 });

    const pool = getChatPostgresPool();
    if (!pool) return NextResponse.json({ error: "Pool no disponible" }, { status: 500 });

    // Buscar el auth_user_id a partir del tipo + id. Soporta agente,
    // propietario y referido_partner.
    const col =
      tipo === "agente" ? "agente_id" :
      tipo === "propietario" ? "propietario_id" :
      tipo === "referido_partner" ? "referido_partner_id" : null;
    if (!col) return NextResponse.json({ error: "tipo invalido" }, { status: 400 });

    const r = await queryWithRetry<{ auth_user_id: string | null; email: string | null }>(
      pool,
      `SELECT u.auth_user_id, u.email
         FROM "alquiloya"."usuarios" u
        WHERE u.empresa_id = $1::uuid AND u.${col} = $2::uuid
        LIMIT 1`,
      [ALQUILOYA_EMPRESA_ID, id]
    );
    const row = r.rows[0];
    if (!row || !row.auth_user_id) {
      return NextResponse.json(
        { error: `No se encontro un acceso vinculado para ${tipo} ${id}` },
        { status: 404 }
      );
    }

    // Actualizar password via Supabase Admin API
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!supabaseUrl || !serviceRole) {
      return NextResponse.json(
        { error: "Supabase Admin API no configurada en este entorno" },
        { status: 500 }
      );
    }
    const admin = createClient(supabaseUrl, serviceRole, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error } = await admin.auth.admin.updateUserById(row.auth_user_id, {
      password,
      email_confirm: true,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, email: row.email });
  } catch (err) {
    console.error("[alquiloya-accesos/reset-password]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}
