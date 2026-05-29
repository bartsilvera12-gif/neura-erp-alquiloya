// Publicar inmueble — wizard 5 pasos

function PublishPage() {
  const [step, setStep] = React.useState(0);
  const steps = [
    { id: 0, title: 'Datos básicos', icon: 'doc' },
    { id: 1, title: 'Ubicación', icon: 'pin' },
    { id: 2, title: 'Fotos', icon: 'upload' },
    { id: 3, title: 'Gestión', icon: 'user' },
    { id: 4, title: 'Plan', icon: 'star' },
    { id: 5, title: 'Vista previa', icon: 'eye' },
  ];

  // Lifted state para la sección "Gestión" (asesoría de agente)
  const [mgmtMode, setMgmtMode] = React.useState('self'); // 'self' | 'agent'
  const [pickedAgentId, setPickedAgentId] = React.useState(null);
  const [propietarioForm, setPropietarioForm] = React.useState({
    nombre: '', email: '', telefono: '',
    propiedad_titulo: '', tipo_propiedad: 'departamento',
    ciudad: '', barrio: '', mensaje: '',
  });
  const [submitState, setSubmitState] = React.useState({ loading: false, error: null, success: false });

  async function onPublicar() {
    setSubmitState({ loading: false, error: null, success: false });
    if (mgmtMode !== 'agent') {
      setSubmitState({ loading: false, error: null, success: true });
      return;
    }
    if (!pickedAgentId) { setSubmitState({ loading: false, error: 'Elegí un agente.', success: false }); return; }
    if (!propietarioForm.nombre.trim()) { setSubmitState({ loading: false, error: 'Tu nombre es obligatorio.', success: false }); return; }
    if (!propietarioForm.email.trim() && !propietarioForm.telefono.trim()) {
      setSubmitState({ loading: false, error: 'Dejá un email o teléfono para que el agente te contacte.', success: false });
      return;
    }
    setSubmitState({ loading: true, error: null, success: false });
    try {
      const res = await fetch('/api/public/alquiloya/captaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agente_id: pickedAgentId,
          propietario_nombre: propietarioForm.nombre,
          propietario_email: propietarioForm.email || null,
          propietario_telefono: propietarioForm.telefono || null,
          propiedad_titulo: propietarioForm.propiedad_titulo || null,
          tipo_propiedad: propietarioForm.tipo_propiedad || null,
          ciudad: propietarioForm.ciudad || null,
          barrio: propietarioForm.barrio || null,
          mensaje: propietarioForm.mensaje || null,
          origen: 'web_publica',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || ('HTTP ' + res.status));
      setSubmitState({ loading: false, error: null, success: true });
    } catch (e) {
      setSubmitState({ loading: false, error: (e && e.message) || 'No se pudo enviar.', success: false });
    }
  }
  return (
    <div className="fade-in container" style={{ padding: '32px' }}>
      <div className="row between">
        <div>
          <div className="tag">Publicar inmueble</div>
          <h2 style={{ marginTop: 6, fontSize: 30 }}>Cargá tu propiedad en 6 pasos</h2>
        </div>
        <button className="btn btn-outline">Guardar borrador</button>
      </div>

      <div className="card" style={{ marginTop: 24, padding: '20px 24px' }}>
        <div className="row" style={{ gap: 0, justifyContent: 'space-between' }}>
          {steps.map((s, i) => (
            <React.Fragment key={s.id}>
              <div className="row gap-12" style={{ alignItems: 'center', flex: '0 0 auto' }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: step >= i ? 'var(--blue)' : '#fff',
                  border: '2px solid ' + (step >= i ? 'var(--blue)' : 'var(--line)'),
                  color: step >= i ? '#fff' : 'var(--ink-3)',
                  display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0
                }}>
                  {step > i ? <I.check s={16}/> : i + 1}
                </div>
                <div>
                  <div className="muted xs">Paso {i + 1}</div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: step >= i ? 'var(--ink)' : 'var(--ink-4)' }}>{s.title}</div>
                </div>
              </div>
              {i < steps.length - 1 && (
                <div style={{ flex: 1, height: 2, background: step > i ? 'var(--blue)' : 'var(--line)', alignSelf: 'center', margin: '0 12px' }}/>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 28, marginTop: 28, alignItems: 'flex-start' }}>
        <div className="card" style={{ padding: 32 }}>
          {step === 0 && <StepBasics/>}
          {step === 1 && <StepLocation/>}
          {step === 2 && <StepPhotos/>}
          {step === 3 && (
            <StepManagement
              mode={mgmtMode}
              setMode={setMgmtMode}
              pickedAgent={pickedAgentId}
              setPickedAgent={setPickedAgentId}
              propietario={propietarioForm}
              setPropietario={setPropietarioForm}
            />
          )}
          {step === 4 && <StepPlan/>}
          {step === 5 && <StepPreview/>}

          {submitState.success && (
            <div style={{ marginTop: 16, padding: 16, background: '#eaf6f0', borderRadius: 12, border: '1px solid #b6dec6', color: '#1f5e3a', fontSize: 14 }}>
              {mgmtMode === 'agent'
                ? '✓ Tu solicitud fue enviada al agente. Te va a contactar pronto.'
                : '✓ ¡Listo! En esta demo aún no publicamos la propiedad real, pero recibimos tu solicitud.'}
            </div>
          )}
          {submitState.error && (
            <div style={{ marginTop: 16, padding: 12, background: '#fdecec', borderRadius: 12, border: '1px solid #f3c2c2', color: '#a8312f', fontSize: 13 }}>
              {submitState.error}
            </div>
          )}

          <div className="row between" style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid var(--line-2)' }}>
            <button className="btn btn-outline" disabled={step === 0} onClick={() => setStep(s => Math.max(0, s - 1))}
              style={{ opacity: step === 0 ? 0.4 : 1 }}>
              ← Anterior
            </button>
            <div className="row gap-12">
              <span className="muted xs">Paso {step + 1} de {steps.length}</span>
              {step < steps.length - 1 ? (
                <button className="btn btn-blue" onClick={() => setStep(s => Math.min(steps.length - 1, s + 1))}>
                  Continuar <I.arrow s={14}/>
                </button>
              ) : (
                <button
                  className="btn btn-primary btn-lg"
                  disabled={submitState.loading}
                  onClick={onPublicar}
                  style={submitState.loading ? { opacity: 0.6, cursor: 'wait' } : null}
                >
                  {submitState.loading
                    ? 'Enviando…'
                    : (mgmtMode === 'agent' ? 'Enviar solicitud al agente' : 'Publicar inmueble')}
                  <I.check s={16}/>
                </button>
              )}
            </div>
          </div>
        </div>

        <div style={{ position: 'sticky', top: 92 }}>
          <PreviewCard step={step}/>
        </div>
      </div>
    </div>
  );
}

