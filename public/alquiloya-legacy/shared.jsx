// Shared layout components: Header, Footer, PropertyCard, AdBanner, QRMock, etc.

function Header({ route, onNav, onPublish }) {
  const items = [
    { id: 'home', label: 'Inicio' },
    { id: 'catalog', label: 'Alquileres' },
    { id: 'publish', label: 'Publicar propiedad' },
    { id: 'plans', label: 'Planes' },
    { id: 'help', label: 'Ayuda' },
  ];
  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 40,
      background: '#fff', borderBottom: '1px solid var(--line)',
      boxShadow: '0 1px 0 rgba(11,22,34,.03)',
      overflow: 'hidden',
    }}>
      <div className="container" style={{
        height: 96, display: 'flex', alignItems: 'center', gap: 24, position: 'relative'
      }}>
        {/* Logo */}
        <button onClick={() => onNav('home')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0 }}>
          <Logo size={32} />
        </button>

        {/* Nav */}
        <nav className="row gap-24" style={{ marginLeft: 8, flexShrink: 0 }}>
          {items.map(it => (
            <button key={it.id} onClick={() => onNav(it.id)} style={{
              background: 'none', border: 'none', padding: '8px 4px',
              fontSize: 14.5, fontWeight: 600,
              color: route === it.id ? 'var(--blue)' : 'var(--ink-2)',
              borderBottom: route === it.id ? '2px solid var(--blue)' : '2px solid transparent',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}>{it.label}</button>
          ))}
        </nav>

        {/* Decorative zone — fills space between nav and button */}
        <div className="header-hero-deco" style={{
          flex: 1, minWidth: 0, height: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          paddingLeft: 24, paddingRight: 24,
          pointerEvents: 'none', zIndex: 0,
        }}>
          <img
            src="uploads/hero.png"
            alt=""
            aria-hidden="true"
            style={{
              width: '100%', maxWidth: 880, height: 120,
              objectFit: 'contain', objectPosition: 'center center',
              opacity: 0.52,
              maskImage: 'linear-gradient(90deg, transparent 0%, #000 14%, #000 86%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, #000 14%, #000 86%, transparent 100%)',
            }}
          />
        </div>

        {/* Ingresar button */}
        <div style={{ flexShrink: 0, position: 'relative', zIndex: 2 }}>
          <button
            onClick={() => {
              // Siempre derivamos al portal público de agentes; el panel
              // #admin-agent ya no se abre directo desde acá.
              window.location.href = '/portal-agentes';
            }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '10px 22px',
              borderRadius: 999,
              border: 'none',
              background: 'var(--blue)',
              color: '#fff',
              fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(0,88,165,.25)',
              transition: 'background .15s, transform .1s, box-shadow .15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--blue-700)'; e.currentTarget.style.boxShadow = '0 6px 18px rgba(0,88,165,.35)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--blue)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,88,165,.25)'; }}
            onMouseDown={e => { e.currentTarget.style.transform = 'scale(.97)'; }}
            onMouseUp={e => { e.currentTarget.style.transform = ''; }}
          >
            <I.user s={16}/> Ingresar
          </button>
        </div>
      </div>
    </header>
  );
}

function Footer({ onNav }) {
  return (
    <footer style={{ background: '#0b1622', color: '#cfd6df', marginTop: 64 }}>
      <div className="container" style={{ padding: '56px 32px 32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr 1fr', gap: 40 }}>
          <div>
            <Logo size={26} dark />
            <p style={{ marginTop: 16, color: '#9aa4b1', fontSize: 14, fontStyle: 'italic', fontWeight: 600 }}>
              ¡Donde encontrás más rápido!
            </p>
            <p style={{ marginTop: 12, color: '#7a8593', fontSize: 13 }}>
              El marketplace inmobiliario más rápido para alquileres en Paraguay.
            </p>
          </div>
          <FootCol title="Buscar" items={['Departamentos','Casas','Salones comerciales','Temporales']} onClick={() => onNav('catalog')} />
          <FootCol title="Para propietarios" items={['Publicar inmueble','Planes y precios','Carteles QR','Centro de ayuda']} />
          <FootCol title="Empresa" items={['Sobre AlquiloYa','Términos','Política de privacidad','Trabajá con nosotros']} />
          <FootCol title="Contacto" items={['hola@alquiloya.com.py','+595 21 555 0100','Asunción, Paraguay','Lun a Sáb 8–20 hs']} />
        </div>
        <div style={{ borderTop: '1px solid #1b2a3a', marginTop: 40, paddingTop: 20, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 12.5, color: '#6b7785', flexShrink: 0 }}>© 2026 AlquiloYa · Todos los derechos reservados</div>
          <div style={{ flex: 1, textAlign: 'center', fontSize: 12.5, color: '#9aa4b1' }}>
            Desarrollado por <a href="https://neura.com.py" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--yellow)', fontWeight: 700, textDecoration: 'none' }}>Neura</a>
          </div>
          <div className="row gap-16" style={{ fontSize: 12.5, color: '#6b7785', flexShrink: 0 }}>
            <span>Instagram</span><span>Facebook</span><span>WhatsApp</span><span>TikTok</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
function FootCol({ title, items, onClick }) {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 14, letterSpacing: '.02em' }}>{title}</div>
      <div className="col gap-8">
        {items.map(it => <a key={it} onClick={onClick} style={{ color: '#9aa4b1', fontSize: 13.5, cursor: 'pointer' }}>{it}</a>)}
      </div>
    </div>
  );
}

function Photo({ src, alt, label, style, children, className = '' }) {
  return (
    <div className={`photo ${className}`} style={{ borderRadius: 12, ...style }}>
      {src && <img src={src} alt={alt || ''} loading="lazy" />}
      {label && <div className="photo-label">{label}</div>}
      {children}
    </div>
  );
}

