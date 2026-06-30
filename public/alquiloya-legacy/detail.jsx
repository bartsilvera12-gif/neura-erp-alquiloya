// Detalle de inmueble

function DetailPage({ p, onProperty, onNav }) {
  const [active, setActive] = React.useState(0);
  const { properties } = useAlquiloYaPublicData();
  const baseProperty = p || properties[0] || PROPERTIES[0];
  const apiProperty = useAlquiloYaPublicProperty(baseProperty?.id);
  p = apiProperty || baseProperty;

  // Tracker de vistas: dispara POST /vista una sola vez por sesion+propiedad.
  // Dedup en sessionStorage para no inflar el contador al refrescar.
  React.useEffect(() => {
    const realId = p && (p.apiId || p.id);
    if (!realId || typeof realId !== 'string' || !/^[0-9a-f-]{36}$/i.test(realId)) return;
    const key = 'aly_vista_' + realId;
    try { if (sessionStorage.getItem(key)) return; } catch { /* sin sessionStorage */ }
    try { sessionStorage.setItem(key, '1'); } catch {}
    fetch('/api/public/alquiloya/propiedades/' + realId + '/vista', {
      method: 'POST',
      credentials: 'omit',
    }).catch(() => {});
  }, [p && (p.apiId || p.id)]);
  // "Propiedades similares" muestra SOLO inmuebles verificados (badge
  // azul) — pedido del cliente para que esta zona destaque trabajos
  // serios. La verificacion se obtiene por la solicitud de verificacion
  // que cargan los agentes (boton "Verificar" en su panel + revision
  // manual). Si no hay verificadas del mismo tipo, no renderizamos la
  // seccion para no mostrarla vacia.
  const similar = properties
    .filter(x => x.id !== p.id && x.tipo === p.tipo && x.verified)
    .slice(0, 3);
  return (
    <div className="fade-in">
      <div className="container" style={{ padding: '24px 32px 8px' }}>
        <div className="row gap-8 muted" style={{ fontSize: 13 }}>
          <span style={{ cursor: 'pointer' }} onClick={() => onNav('home')}>Inicio</span>
          <I.chev s={12}/>
          <span style={{ cursor: 'pointer' }} onClick={() => onNav('catalog')}>Alquileres</span>
          <I.chev s={12}/>
          <span style={{ cursor: 'pointer' }} onClick={() => onNav('catalog')}>{p.ciudad}</span>
          <I.chev s={12}/>
          <span style={{ color: 'var(--ink)' }}>{p.title}</span>
        </div>
      </div>
      <Gallery photos={p.photos} active={active} setActive={setActive} property={p} />
      <div className="container" style={{ padding: '32px', display: 'grid', gridTemplateColumns: '1fr 380px', gap: 40, alignItems: 'flex-start' }}>
        <div>
          <DetailHeader p={p}/>
          <DetailVideo p={p}/>
          <DetailFeatures p={p}/>
          <DetailDescription p={p}/>
          <DetailMap p={p}/>
        </div>
        <div style={{ position: 'sticky', top: 92 }}>
          <AgentCard agent={p.agent} price={p.price} tipo={p.tipo} onNav={onNav} property={p}/>
        </div>
      </div>
      {similar.length > 0 && (
        <section className="container" style={{ padding: '32px' }}>
          <SectionHead eyebrow="También te pueden interesar" title="Propiedades similares verificadas" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 22, marginTop: 28 }}>
            {similar.map(s => <PropertyCard key={s.id} p={s} onClick={() => onProperty(s)}/>)}
          </div>
        </section>
      )}
    </div>
  );
}

// Helpers de acciones compartidas por la ficha (Compartir / Guardar / Imprimir).
function _savedKey() { return 'alquiloya_guardados'; }
function _getSaved() {
  try { return JSON.parse(localStorage.getItem(_savedKey()) || '[]'); } catch { return []; }
}
function _isSaved(id) { return id ? _getSaved().includes(String(id)) : false; }
function _toggleSaved(id) {
  if (!id) return false;
  const cur = _getSaved();
  const sid = String(id);
  const next = cur.includes(sid) ? cur.filter(x => x !== sid) : [...cur, sid];
  try { localStorage.setItem(_savedKey(), JSON.stringify(next)); } catch {}
  return next.includes(sid);
}
async function _sharePropiedad(property) {
  // Construye un deep-link con ?prop=<id> al sitio publico, de modo que
  // al pegar el link el receptor abra la ficha directamente (en lugar
  // del home — el detalle no esta en la URL real porque el routing es
  // state-based de React).
  const propId = property && (property.apiId || property.id);
  const origin = (typeof window !== "undefined" && window.location && window.location.origin) || "https://alquiloya.com.py";
  const url = propId ? `${origin}/?prop=${encodeURIComponent(propId)}` : window.location.href;
  const title = (property && property.title) || 'Propiedad en AlquiloYa';
  const text = title + (property && property.address ? ' — ' + property.address : '');
  // Web Share API (mobile y navegadores modernos). Fallback: copiar al portapapeles.
  if (navigator.share) {
    try { await navigator.share({ title, text, url }); return; } catch { /* cancelado */ return; }
  }
  try {
    await navigator.clipboard.writeText(url);
    window.alert('Enlace copiado al portapapeles. ¡Compartilo donde quieras!');
  } catch {
    window.prompt('Copiá el enlace de la propiedad:', url);
  }
}

