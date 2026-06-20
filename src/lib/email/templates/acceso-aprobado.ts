import "server-only";

/**
 * Email enviado al usuario cuando el admin aprueba su solicitud de acceso o
 * crea manualmente su cuenta del portal. Incluye email + contraseña temporal
 * + link al login según el tipo (portal-agentes o portal-referidos).
 */
export function renderAccesoAprobadoEmail({
  nombre,
  email,
  password,
  portalUrl,
  appName = "AlquiloYa",
}: {
  nombre: string;
  email: string;
  password: string;
  portalUrl: string;
  appName?: string;
}): { subject: string; html: string; text: string } {
  const safeNombre = escapeHtml(nombre || "Hola");
  const safeEmail = escapeHtml(email);
  const safePassword = escapeHtml(password);
  const safePortalUrl = escapeAttr(portalUrl);

  const subject = `Tu acceso a ${appName} fue aprobado`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f6f8fb;font-family:'Helvetica Neue',Arial,sans-serif;color:#0b1622">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f6f8fb;padding:32px 16px">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 18px 40px -18px rgba(15,23,42,.25)">
          <tr>
            <td style="background:#0058A5;padding:24px 28px">
              <div style="font-size:20px;font-weight:800;letter-spacing:-.01em;color:#fff">${escapeHtml(appName)}</div>
              <div style="font-size:13px;color:#cfe0f4;margin-top:4px">Portal de agentes y publicadores</div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 28px 8px">
              <h1 style="margin:0 0 8px;font-size:22px;line-height:1.25;color:#0b1622">¡${safeNombre}, tu acceso fue aprobado! 🎉</h1>
              <p style="margin:0 0 20px;font-size:15px;line-height:1.55;color:#2a3543">
                Ya podés ingresar al portal y empezar a publicar.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f6f8fb;border:1px solid #e7ebf0;border-radius:12px">
                <tr>
                  <td style="padding:16px 18px">
                    <div style="font-size:11px;font-weight:700;color:#5b6573;letter-spacing:.05em;text-transform:uppercase">Email</div>
                    <div style="font-size:15px;font-weight:600;margin-top:4px;color:#0b1622;word-break:break-all">${safeEmail}</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 18px 16px">
                    <div style="font-size:11px;font-weight:700;color:#5b6573;letter-spacing:.05em;text-transform:uppercase">Contraseña</div>
                    <div style="font-family:'Courier New',monospace;font-size:18px;font-weight:700;margin-top:6px;padding:10px 14px;background:#fff;border:1px solid #d4e6f7;border-radius:8px;color:#0058A5;letter-spacing:.04em;word-break:break-all">${safePassword}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px 12px" align="center">
              <a href="${safePortalUrl}"
                 style="display:inline-block;background:#0058A5;color:#fff;text-decoration:none;padding:14px 28px;border-radius:999px;font-weight:700;font-size:15px;letter-spacing:.01em">
                Ingresar al portal
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 28px">
              <p style="margin:0;font-size:13px;line-height:1.55;color:#5b6573">
                Guardala en un lugar seguro: la vas a usar cada vez que entres al portal. Si no esperabas este correo, ignoralo o respondé para avisarnos.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f6f8fb;padding:18px 28px;border-top:1px solid #eef1f4">
              <div style="font-size:12px;color:#8893a1;text-align:center">
                ${escapeHtml(appName)} · ¡Donde encontrás más rápido!
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text =
    `¡${nombre}, tu acceso a ${appName} fue aprobado!\n\n` +
    `Email: ${email}\n` +
    `Contraseña: ${password}\n\n` +
    `Ingresá en: ${portalUrl}\n\n` +
    `Guardala en un lugar seguro — la vas a usar cada vez que entres al portal.\n\n` +
    `${appName} · ¡Donde encontrás más rápido!`;

  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
function escapeAttr(s: string): string {
  return escapeHtml(s);
}
