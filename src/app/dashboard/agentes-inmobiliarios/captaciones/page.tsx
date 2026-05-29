import "server-only";
import Link from "next/link";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { queryWithRetry } from "@/lib/supabase/pg-retry";
import { EtapaSelect, EtapaBadge, ETAPA_LABELS } from "./_components/EtapaSelect";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALQUILOYA_EMPRESA_ID = "cf5df6fb-7705-4c4e-b29c-97bf5f314d8f";

type Cards = {
  total: number; nuevo: number; contacto: number; negocio_activo: number;
  cerrado: number; rechazado: number; tasa_cierre: number; ult_7: number; ult_30: number;
};
type ByAgent = {
  agente_id: string; agente_nombre: string | null; total: number;
  nuevo: number; contacto: number; negocio_activo: number; cerrado: number; rechazado: number;
};
type ByDate = { dia: string; total: number };
type Recent = {
  id: string; propietario_nombre: string | null; propietario_email: string | null; propietario_telefono: string | null;
  propiedad_titulo: string | null; ciudad: string | null; barrio: string | null;
  etapa: string; estado: string; created_at: string | null;
  agente_id: string | null; agente_nombre: string | null;
};

async function load(): Promise<{ cards: Cards; byAgent: ByAgent[]; byDate: ByDate[]; recent: Recent[] }> {
  const empty: Cards = { total: 0, nuevo: 0, contacto: 0, negocio_activo: 0, cerrado: 0, rechazado: 0, tasa_cierre: 0, ult_7: 0, ult_30: 0 };
  const pool = getChatPostgresPool();
  if (!pool) return { cards: empty, byAgent: [], byDate: [], recent: [] };
  try {
    const cards = await queryWithRetry<Cards & { ult_7: number; ult_30: number }>(
      pool,
      `SELECT
         count(*)::int                                                       AS total,
         count(*) FILTER (WHERE etapa='nuevo')::int                          AS nuevo,
         count(*) FILTER (WHERE etapa='contacto')::int                       AS contacto,
         count(*) FILTER (WHERE etapa='negocio_activo')::int                 AS negocio_activo,
         count(*) FILTER (WHERE etapa='cerrado')::int                        AS cerrado,
         count(*) FILTER (WHERE etapa='rechazado')::int                      AS rechazado,
         count(*) FILTER (WHERE created_at >= now() - interval '7 days')::int  AS ult_7,
         count(*) FILTER (WHERE created_at >= now() - interval '30 days')::int AS ult_30
       FROM "alquiloya"."agente_captaciones"
       WHERE empresa_id = $1::uuid`,
      [ALQUILOYA_EMPRESA_ID]
    );
    const c0 = cards.rows[0] ?? empty;
    const denom = c0.cerrado + c0.rechazado;
    const tasa_cierre = denom > 0 ? Math.round((c0.cerrado / denom) * 1000) / 10 : 0;
    const c: Cards = { ...c0, tasa_cierre };

    const byAgent = await queryWithRetry<ByAgent>(
      pool,
      `SELECT c.agente_id, a.nombre AS agente_nombre,
              count(*)::int AS total,
              count(*) FILTER (WHERE c.etapa='nuevo')::int          AS nuevo,
              count(*) FILTER (WHERE c.etapa='contacto')::int       AS contacto,
              count(*) FILTER (WHERE c.etapa='negocio_activo')::int AS negocio_activo,
              count(*) FILTER (WHERE c.etapa='cerrado')::int        AS cerrado,
              count(*) FILTER (WHERE c.etapa='rechazado')::int      AS rechazado
         FROM "alquiloya"."agente_captaciones" c
         LEFT JOIN "alquiloya"."agentes" a
           ON a.id = c.agente_id AND a.empresa_id = c.empresa_id
        WHERE c.empresa_id = $1::uuid
        GROUP BY c.agente_id, a.nombre
        ORDER BY total DESC, a.nombre ASC NULLS LAST`,
      [ALQUILOYA_EMPRESA_ID]
    );

    const byDate = await queryWithRetry<ByDate>(
      pool,
      `WITH dias AS (
         SELECT (current_date - i)::date AS dia
         FROM generate_series(0, 29) AS g(i)
       )
       SELECT to_char(d.dia, 'YYYY-MM-DD') AS dia, COALESCE(x.n, 0)::int AS total
         FROM dias d
         LEFT JOIN (
           SELECT date_trunc('day', created_at)::date AS dia, count(*)::int AS n
             FROM "alquiloya"."agente_captaciones"
            WHERE empresa_id = $1::uuid AND created_at >= now() - interval '30 days'
            GROUP BY 1
         ) x ON x.dia = d.dia
        ORDER BY d.dia ASC`,
      [ALQUILOYA_EMPRESA_ID]
    );

    const recent = await queryWithRetry<Recent>(
      pool,
      `SELECT c.id, c.propietario_nombre, c.propietario_email, c.propietario_telefono,
              c.propiedad_titulo, c.ciudad, c.barrio, c.etapa, c.estado,
              c.created_at::text AS created_at,
              c.agente_id, a.nombre AS agente_nombre
         FROM "alquiloya"."agente_captaciones" c
         LEFT JOIN "alquiloya"."agentes" a
           ON a.id = c.agente_id AND a.empresa_id = c.empresa_id
        WHERE c.empresa_id = $1::uuid
        ORDER BY c.created_at DESC
        LIMIT 20`,
      [ALQUILOYA_EMPRESA_ID]
    );

    return { cards: c, byAgent: byAgent.rows ?? [], byDate: byDate.rows ?? [], recent: recent.rows ?? [] };
  } catch (e) {
    console.warn("[captaciones dashboard]", (e as Error).message);
    return { cards: empty, byAgent: [], byDate: [], recent: [] };
  }
}

