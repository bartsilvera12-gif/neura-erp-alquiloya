"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchWithSupabaseSession } from "@/lib/api/fetch-with-supabase-session";
import ConfirmDialog from "@/components/ConfirmDialog";
import type { SolicitudAccesoRow } from "@/lib/alquiloya/erp-solicitudes-acceso";

type Filter = "todas" | "pendiente" | "aprobada" | "rechazada";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-PY", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function EstadoBadge({ estado }: { estado: SolicitudAccesoRow["estado"] }) {
  const map: Record<SolicitudAccesoRow["estado"], string> = {
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

function TipoBadge({ tipo, sub }: { tipo: SolicitudAccesoRow["tipo"]; sub: string | null }) {
  const label = tipo === "agente" ? `Agente · ${sub ?? "—"}` : "Propietario";
  const cls =
    tipo === "agente"
      ? "bg-[#4FAEB2]/10 text-[#3F8E91] ring-[#4FAEB2]/30"
      : "bg-indigo-100 text-indigo-700 ring-indigo-200";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${cls}`}>
      {label}
    </span>
  );
}

export default function SolicitudesAccesoClient({
  initial,
}: {
  initial: SolicitudAccesoRow[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState<SolicitudAccesoRow[]>(initial);
  const [filter, setFilter] = useState<Filter>("pendiente");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<
    | { kind: "aprobar"; row: SolicitudAccesoRow }
    | { kind: "rechazar"; row: SolicitudAccesoRow; motivo: string }
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

  async function doAction(row: SolicitudAccesoRow, action: "aprobar" | "rechazar", motivo?: string) {
    setErr(null);
    setBusyId(row.id);
    try {
      const res = await fetchWithSupabaseSession(
        `/api/dashboard/alquiloya-solicitudes-acceso/${row.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, motivo_rechazo: motivo ?? null }),
        }
      );
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        estado?: SolicitudAccesoRow["estado"];
        resultado_id?: string | null;
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
                resultado_id: data.resultado_id ?? r.resultado_id,
                revisado_at: new Date().toISOString(),
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
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 transition-colors ${
              filter === f
                ? "bg-[#4FAEB2] text-white ring-[#4FAEB2]"
                : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            <span
              className={`rounded-full px-1.5 text-[10px] ${
                filter === f ? "bg-white/20" : "bg-slate-100 text-slate-500"
              }`}
            >
              {counts[f]}
            </span>
          </button>
        ))}
      </div>

      {err ? (
        <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {err}
        </div>
      ) : null}

      {visible.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
          No hay solicitudes en este estado.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3 py-2.5">Solicitante</th>
                <th className="px-3 py-2.5">Tipo</th>
                <th className="hidden px-3 py-2.5 md:table-cell">Contacto</th>
                <th className="hidden px-3 py-2.5 lg:table-cell">Ciudad</th>
                <th className="hidden px-3 py-2.5 lg:table-cell">Empresa</th>
                <th className="hidden px-3 py-2.5 xl:table-cell">Recibida</th>
                <th className="px-3 py-2.5">Estado</th>
                <th className="px-3 py-2.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-900">{r.nombre}</div>
                    {r.mensaje ? (
                      <div className="mt-0.5 line-clamp-2 max-w-xs text-[11px] text-slate-500">
                        {r.mensaje}
                      </div>
                    ) : null}
                    {r.motivo_rechazo && r.estado === "rechazada" ? (
                      <div className="mt-1 text-[11px] text-rose-600">
                        Rechazada: {r.motivo_rechazo}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2"><TipoBadge tipo={r.tipo} sub={r.sub_tipo} /></td>
                  <td className="hidden px-3 py-2 text-slate-700 md:table-cell">
                    <div>{r.email ?? "—"}</div>
                    <div className="text-[11px] text-slate-500">{r.telefono ?? ""}</div>
                  </td>
                  <td className="hidden px-3 py-2 text-slate-700 lg:table-cell">{r.ciudad ?? "—"}</td>
                  <td className="hidden px-3 py-2 text-slate-700 lg:table-cell">{r.empresa ?? "—"}</td>
                  <td className="hidden px-3 py-2 text-slate-500 xl:table-cell">{fmtDate(r.created_at)}</td>
                  <td className="px-3 py-2"><EstadoBadge estado={r.estado} /></td>
                  <td className="px-3 py-2 text-right">
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
                    ) : (
                      <span className="text-[11px] text-slate-400">{fmtDate(r.revisado_at)}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={confirm?.kind === "aprobar"}
        title="Aprobar solicitud"
        description={
          confirm?.kind === "aprobar" ? (
            <>
              Se creará una cuenta en{" "}
              <strong>{confirm.row.tipo === "agente" ? "Agentes" : "Propietarios"}</strong> para{" "}
              <strong>{confirm.row.nombre}</strong>
              {confirm.row.tipo === "agente" && confirm.row.sub_tipo
                ? ` (${confirm.row.sub_tipo})`
                : ""}
              .
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
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => !busyId && setConfirm(null)}
          />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-slate-200">
            <h3 className="text-base font-semibold text-slate-900">Rechazar solicitud</h3>
            <p className="mt-1 text-sm text-slate-600">
              Indicá un motivo (opcional) para <strong>{confirm.row.nombre}</strong>.
            </p>
            <textarea
              value={confirm.motivo}
              onChange={(e) =>
                setConfirm((c) => (c?.kind === "rechazar" ? { ...c, motivo: e.target.value } : c))
              }
              placeholder="Ej. Datos insuficientes, ya existe otra cuenta…"
              className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
              rows={3}
            />
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirm(null)}
                disabled={!!busyId}
                className="rounded-lg bg-slate-100 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50"
              >
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
