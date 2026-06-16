import "server-only";
import { sendMail } from "@/lib/email/send-mail";

/**
 * Destinatarios admin para notificaciones operacionales de AlquiloYa
 * (nueva propiedad pendiente de aprobacion, etc).
 *
 * Configuracion via env `ALQUILOYA_ADMIN_NOTIFY_EMAIL` — coma-separated.
 * Si no esta seteado, cae a SMTP_FROM_EMAIL / SMTP_USER (el mismo buzon que
 * envia) para que el aviso no se pierda silenciosamente.
 */
function getAdminRecipients(): string[] {
  const raw = process.env.ALQUILOYA_ADMIN_NOTIFY_EMAIL?.trim();
  if (raw) {
    return raw
      .split(",")
      .map((e) => e.trim())
      .filter((e) => /\S+@\S+\.\S+/.test(e));
  }
  const fallback = (process.env.SMTP_FROM_EMAIL ?? process.env.SMTP_USER ?? "").trim();
  return fallback ? [fallback] : [];
}

function originFromRequestHeaders(headers: Headers): string {
  const proto = headers.get("x-forwarded-proto") ?? "https";
  const host = headers.get("x-forwarded-host") ?? headers.get("host") ?? "";
  return host ? `${proto}://${host}` : "";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type NotifyNuevaPropiedadInput = {
  propiedadId: string;
  codigo: string | null;
  titulo: string;
  tipo: string;
  operacion: string;
  ciudad: string;
  precio: number | null;
  moneda: string | null;
  propietario: {
    nombre: string | null;
    email: string | null;
    telefono: string | null;
  };
  requestHeaders?: Headers;
};

/**
 * Aviso al admin: "llego una nueva propiedad pendiente de aprobacion".
 * Fire-and-forget — si falla solo loguea y no propaga el error al cliente,
 * la propiedad ya se guardo correctamente.
 */
export async function notifyAdminNuevaPropiedadPendiente(
  input: NotifyNuevaPropiedadInput
): Promise<void> {
  const recipients = getAdminRecipients();
  if (recipients.length === 0) {
    console.warn(
      "[notifyAdminNuevaPropiedadPendiente] sin destinatarios: configurar ALQUILOYA_ADMIN_NOTIFY_EMAIL"
    );
    return;
  }
  const origin = input.requestHeaders ? originFromRequestHeaders(input.requestHeaders) : "";
  const pendientesUrl = `${origin}/dashboard/propiedades-pendientes`;
  const detalleUrl = `${origin}/dashboard/propiedades/${input.propiedadId}?from=pendientes`;
  const precioLabel =
    input.precio != null
      ? `${input.moneda ?? "PYG"} ${Number(input.precio).toLocaleString("es-PY")}`
      : "Sin precio";
  const contactoLines = [
    input.propietario.nombre ? `Nombre: ${input.propietario.nombre}` : null,
    input.propietario.email ? `Email: ${input.propietario.email}` : null,
    input.propietario.telefono ? `Teléfono: ${input.propietario.telefono}` : null,
  ].filter(Boolean);
  const subject = `[AlquiloYa] Nueva propiedad pendiente — ${input.titulo || input.codigo || input.propiedadId}`;
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;line-height:1.5;">
      <h2 style="margin:0 0 12px;color:#0058A5;">Nueva propiedad pendiente de aprobación</h2>
      <p style="margin:0 0 12px;">Alguien cargó un inmueble desde el sitio público. Está esperando revisión antes de publicarse.</p>
      <table cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:14px;">
        <tr><td style="color:#64748b;">Título</td><td><strong>${escapeHtml(input.titulo || "—")}</strong></td></tr>
        ${input.codigo ? `<tr><td style="color:#64748b;">Código</td><td>${escapeHtml(input.codigo)}</td></tr>` : ""}
        <tr><td style="color:#64748b;">Tipo</td><td>${escapeHtml(input.tipo)} · ${escapeHtml(input.operacion)}</td></tr>
        <tr><td style="color:#64748b;">Ubicación</td><td>${escapeHtml(input.ciudad || "—")}</td></tr>
        <tr><td style="color:#64748b;">Precio</td><td>${escapeHtml(precioLabel)}</td></tr>
        ${
          contactoLines.length > 0
            ? `<tr><td style="color:#64748b;vertical-align:top;">Contacto</td><td>${contactoLines
                .map((l) => escapeHtml(l!))
                .join("<br/>")}</td></tr>`
            : ""
        }
      </table>
      ${
        origin
          ? `<p style="margin:18px 0 8px;">
              <a href="${pendientesUrl}" style="display:inline-block;background:#0058A5;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600;">Ver pendientes de aprobación</a>
              &nbsp;
              <a href="${detalleUrl}" style="display:inline-block;background:#f1f5f9;color:#0f172a;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600;">Ver detalle</a>
            </p>`
          : `<p style="margin:18px 0 8px;color:#64748b;font-size:12.5px;">Entrá al ERP → Propiedades → Pendientes de aprobación para revisarla.</p>`
      }
    </div>
  `;
  const result = await sendMail({
    to: recipients.join(", "),
    subject,
    html,
    replyTo: input.propietario.email ?? undefined,
  });
  if (!result.sent) {
    console.warn(
      "[notifyAdminNuevaPropiedadPendiente] no enviado:",
      result.reason
    );
  }
}