function Gallery({ photos = [], active, setActive, property }) {
  const [openFull, setOpenFull] = React.useState(false);
  const [zoomIdx, setZoomIdx] = React.useState(null);
  const [saved, setSaved] = React.useState(false);
  React.useEffect(() => { setSaved(_isSaved(property && (property.apiId || property.id))); }, [property]);
  const real = (Array.isArray(photos) ? photos : []).filter(Boolean);
  const totalExtra = Math.max(0, real.length - 5);
  return (
    <div className="container" style={{ padding: '8px 32px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '2.2fr 1fr 1fr', gridTemplateRows: '230px 230px', gap: 8, borderRadius: 16, overflow: 'hidden' }}>
        <Photo src={real[0]} onClick={() => real[0] && setZoomIdx(0)} style={{ gridRow: '1 / 3', borderRadius: 0, cursor: real[0] ? 'zoom-in' : 'default' }}/>
        <Photo src={real[1]} onClick={() => real[1] && setZoomIdx(1)} style={{ borderRadius: 0, cursor: real[1] ? 'zoom-in' : 'default' }}/>
        <Photo src={real[2]} onClick={() => real[2] && setZoomIdx(2)} style={{ borderRadius: 0, cursor: real[2] ? 'zoom-in' : 'default' }}/>
        <Photo src={real[3]} onClick={() => real[3] && setZoomIdx(3)} style={{ borderRadius: 0, cursor: real[3] ? 'zoom-in' : 'default' }}/>
        <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => (totalExtra > 0 ? setOpenFull(true) : real[4] ? setZoomIdx(4) : null)}>
          {/* La 5ta tile ya no repite la primera foto: si no hay 5ta real,
              queda el placeholder. El overlay "+N fotos" solo aparece si
              realmente hay fotos extra. */}
          <Photo src={real[4]} style={{ borderRadius: 0, height: '100%' }}/>
          {totalExtra > 0 && (
            <button onClick={(e) => { e.stopPropagation(); setOpenFull(true); }} style={{
              position: 'absolute', inset: 0, background: 'rgba(11,22,34,.55)', color: '#fff', border: 'none',
              fontFamily: 'Montserrat', fontWeight: 700, fontSize: 14, cursor: 'pointer'
            }}>+ {totalExtra} foto{totalExtra !== 1 ? 's' : ''}</button>
          )}
        </div>
      </div>
      <div className="row between" style={{ marginTop: 12 }}>
        <div className="row gap-8">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => _sharePropiedad(property)}><I.share s={14}/> Compartir</button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => setSaved(_toggleSaved(property && (property.apiId || property.id)))}
            style={saved ? { borderColor: 'var(--blue)', color: 'var(--blue)', background: 'var(--blue-50)' } : undefined}
          >
            <I.heart s={14}/> {saved ? 'Guardado' : 'Guardar'}
          </button>
        </div>
        <button onClick={() => setOpenFull(true)} className="btn btn-outline btn-sm">Ver galería completa <I.arrow s={14}/></button>
      </div>
      {openFull && <FullGalleryModal property={property} onClose={() => setOpenFull(false)} onZoom={(i) => { setOpenFull(false); setZoomIdx(i); }}/>}
      {zoomIdx != null && <ImageZoomModal photos={real} initialIndex={zoomIdx} onClose={() => setZoomIdx(null)}/>}
    </div>
  );
}

