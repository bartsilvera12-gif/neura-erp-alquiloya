// Publicar inmueble — wizard 5 pasos

function PublishPage() {
  const [step, setStep] = React.useState(0);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  // Detectar contexto: si entra desde el panel agente/propietario logueado,
  // ocultar la card "Querés ayuda de un agente" y pre-seleccionar el plan.
  const [ctxAgente, setCtxAgente] = React.useState(null); // {id, nombre, plan_publicacion_id, plan_tier}
  const [ctxPropietario, setCtxPropietario] = React.useState(null);
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/agente/me', { cache: 'no-store', credentials: 'include' });
        if (r.ok) {
          const b = await r.json();
          if (!cancelled && b?.agente) { setCtxAgente(b.agente); return; }
        }
      } catch { /* ignore */ }
      try {
        const r2 = await fetch('/api/propietario/me', { cache: 'no-store', credentials: 'include' });
        if (r2.ok) {
          const b2 = await r2.json();
          if (!cancelled && b2?.propietario) setCtxPropietario(b2.propietario);
        }
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, []);
  const isLoggedPublisher = !!(ctxAgente || ctxPropietario);
  // Fase Publicar-1: wizard de 5 pasos (sin "Gestión").
  const steps = [
    { id: 0, title: 'Datos básicos', icon: 'doc' },
    { id: 1, title: 'Ubicación', icon: 'pin' },
    { id: 2, title: 'Fotos', icon: 'upload' },
    { id: 3, title: 'Plan', icon: 'star' },
    { id: 4, title: 'Vista previa', icon: 'eye' },
  ];

  // ── Estado controlado del wizard ─────────────────────────────────────────
  const [form, setForm] = React.useState({
    titulo: '',
    tipo: 'departamento',
    operacion: 'alquiler', // 'alquiler' | 'venta'
    precio: '',
    moneda: 'PYG',
    descripcion: '',
    dormitorios: '',
    banos: '',
    cocheras: '',
    superficie_m2: '',
    terreno_m2: '',
    // ubicación
    ciudad: '',
    barrio: '',
    direccion: '',
    lat: null,
    lng: null,
    // fotos: lista de { url, alt, es_portada }
    fotos: [],
    // características: array de string nombre
    caracteristicas: [],
    // plan
    plan_id: null,
    // contacto propietario (movido aquí desde "Gestión")
    propietario_nombre: '',
    propietario_email: '',
    propietario_telefono: '',
  });
  const setF = React.useCallback((patch) => setForm(f => Object.assign({}, f, typeof patch === 'function' ? patch(f) : patch)), []);

  // Asesoría agente — opcional, no parte del wizard. Disponible vía card lateral.
  const [pickedAgentId, setPickedAgentId] = React.useState(null);
  const [asesoriaPropietario, setAsesoriaPropietario] = React.useState({
    nombre: '', email: '', telefono: '',
    propiedad_titulo: '', tipo_propiedad: 'departamento',
    ciudad: '', barrio: '', mensaje: '',
  });
  const [asesoriaOpen, setAsesoriaOpen] = React.useState(false);
  const [submitState, setSubmitState] = React.useState({ loading: false, error: null, success: null });

  function validateAll() {
    if (!(form.titulo || '').trim()) return 'Título obligatorio.';
    if (!(form.tipo || '').trim()) return 'Tipo obligatorio.';
    if (!(form.ciudad || '').trim()) return 'Ciudad obligatoria.';
    const precio = Number(String(form.precio).replace(/[^\d.]/g, ''));
    if (!Number.isFinite(precio) || precio <= 0) return 'Precio obligatorio.';
    if (!(form.propietario_nombre || '').trim()) return 'Tu nombre es obligatorio.';
    if (!(form.propietario_email || '').trim() && !(form.propietario_telefono || '').trim()) {
      return 'Dejá email o teléfono para que te contactemos.';
    }
    return null;
  }

  async function onEnviar() {
    setSubmitState({ loading: false, error: null, success: null });
    const err = validateAll();
    if (err) { setSubmitState({ loading: false, error: err, success: null }); return; }
    setSubmitState({ loading: true, error: null, success: null });
    try {
      const precio = Number(String(form.precio).replace(/[^\d.]/g, ''));
      const payload = {
        titulo: form.titulo,
        tipo: form.tipo,
        operacion: form.operacion,
        descripcion: form.descripcion || null,
        ciudad: form.ciudad,
        barrio: form.barrio || null,
        direccion: form.direccion || null,
        lat: typeof form.lat === 'number' ? form.lat : null,
        lng: typeof form.lng === 'number' ? form.lng : null,
        precio,
        moneda: form.moneda || 'PYG',
        dormitorios: form.dormitorios ? Number(form.dormitorios) : null,
        banos: form.banos ? Number(form.banos) : null,
        cocheras: form.cocheras ? Number(form.cocheras) : null,
        superficie_m2: form.superficie_m2 ? Number(form.superficie_m2) : null,
        terreno_m2: form.terreno_m2 ? Number(form.terreno_m2) : null,
        fotos: (form.fotos || []).filter(f => (f && f.url || '').trim()),
        caracteristicas: (form.caracteristicas || []).map(n => ({ nombre: n })),
        propietario_nombre: form.propietario_nombre,
        propietario_email: form.propietario_email || null,
        propietario_telefono: form.propietario_telefono || null,
        plan_publicacion_id: form.plan_id || null,
      };
      const res = await fetch('/api/public/alquiloya/propiedades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || ('HTTP ' + res.status));
      setSubmitState({ loading: false, error: null, success: data });
    } catch (e) {
      setSubmitState({ loading: false, error: (e && e.message) || 'No se pudo enviar.', success: null });
    }
  }
  return (
    <div className="fade-in container" style={{ padding: '32px' }}>
      <div className="row between">
        <div>
          <div className="tag">Publicar inmueble</div>
          <h2 style={{ marginTop: 6, fontSize: 30 }}>Cargá tu propiedad en 5 pasos</h2>
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
          {step === 0 && <StepBasics form={form} setF={setF}/>}
          {step === 1 && <StepLocation form={form} setF={setF}/>}
          {step === 2 && <StepPhotos form={form} setF={setF} isAgent={!!ctxAgente}/>}
          {step === 3 && <StepPlan form={form} setF={setF} ctxAgente={ctxAgente} ctxPropietario={ctxPropietario}/>}
          {step === 4 && <StepPreview form={form} setF={setF}/>}

          {submitState.success && (
            <div style={{ marginTop: 16, padding: 16, background: '#eaf6f0', borderRadius: 12, border: '1px solid #b6dec6', color: '#1f5e3a', fontSize: 14 }}>
              ✓ Tu propiedad fue enviada para revisión. El equipo de AlquiloYa la revisará antes de publicarla.
              {submitState.success.codigo ? <div className="muted xs" style={{ marginTop: 6 }}>Código: <strong>{submitState.success.codigo}</strong></div> : null}
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
                  disabled={submitState.loading || !!submitState.success}
                  onClick={() => {
                    const err = validateAll();
                    if (err) { setSubmitState({ loading: false, error: err, success: null }); return; }
                    setConfirmOpen(true);
                  }}
                  style={(submitState.loading || submitState.success) ? { opacity: 0.6, cursor: submitState.loading ? 'wait' : 'default' } : null}
                >
                  {submitState.loading ? 'Enviando…' : (submitState.success ? 'Enviado ✓' : 'Enviar para revisión')}
                  <I.check s={16}/>
                </button>
              )}
            </div>
          </div>
        </div>

        <div style={{ position: 'sticky', top: 92, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!isLoggedPublisher && <AsesoriaCTACard onOpen={() => setAsesoriaOpen(true)}/>}
          <PreviewCard step={step} form={form}/>
        </div>
      </div>

      {asesoriaOpen && (
        <AsesoriaModal
          onClose={() => setAsesoriaOpen(false)}
          propietario={asesoriaPropietario}
          setPropietario={setAsesoriaPropietario}
          pickedAgentId={pickedAgentId}
          setPickedAgentId={setPickedAgentId}
          onAfterSuccess={() => { setAsesoriaOpen(false); }}
        />
      )}

      {confirmOpen && (
        <ConfirmPublishModal
          form={form}
          loading={submitState.loading}
          isAgent={!!ctxAgente}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={async () => {
            await onEnviar();
            setConfirmOpen(false);
          }}
        />
      )}
    </div>
  );
}

// Card siempre visible en la columna derecha del wizard.
// Abre el modal de asesoría desde cualquier paso (1..6).
function AsesoriaCTACard({ onOpen }) {
  return (
    <div className="card" style={{
      padding: 18,
      background: 'linear-gradient(135deg, var(--blue-50), #fff)',
      border: '1px solid var(--blue-100)',
    }}>
      <div className="row gap-10" style={{ alignItems: 'flex-start' }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'var(--blue)', color: '#fff',
          display: 'grid', placeItems: 'center', flexShrink: 0,
        }}>
          <I.shield s={18}/>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 15, lineHeight: 1.25 }}>
            ¿Querés ayuda de un agente inmobiliario?
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 6, lineHeight: 1.45 }}>
            Un agente de AlquiloYa puede ayudarte a revisar, publicar y gestionar tu propiedad.
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="btn btn-blue"
        style={{ marginTop: 14, width: '100%', justifyContent: 'center' }}
      >
        Solicitar asesoría <I.arrow s={14}/>
      </button>
    </div>
  );
}

