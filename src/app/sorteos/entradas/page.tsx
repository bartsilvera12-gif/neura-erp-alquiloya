import Link from "next/link";
import { fetchSorteoEntradasServer } from "@/lib/sorteos/server-queries";

export const dynamic = "force-dynamic";

function formatGs(n: number) {
  return `${n.toLocaleString("es-PY")} ₲`;
}

function formatFecha(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-PY", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function estadoPagoLabel(e: string) {
  if (e === "pendiente_revision") return "Pendiente revisión";
  if (e === "pendiente") return "Pendiente";
  if (e === "confirmado") return "Confirmado";
  if (e === "rechazado") return "Rechazado";
  return e;
}

export default async function SorteoEntradasPage() {
  const { data: rows, error: queryError } = await fetchSorteoEntradasServer();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-800">Entradas</h1>
        <p className="text-gray-500 text-sm mt-1">Compras registradas por participante</p>
      </div>

      <nav className="flex flex-wrap gap-2 text-sm border-b border-slate-200 pb-3">
        <Link href="/sorteos" className="text-slate-600 hover:text-[#0EA5E9]">
          Sorteos
        </Link>
        <span className="font-semibold text-[#0EA5E9]">Entradas</span>
        <Link href="/sorteos/cupones" className="text-slate-600 hover:text-[#0EA5E9]">
          Cupones
        </Link>
      </nav>

      {queryError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <strong>Error al cargar entradas:</strong> {queryError}
        </div>
      ) : null}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        {rows.length === 0 && !queryError ? (
          <div className="py-16 text-center text-gray-400 text-sm">No hay entradas</div>
        ) : rows.length === 0 ? null : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left text-sm font-semibold text-slate-600 px-5 py-3">Nº orden</th>
                  <th className="text-left text-sm font-semibold text-slate-600 px-5 py-3">Sorteo</th>
                  <th className="text-left text-sm font-semibold text-slate-600 px-5 py-3">Participante</th>
                  <th className="text-left text-sm font-semibold text-slate-600 px-5 py-3">Documento</th>
                  <th className="text-right text-sm font-semibold text-slate-600 px-5 py-3">Cant.</th>
                  <th className="text-right text-sm font-semibold text-slate-600 px-5 py-3">Monto</th>
                  <th className="text-left text-sm font-semibold text-slate-600 px-5 py-3">Pago</th>
                  <th className="text-left text-sm font-semibold text-slate-600 px-5 py-3">Fecha pago</th>
                  <th className="text-left text-sm font-semibold text-slate-600 px-5 py-3">Validado</th>
                  <th className="text-left text-sm font-semibold text-slate-600 px-5 py-3">Creado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80">
                    <td className="px-5 py-3 text-sm font-mono font-semibold text-slate-800">
                      {typeof r.numero_orden === "number" ? r.numero_orden : "—"}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-800">
                      {(r.sorteos as { nombre?: string } | undefined)?.nombre ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-sm">{r.nombre_participante}</td>
                    <td className="px-5 py-3 text-sm font-mono text-slate-600">{r.documento ?? "—"}</td>
                    <td className="px-5 py-3 text-sm text-right tabular-nums">{r.cantidad_boletos}</td>
                    <td className="px-5 py-3 text-sm text-right tabular-nums">{formatGs(r.monto_total)}</td>
                    <td className="px-5 py-3 text-sm">{estadoPagoLabel(r.estado_pago)}</td>
                    <td className="px-5 py-3 text-sm whitespace-nowrap">{formatFecha(r.fecha_pago)}</td>
                    <td className="px-5 py-3 text-sm">{r.validado_por ?? "—"}</td>
                    <td className="px-5 py-3 text-sm whitespace-nowrap">{formatFecha(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
