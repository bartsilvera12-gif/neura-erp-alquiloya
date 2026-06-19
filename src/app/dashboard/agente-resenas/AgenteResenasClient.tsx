"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { fetchWithSupabaseSession } from "@/lib/api/fetch-with-supabase-session";
import ConfirmDialog from "@/components/ConfirmDialog";
import type { ErpAgenteResena } from "@/lib/alquiloya/erp-agente-resenas";

type Filter = "todas" | "pendiente" | "aprobada" | "rechazada";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-PY", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function Stars({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-amber-500" aria-label={`${n} estrellas`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= n ? "" : "text-slate-300"}>★</span>
      ))}
    </span>
  );
}

function EstadoBadge({ estado }: { estado: ErpAgenteResena["estado"] }) {
  const map: Record<ErpAgenteResena["estado"], string> = {
    pendiente: "bg-amber-100 text-amber-700 ring-amber-200",
    aprobada: "bg-emerald-100 text-emerald-700 ring-emerald-200",
    rechazada: "bg-rose-100 text-rose-700 ring-rose-200",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${map[estado]}`}>
      {estado}
    </span>
  );
}

export default function AgenteResenasClient({ initial }: { initial: ErpAgenteResena[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<ErpAgenteResena[]>(initial);
  const [filter, setFilter] = useState<Filter>("pendiente");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<
    | { kind: "aprobar"; row: ErpAgenteResena }
    | { kind: "rechazar"; row: ErpAgenteResena; motivo: string }
    | null
  >(null);
  const [err, setErr] = useState<string | null>(null);

  const counts = useMemo(() => {
    const c = { todas: rows.length, pendiente: 0, aprobada: 0, rechazada: 0 };
    for (const r of rows) c[r.estado] += 1;
    return c;
  }, [rows]);

  const visible = useMemo(
    () => (filter === "todas" ? rows : rows.filter((r) => r.estado === filter)),
    [rows, filter]
  );

  async function doAction(row: ErpAgenteResena, action: "aprobar" | "rechazar" | "destacar" | "no_destacar", motivo?: string) {
    setErr(null);
    setBusyId(row.id);
    try {
      const res = await fetchWithSupabaseSession(`/api/dashboard/alquiloya-agente-resenas/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, motivo_rechazo: motivo ?? null }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        estado?: ErpAgenteResena["estado"];
        destacada_home?: boolean;
        error?: string;
      };
      if (!res.ok || !data.success) throw new Error(data.error ?? `HTTP ${res.status}`);
      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id
            ? {
                ...r,
                estado: data.estado ?? r.estado,
                motivo_rechazo: action === "rechazar" ? motivo ?? null : r.motivo_rechazo,
                revisado_at:
                  action === "aprobar" || action === "rechazar"
                    ? new Date().toISOString()
                    : r.revisado_at,
                destacada_home:
                  typeof data.destacada_home === "boolean"
                    ? data.destacada_home
                    : r.destacada_home,
              }
            : r
        )
      );
      setConfirm(null);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(["pendiente", "aprobada", "rechazada", "todas"] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
              filter === f
                ? "bg-[#4FAEB2] text-white ring-[#4FAEB2]"
                : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            <span className={`rounded-full px-1.5 text-[10px] ${filter === f ? "bg-white/20" : "bg-slate-100 text-slate-500"}`}>
              {counts[f]}
            </span>
          </button>
        ))}
      </div>

      {err ? <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{err}</div> : null}

      {visible.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
          No hay reseñas en este estado.
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((r) => (
            <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-900">{r.autor_nombre}</span>
                    {r.rol ? <span className="text-xs text-slate-500">· {r.rol}</span> : null}
                    <Stars n={r.stars} />
                    <EstadoBadge estado={r.estado} />
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500">
                    Para agente:{" "}
                    <Link
                      href={`/dashboard/agentes-inmobiliarios/agentes/${r.agente_id}`}
                      className="font-medium text-[#3F8E91] hover:underline"
                    >
                      {r.agente_nombre ?? "—"}
                    </Link>
                    {" · "}
                    {fmtDate(r.created_at)}
                  </div>
                </div>
                {r.estado === "pendiente" ? (
                  <div className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => setConfirm({ kind: "aprobar", row: r })}
                      className="rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      Aprobar
                    </button>
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => setConfirm({ kind: "rechazar", row: r, motivo: "" })}
                      className="rounded-md bg-rose-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                    >
                      Rechazar
                    </button>
                  </div>
                ) : r.estado === "aprobada" ? (
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => doAction(r, r.destacada_home ? "no_destacar" : "destacar")}
                    className={r.destacada_home
                      ? "rounded-md bg-amber-500 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
                      : "rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-200 disabled:opacity-50"
                    }
                    title={r.destacada_home ? "Quitar del home" : "Destacar en el home publico"}
                  >
                    {r.destacada_home ? "★ Destacada en home" : "☆ Destacar en home"}
                  </button>
                ) : (
                  <span className="text-[11px] text-slate-400">{fmtDate(r.revisado_at)}</span>
                )}
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{r.body}</p>
              {r.estado === "rechazada" && r.motivo_rechazo ? (
                <p className="mt-1 text-[11px] text-rose-600">Rechazada: {r.motivo_rechazo}</p>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirm?.kind === "aprobar"}
        title="Aprobar reseña"
        description={
          confirm?.kind === "aprobar" ? (
            <>
              La reseña de <strong>{confirm.row.autor_nombre}</strong> será publicada en el perfil de{" "}
              <strong>{confirm.row.agente_nombre ?? "este agente"}</strong>.
            </>
          ) : null
        }
        confirmLabel="Aprobar"
        busy={!!busyId}
        onConfirm={() => confirm?.kind === "aprobar" && doAction(confirm.row, "aprobar")}
        onCancel={() => setConfirm(null)}
      />

      {confirm?.kind === "rechazar" ? (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => !busyId && setConfirm(null)} />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-slate-200">
            <h3 className="text-base font-semibold text-slate-900">Rechazar reseña</h3>
            <p className="mt-1 text-sm text-slate-600">
              Indicá un motivo (opcional). No se mostrará al visitante.
            </p>
            <textarea
              value={confirm.motivo}
              onChange={(e) => setConfirm((c) => (c?.kind === "rechazar" ? { ...c, motivo: e.target.value } : c))}
              placeholder="Ej. Lenguaje ofensivo, spam, no coincide con la realidad…"
              className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
              rows={3}
            />
            <div className="mt-4 flex items-center justify-end gap-2">
              <button type="button" onClick={() => setConfirm(null)} disabled={!!busyId} className="rounded-lg bg-slate-100 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50">
                Cancelar
              </button>
              <button
                type="button"
                disabled={!!busyId}
                onClick={() => doAction(confirm.row, "rechazar", confirm.motivo.trim() || undefined)}
                className="rounded-lg bg-rose-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
              >
                {busyId ? "Procesando…" : "Rechazar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
