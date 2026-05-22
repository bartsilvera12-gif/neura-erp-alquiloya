"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

type BootContextValue = {
  /** El Sidebar terminó de cargar los módulos del usuario. */
  sidebarReady: boolean;
  /** Marca el sidebar como listo (idempotente: solo dispara la primera vez). */
  markSidebarReady: () => void;
};

const BootContext = createContext<BootContextValue>({
  sidebarReady: false,
  markSidebarReady: () => {},
});

/**
 * Provider de señales de arranque del shell. Permite al AuthGuard mantener
 * la pantalla de carga visible hasta que el Sidebar haya completado su
 * fetch de módulos, evitando el flash donde el sidebar aparece vacío.
 */
export function BootProvider({ children }: { children: React.ReactNode }) {
  const [sidebarReady, setSidebarReady] = useState(false);
  /** Una sola vez: una vez ready, no volvemos al loader en navegaciones internas. */
  const marked = useRef(false);

  const markSidebarReady = useCallback(() => {
    if (marked.current) return;
    marked.current = true;
    setSidebarReady(true);
  }, []);

  return (
    <BootContext.Provider value={{ sidebarReady, markSidebarReady }}>
      {children}
    </BootContext.Provider>
  );
}

export function useBoot() {
  return useContext(BootContext);
}