function ImageZoomModal({ photos, initialIndex = 0, onClose }) {
  const [index, setIndex] = React.useState(initialIndex);
  const [zoomed, setZoomed] = React.useState(false);
  const [pan, setPan] = React.useState({ x: 0, y: 0 });
  React.useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') setIndex(i => Math.min(photos.length - 1, i + 1));
      else if (e.key === 'ArrowLeft') setIndex(i => Math.max(0, i - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [photos.length]);
  React.useEffect(() => { setZoomed(false); setPan({ x: 0, y: 0 }); }, [index]);
  const src = photos[index];
  function toggleZoom() { setZoomed(z => !z); setPan({ x: 0, y: 0 }); }
  function onMouseMove(e) {
    if (!zoomed) return;
    const r = e.currentTarget.getBoundingClientRect();
    const dx = (e.clientX - r.left) / r.width - 0.5;
    const dy = (e.clientY - r.top) / r.height - 0.5;
    setPan({ x: -dx * r.width * 0.5, y: -dy * r.height * 0.5 });
  }
  return ReactDOM.createPortal(
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.92)', zIndex: 700,
      display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn .15s ease both',
    }}>
      <button onClick={(e) => { e.stopPropagation(); onClose(); }} title="Cerrar (Esc)" style={{
        position: 'absolute', top: 14, right: 14, background: 'rgba(255,255,255,.15)', color: '#fff',
        border: 'none', width: 40, height: 40, borderRadius: '50%', cursor: 'pointer',
        display: 'grid', placeItems: 'center', zIndex: 2,
      }}><I.x s={18}/></button>
      {photos.length > 1 && (
        <>
          <button onClick={(e) => { e.stopPropagation(); setIndex(i => Math.max(0, i - 1)); }}
            disabled={index === 0}
            style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
              background: 'rgba(255,255,255,.15)', color: '#fff', border: 'none', width: 48, height: 48,
              borderRadius: '50%', cursor: index === 0 ? 'default' : 'pointer', opacity: index === 0 ? .3 : 1,
              display: 'grid', placeItems: 'center', zIndex: 2, fontSize: 26, lineHeight: 1, fontFamily: 'inherit' }}>‹</button>
          <button onClick={(e) => { e.stopPropagation(); setIndex(i => Math.min(photos.length - 1, i + 1)); }}
            disabled={index === photos.length - 1}
            style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)',
              background: 'rgba(255,255,255,.15)', color: '#fff', border: 'none', width: 48, height: 48,
              borderRadius: '50%', cursor: index === photos.length - 1 ? 'default' : 'pointer', opacity: index === photos.length - 1 ? .3 : 1,
              display: 'grid', placeItems: 'center', zIndex: 2, fontSize: 26, lineHeight: 1, fontFamily: 'inherit' }}>›</button>
        </>
      )}
      <div onClick={(e) => e.stopPropagation()} style={{
        width: '94vw', height: '88vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt=""
          onClick={toggleZoom}
          onMouseMove={onMouseMove}
          draggable={false}
          style={{
            maxWidth: '100%', maxHeight: '100%', objectFit: 'contain',
            cursor: zoomed ? 'zoom-out' : 'zoom-in',
            transform: zoomed ? `scale(2) translate(${pan.x}px, ${pan.y}px)` : 'none',
            transition: zoomed ? 'transform .06s linear' : 'transform .15s ease',
            userSelect: 'none',
          }}/>
      </div>
      {photos.length > 1 && (
        <div style={{ position: 'absolute', bottom: 18, left: '50%', transform: 'translateX(-50%)',
          color: '#fff', background: 'rgba(0,0,0,.5)', padding: '6px 14px', borderRadius: 999, fontSize: 13 }}>
          {index + 1} / {photos.length}
        </div>
      )}
    </div>,
    document.body
  );
}