function FormGrid({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>{children}</div>;
}

function StepBasics() {
  return (
    <div>
      <div className="tag">Paso 1</div>
      <h3 style={{ fontSize: 22, marginTop: 6 }}>Datos básicos de tu propiedad</h3>
      <p className="muted" style={{ fontSize: 14, marginTop: 6 }}>Completá la información principal del inmueble.</p>
      <div style={{ marginTop: 24 }}>
        <div className="field" style={{ marginBottom: 18 }}>
          <label>Tipo de inmueble</label>
          <div className="row gap-10" style={{ flexWrap: 'wrap' }}>
            {TIPOS.map(t => <TileChoice key={t.id} icon={t.icon} label={t.label} active={t.id === 'depto'}/>)}
          </div>
        </div>
        <div className="field" style={{ marginBottom: 18 }}>
          <label>Título de la publicación</label>
          <input className="input" defaultValue="Dúplex moderno con balcón en zona Villa Morra"/>
          <span className="muted xs">Hasta 80 caracteres. Sé claro y específico.</span>
        </div>
        <FormGrid>
          <div className="field">
            <label>Precio mensual (Gs.)</label>
            <input className="input" defaultValue="3.800.000"/>
          </div>
          <div className="field">
            <label>Operación</label>
            <PrettySelect value="permanente" onChange={() => {}} options={[
              { value: 'permanente', label: 'Alquiler permanente' },
              { value: 'temporal', label: 'Alquiler temporal' },
            ]}/>
          </div>
        </FormGrid>
        <div style={{ height: 18 }}/>
        <FormGrid>
          <div className="field"><label>Dormitorios</label><input className="input" defaultValue="2"/></div>
          <div className="field"><label>Baños</label><input className="input" defaultValue="2"/></div>
          <div className="field"><label>Superficie (m²)</label><input className="input" defaultValue="85"/></div>
          <div className="field"><label>Antigüedad</label>
            <PrettySelect value="estrenar" onChange={() => {}} options={[
              { value: 'estrenar', label: 'A estrenar' },
              { value: '1-5', label: '1–5 años' },
              { value: '5-10', label: '5–10 años' },
              { value: '+10', label: '+10 años' },
            ]}/>
          </div>
        </FormGrid>
        <div className="field" style={{ marginTop: 18 }}>
          <label>Características</label>
          <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
            {['Cochera','Amoblado','Mascotas permitidas','Piscina','Quincho','Aire acondicionado','Wifi','Lavadero','Seguridad 24hs','Cocina equipada'].map((f,i) => (
              <Chip key={f} label={f} active={i < 5}/>
            ))}
          </div>
        </div>
        <div className="field" style={{ marginTop: 18 }}>
          <label>Descripción</label>
          <textarea className="input" rows={4} defaultValue="Excelente departamento recientemente refaccionado. Cuenta con ambientes amplios, ventilados, y todos los servicios."/>
        </div>
      </div>
    </div>
  );
}

function TileChoice({ icon, label, active }) {
  return (
    <button style={{
      padding: '8px 12px', borderRadius: 10,
      border: '1.5px solid ' + (active ? 'var(--blue)' : 'var(--line)'),
      background: active ? 'var(--blue-50)' : '#fff',
      cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7,
      color: active ? 'var(--blue)' : 'var(--ink-2)', fontWeight: 600, fontSize: 12.5,
      fontFamily: 'inherit', whiteSpace: 'nowrap',
    }}>
      {React.createElement(I[icon], { s: 14 })}
      {label}
    </button>
  );
}
function Chip({ label, active }) {
  return (
    <button style={{
      padding: '8px 14px', borderRadius: 999,
      border: '1px solid ' + (active ? 'var(--blue)' : 'var(--line)'),
      background: active ? 'var(--blue)' : '#fff',
      color: active ? '#fff' : 'var(--ink-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer'
    }}>{active && '✓ '}{label}</button>
  );
}

function StepLocation() {
  return (
    <div>
      <div className="tag">Paso 2</div>
      <h3 style={{ fontSize: 22, marginTop: 6 }}>¿Dónde se encuentra tu inmueble?</h3>
      <p className="muted" style={{ fontSize: 14, marginTop: 6 }}>La ubicación exacta solo se compartirá cuando coordines una visita.</p>
      <div style={{ marginTop: 24 }}>
        <FormGrid>
          <div className="field"><label>Departamento</label><PrettySelect value={DEPARTAMENTOS[0]} onChange={() => {}} options={DEPARTAMENTOS}/></div>
          <div className="field"><label>Ciudad</label><PrettySelect value={CIUDADES['Central'][0]} onChange={() => {}} options={CIUDADES['Central']}/></div>
          <div className="field"><label>Barrio</label><PrettySelect value={BARRIOS[0]} onChange={() => {}} options={BARRIOS}/></div>
          <div className="field"><label>Código postal</label><input className="input" defaultValue="1208"/></div>
        </FormGrid>
        <div className="field" style={{ marginTop: 18 }}>
          <label>Dirección (no se mostrará al público)</label>
          <input className="input" defaultValue="Mariscal López casi Capitán Brizuela"/>
        </div>
      </div>
      <div className="card" style={{ padding: 0, overflow: 'hidden', marginTop: 18, border: '1px solid var(--line)' }}>
        <div style={{ padding: '14px 16px', background: 'var(--bg-2)', borderBottom: '1px solid var(--line-2)' }} className="row between">
          <div className="row gap-8"><I.pin s={14}/> <span style={{ fontWeight: 600, fontSize: 13 }}>Ubicación aproximada</span></div>
          <button className="btn btn-outline btn-sm">Ajustar pin</button>
        </div>
        <MiniMap height={260} pins={1}/>
      </div>
    </div>
  );
}

function StepPhotos() {
  const photos = Array.from({ length: 6 }, (_, i) => photo(i));
  return (
    <div>
      <div className="tag">Paso 3</div>
      <h3 style={{ fontSize: 22, marginTop: 6 }}>Subí tus mejores fotos</h3>
      <p className="muted" style={{ fontSize: 14, marginTop: 6 }}>La primera foto será la principal. Recomendamos al menos 5 fotos para maximizar consultas.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 24 }}>
        {photos.map((src, i) => (
          <div key={i} style={{ position: 'relative' }}>
            <Photo src={src} style={{ height: 130, borderRadius: 10 }}/>
            {i === 0 && <span className="badge badge-featured" style={{ position: 'absolute', top: 8, left: 8 }}>Principal</span>}
            <button style={{ position: 'absolute', top: 8, right: 8, width: 26, height: 26, borderRadius: '50%', background: 'rgba(255,255,255,.95)', border: 'none', cursor: 'pointer' }}>
              <I.x s={12}/>
            </button>
          </div>
        ))}
        <button style={{
          height: 130, borderRadius: 10, border: '2px dashed var(--line)', background: 'var(--bg-2)',
          display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--ink-3)'
        }}>
          <div className="col" style={{ alignItems: 'center', gap: 4 }}>
            <I.upload s={20}/>
            <span style={{ fontSize: 12.5, fontWeight: 600 }}>Agregar foto</span>
          </div>
        </button>
      </div>
      <div style={{ marginTop: 24, padding: 18, background: 'var(--blue-50)', borderRadius: 12 }}>
        <div className="row gap-12">
          <I.bolt s={20} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Premium incluye video y tour 360°</div>
            <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>Las propiedades con video reciben 3x más consultas. <a style={{ color: 'var(--blue)', fontWeight: 600 }}>Activar Premium →</a></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepManagement(props) {
  // Backwards-compatible: si llamás sin props (uso legacy), usa estado local.
  const localMode = React.useState('self');
  const localPicked = React.useState(null);
  const mode = props && typeof props.mode === 'string' ? props.mode : localMode[0];
  const setMode = props && props.setMode ? props.setMode : localMode[1];
  const pickedAgent = props && typeof props.pickedAgent !== 'undefined' ? props.pickedAgent : localPicked[0];
  const setPickedAgent = props && props.setPickedAgent ? props.setPickedAgent : localPicked[1];
  const propietario = (props && props.propietario) || { nombre: '', email: '', telefono: '', propiedad_titulo: '', tipo_propiedad: 'departamento', ciudad: '', barrio: '', mensaje: '' };
  const setPropietario = (props && props.setPropietario) || (() => {});

  const [filter, setFilter] = React.useState('');
  // Agentes reales desde API; fallback al mock AGENTS si falla.
  const [apiAgents, setApiAgents] = React.useState(null);
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/public/alquiloya/agentes', { cache: 'no-store' });
        const body = await r.json().catch(() => ({}));
        if (cancelled) return;
        const list = (body && body.data && Array.isArray(body.data.agentes)) ? body.data.agentes : [];
        if (list.length > 0) setApiAgents(list);
      } catch (_) { /* fallback */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // Normalizamos la fuente: real (API) tiene {id,nombre,telefono,whatsapp,foto_url,cargo,bio,activo}.
  // Si no hay datos reales, usamos el mock AGENTS para preservar la demo visual.
  const sourceList = apiAgents
    ? apiAgents.map(a => ({
        id: a.id,
        name: a.nombre || '—',
        zone: a.cargo || '',
        verified: !!a.activo,
        level: 'Pro',
        rating: 4.8,
        reviews: 0,
        activeProperties: 0,
        closedRentals: 0,
        commissionRate: 5,
        _real: true,
      }))
    : AGENTS;

  const filtered = sourceList.filter(a =>
    !filter || (a.name||'').toLowerCase().includes(filter.toLowerCase()) || (a.zone||'').toLowerCase().includes(filter.toLowerCase())
  ).sort((a, b) => (b.rating||0) - (a.rating||0));

  const upd = (k, v) => setPropietario(p => Object.assign({}, p, { [k]: v }));

  return (
    <div>
      <div className="tag">Paso 4</div>
      <h3 style={{ fontSize: 22, marginTop: 6 }}>¿Cómo querés gestionar la propiedad?</h3>
      <p className="muted" style={{ fontSize: 14, marginTop: 6 }}>
        Podés publicarla vos mismo o cederle la gestión a un agente verificado. Si la captura un agente, él se encarga de visitas, consultas y cierre — y recibe una comisión solo si se concreta el alquiler.
      </p>

      <div className="row gap-14" style={{ marginTop: 22 }}>
        <button onClick={() => setMode('self')} className="card" style={{
          flex: 1, padding: 18, textAlign: 'left', cursor: 'pointer',
          border: '2px solid ' + (mode === 'self' ? 'var(--blue)' : 'var(--line)'),
          background: mode === 'self' ? 'var(--blue-50)' : '#fff'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: mode === 'self' ? 'var(--blue)' : 'var(--bg-3)', color: mode === 'self' ? '#fff' : 'var(--ink-3)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <I.user s={18}/>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 14.5, lineHeight: 1.25 }}>Yo lo gestiono</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 4, lineHeight: 1.45 }}>Atendés vos las consultas y visitas. Sin comisión.</div>
            </div>
          </div>
        </button>
        <button onClick={() => setMode('agent')} className="card" style={{
          flex: 1, padding: 18, textAlign: 'left', cursor: 'pointer',
          border: '2px solid ' + (mode === 'agent' ? 'var(--blue)' : 'var(--line)'),
          background: mode === 'agent' ? 'var(--blue-50)' : '#fff'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: mode === 'agent' ? 'var(--blue)' : 'var(--bg-3)', color: mode === 'agent' ? '#fff' : 'var(--ink-3)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <I.shield s={18}/>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 14.5, lineHeight: 1.25 }}>Cederlo a un agente</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 4, lineHeight: 1.45 }}>El agente gestiona todo. Comisión 4–5% solo si alquila.</div>
            </div>
          </div>
        </button>
      </div>

      {mode === 'agent' && (
        <div style={{ marginTop: 24 }}>
          <div className="row between" style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Elegí un agente</div>
            <input className="input" placeholder="Buscar por nombre o zona…" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ width: 260, padding: '8px 12px' }}/>
          </div>
          <div className="col gap-10" style={{ maxHeight: 360, overflowY: 'auto', paddingRight: 4 }}>
            {filtered.map(a => (
              <button key={a.id} onClick={() => setPickedAgent(a.id)} className="card" style={{
                padding: 14, textAlign: 'left', cursor: 'pointer',
                border: '2px solid ' + (pickedAgent === a.id ? 'var(--blue)' : 'var(--line)'),
                background: pickedAgent === a.id ? 'var(--blue-50)' : '#fff',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12
              }}>
                <div className="row gap-12" style={{ alignItems: 'center', minWidth: 0, flex: 1 }}>
                  <Avatar name={a.name} size={44}/>
                  <div style={{ minWidth: 0 }}>
                    <div className="row gap-6" style={{ alignItems: 'center' }}>
                      <span style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 15 }}>{a.name}</span>
                      {a.verified && <span className="badge badge-verified" style={{ fontSize: 9.5 }}><I.check s={9}/> Verificado</span>}
                      <AgentLevelBadge level={a.level}/>
                    </div>
                    <div className="muted xs" style={{ marginTop: 2 }}>
                      <I.pin s={11}/> {a.zone} · {a.activeProperties} activas · {a.closedRentals} cerradas
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div className="row gap-4" style={{ justifyContent: 'flex-end', color: 'var(--yellow-600)', fontWeight: 700, fontSize: 14 }}>
                    <I.star s={13}/> {a.rating}
                  </div>
                  <div className="muted xs">{a.reviews} reseñas</div>
                  <div className="xs" style={{ color: 'var(--ink-2)', marginTop: 4 }}>Comisión {a.commissionRate}%</div>
                </div>
              </button>
            ))}
          </div>
          {pickedAgent && (
            <React.Fragment>
              <div style={{ marginTop: 18, padding: 16, background: '#eaf6f0', borderRadius: 12, border: '1px solid #b6dec6' }}>
                <div className="row gap-10">
                  <I.check s={18}/>
                  <div style={{ fontSize: 13.5 }}>
                    <strong>Listo.</strong> Al enviar la solicitud, le notificaremos a <strong>{(sourceList.find(a => a.id === pickedAgent) || {}).name}</strong> para que se contacte con vos.
                  </div>
                </div>
              </div>

              {/* Datos de contacto para que el agente te llegue */}
              <div className="card" style={{ marginTop: 18, padding: 18 }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Tus datos de contacto</div>
                <FormGrid>
                  <div className="field">
                    <label>Tu nombre *</label>
                    <input className="input" value={propietario.nombre} onChange={e => upd('nombre', e.target.value)} placeholder="Nombre y apellido"/>
                  </div>
                  <div className="field">
                    <label>Email</label>
                    <input className="input" type="email" value={propietario.email} onChange={e => upd('email', e.target.value)} placeholder="usuario@dominio.com"/>
                  </div>
                  <div className="field">
                    <label>Teléfono / WhatsApp</label>
                    <input className="input" value={propietario.telefono} onChange={e => upd('telefono', e.target.value)} placeholder="+595 ..."/>
                  </div>
                  <div className="field">
                    <label>Ciudad</label>
                    <input className="input" value={propietario.ciudad} onChange={e => upd('ciudad', e.target.value)} placeholder="Asunción, Encarnación…"/>
                  </div>
                  <div className="field">
                    <label>Barrio</label>
                    <input className="input" value={propietario.barrio} onChange={e => upd('barrio', e.target.value)} placeholder="opcional"/>
                  </div>
                  <div className="field">
                    <label>Tipo de propiedad</label>
                    <input className="input" value={propietario.tipo_propiedad} onChange={e => upd('tipo_propiedad', e.target.value)} placeholder="departamento, casa…"/>
                  </div>
                  <div className="field" style={{ gridColumn: '1 / -1' }}>
                    <label>Título de la propiedad</label>
                    <input className="input" value={propietario.propiedad_titulo} onChange={e => upd('propiedad_titulo', e.target.value)} placeholder="Dúplex moderno en Villa Morra…"/>
                  </div>
                  <div className="field" style={{ gridColumn: '1 / -1' }}>
                    <label>Mensaje al agente (opcional)</label>
                    <textarea className="input" value={propietario.mensaje} onChange={e => upd('mensaje', e.target.value)} rows={3} placeholder="Contale al agente lo que necesitás"/>
                  </div>
                </FormGrid>
                <div className="muted xs" style={{ marginTop: 10 }}>Dejá al menos email o teléfono para que el agente pueda contactarte.</div>
              </div>
            </React.Fragment>
          )}
        </div>
      )}
    </div>
  );
}

function AgentLevelBadge({ level }) {
  const map = {
    'Junior':  { bg: 'var(--bg-3)',  fg: 'var(--ink-3)' },
    'Pro':     { bg: 'var(--blue-50)', fg: 'var(--blue)' },
    'Top Pro': { bg: 'var(--yellow)', fg: 'var(--ink)' },
  };
  const c = map[level] || map['Junior'];
  return <span className="badge" style={{ background: c.bg, color: c.fg, fontSize: 9.5 }}>{level}</span>;
}

function StepPlan() {
  const [picked, setPicked] = React.useState('basico-owner');
  return (
    <div>
      <div className="tag">Paso 5</div>
      <h3 style={{ fontSize: 22, marginTop: 6 }}>Elegí un plan para tu publicación</h3>
      <p className="muted" style={{ fontSize: 14, marginTop: 6 }}>Podés cambiar de plan más adelante.</p>
      <div className="col gap-12" style={{ marginTop: 20 }}>
        {PLANS.filter(p => p.tier.includes('owner')).map(p => (
          <button key={p.tier} onClick={() => setPicked(p.tier)} className="card" style={{
            padding: 18, textAlign: 'left',
            border: '2px solid ' + (picked === p.tier ? 'var(--blue)' : 'var(--line)'),
            background: picked === p.tier ? 'var(--blue-50)' : '#fff',
            cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16
          }}>
            <div className="row gap-14">
              <span style={{
                width: 22, height: 22, borderRadius: '50%',
                border: '2px solid ' + (picked === p.tier ? 'var(--blue)' : 'var(--line)'),
                background: picked === p.tier ? 'var(--blue)' : '#fff',
                display: 'grid', placeItems: 'center', color: '#fff'
              }}>{picked === p.tier && <I.check s={12}/>}</span>
              <div>
                <div className="row gap-8">
                  <div style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 17 }}>{p.name}</div>
                  {p.badge && <span className="badge badge-featured" style={{ fontSize: 10 }}>{p.badge}</span>}
                </div>
                <div className="muted xs">{p.bullets[0]} · {p.bullets[1]}</div>
              </div>
            </div>
            <div style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 20, color: 'var(--blue)', textAlign: 'right' }}>
              {p.billing === 'gratis' ? 'Gratis' : formatGs(p.price)}
              {p.billing === 'mensual' && <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--ink-3)' }}>/ mes</div>}
              {p.billing === 'unico' && <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--ink-3)' }}>pago único</div>}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function StepPreview() {
  return (
    <div>
      <div className="tag">Paso 6</div>
      <h3 style={{ fontSize: 22, marginTop: 6 }}>Revisá cómo se verá tu publicación</h3>
      <p className="muted" style={{ fontSize: 14, marginTop: 6 }}>Si todo está correcto, publicá. Podrás editar en cualquier momento.</p>
      <div className="card" style={{ marginTop: 24, padding: 0, overflow: 'hidden' }}>
        <Photo src={photo(0)} style={{ height: 280, borderRadius: 0 }}/>
        <div style={{ padding: 22 }}>
          <div className="row gap-8">
            <span className="badge badge-verified"><I.check s={11}/> Verificación pendiente</span>
          </div>
          <h3 style={{ marginTop: 10, fontSize: 22 }}>Dúplex moderno con balcón en zona Villa Morra</h3>
          <div className="muted" style={{ marginTop: 4, fontSize: 13 }}><I.pin s={13}/> Villa Morra, Asunción · Central</div>
          <div style={{ fontFamily: 'Montserrat', fontWeight: 900, fontSize: 28, color: 'var(--blue)', marginTop: 12 }}>Gs. 3.800.000<span style={{ fontSize: 13, color: 'var(--ink-3)', fontWeight: 500 }}> / mes</span></div>
        </div>
      </div>
      <div style={{ marginTop: 16, padding: 18, background: 'var(--yellow-50)', borderRadius: 12, fontSize: 13.5, color: '#8a5e00' }}>
        <I.bolt s={14}/> Al publicar, tu inmueble entra en cola de verificación. Tarda menos de 24 hs hábiles.
      </div>

      <AutoActionsSection/>
    </div>
  );
}

function AutoActionsSection() {
  const [fb, setFb] = React.useState(true);
  const [ig, setIg] = React.useState(true);
  const [pdf, setPdf] = React.useState(true);
  const [fbConnected, setFbConnected] = React.useState(false);
  const [igConnected, setIgConnected] = React.useState(false);
  const [showBrochure, setShowBrochure] = React.useState(false);

  return (
    <div style={{ marginTop: 24 }}>
      <div className="row gap-8" style={{ marginBottom: 6 }}>
        <span className="badge badge-featured" style={{ fontSize: 10 }}><I.star s={10}/> Premium</span>
        <span style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 16 }}>Acciones automáticas al publicar</span>
      </div>
      <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
        Al activar Premium, podés compartir el inmueble en redes y generar un brochure profesional con un click.
      </p>

      <div className="col gap-10" style={{ marginTop: 16 }}>
        <AutoToggle
          icon="fb"
          color="#1877F2"
          title="Publicar en Facebook"
          desc="Se publicará automáticamente en tu Página de Facebook conectada"
          checked={fb}
          onChange={setFb}
          connected={fbConnected}
          onConnect={() => setFbConnected(true)}
          connectLabel="Conectar Facebook"
        />
        <AutoToggle
          icon="ig"
          color="#E1306C"
          title="Publicar en Instagram"
          desc="Se publicará un carrusel con las fotos en tu cuenta Instagram Business"
          checked={ig}
          onChange={setIg}
          connected={igConnected}
          onConnect={() => setIgConnected(true)}
          connectLabel="Conectar Instagram"
        />
        <AutoToggle
          icon="doc"
          color="var(--blue)"
          title="Generar brochure PDF"
          desc="Crea un PDF de 2 páginas con fotos, mapa, precio y QR — listo para compartir o imprimir"
          checked={pdf}
          onChange={setPdf}
          extra={
            <button className="btn btn-outline btn-sm" type="button" onClick={() => setShowBrochure(true)}>
              <I.eye s={12}/> Ver muestra
            </button>
          }
        />
      </div>

      {showBrochure && <BrochurePreviewModal onClose={() => setShowBrochure(false)}/>}
    </div>
  );
}

