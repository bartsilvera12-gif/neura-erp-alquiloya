// Public API bridge. Keeps data.jsx as fallback and normalizes API rows to the legacy UI shape.

(function () {
  // Sin datos mock: arrancamos vacío y solo mostramos lo que devuelva la API real.
  const fallbackProperties = [];
  const fallbackAgents = [];

  const state = {
    loading: true,
    source: 'fallback',
    error: null,
    properties: fallbackProperties,
    agents: fallbackAgents,
    propertyDetails: {},
    agentDetails: {},
  };
  const listeners = new Set();

  const notify = () => listeners.forEach(fn => fn());
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const subscribe = (fn) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  };
  const snapshot = () => state;

  const slugify = (value) => String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'agente';

  const toNumber = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };

  // Extrae la URL real cuando alguien pegó un HTML embed (ej. postimg) en vez del link directo.
  const sanitizeImageUrl = (raw) => {
    if (!raw) return raw;
    const str = String(raw).trim();
    if (!str) return str;
    if (!/[<>]/.test(str)) return str;
    const imgMatch = str.match(/<img[^>]+src\s*=\s*["']([^"']+)["']/i);
    if (imgMatch && imgMatch[1]) return imgMatch[1].trim();
    const hrefMatch = str.match(/<a[^>]+href\s*=\s*["']([^"']+)["']/i);
    if (hrefMatch && hrefMatch[1]) return hrefMatch[1].trim();
    const urlMatch = str.match(/https?:\/\/[^\s"'<>]+/i);
    return urlMatch ? urlMatch[0] : str;
  };

  const findFallbackAgent = (row) => {
    const name = String(row?.nombre || row?.name || '').trim().toLowerCase();
    const phone = String(row?.whatsapp || row?.telefono || row?.phone || '').trim();
    return fallbackAgents.find(a =>
      String(a.name || '').trim().toLowerCase() === name ||
      (phone && String(a.phone || '').trim() === phone)
    ) || null;
  };

  const computeAutoNivel = (cierres) => {
    const c = Number(cierres) || 0;
    if (c >= 10) return 'Top Pro';
    if (c >= 3) return 'Pro';
    return 'Junior';
  };

  const zoneLabelFromZonas = (zonas) => {
    if (!Array.isArray(zonas) || zonas.length === 0) return '';
    const parts = zonas.map(z => [z.barrio, z.ciudad].filter(Boolean).join(', ')).filter(Boolean);
    const unique = Array.from(new Set(parts));
    return unique.slice(0, 3).join(' · ');
  };

  const normalizeAgent = (row, index = 0) => {
    if (!row) return null;
    const fallback = findFallbackAgent(row);
    const name = row.nombre || row.name || fallback?.name || 'Agente AlquiloYa';
    const cargo = row.cargo || fallback?.type || 'Agente';
    const type = String(cargo).split(' - ')[0].split(' · ')[0].trim() || 'Agente';
    const createdYear = row.created_at ? new Date(row.created_at).getFullYear() : null;
    const cierresCount = Number(row.cierres_count ?? 0) || 0;
    const zonasArr = Array.isArray(row.zonas) ? row.zonas : [];
    const tipsArr = Array.isArray(row.tips) ? row.tips : [];
    const resenasArr = Array.isArray(row.resenas) ? row.resenas : [];
    const zoneLabel = zoneLabelFromZonas(zonasArr) || fallback?.zone || '';
    const nivelAuto = computeAutoNivel(cierresCount);
    return {
      id: row.id || fallback?.id || slugify(name),
      apiId: row.id || null,
      slug: fallback?.slug || slugify(name),
      name,
      type,
      zone: zoneLabel,
      zonas: zonasArr,
      tips: tipsArr,
      resenas: resenasArr,
      avatar: fallback?.avatar ?? index,
      verified: !!row.verificado,
      joinedYear: row.created_at && Number.isFinite(createdYear) ? createdYear : (fallback?.joinedYear || 2026),
      activeProperties: row.propiedades_count ?? 0,
      closedRentals: cierresCount,
      reviews: Number(row.resenas_count ?? 0) || 0,
      rating: Number(row.rating ?? 0) || 0,
      level: row.nivel || nivelAuto,
      idiomas: row.idiomas || '',
      tiempoRespuesta: row.tiempo_respuesta || '',
      tasaRespuesta: row.tasa_respuesta || '',
      phone: row.whatsapp || row.telefono || fallback?.phone || '',
      email: row.email || fallback?.email || '',
      foto_url: row.foto_url || fallback?.foto_url || null,
      logo_empresa_url: row.logo_empresa_url || null,
      bio: row.bio || fallback?.bio || '',
      raw: row,
    };
  };

  const findFallbackProperty = (row) => {
    const code = String(row?.codigo || row?.legacyId || '').trim();
    const title = String(row?.titulo || row?.title || '').trim().toLowerCase();
    return fallbackProperties.find(p =>
      (code && String(p.id) === code) ||
      String(p.title || '').trim().toLowerCase() === title
    ) || null;
  };

  const photosFromRow = (row, fallback, cover) => {
    const apiPhotos = Array.isArray(row?.fotos)
      ? row.fotos.map(f => sanitizeImageUrl(f?.url)).filter(Boolean)
      : null;
    if (apiPhotos && apiPhotos.length) return apiPhotos;
    if (Array.isArray(row?.photos) && row.photos.length) return row.photos.map(sanitizeImageUrl).filter(Boolean);
    if (Array.isArray(fallback?.photos) && fallback.photos.length) return fallback.photos;
    return cover ? [cover] : [];
  };

  const featuresFromRow = (row, fallback) => {
    if (Array.isArray(row?.caracteristicas)) {
      return row.caracteristicas
        .map(c => c?.valor ? `${c.nombre}: ${c.valor}` : c?.nombre)
        .filter(Boolean);
    }
    if (Array.isArray(row?.features)) return row.features;
    return Array.isArray(fallback?.features) ? fallback.features : [];
  };

  const normalizeProperty = (row, agents = state.agents) => {
    if (!row) return null;
    // Si la propiedad es REAL (id UUID de la API), NO usamos data mock como
    // fallback. Antes findFallbackProperty matcheaba por titulo, asi que una
    // propiedad real titulada como el seed (ej. "Dúplex moderno con balcón")
    // heredaba fotos/cover/ubicacion del mock — por eso al "ver mas fotos" de
    // una publicacion sin fotos salian imagenes que no eran de la propiedad.
    const isReal = uuidRe.test(String(row?.id || ''));
    const fallback = isReal ? null : findFallbackProperty(row);
    const cover = sanitizeImageUrl(row.cover?.url || row.cover) || fallback?.cover || null;
    const features = featuresFromRow(row, fallback);
    // El fallback a `fallback?.agent` venia de la data mock (data.jsx) y le
    // pegaba "Mariana López / Diego Aguilar / ..." a cualquier propiedad real
    // que no tuviera agente_id en la base. Resultado: la propiedad aparecia
    // en el detalle con "Mariana Lopez" como agente, pero en el perfil
    // publico de Mariana NO estaba (porque no le pertenece). Sacamos el
    // fallback a mock — si no hay agente real, devolvemos null y la UI
    // muestra "Propietario directo" o similar.
    const agent = row.agente
      ? normalizeAgent(row.agente)
      : agents.find(a => a.apiId === row.agente_id || a.id === row.agente_id) || null;
    const price = toNumber(row.precio ?? row.price, fallback?.price ?? 0);
    const tipo = row.tipo || fallback?.tipo || 'depto';

    return {
      id: row.id || fallback?.id,
      apiId: row.id || null,
      legacyId: row.codigo || fallback?.id || null,
      title: row.titulo || row.title || fallback?.title || 'Propiedad',
      tipo,
      depto: fallback?.depto || 'Central',
      ciudad: row.ciudad || fallback?.ciudad || '',
      barrio: row.barrio || fallback?.barrio || '',
      address: row.direccion || row.address || fallback?.address || [row.barrio, row.ciudad].filter(Boolean).join(', '),
      price,
      priceLabel: (function() {
        // Para tipo=temporal, el periodo lo elige el agente al cargar (row.precio_periodo).
        // Fallback: /noche cuando temporal sin periodo, /mes cuando no temporal.
        var sufijos = { noche: '/ noche', diario: '/ día', semanal: '/ semana', mensual: '/ mes' };
        var period = row.precio_periodo && sufijos[row.precio_periodo];
        if (period) return formatGs(price) + ' ' + period;
        return tipo === 'temporal' ? formatGs(price) + ' / noche' : formatGs(price) + ' / mes';
      })(),
      precio_periodo: row.precio_periodo || null,
      beds: toNumber(row.dormitorios ?? row.beds, fallback?.beds ?? 0),
      baths: toNumber(row.banos ?? row.baths, fallback?.baths ?? 0),
      m2: toNumber(row.superficie_m2 ?? row.m2, fallback?.m2 ?? 0),
      cochera: row.cocheras != null ? toNumber(row.cocheras) > 0 : Boolean(fallback?.cochera),
      amoblado: fallback?.amoblado ?? features.some(f => /amobl/i.test(f)),
      mascotas: fallback?.mascotas ?? features.some(f => /masc/i.test(f)),
      // Antes: `fallback?.verified ?? true` — cuando no había fallback caía en
      // `true` y TODAS las propiedades aparecían con badge "Verificado" y en la
      // sección "Destacadas" del home, aunque no lo estuvieran en la DB.
      verified: typeof row.verificada === 'boolean' ? row.verificada : Boolean(fallback?.verified),
      featured: row.destacada ?? fallback?.featured ?? false,
      isNew: fallback?.isNew ?? false,
      photos: photosFromRow(row, fallback, cover),
      cover,
      agent,
      // Contacto efectivo para el boton de WhatsApp (lo expone el endpoint de
      // detalle): agente o, si es publicacion directa, el propietario.
      contacto: row.contacto || null,
      desc: row.descripcion || row.desc || fallback?.desc || '',
      video_url: row.video_url || null,
      vistas: typeof row.vistas_count === 'number' ? row.vistas_count : 0,
      features,
      lat: typeof row.lat === 'number' ? row.lat : (row.lat != null ? Number(row.lat) || null : null),
      lng: typeof row.lng === 'number' ? row.lng : (row.lng != null ? Number(row.lng) || null : null),
      raw: row,
    };
  };

  const readData = async (url) => {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`${url} HTTP ${res.status}`);
    const json = await res.json();
    if (json && json.success === false) throw new Error(json.error || url);
    return json?.data || {};
  };

  // Lectura tolerante: cada endpoint falla independiente y no arrastra al otro.
  const readDataSafe = async (url) => {
    try {
      return { ok: true, data: await readData(url) };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err), data: {} };
    }
  };

  async function refresh() {
    state.loading = true;
    notify();
    const [propRes, agentRes] = await Promise.all([
      readDataSafe('/api/public/alquiloya/propiedades'),
      readDataSafe('/api/public/alquiloya/agentes'),
    ]);

    const agents = (agentRes.data.agentes || []).map(normalizeAgent).filter(Boolean);
    const properties = (propRes.data.propiedades || []).map(row => normalizeProperty(row, agents)).filter(Boolean);

    // Por-endpoint: si tengo agentes reales, los uso aunque propiedades falle, y viceversa.
    state.agents = agents.length ? agents : fallbackAgents;
    state.properties = properties.length ? properties : fallbackProperties;

    const propsFromApi = properties.length > 0;
    const agentsFromApi = agents.length > 0;
    if (propsFromApi && agentsFromApi) state.source = 'api';
    else if (propsFromApi || agentsFromApi) state.source = 'mixed';
    else state.source = 'fallback';

    const errs = [];
    if (!propRes.ok) errs.push('propiedades: ' + propRes.error);
    if (!agentRes.ok) errs.push('agentes: ' + agentRes.error);
    state.error = errs.length > 0 ? errs.join(' | ') : null;
    state.loading = false;
    notify();
  }

  async function getPropertyDetail(id) {
    if (!id) return null;
    if (!uuidRe.test(id)) return null;
    if (state.propertyDetails[id]) return state.propertyDetails[id];
    try {
      const data = await readData('/api/public/alquiloya/propiedades/' + encodeURIComponent(id));
      const property = normalizeProperty(data.propiedad, state.agents);
      if (property) {
        state.propertyDetails[id] = property;
        notify();
      }
      return property;
    } catch {
      return null;
    }
  }

  async function getAgentDetail(id) {
    if (!id) return null;
    if (!uuidRe.test(id)) return null;
    if (state.agentDetails[id]) return state.agentDetails[id];
    try {
      const data = await readData('/api/public/alquiloya/agentes/' + encodeURIComponent(id));
      const agent = normalizeAgent(data.agente);
      if (agent) {
        agent.propiedades = (data.agente?.propiedades || [])
          .map(row => normalizeProperty({ ...row, agente_id: agent.id }, [agent]))
          .filter(Boolean);
        state.agentDetails[id] = agent;
        notify();
      }
      return agent;
    } catch {
      return null;
    }
  }

  function useAlquiloYaPublicData() {
    const [data, setData] = React.useState(snapshot());
    React.useEffect(() => subscribe(() => setData({ ...snapshot() })), []);
    return data;
  }

  function useAlquiloYaPublicProperty(id) {
    const [property, setProperty] = React.useState(id ? state.propertyDetails[id] || null : null);
    React.useEffect(() => {
      let alive = true;
      setProperty(id ? state.propertyDetails[id] || null : null);
      if (id) getPropertyDetail(id).then(p => { if (alive && p) setProperty(p); });
      return () => { alive = false; };
    }, [id]);
    return property;
  }

  function useAlquiloYaPublicAgent(id) {
    const [agent, setAgent] = React.useState(id ? state.agentDetails[id] || null : null);
    React.useEffect(() => {
      let alive = true;
      setAgent(id ? state.agentDetails[id] || null : null);
      if (id) getAgentDetail(id).then(a => { if (alive && a) setAgent(a); });
      return () => { alive = false; };
    }, [id]);
    return agent;
  }

  window.AlquiloYaPublicData = { subscribe, snapshot, refresh, getPropertyDetail, getAgentDetail };
  Object.assign(window, { useAlquiloYaPublicData, useAlquiloYaPublicProperty, useAlquiloYaPublicAgent });

  refresh();
})();
