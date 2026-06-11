// Catálogo / Resultados de búsqueda

// Normaliza strings para comparación tolerante (case + acentos + espacios)
const normLoc = (s) => (s == null ? '' : String(s).trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''));
const eqLoc = (a, b) => normLoc(a) === normLoc(b);
const isAll = (v) => !v || v === 'Todos' || v === 'Todos los barrios' || v === 'Todas las ciudades' || v === 'Todo el país';

// Lista completa de tipos para el selector del catalogo. Los ids coinciden
// con los valores que guarda el backend (TIPOS_OK en la API). Se incluyen
// todos los que figuran en el wizard de publicar mas las variantes "salon
// comercial" / "alquiler temporal" / "casa independiente" que la API tambien
// acepta. Asi cualquier propiedad cargada matchea contra UNA opcion del select.
const CATALOG_TIPOS = [
  { id: 'departamento',      label: 'Departamento' },
  { id: 'casa',              label: 'Casa' },
  { id: 'casa_independiente',label: 'Casa independiente' },
  { id: 'duplex',            label: 'Dúplex' },
  { id: 'duplex_ph',         label: 'Dúplex PH' },
  { id: 'local_comercial',   label: 'Local comercial' },
  { id: 'salon_comercial',   label: 'Salón comercial' },
  { id: 'oficina',           label: 'Oficina' },
  { id: 'terreno',           label: 'Terreno' },
  { id: 'deposito',          label: 'Depósito' },
  { id: 'alquiler_temporal', label: 'Alquiler temporal' },
];

// Mapeo de las 4 categorias "broad" que usan los chips del home a la lista
// de tipos reales del backend. Si el usuario apreta "Departamento" en el
// hero del home, en el catalogo queremos matchear depto + duplex + dpto-ph.
const BROAD_TO_TIPOS = {
  depto:    ['departamento', 'duplex', 'duplex_ph'],
  casa:     ['casa', 'casa_independiente'],
  salon:    ['salon_comercial', 'local_comercial', 'oficina', 'deposito'],
  temporal: ['alquiler_temporal'],
};
function matchTipo(propTipo, selected) {
  if (!selected || selected === 'all') return true;
  const broad = BROAD_TO_TIPOS[selected];
  if (broad) return broad.includes(propTipo);
  return propTipo === selected;
}

function CatalogPage({ onProperty }) {
  const { properties } = useAlquiloYaPublicData();
  const pending = (typeof window !== 'undefined' && window.__pendingSearch) || null;
  const [tipo, setTipo] = React.useState(pending?.tipo || 'all');
  const [sort, setSort] = React.useState('recent');
  const [view, setView] = React.useState('grid');
  const [q, setQ] = React.useState(pending?.q || '');
  const [filters, setFilters] = React.useState({
    depto: pending?.depto || 'Todos',
    ciudad: pending?.ciudad || 'Todos',
    barrio: pending?.barrio || 'Todos',
    min: pending?.priceMin ?? 0, max: pending?.priceMax ?? 20000000,
    areaMin: pending?.areaMin ?? 0, areaMax: pending?.areaMax ?? 500,
    beds: 0, baths: 0,
    amoblado: false, mascotas: false, verified: false, temporal: false,
  });
  React.useEffect(() => { if (window.__pendingSearch) delete window.__pendingSearch; }, []);
  // Match texto libre del input "Buscar por título, ID o ubicación..." contra
  // titulo, codigo, ciudad, barrio, direccion. Normalizamos para tolerar
  // mayusculas y acentos. Si q esta vacio, todas las propiedades pasan.
  const qNorm = normLoc(q);
  const filtered = properties.filter(p => {
    if (qNorm) {
      const hay = [p.title, p.titulo, p.codigo, p.ciudad, p.barrio, p.address, p.direccion]
        .filter(Boolean).map(normLoc).join(' ');
      if (!hay.includes(qNorm)) return false;
    }
    return matchTipo(p.tipo, tipo) &&
      (isAll(filters.ciudad) || eqLoc(p.ciudad, filters.ciudad)) &&
      (isAll(filters.barrio) || eqLoc(p.barrio, filters.barrio)) &&
      p.price >= filters.min && p.price <= filters.max &&
      (!filters.areaMin || p.m2 >= filters.areaMin) &&
      (!filters.areaMax || p.m2 <= filters.areaMax) &&
      (filters.beds === 0 || p.beds >= filters.beds) &&
      (filters.baths === 0 || p.baths >= filters.baths) &&
      (!filters.amoblado || p.amoblado) &&
      (!filters.mascotas || p.mascotas) &&
      (!filters.verified || p.verified) &&
      (!filters.temporal || p.tipo === 'temporal');
  });
  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'priceAsc') return a.price - b.price;
    if (sort === 'priceDesc') return b.price - a.price;
    if (sort === 'featured') return (b.featured?1:0) - (a.featured?1:0);
    return 0;
  });
  return (
    <div className="fade-in">
      <CatalogHeader count={sorted.length} tipo={tipo} setTipo={setTipo} filters={filters} q={q} setQ={setQ} />
      <div className="container" style={{ padding: '24px 32px 32px', display: 'grid', gridTemplateColumns: '290px 1fr', gap: 28 }}>
        <FilterPanel filters={filters} setFilters={setFilters} />
        <div>
          <div className="row between" style={{ marginBottom: 16 }}>
            <div className="row gap-12">
              <span style={{ fontSize: 14, color: 'var(--ink-3)' }}>Ordenar por:</span>
              <PrettySelect value={sort} onChange={setSort} style={{ width: 200 }} options={[
                { value: 'recent', label: 'Más recientes' },
                { value: 'priceAsc', label: 'Menor precio' },
                { value: 'priceDesc', label: 'Mayor precio' },
                { value: 'featured', label: 'Destacados' },
              ]}/>
            </div>
            <div className="row gap-8">
              <button className={"btn btn-sm " + (view === 'grid' ? 'btn-blue' : 'btn-outline')} onClick={() => setView('grid')}><I.grid s={14}/> Grilla</button>
              <button className={"btn btn-sm " + (view === 'map' ? 'btn-blue' : 'btn-outline')} onClick={() => setView('map')}><I.map s={14}/> Mapa</button>
            </div>
          </div>
          {view === 'grid' ? (
            <CatalogGrid properties={sorted} onProperty={onProperty}/>
          ) : (
            <CatalogMap properties={sorted} onProperty={onProperty}/>
          )}
        </div>
      </div>
    </div>
  );
}

