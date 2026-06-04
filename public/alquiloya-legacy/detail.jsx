// Detalle de inmueble

function DetailPage({ p, onProperty, onNav }) {
  const [active, setActive] = React.useState(0);
  const { properties } = useAlquiloYaPublicData();
  const baseProperty = p || properties[0] || PROPERTIES[0];
  const apiProperty = useAlquiloYaPublicProperty(baseProperty?.id);
  p = apiProperty || baseProperty;
  const similar = properties.filter(x => x.id !== p.id && x.tipo === p.tipo).slice(0, 3);
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
          <DetailFeatures p={p}/>
          <DetailDescription p={p}/>
          <DetailMap p={p}/>
        </div>
        <div style={{ position: 'sticky', top: 92 }}>
          <AgentCard agent={p.agent} price={p.price} tipo={p.tipo} onNav={onNav}/>
        </div>
      </div>
      <section className="container" style={{ padding: '32px' }}>
        <SectionHead eyebrow="También te pueden interesar" title="Propiedades similares" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 22, marginTop: 28 }}>
          {similar.map(s => <PropertyCard key={s.id} p={s} onClick={() => onProperty(s)}/>)}
        </div>
      </section>
    </div>
  );
}

function Gallery({ photos = [], active, setActive, property }) {
  const [openFull, setOpenFull] = React.useState(false);
  const totalExtra = Math.max(0, (photos.length || 0) - 4);
  return (
    <div className="container" style={{ padding: '8px 32px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '2.2fr 1fr 1fr', gridTemplateRows: '230px 230px', gap: 8, borderRadius: 16, overflow: 'hidden' }}>
        <Photo src={photos[0]} style={{ gridRow: '1 / 3', borderRadius: 0, cursor: 'pointer' }}/>
        <Photo src={photos[1]} style={{ borderRadius: 0, cursor: 'pointer' }}/>
        <Photo src={photos[2]} style={{ borderRadius: 0, cursor: 'pointer' }}/>
        <Photo src={photos[3]} style={{ borderRadius: 0, cursor: 'pointer' }}/>
        <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => setOpenFull(true)}>
          <Photo src={photos[4] || photos[0]} style={{ borderRadius: 0, height: '100%' }}/>
          <button onClick={() => setOpenFull(true)} style={{
            position: 'absolute', inset: 0, background: 'rgba(11,22,34,.55)', color: '#fff', border: 'none',
            fontFamily: 'Montserrat', fontWeight: 700, fontSize: 14, cursor: 'pointer'
          }}>+ {Math.max(totalExtra, 12)} fotos</button>
        </div>
      </div>
      <div className="row between" style={{ marginTop: 12 }}>
        <div className="row gap-8">
          <button className="btn btn-outline btn-sm"><I.share s={14}/> Compartir</button>
          <button className="btn btn-outline btn-sm"><I.heart s={14}/> Guardar</button>
          <button className="btn btn-outline btn-sm"><I.print s={14}/> Imprimir ficha</button>
        </div>
        <button onClick={() => setOpenFull(true)} className="btn btn-outline btn-sm">Ver galería completa <I.arrow s={14}/></button>
      </div>
      {openFull && <FullGalleryModal property={property} onClose={() => setOpenFull(false)}/>}
    </div>
  );
}

function FullGalleryModal({ property, onClose }) {
  const [tab, setTab] = React.useState('fotos');
  const [favorite, setFavorite] = React.useState(false);
  // Generate extra photos to fill the grid
  const basePhotos = Array.isArray(property.photos) ? property.photos : [];
  const photos = basePhotos.length >= 12
    ? basePhotos
    : [...basePhotos, ...Array.from({ length: 12 - basePhotos.length }, (_, i) => photo(i * 4 + 3))];

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
            ['street', 'Street View'],
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
          <button onClick={() => setFavorite(f => !f)} className="btn btn-outline btn-sm" style={{ padding: '8px 14px' }}>
            <I.heart s={14}/> {favorite ? 'Guardado' : 'Favorito'}
          </button>
          <button className="btn btn-outline btn-sm" style={{ padding: '8px 14px' }}>
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {photos.map((src, i) => (
                <div key={i} style={{ position: 'relative', overflow: 'hidden', borderRadius: 10, aspectRatio: i === 0 ? '16 / 9' : '4 / 3', gridColumn: i === 0 ? '1 / 3' : 'auto' }}>
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
          )}
          {tab === 'mapa' && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {(typeof property.lat === 'number' && typeof property.lng === 'number') ? (
                <LeafletReadOnlyMap lat={property.lat} lng={property.lng} height={520} approximate/>
              ) : (
                <MiniMap height={520}/>
              )}
              <div style={{ padding: 16, fontSize: 14 }}>
                <div style={{ fontWeight: 700 }}><I.pin s={14}/> {property.address}</div>
                <div className="muted xs" style={{ marginTop: 4 }}>{property.ciudad} · {property.depto}</div>
              </div>
            </div>
          )}
          {tab === 'street' && (
            <div className="card" style={{ padding: 60, textAlign: 'center', minHeight: 480 }}>
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--blue-50)', color: 'var(--blue)', display: 'grid', placeItems: 'center', margin: '0 auto' }}>
                <I.pin s={36}/>
              </div>
              <h3 style={{ fontSize: 20, marginTop: 18 }}>Street View próximamente</h3>
              <p className="muted" style={{ fontSize: 14, marginTop: 8, maxWidth: 380, margin: '8px auto 0' }}>
                Estamos integrando Google Street View para que puedas explorar la cuadra antes de visitar.
              </p>
            </div>
          )}
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
  const agent = property.agent || agents[0] || AGENTS[0];
  const agentRecord = agents.find(a => a.id === agent.id || a.apiId === agent.id || a.name === agent.name);
  const [phoneRevealed, setPhoneRevealed] = React.useState(false);
  const [form, setForm] = React.useState({ name: '', phone: '', email: '', message: 'Hola, vi esta propiedad en AlquiloYa y me interesa recibir más información. ¿Podría coordinar una visita?' });
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
        <span>·</span>
        <span className="mono">{p.id}</span>
        <span>·</span>
        <span className="row gap-4"><I.eye s={14}/> 248 visitas esta semana</span>
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 16, marginTop: 18 }}>
        {feats.map(f => (
          <div key={f.label} className="col gap-4">
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--blue-50)', color: 'var(--blue)', display: 'grid', placeItems: 'center' }}>
              {React.createElement(I[f.icon], { s: 18 })}
            </div>
            <div className="muted xs" style={{ marginTop: 6 }}>{f.label}</div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{f.val}</div>
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
      <p style={{ marginTop: 12, fontSize: 14.5, lineHeight: 1.7, color: 'var(--ink-2)' }}>
        {p.desc} La propiedad cuenta con {p.beds} dormitorios, {p.baths} baños, {p.m2} m² cubiertos
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
  return (
    <div className="card" style={{ padding: 0, marginTop: 16, overflow: 'hidden' }}>
      <div style={{ padding: '20px 24px 16px' }}>
        <h3 style={{ fontSize: 18 }}>Ubicación</h3>
        <div className="muted" style={{ marginTop: 6, fontSize: 14 }}>
          <I.pin s={14}/> {p.barrio}, {p.ciudad} — la ubicación exacta se comparte tras coordinar visita.
        </div>
      </div>
      {hasCoords ? (
        <LeafletReadOnlyMap lat={p.lat} lng={p.lng} height={280} approximate/>
      ) : (
        <MiniMap height={280} pins={1}/>
      )}
    </div>
  );
}

// Mapa real (read-only) usando Leaflet via CDN. Si approximate=true, en lugar de un
// pin exacto dibuja un circulo de ~250m de radio (para no exponer la direccion exacta).
function LeafletReadOnlyMap({ lat, lng, height = 280, approximate = false }) {
  const ref = React.useRef(null);
  const mapRef = React.useRef(null);
  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.L) return;
    if (!ref.current || mapRef.current) return;
    const L = window.L;
    const m = L.map(ref.current, { scrollWheelZoom: false }).setView([lat, lng], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
    }).addTo(m);
    if (approximate) {
      L.circle([lat, lng], {
        radius: 250,
        color: '#0058A5',
        weight: 2,
        fillColor: '#0058A5',
        fillOpacity: 0.18,
      }).addTo(m);
    } else {
      L.marker([lat, lng]).addTo(m);
    }
    mapRef.current = m;
    return () => { try { m.remove(); } catch {} mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng]);
  return <div ref={ref} style={{ height, width: '100%', background: 'var(--bg-2)' }}/>;
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

