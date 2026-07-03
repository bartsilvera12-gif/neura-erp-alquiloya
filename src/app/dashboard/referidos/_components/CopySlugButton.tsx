"use client";

import { useState } from "react";

/**
 * Botón compacto para copiar el link público de un slug.
 * Construye la URL en cliente (window.location.origin) para que funcione
 * tanto en prod como en dev sin hardcode de host.
 */
export function CopySlugButton({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const url = `https://alquiloya.com.py/r/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
      title="Copiar link público"
    >
      {copied ? "✓ Copiado" : "Copiar"}
    </button>
  );
}
