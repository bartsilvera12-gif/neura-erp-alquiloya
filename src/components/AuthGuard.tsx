"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { fetchWithSupabaseSession } from "@/lib/api/fetch-with-supabase-session";
import { cachedSessionFetch } from "@/lib/api/cached-session-fetch";
import { getCurrentUser, getSession } from "@/lib/auth";
import { isBootstrapSuperAdminEmail } from "@/lib/auth/super-admin-bootstrap-email";
import {
  firstAccessibleHref,
  isModuleSlugGranted,
  pathRequiresModuleSlug,
} from "@/lib/modulos/route-slug-map";
import ZentraLoader from "@/components/ZentraLoader";
import { BootProvider, useBoot } from "@/components/BootContext";

const PUBLIC_ROUTES = [
  "/login",
  "/portal-agentes/login",
  "/portal-referidos",
  "/portal-referidos/login",
  "/portal-referidos/dashboard",
];

type ModuleAccess = { superAdmin: boolean; slugs: Set<string> };

function AuthGuardInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { sidebarReady } = useBoot();
  const [loading, setLoading] = useState(true);
  const [access, setAccess] = useState<ModuleAccess | null>(null);

  const isPublic = useMemo(
    () => !!(pathname && PUBLIC_ROUTES.includes(pathname)),
    [pathname]
  );

  useEffect(() => {
    if (isPublic) {
      setLoading(false);
      setAccess(null);
      return;
    }

    let cancelled = false;

    async function checkAuthAndModules() {
      setLoading(true);
      const session = await getSession();
      if (cancelled) return;
      if (!session) {
        router.push("/login");
        setLoading(false);
        return;
      }

      let superAdmin = false;
      let slugs: string[] = [];

      const bootstrapSuper = isBootstrapSuperAdminEmail(session.user.email ?? null);

      try {
        const data = await cachedSessionFetch<{
          superAdmin?: boolean;
          slugs?: string[];
        }>("/api/empresas/module-access", 5 * 60 * 1000);
        if (cancelled) return;
        superAdmin = !!data.superAdmin || bootstrapSuper;
        slugs = Array.isArray(data.slugs) ? data.slugs : [];
      } catch {
        if (cancelled) return;
        superAdmin = bootstrapSuper;
      }

      let userRol = "";
      if (!superAdmin) {
        try {
          const cu = await getCurrentUser();
          userRol = (cu?.rol ?? "").trim().toLowerCase();
          if (userRol === "super_admin") superAdmin = true;
        } catch {
          /* sin fila usuarios en cliente */
        }
      }

      // GUARD CRITICO: publicadores (portal externo) NUNCA entran al ERP.
      // Independiente de los slugs que tengan, los mandamos a su portal.
      // NUNCA aplicamos esto si el usuario es superAdmin: por defensa contra
      // datos corruptos / lecturas obsoletas de getCurrentUser.
      const esPublicador = userRol === "publicador" || userRol.startsWith("publicador-");
      if (esPublicador && !superAdmin && !cancelled) {
        router.replace("/publico#admin-agent");
        setLoading(false);
        return;
      }

      // GUARD CRITICO: referidos del programa tampoco entran al ERP — tienen
      // su propio panel en /portal-referidos/dashboard.
      const esReferido =
        userRol === "referido" ||
        userRol === "referido_partner" ||
        userRol.startsWith("referido-");
      if (esReferido && !superAdmin && !cancelled) {
        router.replace("/portal-referidos/dashboard");
        setLoading(false);
        return;
      }

      setAccess({
        superAdmin,
        slugs: new Set(slugs),
      });
      setLoading(false);
    }

    checkAuthAndModules();
    return () => {
      cancelled = true;
    };
  }, [isPublic, router]);

  useEffect(() => {
    if (loading || isPublic || !access || !pathname) return;

    if (pathname.startsWith("/admin") && !access.superAdmin) {
      router.replace(firstAccessibleHref(access.slugs, { superAdmin: false }));
      return;
    }

    const slug = pathRequiresModuleSlug(pathname);
    if (slug && !access.superAdmin && !isModuleSlugGranted(slug, access.slugs)) {
      const dest = firstAccessibleHref(access.slugs, { superAdmin: access.superAdmin });
      if (dest !== pathname.split("?")[0]) router.replace(dest);
    }
  }, [pathname, access, loading, isPublic, router]);

  /**
   * El loader queda visible mientras se chequea sesión (loading) o mientras el
   * sidebar termina de cargar su menú (sidebarReady). El AppShell se renderiza
   * debajo desde el primer momento para que el Sidebar pueda hacer su fetch.
   */
  const showLoader = !isPublic && (loading || !sidebarReady);

  return (
    <>
      {/* Renderizamos los children inmediatamente para que el Sidebar pueda fetch */}
      {(!loading || isPublic) && children}
      {showLoader ? <ZentraLoader overlay /> : null}
    </>
  );
}

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  return (
    <BootProvider>
      <AuthGuardInner>{children}</AuthGuardInner>
    </BootProvider>
  );
}
