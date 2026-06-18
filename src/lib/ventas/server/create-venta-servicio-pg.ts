import { getChatPostgresPool, quoteSchemaTable } from "@/lib/supabase/chat-pg-pool";
import type { LineaServicio, MonedaVenta, TipoIvaVenta } from "@/lib/ventas/types";

export interface CreateVentaServicioParams {
  schema: string;
  empresaId: string;
  clienteRazonSocial: string;
  clienteRuc: string | null;
  moneda: MonedaVenta;
  tipoCambio: number;
  tipoIvaCabecera: TipoIvaVenta;
  servicios: LineaServicio[];
  /** Totales declarados por el cliente (se contrastan con el recálculo). */
  subtotalDeclarado: number;
  montoIvaDeclarado: number;
  totalDeclarado: number;
  observaciones: string | null;
}

const TOL = 2; // guaraníes — tolerancia de redondeo

let ventasServicioColumnsReady = false;

/**
 * Bootstrap idempotente: agrega columnas que necesita el modo "venta de
 * servicios" a la tabla `<schema>.ventas`. Soporta tablas que todavia tienen
 * el esquema viejo (solo productos) sin obligar a correr migrations.
 */
async function ensureVentasServicioColumns(
  pool: NonNullable<ReturnType<typeof getChatPostgresPool>>,
  schema: string,
): Promise<void> {
  if (ventasServicioColumnsReady) return;
  const tV = quoteSchemaTable(schema, "ventas");
  await pool.query(
    `ALTER TABLE ${tV}
       ADD COLUMN IF NOT EXISTS cliente_razon_social text,
       ADD COLUMN IF NOT EXISTS cliente_ruc          text,
       ADD COLUMN IF NOT EXISTS tipo_iva_cabecera    text,
       ADD COLUMN IF NOT EXISTS descripcion_servicios jsonb,
       ADD COLUMN IF NOT EXISTS observaciones       text`,
  );
  ventasServicioColumnsReady = true;
}

function ivaRate(tipo: TipoIvaVenta): number {
  if (tipo === "5%") return 0.05;
  if (tipo === "10%") return 0.10;
  return 0;
}

function recalcServicios(servicios: LineaServicio[], tipoIva: TipoIvaVenta) {
  let subtotal = 0;
  for (const s of servicios) subtotal += Number(s.monto) || 0;
  // IVA INCLUIDO: el monto cargado ya incluye el IVA. monto_iva es informativo
  // (monto * rate) y el total a cobrar es igual al subtotal. Asi una venta de
  // Gs. 15M con IVA 10% queda en 15M (no en 16.5M).
  const rate = ivaRate(tipoIva);
  const montoIva = subtotal * rate;
  const total = subtotal;
  return { subtotal, montoIva, total };
}

/**
 * Crea una venta en modo SERVICIOS. No toca productos ni stock — solo escribe
 * la cabecera con las nuevas columnas (razon_social, ruc, descripcion_servicios
 * en jsonb, tipo_iva_cabecera). Genera numero_control igual que la de productos.
 */
