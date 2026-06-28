"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { fetchWithSupabaseSession } from "@/lib/api/fetch-with-supabase-session";
import type { ErpAgenteAccesoUsuario } from "@/lib/alquiloya/erp-agentes-inmobiliarios";

type CreateResp = {
  success?: boolean;
  email?: string;
  rol?: string;
  temporary_password?: string | null;
  reused_auth_user?: boolean;
  error?: string;
};

/**
 * Bloque "Acceso al portal" del detalle de Agente / Propietario.
 * Si no hay acceso, permite crearlo via POST /api/dashboard/alquiloya-accesos
 * y muestra la contraseña temporal UNA sola vez en un modal.
 */
export function AccesoBlock({
  acceso,
  tipo,
  targetId,
  defaultEmail,
}: {
  acceso: ErpAgenteAccesoUsuario | null;
  tipo: "agente" | "propietario";
  targetId: string;
  defaultEmail: string | null;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [needEmail, setNeedEmail] = useState<boolean>(!defaultEmail);
  const [emailInput, setEmailInput] = useState<string>(defaultEmail ?? "");
  const [modal, setModal] = useState<null | {
    email: string;
    rol: string;
    password: string | null;
    reused: boolean;
  }>(null);

  const [resetOpen, setResetOpen] = useState(false);
  const [resetPwd, setResetPwd] = useState("");
  const [resetPwd2, setResetPwd2] = useState("");
  const [resetBusy, setResetBusy] = useState(false);
  const [resetErr, setResetErr] = useState<string | null>(null);
  const [resetOk, setResetOk] = useState<string | null>(null);

  async function onResetPassword() {
    setResetErr(null); setResetOk(null);
    if (resetPwd.length < 8) { setResetErr("La contraseña debe tener al menos 8 caracteres."); return; }
    if (resetPwd !== resetPwd2) { setResetErr("Las contraseñas no coinciden."); return; }
    setResetBusy(true);
    try {
      const res = await fetchWithSupabaseSession("/api/dashboard/alquiloya-accesos/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, id: targetId, password: resetPwd }),
      });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) throw new Error(data.error ?? `HTTP ${res.status}`);
      setResetOk("Contraseña actualizada.");
      setResetPwd(""); setResetPwd2("");
      setTimeout(() => { setResetOpen(false); setResetOk(null); }, 1500);
    } catch (e) {
      setResetErr(e instanceof Error ? e.message : "Error al resetear");
    } finally {
      setResetBusy(false);
    }
  }

  async function onCrear() {
    setErr(null);
    if (needEmail && !emailInput.trim()) {
      setErr("Ingresá un email para el acceso");
      return;
    }
    setCreating(true);
    try {
      const res = await fetchWithSupabaseSession("/api/dashboard/alquiloya-accesos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo,
          id: targetId,
          email: emailInput.trim() || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as CreateResp;
      if (!res.ok || !data.success) throw new Error(data.error ?? `HTTP ${res.status}`);
      setModal({
        email: data.email ?? emailInput,
        rol: data.rol ?? "",
        password: data.temporary_password ?? null,
        reused: !!data.reused_auth_user,
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error al crear acceso");
    } finally {
      setCreating(false);
    }
  }

  function closeModal() {
    setModal(null);
    router.refresh();
  }

  return (
    <aside className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-600">
        Acceso al portal
      </h2>

      {acceso ? (
        <div className="space-y-2 text-sm">
          <Row label="Email" value={acceso.email ?? "—"} />
          <Row label="Rol" value={acceso.rol ?? "—"} />
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Estado</div>
            <div>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide ${
                  acceso.activo
                    ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200"
                    : "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
                }`}
              >
                {acceso.activo ? "Activo" : "Inactivo"}
              </span>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-3">
            {!resetOpen ? (
              <button
                type="button"
                onClick={() => setResetOpen(true)}
                className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Resetear contraseña
              </button>
            ) : (
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Nueva contraseña
                </div>
                <input
                  type="password"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-[#4FAEB2] focus:outline-none focus:ring-2 focus:ring-[#4FAEB2]/30"
                  value={resetPwd}
                  onChange={(e) => setResetPwd(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  autoComplete="new-password"
                />
                <input
                  type="password"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-[#4FAEB2] focus:outline-none focus:ring-2 focus:ring-[#4FAEB2]/30"
                  value={resetPwd2}
                  onChange={(e) => setResetPwd2(e.target.value)}
                  placeholder="Repetí la contraseña"
                  autoComplete="new-password"
                />
                {resetErr ? (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1.5 text-xs text-rose-700">{resetErr}</div>
                ) : null}
                {resetOk ? (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-xs text-emerald-700">{resetOk}</div>
                ) : null}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onResetPassword}
                    disabled={resetBusy}
                    className="inline-flex flex-1 items-center justify-center rounded-lg bg-[#4FAEB2] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#3F8E91] disabled:opacity-60"
                  >
                    {resetBusy ? "Guardando…" : "Actualizar contraseña"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setResetOpen(false); setResetErr(null); setResetOk(null); }}
                    disabled={resetBusy}
                    className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-500">Sin acceso creado.</p>

          {needEmail ? (
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Email para el acceso
              </label>
              <input
                type="email"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-[#4FAEB2] focus:outline-none focus:ring-2 focus:ring-[#4FAEB2]/30"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="usuario@dominio.com"
              />
            </div>
          ) : (
            <div className="text-xs text-slate-500">
              Se usará: <span className="font-medium text-slate-700">{emailInput}</span>{" "}
              <button
                type="button"
                onClick={() => setNeedEmail(true)}
                className="text-[#3F8E91] underline-offset-2 hover:underline"
              >
                cambiar
              </button>
            </div>
          )}

          {err ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {err}
            </div>
          ) : null}

          <button
            type="button"
            onClick={onCrear}
            disabled={creating}
            className="inline-flex w-full items-center justify-center rounded-xl bg-[#4FAEB2] px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#3F8E91] disabled:opacity-60"
          >
            {creating ? "Creando…" : "Crear acceso"}
          </button>
        </div>
      )}

      {modal ? <AccessCreatedModal data={modal} onClose={closeModal} /> : null}
    </aside>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-slate-800">{value}</div>
    </div>
  );
}

function AccessCreatedModal({
  data,
  onClose,
}: {
  data: { email: string; rol: string; password: string | null; reused: boolean };
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!data.password) return;
    try {
      await navigator.clipboard.writeText(data.password);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-slate-900">Acceso creado</h3>
        <p className="mt-1 text-sm text-slate-500">
          {data.reused
            ? "Este email ya existía en Auth: se reutilizó la cuenta y se vinculó al perfil."
            : "Guardá la contraseña temporal ahora. No se vuelve a mostrar."}
        </p>

        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">Email</dt>
            <dd className="mt-0.5 break-all text-slate-800">{data.email}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">Rol</dt>
            <dd className="mt-0.5 text-slate-800">{data.rol}</dd>
          </div>

          {data.password ? (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Contraseña temporal
              </dt>
              <dd className="mt-1 flex items-center gap-2">
                <code className="flex-1 rounded-md bg-slate-100 px-3 py-2 font-mono text-sm text-slate-900 ring-1 ring-slate-200">
                  {data.password}
                </code>
                <button
                  type="button"
                  onClick={copy}
                  className="inline-flex shrink-0 items-center rounded-md bg-[#4FAEB2] px-3 py-2 text-xs font-semibold text-white hover:bg-[#3F8E91]"
                >
                  {copied ? "Copiado" : "Copiar"}
                </button>
              </dd>
              <p className="mt-2 text-[11px] text-amber-700">
                ⚠ Guardá esta contraseña en un lugar seguro. No queda almacenada en la base de datos.
              </p>
            </div>
          ) : null}
        </dl>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}
