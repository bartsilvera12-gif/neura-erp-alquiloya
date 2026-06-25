// Carteles QR — cada propiedad genera automáticamente su QR.
// Vive dentro del panel del agente/propietario: gestión de carteles por propiedad.

// URL publica que abre la ficha al escanear (deep-link ?prop=<uuid>, ver app.jsx).
// Usamos /publico (no "/"): redirige a la web pública legacy en cualquier host
// (next.config) conservando el query, así el QR abre la PUBLICACIÓN tanto en
// el dominio público como en localhost/preview. Con "/" el QR caía al ERP/login
// en hosts donde la raíz no se reescribe al sitio público.
function qrPublicUrl(p) {
  const origin = (typeof window !== 'undefined' && window.location && window.location.origin) || 'https://alquiloya.com.py';
  return origin + '/publico?prop=' + encodeURIComponent(p.apiId || p.id || '');
}
// QR REAL y escaneable via api.qrserver.com (sin API key). Reemplaza al QRMock
// decorativo, que no se podia escanear.
function qrImgSrc(p, size = 240) {
  return 'https://api.qrserver.com/v1/create-qr-code/?size=' + size + 'x' + size +
    '&margin=0&data=' + encodeURIComponent(qrPublicUrl(p));
}
async function downloadQR(p) {
  try {
    const res = await fetch(qrImgSrc(p, 600));
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'qr-' + (p.codigo || 'inmueble') + '.png';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch {
    window.open(qrImgSrc(p, 600), '_blank', 'noopener');
  }
}

// Convierte el QR (imagen remota api.qrserver.com) a un data:URL para embebir
// dentro del SVG/HTML del cartel. Sin esto, html2canvas/SVG-to-canvas explota
// por CORS al intentar leer la imagen ajena.
async function qrAsDataUrl(p, size = 600) {
  const res = await fetch(qrImgSrc(p, size));
  const blob = await res.blob();
  return await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

function escapeXml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
// Helper: levanta un asset local del legacy site y lo devuelve como data:URL
// para embebirlo en el SVG (sino se rompe el conversion a PNG por CORS).
async function assetAsDataUrl(path) {
  try {
    const res = await fetch(path);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// Arma el cartel completo como SVG con el QR + logo ya embebidos como data URL.
// Layout matchea el PDF de referencia "logo de para qr.pdf":
//   - Header azul angosto con logo AlquiloYA arriba a la izquierda
//   - Banner amarillo grande con "SE ALQUILA" + subtitulo
//   - Area blanca con el QR centrado vertical/horizontal + codigo + direccion
//   - Footer azul angosto con "ALQUILOYA.COM.PY • ¡DONDE ENCONTRÁS MÁS RÁPIDO!"
function buildPosterSvg(p, qrDataUrl, opts = {}) {
  const W = opts.width || 720;
  const H = opts.height || 1020;
  const codigo = escapeXml(p.codigo || '');
  const addr = escapeXml(p.address || '');
  const logoDataUrl = opts.logoDataUrl || null;
  // Bandas: header 13%, amarillo 19%, footer 7%
  const headerH = 130;
  const bannerY = headerH;
  const bannerH = 195;
  const bodyY = bannerY + bannerH;
  const footerH = 70;
  const footerY = H - footerH;
  const bodyH = footerY - bodyY;
  // QR cuadrado, ocupa ~50% del ancho, centrado horizontal y vertical
  // dentro del area blanca.
  const qrSize = Math.min(420, Math.floor(W * 0.58));
  const qrX = (W - qrSize) / 2;
  const qrY = bodyY + Math.floor((bodyH - qrSize) / 2) - 50;
  // Texto codigo + direccion debajo del QR
  const codeY = qrY + qrSize + 38;
  const addrY = codeY + 32;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Arial, Helvetica, sans-serif">
  <rect width="${W}" height="${H}" fill="#ffffff"/>
  <!-- Header azul con logo -->
  <rect x="0" y="0" width="${W}" height="${headerH}" fill="#0058A5"/>
  ${logoDataUrl
    ? `<image href="${logoDataUrl}" x="34" y="22" height="${headerH - 44}" preserveAspectRatio="xMinYMid meet"/>`
    : `<text x="36" y="${headerH / 2 + 12}" font-size="38" font-weight="900" fill="#ffffff" letter-spacing="2">Alquilo<tspan fill="#F9B000">YA</tspan></text>`}
  <!-- Banner amarillo -->
  <rect x="0" y="${bannerY}" width="${W}" height="${bannerH}" fill="#F9B000"/>
  <text x="${W / 2}" y="${bannerY + 110}" font-size="84" font-weight="900" font-style="italic" fill="#0b1622" text-anchor="middle" letter-spacing="2">SE ALQUILA</text>
  <text x="${W / 2}" y="${bannerY + 158}" font-size="20" font-weight="700" font-style="italic" fill="#0b1622" text-anchor="middle" letter-spacing="3">ESCANEÁ Y MIRÁ FOTOS, PRECIO Y DETALLES</text>
  <!-- QR centrado en area blanca -->
  <image href="${qrDataUrl}" x="${qrX}" y="${qrY}" width="${qrSize}" height="${qrSize}"/>
  <!-- Codigo + direccion -->
  <text x="${W / 2}" y="${codeY}" font-size="20" font-family="monospace" fill="#5b6573" text-anchor="middle">${codigo}</text>
  <text x="${W / 2}" y="${addrY}" font-size="24" font-weight="700" fill="#2a3543" text-anchor="middle">${addr}</text>
  <!-- Footer azul -->
  <rect x="0" y="${footerY}" width="${W}" height="${footerH}" fill="#0058A5"/>
  <text x="${W / 2}" y="${footerY + 44}" font-size="20" font-weight="800" font-style="italic" fill="#ffffff" text-anchor="middle" letter-spacing="2">ALQUILOYA.COM.PY • ¡DONDE ENCONTRÁS MÁS RÁPIDO!</text>
</svg>`;
}
// o pegar en una publicacion.
async function downloadPoster(p) {
  try {
    const qrDataUrl = await qrAsDataUrl(p, 600);
    const logoDataUrl = await assetAsDataUrl("/alquiloya-legacy/assets/logo.png");
    const W = 720;
    const H = 1020;
    const svg = buildPosterSvg(p, qrDataUrl, { width: W, height: H, logoDataUrl });
    const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);
    await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = W;
          canvas.height = H;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, W, H);
          ctx.drawImage(img, 0, 0, W, H);
          URL.revokeObjectURL(svgUrl);
          canvas.toBlob((blob) => {
            if (!blob) { reject(new Error('canvas vacío')); return; }
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'cartel-' + (p.codigo || 'inmueble') + '.png';
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 2000);
            resolve();
          }, 'image/png');
        } catch (e) { reject(e); }
      };
      img.onerror = () => { URL.revokeObjectURL(svgUrl); reject(new Error('SVG load error')); };
      img.src = svgUrl;
    });
  } catch (err) {
    // Fallback: si el render del cartel falla por CORS u otra razon, al menos
    // bajamos el QR suelto para que el usuario tenga algo accionable.
    console.warn('[downloadPoster] fallo, fallback a QR suelto:', err && err.message);
    return downloadQR(p);
  }
}

// Imprime uno o varios carteles. Antes abria una ventana nueva (window.open)
// y el usuario veia el cartel en un popup antes de imprimir. Ahora usamos un
// iframe oculto: el dialogo de impresion sale directo, sin previews.
function printPosters(list) {
  const arr = Array.isArray(list) ? list : [list];
  if (!arr.length) return;
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.visibility = 'hidden';
  document.body.appendChild(iframe);
  const cleanup = () => {
    setTimeout(() => { try { document.body.removeChild(iframe); } catch (e) { /* ignore */ } }, 1000);
  };
  const carteles = arr.map(p => `
    <div class="cartel">
      <div class="hd">ALQUILOYA</div>
      <div class="yellow"><div class="big">SE ALQUILA</div><div class="sub">ESCANEÁ Y MIRÁ FOTOS, PRECIO Y DETALLES</div></div>
      <div class="body">
        <img src="${qrImgSrc(p, 600)}" alt="QR" class="qr"/>
        <div class="code">${p.codigo || ''}</div>
        <div class="addr">${(p.address || '').replace(/</g, '')}</div>
      </div>
      <div class="ft">ALQUILOYA.COM.PY · ¡DONDE ENCONTRÁS MÁS RÁPIDO!</div>
    </div>`).join('');
  // Para que el QR salga nitido y no como un cuadro gris (cuando el navegador
  // dispara print() antes de que termine la red), esperamos a que todas las
  // imagenes carguen y recien ahi triggereamos iframe.contentWindow.print().
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Carteles QR</title>
    <style>
      *{box-sizing:border-box;margin:0;font-family:Arial,Helvetica,sans-serif}
      body{padding:0}
      .cartel{width:100%;max-width:560px;margin:0 auto 24px;border:1px solid #e7ebf0;border-radius:12px;overflow:hidden;page-break-after:always}
      .hd{background:#0058A5;color:#fff;font-weight:900;letter-spacing:.04em;padding:16px 22px;font-size:20px}
      .yellow{background:#F9B000;text-align:center;padding:22px 16px}
      .big{font-weight:900;font-style:italic;font-size:56px;color:#0b1622;line-height:1;letter-spacing:1px}
      .sub{font-weight:700;font-style:italic;font-size:12px;color:#0b1622;margin-top:8px;letter-spacing:.04em}
      .body{padding:28px;text-align:center}
      .qr{width:300px;height:300px;border-radius:6px}
      .code{font-family:monospace;font-size:14px;font-weight:600;color:#5b6573;margin-top:14px}
      .addr{font-size:15px;font-weight:600;color:#2a3543;margin-top:4px}
      .ft{background:#0058A5;color:#fff;text-align:center;padding:14px;font-weight:800;font-style:italic;font-size:14px;letter-spacing:1px}
      @media print{.cartel{border:none;page-break-after:always}}
      @page { margin: 12mm }
    </style></head><body>${carteles}</body></html>`;
  iframe.onload = () => {
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    const win = iframe.contentWindow;
    const imgs = doc.images || [];
    let pending = imgs.length;
    let fired = false;
    const fire = () => {
      if (fired) return;
      fired = true;
      try { win.focus(); win.print(); } catch (e) { /* ignore */ }
      cleanup();
    };
    const done = () => { if (--pending <= 0) fire(); };
    if (!imgs.length) { setTimeout(fire, 200); return; }
    for (let i = 0; i < imgs.length; i++) {
      if (imgs[i].complete && imgs[i].naturalWidth) { done(); }
      else {
        imgs[i].addEventListener('load', done);
        imgs[i].addEventListener('error', done);
      }
    }
    setTimeout(fire, 6000); // failsafe por si alguna imagen nunca dispara load
  };
  iframe.srcdoc = html;
}

function PostersPage({ route, onNav }) {
  // Snapshot global compartido con AdminAgentPage. Cuando el usuario navega
  // Resumen → Carteles QR → Resumen, las dos paginas se remontan; sin
  // snapshot cada remount limpia el state y dispara fetches → flash de
  // skeleton. Inicializando desde SNAP los datos ya estan en el primer render.
  const SNAP = (typeof window !== 'undefined' ? (window.__AY_PANEL_SNAPSHOT = window.__AY_PANEL_SNAPSHOT || {}) : {});
  const [modalId, setModalId] = React.useState(null);
  const [query, setQuery] = React.useState('');
  const [selected, setSelected] = React.useState(() => new Set());

  // Sesion: derivada del snapshot global de AdminAgentPage si existe.
  const initKind = SNAP.meData?.kind || null;
  const initInfo = (() => {
    const m = SNAP.meData;
    if (!m) return { nombre: '', email: '' };
    const p = m.kind === 'agente' ? m.agente : m.propietario;
    return { nombre: p?.nombre || '', email: p?.email || m.usuario?.email || '' };
  })();
  const [meKind, setMeKind] = React.useState(initKind);
  const [meInfo, setMeInfo] = React.useState(initInfo);
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const cf = (typeof window !== 'undefined' && window.ayCachedFetch) ? window.ayCachedFetch : fetch;
      try {
        const r2 = await cf('/api/agente/me', { cache: 'no-store', credentials: 'include' });
        if (r2.ok) {
          const b2 = await r2.json();
          if (!cancelled && b2?.agente) {
            setMeKind('agente');
            setMeInfo({ nombre: b2.agente.nombre || '', email: b2.agente.email || b2.usuario?.email || '' });
            SNAP.meData = { kind: 'agente', usuario: b2.usuario, agente: b2.agente };
            return;
          }
        }
        const r = await cf('/api/propietario/me', { cache: 'no-store', credentials: 'include' });
        if (r.ok) {
          const b = await r.json();
          if (!cancelled && b?.propietario) {
            setMeKind('propietario');
            setMeInfo({ nombre: b.propietario.nombre || '', email: b.propietario.email || b.usuario?.email || '' });
            SNAP.meData = { kind: 'propietario', usuario: b.usuario, propietario: b.propietario };
          }
        }
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, []);
  const isPropietario = meKind === 'propietario';

  // Inmuebles REALES del usuario logueado (propietario primero, luego agente).
  // Init desde SNAP.myPropiedades (lo carga AdminAgentPage) para no recargar.
  const initProps = Array.isArray(SNAP.myPropiedades)
    ? SNAP.myPropiedades.map(p => ({
        id: p.apiId || p.id,
        codigo: p.codigo || p.id,
        title: p.title || 'Sin título',
        cover: p.cover || null,
        address: [p.neighborhood, p.city].filter(Boolean).join(', ') || '—',
        tipo: p.tipo || '',
        verified: !!p.verificada,
      }))
    : null;
  const [myProps, setMyProps] = React.useState(initProps);
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const cf = (typeof window !== 'undefined' && window.ayCachedFetch) ? window.ayCachedFetch : fetch;
      let body = null;
      try {
        const r = await cf('/api/propietario/propiedades', { cache: 'no-store', credentials: 'include' });
        if (r.ok) {
          const b = await r.json();
          if (b?.success && Array.isArray(b.propiedades) && b.propiedades.length) body = b;
        }
      } catch { /* try next */ }
      if (!body) {
        try {
          const r2 = await cf('/api/agente/propiedades', { cache: 'no-store', credentials: 'include' });
          if (r2.ok) {
            const b2 = await r2.json();
            if (b2?.success && Array.isArray(b2.propiedades)) body = b2;
          }
        } catch { /* sin sesion */ }
      }
      if (cancelled) return;
      if (!body || !Array.isArray(body.propiedades)) { setMyProps([]); return; }
      const mapped = body.propiedades.map(p => ({
        id: p.id,
        codigo: p.codigo || p.id,
        title: p.titulo || 'Sin título',
        cover: p.cover_url || null,
        address: [p.barrio, p.ciudad].filter(Boolean).join(', ') || '—',
        tipo: p.tipo || '',
        verified: !!p.verificada,
      }));
      setMyProps(mapped);
    })();
    return () => { cancelled = true; };
  }, []);

  const loading = myProps === null;
  const list = Array.isArray(myProps) ? myProps : [];
  const filtered = query.trim()
    ? list.filter(p =>
        (p.title || '').toLowerCase().includes(query.toLowerCase()) ||
        (p.codigo || '').toLowerCase().includes(query.toLowerCase()))
    : list;
  const sel = modalId ? list.find(p => p.codigo === modalId || p.id === modalId) : null;
  const selCount = selected.size;
  const allChecked = filtered.length > 0 && filtered.every(p => selected.has(p.id));
  const toggleOne = (id) => setSelected(prev => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const toggleAll = () => setSelected(prev => {
    if (filtered.every(p => prev.has(p.id))) return new Set();
    return new Set(filtered.map(p => p.id));
  });
  const printSelected = () => {
    const chosen = list.filter(p => selected.has(p.id));
    printPosters(chosen.length ? chosen : filtered);
  };

  return (
    <AdminLayout
      kind="agent"
      role={meKind ? (isPropietario ? 'propietario' : 'agente') : undefined}
      planLoading={meKind === null}
      route={route || 'admin-agent-qr'}
      onNav={onNav}
      displayName={meInfo.nombre || 'Mi cuenta'}
      displayEmail={meInfo.email}
      planInfo={(() => {
        // Mismo lookup que AdminAgentPage: el plan viene anidado en
        // `agente.plan` (con nombre/tier) desde /api/agente/me.
        const src = isPropietario ? SNAP.meData?.propietario : SNAP.meData?.agente;
        if (!src) return null;
        const planName = (src.plan && src.plan.nombre) || src.plan_nombre || null;
        if (!planName) return null;
        let venc = null;
        if (src.plan_vencimiento_at) {
          try {
            venc = new Date(src.plan_vencimiento_at).toLocaleDateString('es-PY', { day: 'numeric', month: 'long' });
          } catch { /* ignore */ }
        }
        return { name: planName, vencimiento: venc };
      })()}
      agentRoute={(() => {
        const ag = !isPropietario ? SNAP.meData?.agente : null;
        if (!ag?.id) return null;
        const nombreSlug = String(ag.nombre || '')
          .normalize('NFD').replace(/[̀-ͯ]/g, '')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '') || 'agente';
        return 'agent/' + (ag.slug || nombreSlug) + '?id=' + ag.id;
      })()}
      title="Carteles QR"
      subtitle="Cada propiedad genera su QR único automáticamente. Descargá o imprimí el cartel listo para la fachada."
      actions={
        <button
          className="btn btn-primary btn-sm"
          onClick={printSelected}
          disabled={loading || filtered.length === 0}
          style={(loading || filtered.length === 0) ? { opacity: .5, cursor: 'not-allowed' } : undefined}
          title={selCount ? `Imprimir ${selCount} seleccionado(s)` : 'Imprimir todos'}
        >
          <I.print s={14}/> {selCount ? `Imprimir ${selCount} seleccionado${selCount !== 1 ? 's' : ''}` : 'Imprimir todos'}
        </button>
      }
    >
      <div className="card-soft" style={{ padding: 14, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <MiniStat label="Inmuebles con QR" value={loading ? '—' : list.length} icon="qr" color="var(--blue)"/>
        {/* Descargas / escaneos: no hay tracking real todavia → mostramos "—". */}
        <MiniStat label="Carteles descargados" value="—" icon="download" color="var(--green)"/>
        <MiniStat label="Escaneos esta semana" value="—" icon="eye" color="var(--yellow-600)"/>
        <MiniStat label="Más escaneado" value="—" icon="trend" color="#6e3ad1"/>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden', marginTop: 16 }}>
        <div className="row between" style={{ padding: '14px 20px', borderBottom: '1px solid var(--line)', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 15 }}>Mis inmuebles publicados</div>
            <div className="muted" style={{ marginTop: 3, fontSize: 12 }}>Cada uno con su QR generado automáticamente</div>
          </div>
          <input className="input" placeholder="Buscar por ID o título…" value={query} onChange={e => setQuery(e.target.value)} style={{ width: 260, padding: '8px 12px', fontSize: 13 }}/>
        </div>

        {loading ? (
          <div style={{ padding: '48px 18px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>Cargando tus inmuebles…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '48px 18px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
            {list.length === 0
              ? 'Todavía no tenés inmuebles publicados. Cuando publiques uno, su cartel QR aparece acá automáticamente.'
              : 'No hay inmuebles que coincidan con la búsqueda.'}
          </div>
        ) : (
        <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--bg-2)', textAlign: 'left' }}>
              <th style={{ padding: '10px 8px 10px 18px', width: 36 }}>
                <input type="checkbox" checked={allChecked} onChange={toggleAll} style={{ width: 16, height: 16, accentColor: 'var(--blue)', cursor: 'pointer' }} title="Seleccionar todos"/>
              </th>
              <th style={{ padding: '10px 14px', fontSize: 10.5, fontWeight: 700, color: 'var(--ink-3)', letterSpacing: '.05em', textTransform: 'uppercase' }}>Inmueble</th>
              <th style={{ padding: '10px 14px', fontSize: 10.5, fontWeight: 700, color: 'var(--ink-3)', letterSpacing: '.05em', textTransform: 'uppercase', textAlign: 'center', width: 80 }}>QR</th>
              <th style={{ padding: '10px 18px', width: 160 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const checked = selected.has(p.id);
              return (
              <tr key={p.id} style={{ borderTop: '1px solid var(--line-2)', transition: 'background .12s', background: checked ? 'var(--blue-50)' : '' }}
                onMouseEnter={e => { if (!checked) e.currentTarget.style.background = 'var(--bg-2)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = checked ? 'var(--blue-50)' : ''; }}>
                <td style={{ padding: '14px 8px 14px 18px' }}>
                  <input type="checkbox" checked={checked} onChange={() => toggleOne(p.id)} style={{ width: 16, height: 16, accentColor: 'var(--blue)', cursor: 'pointer' }}/>
                </td>
                <td style={{ padding: '14px' }}>
                  <div className="row gap-12" style={{ alignItems: 'center' }}>
                    {p.cover ? (
                      <Photo src={p.cover} style={{ width: 56, height: 44, borderRadius: 8, flexShrink: 0 }}/>
                    ) : (
                      <div style={{ width: 56, height: 44, borderRadius: 8, flexShrink: 0, background: 'var(--bg-3)', color: 'var(--ink-4)', display: 'grid', placeItems: 'center' }} title="Sin imagen">
                        <I.grid s={16}/>
                      </div>
                    )}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 320 }}>{p.title}</div>
                      <div style={{ marginTop: 3, fontSize: 11.5, color: 'var(--ink-3)', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span className="mono" style={{ fontWeight: 600, fontSize: 11, color: 'var(--ink-4)' }}>{p.codigo}</span>
                        <span style={{ color: 'var(--line)' }}>•</span>
                        <span>{p.address}</span>
                      </div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '14px', textAlign: 'center' }}>
                  <div style={{ padding: 4, background: '#fff', border: '1px solid var(--line)', borderRadius: 7, display: 'inline-block', lineHeight: 0 }}>
                    <img src={qrImgSrc(p, 96)} alt={'QR ' + p.codigo} width={36} height={36} style={{ display: 'block' }}/>
                  </div>
                </td>
                <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                  <div className="row gap-6" style={{ justifyContent: 'flex-end' }}>
                    <button title="Descargar cartel" onClick={() => downloadPoster(p)} style={{ padding: 0, width: 30, height: 30, borderRadius: 8, background: 'transparent', color: 'var(--ink-3)', border: '1px solid var(--line)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--blue)'; e.currentTarget.style.color = 'var(--blue)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.color = 'var(--ink-3)'; }}><I.download s={13}/></button>
                    <button title="Imprimir cartel" onClick={() => printPosters(p)} style={{ padding: 0, width: 30, height: 30, borderRadius: 8, background: 'transparent', color: 'var(--ink-3)', border: '1px solid var(--line)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--blue)'; e.currentTarget.style.color = 'var(--blue)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.color = 'var(--ink-3)'; }}><I.print s={13}/></button>
                    <button onClick={() => setModalId(p.codigo)} style={{ padding: '0 14px', height: 30, borderRadius: 8, background: 'var(--blue)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      Ver <I.chev s={11}/>
                    </button>
                  </div>
                </td>
              </tr>
            );})}
          </tbody>
        </table>
        </div>
        )}
        {!loading && filtered.length > 0 ? (
          <div className="row between" style={{ padding: '12px 20px', borderTop: '1px solid var(--line)', fontSize: 12, color: 'var(--ink-3)', flexWrap: 'wrap', gap: 8 }}>
            <div>Mostrando {filtered.length} inmueble{filtered.length !== 1 ? 's' : ''}{selCount ? ` · ${selCount} seleccionado${selCount !== 1 ? 's' : ''}` : ''}</div>
            {selCount > 0 ? (
              <button onClick={() => setSelected(new Set())} style={{ background: 'none', border: 'none', color: 'var(--blue)', cursor: 'pointer', fontWeight: 600, fontSize: 12, fontFamily: 'inherit' }}>Limpiar selección</button>
            ) : null}
          </div>
        ) : null}
      </div>

      {sel && <PosterModal p={sel} onClose={() => setModalId(null)} />}
    </AdminLayout>
  );
}

function PosterModal({ p, onClose }) {
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(11,22,34,.65)', backdropFilter: 'blur(4px)',
      display: 'grid', placeItems: 'center', zIndex: 100, padding: 32, animation: 'fadeIn .2s ease both'
    }}>
      <div onClick={e => e.stopPropagation()} className="card" style={{
        width: '100%', maxWidth: 720, padding: 0, overflow: 'hidden',
        boxShadow: '0 40px 100px rgba(0,0,0,.4)', animation: 'fadeUp .25s ease both'
      }}>
        <div className="row between" style={{ padding: '20px 24px', borderBottom: '1px solid var(--line-2)' }}>
          <div>
            <div className="tag">Cartel QR del inmueble</div>
            <div className="row gap-10" style={{ marginTop: 4, alignItems: 'baseline' }}>
              <h3 style={{ fontSize: 18 }}>{p.title}</h3>
              <span className="mono muted xs">{p.codigo || p.id}</span>
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 36, height: 36, borderRadius: '50%', background: 'var(--bg-2)', border: 'none',
            cursor: 'pointer', display: 'grid', placeItems: 'center'
          }}><I.x s={16}/></button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 28, padding: 28, background: 'var(--bg-2)' }}>
          <FullPoster p={p}/>
          <div className="col gap-16">
            <div>
              <div className="muted xs" style={{ letterSpacing: '.08em', fontWeight: 700 }}>DATOS DEL CARTEL</div>
              <div className="col gap-6" style={{ marginTop: 10, fontSize: 14 }}>
                <Row label="ID del inmueble" value={<span className="mono">{p.codigo || p.id}</span>}/>
                <Row label="Dirección" value={p.address}/>
                <Row label="Tipo" value={(typeof TIPOS !== 'undefined' && TIPOS.find(t => t.id === p.tipo)?.label) || p.tipo || '—'}/>
                <Row label="Estado" value={p.verified ? 'Verificado' : 'Publicado'}/>
              </div>
            </div>

            <div className="card-soft" style={{ padding: 14, fontSize: 12.5, color: 'var(--ink-3)' }}>
              <div className="row gap-8" style={{ alignItems: 'flex-start' }}>
                <I.shield s={14}/>
                <span>El QR es único para esta propiedad. Al escanear, abre la ficha pública con todas las fotos y datos de contacto.</span>
              </div>
            </div>

            <div className="col gap-8" style={{ marginTop: 'auto' }}>
              <button className="btn btn-blue" style={{ justifyContent: 'center' }} onClick={() => downloadPoster(p)}><I.download s={14}/> Descargar cartel</button>
              <button className="btn btn-outline" style={{ justifyContent: 'center' }} onClick={() => printPosters(p)}><I.print s={14}/> Imprimir cartel</button>
              <button className="btn btn-outline" style={{ justifyContent: 'center' }} onClick={async () => {
                const url = qrPublicUrl(p);
                if (navigator.share) { try { await navigator.share({ title: p.title, url }); return; } catch { return; } }
                try { await navigator.clipboard.writeText(url); window.alert('Enlace copiado al portapapeles.'); }
                catch { window.prompt('Copiá el enlace:', url); }
              }}><I.share s={14}/> Compartir enlace</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="row between">
      <span className="muted">{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}

const th = { padding: '14px 22px', fontSize: 12, fontWeight: 700, letterSpacing: '.04em', color: 'var(--ink-3)' };
const td = { padding: '18px 22px', verticalAlign: 'middle' };

function MiniStat({ label, value, icon, color }) {
  return (
    <div className="row gap-12" style={{ alignItems: 'center' }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: color + '14', color, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
        {React.createElement(I[icon], { s: 18 })}
      </div>
      <div>
        <div className="muted xs">{label}</div>
        <div style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 18 }}>{value}</div>
      </div>
    </div>
  );
}

function PosterPreviewCard({ p }) {
  return (
    <div className="card" style={{ padding: 22 }}>
      <div className="row between">
        <div>
          <div className="tag">Vista previa del cartel</div>
          <div style={{ fontWeight: 700, fontSize: 15, marginTop: 4 }}>
            <span className="mono">{p.id}</span>
          </div>
        </div>
        {p.verified
          ? <span className="badge badge-verified"><I.check s={11}/> Verificado</span>
          : <span className="badge" style={{ background: 'var(--yellow-50)', color: '#8a5e00' }}>Publicado</span>}
      </div>

      <div style={{ marginTop: 16, padding: 24, background: 'var(--bg-2)', borderRadius: 14, display: 'grid', placeItems: 'center' }}>
        <FullPoster id={p.id} address={p.address}/>
      </div>

      <div className="col gap-10" style={{ marginTop: 16 }}>
        <button className="btn btn-blue" style={{ justifyContent: 'center' }}><I.download s={14}/> Descargar PDF A4</button>
        <button className="btn btn-outline" style={{ justifyContent: 'center' }}><I.print s={14}/> Imprimir cartel</button>
        <button className="btn btn-outline" style={{ justifyContent: 'center' }}><I.share s={14}/> Compartir enlace del inmueble</button>
      </div>

      <div className="card-soft" style={{ padding: 14, marginTop: 16, fontSize: 12.5, color: 'var(--ink-3)' }}>
        <div className="row gap-8" style={{ alignItems: 'flex-start' }}>
          <I.shield s={14}/>
          <span>El QR es único para esta propiedad y se generó automáticamente al cargar el inmueble. Al escanear, abre la ficha pública con todas las fotos y datos de contacto.</span>
        </div>
      </div>
    </div>
  );
}

function FullPoster({ p, id, address }) {
  // Acepta `p` (preferido) o id/address sueltos (compat). QR real escaneable.
  const prop = p || { codigo: id, id, address };
  const code = prop.codigo || prop.id || '';
  const addr = prop.address || address || '';
  return (
    <div style={{
      width: 280, background: '#fff', borderRadius: 12, overflow: 'hidden',
      boxShadow: 'var(--shadow-lg)', border: '1px solid var(--line)'
    }}>
      <div style={{ background: 'var(--blue)', color: '#fff', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Logo size={18} dark/>
      </div>
      <div style={{ background: 'var(--yellow)', padding: '20px 20px 16px', textAlign: 'center' }}>
        <div style={{ fontFamily: 'Montserrat', fontWeight: 900, fontStyle: 'italic', fontSize: 36, color: 'var(--ink)', letterSpacing: '-0.02em', lineHeight: 1 }}>
          SE ALQUILA
        </div>
        <div style={{ fontFamily: 'Montserrat', fontWeight: 700, fontStyle: 'italic', fontSize: 11, color: 'var(--ink)', marginTop: 8, letterSpacing: '.04em' }}>
          ESCANEÁ Y MIRÁ FOTOS, PRECIO Y DETALLES
        </div>
      </div>
      <div style={{ padding: 20, textAlign: 'center' }}>
        <div style={{ padding: 8, border: '3px solid var(--ink)', borderRadius: 8, display: 'inline-block', lineHeight: 0 }}>
          <img src={qrImgSrc(prop, 300)} alt={'QR ' + code} width={150} height={150} style={{ display: 'block' }}/>
        </div>
        <div style={{ marginTop: 12, fontFamily: 'JetBrains Mono', fontSize: 12, fontWeight: 600, color: 'var(--ink-3)' }}>{code}</div>
        <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4, color: 'var(--ink-2)' }}>{addr}</div>
      </div>
      <div style={{ background: 'var(--blue)', color: '#fff', padding: '12px 20px', textAlign: 'center' }}>
        <div style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 13, fontStyle: 'italic', letterSpacing: '.04em' }}>
          ALQUILOYA.COM.PY
        </div>
        <div style={{ fontFamily: 'Montserrat', fontWeight: 700, fontStyle: 'italic', fontSize: 10, color: 'var(--yellow)', marginTop: 2 }}>
          ¡DONDE ENCONTRÁS MÁS RÁPIDO!
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { PostersPage, FullPoster, PosterModal });