function CatalogHeader({ count, tipo, setTipo, filters, q, setQ }) {
  const locParts = [];
  if (filters && !isAll(filters.ciudad)) locParts.push(filters.ciudad);
  if (filters && !isAll(filters.depto))  locParts.push(filters.depto);
  const locLabel = locParts.length ? locParts.join(' · ') : 'Todo el país';
  return (
    <div style={{ background: '#fff', borderBottom: '1px solid var(--line)' }}>
      <div className="container" style={{ padding: '28px 32px 0' }}>
        <div className="row between">
          <div>
            <div className="row gap-8 muted" style={{ fontSize: 13 }}>
              <span>Inicio</span>
              <I.chev s={12}/>
              <span>Alquileres</span>
              <I.chev s={12}/>
              <span style={{ color: 'var(--ink)' }}>{locLabel}</span>
            </div>
            <h2 style={{ marginTop: 8, fontSize: 28 }}><span style={{ color: 'var(--blue)' }}>{count}</span> alquileres encontrados</h2>
            <div style={{ color: 'var(--ink-3)', fontSize: 14, marginTop: 4 }}>Mostrando inmuebles activos · actualizado hace 3 minutos</div>
          </div>
          <div className="card" style={{ padding: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <I.search s={16}/>
            <input
              className="input"
              placeholder="Buscar por título, ID o ubicación..."
              value={q || ''}
              onChange={(e) => setQ && setQ(e.target.value)}
              style={{ border: 'none', padding: 8, width: 340 }}
            />
          </div>
        </div>
        {/* Selector unico de tipo de inmueble. Reemplaza los chips viejos (4
            opciones con ids legacy 'depto/casa/salon/temporal' que no
            matcheaban contra los tipos reales del backend) por un dropdown
            con TODOS los tipos que la API acepta. matchTipo() conserva la
            compat con los chips del home (broad → lista). */}
        <div className="row gap-12" style={{ marginTop: 20, alignItems: 'center', paddingBottom: 16 }}>
          <span style={{ fontSize: 14, color: 'var(--ink-3)', fontWeight: 600 }}>Tipo de inmueble:</span>
          <PrettySelect
            value={tipo}
            onChange={setTipo}
            style={{ width: 260 }}
            options={[
              { value: 'all', label: 'Todos' },
              ...CATALOG_TIPOS.map(t => ({ value: t.id, label: t.label })),
            ]}
          />
        </div>
      </div>
    </div>
  );
}

function CatTab({ icon, label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '12px 18px', border: 'none', background: 'transparent',
      borderBottom: active ? '3px solid var(--blue)' : '3px solid transparent',
      color: active ? 'var(--blue)' : 'var(--ink-3)',
      fontWeight: 600, fontSize: 14, cursor: 'pointer',
      display: 'inline-flex', alignItems: 'center', gap: 8,
      marginBottom: -1
    }}>
      {icon && React.createElement(I[icon], { s: 16 })}
      {label}
    </button>
  );
}

