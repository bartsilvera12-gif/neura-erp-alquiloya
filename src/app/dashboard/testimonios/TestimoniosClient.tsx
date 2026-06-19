"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fetchWithSupabaseSession } from "@/lib/api/fetch-with-supabase-session";
import ConfirmDialog from "@/components/ConfirmDialog";
import type { TestimonioRow } from "@/lib/alquiloya/erp-testimonios";
import { notify } from "@/lib/ui/dialogs";

type Editing = Partial<TestimonioRow> & { isNew?: boolean };

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-[#4FAEB2] focus:outline-none focus:ring-2 focus:ring-[#4FAEB2]/30";
const labelCls = "block text-xs font-semibold uppercase tracking-wider text-slate-600";

function Stars({ n }: { n: number }) {
  return (
    <span className="text-amber-500" aria-label={`${n} de 5`}>
      {"★".repeat(Math.max(0, Math.min(5, n)))}
      <span className="text-slate-300">{"★".repeat(5 - Math.max(0, Math.min(5, n)))}</span>
    </span>
  );
}

export default function TestimoniosClient({ initial }: { initial: TestimonioRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<TestimonioRow[]>(initial);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<TestimonioRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function save() {
    if (!editing) return;
    setErr(null);
    if (!editing.autor?.trim()) { setErr("El autor es obligatorio"); return; }
    if (!editing.contenido?.trim()) { setErr("El contenido es obligatorio"); return; }
    setSaving(true);
    try {
      const payload = {
        autor: editing.autor,
        rol: editing.rol ?? null,
        ciudad: editing.ciudad ?? null,
        contenido: editing.contenido,
        foto_url: editing.foto_url ?? null,
        calificacion: editing.calificacion ?? 5,
        orden: editing.orden ?? 0,
        activo: editing.activo ?? true,
        destacado: editing.destacado ?? false,
      };
      const isNew = editing.isNew;
      const url = isNew
        ? "/api/dashboard/alquiloya-testimonios"
        : `/api/dashboard/alquiloya-testimonios/${editing.id}`;
      const res = await fetchWithSupabaseSession(url, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; id?: string; error?: string };
      if (!res.ok || !data.success) throw new Error(data.error ?? `HTTP ${res.status}`);
      const savedId = data.id ?? editing.id!;
      const saved: TestimonioRow = {
        id: savedId,
        autor: payload.autor,
        rol: payload.rol,
        ciudad: payload.ciudad,
        contenido: payload.contenido,
        foto_url: payload.foto_url,
        calificacion: payload.calificacion,
        orden: payload.orden,
        activo: payload.activo,
        destacado: payload.destacado,
        created_at: editing.created_at ?? new Date().toISOString(),
      };
      setRows((prev) => isNew ? [saved, ...prev] : prev.map((r) => (r.id === saved.id ? saved : r)));
      setEditing(null);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function doDelete() {
    if (!deleting) return;
    setBusyId(deleting.id);
    try {
      const res = await fetchWithSupabaseSession(
        `/api/dashboard/alquiloya-testimonios/${deleting.id}`,
        { method: "DELETE" }
      );
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) throw new Error(data.error ?? `HTTP ${res.status}`);
      setRows((prev) => prev.filter((r) => r.id !== deleting.id));
      setDeleting(null);
      router.refresh();
    } catch (e) {
      notify({
        tone: "danger",
        title: "Error al eliminar",
        message: e instanceof Error ? e.message : "Error desconocido",
      });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-end">
        <button
          type="button"
          onClick={() => setEditing({ isNew: true, autor: "", contenido: "", calificacion: 5, orden: 0, activo: true, destacado: false })}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#4FAEB2] px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#3F8E91]"
        >
          + Nuevo testimonio
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
          Aún no hay testimonios cargados.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((t) => (
            <div key={t.id} className={`rounded-xl border bg-white p-4 shadow-sm ${t.destacado ? "border-amber-300 ring-1 ring-amber-200" : "border-slate-200"} ${t.activo ? "" : "opacity-60"}`}>
              <div className="flex items-start gap-3">
                {t.foto_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.foto_url} alt={t.autor} className="h-11 w-11 rounded-full object-cover ring-1 ring-slate-200" />
                ) : (
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600">
                    {t.autor.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-900">{t.autor}</div>
                  <div className="text-xs text-slate-500">
                    {[t.rol, t.ciudad].filter(Boolean).join(" · ") || "—"}
                  </div>
                </div>
                <Stars n={t.calificacion} />
              </div>
              <p className="mt-3 line-clamp-4 text-sm text-slate-700">{t.contenido}</p>
              <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
                <span>
                  Orden: {t.orden}
                  {t.destacado ? " · ⭐ Destacado" : ""}
                  {!t.activo ? " · 🚫 Inactivo" : ""}
                </span>
                <span className="inline-flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setEditing({ ...t, isNew: false })}
                    className="rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-700 hover:bg-slate-200"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleting(t)}
                    className="rounded-md bg-rose-50 px-2 py-0.5 font-medium text-rose-700 hover:bg-rose-100"
                  >
                    Eliminar
                  </button>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing ? (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => !saving && setEditing(null)} />
          <div className="relative w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-slate-200 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-semibold text-slate-900">
              {editing.isNew ? "Nuevo testimonio" : "Editar testimonio"}
            </h3>
            {err ? (
              <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</div>
            ) : null}
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={labelCls}>Autor *</label>
                <input className={inputCls} value={editing.autor ?? ""} onChange={(e) => setEditing((x) => ({ ...x!, autor: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Rol</label>
                <input className={inputCls} placeholder="Propietaria / Agente / Inquilino" value={editing.rol ?? ""} onChange={(e) => setEditing((x) => ({ ...x!, rol: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Ciudad</label>
                <input className={inputCls} value={editing.ciudad ?? ""} onChange={(e) => setEditing((x) => ({ ...x!, ciudad: e.target.value }))} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Contenido *</label>
                <textarea rows={4} className={inputCls} value={editing.contenido ?? ""} onChange={(e) => setEditing((x) => ({ ...x!, contenido: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Calificación (1-5)</label>
                <input type="number" min="1" max="5" className={inputCls} value={editing.calificacion ?? 5} onChange={(e) => setEditing((x) => ({ ...x!, calificacion: Number(e.target.value) || 5 }))} />
              </div>
              <div>
                <label className={labelCls}>Orden</label>
                <input type="number" className={inputCls} value={editing.orden ?? 0} onChange={(e) => setEditing((x) => ({ ...x!, orden: Number(e.target.value) || 0 }))} />
              </div>
              <div className="flex items-center gap-4">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={editing.activo ?? true} onChange={(e) => setEditing((x) => ({ ...x!, activo: e.target.checked }))} />
                  Activo
                </label>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={editing.destacado ?? false} onChange={(e) => setEditing((x) => ({ ...x!, destacado: e.target.checked }))} />
                  Destacado
                </label>
              </div>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} disabled={saving} className="rounded-lg bg-slate-100 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200">Cancelar</button>
              <button type="button" onClick={save} disabled={saving} className="rounded-lg bg-[#4FAEB2] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#3F8E91] disabled:opacity-60">
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={!!deleting}
        title="Eliminar testimonio"
        description={deleting ? <>Vas a eliminar el testimonio de <strong>{deleting.autor}</strong>. Esta acción no se puede deshacer.</> : null}
        confirmLabel="Eliminar"
        tone="danger"
        busy={!!busyId}
        onConfirm={doDelete}
        onCancel={() => !busyId && setDeleting(null)}
      />
    </>
  );
}
