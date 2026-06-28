/**
 * Reset puntual de password para la cuenta VIVIO (alquiloya.py@gmail.com)
 * que perdio el acceso por el bug de provisionPortalAccount.
 *
 * Lee SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY desde .env.local del repo.
 *
 * Uso:
 *   node scripts/reset-password-vivio.cjs
 */
const path = require("path");
const { config } = require("dotenv");
const { createClient } = require("@supabase/supabase-js");

config({ path: path.resolve(process.cwd(), ".env.local"), quiet: true });

const EMAIL = "alquiloya.py@gmail.com";
const NEW_PASSWORD = "7kbfXnSGiPRD!8";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
    process.exit(2);
  }
  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Buscar el auth user por email (paginado, igual que hace el ERP)
  let authUser = null;
  const lower = EMAIL.toLowerCase();
  for (let page = 1; page <= 50 && !authUser; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) {
      console.error("listUsers error:", error.message);
      process.exit(1);
    }
    const users = data?.users ?? [];
    if (users.length === 0) break;
    authUser = users.find((u) => (u.email ?? "").toLowerCase() === lower) || null;
    if (users.length < 1000) break;
  }

  if (!authUser) {
    console.error(`No se encontro auth user con email ${EMAIL}`);
    process.exit(3);
  }

  console.log(`Encontrado auth user: id=${authUser.id} email=${authUser.email}`);

  // 2. Actualizar password
  const { error: upErr } = await admin.auth.admin.updateUserById(authUser.id, {
    password: NEW_PASSWORD,
    email_confirm: true,
  });
  if (upErr) {
    console.error("updateUserById error:", upErr.message);
    process.exit(4);
  }

  console.log(`OK: password reseteada para ${EMAIL}`);
  console.log(`Probá login en /portal-agentes/login con esa password.`);
}

main().catch((e) => {
  console.error("Fatal:", e?.message || e);
  process.exit(1);
});
