"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type Canal = "instagram" | "tiktok" | "whatsapp" | "web" | "otro";

const CANALES: { value: Canal; label: string }[] = [
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "web", label: "Web / blog" },
  { value: "otro", label: "Otro" },
];

export default function PortalReferidosLandingClient() {
  return (
    <Suspense fallback={null}>
      <PortalReferidosLandingInner />
    </Suspense>
  );
}

function PortalReferidosLandingInner() {
  const searchParams = useSearchParams();
  // Si vienen desde /portal-referidos/login -> "Solicitar credenciales" con
  // ?solicitar=1, abrimos directo el form sin pasar por la landing.
  const initialMode: "landing" | "form" | "sent" =
    searchParams?.get("solicitar") === "1" ? "form" : "landing";
  const [mode, setMode] = useState<"landing" | "form" | "sent">(initialMode);

  // Si cambia el query param mientras estamos en la pagina, sincronizamos.
  useEffect(() => {
    if (searchParams?.get("solicitar") === "1" && mode === "landing") {
      setMode("form");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [canal, setCanal] = useState<Canal>("instagram");
  const [mensaje, setMensaje] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!nombre.trim()) { setError("Ingresá tu nombre."); return; }
    if (!email.trim() && !telefono.trim()) {
      setError("Ingresá al menos email o teléfono.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/public/alquiloya/solicitudes-acceso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: "referido_partner",
          sub_tipo: canal,
          nombre: nombre.trim(),
          email: email.trim() || null,
          telefono: telefono.trim() || null,
          mensaje: mensaje.trim() || null,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
      };
      if (!res.ok || !json.success) {
        throw new Error(json.error || `HTTP ${res.status}`);
      }
      setMode("sent");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado.");
    } finally {
      setSubmitting(false);
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

        {mode === "landing" ? (
          <div className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_18px_40px_-18px_rgba(15,23,42,0.25)] sm:p-7">
            <h1 className="text-center text-xl font-bold text-[#0F172A] sm:text-2xl">
              Portal de referidos
            </h1>
            <p className="mt-2 text-center text-sm leading-relaxed text-slate-600">
              Seguimiento de tus clicks, conversiones y comisiones del programa AlquiloYa.
            </p>

            <div className="mt-6 flex flex-col gap-3">
              <Link
                href="/portal-referidos/login"
                className="inline-flex w-full items-center justify-center rounded-full bg-[#0058A5] px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_-6px_rgba(0,88,165,0.5)] transition-colors hover:bg-[#004B8F] active:scale-[0.98]"
              >
                Ya tengo cuenta
              </Link>
              <button
                type="button"
                onClick={() => setMode("form")}
                className="inline-flex w-full items-center justify-center rounded-full border border-[#0058A5]/30 bg-white px-5 py-3 text-sm font-semibold text-[#0058A5] transition-colors hover:bg-[#EAF4FF] active:scale-[0.98]"
              >
                Quiero ser referido
              </button>
            </div>
          </div>
        ) : null}

        {mode === "form" ? (
          <div className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_18px_40px_-18px_rgba(15,23,42,0.25)] sm:p-7">
            <h1 className="text-center text-xl font-bold text-[#0F172A] sm:text-2xl">
              {initialMode === "form" ? "Solicitar credenciales" : "Sumate al programa"}
            </h1>
            <p className="mt-2 text-center text-sm leading-relaxed text-slate-600">
              {initialMode === "form"
                ? "Llená el formulario y el equipo de AlquiloYa te envía las credenciales por WhatsApp."
                : "Cuando aprobemos tu solicitud te enviamos tu link único y credenciales por WhatsApp."}
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#0F172A]">Nombre o marca *</label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  required
                  placeholder="Ej. Juan Pérez / Alquileres PY"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-[#0F172A] shadow-sm focus:border-[#0058A5] focus:outline-none focus:ring-2 focus:ring-[#0058A5]/30"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#0F172A]">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@dominio.com"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-[#0F172A] shadow-sm focus:border-[#0058A5] focus:outline-none focus:ring-2 focus:ring-[#0058A5]/30"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#0F172A]">WhatsApp</label>
                <input
                  type="tel"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  placeholder="0981 000 000"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-[#0F172A] shadow-sm focus:border-[#0058A5] focus:outline-none focus:ring-2 focus:ring-[#0058A5]/30"
                />
                <p className="mt-1 text-[11px] text-slate-500">Ingresá al menos email o WhatsApp.</p>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#0F172A]">¿Por dónde difundís?</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {CANALES.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setCanal(c.value)}
                      className={`rounded-lg border px-2 py-1.5 text-xs font-semibold transition-colors ${
                        canal === c.value
                          ? "border-[#0058A5] bg-[#0058A5] text-white"
                          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#0F172A]">Mensaje (opcional)</label>
                <textarea
                  value={mensaje}
                  onChange={(e) => setMensaje(e.target.value)}
                  rows={3}
                  placeholder="Contanos tu audiencia, redes, etc."
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-[#0F172A] shadow-sm focus:border-[#0058A5] focus:outline-none focus:ring-2 focus:ring-[#0058A5]/30"
                />
              </div>
              {error ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
                  {error}
                </div>
              ) : null}
              <div className="flex flex-col gap-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex w-full items-center justify-center rounded-full bg-[#0058A5] px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_-6px_rgba(0,88,165,0.5)] transition-colors hover:bg-[#004B8F] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? "Enviando…" : "Enviar solicitud"}
                </button>
                <button
                  type="button"
                  onClick={() => setMode("landing")}
                  className="text-xs text-slate-500 underline-offset-4 hover:text-[#0058A5] hover:underline"
                >
                  ← Volver
                </button>
              </div>
            </form>
          </div>
        ) : null}

        {mode === "sent" ? (
          <div className="w-full rounded-2xl border border-emerald-200 bg-white p-6 shadow-[0_18px_40px_-18px_rgba(15,23,42,0.25)] sm:p-7">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 className="text-center text-lg font-bold text-[#0F172A]">¡Solicitud recibida!</h2>
            <p className="mt-2 text-center text-sm leading-relaxed text-slate-600">
              Vamos a revisarla y te contactamos por WhatsApp con tu link único y credenciales para entrar al portal.
            </p>
            <Link
              href="/publico"
              className="mt-5 inline-flex w-full items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Volver al inicio
            </Link>
          </div>
        ) : null}

        {mode !== "sent" ? (
          <Link
            href="/publico"
            className="text-sm text-slate-500 underline-offset-4 hover:text-[#0058A5] hover:underline"
          >
            ← Volver al inicio
          </Link>
        ) : null}
      </div>
    </main>
  );
}
