// Carteles QR — cada propiedad genera automáticamente su QR.
// Vive dentro del panel del agente: gestión de carteles por propiedad.

function PostersPage({ route, onNav }) {
  const [modalId, setModalId] = React.useState(null);
  const sel = modalId ? PROPERTIES.find(p => p.id === modalId) : null;
  const list = PROPERTIES;

  return (
    <AdminLayout
      kind="agent"
      route={route || 'admin-agent-qr'}
      onNav={onNav}
      title="Carteles QR"
      subtitle="Cada propiedad genera su QR único automáticamente. Descargá o imprimí el cartel listo para la fachada."
      actions={
        <button className="btn btn-primary btn-sm"><I.print s={14}/> Imprimir seleccionados</button>
      }
    >
      <div className="card-soft" style={{ padding: 14, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <MiniStat label="Inmuebles con QR" value={PROPERTIES.length} icon="qr" color="var(--blue)"/>
        <MiniStat label="Carteles descargados" value="42" icon="download" color="var(--green)"/>
        <MiniStat label="Escaneos esta semana" value="318" icon="eye" color="var(--yellow-600)"/>
        <MiniStat label="Más escaneado" value="AY-01243" icon="trend" color="#6e3ad1"/>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden', marginTop: 16 }}>
        <div className="row between" style={{ padding: '12px 18px', borderBottom: '1px solid var(--line)', alignItems: 'center' }}>
          <div>
            <div style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 14 }}>Mis inmuebles publicados</div>
            <div className="muted" style={{ marginTop: 2, fontSize: 11 }}>Cada uno con su QR generado automáticamente</div>
          </div>
          <input className="input" placeholder="Buscar por ID o título..." style={{ width: 240, padding: '6px 10px', fontSize: 12.5 }}/>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--bg-2)', textAlign: 'left' }}>
              <th style={{ padding: '8px 14px', fontSize: 10.5, fontWeight: 700, color: 'var(--ink-3)', letterSpacing: '.04em', textTransform: 'uppercase' }}>Inmueble</th>
              <th style={{ padding: '8px 10px', fontSize: 10.5, fontWeight: 700, color: 'var(--ink-3)', letterSpacing: '.04em', textTransform: 'uppercase' }}>QR</th>
              <th style={{ padding: '8px 10px', fontSize: 10.5, fontWeight: 700, color: 'var(--ink-3)', letterSpacing: '.04em', textTransform: 'uppercase' }}>Escaneos</th>
              <th style={{ padding: '8px 14px' }}></th>
            </tr>
          </thead>
          <tbody>
            {list.slice(0, 10).map((p) => (
              <tr key={p.id} style={{ borderTop: '1px solid var(--line-2)', transition: 'background .12s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-2)'}
                onMouseLeave={e => e.currentTarget.style.background = ''}>
                <td style={{ padding: '10px 14px' }}>
                  <div className="row gap-10">
                    <Photo src={p.cover} style={{ width: 44, height: 36, borderRadius: 6, flexShrink: 0 }}/>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 280 }}>{p.title}</div>
                      <div style={{ marginTop: 2, fontSize: 11, color: 'var(--ink-3)' }}>
                        <span className="mono" style={{ fontWeight: 600, fontSize: 10.5 }}>{p.id}</span> · {p.address}
                      </div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '10px 10px' }}>
                  <div style={{ padding: 3, background: '#fff', border: '1px solid var(--line)', borderRadius: 5, display: 'inline-block' }}>
                    <QRMock size={28} id={p.id}/>
                  </div>
                </td>
                <td style={{ padding: '10px 10px' }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{42 + (p.id.charCodeAt(5) * 13) % 380}</div>
                  <div className="muted" style={{ fontSize: 10.5 }}>últimos 7 días</div>
                </td>
                <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                  <div className="row gap-4" style={{ justifyContent: 'flex-end' }}>
                    <button title="Descargar" style={{ padding: '5px', width: 26, height: 26, borderRadius: 7, background: 'transparent', color: 'var(--ink-3)', border: '1px solid var(--line)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><I.download s={11}/></button>
                    <button title="Imprimir" style={{ padding: '5px', width: 26, height: 26, borderRadius: 7, background: 'transparent', color: 'var(--ink-3)', border: '1px solid var(--line)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><I.print s={11}/></button>
                    <button onClick={() => setModalId(p.id)} style={{ padding: '5px 10px', height: 26, borderRadius: 7, background: 'var(--blue)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 11.5, fontWeight: 600, fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      Ver <I.chev s={10}/>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="row between" style={{ padding: '10px 18px', borderTop: '1px solid var(--line)', fontSize: 12, color: 'var(--ink-3)' }}>
          <div>Mostrando 10 de {PROPERTIES.length} inmuebles</div>
          <div className="row gap-4">
            <button style={{ padding: '4px 9px', borderRadius: 6, background: '#fff', border: '1px solid var(--line)', cursor: 'pointer', fontSize: 12 }}>‹</button>
            <span style={{ padding: '4px 10px', borderRadius: 6, background: 'var(--ink)', color: '#fff', fontSize: 12, fontWeight: 600 }}>1</span>
            <button style={{ padding: '4px 9px', borderRadius: 6, background: '#fff', border: '1px solid var(--line)', cursor: 'pointer', fontSize: 12 }}>2</button>
            <button style={{ padding: '4px 9px', borderRadius: 6, background: '#fff', border: '1px solid var(--line)', cursor: 'pointer', fontSize: 12 }}>›</button>
          </div>
        </div>
      </div>

      {sel && <PosterModal p={sel} onClose={() => setModalId(null)} />}
    </AdminLayout>
  );
}

function PosterModal({ p, onClose }) {
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(11,22,34,.65)', backdropFilter: 'blur(4px)',
      display: 'grid', placeItems: 'center', zIndex: 100, padding: 32, animation: 'fadeIn .2s ease both'
    }}>
      <div onClick={e => e.stopPropagation()} className="card" style={{
        width: '100%', maxWidth: 720, padding: 0, overflow: 'hidden',
        boxShadow: '0 40px 100px rgba(0,0,0,.4)', animation: 'fadeUp .25s ease both'
      }}>
        <div className="row between" style={{ padding: '20px 24px', borderBottom: '1px solid var(--line-2)' }}>
          <div>
            <div className="tag">Cartel QR del inmueble</div>
            <div className="row gap-10" style={{ marginTop: 4, alignItems: 'baseline' }}>
              <h3 style={{ fontSize: 18 }}>{p.title}</h3>
              <span className="mono muted xs">{p.id}</span>
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 36, height: 36, borderRadius: '50%', background: 'var(--bg-2)', border: 'none',
            cursor: 'pointer', display: 'grid', placeItems: 'center'
          }}><I.x s={16}/></button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 28, padding: 28, background: 'var(--bg-2)' }}>
          <FullPoster id={p.id} address={p.address}/>
          <div className="col gap-16">
            <div>
              <div className="muted xs" style={{ letterSpacing: '.08em', fontWeight: 700 }}>DATOS DEL CARTEL</div>
              <div className="col gap-6" style={{ marginTop: 10, fontSize: 14 }}>
                <Row label="ID del inmueble" value={<span className="mono">{p.id}</span>}/>
                <Row label="Dirección" value={p.address}/>
                <Row label="Tipo" value={TIPOS.find(t => t.id === p.tipo)?.label || '—'}/>
                <Row label="Estado" value={p.verified ? 'Verificado' : 'Publicado'}/>
              </div>
            </div>

            <div className="card-soft" style={{ padding: 14, fontSize: 12.5, color: 'var(--ink-3)' }}>
              <div className="row gap-8" style={{ alignItems: 'flex-start' }}>
                <I.shield s={14}/>
                <span>El QR es único para esta propiedad. Al escanear, abre la ficha pública con todas las fotos y datos de contacto.</span>
              </div>
            </div>

            <div className="col gap-8" style={{ marginTop: 'auto' }}>
              <button className="btn btn-blue" style={{ justifyContent: 'center' }}><I.download s={14}/> Descargar PDF A4</button>
              <button className="btn btn-outline" style={{ justifyContent: 'center' }}><I.print s={14}/> Imprimir cartel</button>
              <button className="btn btn-outline" style={{ justifyContent: 'center' }}><I.share s={14}/> Compartir enlace</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="row between">
      <span className="muted">{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}

const th = { padding: '14px 22px', fontSize: 12, fontWeight: 700, letterSpacing: '.04em', color: 'var(--ink-3)' };
const td = { padding: '18px 22px', verticalAlign: 'middle' };

function MiniStat({ label, value, icon, color }) {
  return (
    <div className="row gap-12" style={{ alignItems: 'center' }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: color + '14', color, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
        {React.createElement(I[icon], { s: 18 })}
      </div>
      <div>
        <div className="muted xs">{label}</div>
        <div style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 18 }}>{value}</div>
      </div>
    </div>
  );
}

