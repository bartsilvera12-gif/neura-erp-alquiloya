// Planes para propietarios y agentes

function PlansPage({ onNav }) {
  const [audience, setAudience] = React.useState('owner');
  const [verifyOpen, setVerifyOpen] = React.useState(false);
  const [picked, setPicked] = React.useState(null); // { tier, name }
  const [changeOpen, setChangeOpen] = React.useState(false);
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

      <div className="plans-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 22, marginTop: 40, maxWidth: 960, margin: '40px auto 0' }}>
        {filtered.map(p => <PlanCard key={p.tier} plan={p} onPick={() => {
          // Planes de propietario: no requieren cuenta. Mandamos al wizard
          // directo, asi no abren el modal "Solicitar acceso" (que es solo
          // para agentes).
          if (audience === 'owner') {
            try { window.location.hash = '#publish'; } catch {}
            return;
          }
          setPicked({ tier: p.tier, name: p.name, audience });
        }}/>)}
      </div>

      <div style={{ textAlign: 'center', marginTop: 24 }}>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => setChangeOpen(true)}
          style={{ color: 'var(--blue)', fontWeight: 600 }}
        >
          Ya tengo cuenta — quiero cambiar de plan →
        </button>
      </div>

      <CompareTable/>
      <PlansFaq/>
      {verifyOpen && <VerificationModal onClose={() => setVerifyOpen(false)}/>}
      {picked && (
        <RequestAccessModal
          onClose={() => setPicked(null)}
          planTier={picked.tier}
          planLabel={picked.name}
        />
      )}
      {changeOpen && <CambioPlanModal planes={filtered} onClose={() => setChangeOpen(false)}/>}
    </div>
  );
}

