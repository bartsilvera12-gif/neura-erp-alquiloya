"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fetchWithSupabaseSession } from "@/lib/api/fetch-with-supabase-session";

type Partner = {
  id: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  tipo: string | null;
  notas: string | null;
};

export function EditarPartnerButton({ partner }: { partner: Partner }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [nombre, setNombre] = useState(partner.nombre);
  const [email, setEmail] = useState(partner.email ?? "");
  const [telefono, setTelefono] = useState(partner.telefono ?? "");
  const [tipo, setTipo] = useState<string>(partner.tipo ?? "individual");
  const [notas, setNotas] = useState(partner.notas ?? "");

  function reset() {
    setNombre(partner.nombre);
    setEmail(partner.email ?? "");
    setTelefono(partner.telefono ?? "");
    setTipo(partner.tipo ?? "individual");
    setNotas(partner.notas ?? "");
    setErr(null);
  }

  async function guardar() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetchWithSupabaseSession(
        `/api/dashboard/alquiloya-referral-partners/${partner.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nombre: nombre.trim(),
            email: email.trim() || null,
            telefono: telefono.trim() || null,
            tipo,
            notas: notas.trim() || null,
          }),
        }
      );
      if (!r.ok) {
        const body = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${r.status}`);
      }
      setOpen(false);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error guardando");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          reset();
          setOpen(true);
        }}
        className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-100"
        title="Editar datos del partner"
      >
        Editar datos
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/55 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) setOpen(false);
          }}
        >
          <div className="mt-12 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-slate-900">
              Editar datos del partner
            </h3>
            <p className="mt-0.5 text-sm text-slate-500">
              Cambiá nombre, contacto, tipo y notas. Los cambios afectan el panel
              y el portal de referidos.
            </p>

            <div className="mt-4 space-y-3">
              <Field label="Nombre">
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#4FAEB2] focus:outline-none focus:ring-2 focus:ring-[#4FAEB2]/30"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Email">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="alguien@dominio.com"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#4FAEB2] focus:outline-none focus:ring-2 focus:ring-[#4FAEB2]/30"
                  />
                </Field>
                <Field label="Teléfono">
                  <input
                    type="text"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="0981 000 000"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#4FAEB2] focus:outline-none focus:ring-2 focus:ring-[#4FAEB2]/30"
                  />
                </Field>
              </div>

              <Field label="Tipo">
                <select
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#4FAEB2] focus:outline-none focus:ring-2 focus:ring-[#4FAEB2]/30"
                >
                  <option value="individual">Individual</option>
                  <option value="empresa">Empresa</option>
                  <option value="influencer">Influencer</option>
                </select>
              </Field>

              <Field label="Notas">
                <textarea
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  rows={3}
                  placeholder="Observaciones internas (opcional)"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#4FAEB2] focus:outline-none focus:ring-2 focus:ring-[#4FAEB2]/30"
                />
              </Field>
            </div>

            {err ? (
              <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {err}
              </div>
            ) : null}

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setOpen(false)}
                className="rounded-lg bg-slate-100 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={busy || !nombre.trim()}
                onClick={guardar}
                className="rounded-lg bg-[#4FAEB2] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#3F8E91] disabled:opacity-60"
              >
                {busy ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}
