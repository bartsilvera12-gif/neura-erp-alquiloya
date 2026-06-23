"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { fetchWithSupabaseSession } from "@/lib/api/fetch-with-supabase-session";
import type { ErpPropiedadPendienteRow } from "@/lib/alquiloya/erp-propiedades";

function fmtPrecio(precio: number | null, moneda: string | null): string {
  if (precio == null) return "—";
  const m = moneda || "USD";
  try {
    return new Intl.NumberFormat("es-PY", { style: "currency", currency: m, maximumFractionDigits: 0 }).format(precio);
  } catch { return `${m} ${precio.toLocaleString("es-PY")}`; }
}
function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("es-PY", { dateStyle: "medium", timeStyle: "short" }); } catch { return iso; }
}

export default function PropiedadesPendientesClient({
  initial,
}: {
  initial: ErpPropiedadPendienteRow[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState<ErpPropiedadPendienteRow[]>(initial);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState<
    | { kind: "aprobar"; row: ErpPropiedadPendienteRow }
    | { kind: "rechazar"; row: ErpPropiedadPendienteRow; motivo: string }
    | null
  >(null);

  async function doAction() {
    if (!pending) return;
    const row = pending.row;
    setBusyId(row.id);
    setErr(null);
    try {
      const body: Record<string, unknown> = { action: pending.kind === "aprobar" ? "aprobar" : "rechazar" };
      if (pending.kind === "rechazar") body.motivo = pending.motivo.trim() || null;
      const res = await fetchWithSupabaseSession(
        `/api/dashboard/alquiloya-propiedades/${row.id}/moderacion`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
      );
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) throw new Error(data.error ?? `HTTP ${res.status}`);
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      setPending(null);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setBusyId(null);
    }
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-emerald-100 text-emerald-700">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        No hay propiedades pendientes de aprobación. Buen trabajo.
      </div>
    );
  }

  return (
    <>
      {err ? (
        <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{err}</div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((p) => (
          <div key={p.id} className="overflow-hidden rounded-xl border border-amber-200 bg-white shadow-sm ring-1 ring-amber-100">
            <div className="relative">
              {p.cover_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.cover_url} alt={p.titulo ?? ""} className="h-44 w-full object-cover" />
              ) : (
                <div className="grid h-44 w-full place-items-center bg-slate-100 text-xs text-slate-400">Sin foto</div>
              )}
              <span className="absolute left-3 top-3 inline-flex items-center rounded-full bg-amber-500 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow">
                Pendiente
              </span>
              {p.aprobada_at ? (
                <span className="absolute right-3 top-3 inline-flex items-center rounded-full bg-blue-600 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow">
                  Modificada
                </span>
              ) : null}
            </div>
            <div className="space-y-3 p-4">
              <div>
                <h3 className="line-clamp-1 text-base font-semibold text-slate-900">{p.titulo ?? "Sin título"}</h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  {[p.tipo, p.operacion].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>

              <div className="text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Precio:</span>
                  <span className="font-semibold tabular-nums text-slate-900">{fmtPrecio(p.precio, p.moneda)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-slate-600">
                  <span className="text-slate-500">Ubicación:</span>
                  <span>{[p.barrio, p.ciudad].filter(Boolean).join(", ") || "—"}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-slate-600">
                  <span className="text-slate-500">Fotos:</span>
                  <span>{p.fotos_count}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-slate-600">
                  <span className="text-slate-500">Recibida:</span>
                  <span>{fmtDate(p.created_at)}</span>
                </div>
              </div>

              {(p.propietario_nombre || p.propietario_email || p.propietario_telefono) && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs">
                  <div className="font-semibold uppercase tracking-wider text-slate-500">Cargada por</div>
                  <div className="mt-0.5 text-slate-800">{p.propietario_nombre ?? "Propietario"}</div>
                  <div className="text-slate-500">
                    {p.propietario_email ?? "—"}
                    {p.propietario_telefono ? ` · ${p.propietario_telefono}` : ""}
                  </div>
                </div>
              )}

              {p.descripcion ? (
                <p className="line-clamp-2 text-xs text-slate-600">{p.descripcion}</p>
              ) : null}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Link
                  href={`/dashboard/propiedades/${p.id}?from=pendientes`}
                  className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-200"
                >
                  Ver detalle
                </Link>
                <Link
                  href={`/dashboard/propiedades/${p.id}/editar?from=pendientes`}
                  className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-200"
                >
                  Editar
                </Link>
                <div className="ml-auto inline-flex gap-1.5">
                  <button
                    type="button"
                    disabled={busyId === p.id}
                    onClick={() => setPending({ kind: "rechazar", row: p, motivo: "" })}
                    className="rounded-md bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                  >
                    Rechazar
                  </button>
                  <button
                    type="button"
                    disabled={busyId === p.id}
                    onClick={() => setPending({ kind: "aprobar", row: p })}
                    className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Aprobar
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {pending ? (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => !busyId && setPending(null)} />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-slate-200">
            <h3 className="text-base font-semibold text-slate-900">
              {pending.kind === "aprobar" ? "Aprobar propiedad" : "Rechazar propiedad"}
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              {pending.kind === "aprobar" ? (
                <>
                  La propiedad <strong>{pending.row.titulo ?? "sin título"}</strong> quedará{" "}
                  <strong className="text-emerald-700">activa y visible</strong> en la web pública.
                </>
              ) : (
                <>
                  La propiedad <strong>{pending.row.titulo ?? "sin título"}</strong> quedará marcada como{" "}
                  <strong className="text-rose-700">rechazada</strong>. No se borra: podés revertir cambiando su estado desde el editor.
                </>
              )}
            </p>
            {pending.kind === "rechazar" ? (
              <textarea
                value={pending.motivo}
                onChange={(e) =>
                  setPending((p) => (p?.kind === "rechazar" ? { ...p, motivo: e.target.value } : p))
                }
                placeholder="Motivo (opcional) — se guarda en la descripción"
                className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
                rows={3}
              />
            ) : null}
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPending(null)}
                disabled={!!busyId}
                className="rounded-lg bg-slate-100 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={doAction}
                disabled={!!busyId}
                className={`rounded-lg px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-60 ${
                  pending.kind === "aprobar" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
                }`}
              >
                {busyId ? "Procesando…" : pending.kind === "aprobar" ? "Aprobar" : "Rechazar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
