// Administradores — Global y Propietario/Agente

function AdminLayout({ kind, route, onNav, title, subtitle, actions, children }) {
  const items = kind === 'global' ? [
    { id: 'admin-global', label: 'Dashboard', icon: 'grid' },
    { id: 'admin-global-properties', label: 'Inmuebles', icon: 'house' },
    { id: 'admin-global-queue', label: 'Cola de verificación', icon: 'shield' },
    { id: 'admin-global-users', label: 'Propietarios y agentes', icon: 'user' },
    { id: 'admin-global-plans', label: 'Planes', icon: 'doc' },
  ] : [
    { id: 'admin-agent', label: 'Resumen', icon: 'grid' },
    { id: 'admin-agent-properties', label: 'Mis propiedades', icon: 'house' },
    { id: 'admin-agent-captures', label: 'Captaciones', icon: 'shield' },
    { id: 'admin-agent-referrals', label: 'Referidos', icon: 'trend' },
    // Consultas: ítem ocultado del menú del panel agente (limpieza UI legacy).
    // El componente QueriesSection sigue en el archivo pero ya no se accede vía menú.
    { id: 'admin-agent-qr', label: 'Carteles QR', icon: 'qr' },
    { id: 'admin-agent-profile', label: 'Mi perfil', icon: 'user' },
  ];

  return (
    <div className="fade-in" style={{ background: 'var(--bg-2)', minHeight: 'calc(100vh - 76px)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr' }}>
        <aside style={{ background: '#fff', borderRight: '1px solid var(--line)', minHeight: 'calc(100vh - 76px)', padding: '24px 16px' }}>
          <div style={{ padding: '0 8px 16px', borderBottom: '1px solid var(--line-2)', marginBottom: 12 }}>
            <div className="tag" style={{ color: kind === 'global' ? 'var(--blue)' : 'var(--yellow-600)' }}>
              Panel {kind === 'global' ? 'global' : 'de gestión'}
            </div>
            <div style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 16, marginTop: 4 }}>
              {kind === 'global' ? 'Administración' : 'Inmobiliaria Centro'}
            </div>
            <div className="muted xs">{kind === 'global' ? 'AlquiloYa · Equipo' : 'admin@centroinmob.py'}</div>
          </div>
          <nav className="col gap-2">
            {items.map(it => (
              <button key={it.id} onClick={() => onNav(it.id)} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                background: route === it.id ? 'var(--blue-50)' : 'transparent',
                color: route === it.id ? 'var(--blue)' : 'var(--ink-2)',
                border: 'none', borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: 'pointer', textAlign: 'left'
              }}>
                {React.createElement(I[it.icon], { s: 16 })}
                {it.label}
              </button>
            ))}
          </nav>
          {kind === 'agent' && (
            <>
              <div style={{ marginTop: 24, padding: 14, background: 'var(--yellow-50)', borderRadius: 12, fontSize: 12.5 }}>
                <div style={{ fontWeight: 700, color: '#8a5e00' }}>Plan Premium</div>
                <div style={{ color: '#8a5e00', marginTop: 4 }}>Renueva el 30 de Junio</div>
                <button className="btn btn-blue btn-sm" style={{ marginTop: 10, width: '100%', justifyContent: 'center' }}>Ver plan</button>
              </div>
              <button onClick={() => onNav('agent/mariana-lopez')} className="card" style={{ marginTop: 12, padding: 12, fontSize: 12.5, width: '100%', textAlign: 'left', cursor: 'pointer', border: '1px dashed var(--blue-100)' }}>
                <div className="row gap-8">
                  <I.eye s={14}/>
                  <span style={{ fontWeight: 700, color: 'var(--blue)' }}>Ver mi perfil público</span>
                </div>
                <div className="muted xs" style={{ marginTop: 4 }}>Así te ven los propietarios</div>
              </button>
            </>
          )}
          {kind === 'global' && (
            <div style={{ marginTop: 24, padding: 14, background: 'var(--blue-50)', borderRadius: 12, fontSize: 12.5 }}>
              <div style={{ fontWeight: 700, color: 'var(--blue)' }}>Modo administrador</div>
              <div style={{ color: 'var(--ink-3)', marginTop: 4 }}>Acceso completo a la plataforma</div>
            </div>
          )}
        </aside>
        <main style={{ padding: '20px 28px' }}>
          {(title || actions) && (
            <div className="row between" style={{ marginBottom: 18, alignItems: 'center' }}>
              <div>
                {title && <h2 style={{ fontSize: 19, lineHeight: 1.2 }}>{title}</h2>}
                {subtitle && <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>{subtitle}</div>}
              </div>
              <div className="row gap-8">
                {actions || (
                  <>
                    {/* Contador "4 nuevas" (consultas) ocultado en limpieza UI legacy. */}
                    {kind !== 'global' && <button onClick={() => onNav && onNav('publish')} style={{ padding: '6px 14px', height: 32, borderRadius: 8, background: 'var(--yellow)', border: 'none', color: 'var(--ink)', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6 }}><I.plus s={12}/> Cargar propiedad</button>}
                  </>
                )}
              </div>
            </div>
          )}
          {/* Floating action buttons when no header */}
          {!title && (
            <div className="row gap-8" style={{ justifyContent: 'flex-end', marginBottom: 14 }}>
              {/* Contador "4 nuevas" (consultas) ocultado en limpieza UI legacy. */}
              {kind !== 'global' && <button onClick={() => onNav && onNav('publish')} style={{ padding: '6px 14px', height: 32, borderRadius: 8, background: 'var(--yellow)', border: 'none', color: 'var(--ink)', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6 }}><I.plus s={12}/> Cargar propiedad</button>}
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}

function AdminGlobalPage({ route, onNav }) {
  return (
    <AdminLayout kind="global" route={route} onNav={onNav}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <StatCard label="Inmuebles activos" value="2.480" delta="+ 124 últimos 7 días" trend="up" icon="house" color="var(--blue)"/>
        <StatCard label="Pendientes de revisión" value="48" delta="14 nuevos hoy · requiere acción" trend="warn" icon="shield" color="var(--yellow-600)"/>
        <StatCard label="Usuarios registrados" value="4.218" delta="3.612 propietarios · 606 agentes" trend="up" icon="user" color="var(--green)"/>
        <StatCard label="Ingresos del mes" value="Gs. 38.4M" delta="+ 12% vs mes pasado" trend="up" icon="trend" color="#6e3ad1"/>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20, marginTop: 20 }}>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="row between" style={{ padding: '20px 24px', borderBottom: '1px solid var(--line-2)' }}>
            <div>
              <h3 style={{ fontSize: 18 }}>Cola de verificación</h3>
              <div className="muted xs" style={{ marginTop: 2 }}>Inmuebles esperando aprobación · revisá lo más urgente primero</div>
            </div>
            <div className="row gap-8">
              <span className="badge" style={{ background: 'var(--yellow-50)', color: '#8a5e00' }}>48 pendientes</span>
              <button className="btn btn-outline btn-sm">Ver todos</button>
            </div>
          </div>
          <div className="col" style={{ padding: 14, gap: 8 }}>
            {PROPERTIES.slice(0, 5).map((p, i) => (
              <div key={p.id} className="row gap-12" style={{ padding: 12, borderRadius: 10, background: 'var(--bg-2)' }}>
                <Photo src={p.cover} style={{ width: 64, height: 52, borderRadius: 6, flexShrink: 0 }}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row gap-8" style={{ alignItems: 'center' }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title}</span>
                    {i === 0 && <span className="badge" style={{ background: '#fce4e4', color: '#c33636', fontSize: 10 }}>Urgente</span>}
                  </div>
                  <div className="muted xs" style={{ marginTop: 2 }}>
                    <span className="mono">{p.id}</span> · {p.agent.name} · subido hace {i+1} h
                  </div>
                </div>
                <div className="row gap-6" style={{ flexShrink: 0 }}>
                  <button className="btn btn-outline btn-sm">Revisar</button>
                  <button className="btn btn-blue btn-sm" style={{ padding: '6px 10px' }}><I.check s={12}/></button>
                  <button className="btn btn-outline btn-sm" style={{ padding: '6px 10px', color: 'var(--red)', borderColor: '#f0caca' }}><I.x s={12}/></button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: 24 }}>
          <div>
            <div className="tag">Últimos 30 días</div>
            <h3 style={{ fontSize: 18, marginTop: 4 }}>Publicaciones</h3>
            <div style={{ fontFamily: 'Montserrat', fontWeight: 900, fontSize: 28, marginTop: 8 }}>
              + 412 <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--green)' }}>↑ 18%</span>
            </div>
          </div>
          <ChartArea/>
          <div style={{ marginTop: 8, paddingTop: 14, borderTop: '1px solid var(--line-2)' }}>
            <div className="row between" style={{ fontSize: 13 }}>
              <span className="muted">Tasa de aprobación</span>
              <span style={{ fontWeight: 700 }}>92%</span>
            </div>
            <div className="row between" style={{ fontSize: 13, marginTop: 6 }}>
              <span className="muted">Tiempo medio de revisión</span>
              <span style={{ fontWeight: 700 }}>4 h 12 min</span>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

function StatCard({ label, value, delta, trend, icon, color }) {
  return (
    <div className="card" style={{ padding: 14 }}>
      <div className="row between" style={{ alignItems: 'flex-start' }}>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)' }}>{label}</div>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: color + '14', color, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          {React.createElement(I[icon], { s: 14 })}
        </div>
      </div>
      <div style={{ fontFamily: 'Montserrat', fontWeight: 900, fontSize: 22, marginTop: 6, color: 'var(--ink)', lineHeight: 1.1 }}>{value}</div>
      <div className="row gap-4" style={{ marginTop: 2, fontSize: 11, color: trend === 'warn' ? '#8a5e00' : trend === 'up' ? 'var(--green)' : 'var(--ink-3)' }}>
        {trend === 'up' && <I.trend s={10}/>}
        {trend === 'warn' && <I.bell s={10}/>}
        {delta}
      </div>
    </div>
  );
}

