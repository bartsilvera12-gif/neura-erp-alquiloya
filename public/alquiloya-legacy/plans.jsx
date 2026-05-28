// Planes para propietarios y agentes

function PlansPage({ onNav }) {
  const [audience, setAudience] = React.useState('owner');
  const [verifyOpen, setVerifyOpen] = React.useState(false);
  // Fuente real desde API; fallback a PLANS de data.jsx si la API falla.
  const [plansData, setPlansData] = React.useState(PLANS);
  React.useEffect(() => {
    let cancelled = false;
    fetch('/api/public/alquiloya/planes-publicacion', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : Promise.reject(new Error('http ' + r.status)))
      .then(body => {
        if (cancelled) return;
        const arr = body && body.success && body.data && Array.isArray(body.data.planes) ? body.data.planes : null;
        if (!arr || arr.length === 0) return;
        // Normalizar al shape consumido por el render (compat con PLANS mock).
        const mapped = arr.map(p => ({
          tier: p.tier,
          target: p.target,
          name: p.nombre,
          price: Number(p.precio) || 0,
          billing: p.billing,
          badge: p.badge,
          bullets: Array.isArray(p.bullets) ? p.bullets : [],
          excluded: Array.isArray(p.excluded) ? p.excluded : [],
          cta: p.cta || 'Quiero este plan',
          highlighted: !!p.highlighted,
          freeBoosts: p.free_boosts != null ? Number(p.free_boosts) : undefined,
        }));
        setPlansData(mapped);
      })
      .catch(() => { /* fallback PLANS ya cargado */ });
    return () => { cancelled = true; };
  }, []);
  const filtered = plansData.filter(p => p.tier.includes(audience === 'owner' ? 'owner' : 'agent'));
  return (
    <div className="fade-in container" style={{ padding: '48px 32px' }}>
      <div style={{ textAlign: 'center', maxWidth: 720, margin: '0 auto' }}>
        <div className="tag" style={{ color: 'var(--blue)' }}>Planes y precios</div>
        <h2 style={{ fontSize: 44, marginTop: 8, lineHeight: 1.1 }}>
          Publicá tu inmueble y llegá a personas que ya están buscando.
        </h2>
        <p style={{ marginTop: 16, fontSize: 17, color: 'var(--ink-3)' }}>
          Empezá gratis. Si necesitás más visibilidad, fotos o estadísticas, cambiá de plan cuando quieras.
        </p>
      </div>
      <div className="row" style={{ justifyContent: 'center', marginTop: 28 }}>
        <Segment value={audience} onChange={setAudience} items={[
          { id: 'owner', label: 'Dueños directos' },
          { id: 'agent', label: 'Agentes e inmobiliarias' },
        ]}/>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 22, marginTop: 40, maxWidth: 960, margin: '40px auto 0' }}>
        {filtered.map(p => <PlanCard key={p.tier} plan={p}/>)}
      </div>

      <div className="card" style={{ marginTop: 56, padding: '32px 32px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, alignItems: 'center' }}>
        <div>
          <div className="tag">Add-on</div>
          <h3 style={{ marginTop: 8, fontSize: 24 }}>Inmueble destacado / verificado</h3>
          <p className="muted" style={{ marginTop: 8, fontSize: 14.5, lineHeight: 1.6 }}>
            Pedí la verificación de tu inmueble: nuestro equipo confirma documentación, ubicación real y fotos. Obtené el badge azul, prioridad en resultados y mayor confianza para los interesados.
          </p>
          <div className="row gap-12" style={{ marginTop: 18 }}>
            <button className="btn btn-blue" onClick={() => setVerifyOpen(true)}>Solicitar verificación <I.check s={14}/></button>
            <span className="muted xs">Desde Gs. 45.000 por inmueble</span>
          </div>
        </div>
        <div className="row gap-16" style={{ justifyContent: 'flex-end' }}>
          <div className="card" style={{ padding: 18, width: 240, transform: 'rotate(-2deg)' }}>
            <div className="row gap-8">
              <span className="badge badge-verified"><I.check s={11}/> Verificado</span>
            </div>
            <div style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 18, color: 'var(--blue)', marginTop: 10 }}>Gs. 3.800.000</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>+340% más vistas que un inmueble sin verificar</div>
          </div>
          <div className="card" style={{ padding: 18, width: 200, transform: 'rotate(3deg)', background: 'var(--yellow-50)' }}>
            <div className="row gap-8">
              <span className="badge badge-featured"><I.star s={11}/> Destacado</span>
            </div>
            <div style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 16, marginTop: 10 }}>Posición top</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>7 días en home y catálogo</div>
          </div>
        </div>
      </div>

      <ImpulseSection/>
      <CompareTable/>
      <PlansFaq/>
      {verifyOpen && <VerificationModal onClose={() => setVerifyOpen(false)}/>}
    </div>
  );
}

