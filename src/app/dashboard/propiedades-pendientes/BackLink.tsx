"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// Decide a donde lleva el "← Volver". Si el usuario llego aca desde el
// dashboard root ("/"), volvemos al dashboard. En cualquier otro caso (vino
// desde /dashboard/propiedades, desde el sidebar, refrescando, etc.) por
// default volvemos al listado de propiedades. Decision pedida por el cliente:
// solo mostrar "Volver al dashboard" cuando realmente vino de ahi.
export default function BackLink() {
  const [target, setTarget] = useState<"dashboard" | "propiedades">("propiedades");

  useEffect(() => {
    try {
      const ref = document.referrer;
      if (!ref) return;
      const url = new URL(ref, window.location.origin);
      if (url.origin !== window.location.origin) return;
      // Solo si el referrer es exactamente la home del dashboard.
      if (url.pathname === "/" || url.pathname === "") {
        setTarget("dashboard");
      }
    } catch {
      /* ignore */
    }
  }, []);

  const href = target === "dashboard" ? "/" : "/dashboard/propiedades";
  const label = target === "dashboard" ? "Volver al dashboard" : "Volver a propiedades";

  return (
    <Link
      href={href}
      className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-[#3F8E91]"
    >
      ← {label}
    </Link>
  );
}
