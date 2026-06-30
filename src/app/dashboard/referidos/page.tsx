import "server-only";
import Link from "next/link";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { queryWithRetry } from "@/lib/supabase/pg-retry";
import { CopySlugButton } from "./_components/CopySlugButton";
import ComoFuncionaEditor from "./_components/ComoFuncionaEditor";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALQUILOYA_EMPRESA_ID = "cf5df6fb-7705-4c4e-b29c-97bf5f314d8f";

type Stats = {
  partners: number;
  linksActivos: number;
  clicks: number;
  conversiones: number;
  comisionPendiente: number;
};

async function tableExists(name: string): Promise<boolean> {
  const pool = getChatPostgresPool();
  if (!pool) return false;
  const { rows } = await queryWithRetry<{ e: boolean }>(
    pool,
    `SELECT EXISTS (
       SELECT 1 FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname='alquiloya' AND c.relname=$1 AND c.relkind='r'
     ) AS e`,
    [name]
  );
  return rows?.[0]?.e === true;
}

async function loadStats(): Promise<Stats> {
  const empty: Stats = {
    partners: 0, linksActivos: 0, clicks: 0, conversiones: 0, comisionPendiente: 0,
  };
  const pool = getChatPostgresPool();
  if (!pool) return empty;
  if (!(await tableExists("referral_partners"))) return empty;
  try {
    const [{ rows: p }, { rows: l }, { rows: c }, { rows: cv }, { rows: cm }] = await Promise.all([
      queryWithRetry<{ n: number }>(
        pool,
        `SELECT count(*)::int AS n FROM alquiloya.referral_partners WHERE empresa_id=$1::uuid`,
        [ALQUILOYA_EMPRESA_ID]
      ),
      queryWithRetry<{ n: number }>(
        pool,
        `SELECT count(*)::int AS n FROM alquiloya.referral_links WHERE empresa_id=$1::uuid AND activo=true`,
        [ALQUILOYA_EMPRESA_ID]
      ),
      queryWithRetry<{ n: number }>(
        pool,
        `SELECT count(*)::int AS n FROM alquiloya.referral_clicks WHERE empresa_id=$1::uuid`,
        [ALQUILOYA_EMPRESA_ID]
      ),
      queryWithRetry<{ n: number }>(
        pool,
        `SELECT count(*)::int AS n FROM alquiloya.referral_conversions WHERE empresa_id=$1::uuid`,
        [ALQUILOYA_EMPRESA_ID]
      ),
      queryWithRetry<{ n: string | null }>(
        pool,
        `SELECT COALESCE(sum(monto_comision),0)::text AS n
           FROM alquiloya.referral_commissions
          WHERE empresa_id=$1::uuid AND estado='pendiente'`,
        [ALQUILOYA_EMPRESA_ID]
      ),
    ]);
    return {
      partners: p[0]?.n ?? 0,
      linksActivos: l[0]?.n ?? 0,
      clicks: c[0]?.n ?? 0,
      conversiones: cv[0]?.n ?? 0,
      comisionPendiente: Number(cm[0]?.n ?? "0"),
    };
  } catch { return empty; }
}

type PartnerRow = {
  id: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  tipo: string | null;
  activo: boolean;
  primary_slug: string | null;
  primary_campania: string | null;
  rule_tipo: string | null;
  rule_valor: number | null;
  rule_moneda: string | null;
  rule_recurrente: boolean | null;
  rule_meses_recurrencia: number | null;
  links_count: number;
  clicks_count: number;
  conversiones_count: number;
  comision_pendiente: number;
};

async function loadPartners(): Promise<PartnerRow[]> {
  const pool = getChatPostgresPool();
  if (!pool) return [];
  if (!(await tableExists("referral_partners"))) return [];
  try {
    const { rows } = await queryWithRetry<PartnerRow>(
      pool,
      `
        SELECT
          p.id, p.nombre, p.email, p.telefono, p.tipo, p.activo,
          lk.slug AS primary_slug,
          lk.campania AS primary_campania,
          r.tipo AS rule_tipo,
          r.valor::float8 AS rule_valor,
          r.moneda AS rule_moneda,
          r.recurrente AS rule_recurrente,
          r.meses_recurrencia AS rule_meses_recurrencia,
          COALESCE(lc.n, 0)::int AS links_count,
          COALESCE(cc.n, 0)::int AS clicks_count,
          COALESCE(cv.n, 0)::int AS conversiones_count,
          COALESCE(cm.s, 0)::float8 AS comision_pendiente
        FROM alquiloya.referral_partners p
        LEFT JOIN LATERAL (
          SELECT slug, campania FROM alquiloya.referral_links
           WHERE partner_id = p.id ORDER BY activo DESC, created_at ASC LIMIT 1
        ) lk ON true
        LEFT JOIN LATERAL (
          SELECT tipo, valor, moneda, recurrente, meses_recurrencia
            FROM alquiloya.referral_commission_rules
           WHERE partner_id = p.id AND vigente_hasta IS NULL
           ORDER BY vigente_desde DESC LIMIT 1
        ) r ON true
        LEFT JOIN LATERAL (
          SELECT count(*)::int AS n FROM alquiloya.referral_links
           WHERE partner_id = p.id AND activo = true
        ) lc ON true
        LEFT JOIN LATERAL (
          SELECT count(*)::int AS n FROM alquiloya.referral_clicks
           WHERE empresa_id = p.empresa_id
             AND link_id IN (SELECT id FROM alquiloya.referral_links WHERE partner_id = p.id)
        ) cc ON true
        LEFT JOIN LATERAL (
          SELECT count(*)::int AS n FROM alquiloya.referral_conversions
           WHERE partner_id = p.id
        ) cv ON true
        LEFT JOIN LATERAL (
          SELECT COALESCE(sum(monto_comision),0) AS s FROM alquiloya.referral_commissions
           WHERE partner_id = p.id AND estado = 'pendiente'
        ) cm ON true
        WHERE p.empresa_id = $1::uuid
        ORDER BY p.created_at DESC NULLS LAST, lower(p.nombre) ASC
      `,
      [ALQUILOYA_EMPRESA_ID]
    );
    return rows ?? [];
  } catch { return []; }
}

