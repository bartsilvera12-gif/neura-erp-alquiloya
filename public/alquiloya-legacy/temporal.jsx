// Alquiler temporal / Reserva visual

function TemporalPage({ onProperty }) {
  const property = PROPERTIES.find(p => p.tipo === 'temporal');
  const [checkin, setCheckin] = React.useState(8);
  const [checkout, setCheckout] = React.useState(13);
  const nights = Math.max(1, checkout - checkin);
  const nightly = property.price;
  const cleaning = 120000;
  const serviceFee = 80000;
  const total = nightly * nights + cleaning + serviceFee;
  return (
    <div className="fade-in container" style={{ padding: '32px' }}>
      <div className="row gap-8 muted" style={{ fontSize: 13, marginBottom: 12 }}>
        <span>Inicio</span><I.chev s={12}/><span>Alquileres temporales</span><I.chev s={12}/>
        <span style={{ color: 'var(--ink)' }}>{property.title}</span>
      </div>
      <h2>Reservá tu estadía temporal</h2>
      <p className="muted" style={{ marginTop: 6, fontSize: 14 }}>
        Calendario visual de disponibilidad — el pago se procesará en una próxima versión.
      </p>

      <div style={{ marginTop: 28, display: 'grid', gridTemplateColumns: '1fr 380px', gap: 28, alignItems: 'flex-start' }}>
        <div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 8, height: 320 }}>
              <Photo src={property.photos[0]} style={{ borderRadius: 0 }}/>
              <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr', gap: 8 }}>
                <Photo src={property.photos[1]} style={{ borderRadius: 0 }}/>
                <Photo src={property.photos[2]} style={{ borderRadius: 0 }}/>
              </div>
            </div>
            <div style={{ padding: 22 }}>
              <div className="row gap-8">
                <span className="badge badge-temporal">Temporal</span>
                <span className="badge badge-verified"><I.check s={11}/> Verificado</span>
              </div>
              <h3 style={{ fontSize: 22, marginTop: 8 }}>{property.title}</h3>
              <div className="muted" style={{ marginTop: 4, fontSize: 14 }}>
                <I.pin s={14}/> {property.address}
              </div>
              <div className="row gap-16 muted" style={{ marginTop: 14, fontSize: 13 }}>
                <span><I.bed s={14}/> {property.beds} dorm</span>
                <span><I.bath s={14}/> {property.baths} baños</span>
                <span><I.ruler s={14}/> {property.m2} m²</span>
                <span><I.sofa s={14}/> Amoblado</span>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 24, marginTop: 16 }}>
            <h3 style={{ fontSize: 18 }}>Disponibilidad</h3>
            <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>Elegí entrada y salida en el calendario.</p>
            <div className="row gap-12" style={{ marginTop: 18 }}>
              <CalendarMonth month="Junio 2026" daysInMonth={30} startDay={1}
                checkin={checkin} checkout={checkout} setCheckin={setCheckin} setCheckout={setCheckout}
                unavailable={[2,3,4,18,19,20,21,27,28]}
              />
              <CalendarMonth month="Julio 2026" offset={30} daysInMonth={31} startDay={3}
                checkin={checkin} checkout={checkout} setCheckin={setCheckin} setCheckout={setCheckout}
                unavailable={[31+5,31+6,31+15,31+22,31+23,31+24]}
              />
            </div>
            <div className="row gap-16" style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--line-2)' }}>
              <LegendDot color="var(--blue)" label="Tu selección"/>
              <LegendDot color="#fff" border="var(--line)" label="Disponible"/>
              <LegendDot color="var(--bg-3)" label="No disponible"/>
            </div>
          </div>

          <div className="card" style={{ padding: 24, marginTop: 16, background: '#fff7e3', borderColor: 'rgba(249,176,0,.3)' }}>
            <div className="row gap-12" style={{ alignItems: 'flex-start' }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--yellow)', color: 'var(--ink)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <I.bolt s={16}/>
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Pago y reserva — próximamente</div>
                <div style={{ fontSize: 13.5, color: '#8a5e00', marginTop: 4 }}>
                  Esta vista muestra el flujo visual. Por ahora, al solicitar reserva coordinás directamente con el propietario por WhatsApp.
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ position: 'sticky', top: 92 }}>
          <div className="card" style={{ padding: 22 }}>
            <div className="row between">
              <div>
                <div style={{ fontFamily: 'Montserrat', fontWeight: 900, fontSize: 26, color: 'var(--blue)' }}>{formatGs(nightly)}</div>
                <div className="muted xs">por noche</div>
              </div>
              <div className="row gap-4" style={{ color: 'var(--yellow)' }}>
                {[1,2,3,4,5].map(i => <I.star key={i} s={12}/>)}
                <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>4.9</span>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', border: '1px solid var(--line)', borderRadius: 12, marginTop: 16, overflow: 'hidden' }}>
              <div style={{ padding: 12, borderRight: '1px solid var(--line)' }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ink-3)', letterSpacing: '.08em' }}>ENTRADA</div>
                <div style={{ fontFamily: 'Montserrat', fontWeight: 700, fontSize: 15 }}>{checkin} Jun 2026</div>
              </div>
              <div style={{ padding: 12 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ink-3)', letterSpacing: '.08em' }}>SALIDA</div>
                <div style={{ fontFamily: 'Montserrat', fontWeight: 700, fontSize: 15 }}>{checkout} Jun 2026</div>
              </div>
              <div style={{ padding: 12, borderTop: '1px solid var(--line)', gridColumn: '1 / 3' }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ink-3)', letterSpacing: '.08em' }}>HUÉSPEDES</div>
                <div className="row between">
                  <div style={{ fontFamily: 'Montserrat', fontWeight: 700, fontSize: 15 }}>2 huéspedes</div>
                  <I.chev s={14}/>
                </div>
              </div>
            </div>

            <div className="col gap-8" style={{ marginTop: 18, fontSize: 14 }}>
              <Row label={`${formatGs(nightly)} × ${nights} noches`} value={formatGs(nightly * nights)}/>
              <Row label="Limpieza" value={formatGs(cleaning)}/>
              <Row label="Servicio AlquiloYa" value={formatGs(serviceFee)}/>
            </div>
            <div className="row between" style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line-2)' }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>Total estimado</span>
              <span style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 20, color: 'var(--blue)' }}>{formatGs(total)}</span>
            </div>

            <button className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center', marginTop: 16 }}>
              Solicitar reserva
            </button>
            <button className="btn btn-wa" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}>
              <I.whats s={16}/> Consultar disponibilidad
            </button>
            <div className="muted xs" style={{ marginTop: 12, textAlign: 'center' }}>
              No se realizará ningún cobro en esta versión visual.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return <div className="row between"><span className="muted">{label}</span><span style={{ fontWeight: 500 }}>{value}</span></div>;
}

