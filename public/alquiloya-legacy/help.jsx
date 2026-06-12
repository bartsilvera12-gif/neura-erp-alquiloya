// Página de Ayuda — FAQ + canales de contacto

function HelpPage({ onNav }) {
  const [cat, setCat] = React.useState('todos');
  const [query, setQuery] = React.useState('');

  const categories = [
    { id: 'todos',         label: 'Todas',              icon: 'grid' },
    { id: 'inquilinos',    label: 'Para inquilinos',    icon: 'search' },
    { id: 'propietarios',  label: 'Para propietarios',  icon: 'house' },
    { id: 'agentes',       label: 'Para agentes',       icon: 'shield' },
    { id: 'pagos',         label: 'Planes y pagos',     icon: 'doc' },
    { id: 'verificacion',  label: 'Verificación',       icon: 'check' },
  ];

  const faqs = [
    { cat: 'inquilinos', q: '¿Cómo contacto al propietario o agente?',
      a: 'En cada inmueble vas a ver un botón "Consultar por WhatsApp" que te conecta directo. También podés solicitar una visita o mandar un mensaje desde la ficha.' },
    { cat: 'inquilinos', q: '¿AlquiloYa cobra comisión por alquilar?',
      a: 'No. El contacto es directo entre vos y el propietario/agente. AlquiloYa cobra solo por los planes premium a quienes publican.' },
    { cat: 'inquilinos', q: '¿Cómo sé si una propiedad es real?',
      a: 'Buscá el badge azul "Verificado". Significa que nuestro equipo confirmó documentación, ubicación y fotos reales del inmueble.' },
    { cat: 'inquilinos', q: '¿Puedo agendar una visita desde la plataforma?',
      a: 'Sí. En cada inmueble está el botón "Solicitar visita". El propietario/agente recibe la solicitud y coordina contigo por WhatsApp.' },

    { cat: 'propietarios', q: '¿Es gratis publicar mi inmueble?',
      a: 'Sí. Con el Plan Gratuito publicás 1 propiedad por 30 días con hasta 5 fotos y contacto por WhatsApp.' },
    { cat: 'propietarios', q: '¿Cuál es la diferencia entre Plan Básico y Gratuito?',
      a: 'El Plan Básico (Gs. 49.000 pago único, 30 días) te da Máxima Prioridad en búsquedas. El Gratuito es la opción estándar sin prioridad.' },
    { cat: 'propietarios', q: '¿Puedo cederle la gestión a un agente?',
      a: 'Sí. En el paso 4 del wizard de publicación elegís "Cederlo a un agente" y seleccionás uno del directorio. El agente gestiona consultas, visitas y cierre — cobra comisión solo si alquila.' },
    { cat: 'propietarios', q: '¿Puedo editar la publicación después de publicar?',
      a: 'Sí. Desde tu panel podés editar fotos, precio, descripción o pausar la publicación cuando quieras.' },

    { cat: 'agentes', q: '¿Cómo funciona el sistema de captación?',
      a: 'Cuando un propietario te cede la gestión, la propiedad queda asociada a tu perfil. Vas a ver todas tus captaciones en tu panel y vas a poder marcarlas como alquiladas para registrar la comisión.' },
    { cat: 'agentes', q: '¿Qué son los impulsos?',
      a: '1 impulso = 7 días destacado en home y catálogo. Starter incluye 3 impulsos gratis por mes, Premium incluye 10. Si necesitás más, comprás packs (desde Gs. 13.960 c/u).' },
    { cat: 'agentes', q: '¿Qué es el programa de referidos?',
      a: 'Todo usuario tiene un link único. Tier Estándar: 10% de comisión sobre el primer pago del referido. Tier Influencer (por invitación): 25% recurrente durante 6 meses.' },
    { cat: 'agentes', q: '¿Cómo subo de nivel (Junior → Pro → Top Pro)?',
      a: 'Tu nivel se calcula automáticamente con: propiedades activas, alquileres cerrados, antigüedad, aportes al blog y reseñas de clientes. Cuanto más alto el nivel, mayor visibilidad en el directorio.' },

    { cat: 'pagos', q: '¿Qué medios de pago aceptan?',
      a: 'Tarjeta de crédito/débito vía Bancard y Pagopar. También aceptamos transferencia bancaria para planes anuales.' },
    { cat: 'pagos', q: '¿Puedo cancelar mi suscripción cuando quiera?',
      a: 'Sí. Desde tu panel podés cancelar la suscripción recurrente. Mantenés los beneficios hasta que termine el período pago.' },
    { cat: 'pagos', q: '¿Los impulsos vencen?',
      a: 'No. Los impulsos comprados quedan disponibles en tu wallet sin vencimiento. Los gratis del plan se renuevan el 1° de cada mes.' },
    { cat: 'pagos', q: '¿Emiten factura legal?',
      a: 'Sí. Al pagar te enviamos automáticamente la factura electrónica al email registrado.' },

    { cat: 'verificacion', q: '¿Qué documentos pide la verificación de inmueble?',
      a: 'Cuatro documentos obligatorios: Cuenta Corriente Catastral (CCC), Cédula Catastral o Escritura, NIS de ANDE con última factura, y CI del propietario (frente + dorso).' },
    { cat: 'verificacion', q: '¿Cuánto tarda la verificación?',
      a: 'Menos de 24 horas hábiles. Recibís el resultado por email y WhatsApp.' },
    { cat: 'verificacion', q: '¿Cuánto cuesta verificar un inmueble?',
      a: 'Gs. 45.000 por inmueble. Vigencia 12 meses. Incluye badge azul "Verificado" + prioridad en resultados + hasta 340% más vistas.' },
    { cat: 'verificacion', q: '¿Qué pasa si rechazan mi verificación?',
      a: 'Te avisamos el motivo y podés corregir los datos para re-enviar la solicitud sin costo adicional.' },
  ];

  const filtered = faqs.filter(f =>
    (cat === 'todos' || f.cat === cat) &&
    (!query || (f.q + ' ' + f.a).toLowerCase().includes(query.toLowerCase()))
  );

  return (
    <div className="fade-in" style={{ background: 'var(--bg-2)', minHeight: '100vh' }}>
      {/* Hero */}
      <section style={{ background: 'linear-gradient(135deg, var(--blue) 0%, #003e74 100%)', color: '#fff', padding: '64px 0 80px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -100, right: -100, width: 400, height: 400, borderRadius: '50%', background: 'rgba(249,176,0,.15)' }}/>
        <div style={{ position: 'absolute', bottom: -120, left: -100, width: 360, height: 360, borderRadius: '50%', background: 'rgba(255,255,255,.06)' }}/>
        <div className="container" style={{ position: 'relative' }}>
          <div className="tag" style={{ color: 'var(--yellow)' }}>Centro de ayuda</div>
          <h1 style={{ color: '#fff', fontSize: 48, marginTop: 12 }}>¿En qué te podemos ayudar?</h1>
          <p style={{ marginTop: 14, fontSize: 17, color: 'rgba(255,255,255,.92)', maxWidth: 560, margin: '14px auto 0' }}>
            Buscá tu duda o explorá las preguntas más frecuentes. Si no encontrás lo que buscás, contactanos.
          </p>
          <div style={{ maxWidth: 560, margin: '32px auto 0', position: 'relative' }}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar en preguntas frecuentes…"
              className="input"
              style={{ padding: '16px 20px 16px 52px', fontSize: 15, borderRadius: 14, border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,.2)' }}
            />
            <span style={{ position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)' }}>
              <I.search s={20}/>
            </span>
          </div>
        </div>
      </section>

      {/* Quick contact cards — centralizado en window.CONTACTO_ALQUILOYA */}
      <div className="container" style={{ marginTop: -40, position: 'relative' }}>
        {(() => {
          const C = (typeof window !== 'undefined' && window.CONTACTO_ALQUILOYA) || {
            whatsapp: '595983000292',
            whatsappLabel: '0983 000 292',
            email: 'Info@alquiloya.com.py',
          };
          // A pedido del cliente: el email del centro de ayuda usa el MISMO
          // valor que el del footer (C.email). Si CONTACTO_ALQUILOYA no
          // expone .email, caemos a Info@alquiloya.com.py (mismo default
          // que el footer en shared.jsx) para que nunca diverjan.
          const emailHelp = C.email || 'Info@alquiloya.com.py';
          return (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
              <ContactCard
                icon="whats" color="#25D366"
                title="WhatsApp"
                desc="Respondemos en menos de 10 minutos en horario hábil"
                cta={'Escribir a ' + C.whatsappLabel}
                href={'https://wa.me/' + C.whatsapp}
              />
              <ContactCard
                icon="doc" color="#6e3ad1"
                title="Email"
                desc="Para consultas detalladas o adjuntar documentación"
                cta={emailHelp}
                href={'mailto:' + emailHelp}
              />
            </div>
          );
        })()}
      </div>

      {/* FAQ — two column: sidebar of categories + numbered question list */}
      <div className="container" style={{ marginTop: 48, paddingBottom: 60 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 28, alignItems: 'flex-start' }}>
          {/* Sidebar */}
          <aside style={{ position: 'sticky', top: 100 }}>
            <div className="tag" style={{ marginBottom: 12 }}>Categorías</div>
            <div className="col gap-4">
              {categories.map(c => {
                const total = c.id === 'todos' ? faqs.length : faqs.filter(f => f.cat === c.id).length;
                const active = cat === c.id;
                return (
                  <button key={c.id} onClick={() => setCat(c.id)} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 14px', borderRadius: 10,
                    background: active ? 'var(--blue)' : 'transparent',
                    color: active ? '#fff' : 'var(--ink-2)',
                    border: 'none', cursor: 'pointer',
                    fontSize: 13.5, fontWeight: 600, fontFamily: 'inherit',
                    textAlign: 'left', width: '100%',
                    transition: 'background .12s, color .12s'
                  }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ color: active ? 'var(--yellow)' : 'var(--ink-4)' }}>
                        {React.createElement(I[c.icon], { s: 14 })}
                      </span>
                      {c.label}
                    </span>
                    <span style={{
                      fontSize: 11, fontWeight: 700,
                      color: active ? 'var(--yellow)' : 'var(--ink-4)',
                      background: active ? 'rgba(255,255,255,.1)' : 'var(--bg-2)',
                      padding: '2px 8px', borderRadius: 999,
                      minWidth: 24, textAlign: 'center'
                    }}>{total}</span>
                  </button>
                );
              })}
            </div>

            {/* Need help mini card */}
            <div className="card" style={{ marginTop: 18, padding: 16, background: 'linear-gradient(135deg, var(--blue-50), #fff)', border: '1px solid var(--blue-100)' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--blue)', color: '#fff', display: 'grid', placeItems: 'center' }}>
                <I.chat s={18}/>
              </div>
              <div style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 14, marginTop: 12 }}>¿Necesitás ayuda?</div>
              <div className="muted" style={{ fontSize: 11.5, marginTop: 4, lineHeight: 1.45 }}>Te respondemos en menos de 24 hs hábiles.</div>
              {(() => {
                const C = (typeof window !== 'undefined' && window.CONTACTO_ALQUILOYA) || {
                  whatsapp: '595983000292',
                  whatsappLabel: '0983 000 292',
                  email: 'Info@alquiloya.com.py',
                };
                const emailH = C.email || 'Info@alquiloya.com.py';
                return (
                  <>
                    <div className="col gap-6" style={{ marginTop: 12, fontSize: 12, color: 'var(--ink-2)' }}>
                      <div className="row gap-6"><I.whats s={12}/> {C.whatsappLabel}</div>
                      <div className="row gap-6"><I.user s={12}/> {emailH}</div>
                    </div>
                    <a className="btn btn-blue" href={'https://wa.me/' + C.whatsapp} target="_blank" rel="noopener noreferrer" style={{ width: '100%', justifyContent: 'center', marginTop: 12, fontSize: 12.5, padding: '8px 12px' }}>
                      Escribinos →
                    </a>
                  </>
                );
              })()}
            </div>
          </aside>

          {/* FAQ list */}
          <div>
            {filtered.length === 0 ? (
              <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>
                No encontramos resultados para "<strong>{query}</strong>". Probá con otras palabras o contactanos directo.
              </div>
            ) : (
              <div className="col gap-10">
                {filtered.map((f, i) => <FaqItem key={f.q} q={f.q} a={f.a} index={i + 1}/>)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom contact banner */}
      <div className="container" style={{ paddingBottom: 80 }}>
        <div className="card" style={{ padding: 36, background: 'linear-gradient(135deg, var(--yellow-50), #fff)', border: '1px solid #f1d97a', textAlign: 'center' }}>
          <h3 style={{ fontSize: 24 }}>¿No encontraste la respuesta?</h3>
          <p className="muted" style={{ marginTop: 8, fontSize: 14.5 }}>Nuestro equipo de soporte responde de lunes a sábado, de 8:00 a 20:00.</p>
          {(() => {
            const C = (typeof window !== 'undefined' && window.CONTACTO_ALQUILOYA) || {
              whatsapp: '595983000292',
              email: 'Info@alquiloya.com.py',
            };
            const emailH = C.email || 'Info@alquiloya.com.py';
            return (
              <div className="row gap-12" style={{ justifyContent: 'center', marginTop: 22 }}>
                <a className="btn btn-wa btn-lg" href={'https://wa.me/' + C.whatsapp} target="_blank" rel="noopener noreferrer"><I.whats s={16}/> Escribir por WhatsApp</a>
                <a className="btn btn-outline btn-lg" href={'mailto:' + emailH}>Enviar email</a>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

function ContactCard({ icon, color, title, desc, cta, href }) {
  const ctaStyle = { marginTop: 10, fontSize: 12, padding: '6px 12px' };
  return (
    <div className="card" style={{ padding: 16, textAlign: 'center' }}>
      <div style={{
        width: 40, height: 40, borderRadius: 12, background: color + '14', color,
        display: 'grid', placeItems: 'center', margin: '0 auto'
      }}>
        {React.createElement(I[icon], { s: 18 })}
      </div>
      <div style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 14, marginTop: 10 }}>{title}</div>
      <p className="muted" style={{ fontSize: 11.5, marginTop: 4, lineHeight: 1.45 }}>{desc}</p>
      {href ? (
        <a className="btn btn-outline" href={href} target={href.startsWith('http') ? '_blank' : undefined} rel={href.startsWith('http') ? 'noopener noreferrer' : undefined} style={ctaStyle}>{cta}</a>
      ) : (
        <button className="btn btn-outline" style={ctaStyle}>{cta}</button>
      )}
    </div>
  );
}

function FaqItem({ q, a, index }) {
  const [open, setOpen] = React.useState(false);
  const num = String(index || 1).padStart(2, '0');
  return (
    <div className="card" style={{
      padding: 0, overflow: 'hidden',
      border: open ? '1.5px solid var(--blue-100)' : '1px solid var(--line)',
      boxShadow: open ? '0 6px 18px rgba(0,88,165,.08)' : 'var(--shadow-sm)',
      transition: 'border-color .15s, box-shadow .15s',
    }}>
      <button onClick={() => setOpen(!open)} style={{
        width: '100%', background: 'none', border: 'none', padding: '16px 18px', textAlign: 'left', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 14, fontFamily: 'inherit'
      }}>
        <span style={{
          width: 36, height: 36, borderRadius: 10,
          background: open ? 'var(--blue)' : 'var(--blue-50)',
          color: open ? 'var(--yellow)' : 'var(--blue)',
          display: 'grid', placeItems: 'center', flexShrink: 0,
          fontFamily: 'Montserrat', fontWeight: 800, fontSize: 12,
          letterSpacing: '.04em',
          transition: 'background .15s, color .15s',
        }}>{num}</span>
        <span style={{ flex: 1, fontFamily: 'Montserrat', fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>{q}</span>
        <div style={{
          width: 30, height: 30, borderRadius: '50%',
          background: open ? 'var(--blue)' : 'var(--bg-2)',
          color: open ? '#fff' : 'var(--ink-3)',
          display: 'grid', placeItems: 'center', flexShrink: 0, transition: 'all .2s'
        }}>
          {open ? <I.x s={13}/> : <I.plus s={13}/>}
        </div>
      </button>
      {open && (
        <div style={{ padding: '0 18px 18px 68px', color: 'var(--ink-3)', fontSize: 14, lineHeight: 1.65 }}>
          {a}
        </div>
      )}
    </div>
  );
}

Object.assign(window, { HelpPage });
