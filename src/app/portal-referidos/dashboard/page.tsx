"use client";

import NextLink from "next/link";
import { useEffect, useState } from "react";
import { signOut } from "@/lib/auth";

type RefLink = { id: string; slug: string; campania: string | null; cookie_dias: number; activo: boolean };
type Rule = {
  id: string; tipo: string; valor: number; moneda: string | null;
  recurrente: boolean; meses_recurrencia: number | null;
} | null;
type Stats = { clicks: number; conversiones: number; comision_pendiente: number; comision_pagada: number };
type Commission = {
  id: string; periodo: string | null; monto: number; moneda: string;
  estado: string; generada_at: string | null; pagada_at: string | null;
};
type Me = {
  success: true;
  partner: { id: string; nombre: string; email: string | null; telefono: string | null; tipo: string | null; activo: boolean };
  links: RefLink[];
  rule: Rule;
  stats: Stats;
  commissions: Commission[];
};

function fmt(n: number): string {
  try { return new Intl.NumberFormat("es-PY").format(n); } catch { return String(n); }
}
function fmtGs(n: number): string {
  try {
    return new Intl.NumberFormat("es-PY", { style: "currency", currency: "PYG", maximumFractionDigits: 0 }).format(n);
  } catch { return `Gs. ${n.toLocaleString("es-PY")}`; }
}
function fmtRule(r: Rule): string {
  if (!r) return "—";
  const rec = r.recurrente ? ` × ${r.meses_recurrencia ?? "?"}m` : "";
  if (r.tipo === "porcentaje") return `${r.valor}%${rec}`;
  return `${r.moneda ?? "PYG"} ${r.valor.toLocaleString("es-PY")}${rec}`;
}
function tierLabel(r: Rule, tipo: string | null): { name: string; color: string; bg: string; ring: string } {
  // Heuristica: si la regla es recurrente >= 6m o el partner es 'influencer', es Influencer.
  const isInf = (r?.recurrente && (r.meses_recurrencia ?? 0) >= 3) || tipo === "influencer";
  return isInf
    ? { name: "Influencer", color: "#1a1a1a", bg: "#F9B000", ring: "#F9B000" }
    : { name: "Estándar", color: "#0058A5", bg: "#EAF4FF", ring: "#0058A5" };
}