function fmt(n: number): string { try { return new Intl.NumberFormat("es-PY").format(n); } catch { return String(n); } }

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{value}</div>
      {sub ? <div className="mt-0.5 text-[11px] text-slate-400">{sub}</div> : null}
    </div>
  );
}

function Sparkline({ points }: { points: number[] }) {
  if (points.length === 0) return null;
  const w = 600;
  const h = 60;
  const max = Math.max(1, ...points);
  const step = w / Math.max(1, points.length - 1);
  const path = points.map((v, i) => `${i === 0 ? "M" : "L"} ${(i * step).toFixed(1)} ${(h - (v / max) * (h - 6) - 3).toFixed(1)}`).join(" ");
  const area = path + ` L ${w} ${h} L 0 ${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" preserveAspectRatio="none" className="block">
      <defs>
        <linearGradient id="capt-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4FAEB2" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#4FAEB2" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#capt-grad)" />
      <path d={path} stroke="#3F8E91" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default async function CaptacionesDashboardPage() {
  const { cards, byAgent, byDate, recent } = await load();

  return (
    <div className="px-6 py-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            href="/dashboard/agentes-inmobiliarios"
            className="mb-2 inline-flex text-xs font-medium text-slate-500 hover:text-[#3F8E91]"
          >
            ← Volver al listado
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Dashboard captaciones</h1>
          <p className="mt-1 text-sm text-slate-500">
            Métricas, distribución por agente, evolución temporal y últimas solicitudes recibidas.
          </p>
        </div>
      </header>

      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total" value={fmt(cards.total)} />
        <StatCard label="Nuevas" value={fmt(cards.nuevo)} />
        <StatCard label="En contacto" value={fmt(cards.contacto)} />
        <StatCard label="Negocio activo" value={fmt(cards.negocio_activo)} />
        <StatCard label="Cerradas" value={fmt(cards.cerrado)} />
        <StatCard label="Rechazadas" value={fmt(cards.rechazado)} />
      </section>

      <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Tasa de cierre" value={`${cards.tasa_cierre}%`} sub="cerradas / (cerradas + rechazadas)" />
        <StatCard label="Últimos 7 días" value={fmt(cards.ult_7)} sub="nuevas captaciones" />
        <StatCard label="Últimos 30 días" value={fmt(cards.ult_30)} sub="nuevas captaciones" />
      </section>

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Captaciones por día (últimos 30)</h2>
        {byDate.length === 0 || byDate.every((d) => d.total === 0) ? (
          <div className="py-8 text-center text-sm text-slate-500">Sin captaciones en los últimos 30 días.</div>
        ) : (
          <>
            <Sparkline points={byDate.map((d) => d.total)} />
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
              <span>{byDate[0]?.dia}</span>
              <span>{byDate[byDate.length - 1]?.dia}</span>
            </div>
          </>
        )}
      </section>

      <section className="mb-6 rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-700">Captaciones por agente</h2>
        </div>
        {byAgent.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-slate-500">Sin datos.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">Agente</th>
                  <th className="px-4 py-2.5 text-center">Total</th>
                  <th className="px-4 py-2.5 text-center">Nuevo</th>
                  <th className="px-4 py-2.5 text-center">Contacto</th>
                  <th className="px-4 py-2.5 text-center">Negocio activo</th>
                  <th className="px-4 py-2.5 text-center">Cerrado</th>
                  <th className="px-4 py-2.5 text-center">Rechazado</th>
                  <th className="px-4 py-2.5 text-right">Tasa cierre</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {byAgent.map((a) => {
                  const den = a.cerrado + a.rechazado;
                  const tasa = den > 0 ? Math.round((a.cerrado / den) * 1000) / 10 : 0;
                  return (
                    <tr key={a.agente_id} className="hover:bg-slate-50">
                      <td className="px-4 py-2 font-medium text-slate-900">
                        {a.agente_id ? (
                          <Link href={`/dashboard/agentes-inmobiliarios/agentes/${a.agente_id}`} className="hover:text-[#3F8E91]">
                            {a.agente_nombre ?? "—"}
                          </Link>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-2 text-center tabular-nums font-semibold">{a.total}</td>
                      <td className="px-4 py-2 text-center tabular-nums">{a.nuevo}</td>
                      <td className="px-4 py-2 text-center tabular-nums">{a.contacto}</td>
                      <td className="px-4 py-2 text-center tabular-nums">{a.negocio_activo}</td>
                      <td className="px-4 py-2 text-center tabular-nums">{a.cerrado}</td>
                      <td className="px-4 py-2 text-center tabular-nums">{a.rechazado}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{tasa}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-700">Últimas captaciones</h2>
        </div>
        {recent.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-slate-500">Sin captaciones todavía.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">Propietario</th>
                  <th className="px-4 py-2.5">Contacto</th>
                  <th className="px-4 py-2.5">Propiedad</th>
                  <th className="px-4 py-2.5">Ubicación</th>
                  <th className="px-4 py-2.5">Agente</th>
                  <th className="px-4 py-2.5">Estado</th>
                  <th className="px-4 py-2.5">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recent.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2 font-medium text-slate-900">{r.propietario_nombre ?? "—"}</td>
                    <td className="px-4 py-2 text-xs text-slate-600">
                      {r.propietario_email ? <div>{r.propietario_email}</div> : null}
                      {r.propietario_telefono ? <div>{r.propietario_telefono}</div> : null}
                      {!r.propietario_email && !r.propietario_telefono ? "—" : null}
                    </td>
                    <td className="px-4 py-2 text-slate-700">{r.propiedad_titulo ?? "—"}</td>
                    <td className="px-4 py-2 text-xs text-slate-600">
                      {[r.ciudad, r.barrio].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="px-4 py-2 text-slate-700">{r.agente_nombre ?? "—"}</td>
                    <td className="px-4 py-2">
                      <EtapaSelect captacionId={r.id} initial={r.etapa} />
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-500">{r.created_at?.slice(0, 10) ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="mt-4 text-[11px] text-slate-400">
        Etapas: {Object.values(ETAPA_LABELS).join(" · ")}
      </p>
    </div>
  );
}
