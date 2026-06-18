import { NextRequest, NextResponse } from "next/server";
import { getSifenConfigSupabaseFromAuth } from "@/lib/sifen/sifen-config-service-client";
import { successResponse, errorResponse } from "@/lib/api/response";
import { API_ERRORS } from "@/lib/api/errors";
import {
  buildPatchUpdate,
  rowFromCreateBody,
  validateCreateBody,
} from "@/lib/sifen/config-validation";
import { mergeCertificadoPasswordEncryptedForInsert } from "@/lib/sifen/sifen-config-persist";
import { toEmpresaSifenConfigPublicDto } from "@/lib/sifen/sifen-config-response";
import { encryptSecret } from "@/lib/sifen/security";
import { ensureSifenConfigColumns } from "@/lib/sifen/server/ensure-sifen-config-columns";
import { fetchDataSchemaForEmpresaId } from "@/lib/supabase/empresa-data-schema";
import { getChatPostgresPool, quoteSchemaTable } from "@/lib/supabase/chat-pg-pool";

/**
 * Lista blanca de columnas legales para UPDATE. Cualquier clave fuera de esta
 * lista que llegue desde buildPatchUpdate se descarta defensivamente (aunque
 * en teoria no deberia pasar). Evita inyeccion SQL y protege contra typos.
 */
const COLUMNAS_PATCH_PERMITIDAS = new Set([
  "ruc",
  "razon_social",
  "direccion_fiscal",
  "timbrado_numero",
  "timbrado_fecha_inicio_vigencia",
  "actividad_economica_codigo",
  "actividad_economica_descripcion",
  "establecimiento",
  "punto_expedicion",
  "ambiente",
  "csc",
  "certificado_path",
  "certificado_vencimiento",
  "activo",
  "sifen_plazo_cancelacion_horas",
  "kude_color_primario",
  "kude_color_primario_fill",
  "certificado_password_encrypted",
]);


/**
 * GET /api/configuracion/sifen
 * Configuración SIFEN de la empresa autenticada; data null si aún no existe.
 * No expone contraseña ni ciphertext.
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await getSifenConfigSupabaseFromAuth(request);
    if (!ctx) {
      return NextResponse.json(errorResponse(API_ERRORS.UNAUTHORIZED), { status: 401 });
    }
    const { auth, supabase } = ctx;

    const { data, error } = await supabase
      .from("empresa_sifen_config")
      .select("*")
      .eq("empresa_id", auth.empresa_id)
      .maybeSingle();

    if (error) {
      return NextResponse.json(errorResponse(error.message), { status: 400 });
    }

    return NextResponse.json(successResponse(toEmpresaSifenConfigPublicDto(data as Record<string, unknown> | null)));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return NextResponse.json(errorResponse(msg), { status: 500 });
  }
}

/**
 * POST /api/configuracion/sifen
 * Crea la configuración si no existe (una por empresa).
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await getSifenConfigSupabaseFromAuth(request);
    if (!ctx) {
      return NextResponse.json(errorResponse(API_ERRORS.UNAUTHORIZED), { status: 401 });
    }
    const { auth, supabase } = ctx;

    // Bootstrap aditivo de columnas (ver comentario en PATCH).
    try {
      const schema = await fetchDataSchemaForEmpresaId(auth.empresa_id);
      await ensureSifenConfigColumns(schema);
    } catch (e) {
      console.warn(
        "[sifen/POST] bootstrap de columnas fallo:",
        e instanceof Error ? e.message : e,
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(errorResponse("Cuerpo JSON inválido"), { status: 400 });
    }

    const validated = validateCreateBody(body);
    if (!validated.ok) {
      return NextResponse.json(errorResponse(validated.error), { status: 400 });
    }


    const { data: existing } = await supabase
      .from("empresa_sifen_config")
      .select("id")
      .eq("empresa_id", auth.empresa_id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        errorResponse("Ya existe configuración SIFEN para esta empresa; use PATCH para actualizar"),
        { status: 409 }
      );
    }

    const insert = rowFromCreateBody(auth.empresa_id, validated.data);
    try {
      mergeCertificadoPasswordEncryptedForInsert(insert, validated.data.certificado_password);
    } catch (e) {
      const m = e instanceof Error ? e.message : "Error al cifrar la contraseña del certificado";
      return NextResponse.json(errorResponse(m), { status: 500 });
    }

    // Mismo motivo que el PATCH: PostgREST cache puede descartar columnas
    // recien agregadas (certificado_password_encrypted, etc.). Usamos pool
    // directo cuando esta disponible para garantizar persistencia.
    let data: Record<string, unknown> | null = null;
    let insertErr: { message: string; code?: string } | null = null;

    const poolPost = getChatPostgresPool();
    if (poolPost) {
      try {
        const schemaName = await fetchDataSchemaForEmpresaId(auth.empresa_id);
        const tableName = quoteSchemaTable(schemaName, "empresa_sifen_config");
        const cols: string[] = [];
        const placeholders: string[] = [];
        const vals: unknown[] = [];
        let idx = 1;
        for (const [k, v] of Object.entries(insert)) {
          if (k !== "empresa_id" && !COLUMNAS_PATCH_PERMITIDAS.has(k)) continue;
          cols.push(`"${k}"`);
          placeholders.push(`$${idx}`);
          vals.push(v);
          idx++;
        }
        const { rows } = await poolPost.query(
          `INSERT INTO ${tableName} (${cols.join(", ")}) VALUES (${placeholders.join(", ")}) RETURNING *`,
          vals,
        );
        data = rows[0] as Record<string, unknown>;
      } catch (e) {
        const code = (e as { code?: string })?.code;
        const m = e instanceof Error ? e.message : "Error en INSERT PG directo";
        insertErr = { message: m, code };
      }
    } else {
      const { data: rest, error: errRest } = await supabase
        .from("empresa_sifen_config")
        .insert(insert)
        .select()
        .single();
      if (errRest) insertErr = { message: errRest.message, code: errRest.code };
      else data = rest as Record<string, unknown>;
    }

    if (insertErr) {
      if (insertErr.code === "23505") {
        return NextResponse.json(
          errorResponse("Ya existe configuración SIFEN para esta empresa; use PATCH para actualizar"),
          { status: 409 }
        );
      }
      return NextResponse.json(errorResponse(insertErr.message), { status: 400 });
    }

    return NextResponse.json(successResponse(toEmpresaSifenConfigPublicDto(data as Record<string, unknown>)));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return NextResponse.json(errorResponse(msg), { status: 500 });
  }
}

/**
 * PATCH /api/configuracion/sifen
 * Actualiza la configuración existente de la empresa autenticada.
 */