function AutoToggle({ icon, color, title, desc, checked, onChange, connected, onConnect, connectLabel, extra }) {
  const iconNode = icon === 'fb' ? (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M22 12a10 10 0 1 0-11.6 9.9v-7H8v-2.9h2.4V9.4c0-2.4 1.4-3.7 3.6-3.7 1 0 2.1.2 2.1.2v2.3h-1.2c-1.2 0-1.5.7-1.5 1.5v1.8h2.6l-.4 2.9h-2.2v7A10 10 0 0 0 22 12z"/></svg>
  ) : icon === 'ig' ? (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="18" cy="6" r="1" fill="currentColor"/></svg>
  ) : <I.doc s={22}/>;

  return (
    <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: color + '14', color, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
        {iconNode}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="row gap-8" style={{ alignItems: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 14.5 }}>{title}</div>
          {connected === true && <span className="badge" style={{ background: '#eaf6f0', color: 'var(--green)', fontSize: 9.5 }}><I.check s={9}/> Conectado</span>}
          {connected === false && <span className="badge" style={{ background: 'var(--bg-3)', color: 'var(--ink-3)', fontSize: 9.5 }}>Sin conectar</span>}
        </div>
        <div className="muted" style={{ fontSize: 12.5, marginTop: 2, lineHeight: 1.4 }}>{desc}</div>
      </div>
      <div className="row gap-10" style={{ flexShrink: 0 }}>
        {extra}
        {connected === false && (
          <button type="button" onClick={onConnect} className="btn btn-outline btn-sm">{connectLabel}</button>
        )}
        <Toggle checked={checked} onChange={onChange}/>
      </div>
    </div>
  );
}

