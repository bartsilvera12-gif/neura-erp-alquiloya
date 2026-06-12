// Mock data — properties, departamentos, ciudades, etc.

/**
 * Centralizacion de contactos publicos de AlquiloYa.
 *
 * Esta constante es la UNICA fuente de verdad de los telefonos / WhatsApp /
 * email / direccion que aparecen en la web publica (footer, ayuda, chatbot
 * VIVIO, etc.). Cuando el cliente confirme los datos reales, editamos solo
 * aca y se propaga a todos los lugares que la consumen.
 *
 * Los valores actuales corresponden a los que ya estaban hardcodeados en
 * shared.jsx y help.jsx — no cambia nada visible al usuario en esta tanda.
 */
const CONTACTO_ALQUILOYA = {
  whatsapp: '595983000292',       // E.164 sin "+" — usado en wa.me/{}
  whatsappLabel: '0983 000 292',  // visible al usuario
  telefono: '0983 000 292',       // telefono visible en footer
  telefonoWa: '595983000292',     // E.164 del telefono de footer para wa.me
  email: 'Info@alquiloya.com.py',
  emailAyuda: 'ayuda@alquiloya.com.py', // email especifico del help center
  direccion: 'Asunción, Paraguay',
  horario: 'Lunes a Sábado 08:00 a 20:00',
};
// Exponer en window para que el resto de los .jsx (cargados como scripts
// independientes via Babel runtime) puedan acceder sin imports.
if (typeof window !== 'undefined') {
  window.CONTACTO_ALQUILOYA = CONTACTO_ALQUILOYA;
}

const DEPARTAMENTOS = [
  'Central', 'Alto Paraná', 'Itapúa', 'Cordillera', 'Caaguazú', 'San Pedro',
  'Paraguarí', 'Guairá', 'Caazapá', 'Misiones', 'Ñeembucú', 'Concepción', 'Amambay', 'Canindeyú',
  'Presidente Hayes', 'Boquerón', 'Alto Paraguay',
];
const CIUDADES = {
  'Central': ['Asunción', 'San Lorenzo', 'Luque', 'Lambaré', 'Fernando de la Mora', 'Capiatá', 'Ñemby', 'Mariano Roque Alonso', 'Villa Elisa', 'Limpio', 'San Antonio', 'Areguá', 'Itauguá', 'Itá', 'Ypané', 'Guarambaré'],
  'Alto Paraná': ['Ciudad del Este', 'Hernandarias', 'Presidente Franco', 'Minga Guazú', 'Santa Rita'],
  'Itapúa': ['Encarnación', 'Cambyretá', 'Hohenau', 'Obligado'],
  'Cordillera': ['Caacupé', 'Piribebuy', 'Tobatí', 'Eusebio Ayala', 'Atyrá'],
  'Caaguazú': ['Coronel Oviedo', 'Caaguazú', 'Repatriación', 'Yhú', 'San José de los Arroyos'],
  'San Pedro': ['San Estanislao', 'San Pedro de Ycuamandyyú', 'Choré', 'General Resquín'],
  'Paraguarí': ['Paraguarí', 'Carapeguá', 'Yaguarón', 'Quiindy'],
  'Guairá': ['Villarrica', 'Independencia', 'Mbocayaty'],
  'Caazapá': ['Caazapá', 'San Juan Nepomuceno', 'Yuty'],
  'Misiones': ['San Juan Bautista', 'Santa Rosa', 'Ayolas', 'San Ignacio'],
  'Ñeembucú': ['Pilar', 'Alberdi', 'Tacuaras'],
  'Concepción': ['Concepción', 'Horqueta', 'Yby Yaú'],
  'Amambay': ['Pedro Juan Caballero', 'Bella Vista Norte', 'Capitán Bado'],
  'Canindeyú': ['Salto del Guairá', 'Curuguaty', 'Katueté'],
  'Presidente Hayes': ['Villa Hayes', 'Benjamín Aceval', 'Nanawa'],
  'Boquerón': ['Filadelfia', 'Loma Plata', 'Mariscal Estigarribia'],
  'Alto Paraguay': ['Fuerte Olimpo', 'Bahía Negra', 'Puerto Casado'],
};
const BARRIOS = ['Villa Morra', 'Carmelitas', 'Las Lomas', 'Recoleta', 'Ycuá Satí', 'Jara', 'Mburucuyá', 'Trinidad', 'Centro', 'Manorá'];

