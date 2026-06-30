"use client";

import { useEffect, useState } from "react";
import { fetchWithSupabaseSession } from "@/lib/api/fetch-with-supabase-session";
import RichTextEditor from "@/components/RichTextEditor";

const KEY = "referidos_como_funciona";
const DEFAULT_TEXT = `<p><strong>Estándar (10%):</strong> abierto a todos los usuarios. Comisión única sobre el primer pago del referido.</p>
<p><strong>Influencer (25% × 6 meses):</strong> por invitación. Comisión recurrente durante 6 meses + acceso a creatividades y dashboard avanzado.</p>`;

export default function ComoFuncionaEditor() {
  const [value, setValue] = useState<string>("");
  const [original, setOriginal] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchWithSupabaseSession(`/api/dashboard/alquiloya-site-settings/${KEY}`, { cache: "no-store" });
        const data = (await res.json().catch(() => ({}))) as { value?: string | null };
        if (cancelled) return;
        const v = (data.value ?? "").trim() || DEFAULT_TEXT;
        setValue(v);
        setOriginal(v);
      } catch {
        if (!cancelled) {
          setValue(DEFAULT_TEXT);
          setOriginal(DEFAULT_TEXT);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetchWithSupabaseSession(`/api/dashboard/alquiloya-site-settings/${KEY}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) throw new Error(data.error ?? `HTTP ${res.status}`);
      setOriginal(value);
      setMsg({ tone: "ok", text: "Contenido guardado. Los referidos verán el cambio al refrescar." });
    } catch (e) {
      setMsg({ tone: "err", text: e instanceof Error ? e.message : "Error al guardar" });
    } finally {
      setSaving(false);
    }
  }

  function resetDefault() {
    setValue(DEFAULT_TEXT);
  }

  const dirty = value !== original;

  return (
    <section className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            &quot;Cómo funciona el programa&quot; / Términos y condiciones
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Aparece en la página de cada referido al final del dashboard.
            Usá la barra para dar formato (negritas, títulos, listas, enlaces).
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={resetDefault}
            disabled={saving || loading}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Volver al texto por defecto
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || loading || !dirty}
            className="rounded-lg bg-[#4FAEB2] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#3F8E91] disabled:opacity-50"
          >
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-slate-400">Cargando…</div>
      ) : (
        <>
          <RichTextEditor
            value={value}
            onChange={setValue}
            placeholder="Escribí cómo funciona el programa de referidos…"
            minHeight={260}
          />

          {msg ? (
            <div
              className={`mt-3 rounded-lg px-3 py-2 text-xs ${
                msg.tone === "ok"
                  ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border border-rose-200 bg-rose-50 text-rose-700"
              }`}
            >
              {msg.text}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
