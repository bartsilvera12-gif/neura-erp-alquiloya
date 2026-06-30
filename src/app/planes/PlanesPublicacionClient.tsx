"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchWithSupabaseSession } from "@/lib/api/fetch-with-supabase-session";
import { confirmDialog } from "@/lib/ui/dialogs";

type Plan = {
  id: string;
  tier: string;
  target: string | null;
  nombre: string;
  precio: number;
  moneda: string;
  billing: string;
  badge: string | null;
  bullets: string[];
  excluded: string[];
  cta: string | null;
  highlighted: boolean;
  free_boosts: number | null;
  orden: number;
  billing_note?: string | null;
  permite_videos?: boolean;
  activo?: boolean;
};

const BILLINGS = ["gratis", "unico", "mensual", "anual"];
const MONEDAS = ["PYG", "USD"];

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition-colors focus:border-[#4FAEB2] focus:outline-none focus:ring-2 focus:ring-[#4FAEB2]/30";
const labelCls = "block text-xs font-semibold uppercase tracking-wider text-slate-600";

function fmtPrecio(p: Plan): string {
  if (p.billing === "gratis") return "Gratis";
  const cur = p.moneda === "USD" ? "USD" : "Gs.";
  return `${cur} ${Number(p.precio || 0).toLocaleString("es-PY")}`;
}

function PlanCard({
  plan,
  onEdit,
}: {
  plan: Plan;
  onEdit: () => void;
}) {
  return (
    <div className="relative flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      {plan.highlighted ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[3px] rounded-t-2xl bg-gradient-to-r from-[#4FAEB2] via-[#4FAEB2]/70 to-[#4FAEB2]/30"
        />
      ) : null}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#4FAEB2]">
            {plan.target || "—"}
          </p>
          <h3 className="mt-1 text-lg font-semibold text-slate-900">{plan.nombre}</h3>
          <p className="mt-0.5 text-[11px] font-mono text-slate-400">{plan.tier}</p>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            plan.activo !== false
              ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200"
              : "bg-slate-100 text-slate-500 ring-1 ring-slate-200"
          }`}
        >
          {plan.activo !== false ? "Activo" : "Inactivo"}
        </span>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl font-bold tabular-nums text-slate-900">{fmtPrecio(plan)}</span>
        <span className="text-xs text-slate-500">
          {plan.billing === "mensual" ? "/ mes" : plan.billing === "anual" ? "/ año" : plan.billing === "unico" ? "pago único" : ""}
        </span>
      </div>
      {plan.badge ? (
        <span className="mt-2 inline-flex w-fit items-center rounded-full bg-[#4FAEB2]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#3F8E91] ring-1 ring-[#4FAEB2]/30">
          {plan.badge}
        </span>
      ) : null}
      <ul className="mt-3 flex-1 space-y-1 text-xs text-slate-700">
        {plan.bullets.slice(0, 4).map((b, i) => (
          <li key={i} className="line-clamp-1">• {b}</li>
        ))}
        {plan.bullets.length > 4 ? (
          <li className="text-slate-400">+{plan.bullets.length - 4} más…</li>
        ) : null}
      </ul>
      <div className="mt-4 flex items-center justify-between text-[11px] text-slate-500">
        <span>Orden: <strong className="text-slate-700">{plan.orden}</strong></span>
        {plan.free_boosts != null ? <span>Boosts: <strong className="text-slate-700">{plan.free_boosts}</strong></span> : null}
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#4FAEB2] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#3F8E91]"
      >
        Editar plan
      </button>
    </div>
  );
}

function ListEditor({
  label,
  items,
  onChange,
  placeholder,
}: {
  label: string;
  items: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className={labelCls}>{label}</label>
        <button
          type="button"
          onClick={() => onChange([...items, ""])}
          className="rounded-lg border border-slate-300 px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
        >
          + Agregar
        </button>
      </div>
      <div className="space-y-1.5">
        {items.length === 0 ? (
          <p className="text-xs text-slate-400">Sin elementos.</p>
        ) : null}
        {items.map((b, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              className={inputCls}
              value={b}
              placeholder={placeholder}
              onChange={(e) => onChange(items.map((x, idx) => (idx === i ? e.target.value : x)))}
            />
            <button
              type="button"
              onClick={() => onChange(items.filter((_, idx) => idx !== i))}
              className="rounded-lg border border-rose-200 px-2 py-1 text-[11px] font-medium text-rose-600 hover:bg-rose-50"
            >
              Quitar
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function EditModal({
  plan,
  onClose,
  onSaved,
  onDeleted,
}: {
  plan: Plan;
  onClose: () => void;
  onSaved: (next: Plan) => void;
  onDeleted?: (id: string) => void;
}) {
  const [form, setForm] = useState<Plan>({ ...plan, activo: plan.activo !== false });
  const [bullets, setBullets] = useState<string[]>([...plan.bullets]);
  const [excluded, setExcluded] = useState<string[]>([...plan.excluded]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const set = <K extends keyof Plan>(k: K, v: Plan[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    setErr(null);
    if (!form.nombre.trim()) { setErr("Nombre obligatorio"); return; }
    if (!form.tier.trim()) { setErr("Tier obligatorio"); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        bullets: bullets.map((b) => b.trim()).filter(Boolean),
        excluded: excluded.map((b) => b.trim()).filter(Boolean),
      };
      const isNew = !plan.id;
      const url = isNew
        ? `/api/dashboard/alquiloya-planes-publicacion`
        : `/api/dashboard/alquiloya-planes-publicacion/${plan.id}`;
      const res = await fetchWithSupabaseSession(url, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; plan?: Plan; error?: string };
      if (!res.ok || !data.success || !data.plan) throw new Error(data.error ?? `HTTP ${res.status}`);
      onSaved(data.plan);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error al guardar");
      setSaving(false);
    }
  }

  async function destroy() {
    if (!plan.id) return;
    const ok = await confirmDialog({
      title: "Borrar plan",
      message: `¿Borrar el plan "${plan.nombre}"? Esta acción no se puede deshacer.`,
      confirmText: "Borrar",
      cancelText: "Cancelar",
      tone: "danger",
    });
    if (!ok) return;
    setSaving(true);
    setErr(null);
    try {
      const res = await fetchWithSupabaseSession(
        `/api/dashboard/alquiloya-planes-publicacion/${plan.id}`,
        { method: "DELETE" }
      );
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) throw new Error(data.error ?? `HTTP ${res.status}`);
      if (onDeleted) onDeleted(plan.id);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error al borrar");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-6 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#4FAEB2]">
              {plan.id ? "Editor de plan" : "Nuevo plan"}
            </p>
            <h2 className="text-lg font-semibold text-slate-900">{plan.nombre || "Plan sin nombre"}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Cerrar">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {err ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</div>
          ) : null}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className={labelCls}>Nombre *</label>
              <input className={inputCls} value={form.nombre} onChange={(e) => set("nombre", e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className={labelCls}>Identificador interno *</label>
              <input className={inputCls} value={form.tier} onChange={(e) => set("tier", e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className={labelCls}>Dirigido a</label>
              <input className={inputCls} value={form.target ?? ""} onChange={(e) => set("target", e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className={labelCls}>Etiqueta destacada</label>
              <input className={inputCls} value={form.badge ?? ""} onChange={(e) => set("badge", e.target.value)} placeholder="opcional" />
            </div>
            <div className="space-y-1">
              <label className={labelCls}>Precio</label>
              <input
                className={inputCls}
                type="number"
                min="0"
                value={form.precio === 0 ? "" : form.precio}
                onChange={(e) => {
                  const v = e.target.value;
                  set("precio", v === "" ? 0 : Number(v) || 0);
                }}
                placeholder="0"
              />
            </div>
            <div className="space-y-1">
              <label className={labelCls}>Moneda</label>
              <select className={inputCls} value={form.moneda} onChange={(e) => set("moneda", e.target.value)}>
                {MONEDAS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className={labelCls}>Facturación</label>
              <select className={inputCls} value={form.billing} onChange={(e) => set("billing", e.target.value)}>
                {BILLINGS.map((b) => <option key={b} value={b}>{({gratis:"Gratis",unico:"Pago único",mensual:"Mensual",anual:"Anual"})[b] ?? b}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className={labelCls}>Nota debajo del precio</label>
              <input className={inputCls} value={form.billing_note ?? ""} onChange={(e) => set("billing_note", e.target.value)} placeholder="Ej. Sin renovación automática" />
            </div>
            <div className="space-y-1">
              <label className={labelCls}>Texto del botón</label>
              <input className={inputCls} value={form.cta ?? ""} onChange={(e) => set("cta", e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className={labelCls}>Orden</label>
              <input
                className={inputCls}
                type="number"
                value={form.orden === 0 ? "" : form.orden}
                onChange={(e) => {
                  const v = e.target.value;
                  set("orden", v === "" ? 0 : Number(v) || 0);
                }}
                placeholder="0"
              />
            </div>
            <div className="space-y-1">
              <label className={labelCls}>Impulsos gratis (opcional)</label>
              <input className={inputCls} type="number" min="0" value={form.free_boosts ?? ""} onChange={(e) => set("free_boosts", e.target.value === "" ? null : Number(e.target.value))} />
            </div>
          </div>

          <div className="flex flex-wrap gap-5 pt-1">
            <label className="inline-flex items-center gap-2 text-sm text-slate-800">
              <input type="checkbox" checked={form.highlighted} onChange={(e) => set("highlighted", e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-[#4FAEB2] focus:ring-[#4FAEB2]" />
              Destacado
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-slate-800">
              <input type="checkbox" checked={form.activo !== false} onChange={(e) => set("activo", e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-[#4FAEB2] focus:ring-[#4FAEB2]" />
              Activo (visible en la web)
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-slate-800" title="El agente podra cargar un video (YouTube/Vimeo) en sus propiedades">
              <input type="checkbox" checked={!!form.permite_videos} onChange={(e) => set("permite_videos", e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-[#4FAEB2] focus:ring-[#4FAEB2]" />
              Permite videos en propiedades
            </label>
          </div>

          <ListEditor label="Características (qué incluye)" items={bullets} onChange={setBullets} placeholder="Ej. 1 propiedad activa" />
          <ListEditor label="No incluye (qué deja afuera)" items={excluded} onChange={setExcluded} placeholder="Ej. CRM integrado" />
        </div>
        <footer className="flex items-center justify-between gap-2 border-t border-slate-200 px-5 py-3">
          <div>
            {plan.id ? (
              <button type="button" disabled={saving} onClick={destroy} className="rounded-xl border border-red-300 px-3.5 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50">
                Eliminar
              </button>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Cancelar
            </button>
            <button type="button" disabled={saving} onClick={save} className="rounded-xl bg-[#4FAEB2] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#3F8E91] disabled:opacity-50">
              {saving ? "Guardando…" : plan.id ? "Guardar cambios" : "Crear plan"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

/** Decide a que segmento pertenece un plan segun el campo `target`. */
function audienceFromTarget(target: string | null | undefined): "owner" | "agent" {
  const t = (target ?? "").toLowerCase();
  // Dueños directos / propietarios → owner; el resto (agente / inmobiliaria / top pro) → agent.
  if (t.includes("dueño") || t.includes("dueno") || t.includes("propietar") || t.includes("owner")) {
    return "owner";
  }
  return "agent";
}

export default function PlanesPublicacionClient({ hideHeader = false }: { hideHeader?: boolean } = {}) {
  const [planes, setPlanes] = useState<Plan[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<Plan | null>(null);
  /** Segmento mostrado: dueños directos (default) o agentes/inmobiliarias.
   *  Mismo split visual que la web publica (/publico#plans). */
  const [audience, setAudience] = useState<"owner" | "agent">("owner");
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchWithSupabaseSession("/api/dashboard/alquiloya-planes-publicacion", { cache: "no-store" });
        const body = (await res.json().catch(() => ({}))) as { success?: boolean; data?: { planes?: Plan[] }; error?: string };
        if (cancelled) return;
        if (!res.ok || !body.success) throw new Error(body.error ?? `HTTP ${res.status}`);
        setPlanes(body.data?.planes ?? []);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Error");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const ordered = useMemo(
    () => (planes ?? []).slice().sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre)),
    [planes]
  );

  /** Filtrado por audiencia para el render. */
  const filtered = useMemo(
    () => ordered.filter((p) => audienceFromTarget(p.target) === audience),
    [ordered, audience]
  );
  const ownerCount = useMemo(() => ordered.filter((p) => audienceFromTarget(p.target) === "owner").length, [ordered]);
  const agentCount = useMemo(() => ordered.filter((p) => audienceFromTarget(p.target) === "agent").length, [ordered]);

  return (
    <div className={hideHeader ? "" : "px-6 py-6"}>
      {!hideHeader ? (
        <header className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Planes de publicación</h1>
          <p className="mt-1 text-sm text-slate-500">
            Estos planes se exhiben en <code className="rounded bg-slate-100 px-1 text-[12px] text-slate-700">/publico#plans</code>.
            Los cambios aparecen automáticamente en la web pública.
          </p>
        </header>
      ) : null}

      {err ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{err}</div>
      ) : null}
      {notice ? (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <span>{notice}</span>
          <div className="flex items-center gap-3">
            <a href="/publico#plans" target="_blank" rel="noreferrer" className="font-semibold underline">Ver web pública</a>
            <button type="button" onClick={() => setNotice(null)} className="rounded-md px-1 text-emerald-700 hover:bg-emerald-100" aria-label="Cerrar">✕</button>
          </div>
        </div>
      ) : null}


      {planes == null && !err ? (
        <p className="text-sm text-slate-500">Cargando planes…</p>
      ) : (
        <>
          {/* Segmento Dueños / Agentes + boton de crear */}
          <div className="mb-5 flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-full border border-slate-200 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setAudience("owner")}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                audience === "owner"
                  ? "bg-[#4FAEB2] text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              Dueños directos
              <span
                className={`rounded-full px-1.5 text-[10px] ${
                  audience === "owner" ? "bg-white/20" : "bg-slate-100 text-slate-500"
                }`}
              >
                {ownerCount}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setAudience("agent")}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                audience === "agent"
                  ? "bg-[#4FAEB2] text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              Agentes e inmobiliarias
              <span
                className={`rounded-full px-1.5 text-[10px] ${
                  audience === "agent" ? "bg-white/20" : "bg-slate-100 text-slate-500"
                }`}
              >
                {agentCount}
              </span>
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              const maxOrden = (ordered.length > 0)
                ? Math.max(...ordered.map((p) => p.orden ?? 0))
                : 0;
              const isOwner = audience === "owner";
              setEditing({
                id: "",
                tier: "",
                target: isOwner ? "Dueño directo" : "Agente",
                nombre: "",
                precio: 0,
                moneda: "PYG",
                billing: "unico",
                badge: null,
                bullets: [],
                excluded: [],
                cta: null,
                highlighted: false,
                free_boosts: null,
                orden: maxOrden + 10,
                billing_note: null,
                permite_videos: false,
                activo: true,
              });
            }}
            className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-[#4FAEB2] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#3F8E91]"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Nuevo plan
          </button>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
              No hay planes en este segmento todavía.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {filtered.map((p) => (
                <PlanCard key={p.id} plan={p} onEdit={() => setEditing(p)} />
              ))}
            </div>
          )}
        </>
      )}

      {editing ? (
        <EditModal
          plan={editing}
          onClose={() => setEditing(null)}
          onSaved={(next) => {
            setNotice(`Plan "${next.nombre}" guardado. Abrí /publico#plans en otra pestaña para verificar.`);
            setPlanes((prev) => {
              const cur = prev ?? [];
              const exists = cur.some((x) => x.id === next.id);
              return exists ? cur.map((x) => (x.id === next.id ? next : x)) : [...cur, next];
            });
          }}
          onDeleted={(id) => {
            setNotice("Plan borrado.");
            setPlanes((prev) => (prev ?? []).filter((x) => x.id !== id));
          }}
        />
      ) : null}
    </div>
  );
}