function ChartArea() {
  const points = [10,18,14,22,19,28,26,30,24,34,32,40,38,46,42,50,46,54,58,52,60,64,58,72,68,76,74,82,78,86];
  const max = 90, w = 600, h = 200;
  const step = w / (points.length - 1);
  const toY = v => h - (v / max) * h;
  const path = points.map((v, i) => `${i === 0 ? 'M' : 'L'} ${i * step} ${toY(v)}`).join(' ');
  const area = path + ` L ${w} ${h} L 0 ${h} Z`;
  return (
    <div style={{ marginTop: 22 }}>
      <svg viewBox={`0 0 ${w} ${h+20}`} width="100%" style={{ display: 'block' }}>
        <defs>
          <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0058A5" stopOpacity=".25"/>
            <stop offset="100%" stopColor="#0058A5" stopOpacity="0"/>
          </linearGradient>
        </defs>
        {[0,1,2,3].map(i => <line key={i} x1="0" x2={w} y1={i * h/3} y2={i * h/3} stroke="#eef1f4" strokeWidth="1"/>)}
        <path d={area} fill="url(#g1)"/>
        <path d={path} stroke="#0058A5" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
        {points.map((v, i) => i % 4 === 0 && <circle key={i} cx={i * step} cy={toY(v)} r="3" fill="#fff" stroke="#0058A5" strokeWidth="2"/>)}
      </svg>
      <div className="row between" style={{ marginTop: 8, fontSize: 11, color: 'var(--ink-4)', fontFamily: 'JetBrains Mono' }}>
        {['1 May','7 May','14 May','21 May','28 May'].map(l => <span key={l}>{l}</span>)}
      </div>
    </div>
  );
}

function Donut({ data }) {
  const total = data.reduce((s, d) => s + d.v, 0);
  const C = 2 * Math.PI * 40;
  let acc = 0;
  return (
    <svg viewBox="0 0 100 100" width="140" height="140">
      <circle cx="50" cy="50" r="40" fill="none" stroke="#eef1f4" strokeWidth="14"/>
      {data.map((d, i) => {
        const len = (d.v / total) * C;
        const c = <circle key={i} cx="50" cy="50" r="40" fill="none" stroke={d.color} strokeWidth="14"
          strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-acc} transform="rotate(-90 50 50)"/>;
        acc += len;
        return c;
      })}
      <text x="50" y="50" textAnchor="middle" dominantBaseline="middle" fontFamily="Montserrat" fontWeight="800" fontSize="18">2.480</text>
      <text x="50" y="62" textAnchor="middle" dominantBaseline="middle" fontFamily="Inter" fontSize="6" fill="#5b6573">total inmuebles</text>
    </svg>
  );
}

