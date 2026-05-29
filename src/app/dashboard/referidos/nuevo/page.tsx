"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { fetchWithSupabaseSession } from "@/lib/api/fetch-with-supabase-session";

const TIPOS = ["influencer", "aliado", "agente_referido", "otro"] as const;
const MONEDAS = ["PYG", "USD"] as const;

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition-colors focus:border-[#4FAEB2] focus:outline-none focus:ring-2 focus:ring-[#4FAEB2]/30";
const labelCls = "block text-xs font-semibold uppercase tracking-wider text-slate-600";
const fieldCls = "space-y-1.5";

function slugifyClient(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export default function NuevoReferidoPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({
    nombre: "",
    email: "",
    telefono: "",
    tipo: "influencer" as (typeof TIPOS)[number],
    notas: "",
    activo: true,
    slug: "",
    campania: "",
    cookie_dias: 60,
    rule_tipo: "porcentaje" as "porcentaje" | "monto_fijo",
    rule_valor: "10",
    rule_moneda: "PYG" as (typeof MONEDAS)[number],
    rule_recurrente: false,
    rule_meses_recurrencia: 6,
  });

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function suggestSlug() {
    if (!form.slug && form.nombre) {
      set("slug", slugifyClient(form.nombre));
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!form.nombre.trim()) { setErr("El nombre es obligatorio"); return; }
    if (!form.slug.trim()) { setErr("El slug/link es obligatorio"); return; }
    const valor = Number(form.rule_valor);
    if (!Number.isFinite(valor) || valor < 0) { setErr("Valor de comisión inválido"); return; }
    if (form.rule_tipo === "porcentaje" && valor > 100) { setErr("El porcentaje no puede ser mayor a 100"); return; }
    if (form.rule_recurrente && (!form.rule_meses_recurrencia || form.rule_meses_recurrencia < 1)) {
      setErr("Meses de recurrencia inválido");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        nombre: form.nombre,
        email: form.email || null,
        telefono: form.telefono || null,
        tipo: form.tipo,
        notas: form.notas || null,
        activo: form.activo,
        slug: slugifyClient(form.slug),
        campania: form.campania || null,
        cookie_dias: form.cookie_dias,
        rule_tipo: form.rule_tipo,
        rule_valor: valor,
        rule_moneda: form.rule_tipo === "monto_fijo" ? form.rule_moneda : null,
        rule_recurrente: form.rule_recurrente,
        rule_meses_recurrencia: form.rule_recurrente ? form.rule_meses_recurrencia : null,
      };
      const res = await fetchWithSupabaseSession("/api/dashboard/alquiloya-referral-partners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        id?: string;
        slug?: string;
        error?: string;
      };
      if (!res.ok || !data.success) throw new Error(data.error ?? `HTTP ${res.status}`);
      router.push("/dashboard/referidos");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error al guardar");
      setSaving(false);
    }
  }

  return (
    <div className="px-6 py-6">
      <header className="mb-6">
        <Link
          href="/dashboard/referidos"
          className="mb-2 inline-flex text-xs font-medium text-slate-500 hover:text-[#3F8E91]"
        >
          ← Volver al listado
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Nuevo referido</h1>
        <p className="mt-1 text-sm text-slate-500">
          Alta de partner + link único + regla de comisión en una sola operación.
        </p>
      </header>

      <form onSubmit={onSubmit} className="space-y-6">
        {err ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{err}</div>
        ) : null}

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-600">Datos del partner</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className={fieldCls}>
              <label className={labelCls}>Nombre *</label>
              <input
                className={inputCls}
                value={form.nombre}
                onChange={(e) => set("nombre", e.target.value)}
                onBlur={suggestSlug}
                required
              />
            </div>
            <div className={fieldCls}>
              <label className={labelCls}>Tipo</label>
              <select className={inputCls} value={form.tipo} onChange={(e) => set("tipo", e.target.value as (typeof TIPOS)[number])}>
                {TIPOS.map((x) => <option key={x} value={x}>{x.replace("_", " ")}</option>)}
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
            <div className={`${fieldCls} sm:col-span-2`}>
              <label className={labelCls}>Notas internas</label>
              <textarea
                className={`${inputCls} min-h-[72px]`}
                value={form.notas}
                onChange={(e) => set("notas", e.target.value)}
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
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-600">Link único</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className={fieldCls}>
              <label className={labelCls}>Slug *</label>
              <input
                className={inputCls}
                value={form.slug}
                onChange={(e) => set("slug", e.target.value)}
                placeholder="ej. marianalopez"
                required
              />
              <div className="text-[11px] text-slate-400">
                URL final: <span className="font-mono">alquiloya.com.py/r/{slugifyClient(form.slug) || "<slug>"}</span> (pendiente endpoint público)
              </div>
            </div>
            <div className={fieldCls}>
              <label className={labelCls}>Campaña</label>
              <input
                className={inputCls}
                value={form.campania}
                onChange={(e) => set("campania", e.target.value)}
                placeholder="ej. IG-lanzamiento"
              />
            </div>
            <div className={fieldCls}>
              <label className={labelCls}>Cookie (días)</label>
              <input
                type="number"
                className={inputCls}
                min={1}
                max={365}
                value={form.cookie_dias}
                onChange={(e) => set("cookie_dias", Number(e.target.value) || 60)}
              />
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-600">Comisión</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className={fieldCls}>
              <label className={labelCls}>Tipo</label>
              <select
                className={inputCls}
                value={form.rule_tipo}
                onChange={(e) => set("rule_tipo", e.target.value as "porcentaje" | "monto_fijo")}
              >
                <option value="porcentaje">Porcentaje (%)</option>
                <option value="monto_fijo">Monto fijo</option>
              </select>
            </div>
            <div className={fieldCls}>
              <label className={labelCls}>Valor *</label>
              <input
                type="number"
                step="0.01"
                min={0}
                className={inputCls}
                value={form.rule_valor}
                onChange={(e) => set("rule_valor", e.target.value)}
              />
            </div>
            {form.rule_tipo === "monto_fijo" && (
              <div className={fieldCls}>
                <label className={labelCls}>Moneda</label>
                <select
                  className={inputCls}
                  value={form.rule_moneda}
                  onChange={(e) => set("rule_moneda", e.target.value as (typeof MONEDAS)[number])}
                >
                  {MONEDAS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            )}
            <div className="flex items-end">
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-[#4FAEB2] focus:ring-[#4FAEB2]"
                  checked={form.rule_recurrente}
                  onChange={(e) => set("rule_recurrente", e.target.checked)}
                />
                Comisión recurrente
              </label>
            </div>
            {form.rule_recurrente && (
              <div className={fieldCls}>
                <label className={labelCls}>Meses de recurrencia *</label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  className={inputCls}
                  value={form.rule_meses_recurrencia}
                  onChange={(e) => set("rule_meses_recurrencia", Number(e.target.value) || 1)}
                />
              </div>
            )}
          </div>
        </section>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center rounded-xl bg-[#4FAEB2] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#3F8E91] disabled:opacity-60"
          >
            {saving ? "Guardando…" : "Crear referido"}
          </button>
          <Link
            href="/dashboard/referidos"
            className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