function PosterPreviewCard({ p }) {
  return (
    <div className="card" style={{ padding: 22 }}>
      <div className="row between">
        <div>
          <div className="tag">Vista previa del cartel</div>
          <div style={{ fontWeight: 700, fontSize: 15, marginTop: 4 }}>
            <span className="mono">{p.id}</span>
          </div>
        </div>
        {p.verified
          ? <span className="badge badge-verified"><I.check s={11}/> Verificado</span>
          : <span className="badge" style={{ background: 'var(--yellow-50)', color: '#8a5e00' }}>Publicado</span>}
      </div>

      <div style={{ marginTop: 16, padding: 24, background: 'var(--bg-2)', borderRadius: 14, display: 'grid', placeItems: 'center' }}>
        <FullPoster id={p.id} address={p.address}/>
      </div>

      <div className="col gap-10" style={{ marginTop: 16 }}>
        <button className="btn btn-blue" style={{ justifyContent: 'center' }}><I.download s={14}/> Descargar PDF A4</button>
        <button className="btn btn-outline" style={{ justifyContent: 'center' }}><I.print s={14}/> Imprimir cartel</button>
        <button className="btn btn-outline" style={{ justifyContent: 'center' }}><I.share s={14}/> Compartir enlace del inmueble</button>
      </div>

      <div className="card-soft" style={{ padding: 14, marginTop: 16, fontSize: 12.5, color: 'var(--ink-3)' }}>
        <div className="row gap-8" style={{ alignItems: 'flex-start' }}>
          <I.shield s={14}/>
          <span>El QR es único para esta propiedad y se generó automáticamente al cargar el inmueble. Al escanear, abre la ficha pública con todas las fotos y datos de contacto.</span>
        </div>
      </div>
    </div>
  );
}

