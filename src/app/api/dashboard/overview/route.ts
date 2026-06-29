import { NextResponse } from "next/server";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { queryWithRetry } from "@/lib/supabase/pg-retry";
import { getAuthUserForApiRoute } from "@/lib/auth/get-auth-user-for-api-route";
import { getClientSchema } from "@/lib/env/instance-mode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_ALQUILOYA_EMPRESA_ID = "cf5df6fb-7705-4c4e-b29c-97bf5f314d8f";

// Cache module-level: una vez que sabemos que una tabla existe en este schema,
// no preguntamos más. Se invalida con cada deploy (cold start del proceso).
const overviewTableExistsCache = new Map<string, boolean>();

// Cache de la respuesta completa por tenant (la data es la misma para todos los
// usuarios del mismo empresa_id). Stale-while-revalidate:
//  - Dentro de FRESH_MS: devuelve cache instantaneo.
//  - Entre FRESH_MS y STALE_MS: devuelve cache instantaneo Y refresca en background.
//  - Despues de STALE_MS: regenera bloqueando (el siguiente usuario espera).
// Esto elimina el "tarda mucho" despues del cold start: el primer usuario paga
// el costo, los demas siempre ven data inmediata.
import { overviewResponseCache, overviewCacheKey } from "@/lib/cache/dashboard-overview-cache";
const OVERVIEW_FRESH_MS = 2 * 60_000;   // 2 min sin tocar Postgres
const OVERVIEW_STALE_MS = 30 * 60_000;  // 30 min sirviendo stale + refresh background

type Severity = "danger" | "warning" | "info";

type Alerta = {
  key: string;
  label: string;
  count: number;
  severity: Severity;
  href: string;
};

type Kpi = {
  key: string;
  label: string;
  value: string;
  sub?: string;
  delta?: { value: number; sign: "up" | "down" | "flat"; suffix: string };
  href?: string;
};

type ActividadItem = {
  key: string;
  tipo: string;
  titulo: string;
  detalle?: string | null;
  cuando: string; // iso
  href?: string;
};

type ModulosDisponibles = {
  propiedades: boolean;
  agentes: boolean;
  propietarios: boolean;
  solicitudes_acceso: boolean;
  solicitudes_servicio: boolean;
  agente_resenas: boolean;
  agente_captaciones: boolean;
  consultas: boolean;
  facturas: boolean;
  pagos: boolean;
  productos: boolean;
};