function FilterPanel({ filters, setFilters }) {
  const upd = (k, v) => setFilters(prev => ({ ...prev, [k]: v }));
  return (
    <aside style={{ position: 'sticky', top: 92, alignSelf: 'flex-start' }}>
      <div className="card" style={{ padding: 22 }}>
        <div className="row between" style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 17 }}>Filtros</div>
          <button onClick={() => setFilters({ depto: 'Todos', ciudad: 'Todos', barrio: 'Todos', min: 0, max: 20000000, areaMin: 0, areaMax: 500, beds: 0, baths: 0, amoblado: false, mascotas: false, verified: false, temporal: false })} style={{ background: 'none', border: 'none', color: 'var(--blue)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Limpiar</button>
        </div>
        <FilterGroup title="Ubicación">
          <div style={{ marginBottom: 10 }}>
            <PrettySelect value={filters.depto} onChange={v => setFilters(f => ({ ...f, depto: v, ciudad: 'Todos', barrio: 'Todos' }))} options={['Todos', ...DEPARTAMENTOS]}/>
          </div>
          <div style={{ marginBottom: 10 }}>
            <PrettySelect value={filters.ciudad} onChange={v => setFilters(f => ({ ...f, ciudad: v, barrio: 'Todos' }))} options={['Todos', ...((CIUDADES[filters.depto]) || [])]}/>
          </div>
          <PrettySelect value={filters.barrio} onChange={v => upd('barrio', v)} options={['Todos los barrios', ...BARRIOS]}/>
        </FilterGroup>

        <FilterGroup title="Precio (Gs.)">
          <div className="row gap-8" style={{ marginBottom: 12 }}>
            <input className="input" type="number" value={filters.min}
              onChange={e => {
                const v = Math.max(0, +e.target.value || 0);
                setFilters(f => ({ ...f, min: v, max: Math.max(v, f.max) }));
              }}
              style={{ padding: '8px 10px', fontSize: 13 }}/>
            <span style={{ color: 'var(--ink-4)' }}>—</span>
            <input className="input" type="number" value={filters.max}
              onChange={e => {
                const v = Math.max(0, +e.target.value || 0);
                setFilters(f => ({ ...f, max: v, min: Math.min(v, f.min) }));
              }}
              style={{ padding: '8px 10px', fontSize: 13 }}/>
          </div>
          <DraggableRange
            min={0} max={20000000} step={100000}
            valueMin={filters.min} valueMax={filters.max}
            onChange={(a, b) => setFilters(f => ({ ...f, min: a, max: b }))}
          />
          <div className="row between" style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 8 }}>
            <span>Gs. 0</span><span>Gs. 20.000.000</span>
          </div>
        </FilterGroup>

        <FilterGroup title="Habitaciones">
          <PillRow values={[0,1,2,3,4]} value={filters.beds} onChange={v => upd('beds', v)} labelFn={v => v === 0 ? 'Todas' : v + '+'} />
        </FilterGroup>

        <FilterGroup title="Baños">
          <PillRow values={[0,1,2,3]} value={filters.baths} onChange={v => upd('baths', v)} labelFn={v => v === 0 ? 'Todos' : v + '+'} />
        </FilterGroup>

        <FilterGroup title="Características">
          <div className="col gap-10">
            <Check label="Amoblado" icon="sofa" checked={filters.amoblado} onChange={v => upd('amoblado', v)}/>
            <Check label="Mascotas permitidas" icon="paw" checked={filters.mascotas} onChange={v => upd('mascotas', v)}/>
            <Check label="Verificado" icon="check" checked={filters.verified} onChange={v => upd('verified', v)}/>
            <Check label="Temporal disponible" icon="cal" checked={filters.temporal} onChange={v => upd('temporal', v)}/>
          </div>
        </FilterGroup>

        <button className="btn btn-blue" style={{ width: '100%', justifyContent: 'center', marginTop: 12 }}>Aplicar filtros</button>
      </div>
    </aside>
  );
}

