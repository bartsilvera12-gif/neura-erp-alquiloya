"use client";

import { useEffect, useRef, useState } from "react";

type Nivel = "administrador" | "supervisor" | "usuario" | string;
type UsuarioLite = { id: number; nombre: string; nivel: Nivel };

const NIVEL_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  administrador: { bg: "bg-rose-100", text: "text-rose-700", label: "Admin" },
  supervisor: { bg: "bg-amber-100", text: "text-amber-800", label: "Supervisor" },
  usuario: { bg: "bg-slate-100", text: "text-slate-700", label: "Usuario" },
};

function initials(nombre: string): string {
  const parts = (nombre || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function rolStyle(nivel: string) {
  return NIVEL_STYLE[nivel] ?? { bg: "bg-slate-100", text: "text-slate-700", label: nivel };
}

function avatarColor(nivel: string): string {
  if (nivel === "administrador") return "bg-gradient-to-br from-rose-400 to-rose-600";
  if (nivel === "supervisor") return "bg-gradient-to-br from-amber-400 to-amber-600";
  return "bg-gradient-to-br from-[#4FAEB2] to-[#3F8E91]";
}

export default function UsuarioSelect({
  usuarios,
  value,
  onChange,
}: {
  usuarios: UsuarioLite[];
  value: number | null;
  onChange: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [focusIdx, setFocusIdx] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const active = usuarios.find((u) => u.id === value) ?? null;

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    setTimeout(() => inputRef.current?.focus(), 50);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? usuarios.filter(
        (u) =>
          u.nombre.toLowerCase().includes(q) || u.nivel.toLowerCase().includes(q)
      )
    : usuarios;

  function pick(id: number) {
    onChange(id);
    setOpen(false);
    setQuery("");
  }

  function onListKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusIdx((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const u = filtered[focusIdx];
      if (u) pick(u.id);
    }
  }

  if (usuarios.length === 0) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`inline-flex h-9 items-center gap-2 rounded-xl border bg-white px-2.5 text-xs font-medium shadow-sm transition-colors ${
          open
            ? "border-[#4FAEB2] ring-2 ring-[#4FAEB2]/20"
            : "border-[#4FAEB2]/45 hover:border-[#4FAEB2]/60"
        }`}
      >
        {active ? (
          <>
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white ${avatarColor(active.nivel)}`}
            >
              {initials(active.nombre)}
            </span>
            <span className="text-slate-800">{active.nombre}</span>
            <span
              className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${rolStyle(active.nivel).bg} ${rolStyle(active.nivel).text}`}
            >
              {rolStyle(active.nivel).label}
            </span>
          </>
        ) : (
          <span className="text-slate-500">Seleccionar usuario…</span>
        )}
        <svg
          className={`h-3.5 w-3.5 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open ? (
        <div
          role="listbox"
          onKeyDown={onListKey}
          className="absolute right-0 z-50 mt-2 max-h-80 w-[260px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl ring-1 ring-slate-100 sm:w-[280px]"
        >
          {usuarios.length > 5 ? (
            <div className="border-b border-slate-100 px-2.5 py-2">
              <div className="relative">
                <svg
                  className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="11" cy="11" r="7" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setFocusIdx(0);
                  }}
                  placeholder="Buscar usuario…"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-7 pr-2 text-xs text-slate-700 focus:border-[#4FAEB2] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#4FAEB2]/20"
                />
              </div>
            </div>
          ) : null}

          <ul className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-4 text-center text-xs text-slate-400">
                Sin coincidencias
              </li>
            ) : (
              filtered.map((u, i) => {
                const isActive = u.id === value;
                const isFocused = i === focusIdx;
                return (
                  <li key={u.id}>
                    <button
                      type="button"
                      onClick={() => pick(u.id)}
                      onMouseEnter={() => setFocusIdx(i)}
                      className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                        isFocused
                          ? "bg-[#4FAEB2]/10"
                          : isActive
                            ? "bg-[#4FAEB2]/5"
                            : "hover:bg-slate-50"
                      }`}
                    >
                      <span
                        className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${avatarColor(u.nivel)}`}
                      >
                        {initials(u.nombre)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-semibold text-slate-800">
                          {u.nombre}
                        </div>
                        <div className="mt-0.5">
                          <span
                            className={`inline-block rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${rolStyle(u.nivel).bg} ${rolStyle(u.nivel).text}`}
                          >
                            {rolStyle(u.nivel).label}
                          </span>
                        </div>
                      </div>
                      {isActive ? (
                        <svg
                          className="h-4 w-4 flex-shrink-0 text-[#3F8E91]"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>

          <div className="border-t border-slate-100 bg-slate-50 px-3 py-2 text-[10px] text-slate-500">
            Ver dashboard como otro usuario
          </div>
        </div>
      ) : null}
    </div>
  );
}