function fmt(n: number): string {
  try { return new Intl.NumberFormat("es-PY").format(n); } catch { return String(n); }
}
function fmtGs(n: number): string {
  try {
    return new Intl.NumberFormat("es-PY", { style: "currency", currency: "PYG", maximumFractionDigits: 0 }).format(n);
  } catch { return `Gs. ${n.toLocaleString("es-PY")}`; }
}
function fmtComision(p: PartnerRow): string {
  if (p.rule_tipo === "porcentaje" && p.rule_valor != null) {
    const r = p.rule_recurrente ? ` × ${p.rule_meses_recurrencia ?? "?"}m` : "";
    return `${p.rule_valor}%${r}`;
  }
  if (p.rule_tipo === "monto_fijo" && p.rule_valor != null) {
    const moneda = p.rule_moneda ?? "PYG";
    const r = p.rule_recurrente ? ` × ${p.rule_meses_recurrencia ?? "?"}m` : "";
    return `${moneda} ${p.rule_valor.toLocaleString("es-PY")}${r}`;
  }
  return "—";
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{value}</div>
      {sub ? <div className="mt-0.5 text-[11px] text-slate-400">{sub}</div> : null}
    </div>
  );
}

export default async function ReferidosPage() {
  const [stats, partners] = await Promise.all([loadStats(), loadPartners()]);

  return (
    <div className="px-6 py-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Referidos</h1>
          <p className="mt-1 text-sm text-slate-500">
            Programa de referidos, influencers y aliados. Creá un partner con link único y configurá su comisión.
          </p>
        </div>
        <Link
          href="/dashboard/referidos/nuevo"
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#4FAEB2] px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#3F8E91]"
        >
          + Nuevo referido
        </Link>
      </header>

      <section className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Partners" value={fmt(stats.partners)} sub="referidos / influencers" />
        <StatCard label="Links activos" value={fmt(stats.linksActivos)} sub="slugs en uso" />
        <StatCard label="Clicks" value={fmt(stats.clicks)} sub="acumulado" />
        <StatCard label="Conversiones" value={fmt(stats.conversiones)} sub="atribuidas" />
        <StatCard label="Comisión pendiente" value={fmtGs(stats.comisionPendiente)} sub="por pagar" />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-700">Referidos / partners</h2>
          <span className="text-[11px] text-slate-400">
            {partners.length} {partners.length === 1 ? "registro" : "registros"}
          </span>
        </div>

        {partners.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-500">
            Todavía no hay referidos cargados. Hacé clic en{" "}
            <span className="font-semibold text-[#3F8E91]">+ Nuevo referido</span> para crear el primero.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">Nombre</th>
                  <th className="px-4 py-2.5">Tipo</th>
                  <th className="px-4 py-2.5">Slug / link</th>
                  <th className="px-4 py-2.5">Comisión</th>
                  <th className="px-4 py-2.5 text-center">Clicks</th>
                  <th className="px-4 py-2.5 text-center">Conversiones</th>
                  <th className="px-4 py-2.5 text-right">Comisión pendiente</th>
                  <th className="px-4 py-2.5">Activo</th>
                  <th className="px-4 py-2.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {partners.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2">
                      <div className="font-medium text-slate-900">{p.nombre}</div>
                      {p.email || p.telefono ? (
                        <div className="mt-0.5 text-[11px] text-slate-400">
                          {[p.email, p.telefono].filter(Boolean).join(" · ")}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-2 text-slate-700">{(p.tipo ?? "—").replace("_", " ")}</td>
                    <td className="px-4 py-2">
                      {p.primary_slug ? (
                        <div className="flex items-center gap-2">
                          <div className="min-w-0 flex-1">
                            <span className="font-mono text-[12.5px] text-[#3F8E91]">/r/{p.primary_slug}</span>
                            {p.primary_campania ? (
                              <div className="text-[11px] text-slate-400">{p.primary_campania}</div>
                            ) : null}
                          </div>
                          <CopySlugButton slug={p.primary_slug} />
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-slate-700">{fmtComision(p)}</td>
                    <td className="px-4 py-2 text-center tabular-nums">{p.clicks_count}</td>
                    <td className="px-4 py-2 text-center tabular-nums">{p.conversiones_count}</td>
                    <td className="px-4 py-2 text-right tabular-nums font-semibold">{fmtGs(p.comision_pendiente)}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide ${
                          p.activo
                            ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200"
                            : "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
                        }`}
                      >
                        {p.activo ? "Sí" : "No"}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Link
                        href={`/dashboard/referidos/partners/${p.id}`}
                        className="inline-flex items-center rounded-md bg-[#4FAEB2]/10 px-2.5 py-1 text-xs font-medium text-[#3F8E91] ring-1 ring-[#4FAEB2]/30 hover:bg-[#4FAEB2]/20"
                      >
                        Ver
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <ComoFuncionaEditor />
    </div>
  );
}
