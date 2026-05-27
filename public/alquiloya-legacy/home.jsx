// Home / Landing principal

function HomePage({ onNav, onProperty }) {
  const featured = PROPERTIES.filter(p => p.featured || p.verified).slice(0, 6);
  return (
    <div className="fade-in">
      <Hero onNav={onNav}/>
      <Featured properties={featured} onProperty={onProperty} onNav={onNav}/>
      <Categories onNav={onNav}/>
      <CatalogPreview onProperty={onProperty} onNav={onNav}/>
      <OwnersBlock onNav={onNav}/>
      <Faq/>
    </div>
  );
}

function Hero({ onNav }) {
  return (
    <section style={{ background: 'linear-gradient(180deg, #fff 0%, var(--bg-2) 100%)', position: 'relative', overflow: 'hidden', paddingBottom: 56 }}>
      {/* background house image with very low opacity */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `url(https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=1920&auto=format&fit=crop&q=70)`,
        backgroundSize: 'cover', backgroundPosition: 'center',
        opacity: 0.28,
        pointerEvents: 'none',
      }}/>
      {/* white veil so text stays readable */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(180deg, rgba(255,255,255,.35) 0%, rgba(246,248,251,.65) 80%)',
        pointerEvents: 'none',
      }}/>
      {/* decorative shapes */}
      <div style={{ position: 'absolute', top: -160, right: -120, width: 520, height: 520, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,88,165,.10), transparent 60%)' }} />
      <div style={{ position: 'absolute', bottom: -120, left: -100, width: 360, height: 360, borderRadius: '50%', background: 'radial-gradient(circle, rgba(249,176,0,.12), transparent 60%)' }} />

      <div className="container" style={{ position: 'relative', paddingTop: 64, textAlign: 'center' }}>
        <div className="fade-up" style={{ maxWidth: 880, margin: '0 auto' }}>
          <h1 style={{ fontSize: 68, lineHeight: 1.02 }}>
            Encontrá tu <span style={{ color: 'var(--blue)' }}>alquiler</span><br/>
            más <span className="rapido-emph" style={{ color: 'var(--yellow)', position: 'relative' }}>
              rápido
              <svg width="100%" height="14" viewBox="0 0 200 14" style={{ position: 'absolute', left: 0, bottom: -6, overflow: 'visible' }}>
                <path className="rapido-underline" d="M2 9 Q 60 2 100 6 T 198 5" stroke="#F9B000" strokeWidth="5" fill="none" strokeLinecap="round" pathLength="220"/>
              </svg>
            </span>.
          </h1>
          <p style={{
            marginTop: 22, fontSize: 16, color: 'var(--ink-2)',
            maxWidth: 600, lineHeight: 1.55, margin: '22px auto 0',
            fontWeight: 500,
            textShadow: '0 1px 2px rgba(255,255,255,.9), 0 0 12px rgba(255,255,255,.7)'
          }}>
            Departamentos, casas, salones comerciales y alquileres temporales — organizados, verificados y sin intermediarios.
          </p>
        </div>

        <div className="fade-up" style={{ marginTop: 40, maxWidth: 1040, margin: '40px auto 0' }}>
          <HeroSearch onSubmit={() => onNav('catalog')} />
        </div>

        <div className="row gap-32" style={{ marginTop: 24, color: 'var(--ink-3)', fontSize: 13.5, justifyContent: 'center', flexWrap: 'wrap' }}>
          <div className="row gap-8"><I.check s={14}/> Contacto directo por WhatsApp</div>
          <div className="row gap-8"><I.shield s={14}/> Inmuebles verificados</div>
          <div className="row gap-8"><I.bolt s={14}/> Sin comisión por cierre</div>
        </div>
      </div>
    </section>
  );
}