function Toggle({ checked, onChange }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} style={{
      width: 44, height: 24, borderRadius: 999,
      background: checked ? 'var(--blue)' : 'var(--bg-3)',
      border: 'none', cursor: 'pointer', position: 'relative',
      transition: 'background .15s'
    }}>
      <span style={{
        position: 'absolute', top: 2, left: checked ? 22 : 2,
        width: 20, height: 20, borderRadius: '50%', background: '#fff',
        transition: 'left .15s', boxShadow: '0 1px 3px rgba(0,0,0,.15)'
      }}/>
    </button>
  );
}

function BrochurePreviewModal({ onClose }) {
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(11,22,34,.7)', zIndex: 200,
      display: 'grid', placeItems: 'center', padding: 20, overflowY: 'auto'
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        position: 'relative', maxWidth: 880, width: '100%',
        maxHeight: 'calc(100vh - 40px)', overflowY: 'auto'
      }}>
        <div className="row between" style={{ color: '#fff', marginBottom: 14, alignItems: 'center' }}>
          <div>
            <div style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 18 }}>Vista previa del brochure</div>
            <div className="xs" style={{ opacity: .8 }}>2 páginas · A4 · Generado automáticamente</div>
          </div>
          <div className="row gap-10">
            <button className="btn btn-primary"><I.doc s={14}/> Descargar PDF</button>
            <button onClick={onClose} className="btn" style={{ background: 'rgba(255,255,255,.2)', color: '#fff' }}>Cerrar</button>
          </div>
        </div>
        <div className="row gap-16" style={{ alignItems: 'flex-start' }}>
          <BrochurePage1/>
          <BrochurePage2/>
        </div>
      </div>
    </div>
  );
}