function AdminAgentPage({ route, onNav }) {
  const [impulsesFree, setImpulsesFree] = React.useState(7);   // 7 de 10 gratis disponibles
  const [impulsesPaid, setImpulsesPaid] = React.useState(5);   // 5 comprados

  // Fase 9B: "Mis propiedades" desde API real. Si /api/agente/propiedades
  // responde con un array, lo usamos; si falla / 401 / vacío, fallback a PROPERTIES mock.
  const [myPropiedades, setMyPropiedades] = React.useState(null);
  React.useEffect(() => {
    let cancelled = false;
    fetch('/api/agente/propiedades', { cache: 'no-store', credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject(new Error('http ' + r.status)))
      .then(body => {
        if (cancelled) return;
        if (!body || !body.success || !Array.isArray(body.propiedades)) return;
        // Normalizar al shape consumido por las cards legacy (p.title/p.cover/p.price).
        const mapped = body.propiedades.map(p => ({
          id: p.id,
          title: p.titulo || 'Sin título',
          cover: p.cover_url || (typeof photo === 'function' ? photo(0) : ''),
          price: Number(p.precio) || 0,
          city: p.ciudad || '',
          neighborhood: p.barrio || '',
          estado: p.estado || '',
          activo: p.activo !== false,
          visible_web: !!p.visible_web,
          destacada: !!p.destacada,
          fotos_count: p.fotos_count || 0,
          _real: true,
        }));
        setMyPropiedades(mapped);
      })
      .catch(() => { /* fallback mock */ });
    return () => { cancelled = true; };
  }, []);
  const propsForRender = (myPropiedades && myPropiedades.length > 0) ? myPropiedades : PROPERTIES;

  const [boostedIds, setBoostedIds] = React.useState({ [PROPERTIES[1].id]: true, [PROPERTIES[4].id]: true });
  const [buyOpen, setBuyOpen] = React.useState(false);
  const [verifyTarget, setVerifyTarget] = React.useState(null);
  const [verifiedIds, setVerifiedIds] = React.useState({ [PROPERTIES[0].id]: true });
  const [brochureOpen, setBrochureOpen] = React.useState(false);
  const [propFilter, setPropFilter] = React.useState('all');
  const totalAvailable = impulsesFree + impulsesPaid;

  const useBoost = (id) => {
    if (boostedIds[id]) {
      setBoostedIds(b => { const n = { ...b }; delete n[id]; return n; });
      return;
    }
    if (totalAvailable <= 0) { setBuyOpen(true); return; }
    setBoostedIds(b => ({ ...b, [id]: true }));
    if (impulsesFree > 0) setImpulsesFree(v => v - 1);
    else setImpulsesPaid(v => v - 1);
  };
  const onBuy = (pack) => { setImpulsesPaid(v => v + pack.qty); setBuyOpen(false); };

  // Reset scroll when changing section
  React.useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [route]);

  const view = ({
    'admin-agent': 'overview',
    'admin-agent-properties': 'properties',
    'admin-agent-captures': 'captures',
    'admin-agent-referrals': 'referrals',
    'admin-agent-queries': 'queries',
    'admin-agent-profile': 'profile',
  })[route] || 'overview';

  const titles = {
    overview: ['', ''],
    properties: ['Mis propiedades', 'Editá, pausá o destacá tus inmuebles publicados.'],
    captures: ['Captaciones', 'Propiedades que capturaste de propietarios + comisión por cierre.'],
    referrals: ['Referidos', 'Tu link único + tracking de suscripciones generadas.'],
    queries: ['Consultas', 'Mensajes de interesados en tus inmuebles.'],
    profile: ['Mi perfil', 'Información que ven los propietarios al elegirte como agente.'],
  };

  return (
    <AdminLayout kind="agent" route={route} onNav={onNav} title={titles[view][0]} subtitle={titles[view][1]}>
      {view === 'overview' && <ImpulseBanner free={impulsesFree} paid={impulsesPaid} freeMax={10} onBuy={() => setBuyOpen(true)}/>}

      {/* KPI strip — single card, 4 metrics separated by thin lines */}
      {view === 'overview' && (
      <div className="card" style={{ padding: 0, marginTop: 14, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {[
            { label: 'Mis propiedades',      value: '14',     sub: `${Object.keys(boostedIds).length} destacadas`,         icon: 'house', color: 'var(--blue)',       trend: 'up' },
            { label: 'Visualizaciones (7d)', value: '2.184',  sub: '+22% vs semana pasada',                                icon: 'eye',   color: 'var(--green)',      trend: 'up' },
            { label: 'Consultas WhatsApp',   value: '38',     sub: '12 sin responder',                                     icon: 'whats', color: 'var(--yellow-600)', trend: 'warn' },
            { label: 'Tasa de cierre',       value: '18%',    sub: '2 cerrados este mes',                                  icon: 'trend', color: '#6e3ad1',           trend: 'up' },
          ].map((k, i) => (
            <div key={k.label} style={{ padding: '16px 18px', borderRight: i < 3 ? '1px solid var(--line-2)' : 'none' }}>
              <div className="row between" style={{ alignItems: 'flex-start' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{k.label}</div>
                <div style={{ width: 26, height: 26, borderRadius: 8, background: k.color + '14', color: k.color, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  {React.createElement(I[k.icon], { s: 13 })}
                </div>
              </div>
              <div style={{ fontFamily: 'Montserrat', fontWeight: 900, fontSize: 24, marginTop: 6, lineHeight: 1.1, color: 'var(--ink)' }}>{k.value}</div>
              <div className="row gap-4" style={{ marginTop: 4, fontSize: 11, color: k.trend === 'warn' ? '#8a5e00' : 'var(--green)' }}>
                {k.trend === 'up' && <I.trend s={10}/>}
                {k.trend === 'warn' && <I.bell s={10}/>}
                {k.sub}
              </div>
            </div>
          ))}
        </div>
      </div>
      )}

      {(view === 'overview' || view === 'properties') && (
      <div style={{ display: 'grid', gridTemplateColumns: view === 'properties' ? '1fr' : '1.6fr 1fr', gap: 14, marginTop: 14 }}>
        <div>
          {/* Header — fuera del card, estilo página */}
          <div className="row between" style={{ marginBottom: 12, alignItems: 'flex-end' }}>
            <div>
              <div style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 16 }}>Mis propiedades</div>
              <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 2 }}>14 publicadas · {Object.keys(boostedIds).length} destacadas</div>
            </div>
            <div style={{ display: 'inline-flex', gap: 4 }}>
              {[
                { id: 'all',    label: 'Todas' },
                { id: 'active', label: 'Activas' },
                { id: 'paused', label: 'Pausadas' },
              ].map(it => (
                <button key={it.id} onClick={() => setPropFilter(it.id)} style={{
                  padding: '6px 12px', borderRadius: 8, border: 'none',
                  background: propFilter === it.id ? 'var(--ink)' : 'transparent',
                  color: propFilter === it.id ? '#fff' : 'var(--ink-3)',
                  fontWeight: 600, cursor: 'pointer', fontSize: 11.5, fontFamily: 'inherit',
                  transition: 'all .12s',
                }}>{it.label}</button>
              ))}
            </div>
          </div>

          {/* Lista de propiedades — cards individuales, no tabla */}
          <div className="col gap-8">
            {propsForRender.slice(0, 6).map((p, i) => {
              // Si es real: pausada = estado 'pausada' o activo=false. Mock: índice 2 para demo.
              const isPaused = p._real
                ? (p.estado === 'pausada' || p.activo === false)
                : (i === 2);
              const isBoosted = !!boostedIds[p.id] || !!p.destacada;
              const status = isPaused ? 'paused' : 'active';
              if (propFilter !== 'all' && propFilter !== status) return null;
              const vistas = 120 + i * 87;
              const consultas = 2 + i * 3;
              return (
                <div key={p.id} className="card" style={{
                  padding: 12, display: 'flex', alignItems: 'center', gap: 14,
                  transition: 'border-color .12s, box-shadow .12s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--blue-100)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,88,165,.06)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}>
                  {/* Thumbnail */}
                  <Photo src={p.cover} style={{ width: 64, height: 64, borderRadius: 10, flexShrink: 0 }}/>

                  {/* Info principal */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="row gap-8" style={{ alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>{p.title}</span>
                      {isPaused
                        ? <span style={{ padding: '1px 7px', borderRadius: 999, background: 'var(--bg-3)', color: 'var(--ink-3)', fontSize: 9.5, fontWeight: 600 }}>Pausada</span>
                        : isBoosted
                          ? <span style={{ padding: '1px 7px', borderRadius: 999, background: 'var(--yellow)', color: 'var(--ink)', fontSize: 9.5, fontWeight: 700 }}>Destacada</span>
                          : <span style={{ padding: '1px 7px', borderRadius: 999, background: '#eaf6f0', color: 'var(--green)', fontSize: 9.5, fontWeight: 600 }}>Activa</span>}
                      {verifiedIds[p.id] && <span style={{ padding: '1px 7px', borderRadius: 999, background: 'var(--blue-50)', color: 'var(--blue)', fontSize: 9.5, fontWeight: 600 }}>✓ Verificada</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11.5, color: 'var(--ink-3)' }}>
                      <span className="mono" style={{ fontSize: 10.5, color: 'var(--ink-4)' }}>{p.id}</span>
                      <span style={{ fontWeight: 700, color: 'var(--blue)' }}>{formatGs(p.price)}<span style={{ color: 'var(--ink-4)', fontWeight: 500 }}> /mes</span></span>
                      <span style={{ color: 'var(--ink-4)' }}>·</span>
                      <span><I.eye s={11}/> <strong style={{ color: 'var(--ink-2)' }}>{vistas}</strong> vistas</span>
                      <span><I.chat s={11}/> <strong style={{ color: 'var(--ink-2)' }}>{consultas}</strong> consultas</span>
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="row gap-4" style={{ flexShrink: 0 }}>
                    {!isPaused && (
                      <button onClick={() => useBoost(p.id)} title={isBoosted ? 'Quitar destaque' : 'Usar 1 impulso'}
                        style={{
                          padding: 0, width: 28, height: 28, borderRadius: 8,
                          background: isBoosted ? 'var(--yellow)' : 'transparent',
                          color: isBoosted ? 'var(--ink)' : 'var(--ink-3)',
                          border: '1px solid ' + (isBoosted ? 'var(--yellow-600)' : 'var(--line)'),
                          cursor: 'pointer', display: 'grid', placeItems: 'center'
                        }}>
                        <I.bolt s={13}/>
                      </button>
                    )}
                    {!isPaused && !verifiedIds[p.id] && (
                      <button onClick={() => setVerifyTarget(p)} title="Verificar"
                        style={{ padding: 0, width: 28, height: 28, borderRadius: 8, background: 'transparent', color: 'var(--blue)', border: '1px solid var(--blue-100)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
                        <I.shield s={13}/>
                      </button>
                    )}
                    <button onClick={() => setBrochureOpen(true)} title="Brochure PDF"
                      style={{ padding: 0, width: 28, height: 28, borderRadius: 8, background: 'transparent', color: 'var(--ink-3)', border: '1px solid var(--line)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
                      <I.doc s={13}/>
                    </button>
                    <button onClick={() => onNav && onNav('admin-agent-qr')} title="Ver cartel QR" style={{ padding: 0, width: 28, height: 28, borderRadius: 8, background: 'transparent', color: 'var(--ink-3)', border: '1px solid var(--line)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
                      <I.qr s={13}/>
                    </button>
                    <button onClick={() => onNav && onNav('publish')} title="Editar" style={{ padding: '0 14px', height: 28, borderRadius: 8, background: 'var(--ink)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}>
                      Editar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer / ver todas */}
          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
            <span style={{ color: 'var(--ink-4)' }}>Mostrando {Math.min(6, propsForRender.length)} de {propsForRender.length}</span>
            <button style={{ background: 'none', border: 'none', color: 'var(--blue)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>
              Ver todas →
            </button>
          </div>
        </div>

        {view === 'overview' && (
        <div className="col gap-12">
          {/* Consultas recientes y Pendientes: bloques ocultados en limpieza UI legacy. */}

          {/* QR mini */}
          <div className="card" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--blue-50)', color: 'var(--blue)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <I.qr s={16}/>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 11.5 }}>Carteles QR</div>
              <div style={{ fontSize: 10, color: 'var(--ink-4)' }}>14 generados · 318 escaneos esta semana</div>
            </div>
            <button onClick={() => onNav('admin-agent-qr')} style={{ background: 'transparent', border: '1px solid var(--line)', borderRadius: 6, padding: '5px 9px', fontSize: 11, fontWeight: 600, cursor: 'pointer', color: 'var(--ink-2)', fontFamily: 'inherit' }}>Ver</button>
          </div>
        </div>
        )}
      </div>
      )}

      {view === 'captures' && <CapturesSection/>}
      {view === 'referrals' && <ReferralsSection/>}

      {view === 'queries' && <QueriesSection/>}

      {view === 'profile' && (
        <div>
          <div className="tag">Perfil</div>
          <h3 style={{ fontSize: 20, marginTop: 4 }}>Mi perfil de agente</h3>
          <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>Datos visibles en tu página pública. Estos datos los ven los propietarios cuando elijen un agente.</div>
          <div className="card" style={{ padding: 22, marginTop: 16, display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 18, alignItems: 'center' }}>
            <Avatar name="Mariana López" size={68}/>
            <div>
              <div className="row gap-10" style={{ alignItems: 'center' }}>
                <div style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 17 }}>Mariana López</div>
                <span className="badge badge-verified" style={{ fontSize: 10 }}><I.check s={10}/> Verificada</span>
                <span className="badge" style={{ background: 'var(--yellow)', color: 'var(--ink)', fontSize: 10 }}>Top Pro</span>
              </div>
              <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>Independiente · Villa Morra, Las Mercedes · En AlquiloYa desde 2022</div>
              <div className="row gap-16" style={{ marginTop: 8, fontSize: 12.5, color: 'var(--ink-2)' }}>
                <span><I.star s={12}/> <strong>4.8</strong> · 38 reseñas</span>
                <span><I.house s={12}/> 18 activas</span>
                <span><I.check s={12}/> 47 cerradas</span>
                <span><I.doc s={12}/> 12 aportes blog</span>
              </div>
            </div>
            <div className="col gap-8">
              <button onClick={() => onNav('agent/mariana-lopez')} className="btn btn-blue btn-sm">Ver perfil público →</button>
              <button className="btn btn-outline btn-sm">Editar datos</button>
            </div>
          </div>
        </div>
      )}

      {buyOpen && <BuyImpulsesModal onClose={() => setBuyOpen(false)} onBuy={onBuy}/>}
      {verifyTarget && (
        <VerificationModal
          propertyId={verifyTarget.id}
          propertyTitle={verifyTarget.title}
          onClose={() => setVerifyTarget(null)}
        />
      )}
      {brochureOpen && <BrochurePreviewModal onClose={() => setBrochureOpen(false)}/>}
    </AdminLayout>
  );
}

function ReferralsSection() {
  const tier = REFERRAL_TIERS[1]; // simulamos cuenta de Influencer
  const refLink = 'alquiloya.com.py/?ref=MARIANALOPEZ';
  const [copied, setCopied] = React.useState(false);
  const myReferrals = REFERRALS; // todas para el demo
  const totalCommission = myReferrals.reduce((s, r) => s + r.commission, 0);
  const paid = myReferrals.filter(r => r.status === 'pagada').reduce((s, r) => s + r.commission, 0);
  const pending = totalCommission - paid;
  const conversions = myReferrals.length;
  const clicks = 248; // mock

  const copy = () => {
    navigator.clipboard && navigator.clipboard.writeText('https://' + refLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ marginTop: 28 }}>
      <div className="row between" style={{ marginBottom: 16 }}>
        <div>
          <div className="tag">Referidos</div>
          <h3 style={{ fontSize: 20, marginTop: 4 }}>Invitá y ganá comisión</h3>
          <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
            Compartí tu link único. Cada persona que se suscriba a un plan paga te genera comisión.
          </div>
        </div>
        <div className="row gap-8" style={{ alignItems: 'center' }}>
          <span className="badge" style={{
            background: tier.id === 'influencer' ? 'var(--yellow)' : 'var(--blue-50)',
            color: tier.id === 'influencer' ? 'var(--ink)' : 'var(--blue)',
            fontSize: 11.5, padding: '4px 12px'
          }}>
            {tier.id === 'influencer' && <I.star s={11}/>} Tier {tier.name} · {tier.pct}%
          </span>
        </div>
      </div>

      {/* Link */}
      <div className="card" style={{ padding: 18, marginBottom: 18, background: 'linear-gradient(135deg, var(--blue-50), #fff)', border: '1px solid var(--blue-100)' }}>
        <div className="row between" style={{ alignItems: 'center', gap: 14 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="muted xs" style={{ marginBottom: 6, fontWeight: 700, letterSpacing: '.04em' }}>TU LINK ÚNICO DE REFERIDO</div>
            <div className="mono" style={{
              padding: '12px 14px', background: '#fff', borderRadius: 10,
              border: '1px solid var(--line)', fontSize: 14, color: 'var(--blue)',
              fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
            }}>https://{refLink}</div>
          </div>
          <div className="row gap-8" style={{ flexShrink: 0 }}>
            <button onClick={copy} className="btn btn-blue">
              {copied ? <><I.check s={14}/> Copiado</> : <><I.doc s={14}/> Copiar link</>}
            </button>
            <button className="btn btn-outline" title="QR para compartir"><I.qr s={14}/></button>
          </div>
        </div>
        <div className="row gap-16" style={{ marginTop: 14, fontSize: 12.5, color: 'var(--ink-3)' }}>
          <span className="row gap-6"><I.check s={12}/> Cookie de 60 días</span>
          <span className="row gap-6"><I.check s={12}/> Comisión recurrente (6 meses)</span>
          <span className="row gap-6"><I.check s={12}/> Pago automático mensual</span>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 18 }}>
        <StatCard label="Clicks en tu link" value={clicks.toLocaleString('es-PY')} delta="Últimos 30 días" trend="up" icon="eye" color="var(--blue)"/>
        <StatCard label="Suscripciones" value={String(conversions)} delta={`${((conversions/clicks)*100).toFixed(1)}% conversión`} trend="up" icon="check" color="var(--green)"/>
        <StatCard label="Comisión cobrada" value={formatGs(paid)} delta={`${myReferrals.filter(r => r.status === 'pagada').length} pagos`} trend="up" icon="trend" color="#6e3ad1"/>
        <StatCard label="Comisión pendiente" value={formatGs(pending)} delta={`${myReferrals.filter(r => r.status === 'pendiente').length} por cobrar`} trend="warn" icon="bell" color="var(--yellow-600)"/>
      </div>

      {/* Tabla */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="row between" style={{ padding: '14px 20px', borderBottom: '1px solid var(--line-2)' }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Tus referidos</div>
          <button className="btn btn-outline btn-sm">Exportar CSV</button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
          <thead>
            <tr style={{ background: 'var(--bg-2)' }}>
              <th style={{ ...th, textAlign: 'left' }}>Referido</th>
              <th style={{ ...th, textAlign: 'left' }}>Se unió</th>
              <th style={{ ...th, textAlign: 'left' }}>Fuente</th>
              <th style={{ ...th, textAlign: 'left' }}>Plan</th>
              <th style={{ ...th, textAlign: 'right' }}>Pagó</th>
              <th style={{ ...th, textAlign: 'right' }}>Tu comisión</th>
              <th style={{ ...th, textAlign: 'right' }}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {myReferrals.map(r => (
              <tr key={r.id} style={{ borderTop: '1px solid var(--line-2)' }}>
                <td style={td}>
                  <div className="row gap-10">
                    <Avatar name={r.name} size={32}/>
                    <span style={{ fontWeight: 600 }}>{r.name}</span>
                  </div>
                </td>
                <td style={{ ...td, fontFamily: 'JetBrains Mono', fontSize: 12 }}>{r.joined}</td>
                <td style={{ ...td, fontSize: 12.5, color: 'var(--ink-3)' }}>{r.source}</td>
                <td style={td}>{r.plan}</td>
                <td style={{ ...td, textAlign: 'right' }}>{formatGs(r.amount)}</td>
                <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: 'var(--blue)' }}>{formatGs(r.commission)}</td>
                <td style={{ ...td, textAlign: 'right' }}>
                  {r.status === 'pagada'
                    ? <span className="badge" style={{ background: '#eaf6f0', color: 'var(--green)', fontSize: 10.5 }}><I.check s={10}/> Pagada</span>
                    : <span className="badge" style={{ background: 'var(--yellow-50)', color: '#8a5e00', fontSize: 10.5 }}>Pendiente</span>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Tier explainer */}
      <div className="card" style={{ marginTop: 16, padding: 18, background: 'var(--bg-2)' }}>
        <div className="row gap-12" style={{ alignItems: 'center' }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--yellow)', color: 'var(--ink)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <I.star s={20}/>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Cómo funciona el programa</div>
            <div className="muted" style={{ fontSize: 12.5, marginTop: 4, lineHeight: 1.5 }}>
              <strong>Estándar (10%):</strong> abierto a todos los usuarios. Comisión única sobre el primer pago del referido. <br/>
              <strong>Influencer (25% × 6 meses):</strong> por invitación. Comisión recurrente durante 6 meses + acceso a creatividades y dashboard avanzado. <a style={{ color: 'var(--blue)', fontWeight: 600, cursor: 'pointer' }}>Aplicar al programa →</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Sparkline({ points, color = 'var(--blue)', height = 56 }) {
  if (!points || points.length === 0) return null;
  const w = 240;
  const max = Math.max(...points), min = Math.min(...points);
  const rng = max - min || 1;
  const step = w / (points.length - 1);
  const toY = (v) => height - ((v - min) / rng) * (height - 8) - 4;
  const path = points.map((v, i) => `${i === 0 ? 'M' : 'L'} ${(i * step).toFixed(1)} ${toY(v).toFixed(1)}`).join(' ');
  const area = path + ` L ${w} ${height} L 0 ${height} Z`;
  const last = points.length - 1;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} width="100%" preserveAspectRatio="none" style={{ display: 'block', marginTop: 8 }}>
      <defs>
        <linearGradient id="sl-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity=".25"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d={area} fill="url(#sl-grad)"/>
      <path d={path} stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx={(last * step).toFixed(1)} cy={toY(points[last]).toFixed(1)} r="3" fill="#fff" stroke={color} strokeWidth="2"/>
    </svg>
  );
}

function QueriesSection() {
  const queries = [
    ['Pablo R.','Hola, está disponible para visita el sábado?','AY-01241','5m',true,'595981112233'],
    ['Sofía G.','Permiten mascotas? Tengo un perro pequeño','AY-01243','22m',true,'595982223344'],
    ['Lucía M.','¿El precio incluye expensas?','AY-01242','45m',false,'595983334455'],
    ['Damián V.','Quisiera coordinar una visita para mañana','AY-01244','1h',false,'595984445566'],
    ['Camila R.','¿Puedo ir mañana a la tarde a verlo?','AY-01240','2h',false,'595985556677'],
    ['Roberto S.','Disponible para alquiler temporal de 2 meses?','AY-01243','5h',true,'595986667788'],
    ['Mariana V.','Buenos días, sigue disponible este inmueble?','AY-01245','8h',false,'595987778899'],
    ['Hugo G.','Necesito coordinar visita urgente','AY-01246','1d',true,'595988889900'],
  ];
  const openWhatsApp = (phone, propId) => {
    const msg = encodeURIComponent(`Hola! Te respondo desde AlquiloYa por tu consulta del inmueble ${propId}.`);
    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
  };
  return (
    <div>
      <div className="row between" style={{ marginBottom: 14, alignItems: 'flex-end' }}>
        <div>
          <div className="tag" style={{ fontSize: 10.5 }}>Consultas</div>
          <div style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 16, marginTop: 4 }}>Mensajes de interesados</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>4 sin responder · 38 esta semana · Tiempo medio respuesta: 12 min</div>
        </div>
        <div className="row gap-8">
          <Segment value="all" onChange={() => {}} items={[
            { id: 'all', label: 'Todas' },
            { id: 'unread', label: 'Sin leer' },
            { id: 'answered', label: 'Respondidas' },
          ]}/>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {queries.map(([n, m, id, t, unread, phone], i) => (
          <div key={i} style={{
            padding: '14px 18px', borderTop: i > 0 ? '1px solid var(--line-2)' : 'none',
            display: 'flex', alignItems: 'center', gap: 14,
            cursor: 'pointer', transition: 'background .12s',
            position: 'relative', background: unread ? '#fafbfc' : '#fff',
          }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-2)'}
             onMouseLeave={e => e.currentTarget.style.background = unread ? '#fafbfc' : '#fff'}>
            {unread && <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', width: 6, height: 6, borderRadius: '50%', background: 'var(--blue)' }}/>}
            <Avatar name={n} size={40}/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="row between" style={{ alignItems: 'baseline' }}>
                <div className="row gap-8" style={{ alignItems: 'baseline' }}>
                  <span style={{ fontWeight: 700, fontSize: 13.5 }}>{n}</span>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--ink-4)' }}>{id}</span>
                </div>
                <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>{t}</span>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m}</div>
            </div>
            <div className="row gap-6" style={{ flexShrink: 0 }}>
              <button onClick={() => openWhatsApp(phone, id)} title={`Responder a ${n} por WhatsApp (+${phone})`} style={{ padding: '0 12px', height: 30, borderRadius: 8, background: '#25D366', color: '#fff', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}>
                <I.whats s={13}/> Responder
              </button>
              <button title="Marcar respondida" style={{ padding: '6px', width: 30, height: 30, borderRadius: 8, background: 'transparent', color: 'var(--ink-3)', border: '1px solid var(--line)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
                <I.check s={14}/>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CapturesSection() {
  const [showAll, setShowAll] = React.useState(false);
  const allCaptures = CAPTURES.filter(c => c.agentId === 'AG-001');
  // Generate extra historical captures for the "historial completo" view
  const extras = React.useMemo(() => {
    if (!showAll) return [];
    const owners = ['María L.', 'José P.', 'Andrés R.', 'Carolina V.', 'Tomás M.', 'Beatriz N.', 'Ricardo S.', 'Diana F.'];
    const dates = ['10/01/2026', '22/01/2026', '08/02/2026', '19/02/2026', '04/03/2026', '20/12/2025', '15/11/2025', '02/10/2025'];
    return owners.map((o, i) => ({
      propertyId: 'AY-01' + String(260 + i).padStart(3, '0'),
      agentId: 'AG-001',
      date: dates[i],
      status: 'cerrada',
      owner: o,
      rentPrice: 2400000 + (i * 180000),
      commission: 120000 + (i * 9000),
      paid: true,
    }));
  }, [showAll]);
  const captures = showAll ? [...allCaptures, ...extras] : allCaptures;
  const gestionando = captures.filter(c => c.status === 'gestionando');
  const cerradas = captures.filter(c => c.status === 'cerrada');
  const totalCommission = cerradas.reduce((s, c) => s + (c.commission || 0), 0);
  const pendingCommission = cerradas.filter(c => !c.paid).reduce((s, c) => s + (c.commission || 0), 0);
  const paidCommission = totalCommission - pendingCommission;
  // Si hay sesión real (Fase 9A), usar el perfil cacheado por el botón "Ingresar".
  // Si no, fallback al mock AG-001 para preservar la demo.
  const me = (function () {
    try {
      const raw = localStorage.getItem('alquiloya:agente');
      if (raw) {
        const real = JSON.parse(raw);
        if (real && real.id) {
          return Object.assign({}, AGENTS.find(a => a.id === 'AG-001') || {}, {
            id: real.id,
            slug: real.slug || (real.nombre || '').toLowerCase().replace(/\s+/g, '-'),
            name: real.nombre || (real.email || 'Agente'),
            phone: real.telefono || real.whatsapp || '',
            avatar: undefined,
            commissionRate: 5,
            verified: !!real.activo,
            _real: true,
          });
        }
      }
    } catch (_) {}
    return AGENTS.find(a => a.id === 'AG-001');
  })();
  return (
    <div style={{ marginTop: 28 }}>
      <div className="row between" style={{ marginBottom: 14, alignItems: 'flex-end' }}>
        <div>
          <div className="tag" style={{ fontSize: 10.5 }}>Captaciones</div>
          <div style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 16, marginTop: 4 }}>Propiedades que capté</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>Comisión {me.commissionRate}% solo si se concreta</div>
        </div>
        <button onClick={() => setShowAll(v => !v)} style={{ background: 'none', border: 'none', color: 'var(--blue)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          {showAll ? 'Ver solo activas ←' : 'Historial completo →'}
        </button>
      </div>

      {/* Compact KPI strip */}
      <div className="card" style={{ padding: 0, marginBottom: 14, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {[
            { label: 'En gestión',          value: String(gestionando.length), sub: 'activas',                  color: 'var(--blue)' },
            { label: 'Cerradas',            value: String(cerradas.length),    sub: `Gs. ${(cerradas.reduce((s,c) => s+c.rentPrice,0)/1e6).toFixed(1)}M`, color: 'var(--green)' },
            { label: 'Comisión cobrada',    value: formatGs(paidCommission),   sub: `${cerradas.filter(c => c.paid).length} pagas`,    color: '#6e3ad1' },
            { label: 'Comisión pendiente',  value: formatGs(pendingCommission),sub: `${cerradas.filter(c => !c.paid).length} por cobrar`, color: 'var(--yellow-600)' },
          ].map((k, i) => (
            <div key={k.label} style={{ padding: '12px 16px', borderRight: i < 3 ? '1px solid var(--line-2)' : 'none' }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{k.label}</div>
              <div style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 17, color: k.color, marginTop: 4, lineHeight: 1.1 }}>{k.value}</div>
              <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{k.sub}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="col gap-8">
        {captures.map(c => {
          const p = PROPERTIES.find(pr => pr.id === c.propertyId) || { title: c.propertyId, cover: photo(0), address: '' };
          const closed = c.status === 'cerrada';
          return (
            <div key={c.propertyId} className="card" style={{
              padding: 12, display: 'flex', alignItems: 'center', gap: 14,
              transition: 'border-color .12s, box-shadow .12s',
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--blue-100)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,88,165,.06)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}>
              <Photo src={p.cover} style={{ width: 64, height: 64, borderRadius: 10, flexShrink: 0 }}/>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row gap-8" style={{ alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 320 }}>{p.title}</span>
                  {closed
                    ? <span style={{ padding: '1px 7px', borderRadius: 999, background: '#eaf6f0', color: 'var(--green)', fontSize: 9.5, fontWeight: 700 }}>✓ Cerrada</span>
                    : <span style={{ padding: '1px 7px', borderRadius: 999, background: 'var(--blue-50)', color: 'var(--blue)', fontSize: 9.5, fontWeight: 700 }}>● En gestión</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11.5, color: 'var(--ink-3)', flexWrap: 'wrap' }}>
                  <span className="mono" style={{ fontSize: 10.5, color: 'var(--ink-4)' }}>{c.propertyId}</span>
                  <span style={{ color: 'var(--ink-4)' }}>·</span>
                  <span><I.user s={11}/> <strong style={{ color: 'var(--ink-2)' }}>{c.owner}</strong></span>
                  <span style={{ color: 'var(--ink-4)' }}>·</span>
                  <span><I.cal s={11}/> Captada {c.date}</span>
                  {c.rentPrice && (
                    <>
                      <span style={{ color: 'var(--ink-4)' }}>·</span>
                      <span>Alquiler <strong style={{ color: 'var(--ink-2)' }}>{formatGs(c.rentPrice)}</strong></span>
                    </>
                  )}
                </div>
              </div>

              {/* Commission column */}
              {c.commission && (
                <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 120 }}>
                  <div style={{ fontSize: 10, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 700 }}>Comisión</div>
                  <div style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 14, color: 'var(--ink)', marginTop: 2 }}>{formatGs(c.commission)}</div>
                  <div style={{ fontSize: 10.5, color: c.paid ? 'var(--green)' : 'var(--yellow-600)', fontWeight: 600 }}>
                    {c.paid ? '✓ Pagada' : 'Pendiente'}
                  </div>
                </div>
              )}

              {/* Action */}
              <div style={{ flexShrink: 0 }}>
                {c.status === 'gestionando'
                  ? <button title="Marcar como alquilada" style={{
                      padding: '0 12px', height: 30, borderRadius: 8, background: 'var(--ink)',
                      color: '#fff', border: 'none', cursor: 'pointer',
                      fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                      display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap',
                    }}><I.check s={11}/> Marcar alquilada</button>
                  : !c.paid ? <button style={{
                      padding: '0 12px', height: 30, borderRadius: 8, background: '#fff',
                      color: 'var(--ink-2)', border: '1px solid var(--line)', cursor: 'pointer',
                      fontSize: 12, fontWeight: 600, fontFamily: 'inherit', whiteSpace: 'nowrap',
                    }}>Ver factura</button>
                  : <button style={{
                      padding: 0, width: 30, height: 30, borderRadius: 8, background: 'transparent',
                      color: 'var(--ink-4)', border: '1px solid var(--line)', cursor: 'pointer',
                      display: 'grid', placeItems: 'center', fontSize: 14, fontFamily: 'inherit',
                    }}>···</button>
                }
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ImpulseBanner({ free, paid, freeMax, onBuy }) {
  const total = free + paid;
  const pct = Math.min(100, (free / freeMax) * 100);
  return (
    <div className="card" style={{
      padding: '14px 18px',
      background: '#fff',
      border: '1px solid var(--line)',
      borderLeft: '3px solid var(--yellow)',
      display: 'flex', alignItems: 'center', gap: 18,
    }}>
      {/* Icon */}
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: 'var(--yellow-50)', color: 'var(--yellow-600)',
        display: 'grid', placeItems: 'center', flexShrink: 0
      }}>
        <I.bolt s={20}/>
      </div>

      {/* Stats */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
          <div className="row gap-6" style={{ alignItems: 'baseline' }}>
            <span style={{ fontFamily: 'Montserrat', fontWeight: 900, fontSize: 22, color: 'var(--ink)', lineHeight: 1 }}>{total}</span>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)' }}>impulsos disponibles</span>
          </div>
          <span style={{ width: 1, height: 14, background: 'var(--line)' }}/>
          <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>
            <span style={{ fontWeight: 700, color: 'var(--green)' }}>{free}</span>
            <span style={{ color: 'var(--ink-4)' }}>/{freeMax}</span> gratis
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>
            <span style={{ fontWeight: 700, color: 'var(--blue)' }}>{paid}</span> comprados
          </div>
          <span style={{ width: 1, height: 14, background: 'var(--line)' }}/>
          <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>Renueva el 1° de cada mes · 1 impulso = 7 días destacado</div>
        </div>

        {/* Progress bar for free impulses */}
        <div style={{ marginTop: 8, height: 4, background: 'var(--bg-3)', borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ width: pct + '%', height: '100%', background: 'linear-gradient(90deg, var(--green) 0%, var(--yellow) 100%)', borderRadius: 999, transition: 'width .3s ease' }}/>
        </div>
      </div>

      {/* CTA */}
      <button onClick={onBuy} style={{
        padding: '8px 16px', height: 36, borderRadius: 8,
        background: 'var(--ink)', border: 'none', color: '#fff', cursor: 'pointer',
        fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit',
        display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0,
        transition: 'background .15s',
      }}
        onMouseEnter={e => e.currentTarget.style.background = '#000'}
        onMouseLeave={e => e.currentTarget.style.background = 'var(--ink)'}
      >
        <I.plus s={12}/> Comprar
      </button>
    </div>
  );
}

function BuyImpulsesModal({ onClose, onBuy }) {
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(11,22,34,.55)', zIndex: 100,
      display: 'grid', placeItems: 'center', padding: 20
    }}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{
        padding: 28, maxWidth: 560, width: '100%', background: '#fff', position: 'relative'
      }}>
        <button onClick={onClose} style={{
          position: 'absolute', top: 14, right: 14, background: 'var(--bg-2)', border: 'none',
          width: 32, height: 32, borderRadius: 8, cursor: 'pointer', display: 'grid', placeItems: 'center'
        }}><I.x s={14}/></button>
        <div className="tag" style={{ color: 'var(--yellow-600)' }}>Impulsos</div>
        <h3 style={{ fontSize: 22, marginTop: 6 }}>Comprar impulsos extra</h3>
        <p className="muted" style={{ fontSize: 13.5, marginTop: 6 }}>
          Cada impulso destaca 1 propiedad por 7 días. No tienen vencimiento.
        </p>
        <div className="col gap-10" style={{ marginTop: 18 }}>
          {IMPULSE_PACKS.map(pack => (
            <button key={pack.id} onClick={() => onBuy(pack)} className="card" style={{
              padding: 14, cursor: 'pointer', textAlign: 'left',
              border: pack.popular ? '2px solid var(--yellow)' : (pack.best ? '2px solid var(--blue)' : '1px solid var(--line)'),
              background: '#fff', position: 'relative'
            }}>
              {pack.popular && <span style={{ position: 'absolute', top: -9, right: 12, background: 'var(--yellow)', color: 'var(--ink)', padding: '2px 10px', borderRadius: 999, fontSize: 10, fontWeight: 700 }}>MÁS ELEGIDO</span>}
              {pack.best && <span style={{ position: 'absolute', top: -9, right: 12, background: 'var(--blue)', color: '#fff', padding: '2px 10px', borderRadius: 999, fontSize: 10, fontWeight: 700 }}>MEJOR PRECIO</span>}
              <div className="row between" style={{ alignItems: 'center' }}>
                <div className="row gap-12" style={{ alignItems: 'center' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--yellow-50)', color: 'var(--yellow-600)', display: 'grid', placeItems: 'center' }}>
                    <I.bolt s={20}/>
                  </div>
                  <div>
                    <div className="row gap-8" style={{ alignItems: 'baseline' }}>
                      <span style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 18 }}>
                        {pack.qty} impulso{pack.qty > 1 ? 's' : ''}
                      </span>
                      {pack.save && <span className="badge" style={{ background: 'var(--green)', color: '#fff', fontSize: 10 }}>Ahorrás {pack.save}</span>}
                    </div>
                    <div className="muted xs">Gs. {pack.unit.toLocaleString('es-PY')} c/u</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 18, color: 'var(--blue)' }}>{formatGs(pack.price)}</div>
                  <div className="muted xs" style={{ marginTop: 2 }}>Click para comprar</div>
                </div>
              </div>
            </button>
          ))}
        </div>
        <div className="muted xs" style={{ marginTop: 16, textAlign: 'center' }}>
          Pago seguro vía Bancard / Pagopar · Los impulsos quedan disponibles al instante
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { AdminGlobalPage, AdminAgentPage });