// Barrios por ciudad — al elegir una ciudad se filtran los barrios de esa zona
const BARRIOS_BY_CIUDAD = {
  'Asunción': ['Villa Morra', 'Carmelitas', 'Las Mercedes', 'Recoleta', 'Ycuá Satí', 'Jara', 'Mburucuyá', 'Trinidad', 'Centro / Microcentro', 'Manorá', 'Sajonia', 'Pinozá', 'San Roque', 'Mariscal López', 'Las Lomas', 'Itay Cará', 'Loma Pytá', 'Tembetary'],
  'San Lorenzo': ['Centro', 'Villa Constitución', 'San Roque', 'Reducto', 'Yacht', 'Laurelty', 'Santa Rosa', 'Tarumá'],
  'Luque': ['Centro', 'San Isidro', 'Aviadores del Chaco', 'Areguá Hapy', 'Mora Cué', 'Loma Merlo', 'San Pedro', 'Cañadita'],
  'Lambaré': ['Centro', 'Yukyty', 'Roberto L. Pettit', 'Cerro Corá', 'Mbocayaty', 'Santa Ana', 'Las Mercedes', 'Ñu Guazú'],
  'Fernando de la Mora': ['Centro', 'Zona Norte', 'Zona Sur', 'Pitiantuta', 'Yguá'],
  'Capiatá': ['Centro', 'Km 17', 'Km 19', 'Km 20', 'Km 22', 'Sol Naciente', 'Itá Yvate', 'Cristo Rey', 'Itapuamí', 'Yvyraty', '21 de Setiembre'],
  'Ñemby': ['Centro', 'Salado', 'Cerro Cora', 'Loma Merlo', 'Mbocayaty', 'Pa\'i Ñu'],
  'Mariano Roque Alonso': ['Centro', 'Surubi-i', 'Tarumandymí', 'Loma Tarumá', 'Itá Enramada'],
  'Villa Elisa': ['Centro', 'San Miguel', 'Pirayú', 'San Isidro', 'Yvoty'],
  'Limpio': ['Centro', 'Sarambí', 'Caraguatá', 'San Antonio', 'Tacumbú'],
  'San Antonio': ['Centro', 'Itá Enramada', 'Tres Bocas'],
  'Areguá': ['Centro', 'Yukyty', 'Costanera', 'Estanzuela', 'Pacu Cuá'],
  'Itauguá': ['Centro', 'Itauguá Guazú', 'San Blas', 'Loma'],
  'Itá': ['Centro', 'Cabañas', 'San Cosme'],
  'Ypané': ['Centro', 'Costa Pucú', 'Tarumandy'],
  'Guarambaré': ['Centro', 'Pirayú', 'San José'],
  'Ciudad del Este': ['Centro', 'Km 7', 'Boquerón', 'Don Bosco', 'Área 1', 'Área 2', 'Área 3', 'Pablo Rojas', 'San Blas', 'Remansito'],
  'Hernandarias': ['Centro', 'Km 8', 'Km 10', 'San Roque', 'Acaray'],
  'Presidente Franco': ['Centro', 'Km 4', 'Acaray', 'Naranjal'],
  'Minga Guazú': ['Centro', 'Km 16', 'Km 20'],
  'Santa Rita': ['Centro', 'Naranjito', 'San Cristóbal'],
  'Encarnación': ['Centro', 'San Roque', 'Quiteria', 'Villa María', 'Costanera', 'Carmen del Paraná', 'Mboi Caé', 'San Pedro'],
  'Cambyretá': ['Centro', 'Tres Bocas', 'San Pablo'],
  'Hohenau': ['Centro', 'Línea 1', 'Línea 2'],
  'Obligado': ['Centro', 'Colonia'],
  'Caacupé': ['Centro', 'Yhaguy', 'Tobatí Mí', 'San Roque'],
  'Piribebuy': ['Centro', 'Loma', 'Costa'],
  'Tobatí': ['Centro', 'Costa', 'San José'],
  'Eusebio Ayala': ['Centro', 'Capilla del Monte'],
  'Atyrá': ['Centro', 'Tobatiry', 'Costa Pucú'],
  'Coronel Oviedo': ['Centro', 'Don Bosco', 'San Blas', 'Tres Bocas'],
  'Caaguazú': ['Centro', 'Loma Merlo', 'Tres Bocas'],
  'Repatriación': ['Centro', 'Colonia'],
  'Yhú': ['Centro', 'Línea Yhú'],
  'San José de los Arroyos': ['Centro', 'San Antonio'],
  'San Estanislao': ['Centro', 'Tacuara', 'Calle 8'],
  'San Pedro de Ycuamandyyú': ['Centro', 'Costa Norte'],
  'Choré': ['Centro', 'Línea 3', 'Línea 5'],
  'General Resquín': ['Centro', 'Costa'],
  'Paraguarí': ['Centro', 'Cerro Yaguarón', 'San Roque'],
  'Carapeguá': ['Centro', 'San Roque', 'Costa'],
  'Yaguarón': ['Centro', 'Cerro Yaguarón'],
  'Quiindy': ['Centro', 'Acahay'],
  'Villarrica': ['Centro', 'Norte', 'Sur', 'San Roque', 'San Miguel'],
  'Independencia': ['Centro', 'Colonia'],
  'Mbocayaty': ['Centro', 'Costa'],
  'Caazapá': ['Centro', 'San Roque'],
  'San Juan Nepomuceno': ['Centro', 'Costa'],
  'Yuty': ['Centro', 'Costa Yuty'],
  'San Juan Bautista': ['Centro', 'San Miguel'],
  'Santa Rosa': ['Centro', 'San Ignacio'],
  'Ayolas': ['Centro', 'Loma'],
  'San Ignacio': ['Centro', 'San Patricio'],
  'Pilar': ['Centro', 'Costanera', 'Cué Pyahu'],
  'Alberdi': ['Centro', 'San Antonio'],
  'Tacuaras': ['Centro'],
  'Concepción': ['Centro', 'Norte', 'Sur', 'Tres Bocas', 'San Antonio'],
  'Horqueta': ['Centro', 'Costa'],
  'Yby Yaú': ['Centro', 'Costa'],
  'Pedro Juan Caballero': ['Centro', 'Cerro Corá', 'San Blas', 'San Miguel', 'Loma Merlo'],
  'Bella Vista Norte': ['Centro', 'Frontera'],
  'Capitán Bado': ['Centro', 'Costa'],
  'Salto del Guairá': ['Centro', 'San José', 'Acaray'],
  'Curuguaty': ['Centro', 'Costa', 'Línea 1'],
  'Katueté': ['Centro', 'Colonia'],
  'Villa Hayes': ['Centro', 'Tte. Irala', 'San Antonio'],
  'Benjamín Aceval': ['Centro', 'Costa'],
  'Nanawa': ['Centro', 'Frontera'],
  'Filadelfia': ['Centro', 'Loma Plata', 'Manantial', 'Avenida Hindenburg', 'Colonia Fernheim'],
  'Loma Plata': ['Centro', 'Norte', 'Sur'],
  'Mariscal Estigarribia': ['Centro', 'Cruce Pioneros'],
  'Fuerte Olimpo': ['Centro', 'Costa'],
  'Bahía Negra': ['Centro'],
  'Puerto Casado': ['Centro'],
};