function PropertyCard({ p, onClick, compact = false }) {
  return (
    <div className="card" style={{
      overflow: 'hidden', cursor: 'pointer',
      transition: 'transform .2s ease, box-shadow .2s ease',
      display: 'flex', flexDirection: 'column', height: '100%',
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = 'var(--shadow-lg)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
      onClick={onClick}
    >
      <div style={{
        position: 'relative',
        WebkitMaskImage: 'linear-gradient(180deg, #000 0%, #000 82%, transparent 100%)',
        maskImage: 'linear-gradient(180deg, #000 0%, #000 82%, transparent 100%)',
      }}>
        <Photo src={p.cover} style={{ height: compact ? 170 : 200, borderRadius: 0 }} />
        <div className="row gap-8" style={{ position: 'absolute', top: 12, left: 12 }}>
          {p.verified && <span className="badge badge-verified"><I.check s={11}/> Verificado</span>}
          {p.featured && <span className="badge badge-featured"><I.star s={11}/> Destacado</span>}
          {p.isNew && !p.featured && <span className="badge badge-new">Nuevo</span>}
          {p.tipo === 'temporal' && <span className="badge badge-temporal">Temporal</span>}
        </div>
        <button style={{
          position: 'absolute', top: 12, right: 12, width: 34, height: 34,
          borderRadius: '50%', background: 'rgba(255,255,255,.95)', border: 'none',
          display: 'grid', placeItems: 'center', cursor: 'pointer'
        }} onClick={e => e.stopPropagation()}>
          <I.heart s={16}/>
        </button>
        <div className="mono xs"
          style={{ position: 'absolute', bottom: 12, right: 12, background: 'rgba(11,22,34,.7)', color: '#fff', padding: '4px 8px', borderRadius: 6, fontSize: 11, fontFamily: 'JetBrains Mono, monospace', backdropFilter: 'blur(6px)' }}>
          {p.id}
        </div>
      </div>
      <div style={{ padding: '16px 18px 18px', display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div className="row between" style={{ alignItems: 'flex-start' }}>
          <div style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 19, color: 'var(--blue)' }}>
            {formatGs(p.price)}
            <span style={{ fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 500, marginLeft: 4 }}>
              {p.tipo === 'temporal' ? '/ noche' : '/ mes'}
            </span>
          </div>
        </div>
        <div style={{ fontSize: 15.5, fontWeight: 600, color: 'var(--ink)', marginTop: 4, lineHeight: 1.3,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          minHeight: 'calc(15.5px * 1.3 * 2)' /* always reserve 2 lines */ }}>
          {p.title}
        </div>
        <div className="row gap-4 muted" style={{ marginTop: 6, fontSize: 13 }}>
          <I.pin s={13}/> <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.address}</span>
        </div>
        <div style={{ flex: 1 }}/>
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line-2)', color: 'var(--ink-3)', fontSize: 12.5, display: 'flex', flexWrap: 'wrap', gap: '8px 14px', alignItems: 'center' }}>
          {p.beds > 0 && (
            <span className="row gap-4" title={p.beds + ' dormitorios'}>
              <I.bed s={14}/> <strong style={{ color: 'var(--ink-2)', fontWeight: 700 }}>{p.beds}</strong> dorm
            </span>
          )}
          <span className="row gap-4" title={p.baths + ' baños'}>
            <I.bath s={14}/> <strong style={{ color: 'var(--ink-2)', fontWeight: 700 }}>{p.baths}</strong> baño{p.baths>1?'s':''}
          </span>
          <span className="row gap-4" title={p.m2 + ' m²'}>
            <I.ruler s={14}/> <strong style={{ color: 'var(--ink-2)', fontWeight: 700 }}>{p.m2}</strong> m²
          </span>
          {p.cochera && (
            <span className="row gap-4" title="Cochera">
              <I.car s={14}/> Cochera
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function AdBanner({ ad, variant = 'horizontal' }) {
  if (!ad) return null;
  if (variant === 'horizontal') {
    return (
      <div style={{
        background: ad.color, borderRadius: 16, padding: '20px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        border: `1px dashed ${ad.tint}33`,
      }}>
        <div className="row gap-16">
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', color: ad.tint }}>PUBLICIDAD · {ad.tag.toUpperCase()}</div>
        </div>
        <div className="row gap-24" style={{ flex: 1, marginLeft: 24 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 18, color: 'var(--ink)' }}>{ad.brand}</div>
            <div style={{ fontSize: 14, color: 'var(--ink-2)' }}>{ad.desc}</div>
          </div>
          <button className="btn btn-outline btn-sm">Conocer más <I.arrow s={14}/></button>
        </div>
      </div>
    );
  }
  // sidebar / card
  return (
    <div style={{
      background: ad.color, borderRadius: 14, padding: 18,
      border: `1px dashed ${ad.tint}33`,
    }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.1em', color: ad.tint, marginBottom: 12 }}>PUBLICIDAD</div>
      <div style={{
        height: 120, borderRadius: 10, background: `linear-gradient(135deg, ${ad.tint}22, ${ad.tint}11)`,
        display: 'grid', placeItems: 'center', fontFamily: 'JetBrains Mono', fontSize: 11, color: ad.tint
      }}>{ad.tag}.jpg</div>
      <div style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 16, marginTop: 12 }}>{ad.brand}</div>
      <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 4 }}>{ad.desc}</div>
      <button className="btn btn-outline btn-sm" style={{ marginTop: 12, width: '100%', justifyContent: 'center' }}>Conocer más</button>
    </div>
  );
}

// QR mock — fake QR using checker pattern
function QRMock({ size = 140, id = 'AY-00000', dark = '#0b1622' }) {
  // deterministic 21x21 grid
  const N = 21;
  const cells = [];
  let seed = 0;
  for (let i = 0; i < id.length; i++) seed = (seed * 31 + id.charCodeAt(i)) >>> 0;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      seed = (seed * 1103515245 + 12345) >>> 0;
      const isFinder = (x < 7 && y < 7) || (x > N-8 && y < 7) || (x < 7 && y > N-8);
      const isFinderBorder = isFinder && ((x === 0 || x === 6 || y === 0 || y === 6) || (x < 7 && y < 7 && x>=2 && x<=4 && y>=2 && y<=4) || (x > N-8 && (x === N-7 || x === N-1) ) );
      const finderFill = isFinder && (
        (x>=0 && x<=6 && y>=0 && y<=6 && (x===0||x===6||y===0||y===6||(x>=2&&x<=4&&y>=2&&y<=4))) ||
        (x>=N-7 && y>=0 && y<=6 && (x===N-7||x===N-1||y===0||y===6||(x>=N-5&&x<=N-3&&y>=2&&y<=4))) ||
        (x>=0 && x<=6 && y>=N-7 && (x===0||x===6||y===N-7||y===N-1||(x>=2&&x<=4&&y>=N-5&&y<=N-3)))
      );
      const fill = isFinder ? finderFill : ((seed >>> 16) % 100) < 48;
      if (fill) cells.push(<rect key={x+','+y} x={x} y={y} width="1" height="1" fill={dark}/>);
    }
  }
  return (
    <svg viewBox={`0 0 ${N} ${N}`} width={size} height={size} style={{ background: '#fff', borderRadius: 6, display: 'block' }}>
      <rect width={N} height={N} fill="#fff"/>
      {cells}
    </svg>
  );
}

