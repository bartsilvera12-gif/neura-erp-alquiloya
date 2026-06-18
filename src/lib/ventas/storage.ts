import type { LineaServicio, MonedaVenta, TipoIvaVenta, Venta } from "./types";
import { fetchWithSupabaseSession } from "@/lib/api/fetch-with-supabase-session";

export type ResultadoGuardarVenta =
  | { success: true; venta: Venta; factura?: { id: string; numero_factura: string } | null }
  | { success: false; error: string };

export interface SaveVentaServicioInput {
  cliente_razon_social: string;
  cliente_ruc: string | null;
  moneda: MonedaVenta;
  tipo_cambio: number;
  tipo_iva_cabecera: TipoIvaVenta;
  servicios: LineaServicio[];
  subtotal: number;
  monto_iva: number;
  total: number;
  observaciones?: string | null;
}

/**
 * Crea una venta en modo SERVICIOS (sin productos). POST a /api/ventas/servicio.
 */
export async function saveVentaServicio(
  datos: SaveVentaServicioInput,
): Promise<ResultadoGuardarVenta> {
  if (!datos.servicios.length) {
    return { success: false, error: "Agregá al menos un servicio." };
  }
  try {
    const res = await fetchWithSupabaseSession("/api/ventas/servicio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos),
    });
    const json = (await res.json()) as {
      success?: boolean;
      data?: { venta?: Venta; factura?: { id: string; numero_factura: string } | null };
      error?: string;
    };
    if (!res.ok || !json.success || !json.data?.venta) {
      return { success: false, error: json.error ?? `No se pudo registrar la venta (${res.status}).` };
    }
    return { success: true, venta: json.data.venta, factura: json.data.factura ?? null };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Error de red." };
  }
}

/**
 * Lista ventas del tenant (misma fuente que el dashboard: tablas `ventas` / `ventas_items`).
 */
export async function getVentas(): Promise<Venta[]> {
  try {
    const res = await fetchWithSupabaseSession("/api/ventas", { cache: "no-store" });
    const json = (await res.json()) as {
      success?: boolean;
      data?: { ventas?: Venta[] };
      error?: string;
    };
    if (!res.ok || !json.success || !json.data?.ventas) {
      console.error("[ventas] getVentas:", json.error ?? res.statusText);
      return [];
    }
    return json.data.ventas;
  } catch (e) {
    console.error("[ventas] getVentas:", e);
    return [];
  }
}

/**
 * Crea una venta en base de datos (transacción servidor: ítems, stock, movimientos).
 */
export async function saveVenta(
  datos: Omit<Venta, "id" | "numero_control" | "fecha">
): Promise<ResultadoGuardarVenta> {
  if (!datos.items || datos.items.length === 0) {
    return { success: false, error: "La venta debe tener al menos un producto." };
  }

  try {
    const res = await fetchWithSupabaseSession("/api/ventas/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: datos.items,
        moneda: datos.moneda,
        tipo_cambio: datos.tipo_cambio,
        subtotal: datos.subtotal,
        monto_iva: datos.monto_iva,
        total: datos.total,
        tipo_venta: datos.tipo_venta,
        plazo_dias: datos.plazo_dias,
        cliente_id: null,
        observaciones: null,
      }),
    });

    const json = (await res.json()) as {
      success?: boolean;
      data?: { venta?: Venta };
      error?: string;
    };

    if (!res.ok || !json.success || !json.data?.venta) {
      return {
        success: false,
        error: json.error ?? `No se pudo registrar la venta (${res.status}).`,
      };
    }

    return { success: true, venta: json.data.venta };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error de red.";
    return { success: false, error: msg };
  }
}