export async function GET(request: Request) {
  try {
    const user = await getAuthUserForApiRoute(request);
    if (!user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const pool = getChatPostgresPool();
    if (!pool) {
      return NextResponse.json({ error: "Pool no disponible" }, { status: 500 });
    }

    const schema = getClientSchema();
    const empresaId =
      process.env.NEURA_CLIENT_EMPRESA_ID?.trim() || DEFAULT_ALQUILOYA_EMPRESA_ID;

    // ── Cache compartido por tenant (stale-while-revalidate) ────────────────
    // La respuesta es la misma para todos los usuarios del mismo empresa_id,
    // asi que un solo cache module-level sirve a todos. SWR:
    //   - fresh (<2 min): cache instantaneo
    //   - stale (<30 min): cache instantaneo + refresh en background
    //   - expirado: regenera bloqueando
    const cacheKey = overviewCacheKey(schema, empresaId);
    const now = Date.now();
    const cached = overviewResponseCache.get(cacheKey);

    const sq = (t: string) => `"${schema}"."${t}"`;

    // Funcion que recomputa el payload y lo guarda en cache. Se usa tanto en
    // el path bloqueante (cache vacio o expirado) como en background (stale).
    async function recompute(): Promise<unknown> {
      const data = await computePayload();
      overviewResponseCache.set(cacheKey, {
        data,
        computedAt: Date.now(),
        refreshing: false,
      });
      return data;
    }

    // SWR: si hay cache fresco, responde ya; si esta stale, responde con el
    // viejo y dispara refresh sin esperar.
    if (cached) {
      const age = now - cached.computedAt;
      if (age < OVERVIEW_FRESH_MS) {
        return NextResponse.json({ success: true, data: cached.data, cached: "fresh" });
      }
      if (age < OVERVIEW_STALE_MS) {
        if (!cached.refreshing) {
          cached.refreshing = true;
          recompute().catch((e) => {
            cached.refreshing = false;
            console.error(
              "[api/dashboard/overview swr-refresh]",
              e instanceof Error ? e.message : e
            );
          });
        }
        return NextResponse.json({ success: true, data: cached.data, cached: "stale" });
      }
    }

    // No hay cache (o esta demasiado viejo) — bloqueamos y computamos.
    const payload = await computePayload();
    overviewResponseCache.set(cacheKey, {
      data: payload,
      computedAt: Date.now(),
      refreshing: false,
    });
    return NextResponse.json({ success: true, data: payload });

    // ──────────────────────────────────────────────────────────────────────────
    // Heavy lifting — se evita cuando hay cache fresh/stale gracias a los
    // returns de arriba. Definido despues para poder usar closures sobre pool,
    // schema, empresaId, sq.
    // ──────────────────────────────────────────────────────────────────────────
    async function computePayload() {
    // Helpers tolerantes — nunca tiran, devuelven 0 / [] / false si falla.
    async function tableExists(name: string): Promise<boolean> {
      const cacheKey = `${schema}.${name}`;
      const cached = overviewTableExistsCache.get(cacheKey);
      if (cached !== undefined) return cached;
      try {
        const { rows } = await queryWithRetry<{ ok: boolean }>(
          pool!,
          `SELECT EXISTS (
             SELECT 1 FROM pg_class c
             JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname=$1 AND c.relname=$2 AND c.relkind='r'
           ) AS ok`,
          [schema, name]
        );
        const ok = rows[0]?.ok === true;
        overviewTableExistsCache.set(cacheKey, ok);
        return ok;
      } catch {
        return false;
      }
    }
    async function safeCount(sql: string): Promise<number> {
      try {
        const { rows } = await queryWithRetry<{ n: number }>(pool!, sql, [empresaId]);
        return rows[0]?.n ?? 0;
      } catch {
        return 0;
      }
    }
    async function safeRows<R extends Record<string, unknown>>(
      sql: string,
      params: unknown[] = [empresaId]
    ): Promise<R[]> {
      try {
        const { rows } = await queryWithRetry<R>(pool!, sql, params);
        return rows ?? [];
      } catch {
        return [];
      }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Descubrir módulos disponibles en el tenant.
    // ──────────────────────────────────────────────────────────────────────────
    const [
      hasPropiedades, hasAgentes, hasPropietarios,
      hasSolAcceso, hasSolServ, hasResenas, hasCaptaciones,
      hasConsultasProp, hasFacturas, hasPagos, hasProductos,
    ] = await Promise.all([
      tableExists("propiedades"),
      tableExists("agentes"),
      tableExists("propietarios"),
      tableExists("solicitudes_acceso"),
      tableExists("solicitudes_servicio"),
      tableExists("agente_resenas"),
      tableExists("agente_captaciones"),
      tableExists("consultas"),
      tableExists("facturas"),
      tableExists("pagos"),
      tableExists("productos"),
    ]);

    const modulos: ModulosDisponibles = {
      propiedades: hasPropiedades,
      agentes: hasAgentes,
      propietarios: hasPropietarios,
      solicitudes_acceso: hasSolAcceso,
      solicitudes_servicio: hasSolServ,
      agente_resenas: hasResenas,
      agente_captaciones: hasCaptaciones,
      consultas: hasConsultasProp,
      facturas: hasFacturas,
      pagos: hasPagos,
      productos: hasProductos,
    };

    // ──────────────────────────────────────────────────────────────────────────
    // TODO LO RESTANTE EN PARALELO — un solo Promise.all para todas las queries.
    // Esto reduce el tiempo total de N×latencia a max(latencia) ≈ 1 round-trip.
    // ──────────────────────────────────────────────────────────────────────────
    const Z = Promise.resolve(0);
    const ZR = Promise.resolve([] as Array<Record<string, unknown>>);

    const [
      // Counts para alertas
      cSolAcceso, cSolServ, cResenas, cPropPend, cConsultasPend,
      cVencidosProp, cVencidosAg, cVenc7Prop, cVenc7Ag,
      cPagos, cStock,
      // KPIs propiedades
      kpiPropTot, kpiPropHoy,
      // KPIs consultas
      kpiConsHoy, kpiConsAyer,
      // KPIs altas
      kpiAltasMes, kpiAltasHoy,
      // KPI facturas
      kpiFact,
      // Actividad
      actPropiedades, actSolicitudes, actResenas, actConsultas,
    ] = await Promise.all([
      hasSolAcceso ? safeCount(`SELECT count(*)::int AS n FROM ${sq("solicitudes_acceso")} WHERE empresa_id=$1::uuid AND estado='pendiente'`) : Z,
      hasSolServ ? safeCount(`SELECT count(*)::int AS n FROM ${sq("solicitudes_servicio")} WHERE empresa_id=$1::uuid AND estado='pendiente'`) : Z,
      hasResenas ? safeCount(`SELECT count(*)::int AS n FROM ${sq("agente_resenas")} WHERE empresa_id=$1::uuid AND estado='pendiente'`) : Z,
      // Propiedades pendientes de aprobacion: usamos el MISMO criterio que
      // la pantalla /dashboard/propiedades-pendientes (countErpPropiedadesPendientes
      // en erp-propiedades.ts) para que el numero de la alerta y el listado al
      // que linkea coincidan. Antes la query era mas amplia (activo=false OR
      // estado='inactiva') y daba 13 mientras el listado mostraba menos.
      hasPropiedades ? safeCount(`SELECT count(*)::int AS n FROM ${sq("propiedades")} WHERE empresa_id=$1::uuid AND activo = false AND visible_web = false AND (estado IS NULL OR estado IN ('inactiva'))`) : Z,
      hasConsultasProp ? safeCount(`SELECT count(*)::int AS n FROM ${sq("consultas")} WHERE empresa_id=$1::uuid AND COALESCE(estado,'') NOT IN ('respondida','descartada')`) : Z,
      hasPropietarios ? safeCount(`SELECT count(*)::int AS n FROM ${sq("propietarios")} WHERE empresa_id=$1::uuid AND activo=true AND COALESCE(plan_vencimiento_at, now() + interval '100 years') < now()`) : Z,
      hasAgentes ? safeCount(`SELECT count(*)::int AS n FROM ${sq("agentes")} WHERE empresa_id=$1::uuid AND activo=true AND COALESCE(plan_vencimiento_at, now() + interval '100 years') < now()`) : Z,
      hasPropietarios ? safeCount(`SELECT count(*)::int AS n FROM ${sq("propietarios")} WHERE empresa_id=$1::uuid AND activo=true AND plan_vencimiento_at IS NOT NULL AND plan_vencimiento_at BETWEEN now() AND now() + interval '7 days'`) : Z,
      hasAgentes ? safeCount(`SELECT count(*)::int AS n FROM ${sq("agentes")} WHERE empresa_id=$1::uuid AND activo=true AND plan_vencimiento_at IS NOT NULL AND plan_vencimiento_at BETWEEN now() AND now() + interval '7 days'`) : Z,
      hasPagos ? safeCount(`SELECT count(*)::int AS n FROM ${sq("pagos")} WHERE empresa_id=$1::uuid AND COALESCE(estado,'') = 'pendiente'`) : Z,
      hasProductos ? safeCount(`SELECT count(*)::int AS n FROM ${sq("productos")} WHERE empresa_id=$1::uuid AND COALESCE(stock,0) <= COALESCE(stock_minimo, 0) AND COALESCE(stock_minimo,0) > 0`) : Z,
      hasPropiedades ? safeRows<{ total: number; activas: number; destacadas: number }>(`SELECT count(*)::int AS total, count(*) FILTER (WHERE activo=true AND visible_web=true)::int AS activas, count(*) FILTER (WHERE destacada=true)::int AS destacadas FROM ${sq("propiedades")} WHERE empresa_id=$1::uuid`) : ZR,
      hasPropiedades ? safeCount(`SELECT count(*)::int AS n FROM ${sq("propiedades")} WHERE empresa_id=$1::uuid AND created_at::date = current_date`) : Z,
      hasConsultasProp ? safeCount(`SELECT count(*)::int AS n FROM ${sq("consultas")} WHERE empresa_id=$1::uuid AND created_at::date = current_date`) : Z,
      hasConsultasProp ? safeCount(`SELECT count(*)::int AS n FROM ${sq("consultas")} WHERE empresa_id=$1::uuid AND created_at::date = current_date - interval '1 day'`) : Z,
      hasSolAcceso ? safeCount(`SELECT count(*)::int AS n FROM ${sq("solicitudes_acceso")} WHERE empresa_id=$1::uuid AND estado='aprobada' AND created_at >= date_trunc('month', current_date)`) : Z,
      hasSolAcceso ? safeCount(`SELECT count(*)::int AS n FROM ${sq("solicitudes_acceso")} WHERE empresa_id=$1::uuid AND estado='aprobada' AND created_at::date = current_date`) : Z,
      hasFacturas ? safeRows<{ hoy: string }>(`SELECT COALESCE(sum(monto_total) FILTER (WHERE fecha::date = current_date), 0)::text AS hoy FROM ${sq("facturas")} WHERE empresa_id=$1::uuid AND COALESCE(estado,'') <> 'anulada'`) : ZR,
      hasPropiedades ? safeRows<{ id: string; titulo: string | null; created_at: string }>(`SELECT id, titulo, created_at::text AS created_at FROM ${sq("propiedades")} WHERE empresa_id=$1::uuid ORDER BY created_at DESC NULLS LAST LIMIT 5`) : ZR,
      hasSolAcceso ? safeRows<{ id: string; nombre: string; tipo: string; created_at: string }>(`SELECT id, nombre, tipo, created_at::text AS created_at FROM ${sq("solicitudes_acceso")} WHERE empresa_id=$1::uuid ORDER BY created_at DESC NULLS LAST LIMIT 5`) : ZR,
      hasResenas ? safeRows<{ id: string; autor_nombre: string; stars: number; created_at: string }>(`SELECT id, autor_nombre, stars, created_at::text AS created_at FROM ${sq("agente_resenas")} WHERE empresa_id=$1::uuid ORDER BY created_at DESC NULLS LAST LIMIT 5`) : ZR,
      hasConsultasProp ? safeRows<{ id: string; nombre: string | null; created_at: string }>(`SELECT id, COALESCE(NULLIF(nombre,''), 'Consulta anónima') AS nombre, created_at::text AS created_at FROM ${sq("consultas")} WHERE empresa_id=$1::uuid ORDER BY created_at DESC NULLS LAST LIMIT 5`) : ZR,
    ]);

    // ── Construir ALERTAS ───────────────────────────────────────────────────
    // Solo se muestra una tarjeta si tiene pendientes reales (> 0). Cuando
    // no hay nada pendiente la franja entera desaparece — pedido del cliente:
    // "que solo aparezcan las dos que estaban antes cuando habia algo".
    const alertas: Alerta[] = [];
    if (cPropPend > 0) alertas.push({ key: "propiedades_pendientes", label: "Pendientes de aprobación", count: cPropPend as number, severity: "warning", href: "/dashboard/propiedades-pendientes" });
    if (cSolAcceso > 0) alertas.push({ key: "solicitudes_acceso", label: "Solicitudes de acceso", count: cSolAcceso as number, severity: "warning", href: "/dashboard/solicitudes-acceso" });
    if (cSolServ > 0) alertas.push({ key: "solicitudes_servicio", label: "Servicios pendientes", count: cSolServ as number, severity: "warning", href: "/dashboard/solicitudes-servicio" });
    if (cResenas > 0) alertas.push({ key: "resenas_pendientes", label: "Reseñas a moderar", count: cResenas as number, severity: "info", href: "/dashboard/agente-resenas" });
    if (cConsultasPend > 0) alertas.push({ key: "consultas_sin_responder", label: "Consultas sin responder", count: cConsultasPend as number, severity: "warning", href: "/dashboard/propiedades" });
    const vencidos = (cVencidosProp as number) + (cVencidosAg as number);
    const porVencer7 = (cVenc7Prop as number) + (cVenc7Ag as number);
    if (vencidos > 0) alertas.push({ key: "planes_vencidos", label: "Planes vencidos", count: vencidos, severity: "danger", href: "/dashboard/agentes-inmobiliarios" });
    if (porVencer7 > 0) alertas.push({ key: "planes_por_vencer", label: "Vencen en 7 días", count: porVencer7, severity: "warning", href: "/dashboard/agentes-inmobiliarios" });
    if (cPagos > 0) alertas.push({ key: "pagos_pendientes", label: "Pagos pendientes", count: cPagos, severity: "danger", href: "/pagos" });
    if (cStock > 0) alertas.push({ key: "stock_bajo", label: "Stock bajo", count: cStock, severity: "warning", href: "/inventario" });

    // ── Construir KPIs ──────────────────────────────────────────────────────
    const kpis: Kpi[] = [];
    if (hasPropiedades) {
      const t = (kpiPropTot as { total: number; activas: number; destacadas: number }[])[0] ?? { total: 0, activas: 0, destacadas: 0 };
      kpis.push({ key: "propiedades_hoy", label: "Propiedades publicadas hoy", value: String(kpiPropHoy), sub: `${t.activas} activas · ${t.total} totales`, href: "/dashboard/propiedades" });
    }
    if (hasConsultasProp) {
      const delta = (kpiConsHoy as number) - (kpiConsAyer as number);
      kpis.push({ key: "consultas_hoy", label: "Consultas hoy", value: String(kpiConsHoy), delta: { value: Math.abs(delta), sign: delta > 0 ? "up" : delta < 0 ? "down" : "flat", suffix: "vs ayer" } });
    }
    if (hasSolAcceso) {
      kpis.push({ key: "altas_hoy", label: "Altas aprobadas hoy", value: String(kpiAltasHoy), sub: (kpiAltasMes as number) > 0 ? `${kpiAltasMes} este mes` : "0 este mes", href: "/dashboard/solicitudes-acceso" });
    }
    if (hasFacturas) {
      const r = (kpiFact as { hoy: string }[])[0] ?? { hoy: "0" };
      const hoyN = Number(r.hoy) || 0;
      const fmtGs = new Intl.NumberFormat("es-PY", { style: "currency", currency: "PYG", maximumFractionDigits: 0 });
      kpis.push({ key: "ventas_dia", label: "Ventas del día", value: fmtGs.format(hoyN) });
    }

    // ── Construir ACTIVIDAD ─────────────────────────────────────────────────
    const actividad: ActividadItem[] = [];
    (actPropiedades as { id: string; titulo: string | null; created_at: string }[]).forEach((r) =>
      actividad.push({ key: `prop-${r.id}`, tipo: "Propiedad", titulo: r.titulo ?? "Propiedad sin título", cuando: r.created_at, href: `/dashboard/propiedades/${r.id}` })
    );
    (actSolicitudes as { id: string; nombre: string; tipo: string; created_at: string }[]).forEach((r) =>
      actividad.push({ key: `sol-${r.id}`, tipo: "Solicitud", titulo: r.nombre, detalle: r.tipo, cuando: r.created_at, href: "/dashboard/solicitudes-acceso" })
    );
    (actResenas as { id: string; autor_nombre: string; stars: number; created_at: string }[]).forEach((r) =>
      actividad.push({ key: `res-${r.id}`, tipo: "Reseña", titulo: r.autor_nombre, detalle: `${r.stars} ★`, cuando: r.created_at, href: "/dashboard/agente-resenas" })
    );
    (actConsultas as { id: string; nombre: string | null; created_at: string }[]).forEach((r) =>
      actividad.push({ key: `cons-${r.id}`, tipo: "Consulta", titulo: r.nombre ?? "Consulta", cuando: r.created_at, href: "/dashboard/propiedades" })
    );
    actividad.sort((a, b) => (a.cuando < b.cuando ? 1 : a.cuando > b.cuando ? -1 : 0));
    const actividadFinal = actividad.slice(0, 10);

    const payload = {
      modulos,
      alertas,
      kpis,
      actividad: actividadFinal,
    };
    return payload;
    } // fin computePayload
  } catch (err) {
    console.error("[api/dashboard/overview]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Error al cargar overview" }, { status: 500 });
  }
}

