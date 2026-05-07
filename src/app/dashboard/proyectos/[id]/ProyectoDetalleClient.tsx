"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchWithSupabaseSession } from "@/lib/api/fetch-with-supabase-session";

type DetalleResp = {
  proyecto: Record<string, unknown> & {
    id: string;
    titulo?: string;
    brief_data?: Record<string, unknown>;
    tipo_id?: string;
    estado_id?: string;
    proyecto_tipo?: { codigo?: string };
  };
  historial: Record<string, unknown>[];
  sla: Record<string, unknown>;
  tareas: Record<string, unknown>[];
  comentarios: Record<string, unknown>[];
  archivos: Record<string, unknown>[];
  avance_pct: number | null;
};

const TABS = ["resumen", "brief", "tareas", "comentarios", "archivos", "historial"] as const;

export default function ProyectoDetalleClient({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const sp = useSearchParams();
  const tabRaw = sp?.get("tab") ?? "";
  const tab = (TABS as readonly string[]).includes(tabRaw) ? (tabRaw as (typeof TABS)[number]) : "resumen";

  const [id, setId] = useState<string>("");
  const [data, setData] = useState<DetalleResp | null>(null);
  const [estados, setEstados] = useState<{ id: string; nombre: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [comTexto, setComTexto] = useState("");
  const [tareaTitulo, setTareaTitulo] = useState("");
  const [briefEdit, setBriefEdit] = useState<string>("{}");

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setErr(null);
    const res = await fetchWithSupabaseSession(`/api/proyectos/${id}`, { cache: "no-store" });
    const j = (await res.json()) as { success?: boolean; data?: DetalleResp; error?: string };
    if (!res.ok || !j.success || !j.data) {
      setErr(j.error ?? "Error al cargar");
      setLoading(false);
      return;
    }
    setData(j.data);
    setBriefEdit(JSON.stringify(j.data.proyecto.brief_data ?? {}, null, 2));
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void params.then((p) => setId(p.id));
  }, [params]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let c = false;
    (async () => {
      const r = await fetchWithSupabaseSession("/api/proyectos/estados", { cache: "no-store" });
      const j = (await r.json()) as { success?: boolean; data?: { id: string; nombre: string }[] };
      if (!c && j.success && j.data) setEstados(j.data);
    })();
    return () => {
      c = true;
    };
  }, []);

  const proyecto = data?.proyecto;
  const codigoTipo = proyecto?.proyecto_tipo?.codigo ?? "";

  async function guardarBrief() {
    try {
      const parsed = JSON.parse(briefEdit) as Record<string, unknown>;
      const res = await fetchWithSupabaseSession(`/api/proyectos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief_data: parsed }),
      });
      const j = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !j.success) {
        setErr(j.error ?? "No se pudo guardar");
        return;
      }
      await load();
    } catch {
      setErr("JSON inválido en brief");
    }
  }

  async function agregarComentario(e: React.FormEvent) {
    e.preventDefault();
    if (!comTexto.trim()) return;
    const res = await fetchWithSupabaseSession(`/api/proyectos/${id}/comentarios`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comentario: comTexto.trim() }),
    });
    const j = (await res.json()) as { success?: boolean; error?: string };
    if (!res.ok || !j.success) {
      setErr(j.error ?? "Error");
      return;
    }
    setComTexto("");
    await load();
  }

  async function agregarTarea(e: React.FormEvent) {
    e.preventDefault();
    if (!tareaTitulo.trim()) return;
    const res = await fetchWithSupabaseSession(`/api/proyectos/${id}/tareas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titulo: tareaTitulo.trim() }),
    });
    const j = (await res.json()) as { success?: boolean; error?: string };
    if (!res.ok || !j.success) {
      setErr(j.error ?? "Error");
      return;
    }
    setTareaTitulo("");
    await load();
  }

  async function patchTarea(tareaId: string, patch: Record<string, unknown>) {
    const res = await fetchWithSupabaseSession(`/api/proyectos/${id}/tareas/${tareaId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const j = (await res.json()) as { success?: boolean; error?: string };
    if (!res.ok || !j.success) setErr(j.error ?? "Error");
    else await load();
  }

  async function cambiarEstado(estadoId: string) {
    const res = await fetchWithSupabaseSession(`/api/proyectos/${id}/cambiar-estado`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado_id: estadoId }),
    });
    const j = (await res.json()) as { success?: boolean; error?: string };
    if (!res.ok || !j.success) setErr(j.error ?? "Error");
    else await load();
  }

  const slaFmt = useMemo(() => {
    const s = data?.sla as { segundos_interno?: number; segundos_cliente?: number; segundos_pausado?: number } | undefined;
    if (!s) return null;
    const fmt = (sec?: number) =>
      sec == null ? "—" : `${Math.round((sec / 3600) * 10) / 10} h`;
    return {
      interno: fmt(s.segundos_interno),
      cliente: fmt(s.segundos_cliente),
      pausado: fmt(s.segundos_pausado),
    };
  }, [data?.sla]);

  if (!id) return null;
  if (loading && !data) return <div className="p-6 text-sm text-slate-500">Cargando…</div>;
  if (err && !data) return <div className="p-6 text-sm text-red-600">{err}</div>;
  if (!data || !proyecto) return null;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/dashboard/proyectos" className="text-sm text-indigo-600 hover:underline">
          ← Kanban
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{String(proyecto.titulo ?? "")}</h1>
          <p className="text-sm text-slate-500">
            {(proyecto as { proyecto_tipo?: { nombre?: string } }).proyecto_tipo?.nombre ?? "—"} · Avance{" "}
            {data.avance_pct ?? "—"}%
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            className="rounded-md border border-slate-200 px-3 py-2 text-sm"
            value={String(proyecto.estado_id ?? "")}
            onChange={(e) => void cambiarEstado(e.target.value)}
          >
            {estados.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            onClick={() => router.push("/dashboard/proyectos")}
          >
            Cerrar
          </button>
        </div>
      </div>

      {err ? <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">{err}</div> : null}

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {TABS.map((t) => (
          <Link
            key={t}
            href={`/dashboard/proyectos/${id}?tab=${t}`}
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              tab === t ? "bg-indigo-100 text-indigo-900" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {t}
          </Link>
        ))}
      </div>

      {tab === "resumen" ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-800">Datos</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Prioridad</dt>
                <dd>{String(proyecto.prioridad ?? "")}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Bloqueado</dt>
                <dd>{proyecto.bloqueado ? "Sí" : "No"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Fecha ingreso</dt>
                <dd>{fmtDate(String(proyecto.fecha_ingreso ?? ""))}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Fecha prometida</dt>
                <dd>{fmtDate(String(proyecto.fecha_prometida ?? ""))}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Comercial / Técnico</dt>
                <dd className="text-right">
                  {(proyecto as { responsable_comercial?: { nombre?: string } }).responsable_comercial?.nombre ?? "—"}{" "}
                  / {(proyecto as { responsable_tecnico?: { nombre?: string } }).responsable_tecnico?.nombre ?? "—"}
                </dd>
              </div>
            </dl>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-800">SLA (histórico)</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Tiempo interno</dt>
                <dd>{slaFmt?.interno}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Espera cliente</dt>
                <dd>{slaFmt?.cliente}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Pausado</dt>
                <dd>{slaFmt?.pausado}</dd>
              </div>
            </dl>
          </div>
        </div>
      ) : null}

      {tab === "brief" ? (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-800">Brief (JSON)</h2>
            <button
              type="button"
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
              onClick={() => void guardarBrief()}
            >
              Guardar
            </button>
          </div>
          {codigoTipo === "web" ? (
            <p className="text-xs text-slate-500">
              Tipo Proyecto Web: podés editar el brief como JSON (campos del formulario de alta se guardan aquí).
            </p>
          ) : null}
          <textarea
            className="min-h-[280px] w-full rounded-md border border-slate-200 px-3 py-2 font-mono text-xs"
            value={briefEdit}
            onChange={(e) => setBriefEdit(e.target.value)}
          />
        </div>
      ) : null}

      {tab === "tareas" ? (
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <form onSubmit={agregarTarea} className="flex flex-wrap gap-2">
            <input
              className="min-w-[200px] flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm"
              placeholder="Nueva tarea"
              value={tareaTitulo}
              onChange={(e) => setTareaTitulo(e.target.value)}
            />
            <button
              type="submit"
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Agregar
            </button>
          </form>
          <ul className="divide-y divide-slate-100">
            {(data.tareas ?? []).map((t) => {
              const tid = String(t.id ?? "");
              const estado = String(t.estado ?? "");
              return (
                <li key={tid} className="flex flex-wrap items-center gap-2 py-3 text-sm">
                  <span className="flex-1 font-medium text-slate-900">{String(t.titulo ?? "")}</span>
                  <select
                    className="rounded-md border border-slate-200 px-2 py-1 text-xs"
                    value={estado}
                    onChange={(e) => void patchTarea(tid, { estado: e.target.value })}
                  >
                    <option value="pendiente">pendiente</option>
                    <option value="en_proceso">en_proceso</option>
                    <option value="completada">completada</option>
                    <option value="bloqueada">bloqueada</option>
                  </select>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {tab === "comentarios" ? (
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <form onSubmit={agregarComentario} className="space-y-2">
            <textarea
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              rows={3}
              placeholder="Comentario interno"
              value={comTexto}
              onChange={(e) => setComTexto(e.target.value)}
            />
            <button
              type="submit"
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Publicar
            </button>
          </form>
          <ul className="space-y-3">
            {(data.comentarios ?? []).map((c) => (
              <li key={String(c.id)} className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm">
                <div className="text-xs text-slate-500">
                  {String((c as { usuario_nombre?: string }).usuario_nombre ?? "")} ·{" "}
                  {fmtDateTime(String(c.created_at ?? ""))}
                </div>
                <div className="mt-1 text-slate-800">{String(c.comentario ?? "")}</div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {tab === "archivos" ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
          <p className="font-medium text-slate-800">Archivos del proyecto</p>
          <p className="mt-2">
            Metadata lista en <code className="rounded bg-white px-1">proyecto_archivos</code>. Subida a Storage en una
            siguiente iteración.
          </p>
          <ul className="mt-4 space-y-2">
            {(data.archivos ?? []).length === 0 ? (
              <li>Sin archivos registrados.</li>
            ) : (
              (data.archivos ?? []).map((a) => (
                <li key={String(a.id)} className="text-slate-700">
                  {String(a.nombre ?? "")}{" "}
                  <span className="text-xs text-slate-400">{fmtDateTime(String(a.created_at ?? ""))}</span>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}

      {tab === "historial" ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-600">
              <tr>
                <th className="px-3 py-2">Desde</th>
                <th className="px-3 py-2">Hacia</th>
                <th className="px-3 py-2">SLA tipo</th>
                <th className="px-3 py-2">Entrada</th>
                <th className="px-3 py-2">Salida</th>
                <th className="px-3 py-2">Duración (s)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(data.historial ?? []).map((h) => (
                <tr key={String(h.id)}>
                  <td className="px-3 py-2 text-xs text-slate-600">{String(h.estado_anterior_id ?? "—")}</td>
                  <td className="px-3 py-2 text-xs">{String(h.estado_nuevo_id ?? "")}</td>
                  <td className="px-3 py-2 text-xs">{String(h.tipo_sla_snapshot ?? "")}</td>
                  <td className="px-3 py-2 text-xs">{fmtDateTime(String(h.entered_at ?? ""))}</td>
                  <td className="px-3 py-2 text-xs">{h.exited_at ? fmtDateTime(String(h.exited_at)) : "abierto"}</td>
                  <td className="px-3 py-2 text-xs">{String(h.duration_seconds ?? "—")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
            Los UUID en “Desde/Hacia” coinciden con <code>proyecto_estados.id</code> (mejoras de etiquetas en siguiente
            paso).
          </p>
        </div>
      ) : null}
    </div>
  );
}

function fmtDate(s: string): string {
  if (!s) return "—";
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString() : "—";
}

function fmtDateTime(s: string): string {
  if (!s) return "—";
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d.toLocaleString() : "—";
}
