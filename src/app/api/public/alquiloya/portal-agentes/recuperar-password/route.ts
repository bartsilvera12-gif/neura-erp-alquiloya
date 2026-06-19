import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { queryWithRetry } from "@/lib/supabase/pg-retry";
import { sendMail } from "@/lib/email/send-mail";
import { renderAccesoAprobadoEmail } from "@/lib/email/templates/acceso-aprobado";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALQUILOYA_SCHEMA = "alquiloya";
const ALQUILOYA_EMPRESA_ID = "cf5df6fb-7705-4c4e-b29c-97bf5f314d8f";

/** Misma politica de password temporal que el flujo de aprobacion. */
function generateTempPassword(): string {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  const b64 = Buffer.from(bytes).toString("base64").replace(/[+/=]/g, "x");
  return `${b64.slice(0, 12)}!9`;
}

type UsuarioRow = {
  nombre: string | null;
  rol: string | null;
  auth_user_id: string;
};

async function findAuthUserByEmail(
  admin: ReturnType<typeof createClient>,
  email: string
): Promise<{ id: string; email: string | null } | null> {
  const lower = email.toLowerCase();
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) {
      console.error("[recuperar-password] listUsers:", error.message);
      return null;
    }
    const users = data?.users ?? [];
    if (users.length === 0) return null;
    const hit = users.find((u) => (u.email ?? "").toLowerCase() === lower);
    if (hit) return { id: hit.id, email: hit.email ?? null };
    if (users.length < 1000) return null;
  }
  return null;
}

/**
 * POST /api/public/alquiloya/portal-agentes/recuperar-password
 * Body: { email }
 *
 * Si existe un usuario de portal con ese email, le regenera la contraseña y
 * se la manda por correo. Devuelve 200 SIEMPRE (aunque no exista) para no
 * filtrar emails registrados (anti-enumeracion).
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { email?: unknown };
  const emailRaw = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  // Respuesta uniforme: el cliente nunca sabe si el email existe.
  const successResponse = NextResponse.json({
    success: true,
    message:
      "Si el email esta registrado, te enviamos una nueva contraseña temporal. Revisa tu bandeja de entrada (y spam).",
  });

  if (!emailRaw || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailRaw)) {
    return successResponse;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceRole) {
    console.error("[recuperar-password] faltan envs SUPABASE_*");
    return successResponse;
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1) Validar que el email exista como usuario de portal (agente/propietario).
  const pool = getChatPostgresPool();
  if (!pool) return successResponse;
  const { rows } = await queryWithRetry<UsuarioRow>(
    pool,
    `SELECT nombre, rol, auth_user_id::text AS auth_user_id
       FROM "${ALQUILOYA_SCHEMA}"."usuarios"
      WHERE empresa_id = $1::uuid
        AND lower(email) = $2
        AND rol IN ('publicador-agente', 'publicador-propietario')
      LIMIT 1`,
    [ALQUILOYA_EMPRESA_ID, emailRaw]
  );
  if (rows.length === 0) {
    // Email no registrado o no es de portal: devolvemos OK igual.
    return successResponse;
  }
  const usuario = rows[0];

  // 2) Resolver auth user. Preferimos auth_user_id; si no, fallback por email.
  let authUserId = usuario.auth_user_id;
  if (!authUserId) {
    const found = await findAuthUserByEmail(supabaseAdmin, emailRaw);
    if (!found) return successResponse;
    authUserId = found.id;
  }

  // 3) Regenerar contraseña y aplicar en Supabase Auth.
  const nuevaPassword = generateTempPassword();
  const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(authUserId, {
    password: nuevaPassword,
  });
  if (updErr) {
    console.error("[recuperar-password] updateUserById:", updErr.message);
    return successResponse;
  }

  // 4) Mandar el correo con la nueva contraseña. Reutiliza el template de
  //    aprobacion pero adapta el subject para que se entienda que es reset.
  try {
    const origin = new URL(request.url).origin;
    const portalUrl = `${origin}/portal-agentes/login`;
    const tpl = renderAccesoAprobadoEmail({
      nombre: usuario.nombre ?? "Hola",
      email: emailRaw,
      password: nuevaPassword,
      portalUrl,
    });
    await sendMail({
      to: emailRaw,
      subject: "Recuperación de contraseña — AlquiloYa",
      html: tpl.html,
      text: tpl.text,
    });
  } catch (e) {
    console.warn("[recuperar-password] sendMail:", e instanceof Error ? e.message : e);
  }

  return successResponse;
}
