# Integracion Meta (Facebook + Instagram) — AlquiloYa

MVP para que los propietarios conecten sus cuentas comerciales de Meta y
publiquen automaticamente sus inmuebles en Facebook Page e Instagram
Business/Creator.

Este documento cubre la **Entrega 1**: fundaciones + OAuth (conectar y
guardar la conexion). Publicacion real y worker vienen en la Entrega 2.
ERP admin en la Entrega 3.

## 1. Setup en Meta Developers

1. https://developers.facebook.com/apps/ -> Create App tipo Business.
2. Nombre: AlquiloYa.
3. Categoria de uso: Marketing.
4. Copiar App ID y App Secret de App Settings -> Basic -> env vars.
5. App Domains: agregar alquiloya.neura.com.py y alquiloya.com.py.
6. Products a agregar:
   - Facebook Login for Business
   - Instagram Graph API
7. Facebook Login for Business -> Settings -> Valid OAuth Redirect URIs:
   https://alquiloya.neura.com.py/api/integraciones/meta/oauth/callback
8. App Roles -> Roles: agregar Testers mientras este en Development.
9. Scopes usados:
   - pages_show_list
   - pages_manage_posts
   - pages_read_engagement
   - instagram_basic
   - instagram_content_publish
   - business_management

## 2. Variables de entorno

Ver .env.example seccion "Integracion Meta":

| Variable | Descripcion |
|---|---|
| META_APP_ID | De Meta Developers |
| META_APP_SECRET | De Meta Developers. Nunca en frontend |
| META_REDIRECT_URI | Debe matchear la lista blanca |
| META_GRAPH_API_VERSION | Default v21.0 |
| META_SECRETS_KEY | AES para cifrar tokens. openssl rand -base64 32 |
| INTERNAL_WORKER_SECRET | Para Coolify Scheduled Task (Entrega 2) |

En Coolify, marcar META_APP_SECRET, META_SECRETS_KEY y
INTERNAL_WORKER_SECRET como Encrypted.

## 3. Migraciones (Entrega 1)

- supabase/migrations/20260718120000_alquiloya_propietario_redes_sociales.sql
- supabase/migrations/20260718120100_alquiloya_publicaciones_sociales.sql

Idempotentes (IF NOT EXISTS).

## 4. Endpoints

Todos bajo /api/integraciones/meta/, autenticacion Supabase requerida
(rol publicador-propietario con propietario_id en alquiloya.usuarios).

| Metodo | Path | Uso |
|---|---|---|
| GET  | /status | Lista conexiones del propietario (sin tokens) |
| POST | /oauth/start | Devuelve authorize_url, setea cookie de nonce |
| GET  | /oauth/callback | Meta redirige aca. Valida state, prepara pending |
| GET  | /pending | Lee la seleccion pendiente (sin tokens) |
| POST | /select-page | Persiste la Page/IG elegida en DB |
| POST | /toggle-auto | Cambia auto_publish_facebook / _instagram |
| POST | /disconnect | Marca revoked y blanquea el token cifrado |

Reconectar = iniciar OAuth de nuevo. select-page hace ON CONFLICT DO UPDATE
sobre la fila existente.

## 5. Cifrado de tokens

src/lib/meta/security.ts: AES-256-GCM + scrypt KDF desde META_SECRETS_KEY.
Formato: neura-meta:v1:<iv>:<tag>:<ct>. Nunca en logs (sanitizados por
sanitizeError). Nunca al frontend (endpoints de status/pending los omiten).
Al disconnect se blanquea (defensa vs filtracion post-mortem).

## 6. State OAuth (CSRF)

src/lib/meta/state-cookie.ts: doble check.
1. state firmado HMAC-SHA256 con META_SECRETS_KEY, contiene auth_user_id,
   propietario_id, timestamp, nonce.
2. Cookie httpOnly neura_meta_oauth_state con el nonce, debe matchear.

TTL 10 min.

## 7. Testing manual

Prerrequisitos:
- App Meta en Development con vos como Tester.
- Pagina Facebook comercial linkeada a tu cuenta.
- Cuenta IG Business/Creator vinculada a esa Pagina.
- Env vars configuradas.

Pasos:
1. Login al portal como propietario.
2. Sidebar -> Redes sociales.
3. Conectar -> abre Meta OAuth.
4. Volves con #admin-agent-redes?meta_select=1.
5. Elegis Page, tildas "Usar Instagram" si aplica, Guardar.
6. Estado CONECTADO.
7. Auto Facebook ON, recargas, se mantiene.
8. Desconectar -> status revoked.

## 8. Tests unitarios

Correr con Node >= 22.6:

    node --experimental-strip-types --test src/lib/meta/security.test.ts
    node --experimental-strip-types --test src/lib/meta/state-cookie.test.ts
    node --experimental-strip-types --test src/lib/meta/graph-client.test.ts

## 9. Limitaciones

- Fotos data: base64: Entrega 2 sube a Supabase Storage antes.
- App Review: hasta pasarla, solo Testers pueden conectar.
- Page tokens no expiran salvo revocacion.
- Pending en cookie: hasta 5 pages por OAuth.
- No revocamos el token en Meta al disconnect (solo en nuestra DB).

## 10. App Review