function Avatar({ name, size = 40, color }) {
  const initial = (name || '?').split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase();
  const colors = ['#0058A5','#1f8a5b','#c33636','#6e3ad1','#a36100','#0e7a8a'];
  const c = color || colors[(name?.length || 0) % colors.length];
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: c, color: '#fff',
      display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: size * 0.4,
      flexShrink: 0
    }}>{initial}</div>
  );
}

// Pretty custom select — replaces native <select> for full visual control
function PrettySelect({ value, onChange, options, placeholder, className, style, variant }) {
  const norm = (options || []).map(o => typeof o === 'string' ? { value: o, label: o } : o);
  const [open, setOpen] = React.useState(false);
  const [coords, setCoords] = React.useState({ left: 0, top: 0, width: 200 });
  const wrapRef = React.useRef(null);
  const btnRef = React.useRef(null);
  const popRef = React.useRef(null);

  const recomputeCoords = () => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setCoords({ left: r.left, top: r.bottom + 6, width: Math.max(r.width, 220) });
  };

  // recompute before paint so the popup never flashes at (0,0)
  React.useLayoutEffect(() => { if (open) recomputeCoords(); }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target) &&
          popRef.current && !popRef.current.contains(e.target)) setOpen(false);
    };
    const onScroll = () => recomputeCoords();
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);
  const current = norm.find(o => o.value === value);
  const isInline = variant === 'inline';

  return (
    <div ref={wrapRef} className={className} style={{ position: 'relative', ...(style || {}) }}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          padding: isInline ? 0 : '12px 38px 12px 14px',
          borderRadius: isInline ? 0 : 12,
          border: isInline ? 'none' : ('1px solid ' + (open ? 'var(--blue)' : 'var(--line)')),
          background: isInline ? 'transparent' : '#fff',
          color: 'var(--ink)',
          fontSize: isInline ? 15 : 14,
          fontWeight: isInline ? 700 : 500,
          fontFamily: 'inherit',
          textAlign: 'left',
          cursor: 'pointer',
          outline: 'none',
          boxShadow: !isInline && open ? '0 0 0 4px var(--blue-50)' : 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          transition: 'border-color .15s, box-shadow .15s',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {current ? current.label : (placeholder || 'Seleccionar…')}
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s', flexShrink: 0 }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {open && ReactDOM.createPortal(
        <div ref={popRef} style={{
          position: 'fixed',
          left: coords.left, top: coords.top, width: coords.width,
          background: '#fff', borderRadius: 12, border: '1px solid var(--line)',
          boxShadow: '0 16px 40px rgba(11,22,34,.18), 0 4px 12px rgba(11,22,34,.08)',
          zIndex: 300, maxHeight: 320, overflowY: 'auto', padding: 6,
          animation: 'fadeIn .12s ease both'
        }}>
          {norm.map(o => {
            const selected = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false); }}
                style={{
                  width: '100%', textAlign: 'left',
                  padding: '10px 12px', borderRadius: 8,
                  border: 'none', cursor: 'pointer',
                  background: selected ? 'var(--blue-50)' : 'transparent',
                  color: selected ? 'var(--blue)' : 'var(--ink-2)',
                  fontWeight: selected ? 700 : 500,
                  fontSize: 14, fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                  transition: 'background .12s',
                }}
                onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'var(--bg-2)'; }}
                onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.label}</span>
                {selected && <I.check s={13}/>}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}

// Tabbed segment control
function Segment({ items, value, onChange }) {
  return (
    <div style={{ display: 'inline-flex', background: 'var(--bg-3)', borderRadius: 999, padding: 4 }}>
      {items.map(it => (
        <button key={it.id} onClick={() => onChange(it.id)} style={{
          padding: '8px 16px', borderRadius: 999, border: 'none',
          background: value === it.id ? '#fff' : 'transparent',
          color: value === it.id ? 'var(--ink)' : 'var(--ink-3)',
          fontWeight: 600, fontSize: 13.5, cursor: 'pointer',
          boxShadow: value === it.id ? 'var(--shadow-sm)' : 'none',
        }}>{it.label}</button>
      ))}
    </div>
  );
}