const TIPOS = [
  { id: 'depto', label: 'Departamento', icon: 'apt' },
  { id: 'casa', label: 'Casa independiente', icon: 'house' },
  { id: 'salon', label: 'Salón comercial', icon: 'shop' },
  // "Alquiler temporal" sacado del hero (sigue disponible en el select del
  // catalogo). Reemplazado por Duplex a pedido del cliente.
  { id: 'duplex', label: 'Dúplex', icon: 'apt' },
];

// Unsplash photo IDs — modern real estate photos
const PHOTOS = [
  '1568605114967-8130f3a36994', // modern house
  '1564013799919-ab600027ffc6', // house exterior
  '1570129477492-45c003edd2be', // modern home blue
  '1502672260266-1c1ef2d93688', // apartment interior
  '1522708323590-d24dbb6b0267', // modern living
  '1600585154340-be6161a56a0c', // modern house white
  '1600596542815-ffad4c1539a9', // luxury
  '1600607687939-ce8a6c25118c', // modern apartment
  '1600210492486-724fe5c67fb0', // interior
  '1605276374104-dee2a0ed3cd6', // modern villa
  '1613490493576-7fde63acd811', // luxury living
  '1583608205776-bfd35f0d9f83', // apartment
  '1600566753190-17f0baa2a6c3', // commercial
  '1493809842364-78817add7ffb', // bedroom
  '1512917774080-9991f1c4c750', // exterior contemporary
  '1521540216272-a50305cd4421', // bedroom
  '1556909114-f6e7ad7d3136', // dining
  '1494526585095-c41746248156', // kitchen
];
const photo = (i) => `https://images.unsplash.com/photo-${PHOTOS[i % PHOTOS.length]}?w=900&auto=format&fit=crop&q=70`;

