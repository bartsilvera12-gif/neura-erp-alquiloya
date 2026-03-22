"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getTodasMarketingTasks } from "@/lib/marketing/storage";
import { getClientes, clienteNombre } from "@/lib/clientes/storage";
import { getUsuariosActivosEmpresa } from "@/lib/usuarios/empresa";
import type { MarketingTask } from "@/lib/marketing/types";

function formatFecha(str: string) {
  if (!str) return "—";
  try {
    const [y, m, d] = str.split("-");
    return `${d}/${m}/${y}`;
  } catch {
    return str;
  }
}

const ESTADO_CLS: Record<string, string> = {
  pendiente:   "bg-gray-100 text-gray-700",
  en_proceso:  "bg-blue-100 text-blue-700",
  en_revision: "bg-amber-100 text-amber-700",
  aprobado:    "bg-green-100 text-green-700",
  publicado:   "bg-emerald-100 text-emerald-700",
};

function TaskRow({
  tarea,
  clienteNombre: nombre,
  usuarioNombre,
}: {
  tarea: MarketingTask;
  clienteNombre: string;
  usuarioNombre: string;
}) {
  const hoy = new Date().toISOString().slice(0, 10);
  const atrasada = tarea.fecha_entrega < hoy && !["publicado", "aprobado"].includes(tarea.estado);

  return (
    <tr className={`hover:bg-slate-50 ${atrasada ? "bg-red-50/50" : ""}`}>
      <td className="px-4 py-3 font-medium text-slate-800">
        {tarea.titulo}
        {atrasada && <span className="ml-1.5 text-xs text-red-600 font-medium">(atrasada)</span>}
      </td>
      <td className="px-4 py-3 text-slate-600 capitalize">{tarea.tipo_contenido}</td>
      <td className="px-4 py-3">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ESTADO_CLS[tarea.estado] ?? "bg-gray-100"}`}>
          {tarea.estado.replace("_", " ")}
        </span>
      </td>
      <td className="px-4 py-3 text-slate-600">{formatFecha(tarea.fecha_entrega)}</td>
      <td className="px-4 py-3 text-slate-600">{nombre}</td>
      <td className="px-4 py-3 text-slate-600">{usuarioNombre || "—"}</td>
      <td className="px-4 py-3">
        <Link
          href={`/clientes/${tarea.cliente_id}`}
          className="text-xs text-[#0EA5E9] hover:underline"
        >
          Ver cliente
        </Link>
      </td>
    </tr>
  );
}

export default function MarketingOpsPage() {
  const [tareas, setTareas] = useState<MarketingTask[]>([]);
  const [clientes, setClientes] = useState<Awaited<ReturnType<typeof getClientes>>>([]);
  const [usuarios, setUsuarios] = useState<Awaited<ReturnType<typeof getUsuariosActivosEmpresa>>>([]);
  const [cargando, setCargando] = useState(true);
  const [agruparPor, setAgruparPor] = useState<"cliente" | "fecha">("fecha");

  useEffect(() => {
    Promise.all([
      getTodasMarketingTasks(),
      getClientes(),
      getUsuariosActivosEmpresa(),
    ])
      .then(([t, c, u]) => {
        setTareas(t);
        setClientes(c);
        setUsuarios(u);
      })
      .catch(() => {})
      .finally(() => setCargando(false));
  }, []);

  const clienteMap = useMemo(() => {
    const m = new Map<string, string>();
    clientes.forEach((c) => m.set(c.id, clienteNombre(c)));
    return m;
  }, [clientes]);

  const usuarioMap = useMemo(() => {
    const m = new Map<string, string>();
    usuarios.forEach((u) => m.set(u.id, u.nombre ?? u.email));
    return m;
  }, [usuarios]);

  const hoy = new Date().toISOString().slice(0, 10);

  const { hoy: tareasHoy, atrasadas, proximas } = useMemo(() => {
    const hoyList: MarketingTask[] = [];
    const atrasadasList: MarketingTask[] = [];
    const proximasList: MarketingTask[] = [];
    for (const t of tareas) {
      if (t.fecha_entrega === hoy) {
        hoyList.push(t);
      } else if (t.fecha_entrega < hoy && !["publicado", "aprobado"].includes(t.estado)) {
        atrasadasList.push(t);
      } else if (t.fecha_entrega > hoy) {
        proximasList.push(t);
      }
    }
    return { hoy: hoyList, atrasadas: atrasadasList, proximas: proximasList };
  }, [tareas, hoy]);

  if (cargando) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-800">Marketing Ops</h1>
        <div className="py-16 text-center text-gray-400 text-sm animate-pulse">Cargando tareas…</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Marketing Ops</h1>
          <p className="text-gray-500 text-sm mt-1">
            Tareas de contenido para clientes marketing
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Agrupar por:</span>
          <button
            type="button"
            onClick={() => setAgruparPor("fecha")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
              agruparPor === "fecha" ? "bg-[#0EA5E9] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Fecha
          </button>
          <button
            type="button"
            onClick={() => setAgruparPor("cliente")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
              agruparPor === "cliente" ? "bg-[#0EA5E9] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Cliente
          </button>
        </div>
      </div>

      {tareas.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 py-16 text-center">
          <p className="text-4xl mb-3">📣</p>
          <p className="font-medium text-gray-600">No hay tareas de marketing</p>
          <p className="text-sm text-gray-400 mt-1">
            Las tareas aparecen cuando tengas clientes con tipo de servicio &quot;marketing&quot; y estado activo
          </p>
          <Link href="/clientes" className="mt-4 inline-block text-sm text-[#0EA5E9] hover:underline">
            Ir a Clientes
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {agruparPor === "fecha" ? (
            <>
              {atrasadas.length > 0 && (
                <section className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                  <h2 className="bg-red-50 border-b border-red-100 px-5 py-3 text-sm font-semibold text-red-800">
                    Tareas atrasadas ({atrasadas.length})
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          {["Título", "Tipo", "Estado", "Fecha entrega", "Cliente", "Responsable", ""].map((h) => (
                            <th key={h} className="text-left text-xs font-semibold text-slate-600 px-4 py-3">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {atrasadas.map((t) => (
                          <TaskRow
                            key={t.id}
                            tarea={t}
                            clienteNombre={clienteMap.get(t.cliente_id) ?? "—"}
                            usuarioNombre={t.responsable_user_id ? usuarioMap.get(t.responsable_user_id) ?? "—" : "—"}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {tareasHoy.length > 0 && (
                <section className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                  <h2 className="bg-amber-50 border-b border-amber-100 px-5 py-3 text-sm font-semibold text-amber-800">
                    Tareas de hoy ({tareasHoy.length})
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          {["Título", "Tipo", "Estado", "Fecha entrega", "Cliente", "Responsable", ""].map((h) => (
                            <th key={h} className="text-left text-xs font-semibold text-slate-600 px-4 py-3">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {tareasHoy.map((t) => (
                          <TaskRow
                            key={t.id}
                            tarea={t}
                            clienteNombre={clienteMap.get(t.cliente_id) ?? "—"}
                            usuarioNombre={t.responsable_user_id ? usuarioMap.get(t.responsable_user_id) ?? "—" : "—"}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {proximas.length > 0 && (
                <section className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                  <h2 className="bg-slate-50 border-b border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700">
                    Próximas tareas ({proximas.length})
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          {["Título", "Tipo", "Estado", "Fecha entrega", "Cliente", "Responsable", ""].map((h) => (
                            <th key={h} className="text-left text-xs font-semibold text-slate-600 px-4 py-3">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {proximas.map((t) => (
                          <TaskRow
                            key={t.id}
                            tarea={t}
                            clienteNombre={clienteMap.get(t.cliente_id) ?? "—"}
                            usuarioNombre={t.responsable_user_id ? usuarioMap.get(t.responsable_user_id) ?? "—" : "—"}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </>
          ) : (
            <section className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      {["Título", "Tipo", "Estado", "Fecha entrega", "Cliente", "Responsable", ""].map((h) => (
                        <th key={h} className="text-left text-xs font-semibold text-slate-600 px-4 py-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {tareas.map((t) => (
                      <TaskRow
                        key={t.id}
                        tarea={t}
                        clienteNombre={clienteMap.get(t.cliente_id) ?? "—"}
                        usuarioNombre={t.responsable_user_id ? usuarioMap.get(t.responsable_user_id) ?? "—" : "—"}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