// Verification request modal — docs obligatorios para "Inmueble Verificado"
function VerificationModal({ propertyId, propertyTitle, onClose }) {
  const [form, setForm] = React.useState({
    ccc: '', cccFile: null,
    catastralFile: null,
    nis: '', nisFile: null,
    ciNumber: '', ciFront: null, ciBack: null,
    ownerName: '', phone: '',
    accept: false,
  });
  const [step, setStep] = React.useState(1); // 1 = form, 2 = enviado
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const cccOk = form.ccc.trim().length >= 6 && form.cccFile;
  const catastralOk = !!form.catastralFile;
  const nisOk = form.nis.trim().length >= 4 && form.nisFile;
  const ciOk = form.ciNumber.trim().length >= 5 && form.ciFront && form.ciBack;
  const ownerOk = form.ownerName.trim().length >= 3 && form.phone.trim().length >= 8;
  const ready = cccOk && catastralOk && nisOk && ciOk && ownerOk && form.accept;

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(11,22,34,.55)', zIndex: 200,
      display: 'grid', placeItems: 'center', padding: 20, overflowY: 'auto'
    }}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{
        padding: 28, maxWidth: 680, width: '100%', background: '#fff', position: 'relative',
        maxHeight: 'calc(100vh - 40px)', overflowY: 'auto'
      }}>
        <button onClick={onClose} style={{
          position: 'absolute', top: 14, right: 14, background: 'var(--bg-2)', border: 'none',
          width: 32, height: 32, borderRadius: 8, cursor: 'pointer', display: 'grid', placeItems: 'center'
        }}><I.x s={14}/></button>

        {step === 2 ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--blue-50)', color: 'var(--blue)', display: 'grid', placeItems: 'center', margin: '0 auto' }}>
              <I.check s={36}/>
            </div>
            <h3 style={{ fontSize: 22, marginTop: 16 }}>Solicitud enviada</h3>
            <p className="muted" style={{ fontSize: 14, marginTop: 8, maxWidth: 380, margin: '8px auto 0' }}>
              Nuestro equipo revisará la documentación. Recibirás respuesta por email y WhatsApp en menos de 24 hs hábiles.
            </p>
            <div className="row gap-12" style={{ justifyContent: 'center', marginTop: 22 }}>
              <button className="btn btn-blue" onClick={onClose}>Entendido</button>
            </div>
          </div>
        ) : (
          <>
            <div className="tag">Verificación de inmueble</div>
            <h3 style={{ fontSize: 22, marginTop: 6 }}>Solicitar badge "Verificado"</h3>
            <p className="muted" style={{ fontSize: 13.5, marginTop: 6, lineHeight: 1.5 }}>
              Para obtener el badge azul "Verificado" y aparecer con prioridad en resultados, necesitamos confirmar la titularidad. Todos los campos son obligatorios.
            </p>

            {propertyTitle && (
              <div style={{ marginTop: 14, padding: '10px 14px', background: 'var(--bg-2)', borderRadius: 10, fontSize: 13 }}>
                <span className="muted">Inmueble: </span>
                <strong>{propertyTitle}</strong>
                {propertyId && <span className="mono muted" style={{ marginLeft: 8 }}>{propertyId}</span>}
              </div>
            )}

            <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <DocField
                label="Cuenta Corriente Catastral (CCC)"
                hint="Número de cuenta del inmueble en SET / Municipalidad"
                required
                ok={cccOk}
              >
                <input className="input" placeholder="ej. 25-1234-05" value={form.ccc} onChange={(e) => set('ccc', e.target.value)}/>
                <FileInput label="Constancia CCC (PDF/imagen)" file={form.cccFile} onChange={(f) => set('cccFile', f)}/>
              </DocField>

              <DocField
                label="Cédula Catastral / Escritura"
                hint="Documento que acredita la titularidad"
                required
                ok={catastralOk}
              >
                <FileInput label="Subir documento (PDF)" file={form.catastralFile} onChange={(f) => set('catastralFile', f)}/>
              </DocField>

              <DocField
                label="NIS de ANDE"
                hint="Número de identificación del suministro"
                required
                ok={nisOk}
              >
                <input className="input" placeholder="ej. 8123456" value={form.nis} onChange={(e) => set('nis', e.target.value)}/>
                <FileInput label="Última factura ANDE" file={form.nisFile} onChange={(f) => set('nisFile', f)}/>
              </DocField>

              <DocField
                label="CI del propietario"
                hint="Cédula de identidad del titular"
                required
                ok={ciOk}
              >
                <input className="input" placeholder="Número de CI" value={form.ciNumber} onChange={(e) => set('ciNumber', e.target.value)}/>
                <div className="row gap-8">
                  <FileInput compact label="CI frente" file={form.ciFront} onChange={(f) => set('ciFront', f)}/>
                  <FileInput compact label="CI dorso" file={form.ciBack} onChange={(f) => set('ciBack', f)}/>
                </div>
              </DocField>
            </div>

            <div className="divider" style={{ margin: '20px 0 16px' }}/>
            <div className="row gap-12" style={{ gridTemplateColumns: '1fr 1fr', display: 'grid' }}>
              <div className="field">
                <label>Nombre del titular</label>
                <input className="input" placeholder="Nombre y apellido" value={form.ownerName} onChange={(e) => set('ownerName', e.target.value)}/>
              </div>
              <div className="field">
                <label>Teléfono de contacto</label>
                <input className="input" placeholder="09xx xxxxxx" value={form.phone} onChange={(e) => set('phone', e.target.value)}/>
              </div>
            </div>

            <label className="checkbox" style={{ marginTop: 16, alignItems: 'flex-start', lineHeight: 1.4 }}>
              <input type="checkbox" checked={form.accept} onChange={(e) => set('accept', e.target.checked)} style={{ marginTop: 3 }}/>
              <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>
                Declaro que la documentación es auténtica y autorizo a AlquiloYa a verificar los datos con las entidades correspondientes. Una verificación fraudulenta puede dar de baja la cuenta.
              </span>
            </label>

            <div className="row between" style={{ marginTop: 20 }}>
              <div className="muted xs">Costo único: <strong style={{ color: 'var(--ink-2)' }}>Gs. 45.000</strong> · Vigencia: 12 meses</div>
              <div className="row gap-10">
                <button className="btn btn-outline" onClick={onClose}>Cancelar</button>
                <button
                  className="btn btn-blue"
                  disabled={!ready}
                  onClick={() => ready && setStep(2)}
                  style={{ opacity: ready ? 1 : .5, cursor: ready ? 'pointer' : 'not-allowed' }}
                >
                  Enviar solicitud <I.check s={14}/>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function DocField({ label, hint, required, ok, children }) {
  return (
    <div className="field" style={{ position: 'relative' }}>
      <label className="row between" style={{ alignItems: 'center' }}>
        <span>{label}{required && <span style={{ color: 'var(--red)', marginLeft: 4 }}>*</span>}</span>
        {ok && <span className="badge" style={{ background: 'var(--green)', color: '#fff', fontSize: 9.5 }}><I.check s={9}/> Listo</span>}
      </label>
      {hint && <div className="muted xs" style={{ marginTop: -2, marginBottom: 6 }}>{hint}</div>}
      <div className="col gap-6">{children}</div>
    </div>
  );
}

function FileInput({ label, file, onChange, compact }) {
  const inputRef = React.useRef(null);
  return (
    <label style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: compact ? '8px 10px' : '10px 12px',
      borderRadius: 10, border: '1px dashed ' + (file ? 'var(--green)' : 'var(--line)'),
      background: file ? '#eaf6f0' : 'var(--bg-2)',
      cursor: 'pointer', fontSize: 12.5,
      color: file ? 'var(--green)' : 'var(--ink-3)',
      flex: 1, minWidth: 0
    }}>
      <input ref={inputRef} type="file" style={{ display: 'none' }} accept="image/*,application/pdf"
        onChange={(e) => onChange(e.target.files?.[0] || null)}/>
      {file ? <I.check s={14}/> : <I.plus s={14}/>}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
        {file ? file.name : label}
      </span>
      {file && (
        <span onClick={(e) => { e.preventDefault(); e.stopPropagation(); onChange(null); }} style={{ cursor: 'pointer', color: 'var(--ink-3)' }}>
          <I.x s={12}/>
        </span>
      )}
    </label>
  );
}

