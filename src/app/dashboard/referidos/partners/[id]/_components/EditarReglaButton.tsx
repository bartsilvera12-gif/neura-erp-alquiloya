"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fetchWithSupabaseSession } from "@/lib/api/fetch-with-supabase-session";

type Rule = {
  id: string;
  tipo: string;
  valor: number;
  moneda: string | null;
  recurrente: boolean;
  meses_recurrencia: number | null;
};

export function EditarReglaButton({
  partnerId,
  currentRule,
}: {
  partnerId: string;
  currentRule: Rule | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tipo, setTipo] = useState<"porcentaje" | "monto_fijo">(
    currentRule?.tipo === "monto_fijo" ? "monto_fijo" : "porcentaje"
  );
  const [valor, setValor] = useState<string>(currentRule ? String(currentRule.valor) : "");
  const [moneda, setMoneda] = useState<string>(currentRule?.moneda ?? "PYG");
  const [recurrente, setRecurrente] = useState<boolean>(!!currentRule?.recurrente);
  const [meses, setMeses] = useState<string>(
    currentRule?.meses_recurrencia != null ? String(currentRule.meses_recurrencia) : "12"
  );

  function resetFromCurrent() {
    setTipo(currentRule?.tipo === "monto_fijo" ? "monto_fijo" : "porcentaje");
    setValor(currentRule ? String(currentRule.valor) : "");
    setMoneda(currentRule?.moneda ?? "PYG");
    setRecurrente(!!currentRule?.recurrente);
    setMeses(currentRule?.meses_recurrencia != null ? String(currentRule.meses_recurrencia) : "12");
    setErr(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        tipo,
        valor: Number(valor.replace(",", ".")),
        recurrente,
      };
      if (tipo === "monto_fijo") payload.moneda = moneda || "PYG";
      if (recurrente) payload.meses_recurrencia = Number(meses);
      const res = await fetchWithSupabaseSession(
        `/api/dashboard/alquiloya-referral-partners/${partnerId}/regla`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setOpen(false);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error guardando regla");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { resetFromCurrent(); setOpen(true); }}
        className="ml-2 inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-200"
      >
        Editar
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => !busy && setOpen(false)} />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200">
            <h2 className="text-lg font-bold text-slate-900">Editar comision del partner</h2>
            <p className="mt-1 text-xs text-slate-500">
              La regla anterior queda cerrada con fecha de hoy. La nueva aplica desde ya en adelante; las comisiones ya generadas no cambian.
            </p>
            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600">Tipo</label>
                <div className="mt-1 flex gap-2">
                  <button type="button" onClick={() => setTipo("porcentaje")} className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ring-1 transition-colors ${tipo === "porcentaje" ? "bg-[#3F8E91] text-white ring-[#3F8E91]" : "bg-white text-slate-700 ring-slate-300 hover:bg-slate-50"}`}>% Porcentaje</button>
                  <button type="button" onClick={() => setTipo("monto_fijo")} className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ring-1 transition-colors ${tipo === "monto_fijo" ? "bg-[#3F8E91] text-white ring-[#3F8E91]" : "bg-white text-slate-700 ring-slate-300 hover:bg-slate-50"}`}>Monto fijo</button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600">{tipo === "porcentaje" ? "Valor (%)" : "Valor"}</label>
                  <input type="number" inputMode="decimal" step="0.01" min="0" max={tipo === "porcentaje" ? "100" : undefined} required value={valor} onChange={(e) => setValor(e.target.value)} placeholder={tipo === "porcentaje" ? "Ej. 10" : "Ej. 50000"} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-[#3F8E91] focus:outline-none focus:ring-2 focus:ring-[#3F8E91]/30" />
                </div>
                {tipo === "monto_fijo" ? (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600">Moneda</label>
                    <select value={moneda} onChange={(e) => setMoneda(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-[#3F8E91] focus:outline-none focus:ring-2 focus:ring-[#3F8E91]/30">
                      <option value="PYG">PYG (Gs.)</option>
                      <option value="USD">USD</option>
                    </select>
                  </div>
                ) : null}
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={recurrente} onChange={(e) => setRecurrente(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-[#3F8E91] focus:ring-[#3F8E91]" />
                  Comision recurrente
                </label>
                {recurrente ? (
                  <div className="mt-2">
                    <label className="block text-xs font-semibold text-slate-600">Meses (cantidad de comisiones consecutivas)</label>
                    <input type="number" min="1" step="1" required value={meses} onChange={(e) => setMeses(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-[#3F8E91] focus:outline-none focus:ring-2 focus:ring-[#3F8E91]/30" />
                  </div>
                ) : null}
              </div>
              {err ? (<div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{err}</div>) : null}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button type="button" disabled={busy} onClick={() => setOpen(false)} className="rounded-lg bg-slate-100 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-60">Cancelar</button>
                <button type="submit" disabled={busy} className="rounded-lg bg-[#3F8E91] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#357678] disabled:opacity-60">{busy ? "Guardando..." : "Guardar regla"}</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