function TrustStrip() {
  const items = [
    { label: 'Crecimiento mensual',       value: '+18%', sub: 'de inmuebles nuevos', color: 'var(--green)' },
    { label: 'Tiempo medio de alquiler',  value: '11 días', sub: 'desde la publicación', color: 'var(--blue)' },
    { label: 'Inmuebles verificados',     value: '92%',  sub: 'tienen documentación al día', color: 'var(--yellow-600)' },
    { label: 'Satisfacción',              value: '4.8 ★', sub: 'rating promedio de agentes', color: '#6e3ad1' },
  ];
  return (
    <div className="card" style={{ marginTop: 48, padding: '20px 12px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, maxWidth: 920, margin: '48px auto 0' }}>
      {items.map((it, i) => (
        <div key={it.label} style={{ padding: '8px 18px', borderRight: i < items.length - 1 ? '1px solid var(--line-2)' : 'none', textAlign: 'center' }}>
          <div style={{ fontFamily: 'Montserrat', fontWeight: 900, fontSize: 26, color: it.color }}>{it.value}</div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-2)', marginTop: 2 }}>{it.label}</div>
          <div className="muted xs" style={{ marginTop: 2 }}>{it.sub}</div>
        </div>
      ))}
    </div>
  );
}

function HeroSearch({ onSubmit }) {
  const [depto, setDepto] = React.useState('Central');
  const [ciudad, setCiudad] = React.useState('Asunción');
  const [barrio, setBarrio] = React.useState('Todos los barrios');
  const [tipo, setTipo] = React.useState('depto');
  // Flat list of all cities across all departments, for the Hero's "Ciudad" picker
  const ALL_CITIES = React.useMemo(() => {
    const out = [];
    DEPARTAMENTOS.forEach(d => (CIUDADES[d] || []).forEach(c => out.push(c)));
    return Array.from(new Set(out));
  }, []);
  const cityToDepto = (c) => DEPARTAMENTOS.find(d => (CIUDADES[d] || []).includes(c)) || 'Central';
  const PRICE_MIN = 500000, PRICE_MAX = 20000000;
  const AREA_MIN = 20, AREA_MAX = 500;
  const [priceMin, setPriceMin] = React.useState(PRICE_MIN);
  const [priceMax, setPriceMax] = React.useState(PRICE_MAX);
  const [areaMin, setAreaMin] = React.useState(AREA_MIN);
  const [areaMax, setAreaMax] = React.useState(AREA_MAX);
  // Barrios disponibles para la ciudad actual
  const barriosCiudad = React.useMemo(() => {
    const list = BARRIOS_BY_CIUDAD[ciudad] || [];
    return ['Todos los barrios', ...list];
  }, [ciudad]);
  // Auto-resync depto y barrio cuando cambia la ciudad
  React.useEffect(() => {
    setDepto(cityToDepto(ciudad));
    if (!barriosCiudad.includes(barrio)) setBarrio('Todos los barrios');
  }, [ciudad]);
  const submit = () => {
    window.__pendingSearch = { tipo, depto, ciudad, barrio, priceMin, priceMax, areaMin, areaMax };
    onSubmit && onSubmit();
  };
  return (
    <div style={{ position: 'relative' }}>
      {/* Type tabs — attached to top of the search panel */}
      <div className="row gap-4" style={{ justifyContent: 'center' }}>
        {TIPOS.map(t => {
          const active = tipo === t.id;
          return (
            <button key={t.id} onClick={() => setTipo(t.id)} style={{
              padding: '12px 22px 14px', border: 'none',
              background: active ? '#fff' : 'rgba(255,255,255,.55)',
              color: active ? 'var(--blue)' : 'var(--ink-3)',
              fontWeight: 700, fontSize: 13.5, cursor: 'pointer',
              borderRadius: '14px 14px 0 0',
              display: 'inline-flex', alignItems: 'center', gap: 8,
              boxShadow: active ? '0 -4px 12px rgba(11,22,34,.06)' : 'none',
              position: 'relative', top: active ? 0 : 2,
              transition: 'all .15s',
            }}>
              <span style={{ color: active ? 'var(--blue)' : 'var(--ink-4)' }}>{React.createElement(I[t.icon], { s: 16 })}</span>
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="card" style={{
        padding: 0, borderRadius: 18,
        boxShadow: '0 24px 48px rgba(11,22,34,.10), 0 4px 12px rgba(11,22,34,.06)',
        overflow: 'hidden',
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr 1.2fr 1fr auto', alignItems: 'stretch' }}>
          <SearchCell label="Ciudad" value={ciudad} options={ALL_CITIES} onChange={setCiudad} icon="pin" divider/>
          <SearchCell label="Barrio" value={barrio} options={barriosCiudad} onChange={setBarrio} divider/>
          <RangeCell
            label="Rango de precios, Gs."
            min={PRICE_MIN} max={PRICE_MAX}
            valueMin={priceMin} valueMax={priceMax}
            onChange={(a, b) => { setPriceMin(a); setPriceMax(b); }}
            formatter={v => 'Gs. ' + (v >= 1000000 ? (v/1000000).toFixed(v % 1000000 === 0 ? 0 : 1) + 'M' : (v/1000).toFixed(0) + 'K')}
            step={100000}
            divider
          />
          <RangeCell
            label="Área, m²"
            min={AREA_MIN} max={AREA_MAX}
            valueMin={areaMin} valueMax={areaMax}
            onChange={(a, b) => { setAreaMin(a); setAreaMax(b); }}
            formatter={v => v + ' m²'}
            step={5}
            divider
          />
          <button onClick={submit} style={{
            margin: 8, padding: '0 28px',
            background: 'var(--yellow)', border: 'none', borderRadius: 14,
            color: 'var(--ink)', fontWeight: 800, fontSize: 15,
            display: 'inline-flex', alignItems: 'center', gap: 10, cursor: 'pointer',
            transition: 'background .15s, transform .1s',
          }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--yellow-600)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--yellow)'}
            onMouseDown={e => e.currentTarget.style.transform = 'scale(.97)'}
            onMouseUp={e => e.currentTarget.style.transform = ''}
          >
            <I.search s={18}/>
            Buscar
          </button>
        </div>

        <div className="row between" style={{
          padding: '14px 22px', borderTop: '1px solid var(--line-2)',
          background: 'var(--bg-2)',
        }}>
          <div className="row gap-20" style={{ fontSize: 13, color: 'var(--ink-3)' }}>
            <span className="row gap-6">
              <I.shield s={14}/> Solo inmuebles verificados
              <span className="badge badge-soft" style={{ marginLeft: 4, fontSize: 10.5, padding: '2px 7px' }}>184</span>
            </span>
          </div>
          <button onClick={submit} style={{ background: 'none', border: 'none', color: 'var(--blue)', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <I.filter s={13}/> Filtros avanzados
          </button>
        </div>
      </div>
    </div>
  );
}

function RangeCell({ label, min, max, valueMin, valueMax, onChange, formatter, step = 1, divider }) {
  const [open, setOpen] = React.useState(false);
  const [coords, setCoords] = React.useState({ left: 0, top: 0, width: 320 });
  const wrapRef = React.useRef(null);
  const btnRef = React.useRef(null);
  const popRef = React.useRef(null);

  const recomputeCoords = () => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setCoords({ left: r.left, top: r.bottom + 6, width: Math.max(r.width, 340) });
  };

  React.useEffect(() => {
    if (!open) return;
    recomputeCoords();
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

  const isDefault = valueMin === min && valueMax === max;
  const display = isDefault ? 'Seleccione' : `${formatter(valueMin)} – ${formatter(valueMax)}`;

  return (
    <div ref={wrapRef} style={{
      position: 'relative', padding: '14px 20px',
      borderRight: divider ? '1px solid var(--line-2)' : 'none',
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 4 }}>
        {label}
      </div>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          background: 'transparent', border: 'none', outline: 'none', padding: 0,
          fontSize: 15, fontWeight: 700, color: isDefault ? 'var(--ink-3)' : 'var(--ink)',
          cursor: 'pointer', width: '100%', textAlign: 'left',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          fontFamily: 'inherit',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{display}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s', flexShrink: 0 }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && ReactDOM.createPortal(
        <div ref={popRef} style={{
          position: 'fixed', left: coords.left, top: coords.top, width: coords.width,
          background: '#fff', borderRadius: 14, border: '1px solid var(--line)',
          boxShadow: '0 16px 40px rgba(11,22,34,.18), 0 4px 12px rgba(11,22,34,.08)',
          zIndex: 300, padding: 18,
          animation: 'fadeIn .12s ease both',
        }}>
          <DualSlider min={min} max={max} step={step} valueMin={valueMin} valueMax={valueMax} onChange={onChange}/>
          <div className="row between" style={{ marginTop: 14, fontSize: 12.5, color: 'var(--ink-2)', fontWeight: 600 }}>
            <span>{formatter(valueMin)}</span>
            <span>{formatter(valueMax)}</span>
          </div>
          <div className="row gap-10" style={{ marginTop: 14, alignItems: 'center' }}>
            <div className="field" style={{ flex: 1 }}>
              <label style={{ fontSize: 10.5 }}>Mínimo</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, fontWeight: 700, color: 'var(--ink-3)', pointerEvents: 'none' }}>{label.includes('Gs') ? 'Gs.' : ''}</span>
                <input className="input" type="number" min={0} step={step} value={valueMin}
                  onChange={e => {
                    const v = Math.max(0, Number(e.target.value) || 0);
                    onChange(v, Math.max(v, valueMax));
                  }}
                  style={{ padding: label.includes('Gs') ? '10px 12px 10px 38px' : '10px 12px', fontSize: 13 }}/>
                {!label.includes('Gs') && (
                  <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', pointerEvents: 'none' }}>m²</span>
                )}
              </div>
            </div>
            <span style={{ color: 'var(--ink-3)', marginTop: 14 }}>—</span>
            <div className="field" style={{ flex: 1 }}>
              <label style={{ fontSize: 10.5 }}>Máximo</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, fontWeight: 700, color: 'var(--ink-3)', pointerEvents: 'none' }}>{label.includes('Gs') ? 'Gs.' : ''}</span>
                <input className="input" type="number" min={0} step={step} value={valueMax}
                  onChange={e => {
                    const v = Math.max(0, Number(e.target.value) || 0);
                    onChange(Math.min(valueMin, v), v);
                  }}
                  style={{ padding: label.includes('Gs') ? '10px 12px 10px 38px' : '10px 12px', fontSize: 13 }}/>
                {!label.includes('Gs') && (
                  <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', pointerEvents: 'none' }}>m²</span>
                )}
              </div>
            </div>
          </div>
          {label.includes('Gs') && (
            <div className="muted xs" style={{ marginTop: 8, textAlign: 'center' }}>
              Valores en <strong style={{ color: 'var(--ink-2)' }}>guaraníes (Gs.)</strong>
            </div>
          )}
          <div className="row between" style={{ marginTop: 14 }}>
            <button onClick={() => onChange(min, max)} style={{ background: 'none', border: 'none', color: 'var(--ink-3)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
              Limpiar
            </button>
            <button onClick={() => setOpen(false)} className="btn btn-blue btn-sm">Aplicar</button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function DualSlider({ min, max, step, valueMin, valueMax, onChange }) {
  const track = React.useRef(null);
  const [dragging, setDragging] = React.useState(null); // 'min' | 'max' | null
  const clampPct = (v) => Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100));
  const pctMin = clampPct(valueMin);
  const pctMax = clampPct(valueMax);

  const valueFromEvent = (clientX) => {
    if (!track.current) return min;
    const r = track.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    let v = min + pct * (max - min);
    v = Math.round(v / step) * step;
    return Math.max(min, Math.min(max, v));
  };

  React.useEffect(() => {
    if (!dragging) return;
    const onMove = (e) => {
      const v = valueFromEvent(e.touches ? e.touches[0].clientX : e.clientX);
      if (dragging === 'min') onChange(Math.min(v, valueMax - step), valueMax);
      else onChange(valueMin, Math.max(v, valueMin + step));
    };
    const onUp = () => setDragging(null);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('touchmove', onMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchend', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchend', onUp);
    };
  }, [dragging, valueMin, valueMax]);

  return (
    <div style={{ padding: '14px 12px 4px' }}>
      <div ref={track} style={{
        position: 'relative', height: 6, background: 'var(--bg-3)', borderRadius: 999, cursor: 'pointer'
      }}
      onClick={(e) => {
        const v = valueFromEvent(e.clientX);
        const distMin = Math.abs(v - valueMin), distMax = Math.abs(v - valueMax);
        if (distMin < distMax) onChange(Math.min(v, valueMax - step), valueMax);
        else onChange(valueMin, Math.max(v, valueMin + step));
      }}>
        <div style={{
          position: 'absolute', left: pctMin + '%', right: (100 - pctMax) + '%',
          top: 0, bottom: 0, background: 'var(--blue)', borderRadius: 999
        }}/>
        {[{ pct: pctMin, who: 'min' }, { pct: pctMax, who: 'max' }].map(h => (
          <div key={h.who}
            onMouseDown={(e) => { e.stopPropagation(); setDragging(h.who); }}
            onTouchStart={(e) => { e.stopPropagation(); setDragging(h.who); }}
            style={{
              position: 'absolute', left: `calc(${h.pct}% - 11px)`, top: -8,
              width: 22, height: 22, borderRadius: '50%',
              background: '#fff', border: '2px solid var(--blue)',
              boxShadow: '0 2px 6px rgba(11,22,34,.18)',
              cursor: 'grab', touchAction: 'none',
              display: 'grid', placeItems: 'center'
            }}>
            <svg width="6" height="10" viewBox="0 0 6 10" fill="none" stroke="var(--blue)" strokeWidth="1.5">
              <line x1="2" y1="1" x2="2" y2="9"/><line x1="4" y1="1" x2="4" y2="9"/>
            </svg>
          </div>
        ))}
      </div>
    </div>
  );
}

function SearchCell({ label, value, options, onChange, icon, divider }) {
  return (
    <div style={{
      position: 'relative', padding: '14px 20px',
      borderRight: divider ? '1px solid var(--line-2)' : 'none',
      display: 'block',
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 4 }}>
        {label}
      </div>
      <PrettySelect
        variant="inline"
        value={value}
        onChange={onChange}
        options={options}
      />
    </div>
  );
}

function HeroCollage({ onNav }) {
  const props = PROPERTIES.slice(0, 3);
  return (
    <div style={{ position: 'relative', height: 520 }}>
      {/* big main card */}
      <div className="card fade-up" style={{
        position: 'absolute', top: 0, right: 0, width: 360, padding: 0, overflow: 'hidden',
        boxShadow: 'var(--shadow-lg)', borderRadius: 18, animationDelay: '.05s'
      }}>
        <Photo src={photo(0)} style={{ height: 250, borderRadius: 0 }} />
        <div style={{ padding: 16 }}>
          <div className="row gap-8">
            <span className="badge badge-verified"><I.check s={11}/> Verificado</span>
          </div>
          <div style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 20, color: 'var(--blue)', marginTop: 10 }}>Gs. 3.800.000<span style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 500 }}> / mes</span></div>
          <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>Dúplex moderno en Villa Morra</div>
          <div className="row gap-12 muted" style={{ marginTop: 10, fontSize: 13 }}>
            <span className="row gap-4"><I.bed s={13}/> 2</span>
            <span className="row gap-4"><I.bath s={13}/> 2</span>
            <span className="row gap-4"><I.ruler s={13}/> 85 m²</span>
          </div>
        </div>
      </div>
      {/* floating mini card */}
      <div className="card fade-up" style={{
        position: 'absolute', bottom: 70, left: 0, width: 220, padding: 12,
        boxShadow: 'var(--shadow-lg)', borderRadius: 14, animationDelay: '.15s'
      }}>
        <Photo src={photo(7)} style={{ height: 110, borderRadius: 8 }}/>
        <div className="row gap-8" style={{ marginTop: 8 }}>
          <span className="badge badge-temporal" style={{ fontSize: 10 }}>Temporal</span>
        </div>
        <div style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 15, color: 'var(--blue)', marginTop: 6 }}>Gs. 420.000<span style={{ fontSize: 10, color: 'var(--ink-3)', fontWeight: 500 }}> / noche</span></div>
        <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Carmelitas · Asunción</div>
      </div>
      {/* search count badge */}
      <div className="card fade-up" style={{
        position: 'absolute', top: 60, left: 30, padding: '14px 18px',
        boxShadow: 'var(--shadow-lg)', borderRadius: 999, animationDelay: '.25s',
        display: 'flex', alignItems: 'center', gap: 12
      }}>
        <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--yellow-50)', display: 'grid', placeItems: 'center', color: 'var(--yellow-600)' }}>
          <I.bolt s={18}/>
        </div>
        <div>
          <div style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 18 }}>+2.480</div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>inmuebles activos</div>
        </div>
      </div>
      {/* mini map preview */}
      <div className="card fade-up" style={{
        position: 'absolute', bottom: 0, right: 20, width: 260, padding: 0, overflow: 'hidden',
        boxShadow: 'var(--shadow-lg)', borderRadius: 14, animationDelay: '.35s'
      }}>
        <MiniMap height={120}/>
        <div style={{ padding: 12 }}>
          <div className="row gap-8"><I.pin s={14} /> <span style={{ fontWeight: 600, fontSize: 13 }}>12 inmuebles en esta zona</span></div>
        </div>
      </div>
    </div>
  );
}

