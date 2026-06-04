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
  consultas_propiedad: boolean;
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

    const sq = (t: string) => `"${schema}"."${t}"`;

    // ──────────────────────────────────────────────────────────────────────────
    // Helpers tolerantes — nunca tiran, devuelven 0 / [] / false si falla.
    // ──────────────────────────────────────────────────────────────────────────
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
      tableExists("consultas_propiedad"),
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
      consultas_propiedad: hasConsultasProp,
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
      cSolAcceso, cSolServ, cResenas, cCaptaciones, cConsultasPend,
      cVencidosProp, cVencidosAg, cVenc7Prop, cVenc7Ag,
      cPagos, cStock,
      // KPIs propiedades
      kpiPropTot, kpiPropHoy, kpiPropSemana,
      // KPIs consultas
      kpiConsHoy, kpiConsAyer, kpiConsMes,
      // KPIs altas
      kpiAltasMes, kpiAltasTotalMes,
      // KPI facturas
      kpiFact,
      // Actividad
      actPropiedades, actSolicitudes, actResenas, actConsultas,
    ] = await Promise.all([
      hasSolAcceso ? safeCount(`SELECT count(*)::int AS n FROM ${sq("solicitudes_acceso")} WHERE empresa_id=$1::uuid AND estado='pendiente'`) : Z,
      hasSolServ ? safeCount(`SELECT count(*)::int AS n FROM ${sq("solicitudes_servicio")} WHERE empresa_id=$1::uuid AND estado='pendiente'`) : Z,
      hasResenas ? safeCount(`SELECT count(*)::int AS n FROM ${sq("agente_resenas")} WHERE empresa_id=$1::uuid AND estado='pendiente'`) : Z,
      hasCaptaciones ? safeCount(`SELECT count(*)::int AS n FROM ${sq("agente_captaciones")} WHERE empresa_id=$1::uuid AND COALESCE(estado,'') NOT IN ('cerrada','finalizada','descartada')`) : Z,
      hasConsultasProp ? safeCount(`SELECT count(*)::int AS n FROM ${sq("consultas_propiedad")} WHERE empresa_id=$1::uuid AND activo=true AND COALESCE(estado,'') NOT IN ('cerrada','atendida','descartada')`) : Z,
      hasPropietarios ? safeCount(`SELECT count(*)::int AS n FROM ${sq("propietarios")} WHERE empresa_id=$1::uuid AND activo=true AND COALESCE(plan_vencimiento_at, now() + interval '100 years') < now()`) : Z,
      hasAgentes ? safeCount(`SELECT count(*)::int AS n FROM ${sq("agentes")} WHERE empresa_id=$1::uuid AND activo=true AND COALESCE(plan_vencimiento_at, now() + interval '100 years') < now()`) : Z,
      hasPropietarios ? safeCount(`SELECT count(*)::int AS n FROM ${sq("propietarios")} WHERE empresa_id=$1::uuid AND activo=true AND plan_vencimiento_at IS NOT NULL AND plan_vencimiento_at BETWEEN now() AND now() + interval '7 days'`) : Z,
      hasAgentes ? safeCount(`SELECT count(*)::int AS n FROM ${sq("agentes")} WHERE empresa_id=$1::uuid AND activo=true AND plan_vencimiento_at IS NOT NULL AND plan_vencimiento_at BETWEEN now() AND now() + interval '7 days'`) : Z,
      hasPagos ? safeCount(`SELECT count(*)::int AS n FROM ${sq("pagos")} WHERE empresa_id=$1::uuid AND COALESCE(estado,'') = 'pendiente'`) : Z,
      hasProductos ? safeCount(`SELECT count(*)::int AS n FROM ${sq("productos")} WHERE empresa_id=$1::uuid AND COALESCE(stock,0) <= COALESCE(stock_minimo, 0) AND COALESCE(stock_minimo,0) > 0`) : Z,
      hasPropiedades ? safeRows<{ total: number; activas: number; destacadas: number }>(`SELECT count(*)::int AS total, count(*) FILTER (WHERE activo=true AND visible_web=true)::int AS activas, count(*) FILTER (WHERE destacada=true)::int AS destacadas FROM ${sq("propiedades")} WHERE empresa_id=$1::uuid`) : ZR,
      hasPropiedades ? safeCount(`SELECT count(*)::int AS n FROM ${sq("propiedades")} WHERE empresa_id=$1::uuid AND created_at::date = current_date`) : Z,
      hasPropiedades ? safeCount(`SELECT count(*)::int AS n FROM ${sq("propiedades")} WHERE empresa_id=$1::uuid AND created_at >= date_trunc('week', current_date)`) : Z,
      hasConsultasProp ? safeCount(`SELECT count(*)::int AS n FROM ${sq("consultas_propiedad")} WHERE empresa_id=$1::uuid AND activo=true AND created_at::date = current_date`) : Z,
      hasConsultasProp ? safeCount(`SELECT count(*)::int AS n FROM ${sq("consultas_propiedad")} WHERE empresa_id=$1::uuid AND activo=true AND created_at::date = current_date - interval '1 day'`) : Z,
      hasConsultasProp ? safeCount(`SELECT count(*)::int AS n FROM ${sq("consultas_propiedad")} WHERE empresa_id=$1::uuid AND activo=true AND created_at >= date_trunc('month', current_date)`) : Z,
      hasSolAcceso ? safeCount(`SELECT count(*)::int AS n FROM ${sq("solicitudes_acceso")} WHERE empresa_id=$1::uuid AND estado='aprobada' AND created_at >= date_trunc('month', current_date)`) : Z,
      hasSolAcceso ? safeCount(`SELECT count(*)::int AS n FROM ${sq("solicitudes_acceso")} WHERE empresa_id=$1::uuid AND created_at >= date_trunc('month', current_date)`) : Z,
      hasFacturas ? safeRows<{ hoy: string; mes: string }>(`SELECT COALESCE(sum(monto_total) FILTER (WHERE fecha::date = current_date), 0)::text AS hoy, COALESCE(sum(monto_total) FILTER (WHERE fecha >= date_trunc('month', current_date)), 0)::text AS mes FROM ${sq("facturas")} WHERE empresa_id=$1::uuid AND COALESCE(estado,'') <> 'anulada'`) : ZR,
      hasPropiedades ? safeRows<{ id: string; titulo: string | null; created_at: string }>(`SELECT id, titulo, created_at::text AS created_at FROM ${sq("propiedades")} WHERE empresa_id=$1::uuid ORDER BY created_at DESC NULLS LAST LIMIT 5`) : ZR,
      hasSolAcceso ? safeRows<{ id: string; nombre: string; tipo: string; created_at: string }>(`SELECT id, nombre, tipo, created_at::text AS created_at FROM ${sq("solicitudes_acceso")} WHERE empresa_id=$1::uuid ORDER BY created_at DESC NULLS LAST LIMIT 5`) : ZR,
      hasResenas ? safeRows<{ id: string; autor_nombre: string; stars: number; created_at: string }>(`SELECT id, autor_nombre, stars, created_at::text AS created_at FROM ${sq("agente_resenas")} WHERE empresa_id=$1::uuid ORDER BY created_at DESC NULLS LAST LIMIT 5`) : ZR,
      hasConsultasProp ? safeRows<{ id: string; nombre: string | null; created_at: string }>(`SELECT id, COALESCE(NULLIF(nombre,''), 'Consulta anónima') AS nombre, created_at::text AS created_at FROM ${sq("consultas_propiedad")} WHERE empresa_id=$1::uuid AND activo=true ORDER BY created_at DESC NULLS LAST LIMIT 5`) : ZR,
    ]);

    // ── Construir ALERTAS ───────────────────────────────────────────────────
    const alertas: Alerta[] = [];
    if (cSolAcceso > 0) alertas.push({ key: "solicitudes_acceso", label: "Solicitudes de acceso", count: cSolAcceso, severity: "warning", href: "/dashboard/solicitudes-acceso" });
    if (cSolServ > 0) alertas.push({ key: "solicitudes_servicio", label: "Servicios pendientes", count: cSolServ, severity: "warning", href: "/dashboard/solicitudes-servicio" });
    if (cResenas > 0) alertas.push({ key: "resenas_pendientes", label: "Reseñas a moderar", count: cResenas, severity: "info", href: "/dashboard/agente-resenas" });
    if (cCaptaciones > 0) alertas.push({ key: "captaciones", label: "Captaciones abiertas", count: cCaptaciones, severity: "info", href: "/dashboard/agentes-inmobiliarios/captaciones" });
    if (cConsultasPend > 0) alertas.push({ key: "consultas_sin_responder", label: "Consultas sin responder", count: cConsultasPend, severity: "warning", href: "/dashboard/propiedades" });
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
      kpis.push({ key: "propiedades_total", label: "Propiedades publicadas", value: `${t.activas}`, sub: `${t.total} totales · ${t.destacadas} destacadas`, href: "/dashboard/propiedades" });
      kpis.push({ key: "propiedades_nuevas", label: "Nuevas esta semana", value: String(kpiPropSemana), sub: kpiPropHoy === 1 ? "1 cargada hoy" : `${kpiPropHoy} cargadas hoy`, href: "/dashboard/propiedades" });
    }
    if (hasConsultasProp) {
      const delta = (kpiConsHoy as number) - (kpiConsAyer as number);
      kpis.push({ key: "consultas_hoy", label: "Consultas hoy", value: String(kpiConsHoy), sub: `${kpiConsMes} este mes`, delta: { value: Math.abs(delta), sign: delta > 0 ? "up" : delta < 0 ? "down" : "flat", suffix: "vs ayer" } });
    }
    if (hasSolAcceso) {
      const ratio = (kpiAltasTotalMes as number) > 0 ? Math.round(((kpiAltasMes as number) / (kpiAltasTotalMes as number)) * 100) : 0;
      kpis.push({ key: "altas_mes", label: "Altas aprobadas (mes)", value: String(kpiAltasMes), sub: (kpiAltasTotalMes as number) > 0 ? `${ratio}% de ${kpiAltasTotalMes} solicitudes` : "sin solicitudes este mes", href: "/dashboard/solicitudes-acceso" });
    }
    if (hasFacturas) {
      const r = (kpiFact as { hoy: string; mes: string }[])[0] ?? { hoy: "0", mes: "0" };
      const hoyN = Number(r.hoy) || 0;
      const mesN = Number(r.mes) || 0;
      const fmtGs = new Intl.NumberFormat("es-PY", { style: "currency", currency: "PYG", maximumFractionDigits: 0 });
      kpis.push({ key: "ventas_dia", label: "Ventas del día", value: fmtGs.format(hoyN), sub: `${fmtGs.format(mesN)} este mes` });
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

    return NextResponse.json({
      success: true,
      data: {
        modulos,
        alertas,
        kpis,
        actividad: actividadFinal,
      },
    });
  } catch (err) {
    console.error("[api/dashboard/overview]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Error al cargar overview" }, { status: 500 });
  }
}
