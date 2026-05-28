"use client";

import { useState } from "react";
import type {
  ErpAgenteInmobiliarioRow,
  ErpPropietarioRow,
} from "@/lib/alquiloya/erp-agentes-inmobiliarios";

type Tab = "agentes" | "propietarios";

function Badge({ on, label }: { on: boolean | null; label: string }) {
  const isOn = !!on;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide ${
        isOn
          ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200"
          : "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
      }`}
    >
      {label}
    </span>
  );
}

export function AgentesInmobiliariosClient({
  agentes,
  propietarios,
  agentesError,
  propietariosError,
}: {
  agentes: ErpAgenteInmobiliarioRow[];
  propietarios: ErpPropietarioRow[];
  agentesError: string | null;
  propietariosError: string | null;
}) {
  const [tab, setTab] = useState<Tab>("agentes");

  return (
    <div>
      <div className="mb-4 border-b border-slate-200">
        <nav className="-mb-px flex gap-1" aria-label="Pestañas">
          <TabButton active={tab === "agentes"} onClick={() => setTab("agentes")}>
            Agentes inmobiliarios
            <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
              {agentes.length}
            </span>
          </TabButton>
          <TabButton active={tab === "propietarios"} onClick={() => setTab("propietarios")}>
            Propietarios
            <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
              {propietarios.length}
            </span>
          </TabButton>
        </nav>
      </div>

      {tab === "agentes" ? (
        <AgentesTab rows={agentes} error={agentesError} />
      ) : (
        <PropietariosTab rows={propietarios} error={propietariosError} />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
        active
          ? "border-[#4FAEB2] text-[#3F8E91]"
          : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
      }`}
    >
      {children}
    </button>
  );
}

function AgentesTab({
  rows,
  error,
}: {
  rows: ErpAgenteInmobiliarioRow[];
  error: string | null;
}) {
  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
        No se pudieron cargar los agentes: {error}
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
        No hay agentes inmobiliarios cargados todavía.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          <tr>
            <th className="px-3 py-2.5">Agente</th>
            <th className="px-3 py-2.5">Cargo</th>
            <th className="px-3 py-2.5">Teléfono</th>
            <th className="px-3 py-2.5">Email</th>
            <th className="px-3 py-2.5 text-center">Propiedades</th>
            <th className="px-3 py-2.5">Activo</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((a) => (
            <tr key={a.id} className="hover:bg-slate-50">
              <td className="px-3 py-2">
                <div className="flex items-center gap-2.5">
                  {a.foto_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={a.foto_url}
                      alt={a.nombre ?? ""}
                      className="h-8 w-8 rounded-full object-cover ring-1 ring-slate-200"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-500">
                      {(a.nombre ?? "?").slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="font-medium text-slate-900">{a.nombre ?? "—"}</div>
                </div>
              </td>
              <td className="px-3 py-2 text-slate-700">{a.cargo ?? "—"}</td>
              <td className="px-3 py-2 text-slate-700">{a.telefono ?? a.whatsapp ?? "—"}</td>
              <td className="px-3 py-2 text-slate-700">{a.email ?? "—"}</td>
              <td className="px-3 py-2 text-center text-slate-700 tabular-nums">
                {a.propiedades_count}
              </td>
              <td className="px-3 py-2">
                <Badge on={a.activo} label={a.activo ? "Sí" : "No"} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PropietariosTab({
  rows,
  error,
}: {
  rows: ErpPropietarioRow[];
  error: string | null;
}) {
  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
        No se pudieron cargar los propietarios: {error}
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
        Todavía no hay propietarios registrados. Cuando se carguen propietarios
        externos (alquiloya.propietarios) aparecerán acá.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          <tr>
            <th className="px-3 py-2.5">Nombre</th>
            <th className="px-3 py-2.5">Tipo</th>
            <th className="px-3 py-2.5">Documento</th>
            <th className="px-3 py-2.5">Teléfono</th>
            <th className="px-3 py-2.5">Email</th>
            <th className="px-3 py-2.5">Estado</th>
            <th className="px-3 py-2.5">Activo</th>
            <th className="px-3 py-2.5">Usuario</th>
            <th className="px-3 py-2.5">Plan</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((p) => (
            <tr key={p.id} className="hover:bg-slate-50">
              <td className="px-3 py-2 font-medium text-slate-900">{p.nombre}</td>
              <td className="px-3 py-2 text-slate-700">{p.tipo_persona ?? "—"}</td>
              <td className="px-3 py-2 text-slate-700">{p.documento ?? "—"}</td>
              <td className="px-3 py-2 text-slate-700">{p.telefono ?? "—"}</td>
              <td className="px-3 py-2 text-slate-700">{p.email ?? "—"}</td>
              <td className="px-3 py-2 text-slate-700">{p.estado ?? "—"}</td>
              <td className="px-3 py-2">
                <Badge on={p.activo} label={p.activo ? "Sí" : "No"} />
              </td>
              <td className="px-3 py-2 text-slate-500">
                {p.usuario_id ? <span className="text-emerald-700">vinculado</span> : "—"}
              </td>
              <td className="px-3 py-2 text-slate-500">
                {p.plan_publicacion_id ? <span className="text-emerald-700">asignado</span> : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