export async function createVentaServicioPg(
  params: CreateVentaServicioParams,
): Promise<{
  ventaId: string;
  numeroControl: string;
  fechaIso: string;
  facturaId: string;
  numeroFactura: string;
}> {
  const pool = getChatPostgresPool();
  if (!pool) throw new Error("Sin conexión directa a Postgres (configura SUPABASE_DB_URL).");

  if (!params.clienteRazonSocial?.trim()) {
    throw new Error("La razón social es obligatoria.");
  }
  if (!params.servicios.length || params.servicios.every((s) => !s.descripcion?.trim() && !s.monto)) {
    throw new Error("Agregá al menos un servicio con descripción y monto.");
  }

  const validServicios = params.servicios
    .map((s) => ({ descripcion: (s.descripcion ?? "").trim(), monto: Number(s.monto) || 0 }))
    .filter((s) => s.descripcion && s.monto > 0);
  if (!validServicios.length) {
    throw new Error("Agregá al menos un servicio con descripción y monto > 0.");
  }

  const calc = recalcServicios(validServicios, params.tipoIvaCabecera);
  if (
    Math.abs(calc.subtotal - params.subtotalDeclarado) > TOL ||
    Math.abs(calc.montoIva - params.montoIvaDeclarado) > TOL ||
    Math.abs(calc.total - params.totalDeclarado) > TOL
  ) {
    throw new Error("Los totales no coinciden con los servicios cargados; revisalos.");
  }

  await ensureVentasServicioColumns(pool, params.schema);

  const tV = quoteSchemaTable(params.schema, "ventas");
  const tF = quoteSchemaTable(params.schema, "facturas");
  const tFI = quoteSchemaTable(params.schema, "factura_items");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Numero correlativo de venta (VTA-XXXXXX) y de factura (FAC-XXXXXX).
    // Ambos avanzan de forma independiente — la factura es la fuente de verdad
    // para SIFEN, mientras VTA queda como referencia operativa de la venta.
    const maxRow = await client.query<{ mx: string | null }>(
      `SELECT COALESCE(MAX(
         CASE
           WHEN numero_control ~ '^VTA-[0-9]+$'
           THEN substring(numero_control from '[0-9]+$')::bigint
           ELSE NULL::bigint
         END
       ), 0)::text AS mx
       FROM ${tV}
       WHERE empresa_id = $1`,
      [params.empresaId],
    );
    const nextNum = BigInt(maxRow.rows[0]?.mx ?? "0") + BigInt(1);
    const numeroControl = `VTA-${String(nextNum).padStart(6, "0")}`;
    const fechaIso = new Date().toISOString();
    const fechaDate = fechaIso.slice(0, 10); // YYYY-MM-DD

    const ins = await client.query<{ id: string }>(
      `INSERT INTO ${tV} (
         empresa_id, cliente_id, numero_control, moneda, tipo_cambio,
         subtotal, monto_iva, total, estado, tipo_venta, plazo_dias, fecha,
         observaciones, cliente_razon_social, cliente_ruc, tipo_iva_cabecera,
         descripcion_servicios
       ) VALUES (
         $1, NULL, $2, $3, $4,
         $5, $6, $7, 'completada', 'CONTADO', NULL, $8::timestamptz,
         $9, $10, $11, $12,
         $13::jsonb
       )
       RETURNING id`,
      [
        params.empresaId,
        numeroControl,
        params.moneda,
        params.tipoCambio,
        calc.subtotal,
        calc.montoIva,
        calc.total,
        fechaIso,
        params.observaciones,
        params.clienteRazonSocial.trim(),
        params.clienteRuc?.trim() || null,
        params.tipoIvaCabecera,
        JSON.stringify(validServicios),
      ],
    );
    const ventaId = ins.rows[0].id;

    // -------------------------------------------------------------------------
    // Puente Venta -> Factura ERP (fuente de verdad SIFEN).
    // Idempotente: si la venta ya tiene factura_id linkeado, no creamos una
    // nueva (esto solo aplica si esta función se reinvoca con el mismo venta
    // existente, hoy no ocurre porque acabamos de hacer INSERT — pero queda
    // como guardarraíl para los futuros retries).
    // -------------------------------------------------------------------------
    const facMaxRow = await client.query<{ mx: string | null }>(
      `SELECT COALESCE(MAX(
         CASE
           WHEN numero_factura ~ '^FAC-[0-9]+$'
           THEN substring(numero_factura from '[0-9]+$')::bigint
           ELSE NULL::bigint
         END
       ), 0)::text AS mx
       FROM ${tF}
       WHERE empresa_id = $1`,
      [params.empresaId],
    );
    const nextFac = BigInt(facMaxRow.rows[0]?.mx ?? "0") + BigInt(1);
    const numeroFactura = `FAC-${String(nextFac).padStart(6, "0")}`;

    const facIns = await client.query<{ id: string }>(
      `INSERT INTO ${tF} (
         empresa_id, cliente_id, numero_factura, fecha, fecha_vencimiento,
         monto, saldo, estado, tipo, moneda,
         cliente_razon_social, cliente_ruc, observaciones, origen_venta_id
       ) VALUES (
         $1, NULL, $2, $3::date, $3::date,
         $4, $4, 'Pagado', 'contado', $5,
         $6, $7, $8, $9::uuid
       )
       RETURNING id`,
      [
        params.empresaId,
        numeroFactura,
        fechaDate,
        calc.total,
        params.moneda,
        params.clienteRazonSocial.trim(),
        params.clienteRuc?.trim() || null,
        params.observaciones,
        ventaId,
      ],
    );
    const facturaId = facIns.rows[0].id;

    // Items: una linea por servicio. Mantenemos el iva como porcion informativa
    // (subtotal * rate) consistente con el front. precio_unitario = monto.
    const rate = ivaRate(params.tipoIvaCabecera);
    for (const srv of validServicios) {
      const sub = Number(srv.monto) || 0;
      const ivaLinea = sub * rate;
      await client.query(
        `INSERT INTO ${tFI} (
           empresa_id, factura_id, descripcion, cantidad, precio_unitario,
           subtotal, iva, tipo_iva, total
         ) VALUES (
           $1, $2::uuid, $3, 1, $4, $4, $5, $6, $4
         )`,
        [
          params.empresaId,
          facturaId,
          srv.descripcion,
          sub,
          ivaLinea,
          params.tipoIvaCabecera,
        ],
      );
    }

    // Linkeamos la venta a la factura para que el flujo siguiente sepa cual
    // abrir. La columna factura_id se crea idempotentemente en la migración
    // 20260628120000_alquiloya_facturacion_sifen.sql.
    await client.query(
      `UPDATE ${tV} SET factura_id = $1::uuid WHERE id = $2::uuid AND empresa_id = $3`,
      [facturaId, ventaId, params.empresaId],
    );

    await client.query("COMMIT");
    return { ventaId, numeroControl, fechaIso, facturaId, numeroFactura };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