function FilterGroup({ title, children }) {
  return (
    <div style={{ paddingBottom: 18, marginBottom: 18, borderBottom: '1px solid var(--line-2)' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 10, letterSpacing: '.02em' }}>{title}</div>
      {children}
    </div>
  );
}
function DraggableRange({ min, max, step = 1, valueMin, valueMax, onChange }) {
  const track = React.useRef(null);
  const [dragging, setDragging] = React.useState(null);
  const clamp = (v) => Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100));
  const pctMin = clamp(valueMin);
  const pctMax = clamp(valueMax);

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
      const x = e.touches ? e.touches[0].clientX : e.clientX;
      const v = valueFromEvent(x);
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
    <div style={{ padding: '6px 8px 2px' }}>
      <div ref={track}
        onClick={(e) => {
          const v = valueFromEvent(e.clientX);
          const distMin = Math.abs(v - valueMin), distMax = Math.abs(v - valueMax);
          if (distMin < distMax) onChange(Math.min(v, valueMax - step), valueMax);
          else onChange(valueMin, Math.max(v, valueMin + step));
        }}
        style={{ position: 'relative', height: 6, background: 'var(--bg-3)', borderRadius: 999, cursor: 'pointer' }}>
        <div style={{ position: 'absolute', left: pctMin + '%', right: (100 - pctMax) + '%', top: 0, bottom: 0, background: 'var(--blue)', borderRadius: 999 }}/>
        {[{ pct: pctMin, who: 'min' }, { pct: pctMax, who: 'max' }].map(h => (
          <div key={h.who}
            onMouseDown={(e) => { e.stopPropagation(); setDragging(h.who); }}
            onTouchStart={(e) => { e.stopPropagation(); setDragging(h.who); }}
            style={{
              position: 'absolute', left: `calc(${h.pct}% - 9px)`, top: -7,
              width: 18, height: 18, borderRadius: '50%',
              background: '#fff', border: '3px solid var(--blue)',
              boxShadow: '0 2px 6px rgba(11,22,34,.18)',
              cursor: 'grab', touchAction: 'none'
            }}/>
        ))}
      </div>
    </div>
  );
}
function PillRow({ values, value, onChange, labelFn }) {
  return (
    <div className="row gap-6" style={{ flexWrap: 'wrap' }}>
      {values.map(v => (
        <button key={v} onClick={() => onChange(v)} style={{
          padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600,
          border: '1px solid ' + (value === v ? 'var(--blue)' : 'var(--line)'),
          background: value === v ? 'var(--blue)' : '#fff', color: value === v ? '#fff' : 'var(--ink-2)', cursor: 'pointer'
        }}>{labelFn(v)}</button>
      ))}
    </div>
  );
}
function Check({ label, icon, checked, onChange }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
      <span style={{
        width: 18, height: 18, borderRadius: 5,
        border: '2px solid ' + (checked ? 'var(--blue)' : 'var(--line)'),
        background: checked ? 'var(--blue)' : '#fff',
        display: 'grid', placeItems: 'center', color: '#fff', flexShrink: 0,
      }}>{checked && <I.check s={11}/>}</span>
      <span style={{ fontSize: 14, color: 'var(--ink-2)' }} className="row gap-6">
        {icon && React.createElement(I[icon], { s: 14 })}
        {label}
      </span>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ display: 'none' }}/>
    </label>
  );
}

function CatalogGrid({ properties, onProperty }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
      {properties.map(p => <PropertyCard key={p.id} p={p} onClick={() => onProperty(p)} />)}
    </div>
  );
}

function CatalogMap({ properties, onProperty }) {
  const [hover, setHover] = React.useState(null);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 16, height: 'calc(100vh - 220px)', minHeight: 720 }}>
      <div className="card" style={{ overflow: 'hidden', position: 'relative', padding: 0 }}>
        <MiniMap height="100%" pins={properties.length} />
        <div style={{ position: 'absolute', top: 14, left: 14, background: '#fff', padding: '8px 14px', borderRadius: 999, boxShadow: 'var(--shadow-sm)', fontSize: 13, fontWeight: 600 }}>
          <I.pin s={13}/> {properties.length} inmuebles en el mapa
        </div>
      </div>
      <div style={{ overflowY: 'auto', paddingRight: 4 }}>
        <div className="col gap-14">
          {properties.map(p => (
            <div key={p.id} className="card" style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 0, cursor: 'pointer', overflow: 'hidden' }} onClick={() => onProperty(p)}>
              <Photo src={p.cover} style={{ height: 140, borderRadius: 0 }}/>
              <div style={{ padding: 14 }}>
                <div className="row gap-6">
                  {p.verified && <span className="badge badge-verified"><I.check s={10}/> Verificado</span>}
                  {p.featured && <span className="badge badge-featured">Destacado</span>}
                </div>
                <div style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 16, color: 'var(--blue)', marginTop: 6 }}>
                  {formatGs(p.price)}<span style={{ fontSize: 11, color: 'var(--ink-3)' }}> /{p.tipo==='temporal'?'noche':'mes'}</span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{p.title}</div>
                <div className="row gap-12 muted" style={{ marginTop: 6, fontSize: 12 }}>
                  {p.beds > 0 && <span><I.bed s={11}/> {p.beds}</span>}
                  <span><I.bath s={11}/> {p.baths}</span>
                  <span><I.ruler s={11}/> {p.m2} m²</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { CatalogPage });
