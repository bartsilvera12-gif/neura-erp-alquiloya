"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchWithSupabaseSession } from "@/lib/api/fetch-with-supabase-session";

type Duracion = 7 | 14 | 30 | 0; // 0 = sin vencimiento

function fmtHasta(iso: string | null): string {
  if (!iso) return "sin vencimiento";
  try {
    return new Date(iso).toLocaleDateString("es-PY", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

function diasRestantes(iso: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

export default function ToggleDestacadaButton({
  id,
  initialEfectiva,
  initialHasta,
  titulo,
}: {
  id: string;
  initialEfectiva: boolean;
  initialHasta: string | null;
  titulo: string | null;
}) {
  const router = useRouter();
  const [efectiva, setEfectiva] = useState(!!initialEfectiva);
  const [hasta, setHasta] = useState<string | null>(initialHasta);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState(false);
  const [dur, setDur] = useState<Duracion>(7);

  useEffect(() => {
    if (!modal) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) setModal(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [modal, busy]);

  async function apply(destacada: boolean, duracionDias: number | null) {
    setBusy(true);
    try {
      const res = await fetchWithSupabaseSession(
        `/api/dashboard/alquiloya-propiedades/${id}/toggle`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ destacada, duracion_dias: duracionDias }),
        }
      );
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        destacada?: boolean;
        destacada_hasta?: string | null;
        error?: string;
      };
      if (!res.ok || !data.success) throw new Error(data.error ?? `HTTP ${res.status}`);
      const next = data.destacada
        ? !!(data.destacada && (!data.destacada_hasta || new Date(data.destacada_hasta) > new Date()))
        : false;
      setEfectiva(next);
      setHasta(data.destacada_hasta ?? null);
      setModal(false);
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error";
      window.alert(`No se pudo actualizar "${titulo ?? "esta propiedad"}": ${msg}`);
    } finally {
      setBusy(false);
    }
  }

  const restantes = diasRestantes(hasta);
  const label = efectiva ? (restantes != null ? `Sí · ${restantes}d` : "Sí") : "No";
  const cls = efectiva
    ? "bg-amber-100 text-amber-800 ring-amber-300 hover:bg-amber-200"
    : "bg-slate-100 text-slate-600 ring-slate-200 hover:bg-slate-200";

  return (
    <>
      <button
        type="button"
        onClick={() => (efectiva ? apply(false, null) : setModal(true))}
        disabled={busy}
        title={
          efectiva
            ? hasta
              ? `Clic para quitar destaque. Vence ${fmtHasta(hasta)}.`
              : "Clic para quitar destaque (sin vencimiento)."
            : "Clic para destacar"
        }
        aria-pressed={efectiva}
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide ring-1 transition-colors disabled:cursor-wait disabled:opacity-60 ${cls}`}
      >
        {busy ? "…" : label}
      </button>

      {modal ? (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => !busy && setModal(false)}
          />
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-slate-200">
            <h3 className="text-base font-semibold text-slate-900">Destacar propiedad</h3>
            <p className="mt-1 text-sm text-slate-600">
              {titulo ?? "Esta propiedad"} aparecerá primero en la web pública.
            </p>
            <div className="mt-4 space-y-2">
              {[
                { v: 7 as Duracion, lbl: "7 días" },
                { v: 14 as Duracion, lbl: "14 días" },
                { v: 30 as Duracion, lbl: "30 días" },
                { v: 0 as Duracion, lbl: "Sin vencimiento (manual)" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                    dur === opt.v ? "border-amber-400 bg-amber-50 text-amber-900" : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="radio"
                    checked={dur === opt.v}
                    onChange={() => setDur(opt.v)}
                    className="h-4 w-4 text-amber-500"
                  />
                  {opt.lbl}
                </label>
              ))}
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setModal(false)}
                disabled={busy}
                className="rounded-lg bg-slate-100 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => apply(true, dur === 0 ? null : dur)}
                className="rounded-lg bg-amber-500 px-3.5 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
              >
                {busy ? "Aplicando…" : "Destacar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
