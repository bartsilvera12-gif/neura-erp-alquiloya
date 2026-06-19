"use client";

import Link from "next/link";
import { useState } from "react";
import { signIn } from "@/lib/auth";
import PasswordInput from "@/components/ui/PasswordInput";

/**
 * Login independiente para agentes/publicadores de AlquiloYa.
 * NO es el /login del ERP (sin branding Zentra, sin sidebar, sin redirect a dashboard).
 *
 * Tras autenticar:
 *   - llama /api/agente/me con la sesión recién creada
 *   - si la cuenta está vinculada a un agente/propietario: full-page navigate a /publico#admin-agent
 *   - si no: cierra sesión y muestra "Esta cuenta no está vinculada a un agente o propietario."
 */
export default function PortalAgentesLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recoverOpen, setRecoverOpen] = useState(false);
  const [recoverEmail, setRecoverEmail] = useState("");
  const [recoverLoading, setRecoverLoading] = useState(false);
  const [recoverMsg, setRecoverMsg] = useState<string | null>(null);

  async function handleRecoverSubmit(e: React.FormEvent) {
    e.preventDefault();
    setRecoverMsg(null);
    setRecoverLoading(true);
    try {
      const res = await fetch("/api/public/alquiloya/portal-agentes/recuperar-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: recoverEmail.trim().toLowerCase() }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      setRecoverMsg(
        data.message ??
          "Si el email esta registrado, te enviamos una nueva contrasena. Revisa tu bandeja (y spam)."
      );
    } catch {
      setRecoverMsg(
        "Si el email esta registrado, te enviamos una nueva contrasena. Revisa tu bandeja (y spam)."
      );
    } finally {
      setRecoverLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error: authError } = await signIn(email, password);
      if (authError) {
        const msg = authError.message || "";
        if (/invalid login credentials|invalid_credentials/i.test(msg)) {
          setError("Credenciales incorrectas. Verificá tu email y contraseña.");
        } else if (/email not confirmed/i.test(msg)) {
          setError("Tu email no está confirmado. Contactá al equipo de AlquiloYa.");
        } else {
          setError(msg || "No pudimos iniciar sesión. Intentá de nuevo.");
        }
        setLoading(false);
        return;
      }

      // Validar vínculo agente/propietario antes de mandarlo al panel.
      // Probamos primero propietario, luego agente.
      const meProp = await fetch("/api/propietario/me", { cache: "no-store", credentials: "include" });
      if (meProp.ok) {
        const bodyP = (await meProp.json().catch(() => ({}))) as {
          success?: boolean;
          propietario?: unknown;
          usuario?: { rol?: string | null } | null;
        };
        const rolP = bodyP?.usuario?.rol ?? "";
        if (bodyP?.success && (bodyP.propietario || /propietario|publicador/i.test(rolP))) {
          window.location.assign("/publico#admin-agent");
          return;
        }
      }
      const me = await fetch("/api/agente/me", { cache: "no-store", credentials: "include" });
      if (me.ok) {
        const body = (await me.json().catch(() => ({}))) as {
          success?: boolean;
          agente?: unknown;
          usuario?: { rol?: string | null } | null;
        };
        const rol = body?.usuario?.rol ?? "";
        const okPublicador = /publicador|agente|propietario/i.test(rol) || !!body?.agente;
        if (body?.success && okPublicador) {
          window.location.assign("/publico#admin-agent");
          return;
        }
      }

      // No vinculado a agente/propietario → cerrar sesión local y avisar.
      try {
        const { signOut } = await import("@/lib/auth");
        await signOut();
      } catch {
        /* ignore */
      }
      setError("Esta cuenta no está vinculada a un agente o propietario.");
      setLoading(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado.");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-dvh w-full bg-gradient-to-b from-[#EAF4FF] via-white to-white px-4 py-10">
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-6">
        <Link href="/publico" className="block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/alquiloya-legacy/assets/logo.png"
            alt="AlquiloYa"
            width={180}
            height={52}
            className="h-auto w-[180px] object-contain"
          />
        </Link>

        <div className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_18px_40px_-18px_rgba(15,23,42,0.25)] sm:p-7">
          <h1 className="text-center text-xl font-bold text-[#0F172A] sm:text-2xl">
            Acceso de agentes y publicadores
          </h1>
          <p className="mt-2 text-center text-sm leading-relaxed text-slate-600">
            Ingresá con tu cuenta para administrar tus propiedades y consultas.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#0F172A]">
                Correo electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@dominio.com"
                required
                autoFocus
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-[#0F172A] shadow-sm focus:border-[#0058A5] focus:outline-none focus:ring-2 focus:ring-[#0058A5]/30"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#0F172A]">
                Contraseña
              </label>
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-[#0F172A] shadow-sm focus:border-[#0058A5] focus:outline-none focus:ring-2 focus:ring-[#0058A5]/30"
              />
            </div>

            {error ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center rounded-full bg-[#0058A5] px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_-6px_rgba(0,88,165,0.5)] transition-colors hover:bg-[#004B8F] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Ingresando…" : "Ingresar"}
            </button>
          </form>

            <div className="mt-3 text-center">
              <button
                type="button"
                onClick={() => { setRecoverEmail(email); setRecoverMsg(null); setRecoverOpen(true); }}
                className="text-xs font-medium text-[#0058A5] underline-offset-4 hover:underline"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>
        </div>

        <Link
          href="/portal-agentes"
          className="text-sm text-slate-500 underline-offset-4 hover:text-[#0058A5] hover:underline"
        >
          ← Volver
        </Link>
      </div>
      {recoverOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => !recoverLoading && setRecoverOpen(false)} />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200">
            <h2 className="text-lg font-bold text-[#0F172A]">Recuperar contraseña</h2>
            <p className="mt-1 text-sm text-slate-600">
              Ingresá tu email. Si está registrado como agente o publicador, te enviamos una nueva contraseña temporal por correo.
            </p>
            <form onSubmit={handleRecoverSubmit} className="mt-4 space-y-3">
              <input
                type="email"
                required
                value={recoverEmail}
                onChange={(e) => setRecoverEmail(e.target.value)}
                placeholder="tu@email.com"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-[#0F172A] shadow-sm focus:border-[#0058A5] focus:outline-none focus:ring-2 focus:ring-[#0058A5]/30"
              />
              {recoverMsg ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-700">
                  {recoverMsg}
                </div>
              ) : null}
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  disabled={recoverLoading}
                  onClick={() => setRecoverOpen(false)}
                  className="rounded-lg bg-slate-100 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-60"
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  disabled={recoverLoading}
                  className="rounded-lg bg-[#0058A5] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#004B8F] disabled:opacity-60"
                >
                  {recoverLoading ? "Enviando…" : "Enviar nueva contraseña"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}
