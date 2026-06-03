"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { fetchWithSupabaseSession } from "@/lib/api/fetch-with-supabase-session";

export type AgenteFormData = {
  id?: string;
  nombre: string;
  email: string;
  telefono: string;
  whatsapp: string;
  cargo: string;
  bio: string;
  foto_url: string;
  orden: number;
  activo: boolean;
  verificado: boolean;
  nivel: string;
  idiomas: string;
  tiempo_respuesta: string;
  tasa_respuesta: string;
};

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition-colors focus:border-[#4FAEB2] focus:outline-none focus:ring-2 focus:ring-[#4FAEB2]/30";
const labelCls = "block text-xs font-semibold uppercase tracking-wider text-slate-600";
const fieldCls = "space-y-1.5";

export function AgenteForm({
  mode,
  initial,
}: {
  mode: "create" | "edit";
  initial: AgenteFormData;
}) {
  const router = useRouter();
  const [form, setForm] = useState<AgenteFormData>(initial);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function set<K extends keyof AgenteFormData>(k: K, v: AgenteFormData[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!form.nombre.trim()) { setErr("El nombre es obligatorio"); return; }
    setSaving(true);
    try {
      const payload = {
        nombre: form.nombre,
        email: form.email || null,
        telefono: form.telefono || null,
        whatsapp: form.whatsapp || null,
        cargo: form.cargo || null,
        bio: form.bio || null,
        foto_url: form.foto_url || null,
        orden: form.orden,
        activo: form.activo,
        verificado: form.verificado,
        nivel: form.nivel || null,
        idiomas: form.idiomas || null,
        tiempo_respuesta: form.tiempo_respuesta || null,
        tasa_respuesta: form.tasa_respuesta || null,
      };
      const url =
        mode === "create"
          ? "/api/dashboard/alquiloya-agentes"
          : `/api/dashboard/alquiloya-agentes/${form.id}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const res = await fetchWithSupabaseSession(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        id?: string;
        error?: string;
      };
      if (!res.ok || !data.success) throw new Error(data.error ?? `HTTP ${res.status}`);
      const id = data.id ?? form.id;
      router.push(`/dashboard/agentes-inmobiliarios/agentes/${id}`);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error al guardar");
      setSaving(false);
    }
  }

  const cancelHref = mode === "edit" && form.id
    ? `/dashboard/agentes-inmobiliarios/agentes/${form.id}`
    : "/dashboard/agentes-inmobiliarios";

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {err ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{err}</div>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-600">Datos del agente</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className={fieldCls}>
            <label className={labelCls}>Nombre *</label>
            <input className={inputCls} value={form.nombre} onChange={(e) => set("nombre", e.target.value)} required />
          </div>
          <div className={fieldCls}>
            <label className={labelCls}>Cargo</label>
            <input className={inputCls} value={form.cargo} onChange={(e) => set("cargo", e.target.value)} placeholder="Agente, Asesor, etc." />
          </div>
          <div className={fieldCls}>
            <label className={labelCls}>Email</label>
            <input type="email" className={inputCls} value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div className={fieldCls}>
            <label className={labelCls}>Teléfono</label>
            <input className={inputCls} value={form.telefono} onChange={(e) => set("telefono", e.target.value)} />
          </div>
          <div className={fieldCls}>
            <label className={labelCls}>WhatsApp</label>
            <input className={inputCls} value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="ej. 595981000000" />
          </div>
          <div className={fieldCls}>
            <label className={labelCls}>URL de foto</label>
            <input className={inputCls} value={form.foto_url} onChange={(e) => set("foto_url", e.target.value)} placeholder="https://..." />
          </div>
          <div className={`${fieldCls} sm:col-span-2`}>
            <label className={labelCls}>Bio / Descripción</label>
            <textarea
              className={`${inputCls} min-h-[96px]`}
              value={form.bio}
              onChange={(e) => set("bio", e.target.value)}
              placeholder="Breve descripción visible en la web pública"
            />
          </div>
          <div className={fieldCls}>
            <label className={labelCls}>Orden</label>
            <input
              type="number"
              className={inputCls}
              value={form.orden}
              onChange={(e) => set("orden", Number(e.target.value) || 0)}
            />
          </div>
          <div className="flex items-end gap-5">
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-[#4FAEB2] focus:ring-[#4FAEB2]"
                checked={form.activo}
                onChange={(e) => set("activo", e.target.checked)}
              />
              Activo
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-[#4FAEB2] focus:ring-[#4FAEB2]"
                checked={form.verificado}
                onChange={(e) => set("verificado", e.target.checked)}
              />
              Verificado (badge azul)
            </label>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-600">Perfil público</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className={fieldCls}>
            <label className={labelCls}>Nivel</label>
            <select className={inputCls} value={form.nivel} onChange={(e) => set("nivel", e.target.value)}>
              <option value="">— Automático (por cierres) —</option>
              <option value="Junior">Junior</option>
              <option value="Pro">Pro</option>
              <option value="Top Pro">Top Pro</option>
            </select>
          </div>
          <div className={fieldCls}>
            <label className={labelCls}>Idiomas</label>
            <input className={inputCls} value={form.idiomas} onChange={(e) => set("idiomas", e.target.value)} placeholder="Ej. Es · Gn · En" />
          </div>
          <div className={fieldCls}>
            <label className={labelCls}>Tiempo de respuesta</label>
            <input className={inputCls} value={form.tiempo_respuesta} onChange={(e) => set("tiempo_respuesta", e.target.value)} placeholder="Ej. ~ 12 min" />
          </div>
          <div className={fieldCls}>
            <label className={labelCls}>Tasa de respuesta</label>
            <input className={inputCls} value={form.tasa_respuesta} onChange={(e) => set("tasa_respuesta", e.target.value)} placeholder="Ej. 98%" />
          </div>
        </div>
        <p className="mt-3 text-[11px] text-slate-500">
          Estos campos se muestran en la vista pública del agente. Si dejás <strong>nivel</strong> vacío, se calcula automáticamente
          (Top Pro ≥ 10 cierres, Pro ≥ 3, sino Junior).
        </p>
      </section>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center rounded-xl bg-[#4FAEB2] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#3F8E91] disabled:opacity-60"
        >
          {saving ? "Guardando…" : mode === "create" ? "Crear agente" : "Guardar cambios"}
        </button>
        <Link
          href={cancelHref}
          className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