export default function PortalReferidosDashboardPage() {
  const [data, setData] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/referido/me", { cache: "no-store", credentials: "include" });
        if (r.status === 401) {
          window.location.assign("/portal-referidos/login");
          return;
        }
        if (r.status === 403) {
          await signOut().catch(() => {});
          window.location.assign("/portal-referidos/login?denied=1");
          return;
        }
        if (!r.ok) {
          setError(`HTTP ${r.status}`);
          setLoading(false);
          return;
        }
        const body = (await r.json()) as Me;
        setData(body);
        setLoading(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error");
        setLoading(false);
      }
    })();
  }, []);

  async function copy(slug: string) {
    const url = `${window.location.origin}/r/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(slug);
      setTimeout(() => setCopied((c) => (c === slug ? null : c)), 1500);
    } catch { /* ignore */ }
  }

  async function doLogout() {
    await signOut().catch(() => {});
    window.location.assign("/portal-referidos/login");
  }

  if (loading) {
    return (
      <main className="min-h-dvh w-full bg-gradient-to-b from-[#EAF4FF] via-white to-white px-4 py-10">
        <div className="mx-auto max-w-3xl text-center text-sm text-slate-500">Cargando…</div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-dvh w-full bg-gradient-to-b from-[#EAF4FF] via-white to-white px-4 py-10">
        <div className="mx-auto max-w-md text-center">
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error || "No se pudo cargar tu información."}
          </div>
          <div className="mt-4">
            <NextLink href="/portal-referidos/login" className="text-sm text-[#0058A5] hover:underline">
              Volver a ingresar
            </NextLink>
          </div>
        </div>
      </main>
    );
  }

  const primary = data.links.find((l) => l.activo) ?? data.links[0] ?? null;
  const tier = tierLabel(data.rule, data.partner.tipo);
  const conversionRate = data.stats.clicks > 0
    ? `${((data.stats.conversiones / data.stats.clicks) * 100).toFixed(1)}% conversión`
    : "—";
  const paidCount = data.commissions.filter((c) => c.estado === "pagada").length;
  const pendingCount = data.commissions.filter((c) => c.estado === "pendiente").length;

  return (
    <main className="min-h-dvh w-full bg-gradient-to-b from-[#EAF4FF] via-white to-white px-4 py-8">
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/alquiloya-legacy/assets/logo.png" alt="AlquiloYa" className="h-8 w-auto" />
            <div className="text-sm font-semibold text-slate-800">Portal de referidos</div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-600">{data.partner.nombre}</span>
            <button
              type="button"
              onClick={doLogout}
              className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Salir
            </button>
          </div>
        </header>

        {/* Title row con tier badge */}
        <section className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#0058A5]">Referidos</div>
            <h1 className="mt-1 text-[22px] font-extrabold tracking-tight text-slate-900">
              Invitá y ganá comisión
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Compartí tu link único. Cada persona que se suscriba a un plan paga te genera comisión.
            </p>
          </div>
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1"
            style={{ background: tier.bg, color: tier.color, borderColor: tier.ring }}
          >
            {tier.name === "Influencer" ? (
              <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>
            ) : null}
            Tier {tier.name} · {fmtRule(data.rule)}
          </span>
        </section>

        {/* Link único — card destacada */}
        <section className="mb-6 overflow-hidden rounded-2xl border border-[#0058A5]/20 bg-gradient-to-br from-[#EAF4FF] via-white to-white p-5 shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#0058A5]">
            Tu link único de referido
          </div>
          {primary ? (
            <>
              <div className="mt-3 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                <div className="flex-1 overflow-hidden truncate rounded-lg border border-slate-200 bg-white px-4 py-3 font-mono text-sm font-semibold text-[#0058A5]">
                  {typeof window !== "undefined" ? `${window.location.origin}/r/${primary.slug}` : `/r/${primary.slug}`}
                </div>
                <button
                  type="button"
                  onClick={() => copy(primary.slug)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#0058A5] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_-6px_rgba(0,88,165,0.4)] transition-colors hover:bg-[#004B8F]"
                >
                  {copied === primary.slug ? (
                    <>
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Copiado
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                      Copiar link
                    </>
                  )}
                </button>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-600">
                <span className="inline-flex items-center gap-1.5">
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Cookie de {primary.cookie_dias} días
                </span>
                {data.rule?.recurrente ? (
                  <span className="inline-flex items-center gap-1.5">
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Comisión recurrente ({data.rule.meses_recurrencia} meses)
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1.5">
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Pago automático mensual
                </span>
              </div>
            </>
          ) : (
            <div className="mt-3 text-sm text-slate-500">
              Todavía no tenés un link configurado. Contactá al equipo de AlquiloYa.
            </div>
          )}
        </section>

        {/* KPIs */}
        <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi
            label="Clicks en tu link"
            value={fmt(data.stats.clicks)}
            delta="Total acumulado"
            color="#0058A5"
            bg="#EAF4FF"
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            }
          />
          <Kpi
            label="Suscripciones"
            value={fmt(data.stats.conversiones)}
            delta={conversionRate}
            color="#1F8A5B"
            bg="#E7F6EE"
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            }
          />
          <Kpi
            label="Comisión cobrada"
            value={fmtGs(data.stats.comision_pagada)}
            delta={`${paidCount} pago${paidCount === 1 ? "" : "s"}`}
            color="#6E3AD1"
            bg="#F1EAFB"
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                <polyline points="17 6 23 6 23 12" />
              </svg>
            }
          />
          <Kpi
            label="Comisión pendiente"
            value={fmtGs(data.stats.comision_pendiente)}
            delta={`${pendingCount} por cobrar`}
            color="#DB9C00"
            bg="#FFF7E3"
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            }
          />
        </section>

        {/* Tabla de comisiones */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-slate-800">Tus comisiones</h2>
            <span className="text-xs text-slate-400">{data.commissions.length} registros</span>
          </div>
          {data.commissions.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-slate-500">
              Todavía no hay conversiones ni comisiones registradas. Cuando alguien se suscriba
              usando tu link, vas a verlo acá.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-5 py-2.5">Período</th>
                    <th className="px-5 py-2.5 text-right">Monto</th>
                    <th className="px-5 py-2.5">Estado</th>
                    <th className="px-5 py-2.5">Generada</th>
                    <th className="px-5 py-2.5">Pagada</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.commissions.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="px-5 py-2 font-mono text-[12px] text-slate-700">{c.periodo ?? "—"}</td>
                      <td className="px-5 py-2 text-right font-semibold tabular-nums text-[#0058A5]">{fmtGs(c.monto)}</td>
                      <td className="px-5 py-2">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${
                            c.estado === "pagada"
                              ? "bg-emerald-100 text-emerald-700 ring-emerald-200"
                              : c.estado === "pendiente"
                              ? "bg-amber-100 text-amber-700 ring-amber-200"
                              : "bg-slate-100 text-slate-600 ring-slate-200"
                          }`}
                        >
                          {c.estado}
                        </span>
                      </td>
                      <td className="px-5 py-2 text-xs text-slate-500">{c.generada_at?.slice(0, 10) ?? "—"}</td>
                      <td className="px-5 py-2 text-xs text-slate-500">{c.pagada_at?.slice(0, 10) ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Footer explainer */}
        <section className="mt-6 rounded-2xl bg-slate-100/70 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
              style={{ background: "#F9B000", color: "#1a1a1a" }}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
              </svg>
            </div>
            <div className="text-sm leading-relaxed text-slate-600">
              <div className="font-semibold text-slate-800">Cómo funciona el programa</div>
              <div className="mt-1">
                <strong className="text-slate-700">Estándar (10%):</strong> abierto a todos los usuarios.
                Comisión única sobre el primer pago del referido.
              </div>
              <div className="mt-1">
                <strong className="text-slate-700">Influencer (25% × 6 meses):</strong> por invitación.
                Comisión recurrente durante 6 meses + acceso a creatividades y dashboard avanzado.
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Kpi({
  label, value, delta, color, bg, icon,
}: {
  label: string;
  value: string;
  delta: string;
  color: string;
  bg: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
          <div className="mt-1 text-[22px] font-extrabold tracking-tight text-slate-900">{value}</div>
          <div className="mt-1 text-[11px] text-slate-500">{delta}</div>
        </div>
        <div
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
          style={{ background: bg, color }}
        >
          <span className="block h-4 w-4">{icon}</span>
        </div>
      </div>
    </div>
  );
}
