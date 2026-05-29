"use client";

import Link from "next/link";
import { useState } from "react";
import { signIn } from "@/lib/auth";

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
      const me = await fetch("/api/agente/me", {
        cache: "no-store",
        credentials: "include",
      });

      if (me.ok) {
        const body = (await me.json().catch(() => ({}))) as {
          success?: boolean;
          agente?: unknown;
          usuario?: { rol?: string | null } | null;
        };
        // Aceptamos al usuario si tiene agente vinculado o si su rol indica publicador.
        const rol = body?.usuario?.rol ?? "";
        const okPublicador =
          /publicador|agente|propietario/i.test(rol) || !!body?.agente;
        if (body?.success && okPublicador) {
          // Full-page navigate para preservar el hash y disparar el bootstrap del legacy.
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
              <input
                type="password"
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
        </div>

        <Link
          href="/portal-agentes"
          className="text-sm text-slate-500 underline-offset-4 hover:text-[#0058A5] hover:underline"
        >
          ← Volver
        </Link>
      </div>
    </main>
  );
}
