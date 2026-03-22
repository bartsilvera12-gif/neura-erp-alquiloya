import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import type { MarketingTask, NuevaMarketingTask } from "./types";

interface TaskRow {
  id: string;
  empresa_id: string;
  cliente_id: string;
  titulo: string;
  descripcion: string | null;
  tipo_contenido: string;
  estado: string;
  fecha_entrega: string;
  responsable_user_id: string | null;
  prioridad: string | null;
  created_at: string;
  updated_at: string;
}

function rowToTask(r: TaskRow): MarketingTask {
  return {
    id:                  r.id,
    empresa_id:          r.empresa_id,
    cliente_id:          r.cliente_id,
    titulo:              r.titulo,
    descripcion:         r.descripcion ?? undefined,
    tipo_contenido:      r.tipo_contenido as MarketingTask["tipo_contenido"],
    estado:              r.estado as MarketingTask["estado"],
    fecha_entrega:       r.fecha_entrega,
    responsable_user_id: r.responsable_user_id ?? undefined,
    prioridad:           (r.prioridad as MarketingTask["prioridad"]) ?? undefined,
    created_at:         r.created_at,
    updated_at:          r.updated_at,
  };
}

/** Lista tareas de marketing de un cliente. Filtra por empresa (RLS). Solo clientes activos con tipo marketing. */
export async function getMarketingTasks(clienteId: string): Promise<MarketingTask[]> {
  const usuario = await getCurrentUser();
  if (!usuario?.empresa_id) return [];

  const { data: cliente } = await supabase
    .from("clientes")
    .select("id, tipo_servicio_cliente, estado")
    .eq("id", clienteId)
    .eq("empresa_id", usuario.empresa_id)
    .is("deleted_at", null)
    .single();

  if (!cliente || cliente.tipo_servicio_cliente !== "marketing" || cliente.estado === "inactivo") {
    return [];
  }

  const { data, error } = await supabase
    .from("marketing_tasks")
    .select("*")
    .eq("cliente_id", clienteId)
    .order("fecha_entrega", { ascending: true });

  if (error) {
    console.error("[marketing] getMarketingTasks:", error.message);
    return [];
  }
  return (data as TaskRow[]).map(rowToTask);
}

/** Lista todas las tareas de clientes marketing activos de la empresa. */
export async function getTodasMarketingTasks(): Promise<MarketingTask[]> {
  const usuario = await getCurrentUser();
  if (!usuario?.empresa_id) return [];

  const { data: clientes } = await supabase
    .from("clientes")
    .select("id")
    .eq("empresa_id", usuario.empresa_id)
    .eq("tipo_servicio_cliente", "marketing")
    .eq("estado", "activo")
    .is("deleted_at", null);

  const clienteIds = (clientes ?? []).map((c) => c.id);
  if (clienteIds.length === 0) return [];

  const { data, error } = await supabase
    .from("marketing_tasks")
    .select("*")
    .in("cliente_id", clienteIds)
    .order("fecha_entrega", { ascending: true });

  if (error) {
    console.error("[marketing] getTodasMarketingTasks:", error.message);
    return [];
  }
  return (data as TaskRow[]).map(rowToTask);
}

/** Crea tarea de marketing. Valida que el cliente sea marketing activo. */
export async function createMarketingTask(datos: NuevaMarketingTask): Promise<MarketingTask | null> {
  const usuario = await getCurrentUser();
  if (!usuario?.empresa_id) throw new Error("Usuario no autenticado o sin empresa");

  const { data: cliente } = await supabase
    .from("clientes")
    .select("id, tipo_servicio_cliente, estado")
    .eq("id", datos.cliente_id)
    .eq("empresa_id", usuario.empresa_id)
    .is("deleted_at", null)
    .single();

  if (!cliente || cliente.tipo_servicio_cliente !== "marketing" || cliente.estado === "inactivo") {
    return null;
  }

  const insert = {
    empresa_id:          usuario.empresa_id,
    cliente_id:          datos.cliente_id,
    titulo:              datos.titulo.trim(),
    descripcion:         datos.descripcion?.trim() || null,
    tipo_contenido:      datos.tipo_contenido,
    fecha_entrega:       datos.fecha_entrega,
    responsable_user_id:  datos.responsable_user_id || null,
    prioridad:           datos.prioridad || null,
  };

  const { data, error } = await supabase
    .from("marketing_tasks")
    .insert([insert])
    .select()
    .single();

  if (error) {
    console.error("[marketing] createMarketingTask:", error.message);
    return null;
  }
  return rowToTask(data as TaskRow);
}

/** Actualiza tarea. RLS valida empresa. */
export async function updateMarketingTask(
  id: string,
  datos: Partial<Pick<MarketingTask, "titulo" | "descripcion" | "tipo_contenido" | "estado" | "fecha_entrega" | "responsable_user_id" | "prioridad">>
): Promise<MarketingTask | null> {
  const patch: Record<string, unknown> = {};
  if (datos.titulo !== undefined) patch.titulo = datos.titulo;
  if (datos.descripcion !== undefined) patch.descripcion = datos.descripcion ?? null;
  if (datos.tipo_contenido !== undefined) patch.tipo_contenido = datos.tipo_contenido;
  if (datos.estado !== undefined) patch.estado = datos.estado;
  if (datos.fecha_entrega !== undefined) patch.fecha_entrega = datos.fecha_entrega;
  if (datos.responsable_user_id !== undefined) patch.responsable_user_id = datos.responsable_user_id ?? null;
  if (datos.prioridad !== undefined) patch.prioridad = datos.prioridad ?? null;

  const { data, error } = await supabase
    .from("marketing_tasks")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[marketing] updateMarketingTask:", error.message);
    return null;
  }
  return rowToTask(data as TaskRow);
}

/** Actualiza solo el estado. */
export async function updateTaskStatus(
  id: string,
  estado: MarketingTask["estado"]
): Promise<MarketingTask | null> {
  return updateMarketingTask(id, { estado });
}
