// Publicar inmueble — wizard 5 pasos

function PublishPage() {
  const [step, setStep] = React.useState(0);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  // Modo edicion: si admin.jsx guardo un id en window.__AY_EDIT_PROP_ID
  // antes de navegar, entramos a este wizard para EDITAR esa propiedad
  // (prefill del form + PATCH en lugar de POST). Lo levantamos UNA sola
  // vez al montar y limpiamos el global para que un ciclo siguiente no
  // arrastre el id viejo.
  const [editingId, setEditingId] = React.useState(() => {
    if (typeof window === 'undefined') return null;
    const id = window.__AY_EDIT_PROP_ID || null;
    try { window.__AY_EDIT_PROP_ID = null; } catch {}
    return id;
  });
  const [editLoading, setEditLoading] = React.useState(!!editingId);
  // Detectar contexto: si entra desde el panel agente/propietario logueado,
  // ocultar la card "Querés ayuda de un agente" y pre-seleccionar el plan.
  const [ctxAgente, setCtxAgente] = React.useState(null); // {id, nombre, plan_publicacion_id, plan_tier}
  const [ctxPropietario, setCtxPropietario] = React.useState(null);
  // authChecked = ya terminamos de consultar /api/agente/me y /api/propietario/me.
  // Sin esto, durante el render inicial isLoggedPublisher es false y mostrariamos
  // el muro de "Ingresar" aunque el usuario SI este logueado — flash desagradable.
  const [authChecked, setAuthChecked] = React.useState(false);
  // hasSession: hay sesion Supabase aunque el usuario no sea agente/propietario.
  // Util para diferenciar "no logueado" de "logueado pero sin perfil de publicador".
  const [hasSession, setHasSession] = React.useState(false);
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const cf = window.ayCachedFetch || fetch;
      let sessionDetected = false;
      // Disparamos ambos endpoints en PARALELO. Antes era secuencial:
      // primero /api/agente/me y solo si fallaba /api/propietario/me. Eso
      // duplicaba la espera para propietarios. Con ayCachedFetch ademas la
      // 2da visita devuelve la respuesta cacheada al toque.
      const [rA, rP] = await Promise.all([
        cf('/api/agente/me', { cache: 'no-store', credentials: 'include' }).catch(() => null),
        cf('/api/propietario/me', { cache: 'no-store', credentials: 'include' }).catch(() => null),
      ]);
      if (cancelled) return;
      try {
        if (rA && rA.ok) {
          sessionDetected = true;
          const b = await rA.json();
          if (!cancelled && b?.agente) setCtxAgente(b.agente);
        }
      } catch { /* ignore */ }
      try {
        if (rP && rP.ok) {
          sessionDetected = true;
          const b2 = await rP.json();
          if (!cancelled && b2?.propietario) setCtxPropietario(b2.propietario);
        }
      } catch { /* ignore */ }
      if (!cancelled) {
        setHasSession(sessionDetected);
        setAuthChecked(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);
  const isLoggedPublisher = !!(ctxAgente || ctxPropietario);
  // Wizard dinámico por kinds:
  // - Agente CON plan asignado → no se muestra el paso "Plan" (ya tiene plan
  //   activo, sería redundante). El wizard arranca en "Datos básicos".
  // - Agente SIN plan → primer paso "Solicitar plan": elige tier, manda
  //   solicitud de cambio_plan (admin aprueba), y el resto del wizard queda
  //   bloqueado hasta la aprobación.
  // - Propietario o anónimo → primer paso "Plan" (gratis por default), igual
  //   que antes. Los propietarios publican sin cuenta.
  const agenteConPlan = !!(ctxAgente && ctxAgente.plan_publicacion_id);
  const agenteSinPlan = !!(ctxAgente && !ctxAgente.plan_publicacion_id);
  // Mismo comportamiento que para agentes: si el propietario tiene un plan
  // vigente, saltamos el paso "Plan" (ya pago, no tiene sentido elegir).
  const propietarioConPlan = !!(ctxPropietario && ctxPropietario.plan_publicacion_id);
  const stepKinds = agenteSinPlan
    ? ["plan_request", "basics", "location", "photos", "preview"]
    : (agenteConPlan || propietarioConPlan)
      ? ["basics", "location", "photos", "preview"]
      : ["plan", "basics", "location", "photos", "preview"];
  const STEP_DEFS = {
    plan: { title: 'Plan', icon: 'star' },
    plan_request: { title: 'Solicitar plan', icon: 'star' },
    basics: { title: 'Datos básicos', icon: 'doc' },
    location: { title: 'Ubicación', icon: 'pin' },
    photos: { title: 'Fotos', icon: 'upload' },
    preview: { title: 'Vista previa', icon: 'eye' },
  };
  const steps = stepKinds.map((k, i) => ({ id: i, kind: k, title: STEP_DEFS[k].title, icon: STEP_DEFS[k].icon }));

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
    // Numero PUBLICO que aparece en la ficha y dispara el boton "Consultar
    // por WhatsApp". Permite que el propietario use un numero distinto al
    // personal (ej. para no compartir su celular). Si queda vacio, el
    // backend usa propietario_telefono como fallback.
    propietario_telefono_contacto: '',
  });
  const setF = React.useCallback((patch) => setForm(f => Object.assign({}, f, typeof patch === 'function' ? patch(f) : patch)), []);

  // Prefill desde la propiedad existente cuando estamos en modo edicion.
  // GET /api/public/alquiloya/propiedades/:id ya devuelve todo: campos +
  // fotos + caracteristicas + contacto. Mapeamos al shape del form.
  React.useEffect(() => {
    if (!editingId) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/public/alquiloya/propiedades/' + encodeURIComponent(editingId), {
          cache: 'no-store', credentials: 'include',
        });
        const body = await r.json().catch(() => ({}));
        if (!r.ok || !body?.success || !body?.data?.propiedad) throw new Error(body?.error || ('HTTP ' + r.status));
        if (cancelled) return;
        const p = body.data.propiedad;
        setForm(f => ({
          ...f,
          titulo: p.titulo || '',
          tipo: p.tipo || f.tipo,
          operacion: p.operacion || 'alquiler',
          descripcion: p.descripcion || '',
          precio: p.precio != null ? String(p.precio) : '',
          moneda: p.moneda || 'PYG',
          dormitorios: p.dormitorios != null ? String(p.dormitorios) : '',
          banos: p.banos != null ? String(p.banos) : '',
          cocheras: p.cocheras != null ? String(p.cocheras) : '',
          superficie_m2: p.superficie_m2 != null ? String(p.superficie_m2) : '',
          terreno_m2: p.terreno_m2 != null ? String(p.terreno_m2) : '',
          ciudad: p.ciudad || '',
          barrio: p.barrio || '',
          direccion: p.direccion || '',
          lat: typeof p.lat === 'number' ? p.lat : null,
          lng: typeof p.lng === 'number' ? p.lng : null,
          fotos: Array.isArray(p.fotos)
            ? p.fotos.map(x => ({ url: x.url, alt: x.alt || '', es_portada: !!x.es_portada }))
            : (f.fotos || []),
          caracteristicas: Array.isArray(p.caracteristicas)
            ? p.caracteristicas.map(c => (typeof c === 'string' ? c : (c?.nombre || ''))).filter(Boolean)
            : (f.caracteristicas || []),
        }));
      } catch (e) {
        console.warn('[publish] prefill edicion fallo:', e && e.message);
        if (window.ayToast) window.ayToast('No pudimos cargar la propiedad para editar.', { variant: 'error' });
      } finally {
        if (!cancelled) setEditLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [editingId]);

  // Pre-llenar "Tus datos de contacto" con el perfil del publicador logueado
  // (propietario o agente). Solo rellena campos que el usuario todavia no
  // toco — si ya escribio algo, lo respetamos. Se dispara cuando termina de
  // resolverse la sesion (ctxAgente / ctxPropietario).
  React.useEffect(() => {
    const perfil = ctxPropietario || ctxAgente;
    if (!perfil) return;
    setForm(f => ({
      ...f,
      propietario_nombre: f.propietario_nombre || perfil.nombre || '',
      propietario_email: f.propietario_email || perfil.email || '',
      propietario_telefono: f.propietario_telefono || perfil.telefono || perfil.whatsapp || '',
      propietario_telefono_contacto: f.propietario_telefono_contacto || perfil.telefono_contacto || '',
    }));
  }, [ctxAgente, ctxPropietario]);

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
    // Telefono OBLIGATORIO: el boton "Consultar por WhatsApp" de la ficha
    // publica lleva directo a este numero. Sin telefono, el interesado no
    // puede contactar al propietario/agente. Validamos un minimo de digitos.
    const telDigits = (form.propietario_telefono || '').replace(/\D/g, '');
    if (telDigits.length < 7) {
      return 'El teléfono / WhatsApp es obligatorio (es el contacto que verán los interesados).';
    }
    return null;
  }

  // Validacion por paso del wizard: bloquea "Continuar" si el paso actual no
  // tiene completos sus campos obligatorios. Devuelve null si esta OK, o el
  // mensaje a mostrar. Toma el kind del step actual (no su indice) para
  // soportar wizards de longitud variable.
  function validateStep(s) {
    const kind = stepKinds[s];
    if (kind === 'plan') {
      if (!(form.plan_id || '').trim()) return 'Elegí un plan para continuar.';
      // Si la solicitud para un plan pago fue enviada pero el admin
      // todavia no lo activo (lo confirma manualmente desde el ERP),
      // no dejamos avanzar el wizard. Una vez activado, el usuario
      // recibe un correo con sus credenciales y al loguearse el plan
      // se carga desde ctxPropietario.plan_publicacion_id (sin tocar
      // form.plan_request_sent), asi que el bloqueo se levanta solo.
      if (form.plan_request_sent) {
        return 'Solicitud enviada. Te avisamos por correo cuando activemos tu plan. Despues podras publicar.';
      }
      return null;
    }
    if (kind === 'plan_request') {
      // El paso "Solicitar plan" se valida adentro del componente (con su
      // propio botón "Enviar solicitud"). Mientras no esté enviada, bloquea
      // el avance del wizard.
      if (!form.plan_request_sent) {
        return 'Elegí un plan y envianos tu solicitud para continuar.';
      }
      return null;
    }
    if (kind === 'basics') {
      if (!(form.titulo || '').trim()) return 'Ingresá el título de la publicación.';
      const precio = Number(String(form.precio).replace(/[^\d.]/g, ''));
      if (!Number.isFinite(precio) || precio <= 0) return 'Ingresá un precio válido.';
      return null;
    }
    if (kind === 'location') {
      if (!(form.ciudad || '').trim()) return 'Indicá la ciudad del inmueble.';
      return null;
    }
    if (kind === 'photos') {
      const cap = Number(form.plan_fotos_max) > 0 ? Number(form.plan_fotos_max) : null;
      const n = (form.fotos || []).length;
      if (cap != null && n > cap) {
        return `Tu plan permite hasta ${cap} fotos por inmueble. Quitá ${n - cap} foto${n - cap !== 1 ? 's' : ''} o cambiá a un plan superior.`;
      }
      return null;
    }
    if (kind === 'preview') {
      if (!(form.propietario_nombre || '').trim()) return 'Ingresá tu nombre.';
      const telDigits = (form.propietario_telefono || '').replace(/\D/g, '');
      if (telDigits.length < 7) return 'El teléfono / WhatsApp es obligatorio (es el contacto que verán los interesados).';
      return null;
    }
    return null;
  }
  const [stepError, setStepError] = React.useState(null);

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
        propietario_telefono_contacto: form.propietario_telefono_contacto || null,
        plan_publicacion_id: form.plan_id || null,
      };
      const isEdit = !!editingId;
      const url = isEdit
        ? '/api/public/alquiloya/propiedades/' + encodeURIComponent(editingId)
        : '/api/public/alquiloya/propiedades';
      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || ('HTTP ' + res.status));
      setSubmitState({ loading: false, error: null, success: data });
      // Bustear el cache del panel + snapshot para que al volver la lista
      // refleje los cambios inmediatamente.
      try {
        if (window.ayInvalidate) {
          window.ayInvalidate('/api/agente/propiedades');
          window.ayInvalidate('/api/propietario/propiedades');
        }
        if (window.__AY_PANEL_SNAPSHOT) window.__AY_PANEL_SNAPSHOT.myPropiedades = null;
      } catch {}
    } catch (e) {
      setSubmitState({ loading: false, error: (e && e.message) || 'No se pudo enviar.', success: null });
    }
  }

  // ── Muro de auth ──────────────────────────────────────────────────────────
  // A pedido del cliente: para publicar hace falta una cuenta activa de agente
  // o propietario. El backend ya rechaza el POST anonimo con 401/403, pero
  // ademas escondemos el wizard del frontend para que ni siquiera lo intente.
  if (!authChecked) {
    return (
      <div className="fade-in container" style={{ padding: '32px' }}>
        <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--ink-3)' }}>
          Cargando…
        </div>
      </div>
    );
  }
  // Politica del cliente (junio 2026): los PROPIETARIOS pueden publicar SIN
  // crear cuenta — el flujo de "iniciar sesion / solicitar acceso" se reserva
  // para agentes inmobiliarios (porque el agente se queda vinculado a la
  // propiedad y tiene cuota de plan). Anonimos o sesion sin perfil van directo
  // al wizard como propietario directo. Mas abajo, el POST de la API
  // crea/encuentra la fila de propietarios por email/telefono del form.
  // Antes habia aca un gate que mostraba "Necesitas una cuenta activa" y
  // "Tu cuenta no es de publicador" — los dos quedaron deprecados.

  // Gating SOLO para agentes que alcanzaron la cuota de su plan (sin plan se
  // maneja inline con el paso "Solicitar plan", ya no como takeover).
  if (ctxAgente && ctxAgente.plan_publicacion_id && ctxAgente.puede_publicar === false) {
    const limite = ctxAgente.plan_limite_activas;
    const usadas = ctxAgente.propiedades_activas;
    return (
      <div className="fade-in container" style={{ padding: '32px' }}>
        <div className="card" style={{ maxWidth: 600, margin: '48px auto', padding: 36, textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', margin: '0 auto 16px', background: 'rgba(248,178,18,0.12)', color: 'var(--yellow-600)', display: 'grid', placeItems: 'center' }}>
            <I.bolt s={28}/>
          </div>
          <div className="tag" style={{ justifyContent: 'center' }}>Publicar inmueble</div>
          <h2 style={{ marginTop: 8, fontSize: 26 }}>Llegaste al límite de tu plan</h2>
          <p style={{ marginTop: 12, color: 'var(--ink-3)', lineHeight: 1.5 }}>
            Tu plan permite hasta <strong>{limite}</strong> propiedades activas y ya tenés <strong>{usadas}</strong>. Pausá una propiedad o cambiá a un plan superior para seguir publicando.
          </p>
          <div className="row gap-12" style={{ justifyContent: 'center', marginTop: 24, flexWrap: 'wrap' }}>
            <a className="btn btn-primary" href="#plans"><I.star s={16}/> Cambiar de plan</a>
            <a className="btn btn-outline" href="#admin-agent-properties">Ver mis propiedades</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in container" style={{ padding: '32px' }}>
      <div className="row between">
        <div>
          <div className="tag">{editingId ? 'Editar publicación' : 'Publicar inmueble'}</div>
          <h2 style={{ marginTop: 6, fontSize: 30 }}>
            {editingId
              ? (editLoading ? 'Cargando datos…' : 'Editá tu propiedad')
              : `Cargá tu propiedad en ${steps.length} paso${steps.length !== 1 ? 's' : ''}`}
          </h2>
          {ctxAgente && ctxAgente.plan_limite_activas != null && (
            <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
              Plan {(ctxAgente.plan && ctxAgente.plan.nombre) || ''} · {ctxAgente.propiedades_activas}/{ctxAgente.plan_limite_activas} propiedades activas
            </div>
          )}
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
          {stepKinds[step] === 'plan' && <StepPlan form={form} setF={setF} ctxAgente={ctxAgente} ctxPropietario={ctxPropietario} editingId={editingId}/>}
          {stepKinds[step] === 'plan_request' && <StepRequestAgentPlan form={form} setF={setF} ctxAgente={ctxAgente}/>}
          {stepKinds[step] === 'basics' && <StepBasics form={form} setF={setF}/>}
          {stepKinds[step] === 'location' && <StepLocation form={form} setF={setF}/>}
          {stepKinds[step] === 'photos' && <StepPhotos form={form} setF={setF} isAgent={!!ctxAgente}/>}
          {stepKinds[step] === 'preview' && <StepPreview form={form} setF={setF}/>}

          {submitState.success && (
            <div style={{ marginTop: 16, padding: 16, background: '#eaf6f0', borderRadius: 12, border: '1px solid #b6dec6', color: '#1f5e3a', fontSize: 14 }}>
              {editingId
                ? '✓ Cambios guardados. Tu propiedad fue actualizada.'
                : '✓ Tu propiedad fue enviada para revisión. El equipo de AlquiloYa la revisará antes de publicarla.'}
              {submitState.success.codigo ? <div className="muted xs" style={{ marginTop: 6 }}>Código: <strong>{submitState.success.codigo}</strong></div> : null}
            </div>
          )}
          {submitState.error && (
            <div style={{ marginTop: 16, padding: 12, background: '#fdecec', borderRadius: 12, border: '1px solid #f3c2c2', color: '#a8312f', fontSize: 13 }}>
              {submitState.error}
            </div>
          )}

          {stepError && (
            <div style={{ marginTop: 16, padding: 12, background: '#fdecec', borderRadius: 12, border: '1px solid #f3c2c2', color: '#a8312f', fontSize: 13 }}>
              {stepError}
            </div>
          )}
          <div className="row between" style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid var(--line-2)' }}>
            <button className="btn btn-outline" disabled={step === 0} onClick={() => { setStepError(null); setStep(s => Math.max(0, s - 1)); }}
              style={{ opacity: step === 0 ? 0.4 : 1 }}>
              ← Anterior
            </button>
            <div className="row gap-12">
              <span className="muted xs">Paso {step + 1} de {steps.length}</span>
              {step < steps.length - 1 ? (
                <button className="btn btn-blue" disabled={stepKinds[step] === 'plan' && !!form.plan_request_sent} onClick={() => {
                  const err = validateStep(step);
                  if (err) { setStepError(err); return; }
                  setStepError(null);
                  setStep(s => Math.min(steps.length - 1, s + 1));
                }}>
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
                  {submitState.loading
                    ? (editingId ? 'Guardando…' : 'Enviando…')
                    : (submitState.success
                        ? (editingId ? 'Guardado ✓' : 'Enviado ✓')
                        : (editingId ? 'Guardar cambios' : 'Enviar para revisión'))}
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

// Lista completa de tipos que acepta el backend (TIPOS_OK en
// /api/public/alquiloya/propiedades). El select del paso 2 ofrece todos
// para que el usuario pueda elegir el que mejor describe su inmueble.
const PUBLISH_TIPOS = [
  { id: 'departamento',       label: 'Departamento' },
  { id: 'casa',               label: 'Casa' },
  { id: 'casa_independiente', label: 'Casa independiente' },
  { id: 'duplex',             label: 'Dúplex' },
  { id: 'duplex_ph',          label: 'Dúplex PH' },
  { id: 'local_comercial',    label: 'Local comercial' },
  { id: 'salon_comercial',    label: 'Salón comercial' },
  { id: 'oficina',            label: 'Oficina' },
  { id: 'terreno',            label: 'Terreno' },
  { id: 'deposito',           label: 'Depósito' },
  { id: 'alquiler_temporal',  label: 'Lugar Temporal' },
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
      <div className="tag">Paso 2</div>
      <h3 style={{ fontSize: 22, marginTop: 6 }}>Datos básicos de tu propiedad</h3>
      <p className="muted" style={{ fontSize: 14, marginTop: 6 }}>Completá la información principal del inmueble.</p>
      <div style={{ marginTop: 24 }}>
        <div className="field" style={{ marginBottom: 18 }}>
          <label>Tipo de inmueble</label>
          <PrettySelect
            value={form.tipo || ''}
            onChange={(v) => setF({ tipo: v })}
            placeholder="Seleccione el tipo de inmueble"
            options={PUBLISH_TIPOS.map(t => ({ value: t.id, label: t.label }))}
          />
        </div>
        <div className="field" style={{ marginBottom: 18 }}>
          <label>Título de la publicación *</label>
          <input className="input" value={form.titulo} onChange={(e) => setF({ titulo: e.target.value })} placeholder="Ej. Dúplex moderno con balcón en Villa Morra" maxLength={120}/>
          <span className="muted xs">Sé claro y específico.</span>
        </div>
        <FormGrid>
          <div className="field">
            <label>Precio (Gs.) *</label>
            <input className="input" value={form.precio} onChange={(e) => setF({ precio: e.target.value.replace(/[^\d]/g, '') })} placeholder="Ej. 3800000" inputMode="numeric"/>
          </div>
          <div className="field">
            <label>Operación</label>
            <PrettySelect value="alquiler" onChange={() => {}} options={[
              { value: 'alquiler', label: 'Alquiler' },
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
      <div className="tag">Paso 3</div>
      <h3 style={{ fontSize: 22, marginTop: 6 }}>¿Dónde se encuentra tu inmueble?</h3>
      <p className="muted" style={{ fontSize: 14, marginTop: 6 }}>Tu dirección escrita queda privada. El punto en el mapa sí se muestra al público para que vean la zona.</p>
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
          <label>Punto en el mapa (visible al público)</label>
          <div className="muted xs" style={{ marginBottom: 6 }}>Clic en el mapa para fijar la ubicación exacta. Podés arrastrar el pin. Este punto se muestra en la publicación.</div>
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

// Extrae lat,lng de un link de Google Maps (varios formatos comunes).
// Devuelve [lat,lng] o null si no encuentra coordenadas.
function parseGoogleMapsLink(url) {
  if (!url || typeof url !== 'string') return null;
  const s = url.trim();
  // 1) @LAT,LNG en la URL: .../@-25.281,-57.635,17z/...
  let m = s.match(/@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/);
  if (m) return [Number(m[1]), Number(m[2])];
  // 2) !3dLAT!4dLNG (places, pins compartidos)
  m = s.match(/!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/);
  if (m) return [Number(m[1]), Number(m[2])];
  // 3) ?q=LAT,LNG / &q=LAT,LNG / ?ll=LAT,LNG / &query=LAT,LNG
  m = s.match(/[?&](?:q|ll|query|destination)=(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/);
  if (m) return [Number(m[1]), Number(m[2])];
  // 4) Pares "LAT,LNG" sueltos como ultimo recurso (debe parecer Paraguay-ish o lat/lng valido).
  m = s.match(/(-?\d{1,3}\.\d{3,}),\s*(-?\d{1,3}\.\d{3,})/);
  if (m) {
    const la = Number(m[1]), ln = Number(m[2]);
    if (Math.abs(la) <= 90 && Math.abs(ln) <= 180) return [la, ln];
  }
  return null;
}

function LeafletPickerWidget({ lat, lng, onChange }) {
  const ref = React.useRef(null);
  const mapRef = React.useRef(null);
  const markerRef = React.useRef(null);
  const [linkInput, setLinkInput] = React.useState('');
  const [linkErr, setLinkErr] = React.useState(null);
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
  // Sincroniza el marcador y centra el mapa cuando lat/lng cambian desde
  // afuera (ej. al pegar un link de Google Maps).
  React.useEffect(() => {
    const m = mapRef.current;
    if (!m || typeof window === 'undefined' || !window.L) return;
    const L = window.L;
    if (typeof lat === 'number' && typeof lng === 'number') {
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        markerRef.current = L.marker([lat, lng], { draggable: true }).addTo(m);
        markerRef.current.on('dragend', (ev) => {
          const ll = ev.target.getLatLng();
          onChange(Number(ll.lat.toFixed(6)), Number(ll.lng.toFixed(6)));
        });
      }
      m.setView([lat, lng], 16);
    } else if (markerRef.current) {
      try { m.removeLayer(markerRef.current); } catch {}
      markerRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng]);

  const [linkBusy, setLinkBusy] = React.useState(false);
  async function onPasteLink() {
    setLinkErr(null);
    const raw = (linkInput || '').trim();
    if (!raw) return;
    // 1) Parser local rapido: funciona para links largos con @LAT,LNG / !3d!4d / ?q=...
    const local = parseGoogleMapsLink(raw);
    if (local) {
      const [la, ln] = local;
      onChange(Number(la.toFixed(6)), Number(ln.toFixed(6)));
      setLinkInput('');
      return;
    }
    // 2) Link corto (maps.app.goo.gl / goo.gl/maps): el navegador no puede
    // seguir el redirect por CORS. Lo resolvemos via /api/public/alquiloya/
    // resolve-gmaps que sigue el redirect server-side.
    const isShort = /^https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(raw)
      || /google\.com/i.test(raw);
    if (!isShort) {
      setLinkErr('No pudimos extraer la ubicación de ese link. Probá copiar de nuevo desde Google Maps (botón "Compartir → Copiar enlace").');
      return;
    }
    setLinkBusy(true);
    try {
      const r = await fetch('/api/public/alquiloya/resolve-gmaps?url=' + encodeURIComponent(raw), { cache: 'no-store' });
      let b = {};
      try { b = await r.json(); } catch { /* respuesta no-JSON */ }
      // Si el endpoint no existe (404), probablemente el deploy aun no se
      // actualizo. Damos un mensaje claro al usuario para que sepa que
      // intente despues o use el pin manual.
      if (r.status === 404) {
        setLinkErr('El servicio para resolver links cortos todavía no está disponible en este servidor. Probá pegar el link largo de Google Maps (no el de maps.app.goo.gl) o marcá el punto en el mapa.');
        return;
      }
      if (!r.ok || !b || b.ok !== true || typeof b.lat !== 'number' || typeof b.lng !== 'number') {
        const motivo = (b && (b.error || b.message)) || ('HTTP ' + r.status);
        setLinkErr('No pudimos extraer la ubicación: ' + motivo + '. Probá abrir el link en Google Maps, luego "Compartir → Copiar enlace".');
        return;
      }
      onChange(Number(Number(b.lat).toFixed(6)), Number(Number(b.lng).toFixed(6)));
      setLinkInput('');
    } catch (e) {
      setLinkErr('Error de red al resolver el link: ' + (e && e.message ? e.message : 'desconocido'));
    } finally {
      setLinkBusy(false);
    }
  }
  return (
    <div>
      {/* Pegar link de Google Maps — alternativa rapida al click manual. */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <input
          type="url"
          className="input"
          placeholder="O pegá un link de Google Maps (https://maps.app.goo.gl/... o https://www.google.com/maps/...)"
          value={linkInput}
          onChange={(e) => { setLinkInput(e.target.value); setLinkErr(null); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onPasteLink(); } }}
          style={{ flex: 1, minWidth: 200, fontSize: 13 }}
        />
        <button
          type="button"
          onClick={onPasteLink}
          disabled={!linkInput.trim() || linkBusy}
          className="btn btn-blue"
          style={{ flexShrink: 0, opacity: linkInput.trim() && !linkBusy ? 1 : 0.5 }}
        >
          {linkBusy ? 'Resolviendo…' : 'Usar link'}
        </button>
      </div>
      {linkErr ? (
        <div style={{ marginBottom: 8, padding: '8px 12px', background: '#fee2e2', color: '#991b1b', borderRadius: 8, fontSize: 12.5 }}>{linkErr}</div>
      ) : (
        <div className="muted xs" style={{ marginBottom: 8 }}>
          Tip: en Google Maps → tocá el lugar → <strong>Compartir</strong> → <strong>Copiar enlace</strong>. Pegalo acá y se fija solo el pin.
        </div>
      )}
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
  // A pedido del cliente: solo "Subir desde dispositivo". El modo URL queda
  // soportado en el codigo para no romper drafts viejos, pero ya no se ofrece.
  const [mode, setMode] = React.useState('file');
  const fileInputRef = React.useRef(null);
  const [dragIdx, setDragIdx] = React.useState(null);
  const [overIdx, setOverIdx] = React.useState(null);
  // Cap del plan: si no hay plan elegido, no enforce (defaults a infinito).
  const planCap = Number(form.plan_fotos_max) > 0 ? Number(form.plan_fotos_max) : null;
  const fotosLen = (form.fotos || []).length;
  const atCap = planCap != null && fotosLen >= planCap;
  function addFotoUrl() {
    const url = (urlNew || '').trim();
    if (!url) return;
    if (planCap != null && fotosLen >= planCap) {
      window.alert(`Ya cargaste las ${planCap} fotos que permite tu plan. Borrá alguna para sumar otra, o pasá a un plan superior.`);
      return;
    }
    setF(f => ({ fotos: [...(f.fotos || []), { url, alt: f.titulo || '', es_portada: (f.fotos || []).length === 0 }] }));
    setUrlNew('');
  }
  // Comprime una imagen a max 1600px de lado mayor y la convierte a JPEG ~0.82.
  // Mantiene calidad visual aceptable pero baja el peso ~10x (5MB → 300-500KB).
  function compressImage(file, maxSide, quality) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target && e.target.result;
        if (typeof dataUrl !== 'string') { reject(new Error('No se pudo leer el archivo')); return; }
        const img = new Image();
        img.onload = () => {
          const w0 = img.naturalWidth || img.width;
          const h0 = img.naturalHeight || img.height;
          if (!w0 || !h0) { resolve(dataUrl); return; }
          const scale = Math.min(1, maxSide / Math.max(w0, h0));
          const w = Math.round(w0 * scale);
          const h = Math.round(h0 * scale);
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) { resolve(dataUrl); return; }
          // Pintamos fondo blanco para PNGs con transparencia (al pasar a JPG queda negro).
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          try { resolve(canvas.toDataURL('image/jpeg', quality)); }
          catch (err) { reject(err); }
        };
        img.onerror = () => resolve(dataUrl); // fallback: si no carga, mando el original
        img.src = dataUrl;
      };
      reader.onerror = () => reject(new Error('Error al leer'));
      reader.readAsDataURL(file);
    });
  }
  async function addFotoFiles(fileList) {
    const files = Array.from(fileList || []).filter(f => f && f.type && f.type.startsWith('image/'));
    if (files.length === 0) return;
    // Cap del plan: solo agregamos hasta llenar el cupo.
    const currentLen = (form.fotos || []).length;
    const remaining = planCap != null ? Math.max(0, planCap - currentLen) : files.length;
    if (planCap != null && files.length > remaining) {
      if (remaining === 0) {
        window.alert(`Ya cargaste las ${planCap} fotos que permite tu plan. Borrá alguna para sumar otra, o pasá a un plan superior.`);
      } else {
        const rest = files.length - remaining;
        window.alert(`Tu plan permite hasta ${planCap} fotos por inmueble. Sumamos ${remaining} y dejamos ${rest} sin agregar.`);
      }
    }
    const toAdd = planCap != null ? files.slice(0, remaining) : files;
    for (const file of toAdd) {
      if (file.size > 12 * 1024 * 1024) {
        window.alert('"' + file.name + '" supera los 12MB. Reducila antes de subir.');
        continue;
      }
      try {
        const dataUrl = await compressImage(file, 1600, 0.82);
        setF(f => ({ fotos: [...(f.fotos || []), { url: dataUrl, alt: f.titulo || '', es_portada: (f.fotos || []).length === 0 }] }));
      } catch (err) {
        window.alert('No se pudo procesar "' + file.name + '": ' + (err && err.message ? err.message : 'error'));
      }
    }
  }
  function removeFoto(idx) {
    setF(f => {
      const next = (f.fotos || []).filter((_, i) => i !== idx);
      return { fotos: next.map((p, i) => Object.assign({}, p, { es_portada: i === 0 })) };
    });
  }
  function moveFoto(from, to) {
    if (from === to || from == null || to == null) return;
    setF(f => {
      const arr = (f.fotos || []).slice();
      if (from < 0 || from >= arr.length || to < 0 || to >= arr.length) return {};
      const [it] = arr.splice(from, 1);
      arr.splice(to, 0, it);
      return { fotos: arr.map((p, i) => Object.assign({}, p, { es_portada: i === 0 })) };
    });
  }
  const segBtn = (active) => ({
    padding: '8px 14px', borderRadius: 10, border: '1px solid ' + (active ? 'var(--blue)' : 'var(--line)'),
    background: active ? 'var(--blue-50)' : '#fff', cursor: 'pointer', fontFamily: 'inherit',
    fontSize: 13, fontWeight: 600, color: active ? 'var(--blue)' : 'var(--ink-2)'
  });
  return (
    <div>
      <div className="tag">Paso 4</div>
      <h3 style={{ fontSize: 22, marginTop: 6 }}>Sumá fotos de tu propiedad</h3>
      <p className="muted" style={{ fontSize: 14, marginTop: 6 }}>
        {isAgent
          ? 'Como agente, recomendamos pegar URLs de tu servidor de imágenes para no inflar la base. También podés subir desde dispositivo.'
          : 'Subí las fotos desde tu dispositivo (hasta 4 MB c/u).'}
      </p>
      {planCap != null && (
        <div style={{
          marginTop: 12, padding: '8px 12px', borderRadius: 10,
          background: atCap ? '#fdecec' : 'var(--blue-50)',
          border: '1px solid ' + (atCap ? '#f3c2c2' : 'var(--blue-100, #dceaf6)'),
          color: atCap ? '#a8312f' : 'var(--blue)',
          fontSize: 12.5, fontWeight: 600, display: 'inline-block',
        }}>
          {fotosLen} / {planCap} fotos según tu plan {atCap ? '· cupo lleno' : ''}
        </div>
      )}


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
        <>
          <div style={{
            marginTop: 18, padding: '10px 12px', borderRadius: 10,
            background: 'var(--yellow-50, #fff7e3)',
            border: '1px solid #f1d98b',
            color: '#8a5e00',
            fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span><b>La primera foto siempre será la portada principal.</b> Arrastrá las fotos para reordenarlas.</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 12 }}>
            {form.fotos.map((f, i) => {
              const isDragging = dragIdx === i;
              const isOver = overIdx === i && dragIdx !== null && dragIdx !== i;
              return (
                <div
                  key={i}
                  draggable
                  onDragStart={(e) => { setDragIdx(i); try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(i)); } catch {} }}
                  onDragOver={(e) => { e.preventDefault(); try { e.dataTransfer.dropEffect = 'move'; } catch {} if (overIdx !== i) setOverIdx(i); }}
                  onDragLeave={() => { if (overIdx === i) setOverIdx(null); }}
                  onDrop={(e) => { e.preventDefault(); const from = dragIdx != null ? dragIdx : Number(e.dataTransfer.getData('text/plain')); moveFoto(from, i); setDragIdx(null); setOverIdx(null); }}
                  onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
                  style={{
                    position: 'relative',
                    cursor: 'grab',
                    opacity: isDragging ? 0.4 : 1,
                    transform: isOver ? 'scale(1.03)' : 'none',
                    transition: 'transform .12s ease, opacity .12s ease',
                    outline: isOver ? '2px dashed var(--blue)' : 'none',
                    outlineOffset: isOver ? 2 : 0,
                    borderRadius: 10,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.url} alt={f.alt || ''} draggable={false} style={{ width: '100%', height: 130, objectFit: 'cover', borderRadius: 10, background: 'var(--bg-2)', pointerEvents: 'none' }} onError={(e) => { e.currentTarget.style.opacity = '0.3'; }}/>
                  {i === 0 && <span className="badge badge-featured" style={{ position: 'absolute', top: 8, left: 8 }}>Principal</span>}
                  <div style={{ position: 'absolute', bottom: 8, left: 8, width: 24, height: 24, borderRadius: 6, background: 'rgba(11,22,34,.55)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 800, pointerEvents: 'none' }}>⋮⋮</div>
                  <button type="button" onClick={() => removeFoto(i)} onMouseDown={(e) => e.stopPropagation()} draggable={false} style={{ position: 'absolute', top: 8, right: 8, width: 26, height: 26, borderRadius: '50%', background: 'rgba(255,255,255,.95)', border: 'none', cursor: 'pointer' }}>
                    <I.x s={12}/>
                  </button>
                </div>
              );
            })}
          </div>
        </>
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

// Lee de los bullets del plan ("Hasta 5 fotos por inmueble", "15 propiedades
// activas") los topes numericos. Devuelve { fotosPorInmueble, propiedadesActivas }.
function extractPlanLimitsFromBullets(bullets) {
  const arr = Array.isArray(bullets) ? bullets : [];
  let fotosPorInmueble = null;
  let propiedadesActivas = null;
  for (const b of arr) {
    if (typeof b !== 'string') continue;
    if (fotosPorInmueble == null) {
      const m = b.match(/hasta\s+(\d+)\s+fotos?/i);
      if (m) fotosPorInmueble = Number(m[1]) || null;
    }
    if (propiedadesActivas == null) {
      const m = b.match(/(\d+)\s*propiedades?\s+activas?/i);
      if (m) propiedadesActivas = Number(m[1]) || null;
    }
  }
  return { fotosPorInmueble, propiedadesActivas };
}

function StepPlan({ form, setF, ctxAgente, ctxPropietario, editingId }) {
  const [apiPlans, setApiPlans] = React.useState(null);
  const [agentPickerOpen, setAgentPickerOpen] = React.useState(false);
  // Modal de "Solicitar plan" cuando un anónimo clickea un plan pago.
  // Reusa RequestAccessModal (definido en home.jsx, expuesto en window).
  const [planRequestFor, setPlanRequestFor] = React.useState(null); // {tier, name}
  const isAnonOrOwner = !ctxAgente; // anónimo o propietario logueado
  // El atajo "que un agente publique por mi" es para CUALQUIER usuario que
  // no sea agente ni este editando una propiedad existente. Antes solo se
  // mostraba a propietarios logueados; ahora que los propietarios pueden
  // publicar sin cuenta, tambien aplica a anonimos — el modal pide sus datos
  // de contacto inline si no estan ya seteados.
  const canRequestAgent = !ctxAgente && !editingId;
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
          if (match) {
            const limits = extractPlanLimitsFromBullets(match.bullets);
            setF({
              plan_id: match.tier,
              plan_fotos_max: limits.fotosPorInmueble,
              plan_propiedades_max: limits.propiedadesActivas,
            });
          }
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
      <div className="tag">Paso 1</div>
      <h3 style={{ fontSize: 22, marginTop: 6 }}>Elegí un plan para tu publicación</h3>
      <p className="muted" style={{ fontSize: 14, marginTop: 6 }}>Podés cambiar de plan más adelante.</p>

      {form.plan_request_sent && (
        <div className="card" style={{
          marginTop: 16, padding: '14px 16px',
          background: '#fff9e6', border: '1px solid #f1d97a',
          borderLeft: '4px solid #f5b400',
        }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>
            Solicitud enviada — esperando activación
          </div>
          <div className="muted xs" style={{ marginTop: 4, lineHeight: 1.5 }}>
            Te avisamos por correo cuando activemos tu plan. Recién entonces podrás continuar con la publicación.
          </div>
        </div>
      )}

      {canRequestAgent && (
        <div className="card" style={{
          marginTop: 16, padding: '14px 16px',
          background: '#f1f7ff', border: '1px solid var(--blue-100)',
          borderLeft: '4px solid var(--blue)',
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--blue)', color: '#fff', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <I.user s={18}/>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>¿Preferís que un agente publique por vos?</div>
            <div className="muted xs" style={{ marginTop: 2 }}>
              Elegí un agente activo de AlquiloYa y le llega tu solicitud a su panel de captaciones. Te contacta por WhatsApp, carga la propiedad y la administra. Sin costo para vos.
            </div>
          </div>
          <button type="button" onClick={() => setAgentPickerOpen(true)} className="btn btn-blue" style={{ flexShrink: 0 }}>
            Solicitar agente
          </button>
        </div>
      )}

      {agentPickerOpen && (
        <AgentPickerModal
          defaultContact={{
            nombre: (ctxPropietario && ctxPropietario.nombre) || form.propietario_nombre || '',
            email: (ctxPropietario && ctxPropietario.email) || form.propietario_email || '',
            telefono: (ctxPropietario && (ctxPropietario.telefono || ctxPropietario.whatsapp)) || form.propietario_telefono || '',
          }}
          propertyContext={{
            propiedad_titulo: form.titulo || '',
            tipo_propiedad: form.tipo || '',
            ciudad: form.ciudad || '',
            barrio: form.barrio || '',
            direccion: form.direccion || '',
            precio_estimado: form.precio ? Number(String(form.precio).replace(/[^\d]/g, '')) : null,
          }}
          onClose={() => setAgentPickerOpen(false)}
        />
      )}
      <div className="col gap-12" style={{ marginTop: 20 }}>
        {list.map(p => {
          const picked = form.plan_id === p.tier;
          const isPaid = (p.price || 0) > 0 || (p.billing && p.billing !== 'gratis');
          const requestSent = form.plan_request_tier === p.tier && form.plan_request_sent;
          return (
            <button key={p.tier} type="button" onClick={() => {
              const limits = extractPlanLimitsFromBullets(p.bullets);
              // Plan PAGO + anónimo/propietario sin sesión real: en lugar de
              // dejarlo elegir directo (no puede pagar desde el wizard),
              // abrimos un formulario de solicitud al admin. Plan gratis o
              // agente: comportamiento normal (selección directa).
              if (isPaid && isAnonOrOwner && !requestSent) {
                // No seteamos plan_id todavia — recien se aplica al confirmar
                // la solicitud. Asi, si el usuario cierra el modal sin enviar,
                // el wizard sigue bloqueado por validateStep("plan").
                setPlanRequestFor({
                  tier: p.tier,
                  name: p.name,
                  fotos_max: limits.fotosPorInmueble,
                  propiedades_max: limits.propiedadesActivas,
                });
                return;
              }
              setF({
                plan_id: p.tier,
                plan_fotos_max: limits.fotosPorInmueble,
                plan_propiedades_max: limits.propiedadesActivas,
              });
            }} className="card" style={{
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
                {requestSent && (
                  <div style={{ marginTop: 6, fontSize: 10.5, fontWeight: 700, color: 'var(--green)' }}>
                    <I.check s={11}/> Solicitado
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {planRequestFor && typeof window.RequestAccessModal === 'function' && (
        React.createElement(window.RequestAccessModal, {
          planTier: planRequestFor.tier,
          planLabel: planRequestFor.name,
          onSuccess: () => {
            setF({
              plan_id: planRequestFor.tier,
              plan_fotos_max: planRequestFor.fotos_max,
              plan_propiedades_max: planRequestFor.propiedades_max,
              plan_request_sent: true,
              plan_request_tier: planRequestFor.tier,
            });
            if (window.ayToast) {
              window.ayToast('Solicitud de plan enviada. Te contactamos para activarla.', { variant: 'success', duration: 6000 });
            }
          },
          onClose: () => setPlanRequestFor(null),
        })
      )}
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
          <div className="field">
            <label>Tu teléfono / WhatsApp personal *</label>
            <input className="input" value={form.propietario_telefono} onChange={(e) => setF({ propietario_telefono: e.target.value })} placeholder="+595 ..."/>
            <div className="muted xs" style={{ marginTop: 6 }}>Para uso interno de AlquiloYa (no se publica).</div>
          </div>
          <div className="field">
            <label>Teléfono de contacto para la publicación</label>
            <input
              className="input"
              value={form.propietario_telefono_contacto}
              onChange={(e) => setF({ propietario_telefono_contacto: e.target.value })}
              placeholder="+595 ... (opcional)"
            />
            <div className="muted xs" style={{ marginTop: 6 }}>Si lo dejás vacío, usamos tu número personal. Útil si querés que los interesados te contacten en otro número (ej. WhatsApp de trabajo).</div>
          </div>
        </FormGrid>
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

// Genera el brochure imprimible (2 paginas A4). Abre una ventana con HTML
// estatico y dispara print() — el usuario elige "Guardar como PDF". Es el
// camino confiable: html2canvas se rompe con imagenes cross-origin (cover de
// Unsplash, tiles de OSM, QR de qrserver) por canvas tainted.
function printBrochure(property, contacto) {
  const p = property || {};
  const title = p.title || p.titulo || 'Propiedad';
  const address = [p.barrio || p.neighborhood, p.ciudad || p.city].filter(Boolean).join(', ');
  const priceNum = Number(p.price ?? p.precio) || 0;
  const opVenta = (p.operacion || '') === 'venta';
  const beds = p.beds ?? p.dormitorios, baths = p.baths ?? p.banos, m2 = p.m2 ?? p.superficie_m2;
  const desc = (p.desc || p.descripcion || '').replace(/</g, '');
  const cover = p.cover || p.cover_url || null;
  const feats = Array.isArray(p.features) ? p.features : [];
  const pid = p.apiId || p.id || '';
  const origin = (typeof window !== 'undefined' && window.location && window.location.origin) || 'https://alquiloya.com.py';
  const qrSrc = 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=0&data=' + encodeURIComponent(origin + '/?prop=' + encodeURIComponent(pid));
  // Mapa estatico (mejor esfuerzo) centrado en coords o ciudad.
  const cc = (typeof window !== 'undefined' && window.CITY_COORDS && window.normalizeCity)
    ? window.CITY_COORDS[window.normalizeCity(p.ciudad || p.city)] : null;
  const hasExact = typeof p.lat === 'number' && typeof p.lng === 'number';
  const lat = hasExact ? p.lat : (cc ? cc[0] : null);
  const lng = hasExact ? p.lng : (cc ? cc[1] : null);
  // Coord exacta → zoom alto + marker rojo (ubicacion precisa).
  // Solo ciudad → zoom medio sin marker (area aproximada).
  const mapZoom = hasExact ? 17 : 13;
  const mapMarker = hasExact ? `&markers=${lat},${lng},red-pushpin` : '';
  const mapSrc = (lat != null && lng != null)
    ? `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=${mapZoom}&size=560x200${mapMarker}`
    : null;
  const cName = (contacto && contacto.nombre) || '';
  const cPhone = (contacto && (contacto.telefono || contacto.whatsapp)) || '';
  const footer = [cName, cPhone].filter(Boolean).join(' · ');
  const fmt = (n) => 'Gs. ' + Number(n || 0).toLocaleString('es-PY');

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title} · AlquiloYa</title>
  <style>
    *{box-sizing:border-box;margin:0;font-family:Arial,Helvetica,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    body{background:#fff;color:#0b1622}
    .page{width:210mm;min-height:297mm;padding:0;margin:0 auto;page-break-after:always;display:flex;flex-direction:column}
    .hd{background:#0058A5;color:#fff;font-weight:900;letter-spacing:.04em;padding:18px 28px;font-size:22px;display:flex;justify-content:space-between;align-items:center}
    .badge{background:#0058A5;border:1px solid #fff;border-radius:999px;font-size:11px;padding:3px 10px}
    .cover{width:100%;height:300px;object-fit:cover;display:block;background:#eef2f7}
    .noimg{width:100%;height:300px;background:#eef2f7;color:#8893a1;display:flex;align-items:center;justify-content:center;font-size:14px}
    .body{padding:28px;flex:1}
    .title{font-size:26px;font-weight:800}
    .addr{color:#5b6573;margin-top:4px;font-size:14px}
    .price{font-size:30px;font-weight:900;color:#0058A5;margin-top:14px}
    .price small{font-size:14px;font-weight:500;color:#5b6573}
    .specs{display:flex;gap:18px;margin-top:14px;font-size:14px;color:#2a3543}
    .desc{margin-top:18px;font-size:13px;line-height:1.55;color:#5b6573}
    .gallery{margin-top:18px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px}
    .gallery img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:4px}
    .sec-title{font-size:16px;font-weight:800;margin-bottom:8px}
    .feats{display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:13px;color:#2a3543}
    .map{width:100%;height:200px;object-fit:cover;border-radius:6px;border:1px solid #e7ebf0;background:#eef2f7}
    .note{font-size:11px;color:#8893a1;margin-top:6px}
    .qrbox{display:flex;gap:14px;align-items:center;margin-top:28px}
    .qrbox img{width:120px;height:120px}
    .ft{background:#0058A5;color:#fff;text-align:center;padding:14px;font-weight:800;font-style:italic;font-size:12px;margin-top:auto}
    @page{size:A4;margin:0}
  </style></head><body>
  <div class="page">
    <div class="hd"><span>ALQUILOYA</span>${(p.verified||p.verificada)?'<span class="badge">✓ Verificado</span>':''}</div>
    ${cover ? `<img class="cover" src="${cover}" alt=""/>` : `<div class="noimg">Sin imagen</div>`}
    <div class="body">
      <div class="title">${title}</div>
      ${address?`<div class="addr">📍 ${address}</div>`:''}
      ${priceNum>0?`<div class="price">${fmt(priceNum)}<small>${opVenta?'':' / mes'}</small></div>`:''}
      <div class="specs">
        ${beds!=null?`<span>🛏 ${beds} dorm</span>`:''}
        ${baths!=null?`<span>🛁 ${baths} baño${Number(baths)===1?'':'s'}</span>`:''}
        ${(m2!=null&&Number(m2)>0)?`<span>📐 ${m2} m²</span>`:''}
      </div>
      ${desc?`<div class="desc">${desc}</div>`:''}
      ${feats.length?`<div class="gallery"></div>`:''}
    </div>
    <div class="ft">ALQUILOYA.COM.PY · ¡DONDE ENCONTRÁS MÁS RÁPIDO!</div>
  </div>
  <div class="page">
    <div class="hd"><span>ALQUILOYA</span></div>
    <div class="body">
      ${feats.length?`<div class="sec-title">Características destacadas</div><div class="feats">${feats.slice(0,10).map(f=>`<div>✓ ${String(f).replace(/</g,'')}</div>`).join('')}</div><div style="height:22px"></div>`:''}
      <div class="sec-title">Ubicación</div>
      ${address?`<div class="addr" style="margin-bottom:8px">📍 ${address}</div>`:''}
      ${mapSrc?`<img class="map" src="${mapSrc}" alt="Mapa"/>`:`<div class="map" style="display:flex;align-items:center;justify-content:center;color:#8893a1">Mapa no disponible</div>`}
      <div class="note">La ubicación exacta se comparte al coordinar la visita.</div>
      <div class="qrbox">
        <img src="${qrSrc}" alt="QR"/>
        <div><div style="font-weight:700">Escaneá para ver online</div><div style="font-size:12px;color:#5b6573">Más fotos, calendario y contacto directo por WhatsApp</div></div>
      </div>
    </div>
    <div class="ft">${footer ? footer + ' · ' : ''}ALQUILOYA.COM.PY</div>
  </div>
  </body></html>`;
  downloadBrochurePdf(html, title);
}

// Carga html2pdf.js (html2canvas + jsPDF empaquetados) desde CDN una sola vez
// y devuelve la promesa de window.html2pdf. Si el CDN falla, retorna null y
// caemos al print clasico.
let __ay_html2pdf_promise = null;
function loadHtml2Pdf() {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.html2pdf) return Promise.resolve(window.html2pdf);
  if (__ay_html2pdf_promise) return __ay_html2pdf_promise;
  __ay_html2pdf_promise = new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    s.async = true;
    s.onload = () => resolve(window.html2pdf || null);
    s.onerror = () => resolve(null);
    document.head.appendChild(s);
  });
  return __ay_html2pdf_promise;
}

// Renderiza el HTML del brochure en un contenedor oculto, lo convierte a PDF
// con html2pdf y dispara el download. Si html2pdf no esta disponible (CDN
// bloqueado / offline) caemos al window.open + print() de antes.
function downloadBrochurePdf(html, title) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const filename = (String(title || 'brochure').replace(/[^\w\d\-\_\s]/g, '').trim() || 'brochure') + '.pdf';
  // Toast feedback inmediato (la generacion tarda ~2-3s).
  if (window.ayToast) window.ayToast('Generando PDF…', { variant: 'info', duration: 3500 });
  loadHtml2Pdf().then((h2p) => {
    if (!h2p) {
      // Fallback: abrir ventana imprimible.
      const w = window.open('', '_blank', 'width=900,height=1100');
      if (!w) { window.alert('Habilitá las ventanas emergentes para descargar el PDF.'); return; }
      w.document.write(html);
      w.document.close();
      w.onload = () => { setTimeout(() => { w.focus(); w.print(); }, 600); };
      return;
    }
    const wrap = document.createElement('div');
    // Off-screen, no afecta layout visible. width fija para A4.
    wrap.style.cssText = 'position:fixed;left:-99999px;top:0;width:210mm;background:#fff;z-index:-1';
    // Solo extraemos el body interior — html2pdf espera un elemento.
    const m = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    wrap.innerHTML = m ? m[1] : html;
    // El <style> del head viene FUERA del body; lo insertamos como bloque
    // dentro del contenedor para que html2canvas lo aplique.
    const sm = html.match(/<style>([\s\S]*?)<\/style>/i);
    if (sm) {
      const st = document.createElement('style');
      st.textContent = sm[1];
      wrap.insertBefore(st, wrap.firstChild);
    }
    document.body.appendChild(wrap);
    const opt = {
      margin: 0,
      filename,
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: { scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'legacy'] },
    };
    h2p().set(opt).from(wrap).save()
      .catch((e) => {
        console.warn('[brochure] html2pdf fallo, fallback a print:', e);
        const w = window.open('', '_blank', 'width=900,height=1100');
        if (w) { w.document.write(html); w.document.close(); w.onload = () => { setTimeout(() => { w.focus(); w.print(); }, 600); }; }
      })
      .finally(() => {
        if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
      });
  });
}

// El brochure ahora se genera con los datos REALES de la propiedad + el
// contacto del publicador. `property` y `contacto` son opcionales: si no se
// pasan (preview generico), cae a una muestra de ejemplo.
function BrochurePreviewModal({ onClose, property, contacto }) {
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
            <button className="btn btn-primary" onClick={() => printBrochure(property, contacto)}><I.doc s={14}/> Descargar PDF</button>
            <button onClick={onClose} className="btn" style={{ background: 'rgba(255,255,255,.2)', color: '#fff' }}>Cerrar</button>
          </div>
        </div>
        <div className="row gap-16" style={{ alignItems: 'flex-start' }}>
          <BrochurePage1 property={property}/>
          <BrochurePage2 property={property} contacto={contacto}/>
        </div>
      </div>
    </div>
  );
}

function BrochurePage1({ property }) {
  const p = property || {};
  const title = p.title || p.titulo || 'Tu propiedad';
  const address = p.address || [p.neighborhood || p.barrio, p.city || p.ciudad].filter(Boolean).join(', ') || '';
  const priceNum = Number(p.price ?? p.precio) || 0;
  const opVenta = (p.operacion || '') === 'venta';
  const beds = p.beds ?? p.dormitorios;
  const baths = p.baths ?? p.banos;
  const m2 = p.m2 ?? p.superficie_m2;
  const desc = p.desc || p.descripcion || '';
  // Sin foto -> null (placeholder), NO una imagen random (photo()).
  const cover = p.cover || p.cover_url || null;
  // Galeria: solo si la propiedad trae varias fotos reales.
  const gallery = Array.isArray(p.photos)
    ? p.photos.map(x => (typeof x === 'string' ? x : (x && x.url))).filter(Boolean).slice(0, 3)
    : [];
  return (
    <div style={{ background: '#fff', width: '50%', aspectRatio: '0.707', boxShadow: '0 20px 40px rgba(0,0,0,.3)', borderRadius: 4, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: 'var(--blue)', color: '#fff', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: 'Montserrat', fontWeight: 900, fontSize: 14, letterSpacing: '.04em' }}>ALQUILOYA</span>
        {(p.verified || p.verificada) ? <span className="badge badge-verified" style={{ fontSize: 9 }}><I.check s={8}/> Verificado</span> : null}
      </div>
      {cover ? (
        <Photo src={cover} style={{ height: '38%', borderRadius: 0 }}/>
      ) : (
        <div style={{ height: '38%', background: 'var(--bg-3)', color: 'var(--ink-4)', display: 'grid', placeItems: 'center', fontSize: 10, gap: 4 }}>
          <I.grid s={22}/>
          <span>Sin imagen</span>
        </div>
      )}
      <div style={{ padding: '14px 16px', flex: 1 }}>
        <div style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 14, lineHeight: 1.2 }}>{title}</div>
        {address ? <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 2 }}>{address}</div> : null}
        {priceNum > 0 ? (
          <div style={{ fontFamily: 'Montserrat', fontWeight: 900, fontSize: 18, color: 'var(--blue)', marginTop: 8 }}>
            Gs. {priceNum.toLocaleString('es-PY')}<span style={{ fontSize: 9, fontWeight: 500, color: 'var(--ink-3)' }}>{opVenta ? '' : ' / mes'}</span>
          </div>
        ) : null}
        <div className="row gap-10" style={{ marginTop: 8, fontSize: 9.5, color: 'var(--ink-2)' }}>
          {beds != null ? <span><I.bed s={10}/> {beds} dorm</span> : null}
          {baths != null ? <span><I.bath s={10}/> {baths} baño{Number(baths) === 1 ? '' : 's'}</span> : null}
          {m2 != null && Number(m2) > 0 ? <span><I.ruler s={10}/> {m2} m²</span> : null}
        </div>
        {desc ? (
          <div style={{ fontSize: 8.5, color: 'var(--ink-3)', marginTop: 10, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {desc}
          </div>
        ) : null}
        {gallery.length > 0 ? (
          <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
            {gallery.map((src, i) => <Photo key={i} src={src} style={{ aspectRatio: '1', borderRadius: 2 }}/>)}
          </div>
        ) : null}
      </div>
      <div style={{ borderTop: '1px solid var(--line-2)', padding: '8px 16px', fontSize: 8, color: 'var(--ink-3)', textAlign: 'center' }}>
        Página 1 · alquiloya.com.py
      </div>
    </div>
  );
}

function BrochurePage2({ property, contacto }) {
  const p = property || {};
  const feats = Array.isArray(p.features) && p.features.length ? p.features : null;
  const qrId = p.codigo || p.legacyId || (p.apiId ? String(p.apiId).slice(0, 8) : 'AY');
  const hasCoords = typeof p.lat === 'number' && typeof p.lng === 'number';
  // Texto de ubicacion real (barrio / ciudad). Es el dato compartible que
  // antes no aparecia — el mapa decorativo no alcanzaba.
  const ubicTexto = [p.barrio || p.neighborhood, p.ciudad || p.city].filter(Boolean).join(', ');
  // Linea de contacto: datos reales del publicador. Si no hay, no inventamos.
  const cName = (contacto && contacto.nombre) || '';
  const cPhone = (contacto && (contacto.telefono || contacto.whatsapp)) || '';
  const footer = [cName, cPhone].filter(Boolean).join(' · ');
  return (
    <div style={{ background: '#fff', width: '50%', aspectRatio: '0.707', boxShadow: '0 20px 40px rgba(0,0,0,.3)', borderRadius: 4, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: 'var(--blue)', color: '#fff', padding: '12px 16px' }}>
        <span style={{ fontFamily: 'Montserrat', fontWeight: 900, fontSize: 14, letterSpacing: '.04em' }}>ALQUILOYA</span>
      </div>
      <div style={{ padding: '14px 16px', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {feats ? (
          <div>
            <div style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 12 }}>Características destacadas</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 6 }}>
              {feats.slice(0, 8).map(f => (
                <div key={f} className="row gap-4" style={{ fontSize: 9, color: 'var(--ink-2)' }}>
                  <I.check s={8}/> {f}
                </div>
              ))}
            </div>
          </div>
        ) : null}
        <div>
          <div style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 12 }}>Ubicación</div>
          {/* Texto de ubicacion real — el dato que el cliente echaba en falta. */}
          {ubicTexto ? (
            <div className="row gap-4" style={{ fontSize: 10, color: 'var(--ink-2)', fontWeight: 600, marginTop: 4 }}>
              <I.pin s={10}/> {ubicTexto}
            </div>
          ) : null}
          <div style={{ marginTop: 6, borderRadius: 4, overflow: 'hidden' }}>
            {/* Mapa REAL: coords exactas -> punto; sin coords pero con ciudad
                conocida -> centrado en la ciudad; ultimo recurso -> mapa
                neutro. Usa los helpers exportados por detail.jsx. */}
            {(() => {
              const Leaflet = typeof window !== 'undefined' ? window.LeafletReadOnlyMap : null;
              const cityCoords = typeof window !== 'undefined' && window.CITY_COORDS && window.normalizeCity
                ? window.CITY_COORDS[window.normalizeCity(p.ciudad || p.city)]
                : null;
              if (Leaflet && hasCoords) {
                return <Leaflet lat={p.lat} lng={p.lng} height={110} zoom={17}/>;
              }
              if (Leaflet && cityCoords) {
                return <Leaflet lat={cityCoords[0]} lng={cityCoords[1]} height={110} approximate zoom={13} radius={1500}/>;
              }
              return <MiniMap height={110} pins={0}/>;
            })()}
          </div>
          <div className="muted" style={{ fontSize: 8, marginTop: 4 }}>Ubicación del inmueble en el mapa.</div>
        </div>
        <div style={{ marginTop: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
          {/* QR REAL escaneable: abre la ficha (deep-link ?prop=<uuid>). */}
          {(() => {
            const pid = p.apiId || p.id || '';
            const origin = (typeof window !== 'undefined' && window.location && window.location.origin) || 'https://alquiloya.com.py';
            const data = encodeURIComponent(origin + '/?prop=' + encodeURIComponent(pid));
            const src = 'https://api.qrserver.com/v1/create-qr-code/?size=140x140&margin=0&data=' + data;
            return <img src={src} alt={'QR ' + qrId} width={70} height={70} style={{ display: 'block' }}/>;
          })()}
          <div style={{ fontSize: 9, color: 'var(--ink-2)', flex: 1 }}>
            <div style={{ fontWeight: 700, marginBottom: 2 }}>Escaneá para ver online</div>
            <div className="muted" style={{ fontSize: 8 }}>Más fotos, calendario y contacto directo por WhatsApp</div>
          </div>
        </div>
        {footer ? (
          <div style={{ borderTop: '1px solid var(--line-2)', paddingTop: 8, fontSize: 8, color: 'var(--ink-3)', textAlign: 'center' }}>
            {footer} · Página 2
          </div>
        ) : (
          <div style={{ borderTop: '1px solid var(--line-2)', paddingTop: 8, fontSize: 8, color: 'var(--ink-3)', textAlign: 'center' }}>
            Página 2 · alquiloya.com.py
          </div>
        )}
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

// ─────────────────────────────────────────────────────────────────────────────
// AgentPickerModal — solo lo usa el flujo "que un agente publique por mi" del
// propietario logueado en el wizard. Lista agentes activos de AlquiloYa, deja
// elegir uno, opcionalmente escribir un mensaje, y crea una captacion via
// POST /api/public/alquiloya/captaciones. La captacion aparece en el panel
// del agente elegido (Captaciones).
// ─────────────────────────────────────────────────────────────────────────────
function AgentPickerModal({ defaultContact, propertyContext, onClose }) {
  const [agentes, setAgentes] = React.useState(null); // null = loading
  const [error, setError] = React.useState(null);
  const [pickedId, setPickedId] = React.useState(null);
  const [mensaje, setMensaje] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  // Datos de contacto del propietario. Si vinieron prefilled del wizard
  // (ctxPropietario o form), arrancan llenos; si no, los pide al usuario
  // dentro del modal. Esto cubre el caso anonimo (sin sesion).
  const dc = defaultContact || {};
  const [contactNombre, setContactNombre] = React.useState(dc.nombre || '');
  const [contactEmail, setContactEmail] = React.useState(dc.email || '');
  const [contactTelefono, setContactTelefono] = React.useState(dc.telefono || '');

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/public/alquiloya/agentes', { cache: 'no-store' });
        const b = await r.json().catch(() => ({}));
        if (!r.ok || !b?.success) throw new Error(b?.error || ('HTTP ' + r.status));
        const arr = Array.isArray(b?.data?.agentes) ? b.data.agentes.filter(a => a.activo !== false) : [];
        if (!cancelled) setAgentes(arr);
      } catch (e) {
        if (!cancelled) { setError(e?.message || 'Error'); setAgentes([]); }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const enviar = async () => {
    if (!pickedId || submitting) return;
    const nombre = contactNombre.trim();
    const email = contactEmail.trim();
    const telefono = contactTelefono.trim();
    if (!nombre) {
      if (window.ayToast) window.ayToast('Ingresá tu nombre.', { variant: 'error' });
      return;
    }
    if (!email && !telefono) {
      if (window.ayToast) window.ayToast('Ingresá email o teléfono para que el agente te contacte.', { variant: 'error' });
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch('/api/public/alquiloya/captaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          agente_id: pickedId,
          propietario_nombre: nombre,
          propietario_email: email || null,
          propietario_telefono: telefono || null,
          // Contexto del inmueble que cargo el usuario en el wizard (si ya
          // toco algo). Asi al agente le llega la captacion con datos
          // tangibles y no tiene que arrancar de cero.
          propiedad_titulo: (propertyContext && propertyContext.propiedad_titulo) || null,
          tipo_propiedad:   (propertyContext && propertyContext.tipo_propiedad)   || null,
          ciudad:           (propertyContext && propertyContext.ciudad)           || null,
          barrio:           (propertyContext && propertyContext.barrio)           || null,
          direccion:        (propertyContext && propertyContext.direccion)        || null,
          precio_estimado:  (propertyContext && propertyContext.precio_estimado)  || null,
          mensaje: mensaje || null,
          origen: 'panel_propietario_publish',
        }),
      });
      const b = await r.json().catch(() => ({}));
      if (!r.ok || !b?.success) throw new Error(b?.error || ('HTTP ' + r.status));
      if (window.ayToast) window.ayToast('Le llegó tu solicitud. El agente te va a contactar pronto.', {
        title: '¡Listo!', variant: 'success', duration: 7000,
      });
      onClose && onClose();
      // Si tenia sesion de propietario lo mandamos a su panel. Si era
      // anonimo, lo dejamos en home — no tiene a donde ir y forzar el
      // hash #admin-agent termina en un panel sin login que se redirige
      // (peor UX que quedarse donde estaba).
      try {
        if (defaultContact && defaultContact.nombre && window.location.hash !== '#publish') {
          // Caso raro: cerrado desde otra ruta. Lo dejamos.
        } else {
          window.location.hash = '';
        }
      } catch {}
    } catch (e) {
      if (window.ayToast) window.ayToast(e?.message || 'No se pudo enviar la solicitud.', { variant: 'error', title: 'Error' });
    } finally {
      setSubmitting(false);
    }
  };

  return ReactDOM.createPortal(
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(11,22,34,.55)', zIndex: 220,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, overflowY: 'auto'
    }}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{
        maxWidth: 720, width: '100%', background: '#fff', position: 'relative',
        maxHeight: 'calc(100dvh - 40px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0,
        margin: 'auto 0'
      }}>
        <button onClick={onClose} style={{
          position: 'absolute', top: 14, right: 14, background: 'var(--bg-2)', border: 'none',
          width: 32, height: 32, borderRadius: 8, cursor: 'pointer', display: 'grid', placeItems: 'center', zIndex: 2
        }}><I.x s={14}/></button>

        <div style={{ padding: '24px 28px 16px', borderBottom: '1px solid var(--line-2)' }}>
          <div className="tag">Solicitar agente</div>
          <h3 style={{ fontSize: 22, marginTop: 6 }}>Elegí un agente para que publique por vos</h3>
          <p className="muted" style={{ fontSize: 13.5, marginTop: 6, lineHeight: 1.5 }}>
            Le va a llegar la solicitud a su panel de captaciones. Te contacta por WhatsApp para coordinar fotos, datos y publicación.
          </p>
        </div>

        <div style={{ padding: '16px 28px', overflowY: 'auto', flex: 1, minHeight: 0 }}>
          {agentes === null && (
            <div className="muted" style={{ textAlign: 'center', padding: '30px 0' }}>Cargando agentes…</div>
          )}
          {agentes && agentes.length === 0 && (
            <div className="muted" style={{ textAlign: 'center', padding: '30px 0' }}>
              {error ? ('No pudimos cargar los agentes: ' + error) : 'No hay agentes disponibles por ahora.'}
            </div>
          )}
          {agentes && agentes.length > 0 && (
            <div className="col gap-8">
              {agentes.map(a => {
                const picked = pickedId === a.id;
                return (
                  <button key={a.id} type="button" onClick={() => setPickedId(a.id)} className="card" style={{
                    padding: 12, textAlign: 'left',
                    border: '2px solid ' + (picked ? 'var(--blue)' : 'var(--line)'),
                    background: picked ? 'var(--blue-50)' : '#fff',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
                  }}>
                    <span style={{
                      width: 20, height: 20, borderRadius: '50%',
                      border: '2px solid ' + (picked ? 'var(--blue)' : 'var(--line)'),
                      background: picked ? 'var(--blue)' : '#fff',
                      display: 'grid', placeItems: 'center', color: '#fff', flexShrink: 0,
                    }}>{picked && <I.check s={10}/>}</span>
                    {a.foto_url ? (
                      <Photo src={a.foto_url} style={{ width: 44, height: 44, borderRadius: '50%', flexShrink: 0 }}/>
                    ) : (
                      <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--bg-3)', color: 'var(--ink-4)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                        <I.user s={18}/>
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{a.nombre || 'Agente'}</div>
                      <div className="muted xs" style={{ marginTop: 2 }}>
                        {a.cargo || 'Agente AlquiloYa'}{a.propiedades_count != null ? ` · ${a.propiedades_count} publicaciones` : ''}
                      </div>
                      {/* Calificacion: 5 estrellas pintadas segun rating (0..5) + numero
                          de resenas aprobadas. Si todavia no tiene resenas mostramos
                          "Sin reseñas" para no engañar con 0 estrellas. */}
                      <AgentStars rating={Number(a.rating) || 0} count={Number(a.resenas_count) || 0}/>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Datos de contacto. Prefilled si el usuario esta logueado o ya
              cargo algo en el wizard; si no, los pide aca. */}
          <div style={{ marginTop: 16, padding: 14, background: 'var(--bg-2)', borderRadius: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Tus datos de contacto *</div>
            <div className="field" style={{ marginBottom: 10 }}>
              <label>Nombre y apellido *</label>
              <input
                className="input"
                value={contactNombre}
                onChange={(e) => setContactNombre(e.target.value.slice(0, 160))}
                placeholder="Ej: María González"
              />
            </div>
            <div className="row gap-10" style={{ flexWrap: 'wrap' }}>
              <div className="field" style={{ flex: '1 1 220px' }}>
                <label>Email</label>
                <input
                  type="email"
                  className="input"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value.slice(0, 160))}
                  placeholder="usuario@dominio.com"
                />
              </div>
              <div className="field" style={{ flex: '1 1 220px' }}>
                <label>Teléfono / WhatsApp</label>
                <input
                  className="input"
                  value={contactTelefono}
                  onChange={(e) => setContactTelefono(e.target.value.slice(0, 40))}
                  placeholder="+595 ..."
                />
              </div>
            </div>
            <div className="muted xs" style={{ marginTop: 6 }}>Email o teléfono — al menos uno para que el agente te contacte.</div>
          </div>

          <div className="field" style={{ marginTop: 16 }}>
            <label>Mensaje para el agente (opcional)</label>
            <textarea
              className="input"
              rows={3}
              placeholder="Contale brevemente qué propiedad querés publicar (tipo, ubicación, precio orientativo)."
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value.slice(0, 1000))}
              style={{ resize: 'vertical' }}
            />
          </div>
        </div>

        <div style={{
          padding: '14px 28px', borderTop: '1px solid var(--line-2)', background: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexShrink: 0,
        }}>
          <span className="muted xs">El agente te va a contactar por WhatsApp / email.</span>
          <div className="row gap-10">
            <button className="btn btn-outline" onClick={onClose} disabled={submitting}>Cancelar</button>
            <button
              className="btn btn-blue"
              onClick={enviar}
              disabled={!pickedId || submitting}
              style={{ opacity: (!pickedId || submitting) ? .5 : 1, cursor: (!pickedId || submitting) ? 'not-allowed' : 'pointer' }}
            >
              {submitting ? 'Enviando…' : <>Enviar solicitud <I.check s={14}/></>}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// Estrellas compactas usadas en cada card del AgentPickerModal. Dibujamos 5
// estrellas con SVG superpuestos: la base gris siempre se ve, y encima
// ponemos otra capa amarilla con `width` proporcional al rating. Esto soporta
// medios decimales (4.3 → 4 enteras + 30% de la quinta).
function AgentStars({ rating, count }) {
  const r = Math.max(0, Math.min(5, Number(rating) || 0));
  const pct = (r / 5) * 100;
  const Star = ({ fill }) => (
    <svg viewBox="0 0 20 20" width="14" height="14" style={{ display: 'block' }}>
      <path d="M10 1.5l2.6 5.3 5.9.9-4.25 4.15 1 5.85L10 14.95 4.75 17.7l1-5.85L1.5 7.7l5.9-.9z"
        fill={fill} stroke="none"/>
    </svg>
  );
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
      <div style={{ position: 'relative', display: 'inline-block', height: 14 }}>
        <div style={{ display: 'flex', gap: 1 }}>
          {[0,1,2,3,4].map(i => <Star key={'b'+i} fill="#e2e8f0"/>)}
        </div>
        <div style={{ position: 'absolute', inset: 0, width: pct + '%', overflow: 'hidden' }}>
          <div style={{ display: 'flex', gap: 1 }}>
            {[0,1,2,3,4].map(i => <Star key={'f'+i} fill="#F9B000"/>)}
          </div>
        </div>
      </div>
      {count > 0
        ? <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>
            <strong style={{ color: 'var(--ink-2)' }}>{r.toFixed(1)}</strong> ({count} reseña{count === 1 ? '' : 's'})
          </span>
        : <span style={{ fontSize: 11.5, color: 'var(--ink-4)' }}>Sin reseñas todavía</span>}
    </div>
  );
}

// Paso "Solicitar plan" para agentes que todavía no tienen plan asignado.
// En vez de bloquearles el wizard con un mensaje, les ofrecemos elegir un
// plan y mandar una solicitud de cambio_plan al admin. Mientras la solicitud
// no esté enviada, el wizard no avanza (validateStep lo bloquea). Una vez
// enviada, el agente sabe que tiene que esperar la aprobación.
function StepRequestAgentPlan({ form, setF, ctxAgente }) {
  const [apiPlans, setApiPlans] = React.useState(null);
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState(null);
  React.useEffect(() => {
    let cancelled = false;
    fetch('/api/public/alquiloya/planes-publicacion', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : Promise.reject(new Error('http ' + r.status)))
      .then(body => {
        if (cancelled) return;
        const arr = body && body.success && body.data && Array.isArray(body.data.planes) ? body.data.planes : null;
        if (!arr || arr.length === 0) return;
        setApiPlans(arr.map(p => ({
          tier: p.tier,
          target: p.target,
          name: p.nombre,
          price: Number(p.precio) || 0,
          billing: p.billing,
          badge: p.badge,
          bullets: Array.isArray(p.bullets) ? p.bullets : [],
          highlighted: !!p.highlighted,
        })));
      })
      .catch(() => { /* fallback abajo */ });
    return () => { cancelled = true; };
  }, []);
  const source = apiPlans || (typeof PLANS !== 'undefined' ? PLANS : []);
  const list = source.filter(p => p.tier && String(p.tier).includes('agent'));
  const picked = form.plan_request_tier || '';
  const sent = !!form.plan_request_sent;

  async function enviar() {
    if (!picked) { setError('Elegí un plan.'); return; }
    setError(null); setSending(true);
    try {
      const planRow = list.find(p => p.tier === picked);
      const payload = {
        kind: 'cambio_plan',
        plan_tier: picked,
        nombre: ctxAgente?.nombre || form.propietario_nombre || 'Agente',
        email: ctxAgente?.email || form.propietario_email || null,
        telefono: ctxAgente?.telefono || ctxAgente?.whatsapp || form.propietario_telefono || null,
        mensaje: 'Solicitud generada desde el wizard de publicar inmueble. Plan elegido: ' + (planRow?.name || picked) + '.',
      };
      const res = await fetch('/api/public/alquiloya/solicitudes-servicio', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) throw new Error(data.error || ('HTTP ' + res.status));
      setF({ plan_request_sent: true, plan_request_tier: picked });
      if (window.ayToast) window.ayToast('Solicitud de plan enviada.', { variant: 'success', duration: 5000 });
    } catch (e) {
      setError('No pudimos enviar tu solicitud. ' + (e && e.message ? e.message : ''));
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div>
        <div className="tag">Paso 1</div>
        <h3 style={{ fontSize: 22, marginTop: 6 }}>Solicitud de plan enviada</h3>
        <div className="card" style={{
          marginTop: 16, padding: 22, background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#10b981', color: '#fff', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <I.check s={20}/>
            </div>
            <div>
              <div style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 17, color: '#065f46' }}>Recibimos tu solicitud</div>
              <div style={{ marginTop: 4, fontSize: 13.5, lineHeight: 1.5 }}>
                Vamos a contactarte para coordinar la activación de tu plan. Una vez aprobado, vas a poder publicar inmuebles desde este mismo wizard.
              </div>
            </div>
          </div>
        </div>
        <div className="muted" style={{ marginTop: 14, fontSize: 13 }}>
          Mientras tanto, podés volver al panel y seguir gestionando tus captaciones.
        </div>
        <div style={{ marginTop: 14 }}>
          <a className="btn btn-outline" href="#admin-agent">← Volver al panel</a>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="tag">Paso 1</div>
      <h3 style={{ fontSize: 22, marginTop: 6 }}>Solicitá tu plan para publicar</h3>
      <p className="muted" style={{ fontSize: 14, marginTop: 6 }}>
        Como agente, necesitás un plan activo para publicar inmuebles. Elegí uno y nuestro equipo te contacta para activarlo.
      </p>
      <div className="col gap-12" style={{ marginTop: 20 }}>
        {list.map(p => {
          const sel = picked === p.tier;
          return (
            <button key={p.tier} type="button" onClick={() => setF({ plan_request_tier: p.tier })} className="card" style={{
              padding: 18, textAlign: 'left',
              border: '2px solid ' + (sel ? 'var(--blue)' : 'var(--line)'),
              background: sel ? 'var(--blue-50)' : '#fff',
              cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16
            }}>
              <div className="row gap-14">
                <span style={{
                  width: 22, height: 22, borderRadius: '50%',
                  border: '2px solid ' + (sel ? 'var(--blue)' : 'var(--line)'),
                  background: sel ? 'var(--blue)' : '#fff',
                  display: 'grid', placeItems: 'center', color: '#fff'
                }}>{sel && <I.check s={12}/>}</span>
                <div>
                  <div className="row gap-8">
                    <div style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 17 }}>{p.name}</div>
                    {p.badge && <span className="badge badge-featured" style={{ fontSize: 10 }}>{p.badge}</span>}
                  </div>
                  <div className="muted xs">{(p.bullets || [])[0]} {(p.bullets || [])[1] ? '· ' + p.bullets[1] : ''}</div>
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 18, color: 'var(--ink)' }}>
                  {p.price > 0 ? formatGs(p.price) : 'Gratis'}
                </div>
                <div className="muted xs">{p.billing || ''}</div>
              </div>
            </button>
          );
        })}
        {list.length === 0 && (
          <div className="muted" style={{ fontSize: 13 }}>No hay planes disponibles. Contactanos por WhatsApp.</div>
        )}
      </div>
      {error && (
        <div style={{ marginTop: 14, padding: '10px 12px', background: '#fdecec', borderRadius: 10, border: '1px solid #f3c2c2', color: '#a8312f', fontSize: 13 }}>
          {error}
        </div>
      )}
      <div style={{ marginTop: 18 }}>
        <button type="button" className="btn btn-primary" disabled={!picked || sending} onClick={enviar}
          style={{ opacity: !picked || sending ? 0.6 : 1 }}>
          {sending ? 'Enviando…' : <>Enviar solicitud <I.arrow s={14}/></>}
        </button>
      </div>
    </div>
  );
}

Object.assign(window, { PublishPage, BrochurePreviewModal, ConfirmPublishModal, AgentPickerModal, AgentStars, StepRequestAgentPlan });