Video corto: propietario conecta -> agrega inmueble -> aparece en Pagina/IG.
Justificacion: AlquiloYa es un marketplace inmobiliario donde los
propietarios publican inmuebles. La integracion Meta les permite
distribuir la misma publicacion en su Pagina y en su cuenta profesional
de Instagram, evitando cargarla dos veces.

## 11. Soporte para agentes inmobiliarios

Ademas de propietarios, tambien los agentes inmobiliarios pueden conectar
su cuenta Meta (rol publicador-agente con agente_id en alquiloya.usuarios).

- Cada usuario es propietario XOR agente (regla de negocio) — un usuario
  no puede tener ambos setteados en usuarios.propietario_id / agente_id.
- El helper requireOwnerContext resuelve automaticamente cual es y devuelve
  { ownerType: 'propietario' | 'agente', ownerId }.
- Los mismos endpoints (/status, /oauth/start, etc.) sirven para ambos.
- La UI (redes-sociales.jsx) es identica — llama a los mismos endpoints,
  la API se encarga de discriminar por ownerType.

Tabla alquiloya.propietario_redes_sociales:
- propietario_id nullable, agente_id nullable.
- CHECK XOR: exactamente uno de los dos NOT NULL.
- Unique index sobre (empresa_id, COALESCE(propietario_id, agente_id),
  provider, page, ig).

Mismo esquema en alquiloya.publicaciones_sociales.

## 12. Entrega 2 — Worker + publicacion real

### Flujo end-to-end

1. Admin aprueba propiedad (POST /api/dashboard/alquiloya-propiedades/{id}/moderacion, action=aprobar).
2. Hook en el approval: enqueuePublicaciones(pool, { inmuebleId, owner }) crea 1 fila en publicaciones_sociales por cada conexion del owner con auto_publish activo. La aprobacion NUNCA se bloquea si Meta falla — errores se logean y siguen.
3. Coolify Scheduled Task llama POST /api/internal/meta-worker cada 1 minuto.
4. Worker: rescata atascados (>10 min en processing) -> pending. Levanta hasta 5 jobs pending elegibles con SKIP LOCKED. Los pasa a processing.
5. Por cada job:
   a. Carga propiedad, foto de portada, conexion social.
   b. Si la foto es data:URL -> sube a bucket propiedades-imagenes y usa la publicUrl HTTPS.
   c. Descifra el access_token.
   d. Genera caption con caption-generator.
   e. Publica: FB Photos O IG (container+publish).
   f. Marca published / failed / retry-schedule segun resultado.

### Backoff exponencial

Intento -> minutos hasta el proximo retry:
- 1: 1 min
- 2: 5 min
- 3: 30 min
- 4: 2 hs
- 5: 12 hs
- max=5 -> status=failed

### Clasificacion de errores

- transient: reintenta (5xx, timeout, rate limit, IG container timeout)
- auth: fail + marcar conexion como 'expired' (usuario debe reconectar)
- permanent: fail (foto no accesible, plan cerrado, IG container ERROR/EXPIRED)

### Coolify Scheduled Task

Setup en Coolify:

1. En tu app ERP -> Scheduled Tasks -> Add.
2. Nombre: meta-worker
3. Frequency: `* * * * *` (cada 1 minuto)
4. Container: same (el mismo container del ERP)
5. Command:

    curl -sS -X POST -H "x-worker-secret: $INTERNAL_WORKER_SECRET" https://alquiloya.neura.com.py/api/internal/meta-worker

INTERNAL_WORKER_SECRET debe estar en las env vars del container (ya lo agregaste en Entrega 1). El worker devuelve JSON con { rescued_stuck, processed, summary }.

Alternativa sin Coolify: usar cron-job.org o UptimeRobot HTTP monitor apuntando a la misma URL con el header. Menos seguro (secreto en la config del tercero) pero funciona.

### Bucket propiedades-imagenes

Migracion nueva 20260718120300_alquiloya_propiedades_imagenes_bucket.sql crea el bucket publico. Meta necesita GET sin auth para leer la imagen antes de subirla a su CDN.

Tamanio limite: 10 MB (JPG/PNG/WEBP).

### Idempotencia

Cada job tiene idempotency_key formato:
  prop:{inmueble_id}:owner:{propietario|agente}:{owner_id}:net:{fb|ig}:v1

El INSERT usa ON CONFLICT DO NOTHING, asi doble aprobacion o retry del hook no crea dos jobs para la misma propiedad+red.

### Tests

Los tests unitarios de Entrega 1 siguen pasando. Nuevos tests:
- caption-generator.test.ts (9 tests): datos completos, sin datos, singular/plural, USD, truncar descripcion, maxLength, hashtags custom, operacion desconocida, precio 0.

Correr con:

    node --experimental-strip-types --test src/lib/meta/caption-generator.test.ts

### Limites conocidos Entrega 2

- Solo 1 imagen por post (la foto de portada). Post-MVP: FB multi-photo + IG carousel.
- Sin video en el post (aunque la propiedad tenga video_url).
- El caption es fijo (una plantilla). Post-MVP: plantillas seleccionables desde ERP.
- Si el usuario tiene mas de 5 pages: se muestran los primeros 5 al conectar.
- App Review requerido antes de propietarios/agentes reales.