function BrochurePage1() {
  return (
    <div style={{ background: '#fff', width: '50%', aspectRatio: '0.707', boxShadow: '0 20px 40px rgba(0,0,0,.3)', borderRadius: 4, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: 'var(--blue)', color: '#fff', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: 'Montserrat', fontWeight: 900, fontSize: 14, letterSpacing: '.04em' }}>ALQUILOYA</span>
        <span className="badge badge-verified" style={{ fontSize: 9 }}><I.check s={8}/> Verificado</span>
      </div>
      <Photo src={photo(0)} style={{ height: '38%', borderRadius: 0 }}/>
      <div style={{ padding: '14px 16px', flex: 1 }}>
        <div style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 14, lineHeight: 1.2 }}>Dúplex moderno con balcón</div>
        <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 2 }}>Villa Morra, Asunción</div>
        <div style={{ fontFamily: 'Montserrat', fontWeight: 900, fontSize: 18, color: 'var(--blue)', marginTop: 8 }}>Gs. 3.800.000<span style={{ fontSize: 9, fontWeight: 500, color: 'var(--ink-3)' }}> / mes</span></div>
        <div className="row gap-10" style={{ marginTop: 8, fontSize: 9.5, color: 'var(--ink-2)' }}>
          <span><I.bed s={10}/> 2 dorm</span>
          <span><I.bath s={10}/> 2 baños</span>
          <span><I.ruler s={10}/> 85 m²</span>
        </div>
        <div style={{ fontSize: 8.5, color: 'var(--ink-3)', marginTop: 10, lineHeight: 1.4 }}>
          Excelente propiedad recientemente refaccionada, ubicación estratégica con acceso rápido a avenidas principales, supermercados, colegios y centros comerciales.
        </div>
        <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
          {[1,2,3].map(i => <Photo key={i} src={photo(i)} style={{ aspectRatio: '1', borderRadius: 2 }}/>)}
        </div>
      </div>
      <div style={{ borderTop: '1px solid var(--line-2)', padding: '8px 16px', fontSize: 8, color: 'var(--ink-3)', textAlign: 'center' }}>
        Página 1 · alquiloya.com.py
      </div>
    </div>
  );
}