function BoostPage({ onNav }) {
  const [verifyOpen, setVerifyOpen] = React.useState(false);
  const [packToBuy, setPackToBuy] = React.useState(null);
  return (
    <div className="fade-in container" style={{ padding: '48px 32px' }}>
      <div style={{ textAlign: 'center', maxWidth: 760, margin: '0 auto' }}>
        <div className="tag" style={{ color: 'var(--yellow)' }}>Destacar propiedad</div>
        <h2 style={{ fontSize: 44, marginTop: 8, lineHeight: 1.1 }}>
          Hacé que tu inmueble se vea más y mejor.
        </h2>
        <p style={{ marginTop: 16, fontSize: 17, color: 'var(--ink-3)' }}>
          Sumá verificación, posición top e impulsos para multiplicar las vistas de tu publicación.
        </p>
      </div>

      <div className="card" style={{ marginTop: 40, padding: '32px 32px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, alignItems: 'center' }}>
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

      <ImpulseSection onBuy={(pack) => setPackToBuy(pack)}/>
      {verifyOpen && <VerificationModal onClose={() => setVerifyOpen(false)}/>}
      {packToBuy && <ImpulsoCompraModal pack={packToBuy} onClose={() => setPackToBuy(null)}/>}
    </div>
  );
}

function PlanCard({ plan, onPick }) {
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
      <button
        className={"btn " + (highlight ? 'btn-primary' : 'btn-blue')}
        style={{ width: '100%', justifyContent: 'center', marginTop: 18 }}
        onClick={() => onPick && onPick()}
      >
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
  // P2C: render alterno apilado para mobile (<=760px). CSS en index.html
  // muestra/oculta cada uno segun viewport — sin tocar el contenido.
  return (
    <div style={{ marginTop: 56 }} className="plans-compare">
      <SectionHead eyebrow="Comparativa" title="Todo lo que incluye cada plan" />

      {/* DESKTOP / TABLET: tabla tradicional 5 columnas con scroll horizontal
          en el wrapper si fuera necesario. Mismo render que antes. */}
      <div className="card plans-compare-card" style={{ marginTop: 24, padding: 0, overflow: 'hidden' }}>
        <div className="plans-compare-inner">
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

      {/* MOBILE: 4 cards apiladas verticalmente, una por plan. Cero scroll
          horizontal. Cada card lista las 14 caracteristicas con valor a la
          derecha. CSS en index.html alterna entre esta vista y la tabla. */}
      <div className="plans-compare-stack" style={{ marginTop: 24 }}>
        {cols.map((c, planIdx) => (
          <div key={c.key} className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 14 }}>
            <div style={{ background: 'var(--blue)', color: '#fff', padding: '14px 18px' }}>
              <div style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 16, lineHeight: 1.2 }}>Plan {c.name}</div>
              <div style={{ fontSize: 11.5, opacity: .85, marginTop: 2 }}>({c.subtitle})</div>
            </div>
            <div>
              {rows.map(([label, ...vals], i) => {
                const v = vals[planIdx];
                return (
                  <div key={label} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '11px 16px', fontSize: 13.5,
                    borderTop: i === 0 ? 'none' : '1px solid var(--line-2)',
                    background: i % 2 ? 'var(--bg-2)' : '#fff',
                    gap: 12,
                  }}>
                    <span style={{ color: 'var(--ink-2)', fontWeight: 500, flex: 1, minWidth: 0, wordBreak: 'break-word' }}>{label}</span>
                    <span style={{ ...cellStyle(v), textAlign: 'right', whiteSpace: 'nowrap' }}>{v}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ImpulseSection({ onBuy }) {
  const [apiPacks, setApiPacks] = React.useState(null);
  React.useEffect(() => {
    let cancelled = false;
    fetch('/api/public/alquiloya/impulsos-packs', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : Promise.reject(new Error('http ' + r.status)))
      .then(body => {
        if (cancelled) return;
        const arr = body && body.success && body.data && Array.isArray(body.data.packs) ? body.data.packs : null;
        if (!arr || arr.length === 0) return;
        const mapped = arr.map(p => ({
          id: p.codigo,
          qty: Number(p.qty) || 0,
          price: Number(p.precio) || 0,
          unit: p.qty > 0 ? Math.round(Number(p.precio) / Number(p.qty)) : 0,
          popular: p.badge === 'popular',
          best: p.badge === 'best',
          save: (p.badge === 'popular' || p.badge === 'best') && p.qty > 1
            ? (function() {
                const baseUnit = (typeof window !== 'undefined' && window.IMPULSE_PACKS_BASE_UNIT) || 25000;
                const u = p.qty > 0 ? Number(p.precio) / Number(p.qty) : 0;
                const pct = Math.round((1 - u / baseUnit) * 100);
                return pct > 0 ? (pct + '%') : null;
              })()
            : null,
        }));
        setApiPacks(mapped);
      })
      .catch(() => { /* fallback IMPULSE_PACKS mock */ });
    return () => { cancelled = true; };
  }, []);
  const packs = apiPacks || IMPULSE_PACKS;
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
            {packs.map(pack => (
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
                    <button className="btn btn-blue btn-sm" style={{ marginTop: 4 }} onClick={() => onBuy && onBuy(pack)}>Comprar</button>
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

// ───────────── Modales: Cambio de plan + Compra de impulsos ─────────────

function _modalOverlay(onClose, busy) {
  return {
    style: { position: 'fixed', inset: 0, background: 'rgba(11,22,34,.55)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, overflowY: 'auto' },
    onClick: (e) => { if (e.target === e.currentTarget && !busy) onClose(); },
  };
}
// Estructura 3-zonas: header/body/footer fijos, body con scroll.
const _modalCard = { maxWidth: 460, width: '100%', background: '#fff', borderRadius: 20, position: 'relative', maxHeight: 'calc(100dvh - 32px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 60px -10px rgba(15,23,42,.4)', margin: 'auto 0' };
const _modalHead = { padding: '20px 24px 14px', borderBottom: '1px solid var(--line-2)', flexShrink: 0 };
const _modalBody = { padding: '16px 24px', overflowY: 'auto', flex: 1, minHeight: 0 };
const _modalFoot = { padding: '14px 24px', borderTop: '1px solid var(--line-2)', background: '#fff', flexShrink: 0, display: 'flex', gap: 8 };
const _fieldLabel = { fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', textTransform: 'uppercase', letterSpacing: '.03em', marginBottom: 6, display: 'block' };
const _inputStyle = { width: '100%', padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 10, fontFamily: 'inherit', fontSize: 14, color: 'var(--ink)', background: '#fff' };

function _feedback(fb) {
  if (!fb) return null;
  const isErr = fb.kind === 'error';
  if (isErr) {
    return (
      <div style={{
        marginTop: 12, padding: '10px 12px', borderRadius: 10, fontSize: 13,
        background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca',
      }}>{fb.text}</div>
    );
  }
  // Estado de exito: panel claro con icono en vez de un banner de una linea.
  return (
    <div style={{
      marginTop: 14, padding: '16px 14px', borderRadius: 12, textAlign: 'center',
      background: '#ecfdf5', border: '1px solid #a7f3d0',
    }}>
      <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#10b981', color: '#fff', display: 'grid', placeItems: 'center', margin: '0 auto 10px' }}>
        <I.check s={22}/>
      </div>
      <div style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 15, color: '#065f46' }}>
        {fb.title || '¡Pedido recibido!'}
      </div>
      <div style={{ fontSize: 13, color: '#047857', marginTop: 4, lineHeight: 1.45 }}>
        {fb.text}
      </div>
    </div>
  );
}

function CambioPlanModal({ planes, onClose }) {
  const [form, setForm] = React.useState({ nombre: '', email: '', telefono: '', plan_tier: '', mensaje: '' });
  const [busy, setBusy] = React.useState(false);
  const [feedback, setFeedback] = React.useState(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    setFeedback(null);
    if (!form.nombre.trim()) return setFeedback({ kind: 'error', text: 'Ingresá tu nombre.' });
    if (!form.email.trim() && !form.telefono.trim()) return setFeedback({ kind: 'error', text: 'Ingresá email o teléfono.' });
    if (!form.plan_tier) return setFeedback({ kind: 'error', text: 'Elegí el plan al que querés cambiar.' });
    setBusy(true);
    try {
      const res = await fetch('/api/public/alquiloya/solicitudes-servicio', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'cambio_plan',
          nombre: form.nombre.trim(),
          email: form.email.trim() || null,
          telefono: form.telefono.trim() || null,
          plan_tier: form.plan_tier,
          mensaje: form.mensaje.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) throw new Error((data && data.error) || ('HTTP ' + res.status));
      setFeedback({ kind: 'success', title: '¡Solicitud enviada!', text: 'El equipo te va a contactar para coordinar el pago y aplicar el cambio de plan.' });
      setForm({ nombre: '', email: '', telefono: '', plan_tier: '', mensaje: '' });
    } catch (err) {
      setFeedback({ kind: 'error', text: 'No pudimos registrar tu solicitud. ' + (err.message || '') });
    } finally { setBusy(false); }
  }

  return ReactDOM.createPortal(
    <div {..._modalOverlay(onClose, busy)}>
      <form onSubmit={submit} style={_modalCard} onClick={(e) => e.stopPropagation()}>
        <div style={_modalHead}>
          <h2 style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 20, margin: 0 }}>Cambiar de plan</h2>
          <p style={{ marginTop: 6, fontSize: 13.5, color: 'var(--ink-3)' }}>Decinos a qué plan querés moverte. Te contactamos para coordinar el pago y aplicar el cambio.</p>
        </div>
        <div style={_modalBody}>
          <div>
            <label style={_fieldLabel}>Plan al que cambiar *</label>
            <select style={_inputStyle} value={form.plan_tier} onChange={e => set('plan_tier', e.target.value)} required>
              <option value="">Elegí un plan…</option>
              {planes.map(p => <option key={p.tier} value={p.tier}>{p.name} — {p.billing === 'gratis' ? 'Gratis' : ('Gs. ' + Number(p.price || 0).toLocaleString('es-PY'))}</option>)}
            </select>
          </div>
          <div style={{ marginTop: 14 }}>
            <label style={_fieldLabel}>Nombre completo *</label>
            <input style={_inputStyle} maxLength={160} value={form.nombre} onChange={e => set('nombre', e.target.value)} required/>
          </div>
          <div style={{ marginTop: 14 }}>
            <label style={_fieldLabel}>Email</label>
            <input style={_inputStyle} type="email" maxLength={160} value={form.email} onChange={e => set('email', e.target.value)} placeholder="vos@ejemplo.com"/>
          </div>
          <div style={{ marginTop: 14 }}>
            <label style={_fieldLabel}>Teléfono / WhatsApp</label>
            <input style={_inputStyle} type="tel" maxLength={40} value={form.telefono} onChange={e => set('telefono', e.target.value)} placeholder="+595 9XX XXX XXX"/>
          </div>
          <div style={{ marginTop: 14 }}>
            <label style={_fieldLabel}>Mensaje (opcional)</label>
            <textarea style={{ ..._inputStyle, minHeight: 70, resize: 'vertical' }} maxLength={1200} value={form.mensaje} onChange={e => set('mensaje', e.target.value)} placeholder="Aclaraciones, fecha en que querés que arranque, etc."/>
          </div>
          {_feedback(feedback)}
        </div>
        <div style={_modalFoot}>
          <button type="button" disabled={busy} onClick={onClose} className="btn" style={{ flex: 1, background: '#f1f5f9', color: 'var(--ink-2)' }}>Cancelar</button>
          <button type="submit" disabled={busy} className="btn btn-primary" style={{ flex: 1 }}>{busy ? 'Enviando…' : 'Enviar solicitud'}</button>
        </div>
      </form>
    </div>,
    document.body
  );
}

function ImpulsoCompraModal({ pack, onClose }) {
  const [form, setForm] = React.useState({ nombre: '', email: '', telefono: '', mensaje: '' });
  const [busy, setBusy] = React.useState(false);
  const [feedback, setFeedback] = React.useState(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    setFeedback(null);
    if (!form.nombre.trim()) return setFeedback({ kind: 'error', text: 'Ingresá tu nombre.' });
    if (!form.email.trim() && !form.telefono.trim()) return setFeedback({ kind: 'error', text: 'Ingresá email o teléfono.' });
    setBusy(true);
    try {
      const res = await fetch('/api/public/alquiloya/solicitudes-servicio', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'impulsos',
          nombre: form.nombre.trim(),
          email: form.email.trim() || null,
          telefono: form.telefono.trim() || null,
          pack_id: pack.id,
          pack_qty: pack.qty,
          monto: pack.price,
          mensaje: form.mensaje.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) throw new Error((data && data.error) || ('HTTP ' + res.status));
      setFeedback({ kind: 'success', title: '¡Pedido recibido!', text: 'Te vamos a escribir por WhatsApp para coordinar el pago. Apenas se confirma, activamos los impulsos en tu cuenta.' });
      setForm({ nombre: '', email: '', telefono: '', mensaje: '' });
    } catch (err) {
      setFeedback({ kind: 'error', text: 'No pudimos registrar tu compra. ' + (err.message || '') });
    } finally { setBusy(false); }
  }

  return ReactDOM.createPortal(
    <div {..._modalOverlay(onClose, busy)}>
      <form onSubmit={submit} style={_modalCard} onClick={(e) => e.stopPropagation()}>
        <div style={_modalHead}>
          <h2 style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 20, margin: 0 }}>Comprar impulsos</h2>
          <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 10, background: 'var(--yellow-50)', border: '1px solid var(--yellow)' }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.06em', color: '#8a5e00', textTransform: 'uppercase' }}>Pack seleccionado</div>
            <div style={{ marginTop: 2, fontFamily: 'Montserrat', fontWeight: 800, fontSize: 16, color: 'var(--ink)' }}>
              {pack.qty} impulso{pack.qty > 1 ? 's' : ''} · Gs. {Number(pack.price || 0).toLocaleString('es-PY')}
            </div>
          </div>
          {/* P2B: aviso claro de pago manual por WhatsApp */}
          <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 10, background: '#EAF4FF', border: '1px solid #BCDDF7', color: '#0F3C66', fontSize: 13, lineHeight: 1.45 }}>
            El pago se coordina por WhatsApp. Una vez confirmado, el equipo activa los impulsos en tu cuenta.
          </div>
          {/* CTA principal: WhatsApp directo */}
          {(() => {
            const wa = (typeof window !== 'undefined' && window.CONTACTO_ALQUILOYA && window.CONTACTO_ALQUILOYA.whatsapp) || '595983000292';
            const msg = encodeURIComponent(`Hola AlquiloYa, quiero comprar un pack de ${pack.qty} impulso${pack.qty > 1 ? 's' : ''} por Gs. ${Number(pack.price || 0).toLocaleString('es-PY')}.`);
            const wHref = `https://wa.me/${wa}?text=${msg}`;
            return (
              <a
                href={wHref}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  marginTop: 10, padding: '12px 14px', borderRadius: 12,
                  background: '#25D366', color: '#fff', textDecoration: 'none',
                  fontFamily: 'Montserrat', fontWeight: 800, fontSize: 14.5,
                  boxShadow: '0 8px 22px rgba(37,211,102,.35)',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.371-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0 0 20.464 3.488"/>
                </svg>
                Coordinar por WhatsApp
              </a>
            );
          })()}
          <div style={{ marginTop: 10, fontSize: 11.5, color: 'var(--ink-3)', textAlign: 'center' }}>
            ¿Preferís dejar tus datos? Completá el formulario abajo y te escribimos.
          </div>
        </div>
        <div style={_modalBody}>
          <div>
            <label style={_fieldLabel}>Nombre completo *</label>
            <input style={_inputStyle} maxLength={160} value={form.nombre} onChange={e => set('nombre', e.target.value)} required/>
          </div>
          <div style={{ marginTop: 14 }}>
            <label style={_fieldLabel}>Email</label>
            <input style={_inputStyle} type="email" maxLength={160} value={form.email} onChange={e => set('email', e.target.value)} placeholder="vos@ejemplo.com"/>
          </div>
          <div style={{ marginTop: 14 }}>
            <label style={_fieldLabel}>Teléfono / WhatsApp</label>
            <input style={_inputStyle} type="tel" maxLength={40} value={form.telefono} onChange={e => set('telefono', e.target.value)} placeholder="+595 9XX XXX XXX"/>
          </div>
          <div style={{ marginTop: 14 }}>
            <label style={_fieldLabel}>Mensaje (opcional)</label>
            <textarea style={{ ..._inputStyle, minHeight: 70, resize: 'vertical' }} maxLength={1200} value={form.mensaje} onChange={e => set('mensaje', e.target.value)}/>
          </div>
          {_feedback(feedback)}
        </div>
        <div style={_modalFoot}>
          <button type="button" disabled={busy} onClick={onClose} className="btn" style={{ flex: 1, background: '#f1f5f9', color: 'var(--ink-2)' }}>Cancelar</button>
          <button type="submit" disabled={busy} className="btn btn-primary" style={{ flex: 1 }}>{busy ? 'Enviando…' : 'Enviar pedido'}</button>
        </div>
      </form>
    </div>,
    document.body
  );
}

Object.assign(window, { PlansPage, BoostPage, CambioPlanModal, ImpulsoCompraModal });
