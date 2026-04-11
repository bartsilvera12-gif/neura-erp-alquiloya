"use client";

import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";

type ConfigCollapsibleSectionProps = {
  title: string;
  description?: string;
  /** Si true, el panel inicia abierto */
  defaultOpen?: boolean;
  children: React.ReactNode;
};

/**
 * Sección colapsable para pantallas de configuración (acordeón simple).
 */
export function ConfigCollapsibleSection({
  title,
  description,
  defaultOpen = false,
  children,
}: ConfigCollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  const btnId = useId();

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <button
        id={btnId}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start gap-3 px-4 py-3.5 text-left hover:bg-slate-50/80 transition-colors"
      >
        <span
          className={`mt-0.5 shrink-0 text-slate-400 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        >
          <ChevronDown className="h-5 w-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-slate-800">{title}</span>
          {description ? (
            <span className="mt-0.5 block text-xs text-slate-500 leading-relaxed">{description}</span>
          ) : null}
        </span>
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-slate-400 mt-1">
          {open ? "Abierto" : "Cerrado"}
        </span>
      </button>
      {open ? (
        <div
          id={panelId}
          role="region"
          aria-labelledby={btnId}
          className="border-t border-slate-100 px-4 py-4 bg-slate-50/40"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