function FullPoster({ id, address }) {
  return (
    <div style={{
      width: 280, background: '#fff', borderRadius: 12, overflow: 'hidden',
      boxShadow: 'var(--shadow-lg)', border: '1px solid var(--line)'
    }}>
      <div style={{ background: 'var(--blue)', color: '#fff', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Logo size={18} dark/>
      </div>
      <div style={{ background: 'var(--yellow)', padding: '20px 20px 16px', textAlign: 'center' }}>
        <div style={{ fontFamily: 'Montserrat', fontWeight: 900, fontStyle: 'italic', fontSize: 36, color: 'var(--ink)', letterSpacing: '-0.02em', lineHeight: 1 }}>
          SE ALQUILA
        </div>
        <div style={{ fontFamily: 'Montserrat', fontWeight: 700, fontStyle: 'italic', fontSize: 11, color: 'var(--ink)', marginTop: 8, letterSpacing: '.04em' }}>
          ESCANEÁ Y MIRÁ FOTOS, PRECIO Y DETALLES
        </div>
      </div>
      <div style={{ padding: 20, textAlign: 'center' }}>
        <div style={{ padding: 8, border: '3px solid var(--ink)', borderRadius: 8, display: 'inline-block' }}>
          <QRMock size={150} id={id}/>
        </div>
        <div style={{ marginTop: 12, fontFamily: 'JetBrains Mono', fontSize: 12, fontWeight: 600, color: 'var(--ink-3)' }}>{id}</div>
        <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4, color: 'var(--ink-2)' }}>{address}</div>
      </div>
      <div style={{ background: 'var(--blue)', color: '#fff', padding: '12px 20px', textAlign: 'center' }}>
        <div style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 13, fontStyle: 'italic', letterSpacing: '.04em' }}>
          ALQUILOYA.COM.PY
        </div>
        <div style={{ fontFamily: 'Montserrat', fontWeight: 700, fontStyle: 'italic', fontSize: 10, color: 'var(--yellow)', marginTop: 2 }}>
          ¡DONDE ENCONTRÁS MÁS RÁPIDO!
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { PostersPage, FullPoster, PosterModal });
