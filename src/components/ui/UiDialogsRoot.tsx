"use client";

/**
 * Root mounteado una vez en RootLayout: renderiza el modal de confirm y los
 * toasts que dispara `@/lib/ui/dialogs`. Sin context — usa un singleton para
 * que se pueda llamar desde cualquier handler sin re-renders.
 */

import { useEffect, useState, useCallback } from "react";
import {
  __registerDialogListener,
  type ConfirmDialogOptions,
  type NotifyOptions,
  type DialogTone,
} from "@/lib/ui/dialogs";

type ConfirmState = (ConfirmDialogOptions & { resolve: (v: boolean) => void }) | null;
type ToastState = NotifyOptions & { id: number };

function toneClasses(tone: DialogTone | undefined): {
  iconBg: string;
  iconColor: string;
  ring: string;
  primaryBtn: string;
  icon: React.ReactNode;
} {
  switch (tone) {
    case "danger":
      return {
        iconBg: "bg-rose-100",
        iconColor: "text-rose-600",
        ring: "ring-rose-100",
        primaryBtn: "bg-rose-600 hover:bg-rose-700 focus-visible:ring-rose-400",
        icon: (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <line x1="10" y1="11" x2="10" y2="17" />
            <line x1="14" y1="11" x2="14" y2="17" />
          </svg>
        ),
      };
    case "warning":
      return {
        iconBg: "bg-amber-100",
        iconColor: "text-amber-600",
        ring: "ring-amber-100",
        primaryBtn: "bg-amber-500 hover:bg-amber-600 focus-visible:ring-amber-400",
        icon: (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        ),
      };
    case "success":
      return {
        iconBg: "bg-emerald-100",
        iconColor: "text-emerald-600",
        ring: "ring-emerald-100",
        primaryBtn: "bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-emerald-400",
        icon: (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ),
      };
    default:
      return {
        iconBg: "bg-[#E6F4F5]",
        iconColor: "text-[#4FAEB2]",
        ring: "ring-[#4FAEB2]/20",
        primaryBtn: "bg-[#4FAEB2] hover:bg-[#3F8E91] focus-visible:ring-[#4FAEB2]/50",
        icon: (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        ),
      };
  }
}

export default function UiDialogsRoot() {
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [toasts, setToasts] = useState<ToastState[]>([]);

  useEffect(() => {
    const unregister = __registerDialogListener({
      onConfirm: (req) => {
        setConfirmState({
          title: req.title,
          message: req.message,
          confirmText: req.confirmText,
          cancelText: req.cancelText,
          tone: req.tone,
          resolve: req.__resolve,
        });
      },
      onNotify: (req) => {
        const id = Date.now() + Math.floor(Math.random() * 1000);
        const dur = req.durationMs ?? 3500;
        setToasts((t) => [...t, { ...req, id }]);
        setTimeout(() => {
          setToasts((t) => t.filter((x) => x.id !== id));
        }, dur);
      },
    });
    return unregister;
  }, []);

  const close = useCallback((v: boolean) => {
    if (!confirmState) return;
    confirmState.resolve(v);
    setConfirmState(null);
  }, [confirmState]);

  // ESC para cancelar, Enter para confirmar.
  useEffect(() => {
    if (!confirmState) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        close(false);
      } else if (e.key === "Enter") {
        e.preventDefault();
        close(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmState, close]);

  const styles = toneClasses(confirmState?.tone);

  return (
    <>
      {confirmState ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[9999] flex items-center justify-center px-4 py-6"
        >
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => close(false)}
          />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-slate-200 sm:p-6">
            <div className="flex gap-3 sm:gap-4">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${styles.iconBg} ${styles.iconColor} ring-4 ${styles.ring}`}>
                {styles.icon}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold text-slate-900 sm:text-lg">
                  {confirmState.title}
                </h2>
                {confirmState.message ? (
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                    {confirmState.message}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:mt-6 sm:flex-row sm:justify-end sm:gap-2.5">
              <button
                type="button"
                onClick={() => close(false)}
                className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
              >
                {confirmState.cancelText ?? "Cancelar"}
              </button>
              <button
                type="button"
                onClick={() => close(true)}
                autoFocus
                className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 ${styles.primaryBtn}`}
              >
                {confirmState.confirmText ?? "Aceptar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Toasts */}
      {toasts.length > 0 ? (
        <div className="pointer-events-none fixed bottom-4 right-4 z-[9998] flex w-full max-w-sm flex-col gap-2 sm:bottom-6 sm:right-6">
          {toasts.map((t) => {
            const s = toneClasses(t.tone);
            return (
              <div
                key={t.id}
                className="pointer-events-auto flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-lg ring-1 ring-slate-100"
              >
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${s.iconBg} ${s.iconColor}`}>
                  {s.icon}
                </div>
                <div className="min-w-0 flex-1">
                  {t.title ? (
                    <div className="text-sm font-semibold text-slate-900">{t.title}</div>
                  ) : null}
                  <div className={`${t.title ? "mt-0.5 " : ""}text-sm text-slate-600`}>
                    {t.message}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setToasts((arr) => arr.filter((x) => x.id !== t.id))}
                  className="ml-1 shrink-0 rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Cerrar"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      ) : null}
    </>
  );
}