function LegendDot({ color, border, label }) {
  return (
    <div className="row gap-8" style={{ fontSize: 12, color: 'var(--ink-3)' }}>
      <span style={{ width: 14, height: 14, borderRadius: 4, background: color, border: border ? `1px solid ${border}` : 'none' }}/>
      {label}
    </div>
  );
}

function CalendarMonth({ month, daysInMonth, startDay, checkin, checkout, setCheckin, setCheckout, unavailable = [], offset = 0 }) {
  const labels = ['L','M','M','J','V','S','D'];
  const cells = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  const click = (d) => {
    const dd = offset + d;
    if (unavailable.includes(dd)) return;
    if (!checkin || (checkin && checkout && dd < checkin)) { setCheckin(dd); return; }
    if (checkin && !checkout) { if (dd > checkin) setCheckout(dd); else setCheckin(dd); return; }
    if (dd === checkin) return;
    if (dd > checkin) setCheckout(dd); else setCheckin(dd);
  };
  return (
    <div style={{ flex: 1 }}>
      <div className="row between" style={{ marginBottom: 12 }}>
        <button style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid var(--line)', background: '#fff', cursor: 'pointer' }}><I.chev s={12} style={{ transform: 'rotate(180deg)' }}/></button>
        <div style={{ fontFamily: 'Montserrat', fontWeight: 700, fontSize: 14 }}>{month}</div>
        <button style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid var(--line)', background: '#fff', cursor: 'pointer' }}><I.chev s={12}/></button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {labels.map((l, i) => <div key={i} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--ink-4)', padding: '4px 0' }}>{l}</div>)}
        {cells.map((d, i) => {
          if (d === null) return <div key={'e'+i}/>;
          const dd = offset + d;
          const unavail = unavailable.includes(dd);
          const isStart = dd === checkin;
          const isEnd = dd === checkout;
          const inRange = checkin && checkout && dd > checkin && dd < checkout;
          let bg = '#fff', color = 'var(--ink-2)', radius = 8;
          if (isStart || isEnd) { bg = 'var(--blue)'; color = '#fff'; }
          else if (inRange) { bg = 'var(--blue-50)'; color = 'var(--blue)'; }
          if (unavail) { bg = 'var(--bg-3)'; color = 'var(--ink-4)'; }
          return (
            <button key={'d'+i} onClick={() => click(d)} disabled={unavail} style={{
              aspectRatio: '1', borderRadius: radius, border: '1px solid var(--line-2)', background: bg, color, fontSize: 13, fontWeight: 600,
              cursor: unavail ? 'not-allowed' : 'pointer', textDecoration: unavail ? 'line-through' : 'none', position: 'relative'
            }}>{d}</button>
          );
        })}
      </div>
    </div>
  );
}

Object.assign(window, { TemporalPage });
