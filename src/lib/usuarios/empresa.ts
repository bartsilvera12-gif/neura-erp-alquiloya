import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";

export interface UsuarioEmpresa {
  id: string;
  nombre: string | null;
  email: string;
}

/** Lista usuarios activos de la empresa del usuario actual. Para selects de responsable, etc. */
export async function getUsuariosActivosEmpresa(): Promise<UsuarioEmpresa[]> {
  const usuario = await getCurrentUser();
  if (!usuario?.empresa_id) return [];

  const { data, error } = await supabase
    .from("usuarios")
    .select("id, nombre, email")
    .eq("empresa_id", usuario.empresa_id)
    .eq("estado", "activo")
    .order("nombre", { ascending: true });

  if (error) {
    console.error("[usuarios] getUsuariosActivosEmpresa:", error.message);
    return [];
  }
  return (data ?? []).map((r) => ({
    id: r.id,
    nombre: r.nombre ?? r.email ?? "—",
    email: r.email ?? "",
  }));
}
