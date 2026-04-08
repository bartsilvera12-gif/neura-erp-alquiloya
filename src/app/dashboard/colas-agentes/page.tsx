"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  countUnassignedOpenConversations,
  fetchSupervisorAgentLoads,
  listChatQueues,
  type ChatQueueListRow,
  type SupervisorAgentLoadRow,
} from "@/lib/chat/chat-ops-actions";

export default function ColasYAgentesPage() {
  const [queues, setQueues] = useState<ChatQueueListRow[]>([]);
  const [agents, setAgents] = useState<SupervisorAgentLoadRow[]>([]);
  const [unassigned, setUnassigned] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [q, a, u] = await Promise.all([
        listChatQueues(),
        fetchSupervisorAgentLoads(),
        countUnassignedOpenConversations(),
      ]);
      setQueues(q);
      setAgents(a);
      setUnassigned(u);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Colas y agentes</h1>
          <p className="text-sm text-slate-500">
            Vista operativa para supervisores: colas, carga por agente y conversaciones sin asignar.
          </p>
        </div>
        <Link
          href="/dashboard/conversaciones"
          className="text-sm font-medium text-[#0EA5E9] hover:underline"
        >
          Ir al inbox
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded-lg px-4 py-2">
          {error}
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">
          Resumen
        </h2>
        {loading ? (
          <p className="text-sm text-slate-400">Cargando…</p>
        ) : (
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
              <p className="text-amber-900/80 text-xs uppercase font-semibold">Sin asignar</p>
              <p className="text-2xl font-bold text-amber-900">{unassigned ?? "—"}</p>
              <p className="text-xs text-amber-800/80 mt-1">
                Conversaciones abiertas o pendientes sin agente (todas las colas).
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3">
              <p className="text-slate-600 text-xs uppercase font-semibold">Colas</p>
              <p className="text-2xl font-bold text-slate-800">{queues.length}</p>
            </div>
            <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3">
              <p className="text-slate-600 text-xs uppercase font-semibold">Agentes</p>
              <p className="text-2xl font-bold text-slate-800">{agents.length}</p>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">
          Colas
        </h2>
        {loading ? (
          <p className="text-sm text-slate-400">Cargando…</p>
        ) : queues.length === 0 ? (
          <p className="text-sm text-slate-500">
            No hay colas configuradas. Crealas en la base de datos (tabla{" "}
            <code className="text-xs bg-slate-100 px-1 rounded">chat_queues</code>) o contactá soporte.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {queues.map((q) => (
              <li key={q.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-800">{q.nombre}</p>
                  <p className="text-xs text-slate-500">
                    {q.channel_type ? `Canal: ${q.channel_type}` : "Todos los canales"} ·{" "}
                    {q.is_active ? (
                      <span className="text-emerald-700">Activa</span>
                    ) : (
                      <span className="text-slate-400">Inactiva</span>
                    )}
                  </p>
                </div>
                <span className="text-xs font-mono text-slate-400">{q.id.slice(0, 8)}…</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">
          Agentes por cola y chats activos
        </h2>
        {loading ? (
          <p className="text-sm text-slate-400">Cargando…</p>
        ) : agents.length === 0 ? (
          <p className="text-sm text-slate-500">
            No hay agentes en <code className="text-xs bg-slate-100 px-1 rounded">chat_agents</code>.
            Cada usuario operador debe tener una fila vinculada a su{" "}
            <code className="text-xs bg-slate-100 px-1 rounded">usuarios.id</code>.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                  <th className="pb-2 pr-3">Cola</th>
                  <th className="pb-2 pr-3">Agente</th>
                  <th className="pb-2 pr-3">En línea</th>
                  <th className="pb-2 pr-3">Máx.</th>
                  <th className="pb-2">Chats activos</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((a) => (
                  <tr key={a.id} className="border-b border-slate-50">
                    <td className="py-2 pr-3 text-slate-600">{a.queue_nombre}</td>
                    <td className="py-2 pr-3">
                      <span className="font-medium text-slate-800">{a.nombre}</span>
                      <span className="block text-xs text-slate-400 truncate max-w-[200px]">
                        {a.email}
                      </span>
                    </td>
                    <td className="py-2 pr-3">
                      {a.is_online ? (
                        <span className="text-emerald-700 text-xs font-semibold">Sí</span>
                      ) : (
                        <span className="text-slate-400 text-xs">No</span>
                      )}
                    </td>
                    <td className="py-2 pr-3">{a.max_conversations}</td>
                    <td className="py-2">
                      <span
                        className={
                          a.active_conversations >= a.max_conversations
                            ? "text-amber-700 font-semibold"
                            : "text-slate-700"
                        }
                      >
                        {a.active_conversations}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
