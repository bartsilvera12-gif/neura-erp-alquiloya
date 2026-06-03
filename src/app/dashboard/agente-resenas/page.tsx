import { listErpAgenteResenas, type ErpAgenteResena } from "@/lib/alquiloya/erp-agente-resenas";
import AgenteResenasClient from "./AgenteResenasClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AgenteResenasPage() {
  let rows: ErpAgenteResena[] = [];
  let loadError: string | null = null;
  try {
    rows = await listErpAgenteResenas();
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Error";
    console.error("[dashboard/agente-resenas] load", e);
  }

  return (
    <div className="px-6 py-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Reseñas de agentes</h1>
        <p className="mt-1 text-sm text-slate-500">
          Aprobá o rechazá las reseñas que escriben los visitantes. Sólo las aprobadas se ven en la web pública.
        </p>
      </header>
      {loadError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          No se pudieron cargar las reseñas: {loadError}
        </div>
      ) : (
        <AgenteResenasClient initial={rows} />
      )}
    </div>
  );
}
