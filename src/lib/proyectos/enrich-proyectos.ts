import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-admin";
import type { AppSupabaseClient } from "@/lib/supabase/schema";

export type ProyectoEnriquecido = Record<string, unknown> & {
  proyecto_tipo?: { id: string; nombre?: string; codigo?: string } | null;
  proyecto_estado?: {
    id: string;
    nombre?: string;
    codigo?: string;
    color?: string;
    tipo_sla?: string;
    es_estado_final?: boolean;
  } | null;
  cliente?: {
    id: string;
    empresa?: string | null;
    nombre_contacto?: string | null;
    ruc?: string | null;
  } | null;
  responsable_comercial?: { id: string; nombre?: string | null } | null;
  responsable_tecnico?: { id: string; nombre?: string | null } | null;
};

function uniq(ids: (string | null | undefined)[]): string[] {
  return [...new Set(ids.filter((x): x is string => typeof x === "string" && x.length > 0))];
}

export async function enrichProyectosRows(
  sb: AppSupabaseClient,
  empresaId: string,
  rows: Record<string, unknown>[]
): Promise<ProyectoEnriquecido[]> {
  if (rows.length === 0) return [];

  const tipoIds = uniq(rows.map((r) => r.tipo_id as string | undefined));
  const estadoIds = uniq(rows.map((r) => r.estado_id as string | undefined));
  const clienteIds = uniq(rows.map((r) => r.cliente_id as string | undefined));
  const uCom = uniq(rows.map((r) => r.responsable_comercial_id as string | undefined));
  const uTec = uniq(rows.map((r) => r.responsable_tecnico_id as string | undefined));
  const userIds = uniq([...uCom, ...uTec]);

  const catalog = createServiceRoleClient();

  const [tiposR, estadosR, clientesR, usersR] = await Promise.all([
    tipoIds.length
      ? sb.from("proyecto_tipos").select("id,nombre,codigo").eq("empresa_id", empresaId).in("id", tipoIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    estadoIds.length
      ? sb
          .from("proyecto_estados")
          .select("id,nombre,codigo,color,tipo_sla,es_estado_final")
          .eq("empresa_id", empresaId)
          .in("id", estadoIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    clienteIds.length
      ? sb.from("clientes").select("id,empresa,nombre_contacto,ruc").eq("empresa_id", empresaId).in("id", clienteIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    userIds.length
      ? catalog.from("usuarios").select("id,nombre").eq("empresa_id", empresaId).in("id", userIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ]);

  const tiposMap = new Map(
    (tiposR.data ?? []).map((t) => {
      const row = t as { id: string };
      return [row.id, row] as const;
    })
  );
  const estadosMap = new Map(
    (estadosR.data ?? []).map((t) => {
      const row = t as { id: string };
      return [row.id, row] as const;
    })
  );
  const clientesMap = new Map(
    (clientesR.data ?? []).map((t) => {
      const row = t as { id: string };
      return [row.id, row] as const;
    })
  );
  const usersMap = new Map(
    (usersR.data ?? []).map((t) => {
      const row = t as { id: string };
      return [row.id, row] as const;
    })
  );

  return rows.map((r) => {
    const tipo_id = r.tipo_id as string | undefined;
    const estado_id = r.estado_id as string | undefined;
    const cliente_id = r.cliente_id as string | undefined;
    const rc = r.responsable_comercial_id as string | undefined;
    const rt = r.responsable_tecnico_id as string | undefined;
    const out: ProyectoEnriquecido = { ...r };
    if (tipo_id) out.proyecto_tipo = (tiposMap.get(tipo_id) as ProyectoEnriquecido["proyecto_tipo"]) ?? null;
    if (estado_id) out.proyecto_estado = (estadosMap.get(estado_id) as ProyectoEnriquecido["proyecto_estado"]) ?? null;
    if (cliente_id) out.cliente = (clientesMap.get(cliente_id) as ProyectoEnriquecido["cliente"]) ?? null;
    if (rc) {
      const u = usersMap.get(rc) as { id: string; nombre?: string } | undefined;
      out.responsable_comercial = u ? { id: u.id, nombre: u.nombre ?? null } : { id: rc, nombre: null };
    }
    if (rt) {
      const u = usersMap.get(rt) as { id: string; nombre?: string } | undefined;
      out.responsable_tecnico = u ? { id: u.id, nombre: u.nombre ?? null } : { id: rt, nombre: null };
    }
    return out;
  });
}
