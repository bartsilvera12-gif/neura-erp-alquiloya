"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { fetchWithSupabaseSession } from "@/lib/api/fetch-with-supabase-session";
import { confirmDialog } from "@/lib/ui/dialogs";

/**
 * Acciones del detalle de un partner: activar/desactivar, eliminar (soft o hard
 * según historial), crear acceso al portal con email + contraseña definida por
 * el admin.
 */
export function PartnerActions({
  partnerId,
  activo,
  hasUsuario,
  defaultEmail,
}: {
  partnerId: string;
  activo: boolean;
  hasUsuario: boolean;
  defaultEmail: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [accesoOpen, setAccesoOpen] = useState(false);
  const [accesoEmail, setAccesoEmail] = useState(defaultEmail ?? "");
  const [accesoPass1, setAccesoPass1] = useState("");
  const [accesoPass2, setAccesoPass2] = useState("");

  async function toggleActivo() {
    setErr(null); setInfo(null); setBusy("toggle");
    try {
      const res = await fetchWithSupabaseSession(
        `/api/dashboard/alquiloya-referral-partners/${partnerId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ activo: !activo }),
        }
      );
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) throw new Error(data.error ?? `HTTP ${res.status}`);
      setInfo(activo ? "Desactivado." : "Activado.");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(null);
    }
  }

  async function doDelete() {
    const ok = await confirmDialog({
      title: "¿Eliminar este referido?",
      message: "Si tiene historial de clicks o comisiones se desactivará automáticamente en lugar de borrarse.",
      confirmText: "Eliminar",
      cancelText: "Cancelar",
      tone: "danger",
    });
    if (!ok) return;
    setErr(null); setInfo(null); setBusy("delete");
    try {
      const res = await fetchWithSupabaseSession(
        `/api/dashboard/alquiloya-referral-partners/${partnerId}`,
        { method: "DELETE" }
      );
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean; mode?: string; reason?: string; error?: string;
      };
      if (!res.ok || !data.success) throw new Error(data.error ?? `HTTP ${res.status}`);
      if (data.mode === "soft") {
        setInfo(data.reason ?? "Marcado inactivo (tiene historial).");
        router.refresh();
      } else {
        router.push("/dashboard/referidos");
        router.refresh();
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(null);
    }
  }

  async function crearAcceso(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setInfo(null);
    if (!accesoEmail.trim()) { setErr("Email requerido."); return; }
    if (accesoPass1.length < 8) { setErr("La contraseña debe tener al menos 8 caracteres."); return; }
    if (accesoPass1 !== accesoPass2) { setErr("Las contraseñas no coinciden."); return; }
    setBusy("acceso");
    try {
      const res = await fetchWithSupabaseSession("/api/dashboard/alquiloya-accesos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: "referido_partner",
          id: partnerId,
          email: accesoEmail.trim(),
          password: accesoPass1,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean; reused_auth_user?: boolean; error?: string;
      };
      if (!res.ok || !data.success) throw new Error(data.error ?? `HTTP ${res.status}`);
      setInfo(
        data.reused_auth_user
          ? "Cuenta existente reutilizada y vinculada al referido."
          : "Acceso creado. Compartile el email + contraseña con el referido."
      );
      setAccesoOpen(false);
      setAccesoPass1(""); setAccesoPass2("");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={toggleActivo}
          disabled={busy !== null}
          className={`inline-flex items-center rounded-xl px-3 py-1.5 text-xs font-semibold shadow-sm transition-colors disabled:opacity-60 ${
            activo
              ? "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              : "border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
          }`}
        >
          {busy === "toggle" ? "…" : activo ? "Desactivar" : "Activar"}
        </button>
        {!hasUsuario ? (
          <button
            type="button"
            onClick={() => setAccesoOpen((v) => !v)}
            disabled={busy !== null}
            className="inline-flex items-center rounded-xl bg-[#4FAEB2] px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-[#3F8E91] disabled:opacity-60"
          >
            Crear acceso
          </button>
        ) : (
          <span className="inline-flex items-center rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
            ✓ Acceso vinculado
          </span>
        )}
        <button
          type="button"
          onClick={doDelete}
          disabled={busy !== null}
          className="inline-flex items-center rounded-xl border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
        >
          {busy === "delete" ? "Eliminando…" : "Eliminar"}
        </button>
      </div>

      {err ? <div className="rounded-md bg-rose-50 px-2 py-1 text-xs text-rose-700">{err}</div> : null}
      {info ? <div className="rounded-md bg-emerald-50 px-2 py-1 text-xs text-emerald-700">{info}</div> : null}

      {accesoOpen ? (
        <form
          onSubmit={crearAcceso}
          className="mt-2 w-full max-w-md rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Crear acceso al portal de referidos
          </div>
          <div className="space-y-2">
            <input
              type="email"
              required
              placeholder="Email"
              value={accesoEmail}
              onChange={(e) => setAccesoEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
            <input
              type="password"
              required
              minLength={8}
              placeholder="Contraseña (mín. 8 caracteres)"
              value={accesoPass1}
              onChange={(e) => setAccesoPass1(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
            <input
              type="password"
              required
              minLength={8}
              placeholder="Confirmar contraseña"
              value={accesoPass2}
              onChange={(e) => setAccesoPass2(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={busy === "acceso"}
                className="inline-flex items-center rounded-xl bg-[#4FAEB2] px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-[#3F8E91] disabled:opacity-60"
              >
                {busy === "acceso" ? "Creando…" : "Crear acceso"}
              </button>
              <button
                type="button"
                onClick={() => setAccesoOpen(false)}
                className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </form>
      ) : null}
    </div>
  );
}