// Modal full-screen con selector de agentes + form de contacto + POST captación.
function AsesoriaModal({ onClose, propietario, setPropietario, pickedAgentId, setPickedAgentId, onAfterSuccess }) {
  const [apiAgents, setApiAgents] = React.useState(null);
  const [filter, setFilter] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/public/alquiloya/agentes', { cache: 'no-store' });
        const body = await r.json().catch(() => ({}));
        if (cancelled) return;
        const list = (body && body.data && Array.isArray(body.data.agentes)) ? body.data.agentes : [];
        setApiAgents(list);
      } catch (_) { if (!cancelled) setApiAgents([]); }
    })();
    return () => { cancelled = true; };
  }, []);

  const sourceList = apiAgents
    ? apiAgents.map(a => ({
        id: a.id,
        name: a.nombre || '—',
        cargo: a.cargo || null,
        telefono: a.telefono || null,
        whatsapp: a.whatsapp || null,
        propiedades: typeof a.propiedades_count === 'number' ? a.propiedades_count : null,
        activo: !!a.activo,
      }))
    : [];
  const filtered = sourceList.filter(a =>
    !filter || (a.name || '').toLowerCase().includes(filter.toLowerCase()) || (a.cargo || '').toLowerCase().includes(filter.toLowerCase())
  );

  const upd = (k, v) => setPropietario(p => Object.assign({}, p, { [k]: v }));

  async function onEnviar() {
    setErr(null);
    if (!pickedAgentId) { setErr('Elegí un agente.'); return; }
    if (!(propietario.nombre || '').trim()) { setErr('Tu nombre es obligatorio.'); return; }
    if (!(propietario.email || '').trim() && !(propietario.telefono || '').trim()) {
      setErr('Dejá un email o teléfono para que el agente te contacte.'); return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/public/alquiloya/captaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agente_id: pickedAgentId,
          propietario_nombre: propietario.nombre,
          propietario_email: propietario.email || null,
          propietario_telefono: propietario.telefono || null,
          propiedad_titulo: propietario.propiedad_titulo || null,
          tipo_propiedad: propietario.tipo_propiedad || null,
          ciudad: propietario.ciudad || null,
          barrio: propietario.barrio || null,
          mensaje: propietario.mensaje || null,
          origen: 'wizard_publicar_asesoria',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || ('HTTP ' + res.status));
      onAfterSuccess && onAfterSuccess();
    } catch (e) {
      setErr((e && e.message) || 'No se pudo enviar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(11,22,34,.5)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 720, maxHeight: '90vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div className="row between" style={{ padding: '16px 20px', borderBottom: '1px solid var(--line-2)' }}>
          <div>
            <div style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 17 }}>¿Querés ayuda de un agente?</div>
            <div className="muted xs" style={{ marginTop: 2 }}>Elegí un agente y dejanos tus datos. El agente te contacta.</div>
          </div>
          <button onClick={onClose} className="btn btn-outline btn-sm" style={{ padding: '6px 10px' }} aria-label="Cerrar">✕</button>
        </div>

        <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
          {/* Lista agentes */}
          <div className="row between" style={{ marginBottom: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 13.5 }}>Elegí un agente</div>
            <input
              className="input"
              placeholder="Buscar…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={{ width: 200, padding: '6px 10px', fontSize: 13 }}
            />
          </div>
          {apiAgents === null ? (
            <div className="muted xs" style={{ padding: 20, textAlign: 'center' }}>Cargando agentes…</div>
          ) : filtered.length === 0 ? (
            <div className="muted xs" style={{ padding: 20, textAlign: 'center' }}>No hay agentes disponibles ahora.</div>
          ) : (
            <div className="col gap-8" style={{ maxHeight: 220, overflowY: 'auto', paddingRight: 4, marginBottom: 18 }}>
              {filtered.map(a => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setPickedAgentId(a.id)}
                  className="card"
                  style={{
                    padding: 12, textAlign: 'left', cursor: 'pointer',
                    border: '2px solid ' + (pickedAgentId === a.id ? 'var(--blue)' : 'var(--line)'),
                    background: pickedAgentId === a.id ? 'var(--blue-50)' : '#fff',
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}
                >
                  <Avatar name={a.name} size={36}/>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="row gap-6" style={{ alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{a.name}</span>
                      {a.activo && <span className="badge badge-verified" style={{ fontSize: 9.5 }}><I.check s={9}/> Verificado</span>}
                    </div>
                    <div className="muted xs" style={{ marginTop: 2 }}>
                      {a.cargo ? <span>{a.cargo}</span> : null}
                      {(a.telefono || a.whatsapp) ? <span> · {a.telefono || a.whatsapp}</span> : null}
                      {typeof a.propiedades === 'number' ? <span> · {a.propiedades} propiedad{a.propiedades === 1 ? '' : 'es'}</span> : null}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Datos contacto */}
          <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 10 }}>Tus datos de contacto</div>
          <FormGrid>
            <div className="field">
              <label>Tu nombre *</label>
              <input className="input" value={propietario.nombre} onChange={(e) => upd('nombre', e.target.value)} placeholder="Nombre y apellido"/>
            </div>
            <div className="field">
              <label>Email</label>
              <input className="input" type="email" value={propietario.email} onChange={(e) => upd('email', e.target.value)} placeholder="usuario@dominio.com"/>
            </div>
            <div className="field">
              <label>Teléfono / WhatsApp</label>
              <input className="input" value={propietario.telefono} onChange={(e) => upd('telefono', e.target.value)} placeholder="+595 ..."/>
            </div>
            <div className="field">
              <label>Ciudad</label>
              <input className="input" value={propietario.ciudad} onChange={(e) => upd('ciudad', e.target.value)} placeholder="Asunción…"/>
            </div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>Título de la propiedad (opcional)</label>
              <input className="input" value={propietario.propiedad_titulo} onChange={(e) => upd('propiedad_titulo', e.target.value)} placeholder="Dúplex moderno…"/>
            </div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>Mensaje al agente (opcional)</label>
              <textarea className="input" value={propietario.mensaje} onChange={(e) => upd('mensaje', e.target.value)} rows={3} placeholder="Contale lo que necesitás"/>
            </div>
          </FormGrid>
          <div className="muted xs" style={{ marginTop: 10 }}>Dejá al menos email o teléfono para que el agente pueda contactarte.</div>

          {err && (
            <div style={{ marginTop: 12, padding: 10, background: '#fdecec', borderRadius: 10, border: '1px solid #f3c2c2', color: '#a8312f', fontSize: 13 }}>
              {err}
            </div>
          )}
        </div>

        <div className="row between" style={{ padding: '14px 20px', borderTop: '1px solid var(--line-2)' }}>
          <button onClick={onClose} className="btn btn-outline">Cancelar</button>
          <button
            onClick={onEnviar}
            disabled={busy}
            className="btn btn-primary"
            style={busy ? { opacity: 0.6, cursor: 'wait' } : null}
          >
            {busy ? 'Enviando…' : 'Enviar solicitud al agente'} <I.check s={14}/>
          </button>
        </div>
      </div>
    </div>
  );
}

function FormGrid({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>{children}</div>;
}

const PUBLISH_TIPOS = [
  { id: 'departamento',     label: 'Departamento',     icon: 'building' },
  { id: 'casa',             label: 'Casa',             icon: 'home' },
  { id: 'duplex',           label: 'Dúplex',           icon: 'building' },
  { id: 'local_comercial',  label: 'Local comercial',  icon: 'store' },
  { id: 'oficina',          label: 'Oficina',          icon: 'briefcase' },
  { id: 'terreno',          label: 'Terreno',          icon: 'pin' },
  { id: 'deposito',         label: 'Depósito',         icon: 'archive' },
];
const PUBLISH_CARAC = ['Cochera','Amoblado','Mascotas permitidas','Piscina','Quincho','Aire acondicionado','Wifi','Lavadero','Seguridad 24hs','Cocina equipada'];

function StepBasics({ form, setF }) {
  function toggleCarac(name) {
    setF(f => {
      const has = (f.caracteristicas || []).includes(name);
      const next = has ? f.caracteristicas.filter(x => x !== name) : [...(f.caracteristicas || []), name];
      return { caracteristicas: next };
    });
  }
  return (
    <div>
      <div className="tag">Paso 1</div>
      <h3 style={{ fontSize: 22, marginTop: 6 }}>Datos básicos de tu propiedad</h3>
      <p className="muted" style={{ fontSize: 14, marginTop: 6 }}>Completá la información principal del inmueble.</p>
      <div style={{ marginTop: 24 }}>
        <div className="field" style={{ marginBottom: 18 }}>
          <label>Tipo de inmueble</label>
          <div className="row gap-10" style={{ flexWrap: 'wrap' }}>
            {PUBLISH_TIPOS.map(t => (
              <TileChoice
                key={t.id}
                icon={I[t.icon] ? t.icon : 'doc'}
                label={t.label}
                active={form.tipo === t.id}
                onClick={() => setF({ tipo: t.id })}
              />
            ))}
          </div>
        </div>
        <div className="field" style={{ marginBottom: 18 }}>
          <label>Título de la publicación</label>
          <input className="input" value={form.titulo} onChange={(e) => setF({ titulo: e.target.value })} placeholder="Ej. Dúplex moderno con balcón en Villa Morra" maxLength={120}/>
          <span className="muted xs">Sé claro y específico.</span>
        </div>
        <FormGrid>
          <div className="field">
            <label>Precio (Gs.)</label>
            <input className="input" value={form.precio} onChange={(e) => setF({ precio: e.target.value.replace(/[^\d]/g, '') })} placeholder="Ej. 3800000" inputMode="numeric"/>
          </div>
          <div className="field">
            <label>Operación</label>
            <PrettySelect value={form.operacion} onChange={(v) => setF({ operacion: v })} options={[
              { value: 'alquiler', label: 'Alquiler' },
              { value: 'venta',    label: 'Venta' },
            ]}/>
          </div>
        </FormGrid>
        <div style={{ height: 18 }}/>
        <FormGrid>
          <div className="field"><label>Dormitorios</label><input className="input" value={form.dormitorios} onChange={(e) => setF({ dormitorios: e.target.value.replace(/[^\d]/g,'') })} inputMode="numeric"/></div>
          <div className="field"><label>Baños</label><input className="input" value={form.banos} onChange={(e) => setF({ banos: e.target.value.replace(/[^\d]/g,'') })} inputMode="numeric"/></div>
          <div className="field"><label>Superficie (m²)</label><input className="input" value={form.superficie_m2} onChange={(e) => setF({ superficie_m2: e.target.value.replace(/[^\d.]/g,'') })} inputMode="decimal"/></div>
          <div className="field"><label>Cocheras</label><input className="input" value={form.cocheras} onChange={(e) => setF({ cocheras: e.target.value.replace(/[^\d]/g,'') })} inputMode="numeric"/></div>
        </FormGrid>
        <div className="field" style={{ marginTop: 18 }}>
          <label>Características</label>
          <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
            {PUBLISH_CARAC.map(name => (
              <Chip key={name} label={name} active={(form.caracteristicas || []).includes(name)} onClick={() => toggleCarac(name)}/>
            ))}
          </div>
        </div>
        <div className="field" style={{ marginTop: 18 }}>
          <label>Descripción</label>
          <textarea className="input" rows={4} value={form.descripcion} onChange={(e) => setF({ descripcion: e.target.value })} placeholder="Detalles del inmueble (ambientes, servicios, comodidades, etc.)"/>
        </div>
      </div>
    </div>
  );
}

function TileChoice({ icon, label, active, onClick }) {
  return (
    <button type="button" onClick={onClick} style={{
      padding: '8px 12px', borderRadius: 10,
      border: '1.5px solid ' + (active ? 'var(--blue)' : 'var(--line)'),
      background: active ? 'var(--blue-50)' : '#fff',
      cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7,
      color: active ? 'var(--blue)' : 'var(--ink-2)', fontWeight: 600, fontSize: 12.5,
      fontFamily: 'inherit', whiteSpace: 'nowrap',
    }}>
      {I[icon] ? React.createElement(I[icon], { s: 14 }) : null}
      {label}
    </button>
  );
}
function Chip({ label, active, onClick }) {
  return (
    <button type="button" onClick={onClick} style={{
      padding: '8px 14px', borderRadius: 999,
      border: '1px solid ' + (active ? 'var(--blue)' : 'var(--line)'),
      background: active ? 'var(--blue)' : '#fff',
      color: active ? '#fff' : 'var(--ink-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
      fontFamily: 'inherit',
    }}>{active && '✓ '}{label}</button>
  );
}

function StepLocation({ form, setF }) {
  return (
    <div>
      <div className="tag">Paso 2</div>
      <h3 style={{ fontSize: 22, marginTop: 6 }}>¿Dónde se encuentra tu inmueble?</h3>
      <p className="muted" style={{ fontSize: 14, marginTop: 6 }}>La ubicación exacta solo se compartirá cuando coordines una visita.</p>
      <div style={{ marginTop: 24 }}>
        <FormGrid>
          <div className="field"><label>Ciudad *</label><input className="input" value={form.ciudad} onChange={(e) => setF({ ciudad: e.target.value })} placeholder="Ej. Asunción"/></div>
          <div className="field"><label>Barrio</label><input className="input" value={form.barrio} onChange={(e) => setF({ barrio: e.target.value })} placeholder="Ej. Villa Morra"/></div>
        </FormGrid>
        <div className="field" style={{ marginTop: 18 }}>
          <label>Dirección (no se mostrará al público)</label>
          <input className="input" value={form.direccion} onChange={(e) => setF({ direccion: e.target.value })} placeholder="Ej. Mariscal López casi Capitán Brizuela"/>
        </div>
        <div className="field" style={{ marginTop: 18 }}>
          <label>Punto en el mapa</label>
          <div className="muted xs" style={{ marginBottom: 6 }}>Clic en el mapa para fijar la ubicación exacta. Podés arrastrar el pin.</div>
          <LeafletPickerWidget
            lat={form.lat}
            lng={form.lng}
            onChange={(lat, lng) => setF({ lat, lng })}
          />
        </div>
      </div>
    </div>
  );
}

function LeafletPickerWidget({ lat, lng, onChange }) {
  const ref = React.useRef(null);
  const mapRef = React.useRef(null);
  const markerRef = React.useRef(null);
  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.L) return;
    if (!ref.current || mapRef.current) return;
    const L = window.L;
    const init = (typeof lat === 'number' && typeof lng === 'number') ? [lat, lng] : [-25.2637, -57.5759];
    const m = L.map(ref.current).setView(init, (typeof lat === 'number' && typeof lng === 'number') ? 16 : 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
    }).addTo(m);
    if (typeof lat === 'number' && typeof lng === 'number') {
      markerRef.current = L.marker([lat, lng], { draggable: true }).addTo(m);
      markerRef.current.on('dragend', (e) => {
        const ll = e.target.getLatLng();
        onChange(Number(ll.lat.toFixed(6)), Number(ll.lng.toFixed(6)));
      });
    }
    m.on('click', (e) => {
      const nlat = Number(e.latlng.lat.toFixed(6));
      const nlng = Number(e.latlng.lng.toFixed(6));
      if (markerRef.current) {
        markerRef.current.setLatLng([nlat, nlng]);
      } else {
        markerRef.current = L.marker([nlat, nlng], { draggable: true }).addTo(m);
        markerRef.current.on('dragend', (ev) => {
          const ll = ev.target.getLatLng();
          onChange(Number(ll.lat.toFixed(6)), Number(ll.lng.toFixed(6)));
        });
      }
      onChange(nlat, nlng);
    });
    mapRef.current = m;
    return () => { try { m.remove(); } catch {} mapRef.current = null; markerRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div>
      <div ref={ref} style={{ height: 280, width: '100%', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--line)', background: 'var(--bg-2)' }}/>
      <div className="row between muted xs" style={{ marginTop: 6 }}>
        <span>
          {(typeof lat === 'number' && typeof lng === 'number')
            ? `Lat: ${lat}  ·  Lng: ${lng}`
            : 'Sin punto fijado'}
        </span>
        {(typeof lat === 'number' && typeof lng === 'number') && (
          <button type="button" onClick={() => {
            if (markerRef.current && mapRef.current) { try { mapRef.current.removeLayer(markerRef.current); } catch {} markerRef.current = null; }
            onChange(null, null);
          }} style={{ background: 'transparent', border: '1px solid var(--line)', borderRadius: 6, padding: '2px 8px', fontSize: 11, color: 'var(--ink-3)', cursor: 'pointer' }}>Quitar</button>
        )}
      </div>
    </div>
  );
}

function StepPhotos({ form, setF, isAgent }) {
  const [urlNew, setUrlNew] = React.useState('');
  const [mode, setMode] = React.useState(isAgent ? 'url' : 'file');
  const fileInputRef = React.useRef(null);
  function addFotoUrl() {
    const url = (urlNew || '').trim();
    if (!url) return;
    setF(f => ({ fotos: [...(f.fotos || []), { url, alt: f.titulo || '', es_portada: (f.fotos || []).length === 0 }] }));
    setUrlNew('');
  }
  function addFotoFiles(fileList) {
    const files = Array.from(fileList || []).filter(f => f && f.type && f.type.startsWith('image/'));
    if (files.length === 0) return;
    files.forEach(file => {
      if (file.size > 4 * 1024 * 1024) {
        window.alert('"' + file.name + '" supera los 4MB. Comprimila o subila como URL.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target && e.target.result;
        if (typeof dataUrl !== 'string') return;
        setF(f => ({ fotos: [...(f.fotos || []), { url: dataUrl, alt: f.titulo || '', es_portada: (f.fotos || []).length === 0 }] }));
      };
      reader.readAsDataURL(file);
    });
  }
  function removeFoto(idx) {
    setF(f => ({ fotos: (f.fotos || []).filter((_, i) => i !== idx) }));
  }
  const segBtn = (active) => ({
    padding: '8px 14px', borderRadius: 10, border: '1px solid ' + (active ? 'var(--blue)' : 'var(--line)'),
    background: active ? 'var(--blue-50)' : '#fff', cursor: 'pointer', fontFamily: 'inherit',
    fontSize: 13, fontWeight: 600, color: active ? 'var(--blue)' : 'var(--ink-2)'
  });
  return (
    <div>
      <div className="tag">Paso 3</div>
      <h3 style={{ fontSize: 22, marginTop: 6 }}>Sumá fotos de tu propiedad</h3>
      <p className="muted" style={{ fontSize: 14, marginTop: 6 }}>
        {isAgent
          ? 'Como agente, recomendamos pegar URLs de tu servidor de imágenes para no inflar la base. También podés subir desde dispositivo.'
          : 'Subí las fotos desde tu dispositivo (hasta 4 MB c/u). La primera será la principal.'}
      </p>

      <div className="row gap-8" style={{ marginTop: 14 }}>
        <button type="button" style={segBtn(mode === 'file')} onClick={() => setMode('file')}>Subir desde dispositivo</button>
        <button type="button" style={segBtn(mode === 'url')} onClick={() => setMode('url')}>Pegar URL</button>
      </div>

      {mode === 'file' ? (
        <div className="card" style={{ padding: 18, marginTop: 14, background: 'var(--bg-2)', border: '1px dashed var(--line)', textAlign: 'center' }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => { addFotoFiles(e.target.files); e.target.value = ''; }}
          />
          <button type="button" className="btn btn-blue" onClick={() => fileInputRef.current && fileInputRef.current.click()}>
            <I.plus s={14}/> Elegir fotos
          </button>
          <div className="muted xs" style={{ marginTop: 8 }}>JPG / PNG / WebP — máx. 4 MB cada una</div>
        </div>
      ) : (
        <div className="card" style={{ padding: 14, marginTop: 14, background: 'var(--bg-2)', border: '1px dashed var(--line)' }}>
          <div className="row gap-8">
            <input
              className="input"
              placeholder="https://..."
              value={urlNew}
              onChange={(e) => setUrlNew(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addFotoUrl(); } }}
            />
            <button type="button" className="btn btn-blue" onClick={addFotoUrl}>+ Agregar</button>
          </div>
          <div className="muted xs" style={{ marginTop: 6 }}>Servidor de imágenes propio, Google Drive o Imgur con enlace público.</div>
        </div>
      )}
      {(form.fotos || []).length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 18 }}>
          {form.fotos.map((f, i) => (
            <div key={i} style={{ position: 'relative' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.url} alt={f.alt || ''} style={{ width: '100%', height: 130, objectFit: 'cover', borderRadius: 10, background: 'var(--bg-2)' }} onError={(e) => { e.currentTarget.style.opacity = '0.3'; }}/>
              {i === 0 && <span className="badge badge-featured" style={{ position: 'absolute', top: 8, left: 8 }}>Principal</span>}
              <button type="button" onClick={() => removeFoto(i)} style={{ position: 'absolute', top: 8, right: 8, width: 26, height: 26, borderRadius: '50%', background: 'rgba(255,255,255,.95)', border: 'none', cursor: 'pointer' }}>
                <I.x s={12}/>
              </button>
            </div>
          ))}
        </div>
      )}
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

  // Normalizamos la fuente: real (API) trae {id,nombre,telefono,whatsapp,foto_url,cargo,bio,activo,propiedades_count?}.
  // Si no hay datos reales, usamos el mock AGENTS para preservar la demo visual.
  const sourceList = apiAgents
    ? apiAgents.map(a => ({
        id: a.id,
        name: a.nombre || '—',
        zone: a.cargo || '',
        cargo: a.cargo || null,
        telefono: a.telefono || null,
        whatsapp: a.whatsapp || null,
        propiedades: typeof a.propiedades_count === 'number' ? a.propiedades_count : null,
        verified: !!a.activo,
        level: 'Pro',
        rating: 4.8,
        reviews: 0,
        activeProperties: typeof a.propiedades_count === 'number' ? a.propiedades_count : 0,
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
      <div className="tag">Paso 4 — Gestión</div>
      <h3 style={{ fontSize: 22, marginTop: 6 }}>¿Querés asesoría de un agente inmobiliario?</h3>
      <p className="muted" style={{ fontSize: 14, marginTop: 6 }}>
        Podés publicar tu propiedad por tu cuenta o pedir que te asesore un agente verificado.
        Si elegís asesoría, el agente se contacta con vos para gestionar visitas, consultas y cierre — y recibe comisión solo si se concreta el alquiler.
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
              <div style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 14.5, lineHeight: 1.25 }}>No, quiero publicar por mi cuenta</div>
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
              <div style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 14.5, lineHeight: 1.25 }}>Sí, quiero que me asesore un agente</div>
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
                      {a._real ? (
                        <span>
                          {a.cargo ? <span>{a.cargo}</span> : null}
                          {(a.telefono || a.whatsapp) ? <span> · <I.whats s={10}/> {a.telefono || a.whatsapp}</span> : null}
                          {typeof a.propiedades === 'number' ? <span> · {a.propiedades} propiedad{a.propiedades === 1 ? '' : 'es'}</span> : null}
                        </span>
                      ) : (
                        <span><I.pin s={11}/> {a.zone} · {a.activeProperties} activas · {a.closedRentals} cerradas</span>
                      )}
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

