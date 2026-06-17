"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchWithSupabaseSession } from "@/lib/api/fetch-with-supabase-session";
import type { SolicitudServicioRow } from "@/lib/alquiloya/erp-solicitudes-servicio";

type Filter = "todas" | "pendiente" | "aprobada" | "rechazada";
type PropOption = { id: string; nombre: string; email: string | null; telefono: string | null };

const KIND_LABEL: Record<SolicitudServicioRow["kind"], string> = {
  cambio_plan: "Cambio de plan",
  impulsos: "Compra de impulsos",
  verificacion: "Verificación de inmueble",
};

const KIND_CLS: Record<SolicitudServicioRow["kind"], string> = {
  cambio_plan: "bg-indigo-100 text-indigo-700 ring-indigo-200",
  impulsos: "bg-amber-100 text-amber-800 ring-amber-300",
  verificacion: "bg-sky-100 text-sky-700 ring-sky-200",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-PY", { dateStyle: "medium", timeStyle: "short" });
  } catch { return iso; }
}

function fmtGs(n: number | null): string {
  if (n == null) return "—";
  return "Gs. " + n.toLocaleString("es-PY");
}

// Normaliza un telefono a formato internacional Paraguay para wa.me.
function waPhone(raw: string | null): string | null {
  if (!raw) return null;
  let p = String(raw).replace(/\D/g, "");
  if (!p) return null;
  if (!p.startsWith("595")) {
    if (p.startsWith("0")) p = "595" + p.slice(1);
    else if (p.length <= 10) p = "595" + p;
  }
  return p;
}

// Mensaje pre-armado para contactar al solicitante por su compra.
function mensajeContacto(r: SolicitudServicioRow): string {
  const detalle =
    r.kind === "impulsos"
      ? `tu compra de ${r.pack_qty ?? ""} impulso${r.pack_qty === 1 ? "" : "s"}${r.monto ? ` (${fmtGs(r.monto)})` : ""}`
      : r.kind === "cambio_plan"
        ? `tu cambio al plan ${r.plan_nombre ?? r.plan_tier ?? ""}`
        : "tu solicitud de verificación";
  return `Hola ${r.nombre}, te escribo de AlquiloYa por ${detalle}. Coordinemos el pago para activarlo. ¡Gracias!`;
}

/** Botones WhatsApp / Email con mensaje pre-armado para coordinar el pago. */
function ContactoSolicitante({ r, compact = false }: { r: SolicitudServicioRow; compact?: boolean }) {
  const phone = waPhone(r.telefono);
  const msg = encodeURIComponent(mensajeContacto(r));
  const waHref = phone ? `https://wa.me/${phone}?text=${msg}` : null;
  const mailHref = r.email
    ? `mailto:${r.email}?subject=${encodeURIComponent("AlquiloYa · " + KIND_LABEL[r.kind])}&body=${encodeURIComponent(mensajeContacto(r))}`
    : null;
  if (!waHref && !mailHref) {
    return <span className="text-[11px] text-slate-400">Sin contacto</span>;
  }
  const sz = compact ? "px-2 py-1 text-[11px]" : "px-3 py-1.5 text-xs";
  return (
    <div className="inline-flex items-center gap-1.5">
      {waHref ? (
        <a href={waHref} target="_blank" rel="noopener noreferrer"
          className={`inline-flex items-center gap-1 rounded-md bg-[#25D366] font-semibold text-white hover:bg-[#1ebd5b] ${sz}`}
          title={`WhatsApp a ${r.telefono}`}>
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.371-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347M12.05 21.785h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884a9.82 9.82 0 0 1 6.988 2.898 9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884"/></svg>
          {compact ? "WA" : "WhatsApp"}
        </a>
      ) : null}
      {mailHref ? (
        <a href={mailHref}
          className={`inline-flex items-center gap-1 rounded-md bg-slate-700 font-semibold text-white hover:bg-slate-800 ${sz}`}
          title={`Email a ${r.email}`}>
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>
          Email
        </a>
      ) : null}
    </div>
  );
}

