import { createHash, randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-admin";
import { getChatServiceClientForEmpresa } from "@/lib/supabase/chat-service-role-empresa";
import type { AppSupabaseClient } from "@/lib/supabase/schema";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { queryWithRetry } from "@/lib/supabase/pg-retry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALQUILOYA_EMPRESA_ID = "cf5df6fb-7705-4c4e-b29c-97bf5f314d8f";

/**
 * Branch AlquiloYa: cuando /r/{slug} se hits SIN `?sorteo=`, se interpreta
 * como link de referido del programa de AlquiloYa.
 *   - busca referral_links activo + partner activo
 *   - inserta referral_clicks (con visitor_cookie, UA, IP hash, UTM)
 *   - setea cookie `aly_ref` con duración link.cookie_dias
 *   - 302 a /publico (preserva utm_* si vinieron)
 * Si el slug no existe → 404 limpio.
 */
async function handleAlquiloyaReferralRedirect(
  request: NextRequest,
  slug: string
): Promise<NextResponse> {
  const pool = getChatPostgresPool();
  if (!pool) {
    return new NextResponse("Servicio no disponible.", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  type LinkRow = {
    id: string;
    partner_id: string;
    cookie_dias: number;
    link_activo: boolean;
    partner_activo: boolean;
  };
  // Buscamos sin filtrar por `activo` para poder loguear el motivo cuando
  // alguno este desactivado (link o partner). Asi diagnosticamos rapido si
  // un soft-delete previo dejo el link en activo=false aunque el partner
  // luego se haya reactivado.
  const { rows } = await queryWithRetry<LinkRow>(
    pool,
    `SELECT l.id, l.partner_id, l.cookie_dias,
            l.activo AS link_activo,
            p.activo AS partner_activo
       FROM alquiloya.referral_links l
       JOIN alquiloya.referral_partners p ON p.id = l.partner_id
      WHERE l.empresa_id = $1::uuid
        AND lower(trim(l.slug)) = lower(trim($2))
      ORDER BY l.activo DESC, l.created_at ASC
      LIMIT 1`,
    [ALQUILOYA_EMPRESA_ID, slug]
  );

  const link = rows?.[0];
  const valid = !!link && link.link_activo && link.partner_activo;
  if (!valid) {
    // Log detallado para que veamos el motivo en Coolify logs.
    console.warn("[r/aly-referral] link invalido", {
      slug,
      found: !!link,
      link_activo: link?.link_activo ?? null,
      partner_activo: link?.partner_activo ?? null,
    });
    // UX: en vez de mostrar un text/plain, redirigimos al sitio publico
    // con un flag para que el visitante no quede en una pagina rota.
    const fwdProto =
      request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
      request.nextUrl.protocol.replace(":", "") ||
      "https";
    const fwdHost =
      request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
      request.headers.get("host") ||
      request.nextUrl.host;
    const dest = new URL("/publico", `${fwdProto}://${fwdHost}`);
    dest.searchParams.set("ref_invalid", "1");
    return NextResponse.redirect(dest.toString(), 302);
  }

  // Cookie del visitante: si ya tiene una vigente, reusamos para no romper
  // atribuciones previas; si no, generamos opaca y la enviamos.
  const existingCookie = request.cookies.get("aly_ref")?.value ?? null;
  const visitorCookie =
    existingCookie && /^[A-Za-z0-9_-]{16,64}$/.test(existingCookie)
      ? existingCookie
      : randomBytes(18).toString("base64url");

  const ua = (request.headers.get("user-agent") ?? "").slice(0, 512);
  const referer = request.headers.get("referer")?.slice(0, 512) ?? null;
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "";
  const ipHash = ip
    ? createHash("sha256").update(ip).digest("hex").slice(0, 32)
    : null;

  const sp = request.nextUrl.searchParams;
  const utmSource = sp.get("utm_source")?.slice(0, 120) ?? null;
  const utmMedium = sp.get("utm_medium")?.slice(0, 120) ?? null;
  const utmCampaign = sp.get("utm_campaign")?.slice(0, 120) ?? null;

  try {
    await queryWithRetry(
      pool,
      `INSERT INTO alquiloya.referral_clicks (
         empresa_id, link_id, slug, ip_hash, user_agent, referer,
         utm_source, utm_medium, utm_campaign, visitor_cookie
       )
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        ALQUILOYA_EMPRESA_ID,
        link.id,
        slug,
        ipHash,
        ua,
        referer,
        utmSource,
        utmMedium,
        utmCampaign,
        visitorCookie,
      ]
    );
  } catch (e) {
    // No bloqueamos el redirect si falla el insert; el partner igual debe
    // poder mandar tráfico a la web pública aunque la tabla se caiga.
    console.error("[r/aly-referral] insert click:", (e as Error).message);
  }

  // Destino: /publico, preservando UTM si vino.
  // Reconstruimos el origin desde headers x-forwarded-* porque `request.url`
  // detrás del reverse proxy de Coolify trae `localhost:3000` y romperíamos
  // el redirect público.
  const fwdProto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    request.nextUrl.protocol.replace(":", "") ||
    "https";
  const fwdHost =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    request.headers.get("host") ||
    request.nextUrl.host;
  const publicOrigin = `${fwdProto}://${fwdHost}`;
  const dest = new URL("/publico", publicOrigin);
  if (utmSource) dest.searchParams.set("utm_source", utmSource);
  if (utmMedium) dest.searchParams.set("utm_medium", utmMedium);
  if (utmCampaign) dest.searchParams.set("utm_campaign", utmCampaign);

  const res = NextResponse.redirect(dest.toString(), 302);
  res.cookies.set("aly_ref", visitorCookie, {
    path: "/",
    maxAge: Math.max(1, Math.min(365, link.cookie_dias)) * 86400,
    sameSite: "lax",
    httpOnly: false,
    secure: request.nextUrl.protocol === "https:",
  });
  // Cache-Control para no cachear el redirect en CF.
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

/**
 * Un solo número marcable por canal para wa.me (no mezclar Graph Phone Number ID con E.164).
 * Alineado con la tarjeta operativa en Configuración → Canales: `activo` + `config_status === active`.
 *
 * - Meta Cloud: solo `config.display_phone_number` (nunca `provider_channel_id` / phone_number_id de Graph).
 * - YCloud: `ycloud_sender_id` → `display_phone_number` → `provider_channel_id` si aplica.
 */
function canonicalWaMeDigitsFromChannel(ch: {
  provider?: string | null;
  config?: unknown;
  provider_channel_id?: string | null;
}): string | null {
  const prov = String(ch.provider ?? "").trim().toLowerCase();
  const cfg =
    ch.config && typeof ch.config === "object" && !Array.isArray(ch.config)
      ? (ch.config as Record<string, unknown>)
      : {};

  if (prov === "meta") {
    const disp = cfg.display_phone_number;
    if (typeof disp === "string") {
      const d = digitsOnly(disp);
      if (d.length >= 8) return d;
    }
    return null;
  }

  if (prov === "ycloud") {
    for (const key of ["ycloud_sender_id", "display_phone_number"] as const) {
      const raw = cfg[key];
      if (typeof raw === "string") {
        const d = digitsOnly(raw);
        if (d.length >= 8) return d;
      }
    }
    if (typeof ch.provider_channel_id === "string" && ch.provider_channel_id.trim()) {
      const d = digitsOnly(ch.provider_channel_id);
      if (d.length >= 8) return d;
    }
    return null;
  }

  const disp = cfg.display_phone_number;
  if (typeof disp === "string") {
    const d = digitsOnly(disp);
    if (d.length >= 8) return d;
  }
  if (typeof ch.provider_channel_id === "string" && ch.provider_channel_id.trim()) {
    const d = digitsOnly(ch.provider_channel_id);
    if (d.length >= 8) return d;
  }
  return null;
}

/**
 * Resuelve el número E.164 (solo dígitos) para wa.me usando `chat_channels` en el
 * schema de la empresa. Debe usarse con `getChatServiceClientForEmpresa` (PG shim
 * en tenants no expuestos en PostgREST), nunca con `db.schema` directo a erp_*.
 */
async function resolveRedirectPhoneForEmpresa(
  supabase: AppSupabaseClient,
  empresaId: string
): Promise<{ ok: true; phone: string } | { ok: false; message: string }> {
  const envPhone = digitsOnly(
    process.env.WHATSAPP_LINK_PHONE_NUMBER?.trim() ||
      process.env.NEXT_PUBLIC_WHATSAPP_LINK_PHONE_NUMBER?.trim() ||
      ""
  );

  const { data: channels, error: chErr } = await supabase
    .from("chat_channels")
    .select("id, activo, config_status, provider, config, provider_channel_id")
    .eq("empresa_id", empresaId)
    .eq("type", "whatsapp")
    .eq("activo", true)
    .eq("config_status", "active");

  if (chErr) {
    console.error("[sorteo-r] chat_channels query:", chErr.message);
    return {
      ok: false,
      message: "No se pudo consultar la configuración del canal. Intentá más tarde.",
    };
  }

  const numbers = new Set<string>();
  for (const ch of channels ?? []) {
    const d = canonicalWaMeDigitsFromChannel(
      ch as {
        provider?: string | null;
        config?: unknown;
        provider_channel_id?: string | null;
      }
    );
    if (d) numbers.add(d);
  }

  if (numbers.size === 0) {
    return {
      ok: false,
      message: "Este sorteo aún no tiene un canal WhatsApp configurado.",
    };
  }

  if (envPhone) {
    if (!numbers.has(envPhone)) {
      return {
        ok: false,
        message:
          "La configuración del enlace de WhatsApp no coincide con los canales activos de la empresa.",
      };
    }
    return { ok: true, phone: envPhone };
  }

  if (numbers.size === 1) {
    return { ok: true, phone: [...numbers][0] };
  }

  return {
    ok: false,
    message:
      "Hay varios canales WhatsApp activos. El administrador debe definir cuál usar para los enlaces públicos.",
  };
}

function buildWhatsAppPrefill(params: {
  token: string;
  codigoReferido: string;
  nombreSorteo: string | null;
}): string {
  const nombre = params.nombreSorteo?.trim() || "el sorteo";
  return [
    `Hola, quiero comprar números para el sorteo ${nombre}.`,
    `Código revendedor: ${params.codigoReferido}.`,
    `ref=${params.token}`,
  ].join(" ");
}

/**
 * Landing pública: registra click + token opaco y redirige a WhatsApp.
 * URL oficial: /r/{codigo}?sorteo={uuid}
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ codigo: string }> }
) {
  const { codigo: codigoRaw } = await context.params;
  const codigo = decodeURIComponent(codigoRaw ?? "").trim();
  const sorteoId = request.nextUrl.searchParams.get("sorteo")?.trim() ?? "";

  if (!codigo) {
    return new NextResponse("Falta código en la ruta.", {
      status: 400,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  // Branch AlquiloYa: sin ?sorteo, se trata como slug de referido.
  // El flujo sorteos sigue intacto cuando viene ?sorteo=<uuid>.
  if (!sorteoId) {
    return handleAlquiloyaReferralRedirect(request, codigo);
  }

  let catalog;
  try {
    catalog = createServiceRoleClient();
  } catch {
    return new NextResponse("Servidor sin credenciales Supabase (service role).", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const { data: resolved, error: rpcErr } = await catalog.rpc("neura_resolve_sorteo_revendedor_public", {
    p_sorteo_id: sorteoId,
    p_codigo: codigo,
  });

  type ResolvedRow = { empresa_id?: string; data_schema?: string; revendedor_id?: string };
  type RevRow = {
    id: string;
    empresa_id: string;
    sorteo_id: string;
    codigo_referido: string;
    activo: boolean;
  };
  const hit = (resolved as ResolvedRow | null) ?? null;

  let row: RevRow | null = null;

  if (!rpcErr && hit?.empresa_id && hit?.revendedor_id) {
    row = {
      id: hit.revendedor_id,
      empresa_id: hit.empresa_id,
      sorteo_id: sorteoId,
      codigo_referido: codigo,
      activo: true,
    };
  } else {
    if (rpcErr) {
      console.warn("[sorteo-r] neura_resolve_sorteo_revendedor_public:", rpcErr.message);
    }
    const { data: rev, error: rErr } = await catalog
      .from("sorteo_revendedores")
      .select("id, empresa_id, sorteo_id, codigo_referido, activo")
      .eq("sorteo_id", sorteoId)
      .ilike("codigo_referido", codigo)
      .eq("activo", true)
      .maybeSingle();

    if (rErr || !rev) {
      return new NextResponse("Link de revendedor no válido.", {
        status: 404,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }
    row = rev as RevRow;
  }

  if (!row) {
    return new NextResponse("Link de revendedor no válido.", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  let dataSb: AppSupabaseClient;
  try {
    dataSb = await getChatServiceClientForEmpresa(row.empresa_id);
  } catch (e) {
    console.error("[sorteo-r] getChatServiceClientForEmpresa:", e);
    return new NextResponse("No se pudo preparar la redirección. Intentá más tarde.", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const { data: sorteoRow, error: sorteoErr } = await dataSb
    .from("sorteos")
    .select("id, nombre")
    .eq("id", row.sorteo_id)
    .eq("empresa_id", row.empresa_id)
    .maybeSingle();

  if (sorteoErr) {
    console.error("[sorteo-r] sorteos:", sorteoErr.message);
    return new NextResponse("No se pudo verificar el sorteo. Intentá más tarde.", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  if (!sorteoRow) {
    return new NextResponse("El sorteo no existe o no está disponible.", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const nombreSorteo =
    typeof (sorteoRow as { nombre?: unknown }).nombre === "string"
      ? (sorteoRow as { nombre: string }).nombre.trim() || null
      : null;

  const redirectPhoneResult = await resolveRedirectPhoneForEmpresa(dataSb, row.empresa_id);
  if (!redirectPhoneResult.ok) {
    return new NextResponse(redirectPhoneResult.message, {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const token = randomBytes(18).toString("base64url");
  const ua = request.headers.get("user-agent") ?? "";
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "";
  const ipHash = ip ? createHash("sha256").update(ip).digest("hex").slice(0, 32) : null;

  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { error: insErr } = await dataSb.from("sorteo_revendedor_clicks").insert({
    empresa_id: row.empresa_id,
    sorteo_id: row.sorteo_id,
    revendedor_id: row.id,
    attribution_token: token,
    user_agent: ua.slice(0, 512),
    ip_hash: ipHash,
    expires_at: expires,
  });

  if (insErr) {
    const code = (insErr as { code?: string }).code;
    console.error("[sorteo-r] sorteo_revendedor_clicks:", insErr.message, code ?? "");
    return new NextResponse("No se pudo registrar el click.", {
      status: 500,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const text = buildWhatsAppPrefill({
    token,
    codigoReferido: row.codigo_referido,
    nombreSorteo,
  });
  const waUrl = `https://wa.me/${redirectPhoneResult.phone}?text=${encodeURIComponent(text)}`;
  return NextResponse.redirect(waUrl, 302);
}