function FullGalleryModal({ property, onClose, onZoom }) {
  const [tab, setTab] = React.useState('fotos');
  const propId = property && (property.apiId || property.id);
  const [favorite, setFavorite] = React.useState(() => _isSaved(propId));
  // Solo fotos REALES. Antes se rellenaba con photo() mock hasta 12, asi que
  // una publicacion sin fotos (o con pocas) mostraba imagenes que no eran de
  // la propiedad. Si no hay fotos, mostramos un placeholder claro.
  const photos = (Array.isArray(property.photos) ? property.photos : []).filter(Boolean);

  React.useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, []);

  return ReactDOM.createPortal(
    <div style={{
      position: 'fixed', inset: 0, background: '#fff', zIndex: 500,
      display: 'flex', flexDirection: 'column', animation: 'fadeIn .2s ease both'
    }}>
      {/* Top bar */}
      <div className="row between" style={{ padding: '14px 28px', borderBottom: '1px solid var(--line-2)', flexShrink: 0 }}>
        <div className="row gap-4">
          {[
            ['fotos', 'Fotos'],
            ['mapa', 'Mapa'],
          ].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{
              padding: '10px 18px', borderRadius: 10, border: 'none',
              background: tab === id ? 'var(--yellow-50)' : 'transparent',
              color: tab === id ? 'var(--yellow-600)' : 'var(--ink-3)',
              fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit',
            }}>{label}</button>
          ))}
        </div>
        <div className="row gap-10">
          <button onClick={() => setFavorite(_toggleSaved(propId))} className="btn btn-outline btn-sm"
            style={{ padding: '8px 14px', ...(favorite ? { borderColor: 'var(--blue)', color: 'var(--blue)', background: 'var(--blue-50)' } : {}) }}>
            <I.heart s={14}/> {favorite ? 'Guardado' : 'Favorito'}
          </button>
          <button onClick={() => _sharePropiedad(property)} className="btn btn-outline btn-sm" style={{ padding: '8px 14px' }}>
            <I.share s={14}/> Compartir
          </button>
          <button onClick={onClose} style={{
            background: 'var(--bg-2)', border: 'none', width: 36, height: 36, borderRadius: 10,
            cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--ink-2)'
          }} title="Cerrar (Esc)">
            <I.x s={16}/>
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: 'auto', display: 'grid', gridTemplateColumns: '1fr 380px', gap: 0 }}>
        <div style={{ padding: '20px 28px', overflowY: 'auto' }}>
          {tab === 'fotos' && (
            photos.length === 0 ? (
              <div className="card" style={{ padding: 60, textAlign: 'center', minHeight: 360, display: 'grid', placeItems: 'center' }}>
                <div>
                  <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--bg-3)', color: 'var(--ink-4)', display: 'grid', placeItems: 'center', margin: '0 auto' }}>
                    <I.grid s={36}/>
                  </div>
                  <h3 style={{ fontSize: 18, marginTop: 18 }}>Sin fotos cargadas</h3>
                  <p className="muted" style={{ fontSize: 14, marginTop: 8, maxWidth: 380, margin: '8px auto 0' }}>
                    Esta publicación todavía no tiene fotos. Coordiná una visita por WhatsApp para conocer el inmueble.
                  </p>
                </div>
              </div>
            ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {photos.map((src, i) => (
                <div key={i} onClick={() => onZoom && onZoom(i)} style={{ position: 'relative', overflow: 'hidden', borderRadius: 10, aspectRatio: i === 0 ? '16 / 9' : '4 / 3', gridColumn: i === 0 ? '1 / 3' : 'auto', cursor: 'zoom-in' }}>
                  <Photo src={src} style={{ borderRadius: 0, height: '100%' }}/>
                  {i === 0 && property.title && (
                    <div style={{
                      position: 'absolute', bottom: 16, left: 16, padding: '8px 16px',
                      background: 'rgba(11,22,34,.7)', color: '#fff', borderRadius: 8,
                      fontFamily: 'Montserrat', fontWeight: 800, fontSize: 18
                    }}>
                      {formatGs(property.price)}
                    </div>
                  )}
                </div>
              ))}
            </div>
            )
          )}
          {tab === 'mapa' && (() => {
            const hasCoords = typeof property.lat === 'number' && typeof property.lng === 'number';
            const cityCentroid = !hasCoords ? CITY_COORDS[normalizeCity(property.ciudad)] : null;
            return (
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {hasCoords ? (
                  <LeafletReadOnlyMap lat={property.lat} lng={property.lng} height={520} zoom={17}/>
                ) : cityCentroid ? (
                  <LeafletReadOnlyMap lat={cityCentroid[0]} lng={cityCentroid[1]} height={520} approximate zoom={13} radius={1500}/>
                ) : (
                  <MiniMap height={520} pins={0}/>
                )}
                <div style={{ padding: 16, fontSize: 14 }}>
                  <div style={{ fontWeight: 700 }}><I.pin s={14}/> {property.address}</div>
                  <div className="muted xs" style={{ marginTop: 4 }}>
                    {[property.ciudad, property.depto].filter(Boolean).join(' · ')}
                    {!hasCoords ? ' — ubicación referencial de la zona' : ''}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Sidebar */}
        <div style={{ borderLeft: '1px solid var(--line-2)', padding: '20px 22px', background: 'var(--bg-2)', overflowY: 'auto' }}>
          <GalleryAgentSidebar property={property}/>
        </div>
      </div>
    </div>,
    document.body
  );
}

function GalleryAgentSidebar({ property }) {
  const { agents } = useAlquiloYaPublicData();
  // Mismo razonamiento que en AgentCard: si la propiedad no tiene agente real,
  // NO usar fallback al mock; mostramos propietario directo. Igual definimos
  // los hooks ANTES del early return para no romper las reglas de hooks.
  const agent = property.agent || null;
  const [phoneRevealed, setPhoneRevealed] = React.useState(false);
  const [form, setForm] = React.useState({ name: '', phone: '', email: '', message: 'Hola, vi esta propiedad en AlquiloYa y me interesa recibir más información. ¿Podría coordinar una visita?' });
  if (!agent) {
    return (
      <div>
        <div className="card" style={{ padding: 16, textAlign: 'center' }}>
          <div className="muted xs">Publicación de propietario directo.</div>
        </div>
      </div>
    );
  }
  const agentRecord = agents.find(a => a.id === agent.id || a.apiId === agent.id || a.name === agent.name);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const phone = agent.phone || agent.whatsapp || '';
  return (
    <div>
      <div className="card" style={{ padding: 16 }}>
        <div className="row gap-12">
          <Avatar name={agent.name} size={48}/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 15 }}>{agent.name}</div>
            <div className="row gap-4" style={{ color: 'var(--green)', fontSize: 12, fontWeight: 600, marginTop: 2 }}>
              <I.check s={11}/> {agent.type} verificado
            </div>
            <div className="row gap-4" style={{ color: 'var(--yellow-600)', marginTop: 4, fontSize: 12 }}>
              <I.star s={11}/> {agentRecord?.rating || 4.8} · {agentRecord?.reviews || 28} reseñas
            </div>
          </div>
        </div>
        <button onClick={() => setPhoneRevealed(true)} className="btn btn-outline" style={{ width: '100%', justifyContent: 'center', marginTop: 14, fontSize: 14 }}>
          <I.whats s={14}/> {phoneRevealed ? phone : ((phone || 'Sin telefono').slice(0, 10) + (phone ? '... Ver telefono' : ''))}
        </button>
      </div>

      <div className="card" style={{ padding: 16, marginTop: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Enviá tu consulta</div>
        <div className="col gap-10">
          <input className="input" placeholder="Nombre y Apellido *" value={form.name} onChange={(e) => set('name', e.target.value)}/>
          <div className="row gap-8">
            <div className="card" style={{ padding: '11px 12px', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <span style={{ fontSize: 16 }}>🇵🇾</span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>+595</span>
            </div>
            <input className="input" placeholder="Teléfono *" value={form.phone} onChange={(e) => set('phone', e.target.value)} style={{ flex: 1 }}/>
          </div>
          <input className="input" placeholder="Email *" value={form.email} onChange={(e) => set('email', e.target.value)}/>
          <textarea className="input" rows={4} value={form.message} onChange={(e) => set('message', e.target.value)}/>
          <div className="row gap-8" style={{ marginTop: 4 }}>
            <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M2 5.5C2 4.7 2.7 4 3.5 4h17c.8 0 1.5.7 1.5 1.5v13c0 .8-.7 1.5-1.5 1.5h-17c-.8 0-1.5-.7-1.5-1.5v-13zm2 .8L12 12l8-5.7V6H4v.3z"/></svg>
              Contactar
            </button>
            <button className="btn btn-blue" style={{ width: 44, padding: 0, justifyContent: 'center' }} title="Llamar">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.8a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.35 1.84.59 2.8.72a2 2 0 0 1 1.72 2.01z"/></svg>
            </button>
            <button className="btn btn-wa" style={{ width: 44, padding: 0, justifyContent: 'center' }} title="WhatsApp">
              <I.whats s={16}/>
            </button>
          </div>
        </div>
      </div>

      {agentRecord && (
        <div className="card" style={{ padding: 16, marginTop: 12, textAlign: 'center' }}>
          <div className="muted xs" style={{ marginBottom: 6 }}>Conocé más sobre este agente</div>
          <button className="btn btn-outline btn-sm" style={{ width: '100%', justifyContent: 'center' }}
            onClick={() => { window.location.hash = '#agent/' + agentRecord.slug; }}>
            Ver perfil público →
          </button>
        </div>
      )}
    </div>
  );
}

function DetailHeader({ p }) {
  return (
    <div>
      <div className="row gap-8" style={{ marginBottom: 12 }}>
        {p.verified && <span className="badge badge-verified"><I.check s={11}/> Verificado por AlquiloYa</span>}
        {p.featured && <span className="badge badge-featured"><I.star s={11}/> Destacado</span>}
        {p.tipo === 'temporal' && <span className="badge badge-temporal">Temporal</span>}
        {p.isNew && <span className="badge badge-new">Nuevo</span>}
      </div>
      <h2 style={{ fontSize: 32, lineHeight: 1.2 }}>{p.title}</h2>
      <div className="row gap-12 muted" style={{ marginTop: 10, fontSize: 14 }}>
        <span className="row gap-4"><I.pin s={14}/> {p.barrio}, {p.ciudad}, {p.depto}</span>
      </div>
      <div className="row between" style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--line-2)' }}>
        <div>
          <div style={{ fontFamily: 'Montserrat', fontWeight: 900, fontSize: 36, color: 'var(--blue)', lineHeight: 1 }}>
            {formatGs(p.price)}
          </div>
          <div style={{ fontSize: 14, color: 'var(--ink-3)', marginTop: 6 }}>
            {p.tipo === 'temporal' ? 'por noche · estadía mínima 2 noches' : 'mensual · expensas no incluidas'}
          </div>
        </div>
        <div className="row gap-8">
          <div className="card-soft" style={{ padding: '12px 16px', borderRadius: 12, textAlign: 'center' }}>
            <div className="muted xs">Comisión inicial</div>
            <div style={{ fontFamily: 'Montserrat', fontWeight: 700, fontSize: 14 }}>1 mes</div>
          </div>
          <div className="card-soft" style={{ padding: '12px 16px', borderRadius: 12, textAlign: 'center' }}>
            <div className="muted xs">Depósito</div>
            <div style={{ fontFamily: 'Montserrat', fontWeight: 700, fontSize: 14 }}>1 mes</div>
          </div>
        </div>
      </div>
    </div>
  );
}


// Reproductor de video embebido. Soporta:
//   - YouTube (watch?v=ID, youtu.be/ID, /shorts/ID, /embed/ID)
//   - Vimeo (vimeo.com/ID o player.vimeo.com/video/ID)
//   - URL directa de mp4/webm/mov (renderiza con <video controls>)
// Solo aparece si la propiedad tiene video_url (los planes que no permiten
// videos directamente no lo guardan, asi que el filtro lo da el back).
function DetailVideo({ p }) {
  const url = p && p.video_url ? String(p.video_url).trim() : '';
  if (!url) return null;
  let embedUrl = null;
  let isFile = false;
  // YouTube
  let m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/)|youtu\.be\/)([\w-]{6,})/);
  if (m) {
    embedUrl = 'https://www.youtube.com/embed/' + m[1];
  } else {
    // Vimeo
    m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (m) {
      embedUrl = 'https://player.vimeo.com/video/' + m[1];
    } else if (/\.(mp4|webm|mov|m4v)(\?|$)/i.test(url)) {
      isFile = true;
    } else {
      // Fallback: link plano "Ver video"
      return (
        <div className="card" style={{ padding: 16, marginTop: 16 }}>
          <h3 style={{ fontSize: 16, marginBottom: 8 }}>📹 Video del inmueble</h3>
          <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-blue">Ver video →</a>
        </div>
      );
    }
  }
  return (
    <div className="card" style={{ padding: 16, marginTop: 16 }}>
      <h3 style={{ fontSize: 16, marginBottom: 10 }}>📹 Video del inmueble</h3>
      <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: 12, background: '#000' }}>
        {isFile ? (
          <video
            src={url}
            controls
            playsInline
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
          />
        ) : (
          <iframe
            src={embedUrl}
            title="Video del inmueble"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
          />
        )}
      </div>
    </div>
  );
}