function PlanCard({ plan }) {
  const highlight = plan.highlighted;
  return (
    <div className="card" style={{
      padding: 28, position: 'relative',
      border: highlight ? '2px solid var(--yellow)' : '1px solid var(--line)',
      background: highlight ? 'linear-gradient(180deg, #fff7e3 0%, #fff 200px)' : '#fff',
      boxShadow: highlight ? '0 20px 40px rgba(249,176,0,.15)' : 'var(--shadow-sm)'
    }}>
      {plan.badge && (
        <div style={{
          position: 'absolute', top: -12, left: 28,
          background: highlight ? 'var(--yellow)' : 'var(--blue)', color: highlight ? 'var(--ink)' : '#fff',
          padding: '4px 12px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, letterSpacing: '.04em'
        }}>{plan.badge.toUpperCase()}</div>
      )}
      <div className="row gap-8">
        <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.08em', color: 'var(--ink-3)' }}>
          PARA {plan.target.toUpperCase()}
        </span>
      </div>
      <div style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 26, marginTop: 6 }}>{plan.name}</div>
      <div style={{ marginTop: 16, display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
        {plan.billing === 'gratis' ? (
          <span style={{ fontFamily: 'Montserrat', fontWeight: 900, fontSize: 44, color: 'var(--blue)' }}>Gs. 0</span>
        ) : (
          <>
            <span style={{ fontFamily: 'Montserrat', fontWeight: 900, fontSize: 44, color: 'var(--blue)' }}>{formatGs(plan.price)}</span>
            <span className="muted" style={{ fontSize: 14 }}>
              {plan.billing === 'mensual' ? '/ mes' : 'pago único'}
            </span>
          </>
        )}
      </div>
      {plan.billing === 'unico' && (
        <div style={{ marginTop: 4 }}>
          <span className="badge badge-soft-yellow" style={{ fontSize: 11 }}>Sin renovación automática</span>
        </div>
      )}
      {plan.billing === 'mensual' && (
        <div style={{ marginTop: 4 }}>
          <span className="badge badge-soft" style={{ fontSize: 11 }}>Suscripción recurrente</span>
        </div>
      )}
      <button className={"btn " + (highlight ? 'btn-primary' : 'btn-blue')} style={{ width: '100%', justifyContent: 'center', marginTop: 18 }}>
        {plan.cta}
      </button>
      <div className="divider" style={{ margin: '22px 0' }}/>
      <div className="col gap-12">
        {plan.bullets.map(b => (
          <div key={b} className="row gap-10" style={{ alignItems: 'flex-start' }}>
            <span style={{ width: 18, height: 18, borderRadius: '50%', background: highlight ? 'var(--yellow)' : 'var(--blue-50)', color: highlight ? 'var(--ink)' : 'var(--blue)', display: 'grid', placeItems: 'center', flexShrink: 0, marginTop: 1 }}>
              <I.check s={11}/>
            </span>
            <span style={{ fontSize: 14, color: 'var(--ink-2)' }}>{b}</span>
          </div>
        ))}
        {plan.excluded && plan.excluded.length > 0 && plan.excluded.map(b => (
          <div key={b} className="row gap-10" style={{ alignItems: 'flex-start', opacity: .55 }}>
            <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--bg-3)', color: 'var(--ink-4)', display: 'grid', placeItems: 'center', flexShrink: 0, marginTop: 1, fontSize: 12, fontWeight: 700 }}>
              ×
            </span>
            <span style={{ fontSize: 13.5, color: 'var(--ink-3)', textDecoration: 'line-through' }}>{b}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CompareTable() {
  const cols = [
    { key: 'gratuito', name: 'Gratuito', subtitle: 'Dueño Directo' },
    { key: 'basico',   name: 'Básico',   subtitle: 'Dueño · Pago Único' },
    { key: 'starter',  name: 'Starter',  subtitle: 'Agente Independiente' },
    { key: 'premium',  name: 'Premium',  subtitle: 'Inmobiliaria / Top Pro' },
  ];
  const rows = [
    ['Precio mensual',                'Gratis',         'Gs. 49.000',            'Gs. 149.000',                'Gs. 399.000'],
    ['Vigencia del anuncio / plan',   '30 días',        '30 días (fijo)',        'Recurrente',                 'Recurrente'],
    ['Capacidad de propiedades activas', '1',           '1',                     '15',                         '50'],
    ['Fotos permitidas por inmueble', '5',              '5',                     '10',                         '15'],
    ['Contacto directo a WhatsApp',   'Sí',             'Sí',                    'Sí',                         'Sí'],
    ['Prioridad en búsqueda',         '—',              'Máxima prioridad',      'Sí',                         'Sí'],
    ['Impulsos gratis por mes',       '—',              '—',                     '3',                          '10'],
    ['Comprar impulsos extra',        '—',              '—',                     'Sí',                         'Sí'],
    ['Destacado (primer plano)',      '—',              '—',                     'Sí',                         'Sí'],
    ['Video Tour 360° + Link Redes',  '—',              '—',                     'Sí',                         'Sí'],
    ['Herramientas de marketing (Flyer + QR)', '—',     '—',                     'Sí',                         'Sí'],
    ['Identidad propia en la plataforma', '—',          '—',                     '—',                          'Sí'],
    ['CRM integrado con WhatsApp',    '—',              '—',                     '—',                          'Sí'],
    ['Soporte técnico especializado', 'Básico',         'Básico',                'Sí',                         'Prioritario'],
  ];
  const cellStyle = (v) => ({
    fontSize: 13.5,
    color: v === '—' ? 'var(--ink-4)' : (v === 'Sí' ? 'var(--green)' : 'var(--ink-2)'),
    fontWeight: v === 'Sí' ? 700 : 500,
    textAlign: 'center',
  });
  return (
    <div style={{ marginTop: 56 }}>
      <SectionHead eyebrow="Comparativa" title="Todo lo que incluye cada plan" />
      <div className="card" style={{ marginTop: 24, padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr repeat(4, 1fr)', background: 'var(--blue)', color: '#fff', padding: '16px 18px', fontWeight: 700, fontSize: 13 }}>
          <div>Características / Beneficios</div>
          {cols.map(c => (
            <div key={c.key} style={{ textAlign: 'center', lineHeight: 1.25 }}>
              <div style={{ fontWeight: 800 }}>Plan {c.name}</div>
              <div style={{ fontSize: 11, opacity: .85, fontWeight: 500 }}>({c.subtitle})</div>
            </div>
          ))}
        </div>
        {rows.map(([label, a, b, c, d], i) => (
          <div key={label} style={{ display: 'grid', gridTemplateColumns: '1.4fr repeat(4, 1fr)', padding: '12px 18px', fontSize: 14, borderTop: '1px solid var(--line-2)', background: i % 2 ? 'var(--bg-2)' : '#fff', alignItems: 'center' }}>
            <div style={{ color: 'var(--ink-2)', fontWeight: 500 }}>{label}</div>
            <div style={cellStyle(a)}>{a}</div>
            <div style={cellStyle(b)}>{b}</div>
            <div style={cellStyle(c)}>{c}</div>
            <div style={cellStyle(d)}>{d}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ImpulseSection() {
  return (
    <div style={{ marginTop: 56 }}>
      <SectionHead eyebrow="Impulsos" title="Destacá más propiedades cuando lo necesites" />
      <div className="card" style={{ marginTop: 24, padding: 32, background: 'linear-gradient(135deg, #fff7e3 0%, #fff 60%)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, alignItems: 'center' }}>
          <div>
            <div className="row gap-8">
              <span className="badge badge-featured"><I.bolt s={11}/> Cómo funcionan</span>
            </div>
            <h3 style={{ fontSize: 22, marginTop: 12 }}>1 impulso = 7 días destacado en home y catálogo</h3>
            <p className="muted" style={{ marginTop: 10, fontSize: 14.5, lineHeight: 1.6 }}>
              El plan <strong>Starter</strong> incluye <strong>3 impulsos gratis</strong> por mes y <strong>Premium</strong> incluye <strong>10</strong>.
              Si necesitás destacar más propiedades, comprá impulsos extra y usalos cuando quieras — sin vencimiento.
            </p>
            <div className="col gap-8" style={{ marginTop: 16 }}>
              {[
                'Aparece en el primer plano del catálogo y home',
                'Badge "Destacada" amarillo en la card',
                'Hasta 3x más visualizaciones promedio',
                'Sin vencimiento: los impulsos no caducan',
              ].map(t => (
                <div key={t} className="row gap-10">
                  <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--yellow)', color: 'var(--ink)', display: 'grid', placeItems: 'center' }}>
                    <I.check s={11}/>
                  </span>
                  <span style={{ fontSize: 13.5, color: 'var(--ink-2)' }}>{t}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="col gap-12">
            {IMPULSE_PACKS.map(pack => (
              <div key={pack.id} className="card" style={{
                padding: 16,
                border: pack.popular ? '2px solid var(--yellow)' : (pack.best ? '2px solid var(--blue)' : '1px solid var(--line)'),
                position: 'relative'
              }}>
                {pack.popular && <span style={{ position: 'absolute', top: -10, right: 16, background: 'var(--yellow)', color: 'var(--ink)', padding: '2px 10px', borderRadius: 999, fontSize: 10.5, fontWeight: 700 }}>MÁS ELEGIDO</span>}
                {pack.best && <span style={{ position: 'absolute', top: -10, right: 16, background: 'var(--blue)', color: '#fff', padding: '2px 10px', borderRadius: 999, fontSize: 10.5, fontWeight: 700 }}>MEJOR PRECIO</span>}
                <div className="row between" style={{ alignItems: 'center' }}>
                  <div>
                    <div className="row gap-8" style={{ alignItems: 'baseline' }}>
                      <span style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 22 }}>
                        {pack.qty} <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-3)' }}>impulso{pack.qty > 1 ? 's' : ''}</span>
                      </span>
                      {pack.save && <span className="badge" style={{ background: 'var(--green)', color: '#fff', fontSize: 10 }}>−{pack.save}</span>}
                    </div>
                    <div className="muted xs" style={{ marginTop: 2 }}>Gs. {pack.unit.toLocaleString('es-PY')} c/u</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 18, color: 'var(--blue)' }}>{formatGs(pack.price)}</div>
                    <button className="btn btn-blue btn-sm" style={{ marginTop: 4 }}>Comprar</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PlansFaq() {
  return null;
}

Object.assign(window, { PlansPage });