// VIVIO — Chatbot widget conectado a Sendpulse (mock visual)
// En producción reemplazar este componente por el script oficial de Sendpulse o usar su REST API.
// Ej. integración real: <script src="https://web.webformscr.com/apps/fc3/build/loader.js?..."></script>
//                       o llamadas a https://api.sendpulse.com/chatbots/...
// ────────────────────────────────────────────────────────────────────────────
// VIVIO conversation engine — local state machine + NLP parser
// Estructura preparada para reemplazar parseUserMessage()/replyForStep() por
// llamadas a una API (Sendpulse / OpenAI / Claude) sin tocar el componente.
// ────────────────────────────────────────────────────────────────────────────

const VIVIO_WA = '595981555000'; // WhatsApp de soporte AlquiloYa

const VIVIO_INITIAL_STATE = {
  step: 'intro',
  data: {
    operacion: null,         // 'buscar' | 'publicar' | 'hablar_agente'
    tipo_inmueble: null,     // 'departamento' | 'casa' | 'duplex' | 'terreno' | 'local' | 'oficina' | 'otro'
    zona: null,              // string libre
    dormitorios: null,       // number
    presupuesto_min: null,   // number (Gs.)
    presupuesto_max: null,
    modalidad: null,         // 'alquiler' | 'compra' | 'temporal'
    nombre: null,
    telefono: null,
    mensaje_extra: null,
  },
};

// Listas de referencia — derivadas del dataset real de CIUDADES + BARRIOS_BY_CIUDAD
const KNOWN_ZONES = (() => {
  const set = new Set();
  if (typeof CIUDADES === 'object') Object.values(CIUDADES).forEach(arr => arr.forEach(c => set.add(c)));
  if (typeof BARRIOS_BY_CIUDAD === 'object') Object.values(BARRIOS_BY_CIUDAD).forEach(arr => arr.forEach(b => set.add(b)));
  return Array.from(set);
})();
const KNOWN_TYPES = {
  departamento: ['departamento','depto','depa','apartamento'],
  casa: ['casa','vivienda'],
  duplex: ['duplex','dúplex'],
  terreno: ['terreno','lote'],
  local: ['local','salon','salón','comercial'],
  oficina: ['oficina'],
};
const WORD_NUMS = { uno:1, una:1, dos:2, tres:3, cuatro:4, cinco:5, seis:6, siete:7, ocho:8, nueve:9, diez:10 };