function StepPlan({ form, setF, ctxAgente, ctxPropietario }) {
  const [apiPlans, setApiPlans] = React.useState(null);
  React.useEffect(() => {
    let cancelled = false;
    fetch('/api/public/alquiloya/planes-publicacion', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : Promise.reject(new Error('http ' + r.status)))
      .then(body => {
        if (cancelled) return;
        const arr = body && body.success && body.data && Array.isArray(body.data.planes) ? body.data.planes : null;
        if (!arr || arr.length === 0) return;
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
        setApiPlans(mapped);
        // Pre-seleccionar el plan del perfil si lo trae el contexto.
        const ctxPlanId = (ctxAgente && ctxAgente.plan_publicacion_id) || (ctxPropietario && ctxPropietario.plan_publicacion_id);
        if (ctxPlanId && !form.plan_id) {
          const match = arr.find(p => p.id === ctxPlanId);
          if (match) setF({ plan_id: match.tier });
        }
      })
      .catch(() => { /* fallback PLANS mock */ });
    return () => { cancelled = true; };
  }, [ctxAgente, ctxPropietario]);
  const source = apiPlans || PLANS;
  // Si entró como agente, mostramos planes 'agent'. Si propietario o anónimo, 'owner'.
  const audience = ctxAgente ? 'agent' : 'owner';
  const list = source.filter(p => p.tier && String(p.tier).includes(audience));
  return (
    <div>
      <div className="tag">Paso 4</div>
      <h3 style={{ fontSize: 22, marginTop: 6 }}>Elegí un plan para tu publicación</h3>
      <p className="muted" style={{ fontSize: 14, marginTop: 6 }}>Podés cambiar de plan más adelante.</p>
      <div className="col gap-12" style={{ marginTop: 20 }}>
        {list.map(p => {
          const picked = form.plan_id === p.tier;
          return (
            <button key={p.tier} type="button" onClick={() => setF({ plan_id: p.tier })} className="card" style={{
              padding: 18, textAlign: 'left',
              border: '2px solid ' + (picked ? 'var(--blue)' : 'var(--line)'),
              background: picked ? 'var(--blue-50)' : '#fff',
              cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16
            }}>
              <div className="row gap-14">
                <span style={{
                  width: 22, height: 22, borderRadius: '50%',
                  border: '2px solid ' + (picked ? 'var(--blue)' : 'var(--line)'),
                  background: picked ? 'var(--blue)' : '#fff',
                  display: 'grid', placeItems: 'center', color: '#fff'
                }}>{picked && <I.check s={12}/>}</span>
                <div>
                  <div className="row gap-8">
                    <div style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 17 }}>{p.name}</div>
                    {p.badge && <span className="badge badge-featured" style={{ fontSize: 10 }}>{p.badge}</span>}
                  </div>
                  <div className="muted xs">{(p.bullets || [])[0]} {(p.bullets || [])[1] ? '· ' + p.bullets[1] : ''}</div>
                </div>
              </div>
              <div style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 20, color: 'var(--blue)', textAlign: 'right' }}>
                {p.billing === 'gratis' ? 'Gratis' : formatGs(p.price)}
                {p.billing === 'mensual' && <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--ink-3)' }}>/ mes</div>}
                {p.billing === 'unico' && <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--ink-3)' }}>pago único</div>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepPreview({ form, setF }) {
  const titulo = form.titulo || 'Tu propiedad';
  const ubic = [form.barrio, form.ciudad].filter(Boolean).join(', ') || 'Ubicación';
  const precioNum = Number(String(form.precio).replace(/[^\d.]/g, ''));
  const cover = (form.fotos || []).find(f => f && f.url);
  return (
    <div>
      <div className="tag">Paso 5</div>
      <h3 style={{ fontSize: 22, marginTop: 6 }}>Revisá tu publicación y dejá tu contacto</h3>
      <p className="muted" style={{ fontSize: 14, marginTop: 6 }}>
        Cuando envíes la propiedad, queda pendiente de revisión. El equipo de AlquiloYa la valida antes de publicarla.
      </p>

      <div className="card" style={{ marginTop: 18, padding: 0, overflow: 'hidden' }}>
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover.url} alt={titulo} style={{ width: '100%', height: 240, objectFit: 'cover', display: 'block', background: 'var(--bg-2)' }} onError={(e) => { e.currentTarget.style.opacity = '0.3'; }}/>
        ) : (
          <div style={{ height: 240, background: 'var(--bg-2)', display: 'grid', placeItems: 'center', color: 'var(--ink-4)', fontSize: 13 }}>Sin foto principal</div>
        )}
        <div style={{ padding: 22 }}>
          <div className="row gap-8">
            <span className="badge badge-verified"><I.check s={11}/> Pendiente de revisión</span>
          </div>
          <h3 style={{ marginTop: 10, fontSize: 22 }}>{titulo}</h3>
          <div className="muted" style={{ marginTop: 4, fontSize: 13 }}><I.pin s={13}/> {ubic}</div>
          {Number.isFinite(precioNum) && precioNum > 0 ? (
            <div style={{ fontFamily: 'Montserrat', fontWeight: 900, fontSize: 28, color: 'var(--blue)', marginTop: 12 }}>
              {formatGs(precioNum)}
              <span style={{ fontSize: 13, color: 'var(--ink-3)', fontWeight: 500 }}>
                {form.operacion === 'venta' ? '' : ' / mes'}
              </span>
            </div>
          ) : null}
          {(form.caracteristicas || []).length > 0 ? (
            <div className="row gap-6" style={{ flexWrap: 'wrap', marginTop: 14 }}>
              {form.caracteristicas.map(n => <span key={n} className="badge" style={{ background: 'var(--blue-50)', color: 'var(--blue)', fontSize: 11 }}>{n}</span>)}
            </div>
          ) : null}
        </div>
      </div>

      <div className="card" style={{ marginTop: 18, padding: 18 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Tus datos de contacto *</div>
        <FormGrid>
          <div className="field">
            <label>Tu nombre *</label>
            <input className="input" value={form.propietario_nombre} onChange={(e) => setF({ propietario_nombre: e.target.value })} placeholder="Nombre y apellido"/>
          </div>
          <div className="field">
            <label>Email</label>
            <input type="email" className="input" value={form.propietario_email} onChange={(e) => setF({ propietario_email: e.target.value })} placeholder="usuario@dominio.com"/>
          </div>
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label>Teléfono / WhatsApp</label>
            <input className="input" value={form.propietario_telefono} onChange={(e) => setF({ propietario_telefono: e.target.value })} placeholder="+595 ..."/>
          </div>
        </FormGrid>
        <div className="muted xs" style={{ marginTop: 8 }}>Dejá al menos email o teléfono para que el equipo de AlquiloYa pueda contactarte.</div>
      </div>

      <div style={{ marginTop: 16, padding: 18, background: 'var(--yellow-50)', borderRadius: 12, fontSize: 13.5, color: '#8a5e00' }}>
        <I.bolt s={14}/> Al enviar, tu inmueble entra en revisión. NO se publica automáticamente en el catálogo público.
      </div>
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

function PreviewCard({ step, form }) {
  const f = form || {};
  const titulo = (f.titulo || '').trim() || 'Tu propiedad';
  const ubic = [f.barrio, f.ciudad].filter(Boolean).join(', ') || 'Ubicación';
  const precioNum = Number(String(f.precio || '').replace(/[^\d.]/g, ''));
  const cover = (f.fotos || []).find(x => x && x.url);
  return (
    <div className="card" style={{ padding: 22 }}>
      <div className="tag">Vista previa</div>
      <div style={{ fontWeight: 700, fontSize: 15, marginTop: 6 }}>Así se va completando tu ficha</div>
      <div className="card" style={{ marginTop: 16, padding: 14, border: '1px dashed var(--line)' }}>
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover.url} alt={titulo} style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 8, background: 'var(--bg-2)' }} onError={(e) => { e.currentTarget.style.opacity = '0.3'; }}/>
        ) : (
          <div style={{ height: 140, background: 'var(--bg-2)', borderRadius: 8, display: 'grid', placeItems: 'center', color: 'var(--ink-4)', fontSize: 12 }}>Sin foto</div>
        )}
        <div style={{ marginTop: 12 }}>
          <div className="row gap-6">
            <span className="badge badge-soft">Borrador</span>
          </div>
          <div style={{ fontWeight: 700, fontSize: 14, marginTop: 6 }}>{titulo}</div>
          <div className="muted xs" style={{ marginTop: 2 }}>{ubic}</div>
          {Number.isFinite(precioNum) && precioNum > 0 ? (
            <div style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 16, color: 'var(--blue)', marginTop: 6 }}>
              {formatGs(precioNum)}
              <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{f.operacion === 'venta' ? '' : ' /mes'}</span>
            </div>
          ) : null}
          {(f.dormitorios || f.banos || f.superficie_m2) ? (
            <div className="row gap-12 muted" style={{ marginTop: 8, fontSize: 12 }}>
              {f.dormitorios ? <span><I.bed s={11}/> {f.dormitorios}</span> : null}
              {f.banos ? <span><I.bath s={11}/> {f.banos}</span> : null}
              {f.superficie_m2 ? <span><I.ruler s={11}/> {f.superficie_m2}m²</span> : null}
            </div>
          ) : null}
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

