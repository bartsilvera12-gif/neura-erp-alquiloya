"use client";

import { useEffect, useState } from "react";
import { fetchWithSupabaseSession } from "@/lib/api/fetch-with-supabase-session";
import { confirmDialog } from "@/lib/ui/dialogs";

type Zona ={ id: string; ciudad: string; barrio: string | null; orden: number };
type Tip = { id: string; zona: string | null; titulo: string; body: string; orden: number; activo: boolean };

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-[#4FAEB2] focus:outline-none focus:ring-2 focus:ring-[#4FAEB2]/30";
const btnPrimary =
  "inline-flex items-center rounded-lg bg-[#4FAEB2] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#3F8E91] disabled:opacity-50";
const btnDanger =
  "inline-flex items-center rounded-md px-2 py-1 text-[11px] font-medium text-rose-600 hover:bg-rose-50";

export default function AgentePerfilPanel({ agenteId }: { agenteId: string }) {
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [tips, setTips] = useState<Tip[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // forms
  const [newZona, setNewZona] = useState<{ ciudad: string; barrio: string }>({ ciudad: "", barrio: "" });
  const [newTip, setNewTip] = useState<{ zona: string; titulo: string; body: string }>({
    zona: "", titulo: "", body: "",
  });
  const [savingZ, setSavingZ] = useState(false);
  const [savingT, setSavingT] = useState(false);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const [rz, rt] = await Promise.all([
        fetchWithSupabaseSession(`/api/dashboard/alquiloya-agentes/${agenteId}/zonas`),
        fetchWithSupabaseSession(`/api/dashboard/alquiloya-agentes/${agenteId}/tips`),
      ]);
      const dz = (await rz.json().catch(() => ({}))) as { data?: { zonas?: Zona[] } };
      const dt = (await rt.json().catch(() => ({}))) as { data?: { tips?: Tip[] } };
      setZonas(dz.data?.zonas ?? []);
      setTips(dt.data?.tips ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agenteId]);

  async function addZona() {
    if (!newZona.ciudad.trim()) return;
    setSavingZ(true);
    try {
      const res = await fetchWithSupabaseSession(`/api/dashboard/alquiloya-agentes/${agenteId}/zonas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ciudad: newZona.ciudad.trim(), barrio: newZona.barrio.trim() || null, orden: zonas.length }),
      });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) throw new Error(data.error ?? `HTTP ${res.status}`);
      setNewZona({ ciudad: "", barrio: "" });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setSavingZ(false);
    }
  }
  async function deleteZona(id: string) {
    const ok = await confirmDialog({ title: "¿Eliminar esta zona?", confirmText: "Eliminar", tone: "danger" });
    if (!ok) return;
    const res = await fetchWithSupabaseSession(`/api/dashboard/alquiloya-agentes/${agenteId}/zonas/${id}`, { method: "DELETE" });
    if (res.ok) load();
  }

  async function addTip() {
    if (!newTip.titulo.trim() || !newTip.body.trim()) return;
    setSavingT(true);
    try {
      const res = await fetchWithSupabaseSession(`/api/dashboard/alquiloya-agentes/${agenteId}/tips`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zona: newTip.zona.trim() || null,
          titulo: newTip.titulo.trim(),
          body: newTip.body.trim(),
          orden: tips.length,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) throw new Error(data.error ?? `HTTP ${res.status}`);
      setNewTip({ zona: "", titulo: "", body: "" });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setSavingT(false);
    }
  }
  async function deleteTip(id: string) {
    const ok = await confirmDialog({ title: "¿Eliminar esta recomendación?", confirmText: "Eliminar", tone: "danger" });
    if (!ok) return;
    const res = await fetchWithSupabaseSession(`/api/dashboard/alquiloya-agentes/${agenteId}/tips/${id}`, { method: "DELETE" });
    if (res.ok) load();
  }

  return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-700">Perfil público · Zonas y recomendaciones</h2>
        <p className="mt-0.5 text-[11px] text-slate-500">
          Estas zonas y recomendaciones aparecen en la página pública del agente.
        </p>
      </div>

      {err ? (
        <div className="mx-4 mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{err}</div>
      ) : null}

      <div className="grid grid-cols-1 gap-5 p-4 md:grid-cols-2">
        {/* Zonas */}
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Zonas cubiertas</h3>
          <div className="space-y-1.5">
            {loading ? (
              <p className="text-xs text-slate-400">Cargando…</p>
            ) : zonas.length === 0 ? (
              <p className="text-xs text-slate-400">Sin zonas todavía.</p>
            ) : (
              zonas.map((z) => (
                <div key={z.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-1.5 text-xs">
                  <span className="text-slate-700">
                    <strong className="text-slate-900">{z.ciudad}</strong>
                    {z.barrio ? ` · ${z.barrio}` : ""}
                  </span>
                  <button type="button" onClick={() => deleteZona(z.id)} className={btnDanger}>Quitar</button>
                </div>
              ))
            )}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <input
              className={inputCls}
              placeholder="Ciudad *"
              value={newZona.ciudad}
              onChange={(e) => setNewZona((s) => ({ ...s, ciudad: e.target.value }))}
            />
            <input
              className={inputCls}
              placeholder="Barrio (opcional)"
              value={newZona.barrio}
              onChange={(e) => setNewZona((s) => ({ ...s, barrio: e.target.value }))}
            />
          </div>
          <div className="mt-2 flex justify-end">
            <button type="button" onClick={addZona} disabled={savingZ || !newZona.ciudad.trim()} className={btnPrimary}>
              + Agregar zona
            </button>
          </div>
        </div>

        {/* Tips */}
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Recomendaciones / tips de zona</h3>
          <div className="space-y-1.5">
            {loading ? (
              <p className="text-xs text-slate-400">Cargando…</p>
            ) : tips.length === 0 ? (
              <p className="text-xs text-slate-400">Sin recomendaciones todavía.</p>
            ) : (
              tips.map((t) => (
                <div key={t.id} className="rounded-lg border border-slate-200 px-3 py-2 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      {t.zona ? <span className="text-[10px] font-semibold uppercase text-[#3F8E91]">{t.zona} · </span> : null}
                      <span className="font-semibold text-slate-900">{t.titulo}</span>
                      <p className="mt-0.5 line-clamp-2 text-slate-600">{t.body}</p>
                    </div>
                    <button type="button" onClick={() => deleteTip(t.id)} className={btnDanger}>Quitar</button>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="mt-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <input className={inputCls} placeholder="Zona (opcional)" value={newTip.zona} onChange={(e) => setNewTip((s) => ({ ...s, zona: e.target.value }))} />
              <input className={inputCls} placeholder="Título *" value={newTip.titulo} onChange={(e) => setNewTip((s) => ({ ...s, titulo: e.target.value }))} />
            </div>
            <textarea
              className={`${inputCls} min-h-[64px]`}
              placeholder="Texto de la recomendación *"
              value={newTip.body}
              onChange={(e) => setNewTip((s) => ({ ...s, body: e.target.value }))}
            />
            <div className="flex justify-end">
              <button type="button" onClick={addTip} disabled={savingT || !newTip.titulo.trim() || !newTip.body.trim()} className={btnPrimary}>
                + Agregar recomendación
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