function DetailFeatures({ p }) {
  const feats = [
    { icon: 'bed', label: 'Dormitorios', val: p.beds || '—' },
    { icon: 'bath', label: 'Baños', val: p.baths },
    { icon: 'ruler', label: 'Superficie', val: p.m2 + ' m²' },
    { icon: 'car', label: 'Cochera', val: p.cochera ? 'Sí' : 'No' },
    { icon: 'sofa', label: 'Amoblado', val: p.amoblado ? 'Sí' : 'No' },
    { icon: 'paw', label: 'Mascotas', val: p.mascotas ? 'Permitidas' : 'No' },
  ];
  return (
    <div className="card" style={{ padding: 24, marginTop: 24 }}>
      <h3 style={{ fontSize: 18 }}>Características principales</h3>
      <div className="prop-features-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 16, marginTop: 18 }}>
        {feats.map(f => (
          <div key={f.label} className="prop-feature col gap-4">
            <div className="prop-feature-icon" style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--blue-50)', color: 'var(--blue)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              {React.createElement(I[f.icon], { s: 18 })}
            </div>
            <div className="prop-feature-text" style={{ minWidth: 0 }}>
              <div className="muted xs prop-feature-label" style={{ marginTop: 6 }}>{f.label}</div>
              <div className="prop-feature-value" style={{ fontWeight: 700, fontSize: 14 }}>{f.val}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailDescription({ p }) {
  const features = Array.isArray(p.features) ? p.features : [];
  return (
    <div className="card" style={{ padding: 24, marginTop: 16 }}>
      <h3 style={{ fontSize: 18 }}>Descripción</h3>
      {p.desc ? (
        <p style={{ marginTop: 12, fontSize: 14.5, lineHeight: 1.7, color: 'var(--ink-2)', whiteSpace: 'pre-line' }}>
          {p.desc}
        </p>
      ) : null}
      <p style={{ marginTop: 12, fontSize: 14.5, lineHeight: 1.7, color: 'var(--ink-2)' }}>
        La propiedad cuenta con {p.beds} dormitorios, {p.baths} baños, {p.m2} m² cubiertos
        {p.cochera ? ', cochera privada' : ''} y todos los servicios básicos. Disponible desde el 1 de junio.
      </p>
      <div style={{ marginTop: 18 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Servicios y comodidades</div>
        <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
          {features.map(f => (
            <span key={f} className="pill" style={{ background: 'var(--bg-2)', border: '1px solid var(--line-2)' }}>
              <I.check s={12}/> {f}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function DetailMap({ p }) {
  const hasCoords = typeof p.lat === 'number' && typeof p.lng === 'number';
  // Fallback para publicaciones sin coords exactas: centramos en la ciudad.
  const cityCentroid = !hasCoords ? CITY_COORDS[normalizeCity(p.ciudad)] : null;
  const ubic = [p.barrio, p.ciudad].filter(Boolean).join(', ');
  return (
    <div className="card" style={{ padding: 0, marginTop: 16, overflow: 'hidden' }}>
      <div style={{ padding: '20px 24px 16px' }}>
        <h3 style={{ fontSize: 18 }}>Ubicación</h3>
        <div className="muted" style={{ marginTop: 6, fontSize: 14 }}>
          <I.pin s={14}/> {ubic || 'Ubicación'} — {hasCoords ? 'ubicación exacta del inmueble.' : 'ubicación referencial de la zona; la dirección exacta se comparte tras coordinar visita.'}
        </div>
      </div>
      {hasCoords ? (
        <LeafletReadOnlyMap lat={p.lat} lng={p.lng} height={280}/>
      ) : cityCentroid ? (
        // Zona de la ciudad (zoom bajo + circulo amplio): no es la direccion
        // exacta, pero muestra el area correcta en vez de un mapa cualquiera.
        <LeafletReadOnlyMap lat={cityCentroid[0]} lng={cityCentroid[1]} height={280} approximate zoom={13} radius={1500}/>
      ) : (
        <MiniMap height={280} pins={0}/>
      )}
    </div>
  );
}

// Mapa real (read-only) usando Leaflet via CDN. Si approximate=true, en lugar de un
// pin exacto dibuja un circulo de ~250m de radio (para no exponer la direccion exacta).
function LeafletReadOnlyMap({ lat, lng, height = 280, approximate = false, zoom = 15, radius = 250 }) {
  const ref = React.useRef(null);
  const mapRef = React.useRef(null);
  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.L) return;
    if (!ref.current || mapRef.current) return;
    const L = window.L;
    const m = L.map(ref.current, { scrollWheelZoom: false }).setView([lat, lng], zoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
    }).addTo(m);
    if (approximate) {
      L.circle([lat, lng], {
        radius,
        color: '#0058A5',
        weight: 2,
        fillColor: '#0058A5',
        fillOpacity: 0.18,
      }).addTo(m);
    } else {
      L.marker([lat, lng]).addTo(m);
    }
    mapRef.current = m;
    // Si el contenedor se dimensiona despues del montaje (modales, tabs,
    // brochure), Leaflet puede quedar gris hasta un resize. invalidateSize
    // fuerza el recalculo de tiles.
    const t1 = setTimeout(() => { try { m.invalidateSize(); } catch {} }, 120);
    const t2 = setTimeout(() => { try { m.invalidateSize(); } catch {} }, 450);
    return () => { clearTimeout(t1); clearTimeout(t2); try { m.remove(); } catch {} mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, zoom, radius]);
  return <div ref={ref} style={{ height, width: '100%', background: 'var(--bg-2)' }}/>;
}

// Centroides aproximados de ciudades de Paraguay. Se usan como FALLBACK cuando
// una propiedad no tiene lat/lng exactas (ej. publicaciones viejas creadas
// antes del fix del guardado de coordenadas). Asi mostramos al menos la zona
// correcta de la ciudad en vez de un mapa generico que no tiene nada que ver.
const CITY_COORDS = {
  'asuncion': [-25.2987, -57.6359],
  'fernando de la mora': [-25.3333, -57.5333],
  'san lorenzo': [-25.3397, -57.5089],
  'luque': [-25.2667, -57.4872],
  'lambare': [-25.3506, -57.6064],
  'capiata': [-25.3556, -57.4456],
  'nemby': [-25.3953, -57.5358],
  'mariano roque alonso': [-25.2050, -57.5325],
  'villa elisa': [-25.3639, -57.5944],
  'itaugua': [-25.3925, -57.3539],
  'aregua': [-25.3056, -57.3850],
  'limpio': [-25.1681, -57.4914],
  'ciudad del este': [-25.5097, -54.6111],
  'encarnacion': [-27.3306, -55.8667],
  'pedro juan caballero': [-22.5470, -55.7333],
  'caaguazu': [-25.4661, -56.0144],
  'coronel oviedo': [-25.4467, -56.4406],
  'villarrica': [-25.7500, -56.4333],
  'concepcion': [-23.4064, -57.4344],
  'pilar': [-26.8597, -58.2906],
};
function normalizeCity(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

function DetailQR({ p }) {
  return (
    <div className="card" style={{ padding: 24, marginTop: 16, background: 'linear-gradient(120deg, var(--blue-50), #fff)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 24, alignItems: 'center' }}>
        <div style={{ padding: 8, background: '#fff', border: '2px solid var(--ink)', borderRadius: 10 }}>
          <QRMock size={120} id={p.id}/>
        </div>
        <div>
          <div className="tag">Cartel QR del inmueble</div>
          <h3 style={{ marginTop: 6, fontSize: 20 }}>Escaneá este código para abrir el inmueble</h3>
          <p style={{ marginTop: 8, fontSize: 14, color: 'var(--ink-2)' }}>
            ID <span className="mono" style={{ fontWeight: 600 }}>{p.id}</span> · Compartilo con un cliente, imprimilo en el cartel o pegalo en la fachada.
          </p>
          <div className="row gap-8" style={{ marginTop: 14 }}>
            <button className="btn btn-blue btn-sm"><I.download s={14}/> Descargar cartel</button>
            <button className="btn btn-outline btn-sm"><I.share s={14}/> Compartir enlace</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AgentCard({ agent, price, tipo, onNav, property }) {
  // Antes este handler creaba una fila en alquiloya.consultas al tocar
  // WhatsApp/Mensaje, pero sin datos del visitante. El agente las recibia
  // como 'Interesado anonimo' sin manera de responder. Karen pidio limpiarlo.
  // El click abre wa.me directamente — el agente ve el mensaje real en
  // WhatsApp, no necesitamos duplicar una fila vacia.
  function registerConsulta(_canal) {
    // noop intencional. Si en el futuro queremos un formulario propio
    // (nombre + telefono/email obligatorios), va a llamarse desde otro
    // handler — no desde el click directo a WhatsApp.
  }
  function onClickWhatsApp() {
    registerConsulta('whatsapp');
    // Prioridad: whatsapp/telefono del agente → contacto efectivo del backend
    // (agente o propietario directo). Asi el boton siempre lleva al numero real
    // del responsable de la publicacion.
    const raw = agent?.whatsapp || agent?.telefono
      || property?.contacto?.whatsapp || property?.contacto?.telefono || '';
    let phone = String(raw).replace(/\D/g, '');
    // Normalizamos a formato internacional Paraguay si vino local (09xx...).
    if (phone && !phone.startsWith('595')) {
      if (phone.startsWith('0')) phone = '595' + phone.slice(1);
      else if (phone.length <= 10) phone = '595' + phone;
    }
    const msg = encodeURIComponent('Hola! Me interesa la propiedad "' + (property?.title || '') + '" en ' + (property?.address || property?.ciudad || ''));
    const url = phone ? ('https://wa.me/' + phone + '?text=' + msg) : ('https://wa.me/?text=' + msg);
    window.open(url, '_blank', 'noopener');
  }
  function onClickVisita() {
    registerConsulta('web');
    onClickWhatsApp();
  }
  function onClickMensaje() { registerConsulta('web'); onClickWhatsApp(); }
  const { agents } = useAlquiloYaPublicData();
  // Antes el card caia a `agents[0] || AGENTS[0]` cuando la propiedad no tenia
  // agente, lo que pegaba "Mariana López" (primera de la lista mock) a
  // cualquier publicacion sin agente_id. Ahora si no hay agente real,
  // renderizamos un card "Propietario directo" sin datos inventados.
  const hasRealAgent = !!agent;
  const agentRecord = hasRealAgent
    ? agents.find(a => a.id === agent.id || a.apiId === agent.id || a.name === agent.name)
    : null;
  // Stats del agente: si tenemos el agentRecord real, leemos sus contadores;
  // si no, mostramos guiones para no inventar datos. Antes eran 3 strings
  // hardcodeados ("~ 12 min", "14", "Ene. 2024") que aparecian para todos.
  const agentSince = agentRecord?.createdAt || agentRecord?.created_at || null;
  const sinceLabel = agentSince
    ? new Date(agentSince).toLocaleDateString('es-PY', { month: 'short', year: 'numeric' })
    : '—';
  const propsCountLabel = agentRecord?.propertiesCount != null
    ? String(agentRecord.propertiesCount)
    : (agentRecord?.propiedades_count != null ? String(agentRecord.propiedades_count) : '—');
  const responseLabel = agentRecord?.tiempo_respuesta || agentRecord?.responseTime || '—';
  const ratingLabel = agentRecord?.rating != null ? agentRecord.rating : '—';
  const reviewsLabel = agentRecord?.reviews != null ? agentRecord.reviews : 0;
  const openProfile = () => agentRecord && onNav && onNav('agent/' + agentRecord.slug);
  if (!hasRealAgent) {
    return (
      <div className="card" style={{ padding: 22 }}>
        <div className="row gap-12" style={{ alignItems: 'center' }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            background: 'rgba(0,88,165,0.08)', color: 'var(--blue)',
            display: 'grid', placeItems: 'center'
          }}>
            <I.user s={22}/>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Propietario directo</div>
            <div className="muted xs">Publicación sin agente intermediario</div>
          </div>
        </div>
        <div className="col gap-10" style={{ marginTop: 16 }}>
          <button type="button" className="btn btn-wa btn-lg" style={{ justifyContent: 'center' }} onClick={onClickWhatsApp}><I.whats s={18}/> Consultar por WhatsApp</button>
        </div>
        <div style={{ marginTop: 16, padding: 12, background: 'var(--yellow-50)', borderRadius: 10, fontSize: 12.5, color: '#8a5e00', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <I.shield s={14}/>
          <span>Tu contacto va directo al propietario. AlquiloYa no cobra comisión por cierre.</span>
        </div>
        {tipo === 'temporal' && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--line-2)' }}>
            <div className="muted xs">Disponibilidad temporal</div>
            <button className="btn btn-primary" style={{ justifyContent: 'center', width: '100%', marginTop: 8 }}>
              Ver calendario y reservar <I.arrow s={14}/>
            </button>
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="card" style={{ padding: 22 }}>
      <div className="row gap-12">
        <Avatar name={agent.name} size={48}/>
        <div style={{ flex: 1 }}>
          <div className="row gap-6">
            <div style={{ fontWeight: 700, fontSize: 15 }}>{agent.name}</div>
            {agent.verified && <span className="badge badge-verified" style={{ padding: '2px 6px', fontSize: 10 }}><I.check s={9}/></span>}
          </div>
          <div className="muted xs">{agent.type} verificado</div>
          <div className="row gap-4" style={{ color: 'var(--yellow)', marginTop: 4 }}>
            {[1,2,3,4,5].map(i => <I.star key={i} s={10}/>)}
            <span style={{ fontSize: 11, color: 'var(--ink-3)', marginLeft: 4 }}>{ratingLabel} · {reviewsLabel} reseñas</span>
          </div>
          {agentRecord && (
            <button onClick={openProfile} style={{ background: 'none', border: 'none', padding: 0, marginTop: 6, color: 'var(--blue)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
              Ver perfil público →
            </button>
          )}
        </div>
      </div>
      <div className="card-soft" style={{ padding: 14, marginTop: 16, fontSize: 13 }}>
        <div className="row between"><span className="muted">Tiempo medio de respuesta</span><strong>{responseLabel}</strong></div>
        <div className="row between" style={{ marginTop: 4 }}><span className="muted">Inmuebles publicados</span><strong>{propsCountLabel}</strong></div>
        <div className="row between" style={{ marginTop: 4 }}><span className="muted">Miembro desde</span><strong>{sinceLabel}</strong></div>
      </div>
      <div className="col gap-10" style={{ marginTop: 16 }}>
        <button type="button" className="btn btn-wa btn-lg" style={{ justifyContent: 'center' }} onClick={onClickWhatsApp}><I.whats s={18}/> Consultar por WhatsApp</button>
      </div>
      <div style={{ marginTop: 16, padding: 12, background: 'var(--yellow-50)', borderRadius: 10, fontSize: 12.5, color: '#8a5e00', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <I.shield s={14}/>
        <span>Tu contacto va directo al {agent.type.toLowerCase()}. AlquiloYa no cobra comisión por cierre.</span>
      </div>
      {tipo === 'temporal' && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--line-2)' }}>
          <div className="muted xs">Disponibilidad temporal</div>
          <button className="btn btn-primary" style={{ justifyContent: 'center', width: '100%', marginTop: 8 }}>
            Ver calendario y reservar <I.arrow s={14}/>
          </button>
        </div>
      )}
    </div>
  );
}

// Exportamos tambien el mapa read-only y el lookup de ciudades para que el
// brochure (publish.jsx, cargado despues) pueda mostrar la ubicacion real.
Object.assign(window, { DetailPage, LeafletReadOnlyMap, CITY_COORDS, normalizeCity });