function parseUserMessage(raw, state) {
  const text = (raw || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const found = {};

  // intención
  if (/publica(r)?|subir|cargar mi/.test(text)) found.operacion = 'publicar';
  else if (/agente|asesor|hablar con/.test(text)) found.operacion = 'hablar_agente';
  else if (/busco|buscar|necesito|quiero alquilar|quiero comprar/.test(text)) found.operacion = 'buscar';

  // modalidad
  if (/temporal|por noche|airbnb|por dia/.test(text)) found.modalidad = 'temporal';
  else if (/\bcompra(r)?\b|venta/.test(text)) found.modalidad = 'compra';
  else if (/alquil/.test(text)) found.modalidad = 'alquiler';

  // tipo de inmueble
  for (const [tipo, keys] of Object.entries(KNOWN_TYPES)) {
    if (keys.some(k => text.includes(k))) { found.tipo_inmueble = tipo; break; }
  }

  // zona — tolera espacios y acentos. ej "villamorra", "villa-morra", "villa morra"
  const normZ = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
  const textZ = normZ(text);
  const zoneMatch = KNOWN_ZONES.find(z => textZ.includes(normZ(z)));
  if (zoneMatch) found.zona = zoneMatch;

  // dormitorios — "3 dorm", "tres habitaciones", "2 dormitorios"
  const dormDigit = text.match(/(\d{1,2})\s*(dorm|hab|cuarto|amb|amb\.|recamar)/);
  if (dormDigit) found.dormitorios = parseInt(dormDigit[1], 10);
  else {
    const dormWord = text.match(/(uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s*(dorm|hab|cuarto|amb|recamar)/);
    if (dormWord) found.dormitorios = WORD_NUMS[dormWord[1]];
  }

  // presupuesto — soporta:
  //   "1.5 a 3 millones" / "1,5 a 3M" / "1500000 a 3000000" / "entre 1500 y 3000 mil"
  //   "hasta 3 millones" / "menos de 5M" / "más de 1M"
  const num = (s) => {
    if (!s) return null;
    s = s.replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.');
    const v = parseFloat(s);
    return isNaN(v) ? null : v;
  };
  const expand = (v, unit) => {
    if (v == null) return null;
    if (unit === 'm' || unit === 'mill') return Math.round(v * 1_000_000);
    if (unit === 'k' || unit === 'mil') return Math.round(v * 1_000);
    // sin unidad: si es número grande (>=1000) tomarlo literal, si chico inferir millones
    return v >= 1000 ? Math.round(v) : Math.round(v * 1_000_000);
  };
  // patrón rango "X a Y [millones|mil|m|k]"
  const rangeM = text.match(/(\d+[.,]?\d*)\s*(?:a|y|-|hasta)\s*(\d+[.,]?\d*)\s*(millon|mill|m|mil|k)?/);
  if (rangeM) {
    const unit = (rangeM[3] || '').startsWith('mill') ? 'm' : (rangeM[3] || '').startsWith('mil') ? 'mil' : rangeM[3];
    found.presupuesto_min = expand(num(rangeM[1]), unit);
    found.presupuesto_max = expand(num(rangeM[2]), unit);
    // si min > max (ej "15 a 3 millones") es ambiguo — marcarlo
    if (found.presupuesto_min && found.presupuesto_max && found.presupuesto_min > found.presupuesto_max) {
      found.presupuesto_ambiguo = true;
    }
  } else {
    // tope superior solo
    const hasta = text.match(/(?:hasta|menos de|max(?:imo)?)\s*(\d+[.,]?\d*)\s*(millon|mill|m|mil|k)?/);
    if (hasta) {
      const unit = (hasta[2] || '').startsWith('mill') ? 'm' : (hasta[2] || '').startsWith('mil') ? 'mil' : hasta[2];
      found.presupuesto_max = expand(num(hasta[1]), unit);
    }
    const desde = text.match(/(?:desde|min(?:imo)?|mas de|más de)\s*(\d+[.,]?\d*)\s*(millon|mill|m|mil|k)?/);
    if (desde) {
      const unit = (desde[2] || '').startsWith('mill') ? 'm' : (desde[2] || '').startsWith('mil') ? 'mil' : desde[2];
      found.presupuesto_min = expand(num(desde[1]), unit);
    }
  }

  // teléfono PY
  const phone = (raw || '').match(/(\+?595\s?9\d{2}|09\d{2})[\s\-]?\d{3}[\s\-]?\d{3}/);
  if (phone) found.telefono = phone[0].trim();

  // nombre — "soy Juan", "me llamo Juan Perez", "mi nombre es ..."
  const nameMatch = (raw || '').match(/(?:soy|me llamo|mi nombre es|nombre:)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?)/i);
  if (nameMatch) found.nombre = nameMatch[1].trim();
  // si state.step esperaba nombre y el texto es corto y parece ser solo nombre → tomarlo
  else if (state.step === 'collect_name' && raw && raw.trim().length <= 40 && /^[A-Za-zÁÉÍÓÚÑáéíóúñ\s]+$/.test(raw.trim())) {
    found.nombre = raw.trim();
  }

  return found;
}

function formatGsShort(n) {
  if (!n) return '—';
  if (n >= 1_000_000) return 'Gs. ' + (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1).replace('.', ',') + 'M';
  if (n >= 1_000) return 'Gs. ' + Math.round(n / 1_000) + 'K';
  return 'Gs. ' + n;
}

function nextBotReply(state) {
  const d = state.data;
  // 1. Si vino con intención publicar → flow de publicación
  if (d.operacion === 'publicar') {
    if (!d.tipo_inmueble) return { text: '¡Perfecto! ¿Qué tipo de inmueble querés publicar? (departamento, casa, local, terreno…)' };
    if (!d.zona) return { text: `Genial, un ${d.tipo_inmueble}. ¿En qué zona o barrio está ubicado?` };
    if (!d.modalidad) return { text: '¿Es para alquiler o venta?' };
    if (!d.nombre) return { text: 'Listo. ¿Cuál es tu nombre?' };
    if (!d.telefono) return { text: `Gracias, ${d.nombre}. ¿Me pasás tu número de WhatsApp (con +595)?` };
    return buildSummary(state, 'publicar');
  }

  // 2. Hablar con agente directo
  if (d.operacion === 'hablar_agente') {
    return buildSummary(state, 'agente');
  }

  // 3. Búsqueda (intención por defecto)
  // confirmar ambigüedad de precio si la hubo
  if (d._ambiguo) {
    return { text: `Solo para confirmar, ¿te referís a ${formatGsShort(d.presupuesto_min)} a ${formatGsShort(d.presupuesto_max)}? Respondé "sí" para confirmar o repetí el rango.` };
  }
  if (!d.tipo_inmueble && !d.modalidad) {
    return { text: '¿Qué tipo de inmueble buscás? (departamento, casa, duplex, local…) Y si es alquiler permanente, temporal o compra.' };
  }
  if (!d.zona) {
    return { text: 'Perfecto. ¿En qué zona o barrio te gustaría buscar? (ej. Villa Morra, Carmelitas, Lambaré…)' };
  }
  if (!d.dormitorios || !d.presupuesto_max) {
    return { text: '¡Genial! ¿Cuántos dormitorios necesitás y en qué rango de precio? (ej. "3 dorm, 1,5 a 3 millones")' };
  }
  if (!d.nombre) {
    return { text: `Ya tengo los datos principales. Te puedo derivar con un agente para mostrarte opciones disponibles. ¿Me pasás tu nombre?` };
  }
  if (!d.telefono) {
    return { text: `Gracias, ${d.nombre}. ¿Cuál es tu WhatsApp para que el agente te contacte? (con +595)` };
  }
  return buildSummary(state, 'buscar');
}

function buildSummary(state, kind) {
  const d = state.data;
  const lines = [];
  lines.push(`Gracias${d.nombre ? ', ' + d.nombre : ''}. Registré tu ${kind === 'publicar' ? 'publicación' : 'búsqueda'}:`);
  if (d.tipo_inmueble) lines.push(`• Tipo: ${d.tipo_inmueble}`);
  if (d.modalidad)     lines.push(`• Modalidad: ${d.modalidad}`);
  if (d.zona)          lines.push(`• Zona: ${d.zona}`);
  if (d.dormitorios)   lines.push(`• Dormitorios: ${d.dormitorios}`);
  if (d.presupuesto_min || d.presupuesto_max) {
    lines.push(`• Presupuesto: ${formatGsShort(d.presupuesto_min)} a ${formatGsShort(d.presupuesto_max)}`);
  }
  if (d.telefono)      lines.push(`• WhatsApp: ${d.telefono}`);
  const summary = lines.join('\n');

  const waMsg = [
    'Hola AlquiloYa, vengo del chat VIVIO. Mis datos:',
    d.nombre && `Nombre: ${d.nombre}`,
    d.telefono && `WhatsApp: ${d.telefono}`,
    d.tipo_inmueble && `Tipo: ${d.tipo_inmueble}`,
    d.modalidad && `Modalidad: ${d.modalidad}`,
    d.zona && `Zona: ${d.zona}`,
    d.dormitorios && `Dormitorios: ${d.dormitorios}`,
    (d.presupuesto_min || d.presupuesto_max) && `Presupuesto: ${formatGsShort(d.presupuesto_min)} a ${formatGsShort(d.presupuesto_max)}`,
  ].filter(Boolean).join('\n');
  const waUrl = `https://wa.me/${VIVIO_WA}?text=${encodeURIComponent(waMsg)}`;

  return {
    text: summary + '\n\nUn agente de AlquiloYa puede contactarte por WhatsApp.',
    cta: { label: 'Hablar por WhatsApp', url: waUrl },
    done: true,
  };
}

function VivioChatbot() {
  const [open, setOpen] = React.useState(false);
  const [state, setState] = React.useState(VIVIO_INITIAL_STATE);
  const [messages, setMessages] = React.useState([
    { from: 'bot', text: '¡Hola! 👋 Soy VIVIO, el asistente de AlquiloYa. ¿Qué tipo de inmueble estás buscando?' }
  ]);
  const [input, setInput] = React.useState('');
  const [typing, setTyping] = React.useState(false);
  const [spContactId, setSpContactId] = React.useState(null);
  const scrollRef = React.useRef(null);

  // ¿Sendpulse activado?
  const sendpulseActive = typeof window !== 'undefined'
    && window.SENDPULSE_CONFIG
    && (window.SENDPULSE_CONFIG.ENABLED || window.SENDPULSE_CONFIG.PROXY_ENDPOINT);

  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, open, typing]);

  const quickReplies = ['Departamento en Asunción', 'Alquiler temporal', 'Quiero publicar', 'Hablar con un agente'];

  const handleSend = async (text) => {
    if (!text || !text.trim()) return;
    setMessages(m => [...m, { from: 'user', text }]);
    setInput('');
    setTyping(true);

    // ─── Camino Sendpulse: deja que la API conduzca la conversación ────────
    if (sendpulseActive && window.vivioSendpulse) {
      try {
        const out = await window.vivioSendpulse(text, state, spContactId);
        if (out.contactId && !spContactId) setSpContactId(out.contactId);
        const merged = { ...state.data, ...(out.parsed || {}) };
        setState({ step: out.done ? 'done' : state.step, data: merged });
        setTyping(false);
        setMessages(m => [...m, { from: 'bot', text: out.reply, cta: out.cta || null }]);
        return;
      } catch (e) {
        console.warn('Sendpulse error, fallback local:', e);
        // continúa con lógica local si la API falla
      }
    }

    // ─── Camino local (parser regex + máquina de estados) ──────────────────
    let newData = { ...state.data };
    let newStep = state.step;

    if (text === 'Departamento en Asunción') {
      newData.operacion = 'buscar';
      newData.tipo_inmueble = 'departamento';
      newData.modalidad = newData.modalidad || 'alquiler';
    } else if (text === 'Alquiler temporal') {
      newData.operacion = 'buscar';
      newData.modalidad = 'temporal';
    } else if (text === 'Quiero publicar') {
      newData.operacion = 'publicar';
    } else if (text === 'Hablar con un agente') {
      newData.operacion = 'hablar_agente';
    } else {
      if (state.data._ambiguo && /^(si|sí|yes|confirmo|correcto|ok|dale)/i.test(text.trim())) {
        delete newData._ambiguo;
      } else {
        const parsed = parseUserMessage(text, state);
        const isAmbiguous = parsed.presupuesto_ambiguo;
        delete parsed.presupuesto_ambiguo;
        newData = { ...newData, ...Object.fromEntries(Object.entries(parsed).filter(([_, v]) => v != null)) };
        if (isAmbiguous) newData._ambiguo = true;
      }
    }

    const nextState = { step: newStep, data: newData };
    setState(nextState);

    setTimeout(() => {
      const reply = nextBotReply(nextState);
      setTyping(false);
      setMessages(m => [...m, { from: 'bot', text: reply.text, cta: reply.cta || null }]);
      if (reply.done) setState(s => ({ ...s, step: 'done' }));
    }, 450);
  };

  const resetConversation = () => {
    setState(VIVIO_INITIAL_STATE);
    setSpContactId(null);
    setMessages([{ from: 'bot', text: '¡Hola! 👋 Soy VIVIO, el asistente de AlquiloYa. ¿Qué tipo de inmueble estás buscando?' }]);
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 80,
        width: 64, height: 64, borderRadius: '50%',
        background: 'linear-gradient(135deg, var(--blue), #003e74)', color: '#fff',
        border: 'none', cursor: 'pointer',
        boxShadow: '0 10px 30px rgba(0,88,165,.35), 0 4px 10px rgba(0,88,165,.2)',
        display: 'grid', placeItems: 'center',
        animation: 'fadeIn .3s ease both'
      }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
        </svg>
        <span style={{
          position: 'absolute', top: -2, right: -2, width: 18, height: 18, borderRadius: '50%',
          background: 'var(--yellow)', color: 'var(--ink)', fontSize: 10, fontWeight: 800,
          display: 'grid', placeItems: 'center', border: '2px solid #fff'
        }}>1</span>
      </button>
    );
  }

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 80,
      width: 360, maxWidth: 'calc(100vw - 48px)',
      height: 520, maxHeight: 'calc(100vh - 100px)',
      background: '#fff', borderRadius: 18, overflow: 'hidden',
      boxShadow: '0 30px 60px rgba(11,22,34,.25), 0 10px 24px rgba(11,22,34,.12)',
      display: 'flex', flexDirection: 'column',
      animation: 'fadeUp .3s ease both'
    }}>
      <div style={{ background: 'linear-gradient(135deg, var(--blue), #003e74)', color: '#fff', padding: '14px 16px' }}>
        <div className="row between">
          <div className="row gap-10">
            <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(255,255,255,.2)', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 13, fontFamily: 'Montserrat' }}>
              V
            </div>
            <div>
              <div style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 14.5 }}>VIVIO</div>
              <div className="row gap-4" style={{ fontSize: 11, opacity: .85 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#5be584' }}/>
                En línea · Asistente IA
              </div>
            </div>
          </div>
          <div className="row gap-6">
            <button onClick={resetConversation} title="Reiniciar conversación" style={{ background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', width: 28, height: 28, borderRadius: 8, cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
            </button>
            <button onClick={() => setOpen(false)} title="Cerrar" style={{ background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', width: 28, height: 28, borderRadius: 8, cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
              <I.x s={14}/>
            </button>
          </div>
        </div>
      </div>

      <div ref={scrollRef} style={{ flex: 1, padding: '16px', overflowY: 'auto', background: 'var(--bg-2)' }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.from === 'bot' ? 'flex-start' : 'flex-end', marginBottom: 10 }}>
            <div style={{
              maxWidth: '82%', padding: '10px 14px', borderRadius: 14,
              background: m.from === 'bot' ? '#fff' : 'var(--blue)',
              color: m.from === 'bot' ? 'var(--ink-2)' : '#fff',
              fontSize: 13.5, lineHeight: 1.45,
              boxShadow: m.from === 'bot' ? 'var(--shadow-sm)' : 'none',
              borderBottomLeftRadius: m.from === 'bot' ? 4 : 14,
              borderBottomRightRadius: m.from === 'bot' ? 14 : 4,
              whiteSpace: 'pre-line',
            }}>{m.text}</div>
            {m.cta && (
              <a href={m.cta.url} target="_blank" rel="noopener noreferrer" style={{
                marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 8,
                background: '#25D366', color: '#fff', padding: '9px 14px', borderRadius: 999,
                fontSize: 12.5, fontWeight: 700, textDecoration: 'none',
                boxShadow: '0 4px 12px rgba(37,211,102,.25)',
              }}>
                <I.whats s={14}/> {m.cta.label}
              </a>
            )}
          </div>
        ))}
        {typing && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 10 }}>
            <div style={{ background: '#fff', padding: '12px 14px', borderRadius: 14, borderBottomLeftRadius: 4, boxShadow: 'var(--shadow-sm)', display: 'inline-flex', gap: 4 }}>
              {[0,1,2].map(i => (
                <span key={i} style={{
                  width: 6, height: 6, borderRadius: '50%', background: 'var(--ink-4)',
                  animation: `vivioBlink 1.2s ${i * 0.15}s infinite ease-in-out`,
                }}/>
              ))}
            </div>
          </div>
        )}
        {messages.length === 1 && (
          <div className="col gap-6" style={{ marginTop: 8 }}>
            {quickReplies.map(q => (
              <button key={q} onClick={() => handleSend(q)} style={{
                padding: '8px 12px', borderRadius: 999,
                background: '#fff', border: '1px solid var(--blue-100)',
                color: 'var(--blue)', fontSize: 12.5, fontWeight: 600,
                cursor: 'pointer', textAlign: 'left'
              }}>{q}</button>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); handleSend(input); }} style={{ padding: 12, borderTop: '1px solid var(--line-2)', background: '#fff' }}>
        <div className="row gap-8">
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Escribí tu mensaje…" style={{
            flex: 1, padding: '10px 14px', borderRadius: 999,
            border: '1px solid var(--line)', outline: 'none', fontSize: 13.5
          }}/>
          <button type="submit" style={{
            width: 38, height: 38, borderRadius: '50%', border: 'none',
            background: 'var(--blue)', color: '#fff', cursor: 'pointer',
            display: 'grid', placeItems: 'center'
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/></svg>
          </button>
        </div>
        <div className="muted" style={{ fontSize: 10.5, marginTop: 6, textAlign: 'center' }}>
          Potenciado por <strong>Sendpulse</strong> · IA conversacional
        </div>
      </form>
    </div>
  );
}

Object.assign(window, { Header, Footer, Photo, PropertyCard, AdBanner, QRMock, Avatar, Segment, VerificationModal, VivioChatbot, PrettySelect });