function AgentCard({ agent, price, tipo, onNav }) {
  const { agents } = useAlquiloYaPublicData();
  agent = agent || agents[0] || AGENTS[0];
  const agentRecord = agents.find(a => a.id === agent.id || a.apiId === agent.id || a.name === agent.name);
  const openProfile = () => agentRecord && onNav && onNav('agent/' + agentRecord.slug);
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
            <span style={{ fontSize: 11, color: 'var(--ink-3)', marginLeft: 4 }}>{agentRecord ? agentRecord.rating : 4.9} · {agentRecord ? agentRecord.reviews : 28} reseñas</span>
          </div>
          {agentRecord && (
            <button onClick={openProfile} style={{ background: 'none', border: 'none', padding: 0, marginTop: 6, color: 'var(--blue)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
              Ver perfil público →
            </button>
          )}
        </div>
      </div>
      <div className="card-soft" style={{ padding: 14, marginTop: 16, fontSize: 13 }}>
        <div className="row between"><span className="muted">Tiempo medio de respuesta</span><strong>~ 12 min</strong></div>
        <div className="row between" style={{ marginTop: 4 }}><span className="muted">Inmuebles publicados</span><strong>14</strong></div>
        <div className="row between" style={{ marginTop: 4 }}><span className="muted">Miembro desde</span><strong>Ene. 2024</strong></div>
      </div>
      <div className="col gap-10" style={{ marginTop: 16 }}>
        <button className="btn btn-wa btn-lg" style={{ justifyContent: 'center' }}><I.whats s={18}/> Consultar por WhatsApp</button>
        <button className="btn btn-blue" style={{ justifyContent: 'center' }}><I.cal s={16}/> Solicitar visita</button>
        <button className="btn btn-outline" style={{ justifyContent: 'center' }}><I.chat s={16}/> Enviar mensaje</button>
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

Object.assign(window, { DetailPage });
