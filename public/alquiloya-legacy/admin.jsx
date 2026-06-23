// Administradores — Global y Propietario/Agente

// Navega a "publish" limpiando el hash de la URL. Sin esto, el hash queda en
// #admin-agent-properties y al recargar el usuario vuelve al panel en vez de
// quedar en /publish — pedido del cliente: al salir o refrescar desde el
// wizard de publicar debe quedar en https://alquiloya.com.py/.
function goPublishCleanUrl(onNav) {
  try {
    if (typeof window !== 'undefined' && window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  } catch {}
  if (onNav) onNav('publish');
}

function AdminLayout({ kind, role, route, onNav, title, subtitle, actions, displayName, displayEmail, planInfo, planLoading, agentRoute, children }) {
  // Drawer del sidebar en mobile. En desktop el CSS `.admin-shell` rinde el
  // sidebar fijo, asi que `navOpen` solo se usa en breakpoints chicos.
  const [navOpen, setNavOpen] = React.useState(false);
  const handleNav = React.useCallback((id) => {
    setNavOpen(false);
    if (onNav) onNav(id);
  }, [onNav]);
  const items = kind === 'global' ? [
    { id: 'admin-global', label: 'Dashboard', icon: 'grid' },
    { id: 'admin-global-properties', label: 'Inmuebles', icon: 'house' },
    { id: 'admin-global-queue', label: 'Cola de verificación', icon: 'shield' },
    { id: 'admin-global-users', label: 'Propietarios y agentes', icon: 'user' },
    { id: 'admin-global-plans', label: 'Planes', icon: 'doc' },
  ] : [
    { id: 'admin-agent', label: 'Resumen', icon: 'grid' },
    { id: 'admin-agent-properties', label: 'Mis propiedades', icon: 'house' },
    // Captaciones y Blog SOLO para agentes. Mientras el rol no esta resuelto
    // (role indefinido durante la carga) NO los mostramos: asi un propietario
    // no ve esos items aparecer y desaparecer. Para agentes aparecen al
    // resolverse el rol (additivo, menos molesto que mostrarlos y sacarlos).
    ...(role === 'agente' ? [{ id: 'admin-agent-captures', label: 'Captaciones', icon: 'shield' }] : []),
    ...(role === 'agente' ? [{ id: 'admin-agent-blog', label: 'Mi blog', icon: 'doc' }] : []),
    // Carteles QR y Mi perfil solo para agentes (los propietarios no los usan).
    ...(role === 'agente' ? [{ id: 'admin-agent-qr', label: 'Carteles QR', icon: 'qr' }] : []),
    ...(role === 'agente' ? [{ id: 'admin-agent-profile', label: 'Mi perfil', icon: 'user' }] : []),
  ];

  return (
    <div className="fade-in" style={{ background: 'var(--bg-2)', minHeight: 'calc(100vh - 76px)' }}>
      <div className={"admin-backdrop" + (navOpen ? ' open' : '')} onClick={() => setNavOpen(false)}/>
      <div className="admin-shell">
        <aside className={"admin-aside" + (navOpen ? ' open' : '')} style={{ background: '#fff', borderRight: '1px solid var(--line)', minHeight: 'calc(100vh - 76px)', padding: '24px 16px' }}>
          {/* Boton volver al sitio publico (pedido del cliente). */}
          <button
            onClick={() => {
              // Limpiar el hash (#admin-agent, #admin-agent-qr, etc.) antes
              // de navegar. Sin esto, recargar la pagina vuelve a leer el
              // hash y manda al usuario otra vez al panel.
              if (typeof window !== 'undefined' && window.location.hash) {
                window.history.replaceState(null, '', window.location.pathname + window.location.search);
              }
              if (onNav) onNav('home');
            }}
            title="Volver al sitio"
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              width: '100%', padding: '8px 12px', marginBottom: 14,
              background: 'var(--bg-2)', border: '1px solid var(--line-2)',
              borderRadius: 10, cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
              color: 'var(--ink-2)', textAlign: 'left',
              transition: 'background .12s, color .12s, border-color .12s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--blue-50)';
              e.currentTarget.style.color = 'var(--blue)';
              e.currentTarget.style.borderColor = 'var(--blue-100)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--bg-2)';
              e.currentTarget.style.color = 'var(--ink-2)';
              e.currentTarget.style.borderColor = 'var(--line-2)';
            }}
          >
            <span style={{ fontSize: 14 }}>←</span>
            Volver al sitio
          </button>
          <div style={{ padding: '0 8px 16px', borderBottom: '1px solid var(--line-2)', marginBottom: 12 }}>
            <div className="tag" style={{ color: kind === 'global' ? 'var(--blue)' : 'var(--yellow-600)' }}>
              Panel {kind === 'global' ? 'global' : 'de gestión'}
            </div>
            <div style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 16, marginTop: 4 }}>
              {kind === 'global' ? 'Administración' : (displayName || 'Mi cuenta')}
            </div>
            <div className="muted xs">{kind === 'global' ? 'AlquiloYa · Equipo' : (displayEmail || '')}</div>
          </div>
          <nav className="col gap-2">
            {items.map(it => (
              <button key={it.id} onClick={() => handleNav(it.id)} style={{
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
              {planLoading ? (
                // Skeleton mientras carga: evita que aparezca "Sin plan asignado"
                // y desaparezca al resolverse el plan real.
                <div style={{ marginTop: 24, padding: 14, background: 'var(--bg-2)', borderRadius: 12, border: '1px dashed var(--line-2)' }}>
                  <div style={{ height: 14, width: '60%', background: 'var(--bg-3)', borderRadius: 4 }}/>
                  <div style={{ height: 30, marginTop: 10, background: 'var(--bg-3)', borderRadius: 8 }}/>
                </div>
              ) : planInfo && planInfo.name ? (
                <div style={{ marginTop: 24, padding: 14, background: 'var(--yellow-50)', borderRadius: 12, fontSize: 12.5 }}>
                  <div style={{ fontWeight: 700, color: '#8a5e00' }}>Plan {planInfo.name}</div>
                  {planInfo.vencimiento ? (
                    <div style={{ color: '#8a5e00', marginTop: 4 }}>Renueva el {planInfo.vencimiento}</div>
                  ) : null}
                  <button onClick={() => onNav && onNav('plans')} className="btn btn-blue btn-sm" style={{ marginTop: 10, width: '100%', justifyContent: 'center' }}>Ver plan</button>
                </div>
              ) : (
                <div style={{ marginTop: 24, padding: 14, background: 'var(--bg-2)', borderRadius: 12, fontSize: 12.5, border: '1px dashed var(--line)' }}>
                  <div style={{ fontWeight: 700, color: 'var(--ink-3)' }}>Sin plan asignado</div>
                  <button onClick={() => onNav && onNav('plans')} className="btn btn-blue btn-sm" style={{ marginTop: 10, width: '100%', justifyContent: 'center' }}>Elegir un plan</button>
                </div>
              )}
              {/* "Ver mi perfil publico" SOLO para agentes — los propietarios
                  no tienen perfil publico que mostrar. */}
              {role === 'agente' && agentRoute && (
                <button onClick={() => onNav(agentRoute)} className="card" style={{ marginTop: 12, padding: 12, fontSize: 12.5, width: '100%', textAlign: 'left', cursor: 'pointer', border: '1px dashed var(--blue-100)' }}>
                  <div className="row gap-8">
                    <I.eye s={14}/>
                    <span style={{ fontWeight: 700, color: 'var(--blue)' }}>Ver mi perfil público</span>
                  </div>
                  <div className="muted xs" style={{ marginTop: 4 }}>Así te ven los propietarios</div>
                </button>
              )}
            </>
          )}
          {kind === 'global' && (
            <div style={{ marginTop: 24, padding: 14, background: 'var(--blue-50)', borderRadius: 12, fontSize: 12.5 }}>
              <div style={{ fontWeight: 700, color: 'var(--blue)' }}>Modo administrador</div>
              <div style={{ color: 'var(--ink-3)', marginTop: 4 }}>Acceso completo a la plataforma</div>
            </div>
          )}
        </aside>
        <main className="admin-main" style={{ padding: '20px 28px' }}>
          {(title || actions) && (
            <div className="row between admin-main-header" style={{ marginBottom: 18, alignItems: 'center' }}>
              <div className="row gap-10" style={{ alignItems: 'center', flex: 1, minWidth: 0 }}>
                <button type="button" className="admin-burger" onClick={() => setNavOpen(true)} aria-label="Abrir menú">
                  <I.grid s={18}/>
                </button>
                <div style={{ minWidth: 0 }}>
                  {title && <h2 style={{ fontSize: 19, lineHeight: 1.2 }}>{title}</h2>}
                  {subtitle && <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>{subtitle}</div>}
                </div>
              </div>
              <div className="row gap-8">
                {actions || (
                  <>
                    {/* Contador "4 nuevas" (consultas) ocultado en limpieza UI legacy. */}
                    {kind !== 'global' && <button onClick={() => goPublishCleanUrl(onNav)} style={{ padding: '6px 14px', height: 32, borderRadius: 8, background: 'var(--yellow)', border: 'none', color: 'var(--ink)', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6 }}><I.plus s={12}/> Cargar propiedad</button>}
                  </>
                )}
              </div>
            </div>
          )}
          {/* Floating action buttons when no header */}
          {!title && (
            <div className="row gap-8" style={{ alignItems: 'center', marginBottom: 14 }}>
              <button type="button" className="admin-burger" onClick={() => setNavOpen(true)} aria-label="Abrir menú">
                <I.grid s={18}/>
              </button>
              <div style={{ flex: 1 }}/>
              {/* Contador "4 nuevas" (consultas) ocultado en limpieza UI legacy. */}
              {kind !== 'global' && <button onClick={() => goPublishCleanUrl(onNav)} style={{ padding: '6px 14px', height: 32, borderRadius: 8, background: 'var(--yellow)', border: 'none', color: 'var(--ink)', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6 }}><I.plus s={12}/> Cargar propiedad</button>}
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
  // Snapshot persistente del estado derivado de AdminAgentPage. Sin esto,
  // cada vez que el usuario navega a "Carteles QR" (que es otro componente,
  // PostersPage) y vuelve a Resumen, AdminAgentPage se remonta con state
  // null y muestra los skeletons aunque la respuesta este cacheada — el
  // useEffect tiene que correr y resetear el state, lo que genera un flash.
  // Inicializamos directamente desde el snapshot para que el primer render
  // ya tenga los datos.
  const SNAP = (window.__AY_PANEL_SNAPSHOT = window.__AY_PANEL_SNAPSHOT || {});
  const [impulsesFree, setImpulsesFree] = React.useState(0);
  const [impulsesPaid, setImpulsesPaid] = React.useState(() => SNAP.impulsesPaid || 0);
  const [meData, setMeData] = React.useState(() => SNAP.meData || null); // { propietario, usuario, agente }
  const [meError, setMeError] = React.useState(null);

  // Cargar perfil real: agente PRIMERO (si la cuenta tiene agente_id ese es su
  // rol, aunque tambien aparezca como propietario por mismo email). Sino el
  // sidebar pierde Captaciones/Mi blog cuando navega a Carteles QR.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cf = window.ayCachedFetch || fetch;
        const r2 = await cf('/api/agente/me', { cache: 'no-store', credentials: 'include' });
        if (r2.ok) {
          const body2 = await r2.json();
          if (cancelled) return;
          if (body2?.agente) {
            const next = { kind: 'agente', usuario: body2.usuario, agente: body2.agente };
            setMeData(next);
            // Los agentes tambien acumulan impulsos_saldo desde que el admin
            // los acredita al aprobar una solicitud de impulsos. Si la columna
            // todavia no existia, el GET la devuelve undefined y caemos a 0.
            const saldoAg = Number(body2.agente.impulsos_saldo) || 0;
            setImpulsesPaid(saldoAg);
            SNAP.meData = next;
            SNAP.impulsesPaid = saldoAg;
            return;
          }
        }
        const r = await cf('/api/propietario/me', { cache: 'no-store', credentials: 'include' });
        if (r.ok) {
          const body = await r.json();
          if (cancelled) return;
          if (body?.propietario) {
            const next = { kind: 'propietario', usuario: body.usuario, propietario: body.propietario };
            setMeData(next);
            const saldo = Number(body.propietario.impulsos_saldo) || 0;
            setImpulsesPaid(saldo);
            SNAP.meData = next;
            SNAP.impulsesPaid = saldo;
            return;
          }
        }
      } catch (e) {
        if (!cancelled) setMeError(e && e.message);
      }
    })();
    return () => { cancelled = true; };
  }, []);
  const isPropietario = meData?.kind === 'propietario';

  // Fase 9B: "Mis propiedades" desde API real. Probamos primero propietario (si la
  // sesion es propietaria devuelve sus inmuebles), si no agente.
  const [myPropiedades, setMyPropiedades] = React.useState(() => SNAP.myPropiedades ?? null);
  // propsLoading: mientras es true mostramos skeleton, NO la data mock. Antes,
  // durante la carga, propsForRender caia a PROPERTIES (seed) y el usuario veia
  // un flash de propiedades ajenas/inventadas antes de que llegaran las suyas.
  // Si ya tenemos snapshot, arrancamos en false (no hay nada que esperar).
  const [propsLoading, setPropsLoading] = React.useState(() => SNAP.myPropiedades == null);
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      let body = null;
      const cf = window.ayCachedFetch || fetch;
      // Si la sesion es de propietario (incluso con 0 inmuebles) usamos esa.
      try {
        const r = await cf('/api/propietario/propiedades', { cache: 'no-store', credentials: 'include' });
        if (r.ok) {
          const b = await r.json();
          // /api/propietario/propiedades devuelve {success:true, propiedades:[]}
          // tambien para un agente (no es propietario). Solo lo aceptamos si
          // trae items; si viene vacio seguimos al endpoint de agente. Sino,
          // un agente con inmuebles veia 0 publicaciones.
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
        } catch { /* fallback mock */ }
      }
      if (cancelled) return;
      if (!body || !body.success || !Array.isArray(body.propiedades)) {
        // Sin sesion real: dejamos myPropiedades en null → fallback preview
        // (solo demo). Marcamos loading=false para no quedar en skeleton.
        setPropsLoading(false);
        return;
      }
      // Normalizar al shape consumido por las cards legacy (p.title/p.cover/p.price).
      // cover: null si no hay foto real (placeholder), NO una imagen random.
      const mapped = body.propiedades.map(p => ({
        id: p.id,
        apiId: p.id,
        codigo: p.codigo || null,
        title: p.titulo || 'Sin título',
        cover: p.cover_url || null,
        price: Number(p.precio) || 0,
        city: p.ciudad || '',
        neighborhood: p.barrio || '',
        lat: typeof p.lat === 'number' ? p.lat : null,
        lng: typeof p.lng === 'number' ? p.lng : null,
        // Campos usados por el brochure (la API ya los expone).
        beds: p.dormitorios ?? null,
        baths: p.banos ?? null,
        m2: p.superficie_m2 ?? null,
        desc: p.descripcion || '',
        operacion: p.operacion || '',
        verificada: !!p.verificada,
        estado: p.estado || '',
        activo: p.activo !== false,
        visible_web: !!p.visible_web,
        destacada: !!p.destacada,
        fotos_count: p.fotos_count || 0,
        // Info del plan gratis para mostrar banner "tu plan vence en X dias / vencio".
        plan_es_gratis: !!p.plan_es_gratis,
        plan_gratis_dias_restantes: typeof p.plan_gratis_dias_restantes === 'number' ? p.plan_gratis_dias_restantes : null,
        plan_gratis_expirado: !!p.plan_gratis_expirado,
        _real: true,
      }));
      // Marcamos como cargado AUNQUE este vacio. Empty array = "tengo sesion pero 0 propiedades".
      setMyPropiedades(mapped);
      SNAP.myPropiedades = mapped;
      setPropsLoading(false);
      // Notificacion: avisar cuando una propiedad aparece aprobada y todavia
      // no fue "ack-eada" por el usuario. Mantenemos un set de IDs ya
      // notificados en localStorage. La primera vez (sin key) marcamos todo
      // como ya visto para no spamear con publicaciones viejas.
      try {
        if (typeof window !== 'undefined' && window.ayToast) {
          const KEY = 'ay-prop-mod-approved-ack';
          const raw = localStorage.getItem(KEY);
          const ack = new Set(raw ? (JSON.parse(raw) || []) : []);
          const approvedNow = mapped.filter(p => p.activo && p.visible_web);
          if (raw === null) {
            // Primer arranque: silenciamos todo lo ya aprobado.
            approvedNow.forEach(p => ack.add(p.id));
            localStorage.setItem(KEY, JSON.stringify(Array.from(ack)));
          } else {
            const just = approvedNow.filter(p => !ack.has(p.id));
            just.forEach(p => ack.add(p.id));
            if (just.length) {
              localStorage.setItem(KEY, JSON.stringify(Array.from(ack)));
              just.forEach(p => {
                window.ayToast(p.title || 'Tu publicación ya está visible en la web.', {
                  title: '¡Propiedad aprobada!',
                  variant: 'success',
                  duration: 8000,
                });
              });
            }
          }
        }
      } catch { /* localStorage bloqueado / JSON invalido */ }
    })();
    return () => { cancelled = true; };
  }, []);
  // propsForRender:
  //  - cargando        → [] (renderizamos skeleton, NUNCA el mock)
  //  - cargado (array) → datos reales (aunque sea vacio)
  //  - sin sesion/demo → PROPERTIES (preview)
  const loadedProps = Array.isArray(myPropiedades);
  const propsForRender = loadedProps ? myPropiedades : (propsLoading ? [] : PROPERTIES);
  // KPIs derivados de datos reales del ERP. Si no hay propiedades reales, mostramos guiones.
  const hasRealProps = Array.isArray(myPropiedades);
  const totalProps = hasRealProps ? myPropiedades.length : 0;
  const destacadasCount = hasRealProps ? myPropiedades.filter(p => p.destacada).length : 0;
  const cerradasCount = hasRealProps ? myPropiedades.filter(p => /alquilado|vendido|cerrad|finalizado/i.test(String(p.estado || ''))).length : 0;
  const activasCount = hasRealProps ? myPropiedades.filter(p => p.activo).length : 0;
  const tasaCierre = totalProps > 0 ? Math.round((cerradasCount / totalProps) * 100) : 0;

  const [boostedIds, setBoostedIds] = React.useState({ [PROPERTIES[1].id]: true, [PROPERTIES[4].id]: true });
  const [buyOpen, setBuyOpen] = React.useState(false);
  const [verifyTarget, setVerifyTarget] = React.useState(null);
  const [verifiedIds, setVerifiedIds] = React.useState({ [PROPERTIES[0].id]: true });
  // brochureTarget = la propiedad cuyo boton "Brochure PDF" se apreto (antes
  // era un boolean y el modal mostraba SIEMPRE una casa mock con datos
  // inventados). Ahora generamos el brochure con los datos reales de ESA
  // propiedad.
  const [brochureTarget, setBrochureTarget] = React.useState(null);
  const [editProfileOpen, setEditProfileOpen] = React.useState(false);
  const [propFilter, setPropFilter] = React.useState('all');
  const totalAvailable = impulsesFree + impulsesPaid;

  const useBoost = async (id) => {
    if (boostedIds[id]) {
      setBoostedIds(b => { const n = { ...b }; delete n[id]; return n; });
      return;
    }
    if (totalAvailable <= 0) { setBuyOpen(true); return; }
    // Si es propietario, gastar impulso real via API.
    if (isPropietario) {
      try {
        const res = await fetch('/api/propietario/propiedades/' + id + '/usar-impulso', {
          method: 'POST', credentials: 'include',
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) throw new Error((data && data.error) || ('HTTP ' + res.status));
        if (window.ayInvalidate) {
          window.ayInvalidate('/api/propietario/propiedades');
          window.ayInvalidate('/api/propietario/me');
          window.ayInvalidate('/api/agente/propiedades');
        }
        // Bustear snapshot para que la proxima remontada del panel
        // refetchee y refleje el nuevo saldo / destacada.
        if (window.__AY_PANEL_SNAPSHOT) {
          window.__AY_PANEL_SNAPSHOT.myPropiedades = null;
          window.__AY_PANEL_SNAPSHOT.impulsesPaid = Number(data.saldo_restante) || 0;
        }
        setBoostedIds(b => ({ ...b, [id]: true }));
        setImpulsesPaid(Number(data.saldo_restante) || 0);
        return;
      } catch (e) {
        window.alert('No se pudo destacar: ' + (e.message || 'error'));
        return;
      }
    }
    // Fallback (agente / mock).
    setBoostedIds(b => ({ ...b, [id]: true }));
    if (impulsesFree > 0) setImpulsesFree(v => v - 1);
    else setImpulsesPaid(v => v - 1);
  };
  const onBuy = async (pack) => {
    // SIEMPRE generamos una solicitud_servicio (kind=impulsos). El saldo
    // recien se acredita cuando el admin la aprueba — NUNCA aca en el cliente.
    // Antes habia un "fallback mock" que sumaba pack.qty al impulsesPaid si
    // meData no estaba cargado todavia, lo que hacia parecer que los impulsos
    // se cargaban automaticamente y la solicitud no llegaba al admin.
    // No filtramos por meData en el cliente — mandamos el POST con lo que
    // tengamos y dejamos que el server valide (nombre + email/telefono).
    const profile = isPropietario ? meData?.propietario : meData?.agente;
    const nombre =
      profile?.nombre ||
      meData?.usuario?.nombre ||
      meData?.usuario?.email ||
      'Compra desde el panel';
    const email = profile?.email || meData?.usuario?.email || '';
    const telefono = profile?.telefono || profile?.whatsapp || '';
    try {
      const res = await fetch('/api/public/alquiloya/solicitudes-servicio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // credentials: include para que la cookie de sesion viaje y el server
        // pueda guardar agente_id / propietario_id en la solicitud — sino el
        // admin tiene que adivinar al titular por email/telefono.
        credentials: 'include',
        body: JSON.stringify({
          kind: 'impulsos',
          nombre,
          email: email || null,
          telefono: telefono || null,
          pack_id: pack.id, pack_qty: pack.qty, monto: pack.price,
          mensaje: isPropietario ? 'Compra desde portal propietario' : 'Compra desde portal agente',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) throw new Error((data && data.error) || ('HTTP ' + res.status));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message || 'error' };
    }
  };

  // Reset scroll when changing section
  React.useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [route]);

  const view = ({
    'admin-agent': 'overview',
    'admin-agent-properties': 'properties',
    'admin-agent-captures': 'captures',
    'admin-agent-queries': 'queries',
    'admin-agent-blog': 'blog',
    'admin-agent-profile': 'profile',
  })[route] || 'overview';

  const titles = {
    overview: ['', ''],
    properties: ['Mis propiedades', 'Editá, pausá o destacá tus inmuebles publicados.'],
    captures: ['Captaciones', 'Propiedades que capturaste de propietarios + comisión por cierre.'],
    queries: ['Consultas', 'Mensajes de interesados en tus inmuebles.'],
    blog: ['Mi blog', 'Publicá artículos, guías y novedades. Aparecen en tu perfil público.'],
    profile: ['Mi perfil', 'Información que ven los propietarios al elegirte como agente.'],
  };

  return (
    <AdminLayout
      kind="agent"
      role={meData ? (isPropietario ? 'propietario' : 'agente') : undefined}
      planLoading={meData === null}
      route={route}
      onNav={onNav}
      title={titles[view][0]}
      subtitle={titles[view][1]}
      displayName={
        meData
          ? (isPropietario
              ? (meData.propietario?.nombre || meData.usuario?.nombre)
              : (meData.agente?.nombre || meData.usuario?.nombre))
          : null
      }
      displayEmail={
        meData
          ? (meData.usuario?.email
             || (isPropietario ? meData.propietario?.email : meData.agente?.email)
             || '')
          : ''
      }
      planInfo={(() => {
        const src = isPropietario ? meData?.propietario : meData?.agente;
        if (!src) return null;
        // /api/agente/me expone el plan como objeto anidado `agente.plan` (con
        // nombre, tier, billing). Antes leíamos `src.plan_nombre` (campo flat
        // inexistente) → el sidebar mostraba "Sin plan asignado" aunque el
        // agente tuviera plan. Soportamos ambos por si algún endpoint lo
        // expone diferente.
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
        // URL al perfil público del AGENTE logueado (no de mariana-lopez,
        // que era hardcoded). Usa el id como fallback robusto si cambia el
        // nombre / slug.
        const ag = !isPropietario ? meData?.agente : null;
        if (!ag?.id) return null;
        const nombreSlug = String(ag.nombre || '')
          .normalize('NFD').replace(/[̀-ͯ]/g, '')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '') || 'agente';
        return 'agent/' + (ag.slug || nombreSlug) + '?id=' + ag.id;
      })()}
    >
      {view === 'overview' && <ImpulseBanner free={impulsesFree} paid={impulsesPaid} freeMax={10} onBuy={() => setBuyOpen(true)}/>}

      {/* KPI strip — single card, 4 metrics separated by thin lines */}
      {view === 'overview' && (
      <div className="card" style={{ padding: 0, marginTop: 14, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {[
            { label: 'Mis propiedades',      value: hasRealProps ? String(totalProps) : '—', sub: hasRealProps ? `${destacadasCount} destacada${destacadasCount !== 1 ? 's' : ''}` : 'sin datos',         icon: 'house', color: 'var(--blue)',       trend: 'up' },
            { label: 'Activas',              value: hasRealProps ? String(activasCount) : '—', sub: hasRealProps ? `${totalProps - activasCount} pausada${(totalProps - activasCount) !== 1 ? 's' : ''}` : 'sin datos', icon: 'eye',   color: 'var(--green)',      trend: 'up' },
            { label: 'Cierres acumulados',   value: hasRealProps ? String(cerradasCount) : '—', sub: hasRealProps ? `sobre ${totalProps} publicaciones` : 'sin datos',                                                  icon: 'whats', color: 'var(--yellow-600)', trend: 'up' },
            { label: 'Tasa de cierre',       value: hasRealProps && totalProps > 0 ? `${tasaCierre}%` : '—', sub: hasRealProps ? `${cerradasCount} cerrada${cerradasCount !== 1 ? 's' : ''}` : 'sin datos',           icon: 'trend', color: '#6e3ad1',           trend: 'up' },
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
              <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 2 }}>{propsLoading ? 'Cargando…' : `${propsForRender.length} publicada${propsForRender.length !== 1 ? 's' : ''} · ${destacadasCount} destacada${destacadasCount !== 1 ? 's' : ''}`}</div>
            </div>
            <div style={{ display: "inline-flex", gap: 2, background: "#f1f5f9", padding: 3, borderRadius: 10, border: "1px solid var(--line-2)" }}>
              {[
                { id: 'all',    label: 'Todas' },
                { id: 'active', label: 'Activas' },
                { id: 'paused', label: 'Pausadas' },
              ].map(it => (
                <button key={it.id} onClick={() => setPropFilter(it.id)} style={{
                  padding: "6px 14px", borderRadius: 7, border: "none",
                  background: propFilter === it.id ? "#fff" : "transparent",
                  color: propFilter === it.id ? "var(--ink)" : "var(--ink-3)",
                  fontWeight: 600, cursor: "pointer", fontSize: 12, fontFamily: "inherit",
                  boxShadow: propFilter === it.id ? "0 1px 3px rgba(15,23,42,0.12)" : "none",
                  transition: "all .15s ease",
                }}>{it.label}</button>
              ))}
            </div>
          </div>

          {/* Lista de propiedades — cards individuales, no tabla */}
          <div className="col gap-8">
            {propsLoading ? (
              // Skeleton mientras cargan los datos reales — evita el flash de mock.
              [0,1,2].map(i => (
                <div key={'sk'+i} className="card" style={{ padding: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ width: 84, height: 64, borderRadius: 8, background: 'linear-gradient(90deg,#eef2f7,#f6f8fb,#eef2f7)', backgroundSize: '200% 100%', animation: 'fadeIn .4s', flexShrink: 0 }}/>
                  <div style={{ flex: 1 }}>
                    <div style={{ height: 12, width: '55%', borderRadius: 6, background: '#eef2f7', marginBottom: 8 }}/>
                    <div style={{ height: 10, width: '35%', borderRadius: 6, background: '#f0f3f7' }}/>
                  </div>
                </div>
              ))
            ) : propsForRender.slice(0, 6).map((p, i) => {
              // Estado normalizado para badges + selector. Mock: índice 2 = pausada.
              const estadoLc = String(p.estado || '').toLowerCase();
              const isAlquilada = p._real && estadoLc === 'alquilada';
              const isReservada = p._real && estadoLc === 'reservada';
              const isPaused = p._real
                ? (estadoLc === 'pausada' || p.activo === false)
                : (i === 2);
              const isBoosted = !!boostedIds[p.id] || !!p.destacada;
              const status = isPaused ? 'paused' : 'active';
              if (propFilter !== 'all' && propFilter !== status) return null;
              const currentEstadoOption = isAlquilada
                ? 'alquilada'
                : isReservada
                  ? 'reservada'
                  : isPaused ? 'pausada' : 'activa';
              // Banner plan gratis: aviso si quedan <=7 dias o ya vencio.
              const showPlanGratisWarning = p._real && p.plan_es_gratis && !p.plan_gratis_expirado
                && typeof p.plan_gratis_dias_restantes === 'number'
                && p.plan_gratis_dias_restantes <= 7;
              const showPlanGratisExpired = p._real && p.plan_es_gratis && p.plan_gratis_expirado;
              const planBanner = showPlanGratisExpired ? (
                <div style={{
                  padding: '10px 14px', borderRadius: 10, marginBottom: 8,
                  background: '#fff4f4', border: '1px solid #f1c4c4',
                  borderLeft: '3px solid #d93838',
                  display: 'flex', alignItems: 'center', gap: 12, fontSize: 12.5, color: 'var(--ink-2)',
                }}>
                  <span style={{ fontSize: 16 }}>⚠</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong>Tu publicación gratuita venció.</strong> Esta propiedad ya no se muestra en el sitio.
                    Comprá un plan pago para volver a publicarla.
                  </div>
                  <button onClick={() => onNav && onNav('plans')} style={{
                    padding: '6px 12px', borderRadius: 8, background: '#d93838',
                    color: '#fff', border: 'none', cursor: 'pointer',
                    fontWeight: 700, fontSize: 12, fontFamily: 'inherit', whiteSpace: 'nowrap',
                  }}>Ver planes</button>
                </div>
              ) : showPlanGratisWarning ? (
                <div style={{
                  padding: '10px 14px', borderRadius: 10, marginBottom: 8,
                  background: '#fffaf0', border: '1px solid #f5d585',
                  borderLeft: '3px solid var(--yellow-600)',
                  display: 'flex', alignItems: 'center', gap: 12, fontSize: 12.5, color: 'var(--ink-2)',
                }}>
                  <span style={{ fontSize: 16 }}>⏰</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    Tu plan gratuito vence en <strong>{p.plan_gratis_dias_restantes} {p.plan_gratis_dias_restantes === 1 ? 'día' : 'días'}</strong>.
                    Comprá un plan pago para mantener tu publicación activa.
                  </div>
                  <button onClick={() => onNav && onNav('plans')} style={{
                    padding: '6px 12px', borderRadius: 8, background: 'var(--ink)',
                    color: '#fff', border: 'none', cursor: 'pointer',
                    fontWeight: 700, fontSize: 12, fontFamily: 'inherit', whiteSpace: 'nowrap',
                  }}>Ver planes</button>
                </div>
              ) : null;
              return (
                <React.Fragment key={p.id}>
                {planBanner}
                <div className="card" style={{
                  padding: 12, display: 'flex', alignItems: 'center', gap: 14,
                  transition: 'border-color .12s, box-shadow .12s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--blue-100)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,88,165,.06)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}>
                  {/* Thumbnail — placeholder "sin imagen" si no hay foto real. */}
                  {p.cover ? (
                    <Photo src={p.cover} style={{ width: 64, height: 64, borderRadius: 10, flexShrink: 0 }}/>
                  ) : (
                    <div style={{ width: 64, height: 64, borderRadius: 10, flexShrink: 0, background: 'var(--bg-3)', color: 'var(--ink-4)', display: 'grid', placeItems: 'center' }} title="Sin imagen">
                      <I.grid s={20}/>
                    </div>
                  )}

                  {/* Info principal */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="row gap-8" style={{ alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>{p.title}</span>
                      {isAlquilada
                        ? <span style={{ padding: '1px 7px', borderRadius: 999, background: '#e8eef9', color: 'var(--blue)', fontSize: 9.5, fontWeight: 600 }}>Alquilada</span>
                        : isReservada
                          ? <span style={{ padding: '1px 7px', borderRadius: 999, background: '#fff4e0', color: 'var(--yellow-600)', fontSize: 9.5, fontWeight: 600 }}>Reservada</span>
                          : isPaused
                            ? <span style={{ padding: '1px 7px', borderRadius: 999, background: 'var(--bg-3)', color: 'var(--ink-3)', fontSize: 9.5, fontWeight: 600 }}>Pausada</span>
                            : isBoosted
                              ? <span style={{ padding: '1px 7px', borderRadius: 999, background: 'var(--yellow)', color: 'var(--ink)', fontSize: 9.5, fontWeight: 700 }}>Destacada</span>
                              : <span style={{ padding: '1px 7px', borderRadius: 999, background: '#eaf6f0', color: 'var(--green)', fontSize: 9.5, fontWeight: 600 }}>Activa</span>}
                      {verifiedIds[p.id] && <span style={{ padding: '1px 7px', borderRadius: 999, background: 'var(--blue-50)', color: 'var(--blue)', fontSize: 9.5, fontWeight: 600 }}>✓ Verificada</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11.5, color: 'var(--ink-3)' }}>
                      {p.codigo ? <span className="mono" style={{ fontSize: 10.5, color: 'var(--ink-4)' }}>{p.codigo}</span> : null}
                      <span style={{ fontWeight: 700, color: 'var(--blue)' }}>{formatGs(p.price)}<span style={{ color: 'var(--ink-4)', fontWeight: 500 }}> /mes</span></span>
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
                    <button onClick={() => setBrochureTarget(p)} title="Brochure PDF"
                      style={{ padding: 0, width: 28, height: 28, borderRadius: 8, background: 'transparent', color: 'var(--ink-3)', border: '1px solid var(--line)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
                      <I.doc s={13}/>
                    </button>
                    <button onClick={() => onNav && onNav('admin-agent-qr')} title="Ver cartel QR" style={{ padding: 0, width: 28, height: 28, borderRadius: 8, background: 'transparent', color: 'var(--ink-3)', border: '1px solid var(--line)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
                      <I.qr s={13}/>
                    </button>
                    {/* Cambiar estado: PATCH /propiedades/:id { estado }. */}
                    {p._real && (
                      <select
                        value={currentEstadoOption}
                        onChange={async (e) => {
                          const nuevo = e.target.value;
                          if (nuevo === currentEstadoOption) return;
                          try {
                            const r = await fetch('/api/public/alquiloya/propiedades/' + encodeURIComponent(p.apiId || p.id), {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              credentials: 'include',
                              body: JSON.stringify({ estado: nuevo }),
                            });
                            const b = await r.json().catch(() => ({}));
                            if (!r.ok || !b?.success) throw new Error(b?.error || ('HTTP ' + r.status));
                            if (window.ayToast) window.ayToast('Estado actualizado.', { variant: 'success', duration: 3500 });
                            setMyPropiedades(prev => Array.isArray(prev)
                              ? prev.map(x => x.id === p.id
                                  ? Object.assign({}, x, { estado: nuevo, activo: nuevo === 'activa', visible_web: nuevo === 'activa' })
                                  : x)
                              : prev);
                          } catch (err) {
                            if (window.ayToast) window.ayToast('No se pudo cambiar el estado.', { variant: 'error' });
                          }
                        }}
                        title="Cambiar estado"
                        style={{
                          height: 28, borderRadius: 8, padding: '0 24px 0 8px',
                          border: '1px solid var(--line)', background: '#fff',
                          color: 'var(--ink-2)', fontSize: 12, fontWeight: 600,
                          fontFamily: 'inherit', cursor: 'pointer',
                          appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none',
                          backgroundImage: 'url("data:image/svg+xml;utf8,<svg xmlns=%27http://www.w3.org/2000/svg%27 width=%2710%27 height=%276%27 viewBox=%270 0 10 6%27 fill=%27none%27><path d=%27M1 1l4 4 4-4%27 stroke=%27%23475569%27 stroke-width=%271.6%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27/></svg>")',
                          backgroundRepeat: 'no-repeat',
                          backgroundPosition: 'right 8px center',
                        }}
                        className="ay-state-select">
                        <option value="activa">Activa</option>
                        <option value="pausada">Pausada</option>
                        <option value="alquilada">Alquilada</option>
                        <option value="reservada">Reservada</option>
                      </select>
                    )}
                    <button onClick={() => {
                      // Guardamos el id de la propiedad a editar en un global
                      // que PublishPage lee al montar para prefillear el form
                      // y cambiar el submit a PATCH.
                      try { window.__AY_EDIT_PROP_ID = p.apiId || p.id || null; } catch {}
                      goPublishCleanUrl(onNav);
                    }} title="Editar" style={{ padding: '0 14px', height: 28, borderRadius: 8, background: 'var(--ink)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}>
                      Editar
                    </button>
                    {/* Borrar (soft-delete). Solo propiedades reales. */}
                    {p._real && (
                      <button onClick={async () => {
                        if (!confirm('¿Eliminar esta propiedad? Dejará de mostrarse en el sitio. Podés pedirle al equipo que la restaure si fue un error.')) return;
                        try {
                          const r = await fetch('/api/public/alquiloya/propiedades/' + encodeURIComponent(p.apiId || p.id), {
                            method: 'DELETE',
                            credentials: 'include',
                          });
                          const b = await r.json().catch(() => ({}));
                          if (!r.ok || !b?.success) throw new Error(b?.error || ('HTTP ' + r.status));
                          if (window.ayToast) window.ayToast('Propiedad eliminada.', { variant: 'success', duration: 3500 });
                          setMyPropiedades(prev => Array.isArray(prev) ? prev.filter(x => x.id !== p.id) : prev);
                        } catch (err) {
                          if (window.ayToast) window.ayToast('No se pudo eliminar la propiedad.', { variant: 'error' });
                        }
                      }} title="Eliminar"
                        style={{ padding: 0, width: 28, height: 28, borderRadius: 8, background: 'transparent', color: '#d93838', border: '1px solid #f1c4c4', cursor: 'pointer', display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 700, fontFamily: 'inherit' }}>
                        ×
                      </button>
                    )}
                  </div>
                </div>
                </React.Fragment>
              );
            })}
          </div>

          {/* Footer / ver todas */}
          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
            <span style={{ color: 'var(--ink-4)' }}>Mostrando {Math.min(6, propsForRender.length)} de {propsForRender.length}</span>
            {view === 'overview' && propsForRender.length > 6 && (
              <button onClick={() => onNav && onNav('admin-agent-properties')} style={{ background: 'none', border: 'none', color: 'var(--blue)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>
                Ver todas →
              </button>
            )}
          </div>
        </div>

        {view === 'overview' && (
        <div className="col gap-12">
          {/* Embudo + consultas recientes — solo agentes (los propietarios no tienen). */}
          {!isPropietario && <EmbudoCaptaciones/>}
          {!isPropietario && <ConsultasRecientes onNav={onNav}/>}

          {/* QR mini */}
          <div className="card" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--blue-50)', color: 'var(--blue)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <I.qr s={16}/>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 11.5 }}>Carteles QR</div>
              <div style={{ fontSize: 10, color: 'var(--ink-4) '}}>Generá carteles imprimibles para tus inmuebles</div>
            </div>
            <button onClick={() => onNav('admin-agent-qr')} style={{ background: 'transparent', border: '1px solid var(--line)', borderRadius: 6, padding: '5px 9px', fontSize: 11, fontWeight: 600, cursor: 'pointer', color: 'var(--ink-2)', fontFamily: 'inherit' }}>Ver</button>
          </div>
        </div>
        )}
      </div>
      )}

      {view === 'captures' && <CapturesSection onNav={onNav}/>}

      {view === 'blog' && <BlogSection/>}

      {view === 'queries' && <QueriesSection/>}

      {view === 'profile' && !meData && (
        // Skeleton mientras resuelve la sesion — evita el flash "Agente / A /
        // 0 publicaciones" antes de tener los datos reales del perfil.
        <div>
          <div className="tag">Perfil</div>
          <h3 style={{ fontSize: 20, marginTop: 4 }}>Mi perfil</h3>
          <div className="card" style={{ padding: 22, marginTop: 16, display: 'flex', gap: 18, alignItems: 'center' }}>
            <div style={{ width: 68, height: 68, borderRadius: '50%', background: '#eef2f7', flexShrink: 0 }}/>
            <div style={{ flex: 1 }}>
              <div style={{ height: 14, width: '40%', borderRadius: 6, background: '#eef2f7', marginBottom: 10 }}/>
              <div style={{ height: 10, width: '60%', borderRadius: 6, background: '#f0f3f7' }}/>
            </div>
          </div>
        </div>
      )}

      {view === 'profile' && meData && (() => {
        const profile = isPropietario ? meData?.propietario : meData?.agente;
        const profileName = profile?.nombre || meData?.usuario?.nombre || (isPropietario ? 'Propietario' : 'Agente');
        const profileSubLines = [];
        if (!isPropietario && profile?.cargo) profileSubLines.push(profile.cargo);
        if (profile?.ciudad || profile?.barrio) profileSubLines.push([profile.barrio, profile.ciudad].filter(Boolean).join(', '));
        if (profile?.created_at) profileSubLines.push(`En AlquiloYa desde ${new Date(profile.created_at).getFullYear()}`);
        const slug = profile?.slug || (profileName || '').toLowerCase().replace(/\s+/g, '-');
        return (
        <div>
          <div className="tag">Perfil</div>
          <h3 style={{ fontSize: 20, marginTop: 4 }}>{isPropietario ? 'Mi perfil' : 'Mi perfil de agente'}</h3>
          <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>Datos visibles en tu página pública. Estos datos los ven los propietarios cuando elijen un agente.</div>
          <div className="card" style={{ padding: 22, marginTop: 16, display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 18, alignItems: 'center' }}>
            <AgentAvatarUploader
              fotoUrl={!isPropietario ? (profile?.foto_url || null) : null}
              name={profileName}
              size={68}
              canUpload={!isPropietario}
              onUploaded={(url) => {
                setMeData((prev) => {
                  if (!prev) return prev;
                  const merged = { ...prev, agente: { ...prev.agente, foto_url: url } };
                  SNAP.meData = merged;
                  return merged;
                });
              }}
            />
            <div>
              <div className="row gap-10" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 17 }}>{profileName}</div>
                {!isPropietario && profile?.verificado ? <span className="badge badge-verified" style={{ fontSize: 10 }}><I.check s={10}/> Verificado</span> : null}
                {!isPropietario && profile?.nivel ? <span className="badge" style={{ background: 'var(--yellow)', color: 'var(--ink)', fontSize: 10 }}>{profile.nivel}</span> : null}
              </div>
              {profileSubLines.length > 0 ? (
                <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>{profileSubLines.join(' · ')}</div>
              ) : null}
              <div className="row gap-16" style={{ marginTop: 8, fontSize: 12.5, color: 'var(--ink-2)', flexWrap: 'wrap' }}>
                <span><I.house s={12}/> <strong>{hasRealProps ? totalProps : 0}</strong> publicaciones</span>
                {hasRealProps && cerradasCount > 0 ? <span><I.check s={12}/> {cerradasCount} cerradas</span> : null}
                {meData?.usuario?.email ? <span><I.user s={12}/> {meData.usuario.email}</span> : null}
              </div>
            </div>
            <div className="col gap-8">
              {profile?.id && !isPropietario ? (
                <button onClick={() => onNav('agent/' + slug + '?id=' + profile.id)} className="btn btn-blue btn-sm">Ver perfil público →</button>
              ) : null}
              <button className="btn btn-outline btn-sm" onClick={() => setEditProfileOpen(true)}>Editar datos</button>
            </div>
          </div>
        </div>
        );
      })()}

      {buyOpen && <BuyImpulsesModal onClose={() => setBuyOpen(false)} onBuy={onBuy}/>}
      {verifyTarget && (
        <VerificationModal
          propertyId={verifyTarget.id}
          propertyTitle={verifyTarget.title}
          onClose={() => setVerifyTarget(null)}
        />
      )}
      {brochureTarget && (
        <BrochurePreviewModal
          property={brochureTarget}
          contacto={{
            nombre: (isPropietario ? meData?.propietario?.nombre : meData?.agente?.nombre) || '',
            telefono: (isPropietario ? meData?.propietario?.telefono : meData?.agente?.telefono) || '',
            whatsapp: (isPropietario ? meData?.propietario?.telefono : meData?.agente?.whatsapp) || '',
          }}
          onClose={() => setBrochureTarget(null)}
        />
      )}
      {editProfileOpen && meData && (
        <EditProfileModal
          isPropietario={isPropietario}
          profile={isPropietario ? meData.propietario : meData.agente}
          onClose={() => setEditProfileOpen(false)}
          onSaved={(next) => {
            setMeData((prev) => {
              if (!prev) return prev;
              const merged = isPropietario
                ? { ...prev, propietario: { ...prev.propietario, ...next } }
                : { ...prev, agente: { ...prev.agente, ...next } };
              SNAP.meData = merged;
              return merged;
            });
            if (window.ayInvalidate) {
              window.ayInvalidate('/api/agente/me');
              window.ayInvalidate('/api/propietario/me');
            }
            setEditProfileOpen(false);
            if (window.ayToast) window.ayToast('Datos actualizados.', { variant: 'success', duration: 4000 });
          }}
        />
      )}
    </AdminLayout>
  );
}

// Avatar editable del agente: muestra la foto actual (foto_url) o las iniciales
// como fallback, y permite subir/cambiar la foto. POST multipart a
// /api/agente/me/foto. Validación de tipo y tamaño en cliente + servidor.
function AgentAvatarUploader({ fotoUrl, name, size = 68, canUpload, onUploaded }) {
  const inputRef = React.useRef(null);
  const [busy, setBusy] = React.useState(false);
  async function onPick(e) {
    const file = e.target.files && e.target.files[0];
    if (e.target) e.target.value = ''; // permite re-subir el mismo archivo
    if (!file) return;
    if (!/^image\/(jpe?g|png|webp)$/i.test(file.type)) {
      if (window.ayToast) window.ayToast('Formato no válido. Usá una imagen JPG, PNG o WEBP.', { variant: 'error', duration: 5000 });
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      if (window.ayToast) window.ayToast('La imagen supera el máximo de 4 MB.', { variant: 'error', duration: 5000 });
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch('/api/agente/me/foto', { method: 'POST', credentials: 'include', body: fd });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.success) throw new Error(data.error || ('HTTP ' + r.status));
      if (window.ayInvalidate) window.ayInvalidate('/api/agente/me');
      onUploaded && onUploaded(data.foto_url);
      if (window.ayToast) window.ayToast('Foto de perfil actualizada.', { variant: 'success', duration: 4000 });
    } catch (err) {
      if (window.ayToast) window.ayToast('No pudimos subir la foto. ' + (err && err.message ? err.message : ''), { variant: 'error', duration: 6000 });
    } finally {
      setBusy(false);
    }
  }
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      {fotoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={fotoUrl} alt={name || 'Foto de perfil'} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', display: 'block', background: 'var(--bg-3)' }}/>
      ) : (
        <Avatar name={name} size={size}/>
      )}
      {canUpload && (
        <>
          <button type="button" onClick={() => inputRef.current && inputRef.current.click()} disabled={busy}
            title={fotoUrl ? 'Cambiar foto' : 'Subir foto'}
            style={{ position: 'absolute', bottom: -2, right: -2, width: 28, height: 28, borderRadius: '50%', background: 'var(--blue)', color: '#fff', border: '2px solid #fff', cursor: busy ? 'default' : 'pointer', display: 'grid', placeItems: 'center', opacity: busy ? .6 : 1, boxShadow: '0 2px 6px rgba(0,0,0,.2)' }}>
            <I.upload s={13}/>
          </button>
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={onPick} style={{ display: 'none' }}/>
        </>
      )}
    </div>
  );
}

// Modal de edicion del perfil (agente o propietario). Campos visibles segun
// el rol. PATCH a /api/agente/me o /api/propietario/me.
function EditProfileModal({ isPropietario, profile, onClose, onSaved }) {
  const p = profile || {};
  const [form, setForm] = React.useState({
    nombre: p.nombre || '',
    telefono: p.telefono || '',
    whatsapp: p.whatsapp || '',
    cargo: p.cargo || '',
    bio: p.bio || '',
  });
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState(null);
  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }
  async function submit(e) {
    e && e.preventDefault && e.preventDefault();
    if (!form.nombre.trim()) { setErr('El nombre es obligatorio.'); return; }
    setSaving(true); setErr(null);
    try {
      const url = isPropietario ? '/api/propietario/me' : '/api/agente/me';
      const payload = isPropietario
        ? { nombre: form.nombre.trim(), telefono: form.telefono.trim() }
        : {
            nombre: form.nombre.trim(),
            telefono: form.telefono.trim(),
            whatsapp: form.whatsapp.trim(),
            cargo: form.cargo.trim(),
            bio: form.bio.trim(),
          };
      const r = await fetch(url, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.success) throw new Error(data.error || ('HTTP ' + r.status));
      onSaved(isPropietario ? data.propietario : data.agente);
    } catch (e) {
      setErr(e && e.message ? e.message : 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  }
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(11,22,34,.55)', zIndex: 200,
      display: 'grid', placeItems: 'center', padding: 16, overflowY: 'auto'
    }}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={submit} style={{
        background: '#fff', borderRadius: 16, padding: 22, width: '100%', maxWidth: 480,
        boxShadow: '0 20px 50px rgba(0,0,0,.25)'
      }}>
        <div style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 17 }}>Editar mis datos</div>
        <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
          Datos visibles en tu página pública.
        </div>
        <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
          <label style={{ display: 'block' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 4 }}>NOMBRE *</div>
            <input className="input" value={form.nombre} onChange={(e) => set('nombre', e.target.value)} disabled={saving} required maxLength={160} style={{ width: '100%' }}/>
          </label>
          <label style={{ display: 'block' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 4 }}>TELÉFONO</div>
            <input className="input" value={form.telefono} onChange={(e) => set('telefono', e.target.value)} disabled={saving} maxLength={40} style={{ width: '100%' }}/>
          </label>
          {!isPropietario && (
            <>
              <label style={{ display: 'block' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 4 }}>WHATSAPP</div>
                <input className="input" value={form.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} disabled={saving} maxLength={40} style={{ width: '100%' }}/>
              </label>
              <label style={{ display: 'block' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 4 }}>CARGO</div>
                <input className="input" value={form.cargo} onChange={(e) => set('cargo', e.target.value)} disabled={saving} maxLength={120} placeholder="Ej. Asesor inmobiliario" style={{ width: '100%' }}/>
              </label>
              <label style={{ display: 'block' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 4 }}>BIO</div>
                <textarea className="input" rows={3} value={form.bio} onChange={(e) => set('bio', e.target.value)} disabled={saving} maxLength={1000} style={{ width: '100%', resize: 'vertical' }}/>
              </label>
            </>
          )}
        </div>
        {err ? <div style={{ marginTop: 10, color: '#b91c1c', fontSize: 12 }}>{err}</div> : null}
        <div className="row gap-10" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </div>
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

function CapturesSection({ onNav }) {
  const [showAll, setShowAll] = React.useState(false);
  const [captarOpen, setCaptarOpen] = React.useState(false);
  const [reloadKey, setReloadKey] = React.useState(0);
  // Captaciones reales del agente logueado (Fase 12A). Distinguimos 3 estados:
  // - null      => cargando
  // - []        => respuesta OK pero sin captaciones (agente nuevo) -> empty state
  // - [c, c..]  => captaciones reales
  // - 'mock'    => el endpoint falló O no hay sesión: caemos al mock SOLO en ese caso
  const [realCapt, setRealCapt] = React.useState(null);
  const [realErr, setRealErr] = React.useState(null);
  // Forzamos fetch directo (no ayCachedFetch) — los leads cambian de etapa
  // desde el dashboard y el agente espera ver el cambio inmediato al
  // volver a su panel. ayCachedFetch tiene TTL de 60s y dejaba data vieja.
  React.useEffect(() => {
    let cancelled = false;
    fetch('/api/agente/captaciones', { cache: 'no-store', credentials: 'include' })
      .then(r => {
        if (cancelled) return null;
        if (r.status === 401 || r.status === 403) { setRealCapt('mock'); return null; }
        return r.ok ? r.json() : null;
      })
      .then(b => {
        if (cancelled) return;
        if (!b) { if (realCapt === null) setRealCapt([]); return; }
        if (b.success && Array.isArray(b.captaciones)) setRealCapt(b.captaciones);
        else setRealCapt([]);
      })
      .catch(e => { if (!cancelled) { setRealErr((e && e.message) || 'error'); setRealCapt('mock'); } });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);
  const isLoading = realCapt === null;
  const useMock = realCapt === 'mock';
  const realList = Array.isArray(realCapt) ? realCapt : [];
  // Si hay captaciones reales (sesion activa), las usamos. Sino mock de demo.
  const realCaptMapped = realList.map((r, i) => ({
    propertyId: r.propiedad_titulo ? (r.propiedad_titulo.length > 28 ? r.propiedad_titulo.slice(0, 28) + '…' : r.propiedad_titulo) : `CAPT-${i + 1}`,
    agentId: 'AG-REAL',
    date: (r.created_at || '').slice(0, 10).split('-').reverse().join('/'),
    status: /cerrad|alquilad|vendid/i.test(String(r.etapa || '')) ? 'cerrada' : 'gestionando',
    owner: r.propietario_nombre || '—',
    rentPrice: 0,
    commission: 0,
    paid: false,
    _real: true,
    _id: r.id,
    _etapa: r.etapa || 'nuevo',
    _titulo: r.propiedad_titulo,
    _ciudad: r.ciudad,
    _barrio: r.barrio,
    _email: r.propietario_email,
    _telefono: r.propietario_telefono,
    _mensaje: r.mensaje,
    _origen: r.origen,
  }));
  const hasRealCapt = realCaptMapped.length > 0;
  // Solo caemos al mock si el fetch fallo (useMock). Si la respuesta vino vacia
  // (agente nuevo sin captaciones), mostramos empty state — NO mock.
  const allCaptures = hasRealCapt
    ? realCaptMapped
    : (useMock ? CAPTURES.filter(c => c.agentId === 'AG-001') : []);
  // Generate extra historical captures for the "historial completo" view
  const extras = React.useMemo(() => {
    if (!showAll || hasRealCapt || !useMock) return [];
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
  }, [showAll, useMock]);
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
        <div className="row gap-10" style={{ alignItems: 'center' }}>
          <button onClick={() => setCaptarOpen(true)} style={{
            background: 'var(--yellow)', color: 'var(--ink)', border: 'none',
            padding: '8px 14px', borderRadius: 8, fontWeight: 700, fontSize: 12.5,
            cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            <I.plus s={13}/> Captar propietario nuevo
          </button>
          {(hasRealCapt || useMock) && (
            <button onClick={() => setShowAll(v => !v)} style={{ background: 'none', border: 'none', color: 'var(--blue)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              {showAll ? 'Ver solo activas ←' : 'Historial completo →'}
            </button>
          )}
        </div>
      </div>

      {isLoading && (
        <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
          Cargando captaciones…
        </div>
      )}

      {!isLoading && !hasRealCapt && !useMock && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '28px 24px 22px', textAlign: 'center', borderBottom: '1px solid var(--line-2)' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--blue-50)', color: 'var(--blue)', display: 'grid', placeItems: 'center', margin: '0 auto 12px' }}>
              <I.shield s={26}/>
            </div>
            <div style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 18 }}>Todavía no tenés captaciones</div>
            <p className="muted" style={{ fontSize: 13.5, marginTop: 6, maxWidth: 520, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.5 }}>
              Acá vas a ver las propiedades que captes de propietarios. Cobrás {me.commissionRate}% del primer alquiler solo si la operación se concreta.
            </p>
          </div>

          <div style={{ padding: '22px 24px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 14 }}>
              Cómo captar una propiedad
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
              {[
                { n: 1, t: 'Encontrá un propietario', d: 'Por contacto directo, referidos, o respondiendo solicitudes que llegan al ERP.' },
                { n: 2, t: 'Cargá la propiedad', d: 'Desde "Cargar propiedad" subís fotos, datos y la asignás al propietario.' },
                { n: 3, t: 'Gestioná las visitas', d: 'Recibís consultas por WhatsApp y coordinás con el propietario.' },
                { n: 4, t: 'Cobrás la comisión', d: 'Cuando se concreta el alquiler/venta, marcás cerrada y se calcula tu comisión.' },
              ].map(s => (
                <div key={s.n} style={{ padding: 14, border: '1px solid var(--line-2)', borderRadius: 10, background: 'var(--bg-1)' }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--blue)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700, marginBottom: 8 }}>{s.n}</div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink)' }}>{s.t}</div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 4, lineHeight: 1.45 }}>{s.d}</div>
                </div>
              ))}
            </div>
            <div style={{ textAlign: 'center', marginTop: 22 }}>
              <button onClick={() => setCaptarOpen(true)} style={{
                background: 'var(--yellow)', color: 'var(--ink)', border: 'none',
                padding: '10px 22px', borderRadius: 10, fontWeight: 700, fontSize: 13.5,
                cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6,
              }}>
                <I.plus s={14}/> Captar primer propietario
              </button>
            </div>
          </div>
        </div>
      )}

      {(hasRealCapt || useMock) && (<>
      {/* Tabla "Solicitudes recibidas" — oculta porque ahora la lista principal abajo usa los mismos datos reales */}
      {false && realCapt && realCapt.length > 0 && (
        <div className="card" style={{ padding: 0, marginBottom: 14, overflow: 'hidden' }}>
          <div className="row between" style={{ padding: '11px 14px', borderBottom: '1px solid var(--line-2)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
              Solicitudes recibidas ({realCapt.length})
            </div>
            <span className="badge" style={{ background: 'var(--blue-50)', color: 'var(--blue)', fontSize: 10 }}>datos reales</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg-2)' }}>
                <th style={{ ...th, textAlign: 'left' }}>Propietario</th>
                <th style={{ ...th, textAlign: 'left' }}>Contacto</th>
                <th style={{ ...th, textAlign: 'left' }}>Propiedad</th>
                <th style={{ ...th, textAlign: 'left' }}>Ubicación</th>
                <th style={{ ...th, textAlign: 'left' }}>Etapa</th>
                <th style={{ ...th, textAlign: 'right' }}>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {realCapt.map(c => (
                <tr key={c.id} style={{ borderTop: '1px solid var(--line-2)' }}>
                  <td style={td}><strong>{c.propietario_nombre || '—'}</strong></td>
                  <td style={{ ...td, fontSize: 12, color: 'var(--ink-3)' }}>
                    {(c.propietario_email || c.propietario_telefono) ? (
                      <React.Fragment>
                        {c.propietario_email ? <div>{c.propietario_email}</div> : null}
                        {c.propietario_telefono ? <div>{c.propietario_telefono}</div> : null}
                      </React.Fragment>
                    ) : '—'}
                  </td>
                  <td style={td}>
                    <div style={{ fontWeight: 600 }}>{c.propiedad_titulo || '—'}</div>
                    <div className="muted xs">{c.tipo_propiedad || ''}</div>
                  </td>
                  <td style={{ ...td, fontSize: 12 }}>
                    {(c.ciudad || c.barrio) ? [c.ciudad, c.barrio].filter(Boolean).join(' · ') : '—'}
                  </td>
                  <td style={td}>
                    <span className="badge" style={{
                      background: c.etapa === 'cerrado' ? '#eaf6f0' : (c.etapa === 'perdido' ? '#fdecec' : 'var(--blue-50)'),
                      color:      c.etapa === 'cerrado' ? 'var(--green)' : (c.etapa === 'perdido' ? '#a8312f' : 'var(--blue)'),
                      fontSize: 10.5
                    }}>{c.etapa}</span>
                  </td>
                  <td style={{ ...td, textAlign: 'right', fontSize: 12, color: 'var(--ink-3)' }}>
                    {(c.created_at || '').slice(0, 10)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
          // Captacion real (lead del propietario via web publica): mostramos
          // los datos del PROPIETARIO, no una propiedad. Avatar con iniciales,
          // nombre como titulo, telefono/email + preview del mensaje. Solo si
          // hay una propiedad ya cargada (titulo) mostramos la casita.
          const showOwnerCard = c._real && !c._titulo;
          const titulo = showOwnerCard ? (c.owner || 'Solicitud sin nombre') : p.title;
          return (
            <div key={c.propertyId} className="card" style={{
              padding: 12, display: 'flex', alignItems: 'center', gap: 14,
              transition: 'border-color .12s, box-shadow .12s',
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--blue-100)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,88,165,.06)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}>
              {showOwnerCard
                ? <Avatar name={c.owner} size={64}/>
                : <Photo src={p.cover} style={{ width: 64, height: 64, borderRadius: 10, flexShrink: 0 }}/>}

              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row gap-8" style={{ alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 320 }}>{titulo}</span>
                  {closed
                    ? <span style={{ padding: '1px 7px', borderRadius: 999, background: '#eaf6f0', color: 'var(--green)', fontSize: 9.5, fontWeight: 700 }}>✓ Cerrada</span>
                    : <span style={{ padding: '1px 7px', borderRadius: 999, background: 'var(--blue-50)', color: 'var(--blue)', fontSize: 9.5, fontWeight: 700 }}>● En gestión</span>}
                  {showOwnerCard && (
                    <span style={{ padding: '1px 7px', borderRadius: 999, background: 'var(--bg-3)', color: 'var(--ink-3)', fontSize: 9.5, fontWeight: 700 }}>Solicitud</span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11.5, color: 'var(--ink-3)', flexWrap: 'wrap' }}>
                  {showOwnerCard ? (
                    <>
                      {c._telefono ? <span><I.whats s={11}/> <strong style={{ color: 'var(--ink-2)' }}>{c._telefono}</strong></span> : null}
                      {c._email ? (<><span style={{ color: 'var(--ink-4)' }}>·</span><span><I.user s={11}/> {c._email}</span></>) : null}
                      <span style={{ color: 'var(--ink-4)' }}>·</span>
                      <span><I.cal s={11}/> Solicitada {c.date}</span>
                    </>
                  ) : (
                    <>
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
                    </>
                  )}
                </div>
                {showOwnerCard && c._mensaje ? (
                  <div style={{ marginTop: 6, fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    “{c._mensaje}”
                  </div>
                ) : null}
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

              {/* Action: para captaciones reales mostramos un selector de
                  etapa funcional que PATCHea /api/agente/captaciones/[id].
                  Para mocks dejamos los botones decorativos viejos. */}
              <div style={{ flexShrink: 0 }}>
                {c._real ? (
                  <select
                    defaultValue={c._etapa || 'nuevo'}
                    onChange={async (e) => {
                      const nueva = e.target.value;
                      try {
                        const r = await fetch('/api/agente/captaciones/' + encodeURIComponent(c._id), {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          credentials: 'include',
                          body: JSON.stringify({ etapa: nueva }),
                        });
                        const b = await r.json().catch(() => ({}));
                        if (!r.ok || !b.success) throw new Error(b.error || ('HTTP ' + r.status));
                        if (window.ayToast) window.ayToast('Etapa actualizada.', { variant: 'success', duration: 3000 });
                        setReloadKey(k => k + 1);
                      } catch (err) {
                        if (window.ayToast) window.ayToast('No se pudo actualizar.', { variant: 'error' });
                        e.target.value = c._etapa || 'nuevo';
                      }
                    }}
                    title="Cambiar etapa"
                    style={{
                      height: 30, borderRadius: 8, padding: '0 8px',
                      border: '1px solid var(--line)', background: '#fff',
                      color: 'var(--ink-2)', fontSize: 12, fontWeight: 600,
                      fontFamily: 'inherit', cursor: 'pointer',
                    }}>
                    <option value="nuevo">Nuevo</option>
                    <option value="contacto">Contactado</option>
                    <option value="negocio_activo">Negociación</option>
                    <option value="cerrado">Cerrado</option>
                    <option value="rechazado">Rechazado</option>
                  </select>
                ) : c.status === 'gestionando'
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
      </>)}

      {captarOpen && (
        <CaptarPropietarioModal
          onClose={() => setCaptarOpen(false)}
          onSaved={() => { setCaptarOpen(false); setReloadKey(k => k + 1); }}
        />
      )}
    </div>
  );
}

function CaptarPropietarioModal({ onClose, onSaved }) {
  const [form, setForm] = React.useState({
    propietario_nombre: '', propietario_email: '', propietario_telefono: '',
    propiedad_titulo: '', tipo_propiedad: '', ciudad: '', barrio: '',
    precio_estimado: '', mensaje: '',
  });
  const [busy, setBusy] = React.useState(false);
  const [feedback, setFeedback] = React.useState(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    if (!form.propietario_nombre.trim()) { setFeedback({ kind: 'error', text: 'Poné el nombre del propietario.' }); return; }
    if (!form.propietario_email.trim() && !form.propietario_telefono.trim()) {
      setFeedback({ kind: 'error', text: 'Necesitamos email o teléfono para contactarlo.' }); return;
    }
    setBusy(true); setFeedback(null);
    try {
      const res = await fetch('/api/agente/captaciones', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propietario_nombre: form.propietario_nombre.trim(),
          propietario_email: form.propietario_email.trim() || null,
          propietario_telefono: form.propietario_telefono.trim() || null,
          propiedad_titulo: form.propiedad_titulo.trim() || null,
          tipo_propiedad: form.tipo_propiedad || null,
          ciudad: form.ciudad.trim() || null,
          barrio: form.barrio.trim() || null,
          precio_estimado: form.precio_estimado ? Number(String(form.precio_estimado).replace(/[^\d.]/g, '')) : null,
          mensaje: form.mensaje.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) throw new Error((data && data.error) || ('HTTP ' + res.status));
      setFeedback({ kind: 'success', text: '¡Captado! Ya está en tu lista de captaciones.' });
      setTimeout(() => onSaved && onSaved(), 900);
    } catch (err) {
      setFeedback({ kind: 'error', text: 'No pudimos guardar. ' + (err.message || '') });
    } finally { setBusy(false); }
  };
  const lbl = { fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.04em', display: 'block', marginBottom: 6 };
  const inp = { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--line)', fontSize: 14, fontFamily: 'inherit', background: '#fff' };
  return (
    <div onClick={busy ? undefined : onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(11,22,34,.55)', zIndex: 100,
      display: 'grid', placeItems: 'center', padding: 20, overflowY: 'auto',
    }}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="card" style={{
        padding: 26, maxWidth: 620, width: '100%', background: '#fff', position: 'relative', margin: 'auto',
      }}>
        <button type="button" onClick={onClose} disabled={busy} style={{
          position: 'absolute', top: 14, right: 14, background: 'var(--bg-2)', border: 'none',
          width: 32, height: 32, borderRadius: 8, cursor: busy ? 'default' : 'pointer', display: 'grid', placeItems: 'center', opacity: busy ? 0.5 : 1,
        }}><I.x s={14}/></button>
        <div className="tag" style={{ color: 'var(--yellow-600)' }}>Captaciones</div>
        <h3 style={{ fontSize: 20, marginTop: 6 }}>Captar propietario nuevo</h3>
        <p className="muted" style={{ fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>
          Cargá los datos del propietario y su propiedad. Queda como "en gestión" — después podés crear la publicación o marcarla cerrada cuando se concrete.
        </p>
        {feedback && (
          <div style={{
            marginTop: 14, padding: '10px 12px', borderRadius: 8, fontSize: 13,
            background: feedback.kind === 'success' ? '#dcfce7' : '#fee2e2',
            color: feedback.kind === 'success' ? '#15803d' : '#991b1b',
          }}>{feedback.text}</div>
        )}

        <div style={{ marginTop: 16, fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Propietario</div>
        <div style={{ marginTop: 10 }}>
          <label style={lbl}>Nombre *</label>
          <input style={inp} value={form.propietario_nombre} onChange={e => set('propietario_nombre', e.target.value)} placeholder="Ej. María González" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 10 }}>
          <div>
            <label style={lbl}>Email</label>
            <input style={inp} type="email" value={form.propietario_email} onChange={e => set('propietario_email', e.target.value)} placeholder="email@dominio.com" />
          </div>
          <div>
            <label style={lbl}>Teléfono / WhatsApp</label>
            <input style={inp} value={form.propietario_telefono} onChange={e => set('propietario_telefono', e.target.value)} placeholder="0981 234 567" />
          </div>
        </div>

        <div style={{ marginTop: 18, fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Propiedad (opcional)</div>
        <div style={{ marginTop: 10 }}>
          <label style={lbl}>Título / Referencia</label>
          <input style={inp} value={form.propiedad_titulo} onChange={e => set('propiedad_titulo', e.target.value)} placeholder="Ej. Departamento 2 dorm. en Villa Morra" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 10 }}>
          <div>
            <label style={lbl}>Tipo</label>
            <select style={inp} value={form.tipo_propiedad} onChange={e => set('tipo_propiedad', e.target.value)}>
              <option value="">—</option>
              <option value="departamento">Departamento</option>
              <option value="casa">Casa</option>
              <option value="duplex">Dúplex</option>
              <option value="terreno">Terreno</option>
              <option value="local_comercial">Local comercial</option>
              <option value="oficina">Oficina</option>
              <option value="deposito">Depósito</option>
            </select>
          </div>
          <div>
            <label style={lbl}>Ciudad</label>
            <input style={inp} value={form.ciudad} onChange={e => set('ciudad', e.target.value)} placeholder="Asunción" />
          </div>
          <div>
            <label style={lbl}>Barrio</label>
            <input style={inp} value={form.barrio} onChange={e => set('barrio', e.target.value)} placeholder="Villa Morra" />
          </div>
        </div>
        <div style={{ marginTop: 10 }}>
          <label style={lbl}>Precio estimado (Gs.)</label>
          <input style={inp} value={form.precio_estimado} onChange={e => set('precio_estimado', e.target.value)} placeholder="3.000.000" />
        </div>
        <div style={{ marginTop: 10 }}>
          <label style={lbl}>Notas internas</label>
          <textarea style={{ ...inp, minHeight: 70, resize: 'vertical' }} value={form.mensaje} onChange={e => set('mensaje', e.target.value)} placeholder="Cualquier detalle útil para vos (ej. el dueño viaja, llaves con la portera, etc.)" />
        </div>

        <div className="row" style={{ justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
          <button type="button" onClick={onClose} disabled={busy} style={{
            background: 'transparent', border: '1px solid var(--line)', color: 'var(--ink-2)',
            padding: '9px 18px', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
          }}>Cancelar</button>
          <button type="submit" disabled={busy} style={{
            background: busy ? 'var(--ink-4)' : 'var(--ink)', color: '#fff', border: 'none',
            padding: '9px 22px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit',
          }}>{busy ? 'Guardando…' : 'Captar propietario'}</button>
        </div>
      </form>
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
  const [busy, setBusy] = React.useState(false);
  const [feedback, setFeedback] = React.useState(null); // { kind, text } | null
  const handlePick = async (pack) => {
    if (busy) return;
    setBusy(true); setFeedback(null);
    try {
      const r = await onBuy(pack);
      if (r && r.ok) {
        setFeedback({ kind: 'success', text: '¡Listo! Recibimos tu pedido por ' + pack.qty + ' impulso' + (pack.qty > 1 ? 's' : '') + '. Te contactamos por WhatsApp para coordinar el pago y activarlos en tu cuenta.' });
      } else {
        setFeedback({ kind: 'error', text: 'No pudimos registrar la compra. ' + ((r && r.error) || '') });
      }
    } catch (e) {
      setFeedback({ kind: 'error', text: 'No pudimos registrar la compra. ' + (e.message || '') });
    } finally { setBusy(false); }
  };
  return (
    <div onClick={busy ? undefined : onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(11,22,34,.55)', zIndex: 100,
      display: 'grid', placeItems: 'center', padding: 20
    }}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{
        padding: 28, maxWidth: 560, width: '100%', background: '#fff', position: 'relative'
      }}>
        <button onClick={onClose} disabled={busy} style={{
          position: 'absolute', top: 14, right: 14, background: 'var(--bg-2)', border: 'none',
          width: 32, height: 32, borderRadius: 8, cursor: busy ? 'default' : 'pointer', display: 'grid', placeItems: 'center', opacity: busy ? 0.5 : 1
        }}><I.x s={14}/></button>
        {feedback && feedback.kind === 'success' ? (
          <div style={{ textAlign: 'center', padding: '14px 4px 4px' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#dcfce7', color: '#15803d', display: 'grid', placeItems: 'center', margin: '0 auto 14px', fontSize: 28, fontWeight: 800 }}>✓</div>
            <h3 style={{ fontSize: 20, margin: '0 0 8px' }}>Pedido recibido</h3>
            <p className="muted" style={{ fontSize: 14, marginTop: 6, lineHeight: 1.5 }}>{feedback.text}</p>
            <button onClick={onClose} className="btn btn-primary" style={{ marginTop: 18, padding: '10px 22px' }}>Entendido</button>
          </div>
        ) : (<>
        <div className="tag" style={{ color: 'var(--yellow-600)' }}>Impulsos</div>
        <h3 style={{ fontSize: 22, marginTop: 6 }}>Comprar impulsos extra</h3>
        <p className="muted" style={{ fontSize: 13.5, marginTop: 6 }}>
          Cada impulso destaca 1 propiedad por 7 días. No tienen vencimiento.
        </p>
        {feedback && feedback.kind === 'error' && (
          <div style={{ marginTop: 14, padding: '10px 12px', background: '#fee2e2', color: '#991b1b', borderRadius: 8, fontSize: 13 }}>{feedback.text}</div>
        )}
        <div className="col gap-10" style={{ marginTop: 18 }}>
          {IMPULSE_PACKS.map(pack => (
            <button key={pack.id} onClick={() => handlePick(pack)} disabled={busy} className="card" style={{
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
          El pago se coordina por WhatsApp. Una vez confirmado, el equipo activa los impulsos en tu cuenta.
        </div>
        </>)}
      </div>
    </div>
  );
}

// ───────── Embudo de captaciones (datos reales /api/agente/embudo) ─────────
function EmbudoCaptaciones() {
  const [data, setData] = React.useState(null);
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await (window.ayCachedFetch || fetch)('/api/agente/embudo', { cache: 'no-store', credentials: 'include' });
        if (!r.ok) return;
        const b = await r.json().catch(() => ({}));
        if (!cancelled && Array.isArray(b?.embudo)) setData(b.embudo);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, []);
  if (!data) return null;
  const labels = {
    nuevo: 'Nuevo',
    contacto: 'Contactado',
    negocio_activo: 'Negociación',
    cerrado: 'Cerrado',
    rechazado: 'Rechazado',
  };
  const colors = {
    nuevo: ['var(--blue-50)', 'var(--blue)'],
    contacto: ['#e6f4ff', '#0058A5'],
    negocio_activo: ['#fce8f3', '#b81b72'],
    cerrado: ['#dcfce7', '#15803d'],
    rechazado: ['#fee2e2', '#991b1b'],
  };
  const total = data.reduce((acc, r) => acc + (Number(r.count) || 0), 0);
  return (
    <div className="card" style={{ padding: 14 }}>
      <div className="row between" style={{ alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13 }}>Embudo de negociaciones</div>
          <div className="muted xs">Captaciones del agente · total {total}</div>
        </div>
      </div>
      <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
        {data.map((row) => {
          const [bg, fg] = colors[row.etapa] || ['var(--bg-3)', 'var(--ink-3)'];
          return (
            <div key={row.etapa} style={{ background: bg, color: fg, padding: '8px 6px', borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 18 }}>{row.count}</div>
              <div style={{ fontSize: 10, fontWeight: 600, marginTop: 2 }}>{labels[row.etapa] || row.etapa}</div>
            </div>
          );
        })}
      </div>
      {total === 0 && (
        <div className="muted xs" style={{ marginTop: 10, textAlign: 'center' }}>
          Todavía no tenés captaciones cargadas. Cuando captures propietarios aparecerá el embudo acá.
        </div>
      )}
    </div>
  );
}

// ───────── Consultas recientes (datos reales /api/agente/consultas) ─────────
function ConsultasRecientes({ onNav }) {
  const [data, setData] = React.useState(null);
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await (window.ayCachedFetch || fetch)('/api/agente/consultas?limit=6', { cache: 'no-store', credentials: 'include' });
        if (!r.ok) return;
        const b = await r.json().catch(() => ({}));
        if (!cancelled && Array.isArray(b?.consultas)) setData(b.consultas);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, []);
  if (!data) return null;
  function fmtRel(iso) {
    if (!iso) return '';
    const d = new Date(iso); const diff = Math.floor((Date.now() - d.getTime()) / 60000);
    if (diff < 1) return 'ahora';
    if (diff < 60) return diff + ' min';
    const h = Math.floor(diff / 60);
    if (h < 24) return h + ' h';
    const dd = Math.floor(h / 24);
    return dd + ' d';
  }
  const canalIcon = (canal) => canal === 'whatsapp' ? '💬' : canal === 'mail' ? '✉' : canal === 'telefono' ? '📞' : '🔵';
  return (
    <div className="card" style={{ padding: 14 }}>
      <div className="row between" style={{ alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13 }}>Últimas consultas</div>
          <div className="muted xs">Interesados que dejaron mensaje en tus propiedades</div>
        </div>
      </div>
      <div className="col gap-8" style={{ marginTop: 10 }}>
        {data.length === 0 && (
          <div className="muted xs" style={{ padding: '14px 0', textAlign: 'center' }}>
            Todavía no recibiste consultas. Cuando alguien clic en &quot;Consultar&quot; en una de tus propiedades, aparecerán acá.
          </div>
        )}
        {data.map((c) => (
          <div key={c.id} className="row gap-10" style={{ alignItems: 'flex-start', padding: '8px 0', borderBottom: '1px solid var(--line-2)' }}>
            <span style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--bg-3)', display: 'grid', placeItems: 'center', fontSize: 12, flexShrink: 0 }}>{canalIcon(c.canal)}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="row between" style={{ alignItems: 'baseline' }}>
                <div style={{ fontWeight: 600, fontSize: 12.5 }}>{c.nombre || c.email || c.telefono || 'Interesado anónimo'}</div>
                <div className="muted xs">{fmtRel(c.created_at)}</div>
              </div>
              {c.propiedad_titulo && (
                <div className="muted xs" style={{ marginTop: 1 }}>{c.propiedad_titulo}{c.propiedad_ciudad ? ' · ' + c.propiedad_ciudad : ''}</div>
              )}
              {c.mensaje && (
                <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 4, lineHeight: 1.4 }}>{c.mensaje}</div>
              )}
              <div className="row gap-10" style={{ marginTop: 6 }}>
                {c.telefono && (
                  <a href={'https://wa.me/' + String(c.telefono).replace(/\D/g, '')} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, fontWeight: 600, color: '#1ebd5b', textDecoration: 'none' }}>WhatsApp →</a>
                )}
                {c.email && (
                  <a href={'mailto:' + c.email} style={{ fontSize: 11, fontWeight: 600, color: 'var(--blue)', textDecoration: 'none' }}>Email →</a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BlogContentEditor — textarea + toolbar de formato minimo. Sin dependencias.
// Inserta tags HTML al cursor o envuelve la seleccion. El HTML resultante se
// renderiza con la clase post-html en el blog publico (estilos en index.html).
// Tag whitelist (debe coincidir con sanitizeBlogHtml del backend):
//   strong, em, h2, h3, ul, ol, li, blockquote, a, p, br
// ─────────────────────────────────────────────────────────────────────────────
function BlogContentEditor({ value, onChange }) {
  const ref = React.useRef(null);
  const apply = (action) => {
    const ta = ref.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = value.slice(0, start);
    const sel = value.slice(start, end);
    const after = value.slice(end);
    let snippet = sel;
    let cursorOffset = 0;
    switch (action) {
      case 'bold':       snippet = `<strong>${sel || 'texto'}</strong>`; break;
      case 'italic':     snippet = `<em>${sel || 'texto'}</em>`; break;
      case 'h2':         snippet = `<h2>${sel || 'Subtítulo'}</h2>`; break;
      case 'h3':         snippet = `<h3>${sel || 'Sub-subtítulo'}</h3>`; break;
      case 'ul':         snippet = `<ul>\n  <li>${sel || 'Item'}</li>\n</ul>`; break;
      case 'ol':         snippet = `<ol>\n  <li>${sel || 'Item'}</li>\n</ol>`; break;
      case 'quote':      snippet = `<blockquote>${sel || 'Cita'}</blockquote>`; break;
      case 'paragraph':  snippet = `<p>${sel || 'Texto del párrafo'}</p>`; break;
      case 'link': {
        const url = window.prompt('URL del link (https://...)', 'https://');
        if (!url) return;
        snippet = `<a href="${url.replace(/"/g, '&quot;')}" target="_blank" rel="noopener noreferrer">${sel || url}</a>`;
        break;
      }
      default: return;
    }
    const next = before + snippet + after;
    onChange(next);
    // Devolvemos foco y posicionamos el cursor al final del snippet insertado.
    cursorOffset = before.length + snippet.length;
    setTimeout(() => {
      try {
        ta.focus();
        ta.setSelectionRange(cursorOffset, cursorOffset);
      } catch { /* ignore */ }
    }, 0);
  };

  const Btn = ({ act, children, title }) => (
    <button type="button" onClick={() => apply(act)} title={title || act}
      style={{
        padding: '4px 9px', borderRadius: 6, border: '1px solid var(--line)',
        background: '#fff', color: 'var(--ink-2)', cursor: 'pointer',
        fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit',
        minWidth: 30,
      }}>
      {children}
    </button>
  );

  return (
    <div>
      <div className="row gap-4" style={{
        flexWrap: 'wrap', marginBottom: 6, padding: 6, background: 'var(--bg-2)',
        border: '1px solid var(--line)', borderBottom: 'none',
        borderRadius: '8px 8px 0 0',
      }}>
        <Btn act="bold" title="Negrita"><strong>B</strong></Btn>
        <Btn act="italic" title="Cursiva"><em>I</em></Btn>
        <Btn act="h2" title="Título grande">H2</Btn>
        <Btn act="h3" title="Subtítulo">H3</Btn>
        <Btn act="paragraph" title="Párrafo">P</Btn>
        <Btn act="ul" title="Lista">• Lista</Btn>
        <Btn act="ol" title="Lista numerada">1. Num</Btn>
        <Btn act="quote" title="Cita">❝ Cita</Btn>
        <Btn act="link" title="Link">🔗 Link</Btn>
      </div>
      <textarea
        ref={ref}
        className="input"
        rows={12}
        style={{
          fontFamily: 'JetBrains Mono, monospace', fontSize: 13,
          borderRadius: '0 0 8px 8px', borderTop: 'none',
        }}
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, 60000))}
        placeholder="Escribí tu post acá. Usá la barra para dar formato."
      />
    </div>
  );
}

// ───────── Mi blog (CRUD de posts del agente logueado) ─────────
function BlogSection() {
  const [posts, setPosts] = React.useState(null);
  const [err, setErr] = React.useState(null);
  const [editing, setEditing] = React.useState(null);
  const [saving, setSaving] = React.useState(false);
  const [filter, setFilter] = React.useState('todos');

  async function reload() {
    try {
      const r = await (window.ayCachedFetch || fetch)('/api/agente/posts', { cache: 'no-store', credentials: 'include' });
      const body = await r.json().catch(() => ({}));
      if (!r.ok || !body.success) throw new Error(body.error || ('HTTP ' + r.status));
      setPosts(Array.isArray(body.posts) ? body.posts : []);
    } catch (e) {
      setErr(e && e.message ? e.message : 'No se pudo cargar el blog.');
    }
  }
  React.useEffect(() => { reload(); }, []);

  async function save() {
    if (!editing) return;
    setErr(null);
    if (!editing.titulo || !editing.titulo.trim()) { setErr('El título es obligatorio'); return; }
    setSaving(true);
    try {
      const isNew = editing.isNew;
      const payload = {
        titulo: editing.titulo,
        slug: editing.slug || null,
        resumen: editing.resumen || null,
        contenido: editing.contenido || null,
        cover_url: editing.cover_url || null,
        publicado: !!editing.publicado,
        destacado: !!editing.destacado,
        orden: Number(editing.orden) || 0,
      };
      const url = isNew ? '/api/agente/posts' : ('/api/agente/posts/' + editing.id);
      const r = await fetch(url, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok || !body.success) throw new Error(body.error || ('HTTP ' + r.status));
      if (window.ayInvalidate) window.ayInvalidate('/api/agente/posts');
      setEditing(null);
      await reload();
    } catch (e) {
      setErr(e && e.message ? e.message : 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(post) {
    if (!post) return;
    if (!window.confirm('¿Eliminar el post "' + (post.titulo || '') + '"? Esto no se puede deshacer.')) return;
    try {
      const r = await fetch('/api/agente/posts/' + post.id, { method: 'DELETE', credentials: 'include' });
      const body = await r.json().catch(() => ({}));
      if (!r.ok || !body.success) throw new Error(body.error || ('HTTP ' + r.status));
      if (window.ayInvalidate) window.ayInvalidate('/api/agente/posts');
      await reload();
    } catch (e) {
      window.alert(e && e.message ? e.message : 'No se pudo eliminar.');
    }
  }

  if (posts === null && !err) {
    return <div className="muted" style={{ padding: 20, textAlign: 'center' }}>Cargando…</div>;
  }
  if (err && posts === null) {
    return <div className="card" style={{ padding: 18, color: 'var(--red)' }}>{err}</div>;
  }
  const list = (posts || []).filter(p => filter === 'todos' ? true : filter === 'publicado' ? p.publicado : !p.publicado);
  return (
    <div>
      <div className="row between" style={{ alignItems: 'center', marginBottom: 14 }}>
        <div className="row gap-8">
          {['todos','publicado','borrador'].map(f => (
            <button key={f} type="button" onClick={() => setFilter(f)} style={{
              padding: '6px 12px', borderRadius: 999, border: '1px solid ' + (filter === f ? 'var(--blue)' : 'var(--line)'),
              background: filter === f ? 'var(--blue)' : '#fff', color: filter === f ? '#fff' : 'var(--ink-2)',
              fontFamily: 'inherit', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>{f === 'todos' ? 'Todos' : f === 'publicado' ? 'Publicados' : 'Borradores'}</button>
          ))}
        </div>
        <button type="button" className="btn btn-blue" onClick={() => setEditing({ isNew: true, titulo: '', publicado: false, destacado: false, orden: 0 })}>+ Nuevo post</button>
      </div>

      {err && <div className="card" style={{ padding: 12, marginBottom: 12, color: 'var(--red)', background: '#fef2f2', border: '1px solid #fecaca' }}>{err}</div>}

      {list.length === 0 ? (
        <div className="card" style={{ padding: 28, textAlign: 'center', color: 'var(--ink-3)' }}>
          {filter === 'borrador' ? 'No tenés borradores.' : filter === 'publicado' ? 'Todavía no publicaste ningún post.' : 'Todavía no escribiste nada. Empezá con tu primer post.'}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          {list.map(p => (
            <div key={p.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {p.cover_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.cover_url} alt={p.titulo} style={{ width: '100%', height: 140, objectFit: 'cover', display: 'block', background: 'var(--bg-2)' }}/>
              ) : (
                <div style={{ height: 100, background: 'linear-gradient(135deg, var(--blue-50), var(--bg-2))' }}/>
              )}
              <div style={{ padding: 16 }}>
                <div className="row gap-6" style={{ flexWrap: 'wrap' }}>
                  <span className="badge" style={{ background: p.publicado ? 'var(--green)' : 'var(--bg-3)', color: p.publicado ? '#fff' : 'var(--ink-3)', fontSize: 10 }}>
                    {p.publicado ? 'Publicado' : 'Borrador'}
                  </span>
                  {p.destacado && <span className="badge badge-featured" style={{ fontSize: 10 }}>★ Destacado</span>}
                </div>
                <div style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 16, marginTop: 8, lineHeight: 1.25 }}>{p.titulo}</div>
                {p.resumen && <div className="muted" style={{ marginTop: 6, fontSize: 13, lineHeight: 1.45 }}>{p.resumen.slice(0, 140)}{p.resumen.length > 140 ? '…' : ''}</div>}
                {p.publicado_at && <div className="muted xs" style={{ marginTop: 10 }}>{new Date(p.publicado_at).toLocaleDateString('es-PY', { day: '2-digit', month: 'short', year: 'numeric' })}</div>}
                <div className="row gap-8" style={{ marginTop: 12 }}>
                  <button type="button" onClick={() => setEditing(Object.assign({ isNew: false }, p))} className="btn" style={{ background: 'var(--bg-3)', color: 'var(--ink-2)', padding: '6px 12px', fontSize: 12 }}>Editar</button>
                  <button type="button" onClick={() => remove(p)} className="btn" style={{ background: '#fee2e2', color: '#991b1b', padding: '6px 12px', fontSize: 12 }}>Eliminar</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget && !saving) setEditing(null); }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(11,22,34,.55)', zIndex: 1000, display: 'grid', placeItems: 'center', padding: 20, overflowY: 'auto' }}
        >
          <div className="card" style={{ maxWidth: 640, width: '100%', padding: 24, background: '#fff', maxHeight: 'calc(100vh - 40px)', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: 20 }}>{editing.isNew ? 'Nuevo post' : 'Editar post'}</h3>
            <div className="field" style={{ marginTop: 14 }}>
              <label>Título *</label>
              <input className="input" value={editing.titulo || ''} onChange={(e) => setEditing(x => ({ ...x, titulo: e.target.value }))}/>
            </div>
            <div className="field" style={{ marginTop: 12 }}>
              <label>Slug (URL)</label>
              <input className="input" placeholder="se-genera-solo-si-lo-dejas-vacio" value={editing.slug || ''} onChange={(e) => setEditing(x => ({ ...x, slug: e.target.value }))}/>
            </div>
            <div className="field" style={{ marginTop: 12 }}>
              <label>Cover URL</label>
              <input className="input" placeholder="https://..." value={editing.cover_url || ''} onChange={(e) => setEditing(x => ({ ...x, cover_url: e.target.value }))}/>
            </div>
            <div className="field" style={{ marginTop: 12 }}>
              <label>Resumen (1-2 líneas)</label>
              <textarea className="input" rows={2} value={editing.resumen || ''} onChange={(e) => setEditing(x => ({ ...x, resumen: e.target.value }))}/>
            </div>
            <div className="field" style={{ marginTop: 12 }}>
              <label>Contenido</label>
              <BlogContentEditor
                value={editing.contenido || ''}
                onChange={(v) => setEditing(x => ({ ...x, contenido: v }))}
              />
              <div className="muted xs" style={{ marginTop: 6 }}>
                Tip: usá la barra para dar formato. Lo que ves se renderiza
                con los mismos estilos en el blog público.
              </div>
            </div>
            <div className="row gap-16" style={{ marginTop: 14, flexWrap: 'wrap' }}>
              <label className="checkbox">
                <input type="checkbox" checked={!!editing.publicado} onChange={(e) => setEditing(x => ({ ...x, publicado: e.target.checked }))}/>
                Publicado
              </label>
              <label className="checkbox">
                <input type="checkbox" checked={!!editing.destacado} onChange={(e) => setEditing(x => ({ ...x, destacado: e.target.checked }))}/>
                Destacado
              </label>
              <div className="field" style={{ flex: 1, minWidth: 120 }}>
                <label style={{ fontSize: 11.5 }}>Orden</label>
                <input className="input" type="number" value={editing.orden ?? 0} onChange={(e) => setEditing(x => ({ ...x, orden: Number(e.target.value) || 0 }))}/>
              </div>
            </div>
            {err && <div style={{ marginTop: 12, color: 'var(--red)', fontSize: 13 }}>{err}</div>}
            <div className="row gap-10" style={{ marginTop: 18, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-outline" onClick={() => setEditing(null)} disabled={saving}>Cancelar</button>
              <button type="button" className="btn btn-blue" onClick={save} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { AdminGlobalPage, AdminAgentPage, EmbudoCaptaciones, ConsultasRecientes, BlogSection });