function EstadoBadge({ estado }: { estado: SolicitudServicioRow["estado"] }) {
  const map: Record<SolicitudServicioRow["estado"], string> = {
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

export default function SolicitudesServicioClient({
  initial, propietarios, agentes,
}: {
  initial: SolicitudServicioRow[];
  propietarios: PropOption[];
  agentes: PropOption[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState<SolicitudServicioRow[]>(initial);
  const [filter, setFilter] = useState<Filter>("pendiente");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState<
    | { kind: "aprobar"; row: SolicitudServicioRow; propietarioId: string; agenteId: string; propiedadId: string }
    | { kind: "rechazar"; row: SolicitudServicioRow; motivo: string }
    | null
  >(null);

  // El plan_tier define a quién se aplica el plan. Convención del seed actual
  // de planes_publicacion: tiers con sufijo "-owner" son para propietarios,
  // el resto (incluye "-agent") son para agentes. Si el tier no trae sufijo,
  // por defecto cae a agentes (la mayoría de planes pagos son de agente).
  function planTarget(planTier: string | null | undefined): "propietario" | "agente" {
    const t = (planTier ?? "").toLowerCase();
    if (t.endsWith("-owner") || t.endsWith("_owner") || t.includes("propietario")) return "propietario";
    return "agente";
  }

  const counts = useMemo(() => {
    const c = { todas: rows.length, pendiente: 0, aprobada: 0, rechazada: 0 };
    for (const r of rows) c[r.estado] += 1;
    return c;
  }, [rows]);
  const visible = useMemo(() => filter === "todas" ? rows : rows.filter((r) => r.estado === filter), [rows, filter]);

  // Auto-match por email/teléfono al abrir el modal de aprobar.
  function suggestFromList(row: SolicitudServicioRow, list: PropOption[]): string {
    const byEmail = row.email ? list.find((p) => p.email?.toLowerCase() === row.email!.toLowerCase()) : null;
    if (byEmail) return byEmail.id;
    const byTel = row.telefono ? list.find((p) => p.telefono?.replace(/\s/g, "") === row.telefono!.replace(/\s/g, "")) : null;
    if (byTel) return byTel.id;
    return "";
  }
  function suggestPropietario(row: SolicitudServicioRow): string {
    return suggestFromList(row, propietarios) || (row.propietario_id ?? "");
  }
  function suggestAgente(row: SolicitudServicioRow): string {
    return suggestFromList(row, agentes) || (row.agente_id ?? "");
  }

  async function aprobar() {
    if (!pending || pending.kind !== "aprobar") return;
    const row = pending.row;
    setBusyId(row.id); setErr(null);
    try {
      const body: Record<string, unknown> = { action: "aprobar" };
      if (row.kind === "cambio_plan") {
        // Para cambio de plan el target depende del tier: agente o propietario.
        const target = planTarget(row.plan_tier);
        if (target === "agente") {
          if (!pending.agenteId) throw new Error("Seleccioná un agente");
          body.agente_id = pending.agenteId;
        } else {
          if (!pending.propietarioId) throw new Error("Seleccioná un propietario");
          body.propietario_id = pending.propietarioId;
        }
      } else if (row.kind === "impulsos") {
        // Los impulsos se acreditan al propietario O al agente segun quien hizo
        // la compra. El admin elige uno (preferimos propietario si esta seteado
        // — coincide con el comportamiento anterior, pero ahora soporta agente).
        if (pending.propietarioId) {
          body.propietario_id = pending.propietarioId;
        } else if (pending.agenteId) {
          body.agente_id = pending.agenteId;
        } else {
          throw new Error("Seleccioná un propietario o un agente para acreditar los impulsos");
        }
      } else if (row.kind === "verificacion") {
        if (!pending.propiedadId) throw new Error("Pegá el UUID de la propiedad a verificar");
        body.propiedad_id = pending.propiedadId;
      }
      const res = await fetchWithSupabaseSession(
        `/api/dashboard/alquiloya-solicitudes-servicio/${row.id}`,
        { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
      );
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) throw new Error(data.error ?? `HTTP ${res.status}`);
      setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, estado: "aprobada", revisado_at: new Date().toISOString() } : r));
      setPending(null);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally { setBusyId(null); }
  }

  async function rechazar() {
    if (!pending || pending.kind !== "rechazar") return;
    const row = pending.row;
    setBusyId(row.id); setErr(null);
    try {
      const res = await fetchWithSupabaseSession(
        `/api/dashboard/alquiloya-solicitudes-servicio/${row.id}`,
        { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "rechazar", motivo_rechazo: pending.motivo.trim() || null }) }
      );
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) throw new Error(data.error ?? `HTTP ${res.status}`);
      setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, estado: "rechazada", motivo_rechazo: pending.motivo.trim() || null, revisado_at: new Date().toISOString() } : r));
      setPending(null);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally { setBusyId(null); }
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(["pendiente","aprobada","rechazada","todas"] as Filter[]).map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 transition-colors ${
              filter === f ? "bg-[#4FAEB2] text-white ring-[#4FAEB2]" : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"
            }`}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
            <span className={`rounded-full px-1.5 text-[10px] ${filter === f ? "bg-white/20" : "bg-slate-100 text-slate-500"}`}>{counts[f]}</span>
          </button>
        ))}
      </div>

      {err ? <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{err}</div> : null}

      {visible.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">No hay solicitudes en este estado.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3 py-2.5">Tipo</th>
                <th className="px-3 py-2.5">Solicitante</th>
                <th className="hidden px-3 py-2.5 md:table-cell">Contacto</th>
                <th className="px-3 py-2.5">Detalle</th>
                <th className="hidden px-3 py-2.5 xl:table-cell">Recibida</th>
                <th className="px-3 py-2.5">Estado</th>
                <th className="px-3 py-2.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${KIND_CLS[r.kind]}`}>{KIND_LABEL[r.kind]}</span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-900">{r.nombre}</div>
                    {r.motivo_rechazo && r.estado === "rechazada" ? (
                      <div className="mt-1 text-[11px] text-rose-600">Rechazada: {r.motivo_rechazo}</div>
                    ) : null}
                  </td>
                  <td className="hidden px-3 py-2 text-slate-700 md:table-cell">
                    <div>{r.email ?? "—"}</div>
                    <div className="text-[11px] text-slate-500">{r.telefono ?? ""}</div>
                    {(r.email || r.telefono) ? (
                      <div className="mt-1.5"><ContactoSolicitante r={r} compact /></div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-slate-700">
                    {r.kind === "cambio_plan" ? (
                      <>
                        <div className="font-medium text-slate-900">{r.plan_nombre ?? r.plan_tier}</div>
                        <div className="text-[11px] text-slate-400">{r.plan_tier}</div>
                      </>
                    ) : r.kind === "impulsos" ? (
                      <>
                        <div className="font-medium text-slate-900">{r.pack_qty ?? "?"} impulsos</div>
                        <div className="text-[11px] text-slate-500">{r.pack_id} · {fmtGs(r.monto)}</div>
                      </>
                    ) : (
                      <>
                        <div className="font-medium text-slate-900">{r.propiedad_titulo ?? "—"}</div>
                        <div className="text-[11px] text-slate-400 break-all">{r.propiedad_id ?? "sin id"}</div>
                      </>
                    )}
                    {r.mensaje ? <div className="mt-1 line-clamp-2 max-w-xs text-[11px] text-slate-500">{r.mensaje}</div> : null}
                  </td>
                  <td className="hidden px-3 py-2 text-slate-500 xl:table-cell">{fmtDate(r.created_at)}</td>
                  <td className="px-3 py-2"><EstadoBadge estado={r.estado} /></td>
                  <td className="px-3 py-2 text-right">
                    {r.estado === "pendiente" ? (
                      <div className="inline-flex items-center gap-1">
                        <button type="button" disabled={busyId === r.id}
                          onClick={() => setPending({ kind: "aprobar", row: r, propietarioId: suggestPropietario(r), agenteId: suggestAgente(r), propiedadId: r.propiedad_id ?? "" })}
                          className="rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">Aprobar</button>
                        <button type="button" disabled={busyId === r.id}
                          onClick={() => setPending({ kind: "rechazar", row: r, motivo: "" })}
                          className="rounded-md bg-rose-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-rose-700 disabled:opacity-50">Rechazar</button>
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

      {pending?.kind === "aprobar" ? (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => !busyId && setPending(null)} />
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-slate-200">
            <h3 className="text-base font-semibold text-slate-900">Aprobar {KIND_LABEL[pending.row.kind].toLowerCase()}</h3>
            <p className="mt-1 text-sm text-slate-600">Solicitante: <strong>{pending.row.nombre}</strong></p>

            {/* Contacto para coordinar el pago ANTES de aplicar. */}
            {(pending.row.email || pending.row.telefono) ? (
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Coordinar el pago</div>
                <div className="mt-1 text-xs text-slate-600">
                  {pending.row.telefono ? <span className="mr-3">📱 {pending.row.telefono}</span> : null}
                  {pending.row.email ? <span>✉️ {pending.row.email}</span> : null}
                </div>
                <div className="mt-2"><ContactoSolicitante r={pending.row} /></div>
              </div>
            ) : null}

            {pending.row.kind === "cambio_plan" ? (() => {
              const isAgenteTarget = planTarget(pending.row.plan_tier) === "agente";
              const list = isAgenteTarget ? agentes : propietarios;
              const selectedId = isAgenteTarget ? pending.agenteId : pending.propietarioId;
              const matched = selectedId ? list.find((p) => p.id === selectedId) ?? null : null;
              const targetLabel = isAgenteTarget ? "agente" : "propietario";
              const updateSelected = (v: string) =>
                setPending((p) =>
                  p?.kind === "aprobar"
                    ? isAgenteTarget
                      ? { ...p, agenteId: v }
                      : { ...p, propietarioId: v }
                    : p
                );
              return (
                <div className="mt-4">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Se aplicará a ({targetLabel})
                  </label>
                  {matched ? (
                    <div className="mt-1 flex items-start justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-900">{matched.nombre}</div>
                        <div className="truncate text-[11px] text-slate-600">
                          {matched.email ?? matched.telefono ?? ""}
                        </div>
                      </div>
                      <span className="shrink-0 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
                        Solicitante
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="mt-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                        No pudimos identificar al {targetLabel} por email/teléfono. Elegilo manualmente o creálo primero.
                      </div>
                      <select value={selectedId}
                        onChange={(e) => updateSelected(e.target.value)}
                        className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#4FAEB2] focus:outline-none focus:ring-2 focus:ring-[#4FAEB2]/30">
                        <option value="">— elegí uno —</option>
                        {list.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nombre} {p.email ? `· ${p.email}` : p.telefono ? `· ${p.telefono}` : ""}
                          </option>
                        ))}
                      </select>
                    </>
                  )}
                </div>
              );
            })() : null}

            {pending.row.kind === "impulsos" ? (() => {
              // Los impulsos pueden acreditarse al propietario O al agente
              // segun quien hizo la compra. Mostramos los dos selectores:
              // dejá uno vacio y el otro elegido. La aprobacion usa el que
              // este seteado (prefiere propietario si hay ambos).
              const propSel = pending.propietarioId;
              const ageSel = pending.agenteId;
              const propMatched = propSel ? propietarios.find((p) => p.id === propSel) ?? null : null;
              const ageMatched = ageSel ? agentes.find((p) => p.id === ageSel) ?? null : null;
              const matchSide: "propietario" | "agente" | null = propMatched ? "propietario" : ageMatched ? "agente" : null;
              return (
                <div className="mt-4 space-y-3">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
                    Elegí <strong>propietario</strong> o <strong>agente</strong> según quién compró los impulsos. El saldo se acredita al que selecciones.
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Propietario
                    </label>
                    <select value={propSel}
                      onChange={(e) => setPending((p) => p?.kind === "aprobar" ? { ...p, propietarioId: e.target.value, agenteId: e.target.value ? "" : p.agenteId } : p)}
                      className={"mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4FAEB2]/30 " + (matchSide === "propietario" ? "border-emerald-300 bg-emerald-50" : "border-slate-300")}>
                      <option value="">— sin asignar —</option>
                      {propietarios.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre} {p.email ? `· ${p.email}` : p.telefono ? `· ${p.telefono}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Agente
                    </label>
                    <select value={ageSel}
                      onChange={(e) => setPending((p) => p?.kind === "aprobar" ? { ...p, agenteId: e.target.value, propietarioId: e.target.value ? "" : p.propietarioId } : p)}
                      className={"mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4FAEB2]/30 " + (matchSide === "agente" ? "border-emerald-300 bg-emerald-50" : "border-slate-300")}>
                      <option value="">— sin asignar —</option>
                      {agentes.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre} {p.email ? `· ${p.email}` : p.telefono ? `· ${p.telefono}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  {!propSel && !ageSel ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                      Tenés que elegir un propietario o un agente para acreditar los impulsos.
                    </div>
                  ) : null}
                </div>
              );
            })() : null}

            {pending.row.kind === "verificacion" ? (
              <div className="mt-4">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">UUID de la propiedad a verificar</label>
                <input value={pending.propiedadId}
                  onChange={(e) => setPending((p) => p?.kind === "aprobar" ? { ...p, propiedadId: e.target.value } : p)}
                  placeholder="00000000-0000-0000-0000-000000000000"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs focus:border-[#4FAEB2] focus:outline-none focus:ring-2 focus:ring-[#4FAEB2]/30"/>
                <p className="mt-1 text-[11px] text-slate-500">
                  La propiedad quedará marcada como <strong>verificada</strong> en la web pública.
                </p>
              </div>
            ) : null}

            <div className="mt-5 flex items-center justify-end gap-2">
              <button type="button" onClick={() => setPending(null)} disabled={!!busyId}
                className="rounded-lg bg-slate-100 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50">Cancelar</button>
              <button type="button" onClick={aprobar} disabled={!!busyId}
                className="rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
                {busyId ? "Aplicando…" : "Aprobar y aplicar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pending?.kind === "rechazar" ? (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => !busyId && setPending(null)} />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-slate-200">
            <h3 className="text-base font-semibold text-slate-900">Rechazar solicitud</h3>
            <p className="mt-1 text-sm text-slate-600">Motivo (opcional) para <strong>{pending.row.nombre}</strong>.</p>
            <textarea value={pending.motivo}
              onChange={(e) => setPending((p) => p?.kind === "rechazar" ? { ...p, motivo: e.target.value } : p)}
              className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/30" rows={3}/>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button type="button" onClick={() => setPending(null)} disabled={!!busyId}
                className="rounded-lg bg-slate-100 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50">Cancelar</button>
              <button type="button" disabled={!!busyId} onClick={rechazar}
                className="rounded-lg bg-rose-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60">
                {busyId ? "Procesando…" : "Rechazar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
