"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { fetchWithSupabaseSession } from "@/lib/api/fetch-with-supabase-session";

const OPTIONS: Array<{ value: string; label: string }> = [
  { value: "pendiente", label: "Pendiente" },
  { value: "pagada", label: "Pagada" },
  { value: "cancelada", label: "Cancelada" },
];

export default function EstadoComisionSelect({ id, current }: { id: string | null; current: string | null }) {
  const router = useRouter();
  const [v, setV] = useState(current || "pendiente");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!id) return <span className="text-[11px] text-slate-400">—</span>;

  async function onChange(next: string) {
    if (next === v) return;
    setBusy(true);
    setErr(null);
    const prev = v;
    setV(next);
    try {
      const res = await fetchWithSupabaseSession(`/api/dashboard/alquiloya-referral-commissions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: next }),
      });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) throw new Error(data.error ?? `HTTP ${res.status}`);
      router.refresh();
    } catch (e) {
      setV(prev);
      setErr(e instanceof Error ? e.message : "No se pudo actualizar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <select
        value={v}
        disabled={busy}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-slate-300 bg-white px-1.5 py-0.5 text-[11px] text-slate-700 shadow-sm focus:border-[#4FAEB2] focus:outline-none focus:ring-1 focus:ring-[#4FAEB2]/30 disabled:opacity-50"
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {err ? <span className="text-[10px] text-rose-600">{err}</span> : null}
    </div>
  );
}