export async function PATCH(request: NextRequest) {
  try {
    const ctx = await getSifenConfigSupabaseFromAuth(request);
    if (!ctx) {
      return NextResponse.json(errorResponse(API_ERRORS.UNAUTHORIZED), { status: 401 });
    }
    const { auth, supabase } = ctx;

    // Bootstrap idempotente: garantiza que las columnas que vamos a escribir
    // (certificado_password_encrypted, kude_*, sifen_plazo_cancelacion_horas,
    // etc.) existan en <schema>.empresa_sifen_config. Cubre tenants clonados
    // desde Zentra antes de que se sumaran esas columnas a la referencia.
    try {
      const schema = await fetchDataSchemaForEmpresaId(auth.empresa_id);
      await ensureSifenConfigColumns(schema);
    } catch (e) {
      console.warn(
        "[sifen/PATCH] bootstrap de columnas fallo:",
        e instanceof Error ? e.message : e,
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(errorResponse("Cuerpo JSON inválido"), { status: 400 });
    }

    const built = buildPatchUpdate(body);
    if (!built.ok) {
      return NextResponse.json(errorResponse(built.error), { status: 400 });
    }


    const { data: existing, error: errLoad } = await supabase
      .from("empresa_sifen_config")
      .select("id")
      .eq("empresa_id", auth.empresa_id)
      .maybeSingle();

    if (errLoad) {
      return NextResponse.json(errorResponse(errLoad.message), { status: 400 });
    }

    if (!existing) {
      return NextResponse.json(
        errorResponse("No hay configuración SIFEN; use POST para crearla"),
        { status: 404 }
      );
    }

    const finalPatch: Record<string, unknown> = { ...built.patch };
    if (built.password.kind === "clear") {
      finalPatch.certificado_password_encrypted = null;
    } else if (built.password.kind === "set") {
      try {
        finalPatch.certificado_password_encrypted = encryptSecret(built.password.value);
      } catch (e) {
        const m = e instanceof Error ? e.message : "Error al cifrar la contraseña del certificado";
        return NextResponse.json(errorResponse(m), { status: 500 });
      }
    }

    // PostgREST en self-hosted puede mantener cache de schema y descartar
    // columnas recien agregadas (certificado_password_encrypted, kude_*, etc.)
    // sin reportar error — el UPDATE devuelve 200 pero la columna no se
    // persiste. Para evitar eso usamos el pool PG directo cuando esta
    // disponible: el UPDATE va via SQL crudo bypaseando PostgREST.
    let data: Record<string, unknown> | null = null;
    let updateErr: string | null = null;

    const pool = getChatPostgresPool();
    if (pool) {
      try {
        const schemaName = await fetchDataSchemaForEmpresaId(auth.empresa_id);
        const tableName = quoteSchemaTable(schemaName, "empresa_sifen_config");

        const setCols: string[] = [];
        const vals: unknown[] = [auth.empresa_id];
        let idx = 2;
        for (const [k, v] of Object.entries(finalPatch)) {
          if (!COLUMNAS_PATCH_PERMITIDAS.has(k)) continue;
          setCols.push(`"${k}" = $${idx}`);
          vals.push(v);
          idx++;
        }
        setCols.push(`updated_at = now()`);

        if (setCols.length === 1) {
          // solo updated_at — no hay nada para actualizar; lo tratamos como noop con select
          const { rows } = await pool.query(
            `SELECT * FROM ${tableName} WHERE empresa_id = $1::uuid LIMIT 1`,
            [auth.empresa_id],
          );
          data = (rows[0] as Record<string, unknown>) ?? null;
        } else {
          const { rows } = await pool.query(
            `UPDATE ${tableName} SET ${setCols.join(", ")} WHERE empresa_id = $1::uuid RETURNING *`,
            vals,
          );
          if (rows.length === 0) {
            updateErr = "No se encontró la fila para actualizar";
          } else {
            data = rows[0] as Record<string, unknown>;
          }
        }
      } catch (e) {
        updateErr = e instanceof Error ? e.message : "Error en UPDATE PG directo";
      }
    } else {
      // Fallback: PostgREST. Funciona en entornos donde el cache no esta stale.
      const { data: rest, error: errRest } = await supabase
        .from("empresa_sifen_config")
        .update(finalPatch)
        .eq("empresa_id", auth.empresa_id)
        .select()
        .single();
      if (errRest) updateErr = errRest.message;
      else data = rest as Record<string, unknown>;
    }

    if (updateErr) {
      return NextResponse.json(errorResponse(updateErr), { status: 400 });
    }

    return NextResponse.json(successResponse(toEmpresaSifenConfigPublicDto(data as Record<string, unknown>)));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return NextResponse.json(errorResponse(msg), { status: 500 });
  }
}
