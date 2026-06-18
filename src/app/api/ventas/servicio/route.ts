import { NextRequest, NextResponse } from "next/server";
import { getTenantSupabaseFromAuth } from "@/lib/supabase/tenant-api";
import { fetchDataSchemaForEmpresaId } from "@/lib/supabase/empresa-data-schema";
import { assertAllowedChatDataSchema } from "@/lib/supabase/chat-data-schema";
import { successResponse, errorResponse } from "@/lib/api/response";
import { API_ERRORS } from "@/lib/api/errors";
import { createVentaServicioPg } from "@/lib/ventas/server/create-venta-servicio-pg";
import type { LineaServicio, MonedaVenta, TipoIvaVenta, Venta } from "@/lib/ventas/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  cliente_razon_social?: unknown;
  cliente_ruc?: unknown;
  moneda?: unknown;
  tipo_cambio?: unknown;
  tipo_iva_cabecera?: unknown;
  servicios?: unknown;
  subtotal?: unknown;
  monto_iva?: unknown;
  total?: unknown;
  observaciones?: unknown;
}

function isTipoIva(v: unknown): v is TipoIvaVenta {
  return v === "EXENTA" || v === "5%" || v === "10%";
}
function isMoneda(v: unknown): v is MonedaVenta {
  return v === "GS" || v === "USD";
}
function asServicios(raw: unknown): LineaServicio[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => {
      if (!r || typeof r !== "object") return null;
      const o = r as Record<string, unknown>;
      const descripcion = String(o.descripcion ?? "").trim();
      const monto = Number(o.monto);
      if (!descripcion || !Number.isFinite(monto)) return null;
      return { descripcion, monto } as LineaServicio;
    })
    .filter((x): x is LineaServicio => x !== null);
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getTenantSupabaseFromAuth(request);
    if (!ctx) return NextResponse.json(errorResponse(API_ERRORS.UNAUTHORIZED), { status: 401 });
    const empresaId = ctx.auth.empresa_id;
    const schema = assertAllowedChatDataSchema(await fetchDataSchemaForEmpresaId(empresaId));

    const body = (await request.json().catch(() => ({}))) as Body;

    const clienteRazonSocial = String(body.cliente_razon_social ?? "").trim();
    if (!clienteRazonSocial) {
      return NextResponse.json(errorResponse("La razón social es obligatoria."), { status: 400 });
    }
    const moneda: MonedaVenta = isMoneda(body.moneda) ? body.moneda : "GS";
    const tipoCambio = Number(body.tipo_cambio);
    if (!Number.isFinite(tipoCambio) || tipoCambio <= 0) {
      return NextResponse.json(errorResponse("Tipo de cambio inválido."), { status: 400 });
    }
    const tipoIva: TipoIvaVenta = isTipoIva(body.tipo_iva_cabecera) ? body.tipo_iva_cabecera : "10%";
    const servicios = asServicios(body.servicios);
    if (!servicios.length) {
      return NextResponse.json(errorResponse("Cargá al menos un servicio."), { status: 400 });
    }

    const subtotal = Number(body.subtotal);
    const montoIva = Number(body.monto_iva);
    const total = Number(body.total);
    if (![subtotal, montoIva, total].every((n) => Number.isFinite(n))) {
      return NextResponse.json(errorResponse("Totales inválidos."), { status: 400 });
    }

    const result = await createVentaServicioPg({
      schema,
      empresaId,
      clienteRazonSocial,
      clienteRuc: String(body.cliente_ruc ?? "").trim() || null,
      moneda,
      tipoCambio,
      tipoIvaCabecera: tipoIva,
      servicios,
      subtotalDeclarado: subtotal,
      montoIvaDeclarado: montoIva,
      totalDeclarado: total,
      observaciones: String(body.observaciones ?? "").trim() || null,
    });

    const venta: Venta = {
      id: result.ventaId,
      numero_control: result.numeroControl,
      items: [],
      servicios,
      cliente_razon_social: clienteRazonSocial,
      cliente_ruc: String(body.cliente_ruc ?? "").trim() || null,
      tipo_iva_cabecera: tipoIva,
      moneda,
      tipo_cambio: tipoCambio,
      subtotal,
      monto_iva: montoIva,
      total,
      tipo_venta: "CONTADO",
      fecha: result.fechaIso,
    };
    return NextResponse.json(
      successResponse({
        venta,
        // Factura ERP generada en paralelo — el front la usa para redirigir
        // al detalle donde vive el panel SIFEN.
        factura: {
          id: result.facturaId,
          numero_factura: result.numeroFactura,
        },
      }),
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "No se pudo crear la venta.";
    console.error("[/api/ventas/servicio POST]", msg);
    return NextResponse.json(errorResponse(msg), { status: 500 });
  }
}