function MiniMap({ height = 200, pins = 8 }) {
  // Mapa estilizado tipo "modern map tile": tierra cálida, parques orgánicos,
  // un río que cruza, avenidas blancas con jerarquía, bloques sutiles y pines
  // con sombra. Determinista — mismos pines en cada render.
  const pinSeeds = React.useMemo(() => {
    const arr = [];
    for (let i = 0; i < pins; i++) {
      arr.push({
        x: 50 + ((i * 73) % 320),
        y: 40 + ((i * 53) % 160),
        active: i === 0 || i === 3,
      });
    }
    return arr;
  }, [pins]);
  return (
    <div style={{ position: 'relative', height, width: '100%', overflow: 'hidden', background: '#F1ECE2' }}>
      <svg viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}>
        <defs>
          <filter id="pinShadow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="1.2"/>
            <feOffset dx="0" dy="1.2" result="off"/>
            <feComponentTransfer><feFuncA type="linear" slope="0.45"/></feComponentTransfer>
            <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="0.7"/>
            <feOffset dx="0" dy="0.6" result="off"/>
            <feComponentTransfer><feFuncA type="linear" slope="0.2"/></feComponentTransfer>
            <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {/* Tierra base con leve textura */}
        <rect width="400" height="240" fill="#F1ECE2"/>

        {/* Bloques (manzanas) — sutilmente más oscuros para crear jerarquía */}
        <g fill="#EAE3D2">
          <rect x="0" y="0" width="92" height="58" rx="2"/>
          <rect x="110" y="0" width="78" height="58" rx="2"/>
          <rect x="206" y="0" width="92" height="58" rx="2"/>
          <rect x="316" y="0" width="84" height="58" rx="2"/>

          <rect x="0" y="76" width="92" height="76" rx="2"/>
          <rect x="110" y="76" width="78" height="76" rx="2"/>
          <rect x="316" y="76" width="84" height="76" rx="2"/>

          <rect x="0" y="170" width="92" height="70" rx="2"/>
          <rect x="110" y="170" width="78" height="70" rx="2"/>
          <rect x="206" y="170" width="92" height="70" rx="2"/>
          <rect x="316" y="170" width="84" height="70" rx="2"/>
        </g>

        {/* Parque grande con forma orgánica */}
        <g filter="url(#softShadow)">
          <path d="M210 78 Q 220 70 240 72 T 290 84 Q 300 100 296 120 T 270 150 Q 250 156 230 148 T 210 120 Z" fill="#CDE2B6"/>
          {/* Caminos dentro del parque */}
          <path d="M218 100 Q 250 115 290 110" stroke="#B4CFA0" strokeWidth="1.3" fill="none"/>
          <path d="M240 78 Q 248 110 260 150" stroke="#B4CFA0" strokeWidth="1.3" fill="none"/>
        </g>

        {/* Río / canal cruzando en diagonal */}
        <path d="M -10 192 Q 80 175 160 195 T 410 220" stroke="#C2DDE8" strokeWidth="14" fill="none" strokeLinecap="round"/>
        <path d="M -10 192 Q 80 175 160 195 T 410 220" stroke="#B0CFE0" strokeWidth="0.6" fill="none" strokeLinecap="round" strokeDasharray="2 4" opacity="0.7"/>

        {/* Avenidas principales (más anchas, con borde sutil) */}
        <g>
          {/* Casing (borde) */}
          <path d="M0 64 L400 68" stroke="#D9CFB8" strokeWidth="11"/>
          <path d="M0 158 L400 162" stroke="#D9CFB8" strokeWidth="11"/>
          <path d="M98 0 L94 240" stroke="#D9CFB8" strokeWidth="11"/>
          <path d="M298 0 L302 240" stroke="#D9CFB8" strokeWidth="11"/>
          {/* Fill blanco */}
          <path d="M0 64 L400 68" stroke="#FFFFFF" strokeWidth="9"/>
          <path d="M0 158 L400 162" stroke="#FFFFFF" strokeWidth="9"/>
          <path d="M98 0 L94 240" stroke="#FFFFFF" strokeWidth="9"/>
          <path d="M298 0 L302 240" stroke="#FFFFFF" strokeWidth="9"/>
        </g>

        {/* Calles secundarias */}
        <g stroke="#FFFFFF" strokeWidth="4">
          <path d="M196 0 L196 240"/>
          <path d="M0 110 L400 110"/>
        </g>
        {/* Calles terciarias / pasajes */}
        <g stroke="#FFFFFF" strokeWidth="2" opacity="0.8">
          <path d="M48 0 L48 240"/>
          <path d="M150 0 L150 240"/>
          <path d="M250 0 L250 240"/>
          <path d="M352 0 L352 240"/>
          <path d="M0 32 L400 32"/>
          <path d="M0 200 L400 200"/>
        </g>

        {/* Edificios destacados — puntos para dar textura */}
        <g fill="#DCD2BC" opacity="0.55">
          <rect x="14" y="84" width="10" height="14"/>
          <rect x="30" y="84" width="10" height="20"/>
          <rect x="46" y="84" width="14" height="10"/>
          <rect x="120" y="180" width="12" height="16"/>
          <rect x="140" y="180" width="14" height="12"/>
          <rect x="330" y="178" width="12" height="20"/>
          <rect x="350" y="178" width="16" height="14"/>
        </g>

        {/* Pines de inmuebles */}
        {pinSeeds.map((p, i) => (
          <g key={i} transform={`translate(${p.x}, ${p.y})`} filter="url(#pinShadow)">
            {/* "drop pin" pequeño */}
            <path d={`M0 0
              a 9 9 0 1 1 0.01 0
              M 0 9
              Q -2.5 16 0 22
              Q 2.5 16 0 9`}
              fill={p.active ? '#F9B000' : '#0058A5'}/>
            <circle cx="0" cy="-1" r="6" fill="#FFFFFF"/>
            <text textAnchor="middle" y="1.5" fontSize="6.5" fontWeight="800" fontFamily="Montserrat, sans-serif"
              fill={p.active ? '#A57000' : '#0058A5'}>
              {i + 1}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function Categories({ onNav }) {
  const countByTipo = (id) => PROPERTIES.filter(p => p.tipo === id).length;
  const cats = [
    { id: 'depto',    label: 'Departamentos',         count: countByTipo('depto'),    img: 'uploads/departamento.png' },
    { id: 'casa',     label: 'Casas independientes',  count: countByTipo('casa'),     img: 'uploads/casas.png' },
    { id: 'salon',    label: 'Salones comerciales',   count: countByTipo('salon'),    img: 'uploads/comercio.png' },
    { id: 'temporal', label: 'Alquileres temporales', count: countByTipo('temporal'), img: 'uploads/alquiler.png' },
  ];
  return (
    <section className="container" style={{ marginTop: 24, padding: '40px 32px' }}>
      <SectionHead eyebrow="Categorías" title="Explorá por tipo de inmueble" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginTop: 28 }}>
        {cats.map(c => (
          <button key={c.id} onClick={() => onNav('catalog')}
            style={{
              textAlign: 'left', padding: 24, cursor: 'pointer',
              background: '#fff',
              border: '1px solid var(--line)',
              borderRadius: 18,
              position: 'relative', overflow: 'hidden',
              transition: 'transform .2s ease, box-shadow .2s ease, border-color .2s ease',
              fontFamily: 'inherit',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-5px)';
              e.currentTarget.style.boxShadow = '0 18px 40px rgba(0,88,165,.14)';
              e.currentTarget.style.borderColor = 'var(--blue-100)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = '';
              e.currentTarget.style.boxShadow = '';
              e.currentTarget.style.borderColor = 'var(--line)';
            }}>
            {/* Accent bar at top */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 4,
              background: 'linear-gradient(90deg, var(--blue) 0%, var(--yellow) 100%)',
            }}/>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <img src={c.img} alt={c.label} style={{ width: 84, height: 84, objectFit: 'contain' }}/>
              <span style={{
                fontFamily: 'Montserrat', fontWeight: 900, fontSize: 24, color: 'var(--blue)',
                opacity: .92
              }}>{c.count}</span>
            </div>
            <div style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 17, marginTop: 18, lineHeight: 1.25 }}>{c.label}</div>
            <div className="row between" style={{ marginTop: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>inmuebles disponibles</span>
              <span style={{ color: 'var(--blue)', display: 'inline-flex', alignItems: 'center' }}>
                <I.arrow s={16}/>
              </span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function CategoryIllustration({ kind }) {
  const BLUE = '#0058A5', LIGHT = '#7AB1E6', YELLOW = '#F9B000', INK = '#0b1622';
  const S = 52;
  if (kind === 'apartment') {
    return (
      <svg width={S} height={S} viewBox="0 0 64 64" fill="none">
        <rect x="10" y="14" width="44" height="42" rx="3" fill={BLUE}/>
        <rect x="10" y="14" width="44" height="6" fill={INK}/>
        {/* windows */}
        {[0,1,2,3].map(row => (
          <g key={row}>
            <rect x={16}     y={24 + row*7} width="8" height="4" rx="1" fill={LIGHT}/>
            <rect x={28}     y={24 + row*7} width="8" height="4" rx="1" fill={LIGHT}/>
            <rect x={40}     y={24 + row*7} width="8" height="4" rx="1" fill={LIGHT}/>
          </g>
        ))}
        {/* door */}
        <rect x="28" y="48" width="8" height="8" rx="1" fill={YELLOW}/>
      </svg>
    );
  }
  if (kind === 'house') {
    return (
      <svg width={S} height={S} viewBox="0 0 64 64" fill="none">
        {/* roof */}
        <path d="M6 30 L32 10 L58 30 Z" fill={BLUE}/>
        {/* body */}
        <rect x="14" y="28" width="36" height="28" rx="2" fill="#fff" stroke={BLUE} strokeWidth="2.5"/>
        {/* chimney */}
        <rect x="44" y="14" width="6" height="10" fill={INK}/>
        {/* door */}
        <rect x="28" y="40" width="8" height="16" rx="1.5" fill={YELLOW}/>
        {/* windows */}
        <rect x="18" y="34" width="8" height="8" rx="1" fill={LIGHT} stroke={BLUE} strokeWidth="1.5"/>
        <rect x="38" y="34" width="8" height="8" rx="1" fill={LIGHT} stroke={BLUE} strokeWidth="1.5"/>
        <path d="M22 34 v8 M18 38 h8" stroke={BLUE} strokeWidth="1.2"/>
        <path d="M42 34 v8 M38 38 h8" stroke={BLUE} strokeWidth="1.2"/>
      </svg>
    );
  }
  if (kind === 'shop') {
    return (
      <svg width={S} height={S} viewBox="0 0 64 64" fill="none">
        {/* awning */}
        <path d="M8 22 L12 14 L52 14 L56 22 Z" fill={YELLOW}/>
        <path d="M14 22 L16 16 M22 22 L23 16 M30 22 L31 16 M38 22 L39 16 M46 22 L48 16" stroke={INK} strokeWidth="1.2" opacity=".25"/>
        {/* body */}
        <rect x="10" y="22" width="44" height="34" rx="2" fill={BLUE}/>
        {/* storefront window */}
        <rect x="16" y="28" width="32" height="16" rx="1.5" fill="#fff"/>
        <path d="M32 28 v16" stroke={BLUE} strokeWidth="1.5"/>
        {/* door */}
        <rect x="26" y="46" width="12" height="10" rx="1" fill={INK}/>
        <circle cx="35" cy="51" r="0.9" fill={YELLOW}/>
      </svg>
    );
  }
  // temporal — house with calendar / clock
  return (
    <svg width={S} height={S} viewBox="0 0 64 64" fill="none">
      {/* roof */}
      <path d="M10 30 L32 12 L54 30 Z" fill={BLUE}/>
      {/* body */}
      <rect x="16" y="28" width="32" height="28" rx="2" fill="#fff" stroke={BLUE} strokeWidth="2.5"/>
      {/* door */}
      <rect x="22" y="40" width="8" height="16" rx="1" fill={LIGHT} stroke={BLUE} strokeWidth="1.5"/>
      {/* calendar badge */}
      <g transform="translate(36 34)">
        <rect x="0" y="2" width="16" height="16" rx="2" fill={YELLOW}/>
        <rect x="0" y="2" width="16" height="5" fill={INK}/>
        <rect x="3" y="0" width="2" height="4" rx=".5" fill={INK}/>
        <rect x="11" y="0" width="2" height="4" rx=".5" fill={INK}/>
        <rect x="3" y="10" width="3" height="2.5" rx=".5" fill={INK}/>
        <rect x="8" y="10" width="3" height="2.5" rx=".5" fill={INK}/>
        <rect x="3" y="14" width="3" height="2.5" rx=".5" fill={INK}/>
      </g>
    </svg>
  );
}

function SectionHead({ eyebrow, title, action, actionLabel }) {
  return (
    <div className="row between" style={{ alignItems: 'flex-end' }}>
      <div>
        {eyebrow && <div className="tag">{eyebrow}</div>}
        <h2 style={{ marginTop: 6 }}>{title}</h2>
      </div>
      {action && (
        <button onClick={action} className="btn btn-outline">{actionLabel} <I.arrow s={15}/></button>
      )}
    </div>
  );
}

function CatalogPreview({ onProperty, onNav }) {
  // Tomamos 8 propiedades distintas de las destacadas — un mix variado
  const list = React.useMemo(() => {
    const sorted = [...PROPERTIES].sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0));
    return sorted.slice(0, 8);
  }, []);
  return (
    <section className="container" style={{ padding: '32px 32px 8px' }}>
      <SectionHead
        eyebrow="Alquileres recientes"
        title="Las últimas propiedades publicadas"
        action={() => onNav('catalog')}
        actionLabel="Ver catálogo"
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18, marginTop: 24 }}>
        {list.map((p, i) => (
          <div key={p.id} style={{ animationDelay: `${i * 60}ms` }}>
            <PropertyCard p={p} onClick={() => onProperty(p)} compact />
          </div>
        ))}
      </div>
      <div style={{ textAlign: 'center', marginTop: 28 }}>
        <button onClick={() => onNav('catalog')} className="btn btn-outline" style={{ padding: '10px 22px', fontWeight: 700 }}>
          Ver todo el catálogo <I.arrow s={14}/>
        </button>
      </div>
    </section>
  );
}

function Featured({ properties, onProperty, onNav }) {
  const ref = React.useRef(null);
  const [visible, setVisible] = React.useState(false);
  React.useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } });
    }, { threshold: 0.15 });
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return (
    <section ref={ref} className="container" style={{ padding: '40px 32px' }}>
      <SectionHead eyebrow="Propiedades destacadas" title="Inmuebles verificados, listos para visitar" action={() => onNav('catalog')} actionLabel="Ver todos" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 22, marginTop: 28 }}>
        {properties.map((p, i) => (
          <div key={p.id} className={visible ? 'featured-reveal' : ''} style={{
            opacity: visible ? undefined : 0,
            animationDelay: `${i * 90}ms`,
          }}>
            <PropertyCard p={p} onClick={() => onProperty(p)} />
          </div>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { n: '01', title: 'Buscá por zona',     desc: 'Filtrá por departamento, ciudad, barrio y tipo de inmueble.', icon: 'search', tint: 'var(--blue)' },
    { n: '02', title: 'Compará inmuebles',  desc: 'Fotos, precio, características y badges de confianza.',        icon: 'grid',   tint: 'var(--yellow-600)' },
    { n: '03', title: 'Contactá o reservá', desc: 'Hablá directamente con el propietario o agente por WhatsApp.', icon: 'whats',  tint: 'var(--green)' },
  ];
  return (
    <section style={{ background: '#fff', padding: '48px 0', marginTop: 24 }}>
      <div className="container">
        <div style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto' }}>
          <div className="tag" style={{ fontSize: 11 }}>Cómo funciona</div>
          <h2 style={{ fontSize: 26, marginTop: 6, lineHeight: 1.2 }}>En 3 pasos, ya estás visitando tu próximo alquiler</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 32, position: 'relative' }}>
          {/* Connector line behind cards */}
          <div style={{
            position: 'absolute', top: 30, left: '16%', right: '16%', height: 2,
            background: 'linear-gradient(90deg, var(--blue-100), var(--yellow-50), #dff2e7)',
            zIndex: 0
          }}/>
          {steps.map((s) => (
            <div key={s.n} style={{
              padding: '22px 20px', position: 'relative', zIndex: 1,
              background: '#fff', borderRadius: 14,
              border: '1px solid var(--line-2)',
              textAlign: 'center'
            }}>
              <div style={{
                width: 60, height: 60, borderRadius: '50%',
                background: '#fff', border: '2px solid ' + s.tint,
                color: s.tint, display: 'grid', placeItems: 'center',
                margin: '0 auto', position: 'relative'
              }}>
                {React.createElement(I[s.icon], { s: 22 })}
                <span style={{
                  position: 'absolute', top: -8, right: -8,
                  background: s.tint, color: '#fff',
                  width: 24, height: 24, borderRadius: '50%',
                  fontFamily: 'Montserrat', fontWeight: 800, fontSize: 11,
                  display: 'grid', placeItems: 'center',
                }}>{s.n}</span>
              </div>
              <div style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 15, marginTop: 14 }}>{s.title}</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 6, lineHeight: 1.5 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function OwnersBlock({ onNav }) {
  return (
    <section className="container" style={{ padding: '64px 32px' }}>
      <div style={{
        background: 'linear-gradient(120deg, var(--blue) 0%, #003e74 100%)',
        borderRadius: 24, padding: '56px 64px', color: '#fff', position: 'relative', overflow: 'hidden'
      }}>
        {/* Property photo on the right half with white overlay */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
          backgroundImage: 'url(https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1600&auto=format&fit=crop&q=70)',
          backgroundSize: 'cover',
          backgroundPosition: 'center right',
          maskImage: 'linear-gradient(90deg, transparent 0%, transparent 35%, #000 60%, #000 100%)',
          WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, transparent 35%, #000 60%, #000 100%)',
        }}/>
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
          background: 'rgba(255,255,255,.22)',
          maskImage: 'linear-gradient(90deg, transparent 0%, transparent 35%, #000 60%, #000 100%)',
          WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, transparent 35%, #000 60%, #000 100%)',
        }}/>
        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 48, alignItems: 'center', position: 'relative', zIndex: 1 }}>
          <div>
            <div className="tag" style={{ color: 'var(--yellow)' }}>Propietarios & agentes</div>
            <h2 style={{ color: '#fff', marginTop: 10, maxWidth: 540 }}>Publicá tu inmueble y llegá a personas que ya están buscando.</h2>
            <p style={{ color: '#cfe0f4', marginTop: 16, maxWidth: 520, fontSize: 16 }}>
              Cargá tu propiedad en minutos, recibí consultas por WhatsApp y aparecé entre los destacados. Sin comisiones por cierre.
            </p>
            <div className="row gap-12" style={{ marginTop: 28 }}>
              <button className="btn btn-primary btn-lg" onClick={() => onNav('plans')}>Conocer planes <I.arrow s={16}/></button>
              <button className="btn btn-ghost btn-lg" onClick={() => onNav('publish')} style={{ color: '#fff', border: '1px solid rgba(255,255,255,.3)' }}>Publicar gratis</button>
            </div>
            <div className="row gap-32" style={{ marginTop: 32 }}>
              {[
                ['+15.000','propietarios activos'],
                ['+2.400','consultas por día'],
                ['72 hs','tiempo medio para alquilar'],
              ].map(([k,v]) => (
                <div key={k}>
                  <div style={{ fontFamily: 'Montserrat', fontWeight: 900, fontSize: 28, color: 'var(--yellow)' }}>{k}</div>
                  <div style={{ fontSize: 13, color: '#cfe0f4' }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ position: 'relative' }}>
            <div className="card" style={{ padding: 18, color: 'var(--ink)', boxShadow: 'var(--shadow-lg)' }}>
              <div className="row gap-12">
                <Avatar name="Mariana López" size={42} color="#0058A5"/>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>Mariana López</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Propietaria · Asunción</div>
                </div>
                <span className="badge badge-verified" style={{ marginLeft: 'auto' }}><I.check s={10}/> Verificada</span>
              </div>
              <div style={{ fontSize: 14, color: 'var(--ink-2)', marginTop: 14, fontStyle: 'italic', lineHeight: 1.5 }}>
                "Publiqué mi departamento un martes y el viernes ya tenía visitas confirmadas. Lo recomiendo 100%."
              </div>
              <div className="row gap-4" style={{ marginTop: 12, color: 'var(--yellow)' }}>
                {[1,2,3,4,5].map(i => <I.star key={i} s={14}/>)}
              </div>
            </div>
            <div style={{ position: 'absolute', right: -16, bottom: -16, background: 'var(--yellow)', color: 'var(--ink)', padding: '10px 16px', borderRadius: 12, fontFamily: 'Montserrat', fontWeight: 800, fontSize: 13, boxShadow: 'var(--shadow)' }}>
              <I.bolt s={14}/> Alquilado en 4 días
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function QRBlock({ onNav }) {
  return (
    <section className="container" style={{ padding: '64px 32px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 56, alignItems: 'center' }}>
        <div>
          <div className="tag">Cartel dinámico</div>
          <h2 style={{ marginTop: 10 }}>Un QR, toda la información del inmueble.</h2>
          <p style={{ marginTop: 16, fontSize: 16, color: 'var(--ink-3)', maxWidth: 520 }}>
            Cada propiedad publicada en AlquiloYa tiene un código QR único. Imprimí tu cartel "SE ALQUILA" y los interesados acceden al instante a fotos, precio y contacto.
          </p>
          <div className="col gap-12" style={{ marginTop: 24 }}>
            {[
              ['Un QR único por inmueble', 'Se genera automáticamente al publicar la propiedad. Sin pasos extra.'],
              ['Descargá listo para imprimir', 'PDF A4 con colores oficiales, logo, ID y diseño de cartel.'],
              ['Mediciones en tiempo real', 'Sabé cuántas personas escanearon el cartel de cada inmueble.'],
            ].map(([t,d]) => (
              <div key={t} className="row gap-12" style={{ alignItems: 'flex-start' }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--blue-50)', color: 'var(--blue)', display: 'grid', placeItems: 'center', flexShrink: 0, marginTop: 1 }}>
                  <I.check s={14}/>
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{t}</div>
                  <div style={{ fontSize: 13.5, color: 'var(--ink-3)' }}>{d}</div>
                </div>
              </div>
            ))}
          </div>
          <button className="btn btn-blue btn-lg" style={{ marginTop: 28 }} onClick={() => onNav('publish')}>
            Publicá tu inmueble <I.arrow s={16}/>
          </button>
        </div>
        <div style={{ position: 'relative', display: 'grid', placeItems: 'center', minHeight: 540 }}>
          {/* poster mock */}
          <QRPosterMock id="AY-Q2058" address="Villa Morra, Asunción"/>
        </div>
      </div>
    </section>
  );
}

function QRPosterMock({ id, address }) {
  return (
    <div style={{
      width: 320, background: '#fff', borderRadius: 16, padding: 0, overflow: 'hidden',
      boxShadow: '0 30px 80px rgba(0,88,165,.25), 0 0 0 1px rgba(11,22,34,.06)',
      transform: 'rotate(-3deg)'
    }}>
      <div style={{ background: 'var(--blue)', color: '#fff', padding: '20px 22px' }}>
        <Logo size={22} dark/>
      </div>
      <div style={{ background: 'var(--yellow)', padding: '18px 22px', textAlign: 'center' }}>
        <div style={{ fontFamily: 'Montserrat', fontWeight: 900, fontStyle: 'italic', fontSize: 36, letterSpacing: '-0.02em', color: 'var(--ink)', lineHeight: 1 }}>
          SE ALQUILA
        </div>
      </div>
      <div style={{ padding: 24, textAlign: 'center' }}>
        <div style={{ padding: 10, border: '2px solid var(--ink)', borderRadius: 8, display: 'inline-block' }}>
          <QRMock size={160} id={id} />
        </div>
        <div style={{ marginTop: 14, fontFamily: 'JetBrains Mono', fontSize: 12, color: 'var(--ink-3)' }}>{id}</div>
        <div style={{ marginTop: 6, fontSize: 14, fontWeight: 600, color: 'var(--ink-2)' }}>{address}</div>
        <div style={{ marginTop: 12, padding: 10, background: 'var(--bg-2)', borderRadius: 8, fontSize: 12, color: 'var(--ink-3)' }}>
          Escaneá y mirá fotos, precio y detalles.
        </div>
      </div>
      <div style={{ background: 'var(--blue)', color: '#fff', padding: '10px 22px', fontSize: 11, fontFamily: 'Montserrat', fontWeight: 700, fontStyle: 'italic', textAlign: 'center', letterSpacing: '.04em' }}>
        ALQUILOYA.COM.PY · ¡DONDE ENCONTRÁS MÁS RÁPIDO!
      </div>
    </div>
  );
}

function _AdsBlock_REMOVED() {
  return (
    <section className="container" style={{ padding: '40px 32px' }}>
      <SectionHead eyebrow="Espacios publicitarios" title="Empresas afines que acompañan tu mudanza" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18, marginTop: 28 }}>
        {ADS.map(a => <AdBanner key={a.brand} ad={a} variant="card"/>)}
      </div>
    </section>
  );
}

function Faq() {
  const faqs = [
    ['¿Es gratis publicar mi inmueble?', 'Sí. Tenés un plan gratuito que te permite publicar 1 propiedad por 30 días, con hasta 5 fotos y contacto directo por WhatsApp.'],
    ['¿Cómo se verifica una propiedad?', 'Nuestro equipo revisa documentación de propietario, ubicación real y fotos. Las verificadas obtienen el badge azul y mayor visibilidad.'],
    ['¿Puedo pagar el alquiler desde la plataforma?', 'Próximamente. Por ahora, el contacto y la coordinación se hacen directamente entre las partes. La reserva visual está disponible para temporales.'],
    ['¿Qué pasa con los carteles QR?', 'Al cargar tu inmueble se genera automáticamente un QR único. Desde la sección "Carteles QR" descargás el cartel listo para imprimir, y cuando alguien lo escanea accede a la ficha completa con fotos, precio y contacto.'],
    ['¿Hay comisión por cerrar un alquiler?', 'No. AlquiloYa cobra solo por los planes premium. No tomamos comisión por contratos.'],
  ];
  const [open, setOpen] = React.useState(0);
  return (
    <section className="container" style={{ padding: '40px 32px' }}>
      <div style={{ textAlign: 'center', maxWidth: 720, margin: '0 auto' }}>
        <div className="tag">Preguntas frecuentes</div>
        <h2 style={{ marginTop: 6 }}>Lo que más nos preguntan</h2>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, marginTop: 32, maxWidth: 880, marginLeft: 'auto', marginRight: 'auto' }}>
        {faqs.map(([q,a], i) => (
          <div key={q} className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <button onClick={() => setOpen(open === i ? -1 : i)} style={{
              width: '100%', background: 'none', border: 'none', padding: '20px 22px', textAlign: 'left', cursor: 'pointer',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16
            }}>
              <span style={{ fontFamily: 'Montserrat', fontWeight: 700, fontSize: 16 }}>{q}</span>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: open === i ? 'var(--blue)' : 'var(--bg-2)', color: open === i ? '#fff' : 'var(--ink-3)', display: 'grid', placeItems: 'center', transition: 'all .2s' }}>
                {open === i ? <I.x s={14}/> : <I.plus s={14}/>}
              </div>
            </button>
            {open === i && <div style={{ padding: '0 22px 22px', color: 'var(--ink-3)', fontSize: 14.5, lineHeight: 1.6 }}>{a}</div>}
          </div>
        ))}
      </div>
    </section>
  );
}

Object.assign(window, { HomePage, QRPosterMock, MiniMap, SectionHead });
