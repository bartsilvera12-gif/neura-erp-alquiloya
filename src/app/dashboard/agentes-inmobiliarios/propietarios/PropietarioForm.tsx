"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { fetchWithSupabaseSession } from "@/lib/api/fetch-with-supabase-session";
import { confirmDialog } from "@/lib/ui/dialogs";

export type PropietarioFormData = {
  id?: string;
  nombre: string;
  email: string;
  telefono: string;
  documento: string;
  tipo_persona: string;
  estado: string;
  activo: boolean;
  plan_publicacion_id: string;
  observaciones: string;
};

const TIPOS = ["", "fisica", "juridica"];
const ESTADOS = ["", "pendiente", "verificado", "baja"];

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition-colors focus:border-[#4FAEB2] focus:outline-none focus:ring-2 focus:ring-[#4FAEB2]/30";
const labelCls = "block text-xs font-semibold uppercase tracking-wider text-slate-600";
const fieldCls = "space-y-1.5";

export function PropietarioForm({
  mode,
  initial,
}: {
  mode: "create" | "edit";
  initial: PropietarioFormData;
}) {
  const router = useRouter();
  const [form, setForm] = useState<PropietarioFormData>(initial);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  async function onResetPassword() {
    if (!form.id) return;
    if (!form.email.trim()) {
      setErr("El propietario necesita un email cargado antes de crear su cuenta.");
      return;
    }
    const ok = await confirmDialog({
      title: "Generar acceso al portal",
      message:
        `Se va a crear (o resetear) la cuenta del portal para "${form.nombre}" con el email ${form.email}.\n\n` +
        `Vamos a generar una nueva contraseña temporal — pasala vos al cliente por WhatsApp.`,
      confirmText: "Generar contraseña",
      cancelText: "Cancelar",
      tone: "warning",
    });
    if (!ok) return;
    setResetting(true);
    setErr(null);
    try {
      const res = await fetchWithSupabaseSession(
        `/api/dashboard/alquiloya-propietarios/${form.id}/reset-password`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }
      );
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        email?: string;
        tempPassword?: string;
        created?: boolean;
        error?: string;
      };
      if (!res.ok || !data.success || !data.tempPassword) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      await confirmDialog({
        title: data.created ? "Cuenta del portal creada" : "Contraseña reseteada",
        message:
          `Email: ${data.email}\n` +
          `Contraseña temporal: ${data.tempPassword}\n\n` +
          `IMPORTANTE: copiá esta contraseña ahora y enviásela al propietario por WhatsApp. No se vuelve a mostrar.`,
        confirmText: "Listo, ya la copié",
        cancelText: "Cerrar",
        tone: "warning",
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo resetear la contraseña");
    } finally {
      setResetting(false);
    }
  }

  function set<K extends keyof PropietarioFormData>(k: K, v: PropietarioFormData[K]) {
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
        documento: form.documento || null,
        tipo_persona: form.tipo_persona || null,
        estado: form.estado || null,
        activo: form.activo,
        plan_publicacion_id: form.plan_publicacion_id || null,
        observaciones: form.observaciones || null,
      };
      const url =
        mode === "create"
          ? "/api/dashboard/alquiloya-propietarios"
          : `/api/dashboard/alquiloya-propietarios/${form.id}`;
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
      router.push(`/dashboard/agentes-inmobiliarios/propietarios/${id}`);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error al guardar");
      setSaving(false);
    }
  }

  const cancelHref = mode === "edit" && form.id
    ? `/dashboard/agentes-inmobiliarios/propietarios/${form.id}`
    : "/dashboard/agentes-inmobiliarios";

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {err ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{err}</div>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-600">Datos del propietario</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className={fieldCls}>
            <label className={labelCls}>Nombre *</label>
            <input className={inputCls} value={form.nombre} onChange={(e) => set("nombre", e.target.value)} required />
          </div>
          <div className={fieldCls}>
            <label className={labelCls}>Tipo de persona</label>
            <select className={inputCls} value={form.tipo_persona} onChange={(e) => set("tipo_persona", e.target.value)}>
              {TIPOS.map((t) => (
                <option key={t || "_"} value={t}>{t || "— sin especificar —"}</option>
              ))}
            </select>
          </div>
          <div className={fieldCls}>
            <label className={labelCls}>Documento</label>
            <input className={inputCls} value={form.documento} onChange={(e) => set("documento", e.target.value)} placeholder="RUC, CI, etc." />
          </div>
          <div className={fieldCls}>
            <label className={labelCls}>Estado</label>
            <select className={inputCls} value={form.estado} onChange={(e) => set("estado", e.target.value)}>
              {ESTADOS.map((t) => (
                <option key={t || "_"} value={t}>{t || "— sin especificar —"}</option>
              ))}
            </select>
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
            <label className={labelCls}>Plan de publicación (UUID)</label>
            <input
              className={inputCls}
              value={form.plan_publicacion_id}
              onChange={(e) => set("plan_publicacion_id", e.target.value)}
              placeholder="opcional"
            />
          </div>
          <div className="flex items-end">
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-[#4FAEB2] focus:ring-[#4FAEB2]"
                checked={form.activo}
                onChange={(e) => set("activo", e.target.checked)}
              />
              Activo
            </label>
          </div>
          <div className={`${fieldCls} sm:col-span-2`}>
            <label className={labelCls}>Observaciones</label>
            <textarea
              className={`${inputCls} min-h-[96px]`}
              value={form.observaciones}
              onChange={(e) => set("observaciones", e.target.value)}
              placeholder="Notas internas"
            />
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center rounded-xl bg-[#4FAEB2] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#3F8E91] disabled:opacity-60"
        >
          {saving ? "Guardando…" : mode === "create" ? "Crear propietario" : "Guardar cambios"}
        </button>
        <Link
          href={cancelHref}
          className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Cancelar
        </Link>
        {mode === "edit" && form.id ? (
          <button
            type="button"
            onClick={onResetPassword}
            disabled={resetting}
            title="Crea la cuenta del portal o resetea su contraseña — útil cuando el propietario no recuerda el acceso."
            className="ml-auto inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 shadow-sm transition-colors hover:bg-amber-100 disabled:opacity-60"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            {resetting ? "Generando…" : "Generar / resetear contraseña"}
          </button>
        ) : null}
      </div>
    </form>
  );
}
