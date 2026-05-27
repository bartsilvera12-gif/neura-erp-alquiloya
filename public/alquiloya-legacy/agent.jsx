// Perfil público de agente — visible para cualquier visitante

function AgentProfilePage({ slug, onNav, onProperty }) {
  const { agents, properties } = useAlquiloYaPublicData();
  const baseAgent = agents.find(a => a.slug === slug || a.id === slug || a.apiId === slug) || agents[0] || AGENTS[0];
  const apiAgent = useAlquiloYaPublicAgent(baseAgent?.id);
  const agent = apiAgent || baseAgent;
  const [tab, setTab] = React.useState('propiedades');
  const props = (agent.propiedades && agent.propiedades.length
    ? agent.propiedades
    : properties.filter(p => p.agent?.id === agent.id || p.agent?.apiId === agent.id || p.agent?.name === agent.name)
  ).slice(0, 9);
  const firstName = agent.name.split(' ')[0];

  return (
    <div className="fade-in" style={{ background: 'var(--bg-2)', minHeight: '100vh' }}>
      {/* Cover band */}
      <div style={{ position: 'relative', height: 220, overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url(${photo((agent.avatar || 0) + 6)})`,
          backgroundSize: 'cover', backgroundPosition: 'center',
          filter: 'blur(2px) brightness(.55)', transform: 'scale(1.05)',
        }}/>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(11,22,34,.2) 0%, rgba(11,22,34,.55) 100%)' }}/>
        <div className="container" style={{ position: 'relative', height: '100%', display: 'flex', alignItems: 'flex-start', paddingTop: 22 }}>
          <button onClick={() => onNav('home')} style={{
            background: 'rgba(255,255,255,.18)', color: '#fff', border: '1px solid rgba(255,255,255,.25)',
            padding: '7px 14px', borderRadius: 999, cursor: 'pointer', fontSize: 12.5, fontWeight: 600,
            fontFamily: 'inherit', backdropFilter: 'blur(6px)'
          }}>← Volver</button>
        </div>
      </div>

      {/* Profile card overlapping the cover */}
      <div className="container" style={{ marginTop: -96, position: 'relative', zIndex: 2 }}>
        <div className="card" style={{ padding: 26, display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 26, alignItems: 'flex-start' }}>
          <div style={{ position: 'relative' }}>
            <Avatar name={agent.name} size={108}/>
            {agent.verified && (
              <span style={{
                position: 'absolute', bottom: 4, right: 4,
                width: 28, height: 28, borderRadius: '50%',
                background: 'var(--blue)', color: '#fff',
                border: '3px solid #fff', display: 'grid', placeItems: 'center'
              }}>
                <I.check s={12}/>
              </span>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="row gap-8" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: 28, lineHeight: 1.1, letterSpacing: '-.015em' }}>{agent.name}</h1>
              <AgentLevelBadgeNew level={agent.level}/>
            </div>
            <div className="row gap-10" style={{ marginTop: 6, fontSize: 13.5, color: 'var(--ink-3)', flexWrap: 'wrap' }}>
              <span>{agent.type}</span>
              <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--ink-4)' }}/>
              <span className="row gap-4"><I.pin s={12}/> {agent.zone}</span>
              <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--ink-4)' }}/>
              <span>Activa desde {agent.joinedYear}</span>
            </div>

            <div className="row gap-6" style={{ marginTop: 12, fontSize: 13.5, alignItems: 'center', color: 'var(--ink-2)' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--yellow-600)' }}>
                <I.star s={14}/> <strong style={{ color: 'var(--ink)' }}>{agent.rating}</strong>
              </span>
              <span style={{ color: 'var(--ink-4)' }}>· {agent.reviews} reseñas</span>
              <span style={{ color: 'var(--ink-4)', margin: '0 4px' }}>·</span>
              <strong style={{ color: 'var(--ink)' }}>{agent.activeProperties}</strong>
              <span style={{ color: 'var(--ink-3)' }}>activas</span>
              <span style={{ color: 'var(--ink-4)', margin: '0 4px' }}>·</span>
              <strong style={{ color: 'var(--ink)' }}>{agent.closedRentals}</strong>
              <span style={{ color: 'var(--ink-3)' }}>cerradas</span>
            </div>

            <p style={{ marginTop: 14, fontSize: 14, lineHeight: 1.6, color: 'var(--ink-2)', maxWidth: 640 }}>{agent.bio}</p>
          </div>
          <div className="col gap-8" style={{ alignItems: 'stretch', minWidth: 220 }}>
            <button className="btn btn-wa" style={{ justifyContent: 'center' }}><I.whats s={14}/> WhatsApp</button>
            <button className="btn btn-blue" style={{ justifyContent: 'center' }}>Ver inmuebles ({agent.activeProperties})</button>
            <button className="btn btn-outline btn-sm" style={{ justifyContent: 'center' }}><I.share s={13}/> Compartir perfil</button>
          </div>
        </div>

        {/* Mini stats row (slim secondary) */}
        <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {[
            { label: 'Tiempo medio respuesta', value: '~ 12 min',  hint: 'horario hábil' },
            { label: 'Cierres en últimos 30d',  value: '3 ventas',   hint: 'sobre 5 activas' },
            { label: 'Tasa de respuesta',       value: '98%',        hint: 'últimas 100 consultas' },
            { label: 'Idiomas',                 value: 'Es · Gn',    hint: 'también escribe en inglés' },
          ].map(m => (
            <div key={m.label} className="card" style={{ padding: '12px 14px' }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ink-4)', letterSpacing: '.04em', textTransform: 'uppercase' }}>{m.label}</div>
              <div style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 17, marginTop: 4, color: 'var(--ink)' }}>{m.value}</div>
              <div className="muted" style={{ fontSize: 11, marginTop: 1 }}>{m.hint}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="container" style={{ marginTop: 24 }}>
        <div className="row gap-6" style={{ padding: 4, background: '#fff', borderRadius: 999, border: '1px solid var(--line)', display: 'inline-flex' }}>
          {[
            ['propiedades', `Propiedades · ${props.length}`],
            ['zona',        'Recomendaciones'],
            ['reviews',     `Reseñas · ${agent.reviews}`],
          ].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{
              padding: '9px 18px', borderRadius: 999, border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', fontWeight: 600, fontSize: 13,
              background: tab === id ? 'var(--ink)' : 'transparent',
              color: tab === id ? '#fff' : 'var(--ink-3)',
              transition: 'background .12s, color .12s'
            }}>{label}</button>
          ))}
        </div>

        <div style={{ marginTop: 24, paddingBottom: 60 }}>
          {tab === 'propiedades' && (
            props.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
                {props.map(p => <PropertyCard key={p.id} p={p} onClick={() => onProperty && onProperty(p)}/>)}
              </div>
            ) : <EmptyTab text="Este agente todavía no tiene propiedades activas."/>
          )}

          {tab === 'zona' && <AgentZoneTips agent={agent}/>}
          {tab === 'reviews' && <AgentReviews agent={agent}/>}
        </div>
      </div>
    </div>
  );
}

function AgentLevelBadgeBig({ level }) {
  const map = {
    'Junior':  { bg: 'rgba(255,255,255,.2)', fg: '#fff' },
    'Pro':     { bg: '#fff',                 fg: 'var(--blue)' },
    'Top Pro': { bg: 'var(--yellow)',        fg: 'var(--ink)' },
  };
  const c = map[level] || map['Junior'];
  return <span className="badge" style={{ background: c.bg, color: c.fg, fontSize: 11, padding: '4px 12px' }}>{level}</span>;
}

function AgentLevelBadgeNew({ level }) {
  const map = {
    'Junior':  { bg: 'var(--bg-3)',  fg: 'var(--ink-3)', icon: null },
    'Pro':     { bg: 'var(--blue-50)', fg: 'var(--blue)', icon: 'check' },
    'Top Pro': { bg: 'var(--yellow)', fg: 'var(--ink)', icon: 'star' },
  };
  const c = map[level] || map['Junior'];
  return (
    <span className="badge" style={{ background: c.bg, color: c.fg, fontSize: 10.5, padding: '5px 11px', letterSpacing: '.04em', textTransform: 'uppercase' }}>
      {c.icon && React.createElement(I[c.icon], { s: 10 })}
      {level}
    </span>
  );
}

function EmptyTab({ text }) {
  return (
    <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>{text}</div>
  );
}

function AgentBlog({ agent }) {
  const posts = [
    { title: 'Qué revisar antes de firmar un contrato de alquiler en Asunción', date: '12 May 2026', read: '4 min', cat: 'Guía propietarios', cover: 0 },
    { title: 'Cómo fijar el precio correcto: comparativa por zona', date: '28 Abr 2026', read: '6 min', cat: 'Mercado', cover: 6 },
    { title: '5 tips para fotos que aumentan consultas en un 70%', date: '14 Abr 2026', read: '3 min', cat: 'Marketing', cover: 12 },
    { title: 'Inquilinos con mascotas: cómo protegerte sin perder el alquiler', date: '02 Abr 2026', read: '5 min', cat: 'Guía propietarios', cover: 18 },
    { title: 'Impuestos y gastos comunes: lo que muchos dueños olvidan', date: '20 Mar 2026', read: '7 min', cat: 'Legal', cover: 24 },
  ].slice(0, Math.max(2, Math.min(agent.blogPosts, 5)));

  if (agent.blogPosts === 0) return <EmptyTab text="Este agente aún no publicó artículos."/>;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 18 }}>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <Photo src={photo(posts[0].cover)} style={{ height: 280, borderRadius: 0 }}/>
          <div style={{ padding: 22 }}>
            <span className="badge badge-soft" style={{ fontSize: 10.5 }}>{posts[0].cat}</span>
            <h3 style={{ fontSize: 22, marginTop: 10, lineHeight: 1.25 }}>{posts[0].title}</h3>
            <div className="muted xs" style={{ marginTop: 8 }}>{posts[0].date} · {posts[0].read} de lectura</div>
            <button className="btn btn-outline btn-sm" style={{ marginTop: 14 }}>Leer artículo →</button>
          </div>
        </div>
        <div className="col gap-12">
          {posts.slice(1).map(p => (
            <div key={p.title} className="card" style={{ padding: 0, overflow: 'hidden', display: 'grid', gridTemplateColumns: '110px 1fr' }}>
              <Photo src={photo(p.cover)} style={{ height: '100%', borderRadius: 0 }}/>
              <div style={{ padding: 14 }}>
                <span className="badge badge-soft" style={{ fontSize: 9.5 }}>{p.cat}</span>
                <div style={{ fontWeight: 700, fontSize: 13.5, marginTop: 6, lineHeight: 1.35 }}>{p.title}</div>
                <div className="muted xs" style={{ marginTop: 6 }}>{p.date} · {p.read}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AgentZoneTips({ agent }) {
  const zones = agent.zone.split(',').map(s => s.trim());
  const tips = [
    { zone: zones[0], title: 'Qué buscar al alquilar en ' + zones[0], body: 'Zona muy demandada por jóvenes profesionales y familias chicas. Recomiendo priorizar edificios con cochera cubierta y verificar conexión a fibra óptica. Precios promedio: Gs. 3.2M – 4.5M.' },
    { zone: zones[1] || zones[0], title: 'Tendencia 2026 en ' + (zones[1] || zones[0]), body: 'La zona está creciendo en oferta de dúplex y mini-condominios. Para propietarios: ofrecer amueblado parcial sube la consulta promedio en un 35%.' },
    { zone: zones[0], title: 'Servicios y conectividad en la zona', body: 'Líneas de buses A1, A2 y A3. Cercanía con supermercados Stock y Real, gimnasios SmartFit y Bodytech, y centros educativos como Goethe y Cristo Rey. Importante para inquilinos con familia.' },
  ];
  return (
    <div className="col gap-14">
      <div className="card" style={{ padding: 18, background: 'var(--yellow-50)', border: '1px solid #f1d97a' }}>
        <div className="row gap-10">
          <I.bolt s={20}/>
          <div style={{ fontSize: 13.5 }}>
            <strong>Conocimiento de zona:</strong> {agent.name.split(' ')[0]} se especializa en <strong>{agent.zone}</strong>. Sus recomendaciones se basan en {agent.closedRentals} cierres efectivos.
          </div>
        </div>
      </div>
      {tips.map((t, i) => (
        <div key={i} className="card" style={{ padding: 22 }}>
          <span className="badge badge-soft" style={{ fontSize: 10.5 }}><I.pin s={10}/> {t.zone}</span>
          <h3 style={{ fontSize: 18, marginTop: 10 }}>{t.title}</h3>
          <p style={{ fontSize: 14, marginTop: 8, lineHeight: 1.6, color: 'var(--ink-2)' }}>{t.body}</p>
        </div>
      ))}
    </div>
  );
}

function AgentReviews({ agent }) {
  const allReviews = [
    { name: 'Pablo R.',  date: 'Hace 2 semanas', stars: 5, body: 'Excelente atención, respondió todas mis consultas por WhatsApp en minutos. La visita fue puntual y muy clara con los detalles del contrato.', role: 'Inquilino' },
    { name: 'Sofía G.',  date: 'Hace 1 mes',     stars: 5, body: 'Cedí mi departamento para que lo gestione y lo alquiló en 11 días. Muy profesional y transparente con los reportes.', role: 'Propietaria' },
    { name: 'Lucía M.',  date: 'Hace 2 meses',   stars: 4, body: 'Buen agente, conoce muy bien la zona. La única pega es que en horario nocturno tarda un poco más en responder.', role: 'Inquilina' },
    { name: 'Damián V.', date: 'Hace 3 meses',   stars: 5, body: 'Recomiendo 100%. Filtró bien a los interesados y me consiguió un inquilino confiable rápido.', role: 'Propietario' },
    { name: 'Camila R.', date: 'Hace 4 meses',   stars: 3, body: 'Respuesta media. La visita coordinada se postergó dos veces, aunque al final salió bien.', role: 'Inquilina' },
    { name: 'Hugo G.',   date: 'Hace 5 meses',   stars: 5, body: 'Súper recomendable. Atento, claro y siempre disponible. Volvería a trabajar con él sin dudas.', role: 'Propietario' },
  ];
  const [filter, setFilter] = React.useState('all');
  const [writeOpen, setWriteOpen] = React.useState(false);
  const filtered = filter === 'all' ? allReviews : allReviews.filter(r => r.stars === filter);
  const dist = { 5: 78, 4: 16, 3: 4, 2: 1, 1: 1 };

  return (
    <div>
      <div className="card" style={{ padding: 22, marginBottom: 18 }}>
        <div className="row gap-24">
          <div style={{ textAlign: 'center', paddingRight: 24, borderRight: '1px solid var(--line-2)' }}>
            <div style={{ fontFamily: 'Montserrat', fontWeight: 900, fontSize: 48, color: 'var(--yellow-600)' }}>{agent.rating}</div>
            <div className="row gap-2" style={{ justifyContent: 'center', color: 'var(--yellow)' }}>
              {[1,2,3,4,5].map(s => <I.star key={s} s={14}/>)}
            </div>
            <div className="muted xs" style={{ marginTop: 4 }}>{agent.reviews} reseñas</div>
            <button onClick={() => setWriteOpen(true)} className="btn btn-blue btn-sm" style={{ marginTop: 14, padding: '7px 14px', fontSize: 12.5, whiteSpace: 'nowrap' }}>
              <I.plus s={12}/> Escribir reseña
            </button>
          </div>
          <div style={{ flex: 1 }}>
            {[5,4,3,2,1].map(n => {
              const pct = dist[n];
              const active = filter === n;
              return (
                <button key={n} onClick={() => setFilter(active ? 'all' : n)} style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4,
                  padding: '4px 8px', borderRadius: 8, border: 'none',
                  background: active ? 'var(--blue-50)' : 'transparent',
                  cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'background .12s',
                }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg-2)'; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
                  <span style={{ width: 18, fontSize: 12, fontWeight: 700, color: active ? 'var(--blue)' : 'var(--ink-2)' }}>{n}★</span>
                  <div style={{ flex: 1, height: 8, background: 'var(--bg-3)', borderRadius: 99 }}>
                    <div style={{ width: pct + '%', height: '100%', background: active ? 'var(--blue)' : 'var(--yellow)', borderRadius: 99, transition: 'background .12s' }}/>
                  </div>
                  <span style={{ width: 36, textAlign: 'right', fontSize: 12, color: active ? 'var(--blue)' : 'var(--ink-3)', fontWeight: active ? 700 : 500 }}>{pct}%</span>
                </button>
              );
            })}
            {filter !== 'all' && (
              <button onClick={() => setFilter('all')} style={{ marginTop: 8, background: 'none', border: 'none', color: 'var(--blue)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: '4px 8px' }}>
                ← Ver todas las reseñas
              </button>
            )}
          </div>
        </div>
      </div>

      {filter !== 'all' && (
        <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--ink-3)' }}>
          Mostrando <strong style={{ color: 'var(--ink)' }}>{filtered.length}</strong> reseña{filtered.length !== 1 ? 's' : ''} de {filter} estrella{filter > 1 ? 's' : ''}
        </div>
      )}

      <div className="col gap-12">
        {filtered.length === 0 ? (
          <EmptyTab text={`Aún no hay reseñas de ${filter} estrella${filter > 1 ? 's' : ''}.`}/>
        ) : filtered.map((r, i) => (
          <div key={r.name + i} className="card" style={{ padding: 18 }}>
            <div className="row gap-12">
              <Avatar name={r.name} size={40}/>
              <div style={{ flex: 1 }}>
                <div className="row between">
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{r.name}</span>
                    <span className="muted xs" style={{ marginLeft: 8 }}>· {r.role}</span>
                  </div>
                  <div className="row gap-2" style={{ color: 'var(--yellow)' }}>
                    {[...Array(r.stars)].map((_, i) => <I.star key={i} s={12}/>)}
                  </div>
                </div>
                <div className="muted xs" style={{ marginTop: 2 }}>{r.date}</div>
                <p style={{ fontSize: 14, marginTop: 8, lineHeight: 1.55, color: 'var(--ink-2)' }}>{r.body}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {writeOpen && <WriteReviewModal agent={agent} onClose={() => setWriteOpen(false)}/>}
    </div>
  );
}

function WriteReviewModal({ agent, onClose }) {
  const [stars, setStars] = React.useState(0);
  const [hover, setHover] = React.useState(0);
  const [role, setRole] = React.useState('Inquilino');
  const [name, setName] = React.useState('');
  const [body, setBody] = React.useState('');
  const [sent, setSent] = React.useState(false);
  const ready = stars > 0 && name.trim().length >= 2 && body.trim().length >= 15;

  React.useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, []);

  if (sent) {
    return ReactDOM.createPortal(
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(11,22,34,.55)', zIndex: 200, display: 'grid', placeItems: 'center', padding: 20 }}>
        <div onClick={(e) => e.stopPropagation()} className="card" style={{ padding: 32, maxWidth: 420, textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--blue-50)', color: 'var(--blue)', display: 'grid', placeItems: 'center', margin: '0 auto' }}>
            <I.check s={32}/>
          </div>
          <h3 style={{ fontSize: 20, marginTop: 14 }}>¡Reseña enviada!</h3>
          <p className="muted" style={{ fontSize: 13.5, marginTop: 8, lineHeight: 1.5 }}>Gracias por compartir tu experiencia. Tu reseña será publicada en menos de 24 hs hábiles.</p>
          <button onClick={onClose} className="btn btn-blue" style={{ marginTop: 20 }}>Entendido</button>
        </div>
      </div>,
      document.body
    );
  }

  return ReactDOM.createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(11,22,34,.55)', zIndex: 200, display: 'grid', placeItems: 'center', padding: 20, overflowY: 'auto' }}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ padding: 26, maxWidth: 540, width: '100%', position: 'relative', maxHeight: 'calc(100vh - 40px)', overflowY: 'auto' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 14, background: 'var(--bg-2)', border: 'none', width: 32, height: 32, borderRadius: 8, cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
          <I.x s={14}/>
        </button>

        <div className="tag">Reseña</div>
        <h3 style={{ fontSize: 20, marginTop: 6 }}>Calificá a {agent.name.split(' ')[0]}</h3>
        <p className="muted" style={{ fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>
          Tu opinión ayuda a otros propietarios e inquilinos a elegir agente. La reseña se publica luego de una revisión rápida.
        </p>

        {/* Stars input */}
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-3)', letterSpacing: '.02em', textTransform: 'uppercase', marginBottom: 8 }}>Tu calificación</div>
          <div className="row gap-4">
            {[1,2,3,4,5].map(n => (
              <button key={n}
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(0)}
                onClick={() => setStars(n)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 0,
                  color: (hover || stars) >= n ? 'var(--yellow)' : '#d4dae3',
                  transition: 'color .12s, transform .12s',
                  transform: (hover === n) ? 'scale(1.15)' : 'none',
                }}>
                <I.star s={32}/>
              </button>
            ))}
            {stars > 0 && <span style={{ fontSize: 13, marginLeft: 8, color: 'var(--ink-3)', fontWeight: 600 }}>
              {['Muy mala','Mala','Regular','Buena','Excelente'][stars-1]}
            </span>}
          </div>
        </div>

        {/* Role */}
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-3)', letterSpacing: '.02em', textTransform: 'uppercase', marginBottom: 8 }}>¿Cómo trabajaste con este agente?</div>
          <div className="row gap-6">
            {['Inquilino','Propietario','Otro'].map(r => (
              <button key={r} onClick={() => setRole(r)} style={{
                padding: '7px 14px', borderRadius: 999,
                border: '1px solid ' + (role === r ? 'var(--blue)' : 'var(--line)'),
                background: role === r ? 'var(--blue-50)' : '#fff',
                color: role === r ? 'var(--blue)' : 'var(--ink-2)',
                fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit'
              }}>{r}</button>
            ))}
          </div>
        </div>

        {/* Name */}
        <div className="field" style={{ marginTop: 16 }}>
          <label>Tu nombre</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Pablo R."/>
        </div>

        {/* Body */}
        <div className="field" style={{ marginTop: 14 }}>
          <label>Tu experiencia</label>
          <textarea className="input" rows={5} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Contá brevemente cómo fue trabajar con este agente. Mínimo 15 caracteres." />
          <div className="muted xs" style={{ textAlign: 'right' }}>{body.length} caracteres</div>
        </div>

        <div className="row between" style={{ marginTop: 18 }}>
          <span className="muted xs">Tu reseña se publica después de una revisión rápida.</span>
          <div className="row gap-10">
            <button onClick={onClose} className="btn btn-outline">Cancelar</button>
            <button onClick={() => ready && setSent(true)} className="btn btn-blue"
              disabled={!ready}
              style={{ opacity: ready ? 1 : .5, cursor: ready ? 'pointer' : 'not-allowed' }}>
              Enviar reseña <I.check s={14}/>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

Object.assign(window, { AgentProfilePage });