const TITLES = [
  'Dúplex moderno con balcón en zona Villa Morra',
  'Casa familiar 3 dormitorios con quincho y patio',
  'Departamento amoblado a 2 cuadras del Shopping del Sol',
  'Salón comercial sobre Av. España, ideal local',
  'Casa con piscina en barrio cerrado Las Lomas',
  'Loft minimalista con vista al microcentro',
  'Departamento temporal full equipado — Carmelitas',
  'Casa nueva 4 dormitorios + dependencia, Ycuá Satí',
  'Mono ambiente luminoso, primera ocupación',
  'Salón sobre Mcal. López, 180 m² + estacionamiento',
  'PH planta alta con terraza propia — Jara',
  'Departamento ejecutivo amoblado, alquiler temporal',
];

function rand(seed) {
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

const PROPERTIES = TITLES.map((title, i) => {
  const tipos = ['depto','casa','salon','temporal'];
  const tipo = i === 3 || i === 9 ? 'salon' : (i === 6 || i === 11 ? 'temporal' : (i % 2 === 0 ? 'depto' : 'casa'));
  const ciudad = ['Asunción','San Lorenzo','Luque','Lambaré','Asunción','Asunción'][i % 6];
  const barrio = BARRIOS[i % BARRIOS.length];
  const beds = tipo === 'salon' ? 0 : 1 + Math.floor(rand(i+1) * 4);
  const baths = tipo === 'salon' ? 1 : 1 + Math.floor(rand(i+2) * 3);
  const m2 = tipo === 'salon' ? 80 + Math.floor(rand(i+3) * 200) : 35 + Math.floor(rand(i+4) * 180);
  const price = tipo === 'temporal'
    ? 280000 + Math.floor(rand(i+5) * 500000)
    : tipo === 'salon'
      ? 3500000 + Math.floor(rand(i+5) * 9000000)
      : 1800000 + Math.floor(rand(i+5) * 6500000);
  return {
    id: 'AY-' + String(1240 + i).padStart(5, '0'),
    title,
    tipo,
    depto: 'Central',
    ciudad,
    barrio,
    address: `${barrio}, ${ciudad}`,
    price,
    priceLabel: tipo === 'temporal' ? formatGs(price) + ' / noche' : formatGs(price) + ' / mes',
    beds, baths, m2,
    cochera: rand(i+6) > 0.4,
    amoblado: tipo === 'temporal' || rand(i+7) > 0.6,
    mascotas: rand(i+8) > 0.5,
    verified: rand(i+9) > 0.4,
    featured: rand(i+10) > 0.7,
    isNew: rand(i+11) > 0.7,
    photos: Array.from({ length: 5 }, (_, k) => photo(i*3 + k)),
    cover: photo(i*3),
    agent: {
      name: ['Mariana López','Diego Aguilar','Carla Benítez','Inmobiliaria Centro','Andrés Vera','Inmobiliaria Premium'][i % 6],
      type: i % 3 === 0 ? 'Inmobiliaria' : 'Propietario',
      avatar: i,
      verified: true,
      phone: '+595 9' + (80 + i) + ' 555 ' + String(100 + i*7).slice(-3),
    },
    desc: 'Excelente propiedad recientemente refaccionada, ubicación estratégica con acceso rápido a avenidas principales, supermercados, colegios y centros comerciales. Cuenta con ambientes amplios y ventilados, terminaciones de primera, y todos los servicios disponibles.',
    features: ['Aire acondicionado','Cocina equipada','Lavadero','Seguridad 24hs','Wifi','Termotanque'],
  };
});

const PLANS = [
  { tier: 'gratuito-owner', target: 'Dueño Directo', name: 'Gratuito', price: 0, billing: 'gratis', badge: null,
    bullets: [
      '1 propiedad activa',
      'Hasta 5 fotos por inmueble',
      'Vigencia 30 días',
      'Contacto directo por WhatsApp',
      'Soporte básico',
    ],
    excluded: ['Prioridad en búsqueda', 'Destacado (primer plano)', 'Video tour 360° + link a redes', 'Herramientas de marketing', 'Identidad propia', 'CRM integrado'],
    cta: 'Empezar gratis' },

  { tier: 'basico-owner', target: 'Dueño Directo', name: 'Básico', price: 49000, billing: 'unico', badge: 'Pago único',
    bullets: [
      '1 propiedad activa',
      'Hasta 5 fotos por inmueble',
      'Vigencia 30 días (fijo)',
      'Contacto directo por WhatsApp',
      'Máxima prioridad en búsqueda',
      'Soporte básico',
    ],
    excluded: ['Destacado (primer plano)', 'Video tour 360°', 'Herramientas de marketing', 'Identidad propia', 'CRM integrado'],
    cta: 'Publicar por 30 días', highlighted: true },

  { tier: 'starter-agent', target: 'Agente Independiente', name: 'Starter', price: 149000, billing: 'mensual', badge: 'Recurrente',
    freeBoosts: 3,
    bullets: [
      '15 propiedades activas',
      'Hasta 10 fotos por inmueble',
      'Contacto directo por WhatsApp',
      '3 impulsos gratis por mes para destacar propiedades',
      'Comprá impulsos extra cuando quieras (desde Gs. 13.960 c/u)',
      'Video tour 360° + link a redes',
      'Herramientas de marketing (Flyer + QR)',
      'Soporte técnico especializado',
    ],
    excluded: ['Identidad propia en la plataforma', 'CRM integrado con WhatsApp'],
    cta: 'Quiero Starter' },

  { tier: 'premium-agent', target: 'Inmobiliaria / Top Pro', name: 'Premium', price: 399000, billing: 'mensual', badge: 'Profesional',
    freeBoosts: 10,
    bullets: [
      '50 propiedades activas',
      'Hasta 15 fotos por inmueble',
      'Contacto directo por WhatsApp',
      '10 impulsos gratis por mes para destacar propiedades',
      'Comprá impulsos extra cuando quieras (desde Gs. 13.960 c/u)',
      'Video tour 360° + link a redes',
      'Herramientas de marketing (Flyer + QR)',
      'Identidad propia en la plataforma',
      'CRM integrado con WhatsApp',
      'Soporte prioritario',
    ],
    excluded: [],
    cta: 'Quiero Premium', highlighted: true },
];

// Agentes inmobiliarios — directorio público con score y trazabilidad
const AGENTS = [
  { id: 'AG-001', slug: 'mariana-lopez', name: 'Mariana López', type: 'Independiente', zone: 'Villa Morra, Las Mercedes',
    avatar: 2, verified: true, joinedYear: 2022, activeProperties: 18, closedRentals: 47, blogPosts: 12, reviews: 38, rating: 4.8,
    level: 'Top Pro', commissionRate: 5, phone: '+595 981 555 102',
    bio: 'Especialista en alquileres residenciales en Asunción centro y norte. 4 años conectando inquilinos y propietarios con seriedad y rapidez.' },
  { id: 'AG-002', slug: 'diego-aguilar', name: 'Diego Aguilar', type: 'Independiente', zone: 'Lambaré, San Lorenzo',
    avatar: 3, verified: true, joinedYear: 2023, activeProperties: 12, closedRentals: 28, blogPosts: 5, reviews: 21, rating: 4.6,
    level: 'Pro', commissionRate: 5, phone: '+595 981 555 134',
    bio: 'Atención personalizada y conocimiento profundo de las zonas sur de Asunción.' },
  { id: 'AG-003', slug: 'carla-benitez', name: 'Carla Benítez', type: 'Independiente', zone: 'Asunción centro',
    avatar: 4, verified: true, joinedYear: 2024, activeProperties: 8, closedRentals: 11, blogPosts: 2, reviews: 9, rating: 4.4,
    level: 'Junior', commissionRate: 5, phone: '+595 982 555 220',
    bio: 'Joven agente con enfoque digital. Respondo rápido por WhatsApp.' },
  { id: 'AG-004', slug: 'inmobiliaria-centro', name: 'Inmobiliaria Centro', type: 'Inmobiliaria', zone: 'Asunción, Ñemby, Luque',
    avatar: 1, verified: true, joinedYear: 2019, activeProperties: 46, closedRentals: 312, blogPosts: 38, reviews: 187, rating: 4.9,
    level: 'Top Pro', commissionRate: 4, phone: '+595 982 555 408',
    bio: 'Inmobiliaria con 7 años en el mercado. Equipo de 8 agentes y soporte legal incluido.' },
  { id: 'AG-005', slug: 'andres-vera', name: 'Andrés Vera', type: 'Independiente', zone: 'Capiatá, San Lorenzo',
    avatar: 5, verified: false, joinedYear: 2025, activeProperties: 4, closedRentals: 3, blogPosts: 0, reviews: 2, rating: 4.2,
    level: 'Junior', commissionRate: 5, phone: '+595 983 555 511',
    bio: 'Nuevo en la plataforma. Disponibilidad full-time.' },
  { id: 'AG-006', slug: 'inmobiliaria-premium', name: 'Inmobiliaria Premium', type: 'Inmobiliaria', zone: 'Villa Morra, Carmelitas',
    avatar: 0, verified: true, joinedYear: 2017, activeProperties: 38, closedRentals: 245, blogPosts: 22, reviews: 142, rating: 4.7,
    level: 'Top Pro', commissionRate: 4, phone: '+595 985 555 199',
    bio: 'Especialistas en propiedades premium y temporales para ejecutivos.' },
];

// Captaciones — propiedades captadas por agentes (mock)
const CAPTURES = [
  { propertyId: 'AY-01241', agentId: 'AG-001', date: '12/03/2026', status: 'gestionando', owner: 'Roberto S.' },
  { propertyId: 'AY-01243', agentId: 'AG-001', date: '02/04/2026', status: 'gestionando', owner: 'Patricia M.' },
  { propertyId: 'AY-01246', agentId: 'AG-001', date: '18/04/2026', status: 'cerrada', owner: 'Hugo G.', rentPrice: 3200000, commission: 160000, paid: true },
  { propertyId: 'AY-01250', agentId: 'AG-001', date: '05/05/2026', status: 'cerrada', owner: 'Lucía F.', rentPrice: 2800000, commission: 140000, paid: false },
  { propertyId: 'AY-01252', agentId: 'AG-001', date: '14/05/2026', status: 'gestionando', owner: 'Marcelo V.' },
];

// Referidos — link único por usuario, comisión por suscripción de referidos
const REFERRAL_TIERS = [
  { id: 'standard',   name: 'Estándar',     pct: 10, desc: 'Todos los usuarios. Comisión sobre el primer pago del referido.' },
  { id: 'influencer', name: 'Influencer',   pct: 25, desc: 'Por invitación. Comisión recurrente durante 6 meses + dashboard avanzado.' },
];

const REFERRALS = [
  { id: 'R-001', name: 'Pablo R.',   joined: '03/05/2026', source: 'IG @marianalopez_rl', plan: 'Starter Agente', amount: 149000, commission: 14900,  status: 'pagada' },
  { id: 'R-002', name: 'Sofía G.',   joined: '08/05/2026', source: 'WhatsApp link',         plan: 'Premium',        amount: 399000, commission: 39900,  status: 'pagada' },
  { id: 'R-003', name: 'Lucía M.',   joined: '14/05/2026', source: 'Instagram bio',         plan: 'Básico Dueño',   amount: 49000,  commission: 4900,   status: 'pagada' },
  { id: 'R-004', name: 'Damián V.',  joined: '19/05/2026', source: 'IG @marianalopez_rl', plan: 'Starter Agente', amount: 149000, commission: 14900,  status: 'pendiente' },
  { id: 'R-005', name: 'Roberto S.', joined: '22/05/2026', source: 'TikTok',                plan: 'Premium',        amount: 399000, commission: 39900,  status: 'pendiente' },
];

// Impulsos (boosts) — destacar propiedades adicionales tipo Mercado Libre
const IMPULSE_PACKS = [
  { id: 'pack-1',  qty: 1,  price: 25000,  unit: 25000, label: 'Impulso suelto' },
  { id: 'pack-5',  qty: 5,  price: 99000,  unit: 19800, label: 'Pack 5', save: '21%', popular: true },
  { id: 'pack-10', qty: 10, price: 169000, unit: 16900, label: 'Pack 10', save: '32%' },
  { id: 'pack-25', qty: 25, price: 349000, unit: 13960, label: 'Pack 25', save: '44%', best: true },
];
// Cada impulso destaca 1 propiedad por 7 días en home y catálogo

const ADS = [
  { brand: 'Ferretería Don Mario', tag: 'Ferretería', color: '#f5e6b6', tint: '#8a5e00', desc: 'Todo para tu mudanza con 15% off' },
  { brand: 'Constructora Nova', tag: 'Construcción', color: '#d8e4f7', tint: '#0058A5', desc: 'Proyectos llave en mano' },
  { brand: 'CleanPy Limpieza', tag: 'Limpieza', color: '#dff2e7', tint: '#1f8a5b', desc: 'Limpieza profunda post-mudanza' },
  { brand: 'Mudanzas Express', tag: 'Mudanzas', color: '#fde2d4', tint: '#c2410c', desc: 'Servicio puerta a puerta en 24 hs' },
  { brand: 'Seguros Hogar Plus', tag: 'Seguros', color: '#ece4f7', tint: '#6e3ad1', desc: 'Asegurá tu hogar desde Gs. 35.000/mes' },
  { brand: 'Mantenimiento 360', tag: 'Servicios', color: '#fff0d6', tint: '#a36100', desc: 'Plomería, electricidad y más' },
];

// QR posters
const QR_POSTERS = Array.from({ length: 30 }, (_, i) => {
  const assigned = i < 8;
  return {
    id: 'AY-Q' + String(2050 + i).padStart(4, '0'),
    created: '20/03/2026',
    assigned: assigned ? PROPERTIES[i % PROPERTIES.length].id : null,
    address: assigned ? PROPERTIES[i % PROPERTIES.length].address : '—',
    status: assigned ? 'Asignado' : 'Disponible',
  };
});

Object.assign(window, { DEPARTAMENTOS, CIUDADES, BARRIOS, BARRIOS_BY_CIUDAD, TIPOS, PROPERTIES, PLANS, IMPULSE_PACKS, AGENTS, CAPTURES, REFERRAL_TIERS, REFERRALS, ADS, QR_POSTERS, photo });