function BrochurePage2() {
  return (
    <div style={{ background: '#fff', width: '50%', aspectRatio: '0.707', boxShadow: '0 20px 40px rgba(0,0,0,.3)', borderRadius: 4, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: 'var(--blue)', color: '#fff', padding: '12px 16px' }}>
        <span style={{ fontFamily: 'Montserrat', fontWeight: 900, fontSize: 14, letterSpacing: '.04em' }}>ALQUILOYA</span>
      </div>
      <div style={{ padding: '14px 16px', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <div style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 12 }}>Características destacadas</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 6 }}>
            {['Aire acondicionado','Cocina equipada','Lavadero','Seguridad 24hs','Wifi','Termotanque'].map(f => (
              <div key={f} className="row gap-4" style={{ fontSize: 9, color: 'var(--ink-2)' }}>
                <I.check s={8}/> {f}
              </div>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 12 }}>Ubicación</div>
          <div style={{ marginTop: 6, borderRadius: 4, overflow: 'hidden' }}>
            <MiniMap height={90}/>
          </div>
        </div>
        <div style={{ marginTop: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
          <QRMock size={70} id="AY-01001"/>
          <div style={{ fontSize: 9, color: 'var(--ink-2)', flex: 1 }}>
            <div style={{ fontWeight: 700, marginBottom: 2 }}>Escaneá para ver online</div>
            <div className="muted" style={{ fontSize: 8 }}>Más fotos, calendario y contacto directo por WhatsApp</div>
          </div>
        </div>
        <div style={{ borderTop: '1px solid var(--line-2)', paddingTop: 8, fontSize: 8, color: 'var(--ink-3)', textAlign: 'center' }}>
          Mariana López · +595 981 555 102 · Página 2
        </div>
      </div>
    </div>
  );
}

function PreviewCard({ step }) {
  return (
    <div className="card" style={{ padding: 22 }}>
      <div className="tag">Vista previa</div>
      <div style={{ fontWeight: 700, fontSize: 15, marginTop: 6 }}>Así se va completando tu ficha</div>
      <div className="card" style={{ marginTop: 16, padding: 14, border: '1px dashed var(--line)' }}>
        <Photo src={photo(0)} style={{ height: 140, borderRadius: 8 }}/>
        <div style={{ marginTop: 12 }}>
          <div className="row gap-6">
            <span className="badge badge-soft">Borrador</span>
            {step >= 3 && <span className="badge badge-featured" style={{ fontSize: 10 }}>Premium</span>}
          </div>
          <div style={{ fontWeight: 700, fontSize: 14, marginTop: 6 }}>Dúplex moderno · Villa Morra</div>
          <div style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 16, color: 'var(--blue)', marginTop: 4 }}>Gs. 3.800.000<span style={{ fontSize: 11, color: 'var(--ink-3)' }}> /mes</span></div>
          <div className="row gap-12 muted" style={{ marginTop: 8, fontSize: 12 }}>
            <span><I.bed s={11}/> 2</span><span><I.bath s={11}/> 2</span><span><I.ruler s={11}/> 85m²</span>
          </div>
        </div>
      </div>
      <div className="col gap-10" style={{ marginTop: 18, fontSize: 13 }}>
        {['Datos básicos','Ubicación','Fotos','Plan','Vista previa'].map((s, i) => (
          <div key={s} className="row gap-8" style={{ color: step >= i ? 'var(--ink)' : 'var(--ink-4)' }}>
            <span style={{ width: 16, height: 16, borderRadius: '50%', background: step > i ? 'var(--blue)' : step === i ? 'var(--yellow)' : 'var(--bg-3)', color: '#fff', display: 'grid', placeItems: 'center' }}>
              {step > i && <I.check s={10}/>}
            </span>
            {s}
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { PublishPage, BrochurePreviewModal });
