// Panel admin de monitoreo de publicaciones sociales (Meta).
// Solo roles admin. Muestra la lista de jobs con filtros + contadores + retry.

import "server-only";
import IntegracionesTable from "./_components/IntegracionesTable";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default function IntegracionesSocialesPage() {
  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: "0 auto" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
          Integraciones sociales · Meta
        </h1>
        <p style={{ color: "#64748b", fontSize: 14 }}>
          Publicaciones automáticas en Facebook / Instagram de propiedades aprobadas.
          El worker corre cada minuto y reintenta con backoff exponencial.
        </p>
      </div>
      <IntegracionesTable />
    </div>
  );
}
