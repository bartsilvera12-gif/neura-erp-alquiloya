// App router

function App() {
  const initial = (window.location.hash || '').replace('#', '') || 'home';
  const [route, setRoute] = React.useState(initial);
  const [property, setProperty] = React.useState(null);
  // Scroll to top on route change, but skip when navigating between admin-agent sub-sections
  // (those sections scroll-into-view themselves to provide smooth in-page navigation)
  const prevRoute = React.useRef(route);
  React.useEffect(() => {
    const a = prevRoute.current, b = route;
    const sameAgentArea = a && b && a.startsWith('admin-agent') && b.startsWith('admin-agent') && a !== 'admin-agent-qr' && b !== 'admin-agent-qr';
    if (!sameAgentArea) window.scrollTo({ top: 0, behavior: 'instant' });
    prevRoute.current = route;
  }, [route, property]);
  React.useEffect(() => {
    const onHash = () => {
      const r = (window.location.hash || '').replace('#', '');
      if (r) setRoute(r);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  // Keep URL in sync for admin global (hidden entry point)
  React.useEffect(() => {
    if (route.startsWith('admin-global')) {
      if (window.location.hash !== '#' + route) window.history.replaceState(null, '', '#' + route);
    } else if (window.location.hash.startsWith('#admin-global')) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [route]);

  const nav = (r) => {
    if (r === 'ads') { setRoute('home'); return; }
    if (r === 'posters') { setRoute('admin-agent-qr'); return; }
    setRoute(r);
  };
  const openProperty = (p) => { setProperty(p); setRoute('detail'); };
  const hideHeader = route.startsWith('admin-') || route === 'posters';

  return (
    <div className="app-shell">
      {!hideHeader && <Header route={route} onNav={nav}/>}
      {route === 'home' && <HomePage onNav={nav} onProperty={openProperty}/>}
      {route === 'catalog' && <CatalogPage onProperty={openProperty}/>}
      {route === 'detail' && <DetailPage p={property} onProperty={openProperty} onNav={nav}/>}
      {route === 'temporal' && <TemporalPage onProperty={openProperty}/>}
      {route === 'plans' && <PlansPage onNav={nav}/>}
      {route === 'boost' && <BoostPage onNav={nav}/>}
      {route === 'help' && <HelpPage onNav={nav}/>}
      {route.startsWith('agent/') && <AgentProfilePage slug={route.slice('agent/'.length)} onNav={nav} onProperty={openProperty}/>}
      {route === 'publish' && <PublishPage/>}
      {(route === 'posters' || route === 'admin-agent-qr') && <PostersPage route={route} onNav={nav}/>}
      {route.startsWith('admin-global') && <AdminGlobalPage route={route} onNav={nav}/>}
      {route.startsWith('admin-agent') && route !== 'admin-agent-qr' && <AdminAgentPage route={route} onNav={nav}/>}
      {!hideHeader && <Footer onNav={nav}/>}

      {!hideHeader && <VivioChatbot/>}
    </div>
  );
}

// Floating demo nav so reviewers can jump between all screens
function DemoNav({ route, setRoute }) {
  // Vista cliente: oculta el panel demo si URL tiene ?cliente o localStorage flag
  const isClientView = () =>
    new URLSearchParams(window.location.search).has('cliente') ||
    localStorage.getItem('clientView') === '1';
  const [hidden, setHidden] = React.useState(isClientView());
  const [open, setOpen] = React.useState(true);

  const goClientView = () => {
    localStorage.setItem('clientView', '1');
    const u = new URL(window.location.href);
    u.searchParams.set('cliente', '1');
    window.history.replaceState(null, '', u.toString());
    setHidden(true);
  };

  if (hidden) {
    return (
      <button
        onClick={() => {
          localStorage.removeItem('clientView');
          const u = new URL(window.location.href);
          u.searchParams.delete('cliente');
          window.history.replaceState(null, '', u.toString());
          setHidden(false);
        }}
        title="Salir de Vista cliente"
        style={{
          position: 'fixed', bottom: 16, left: 16, zIndex: 60,
          width: 32, height: 32, borderRadius: '50%',
          background: 'rgba(11,22,34,.5)', color: 'rgba(255,255,255,.6)',
          border: 'none', cursor: 'pointer', fontSize: 14,
          display: 'grid', placeItems: 'center', backdropFilter: 'blur(6px)'
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="2" x2="22" y2="22"/></svg>
      </button>
    );
  }

  const screens = [
    ['home', 'Home', 'house'],
    ['catalog', 'Catálogo', 'grid'],
    ['detail', 'Detalle propiedad', 'eye'],
    ['temporal', 'Alquiler temporal', 'cal'],
    ['plans', 'Planes y precios', 'star'],
    ['publish', 'Publicar inmueble', 'plus'],
    ['help', 'Centro de ayuda', 'chat'],
    ['agent/mariana-lopez', 'Perfil agente público', 'shield'],
    ['admin-agent', 'Panel agente', 'user'],
    ['admin-agent-qr', '↳ Carteles QR', 'qr'],
    ['admin-global', 'Admin global', 'shield'],
  ];
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{
        position: 'fixed', bottom: 20, left: 20, zIndex: 60,
        background: 'rgba(11,22,34,.94)', color: '#fff', borderRadius: 999,
        backdropFilter: 'blur(12px)', boxShadow: '0 16px 40px rgba(11,22,34,.3)',
        padding: '10px 16px', border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 10
      }}>
        <span style={{ color: 'var(--yellow)', display: 'grid', placeItems: 'center' }}>
          {React.createElement(I.grid, { s: 14 })}
        </span>
        <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.08em' }}>NAVEGACIÓN DEMO</span>
      </button>
    );
  }
  return (
    <div style={{
      position: 'fixed', bottom: 20, left: 20, zIndex: 60,
      background: 'rgba(11,22,34,.94)', color: '#fff', borderRadius: 14,
      backdropFilter: 'blur(12px)', boxShadow: '0 16px 40px rgba(11,22,34,.3)',
      padding: '8px',
      display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 2
    }}>
      <div className="row between" style={{ padding: '6px 8px 4px', gap: 10 }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.12em', color: 'var(--yellow)' }}>NAVEGACIÓN DEMO</span>
        <button onClick={() => setOpen(false)} title="Minimizar" style={{ background: 'rgba(255,255,255,.08)', border: 'none', color: '#fff', cursor: 'pointer', padding: '4px 8px', borderRadius: 6, display: 'grid', placeItems: 'center' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 18h14"/></svg>
        </button>
      </div>
      {screens.map(([id, label, icon]) => {
        const active = (id === 'admin-agent' && route.startsWith('admin-agent')) ||
                       route === id;
        return (
          <button key={id} onClick={() => setRoute(id)} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
            background: active ? 'var(--blue)' : 'transparent',
            border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer',
            fontSize: 12.5, fontWeight: 600, textAlign: 'left', width: 180
          }}>
            <span style={{ color: active ? 'var(--yellow)' : '#9aa4b1' }}>
              {React.createElement(I[icon], { s: 14 })}
            </span>
            {label}
          </button>
        );
      })}
      <div style={{ marginTop: 4, padding: '8px 10px', borderTop: '1px solid rgba(255,255,255,.08)', fontSize: 10.5, color: '#6b7785', lineHeight: 1.4 }}>
        Admin global solo accesible por URL directa (<span className="mono" style={{ color: 'var(--yellow)' }}>#admin-global</span>).
      </div>
      <button onClick={goClientView} style={{
        marginTop: 6, padding: '8px 10px', background: 'var(--yellow)', color: 'var(--ink)',
        border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center'
      }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        Vista cliente
      </button>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