function ConfirmPublishModal({ form, loading, isAgent, onCancel, onConfirm }) {
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !loading) onCancel(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [loading, onCancel]);
  const cover = (form.fotos || []).find(f => f && f.url);
  const precioNum = Number(String(form.precio || '').replace(/[^\d.]/g, ''));
  const ubic = [form.barrio, form.ciudad].filter(Boolean).join(', ');
  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget && !loading) onCancel(); }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(11,22,34,.55)', zIndex: 1000,
        display: 'grid', placeItems: 'center', padding: 20, overflowY: 'auto',
      }}
    >
      <div className="card" style={{ maxWidth: 520, width: '100%', padding: 0, background: '#fff', borderRadius: 20, overflow: 'hidden' }}>
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover.url} alt={form.titulo || ''} style={{ width: '100%', height: 180, objectFit: 'cover', display: 'block', background: 'var(--bg-2)' }}/>
        ) : (
          <div style={{ height: 140, background: 'linear-gradient(135deg, var(--blue-50), var(--bg-2))', display: 'grid', placeItems: 'center', color: 'var(--ink-4)', fontSize: 13 }}>Sin foto principal</div>
        )}
        <div style={{ padding: 22 }}>
          <div className="tag" style={{ color: 'var(--yellow-600)' }}>Confirmá tu publicación</div>
          <h3 style={{ fontSize: 22, marginTop: 6 }}>{form.titulo || 'Tu propiedad'}</h3>
          {ubic && <div className="muted" style={{ marginTop: 4, fontSize: 13 }}><I.pin s={13}/> {ubic}</div>}
          {Number.isFinite(precioNum) && precioNum > 0 && (
            <div style={{ fontFamily: 'Montserrat', fontWeight: 900, fontSize: 24, color: 'var(--blue)', marginTop: 10 }}>
              {formatGs(precioNum)}
              <span style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 500 }}>
                {form.operacion === 'venta' ? '' : ' / mes'}
              </span>
            </div>
          )}
          <div className="row gap-12 muted xs" style={{ marginTop: 10, flexWrap: 'wrap' }}>
            {form.dormitorios && <span><I.bed s={11}/> {form.dormitorios} dorm.</span>}
            {form.banos && <span><I.bath s={11}/> {form.banos} baños</span>}
            {form.superficie_m2 && <span><I.ruler s={11}/> {form.superficie_m2} m²</span>}
            {(form.fotos || []).length > 0 && <span><I.upload s={11}/> {form.fotos.length} foto{form.fotos.length > 1 ? 's' : ''}</span>}
          </div>
          <div style={{ marginTop: 18, padding: '12px 14px', borderRadius: 12, background: 'var(--bg-2)', border: '1px solid var(--line-2)', fontSize: 13, lineHeight: 1.45, color: 'var(--ink-2)' }}>
            {isAgent ? (
              <>Tu propiedad <strong>queda pendiente de revisión</strong> hasta que el equipo de AlquiloYa la apruebe. Una vez aprobada se publica en la web.</>
            ) : (
              <>Tu propiedad <strong>queda pendiente de revisión</strong>. Validamos los datos y te avisamos por WhatsApp/email cuando esté publicada. Suele tardar menos de 24 hs hábiles.</>
            )}
          </div>
          <div className="row gap-10" style={{ marginTop: 18, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-outline" onClick={onCancel} disabled={loading}>Volver a editar</button>
            <button type="button" className="btn btn-primary" onClick={onConfirm} disabled={loading}>
              {loading ? 'Enviando…' : 'Confirmar y enviar'}
              <I.check s={14}/>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { PublishPage, BrochurePreviewModal, ConfirmPublishModal });
