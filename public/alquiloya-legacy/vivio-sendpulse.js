// ─────────────────────────────────────────────────────────────────────────────
// VIVIO + Sendpulse — Integración del chatbot con la API de Sendpulse
// ─────────────────────────────────────────────────────────────────────────────
// Estado: STUB / DESACTIVADO.
// Para activar: completar SENDPULSE_CONFIG con las credenciales reales
// y poner ENABLED = true. El componente VivioChatbot detecta automáticamente
// si la integración está activa y reemplaza el parser local por llamadas reales.
//
// IMPORTANTE de seguridad:
//   Las credenciales NO deben quedar en el frontend en producción.
//   En producción ideal: crear un endpoint backend mínimo (Node/Express,
//   Vercel/Netlify function, Cloudflare Worker) que reciba el mensaje y
//   reenvíe a Sendpulse con la API key guardada como variable de entorno.
//
// Ej de endpoint backend (Node):
//   POST /api/vivio
//   Body: { message, conversationId, context }
//   Response: { reply, parsed, conversationId }
// ─────────────────────────────────────────────────────────────────────────────

window.SENDPULSE_CONFIG = {
  ENABLED: false,                      // poner true cuando estén las credenciales

  // Credenciales (provistas por el cliente desde su panel Sendpulse)
  CLIENT_ID:     '',                   // ej: 'b0e7e9f5...'
  CLIENT_SECRET: '',                   // ej: 'f8a2c1d4...'
  BOT_ID:        '',                   // ID del bot VIVIO en Sendpulse

  // Endpoints REST oficiales de Sendpulse
  TOKEN_URL:     'https://api.sendpulse.com/oauth/access_token',
  CHATBOT_BASE:  'https://api.sendpulse.com/chatbots',

  // Si tenés un backend propio que ya hace todo el flujo:
  // pone aquí la URL y se va a usar en lugar de Sendpulse directo
  PROXY_ENDPOINT: '',                  // ej: 'https://api.alquiloya.com.py/vivio'

  // Modo alternativo: widget script oficial (más rápido pero menos custom)
  // Ver instrucciones al pie del archivo
  WIDGET_SRC: '',                      // ej: 'https://web.webformscr.com/apps/fc3/build/loader.js?...'
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

let _accessToken = null;
let _tokenExpires = 0;

async function getSendpulseToken() {
  const cfg = window.SENDPULSE_CONFIG;
  if (_accessToken && Date.now() < _tokenExpires - 60000) return _accessToken;
  const res = await fetch(cfg.TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: cfg.CLIENT_ID,
      client_secret: cfg.CLIENT_SECRET,
    }),
  });
  if (!res.ok) throw new Error('Sendpulse auth failed: ' + res.status);
  const data = await res.json();
  _accessToken = data.access_token;
  _tokenExpires = Date.now() + (data.expires_in || 3600) * 1000;
  return _accessToken;
}

// ─────────────────────────────────────────────────────────────────────────────
// API pública — el chatbot llama a esta función
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Envía un mensaje al bot VIVIO en Sendpulse y devuelve la respuesta.
 *
 * @param {string} message  Mensaje del usuario
 * @param {object} state    Estado actual de la conversación (datos parseados)
 * @param {string} contactId  ID del contacto en Sendpulse (opcional, se genera si no se pasa)
 * @returns {Promise<{ reply: string, parsed: object, contactId: string, done?: boolean }>}
 */
window.vivioSendpulse = async function (message, state, contactId) {
  const cfg = window.SENDPULSE_CONFIG;

  // ── Modo A: proxy backend propio ──────────────────────────────────────────
  if (cfg.PROXY_ENDPOINT) {
    const res = await fetch(cfg.PROXY_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, state, contactId }),
    });
    if (!res.ok) throw new Error('Proxy error: ' + res.status);
    return res.json();
  }

  // ── Modo B: llamadas directas a Sendpulse (solo para demo, NO producción) ─
  if (!cfg.ENABLED) {
    throw new Error('Sendpulse no habilitado. Configurar SENDPULSE_CONFIG.');
  }
  const token = await getSendpulseToken();

  // 1. Asegurar contacto
  if (!contactId) {
    const r = await fetch(`${cfg.CHATBOT_BASE}/contacts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        bot_id: cfg.BOT_ID,
        phone: state?.data?.telefono || `web-${Date.now()}`,
        name: state?.data?.nombre || 'Visitante Web',
      }),
    });
    const data = await r.json();
    contactId = data?.data?.id;
  }

  // 2. Enviar mensaje
  const r2 = await fetch(`${cfg.CHATBOT_BASE}/contacts/sendText`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contact_id: contactId,
      text: message,
    }),
  });
  const out = await r2.json();

  // 3. Mapear la respuesta de Sendpulse al formato VIVIO
  return {
    reply: out?.data?.message?.text || 'Procesando…',
    parsed: out?.data?.variables || {},   // Sendpulse devuelve variables del flow
    contactId,
    done: !!out?.data?.is_final,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Modo C: widget oficial Sendpulse (alternativa rápida — reemplaza VIVIO)
// ─────────────────────────────────────────────────────────────────────────────
// Si preferís el widget oficial de Sendpulse (sin lógica custom) y descartar
// el componente VIVIO React, descomenta esto en index.html antes de </body>:
//
//   <script>
//     window.__SP = window.__SP || function() {
//       (window.__SP._ = window.__SP._ || []).push(arguments);
//     };
//     window.__SP('init', 'TU_BOT_ID_AQUI');
//   </script>
//   <script async src="https://web.webformscr.com/apps/fc3/build/loader.js"></script>
//
// Y luego eliminar <VivioChatbot/> de app.jsx.
// ─────────────────────────────────────────────────────────────────────────────

Object.assign(window, { getSendpulseToken });
