/**
 * Valor de `xsi:schemaLocation` para documentos SIFEN v150 (rDE y envoltorio rLoteDE en recibe-lote).
 * SET suele exigir la URL absoluta del XSD, no solo el nombre de archivo.
 */
export const SIFEN_EKUATIA_TARGET_NS = "http://ekuatia.set.gov.py/sifen/xsd";

/** XSD oficial de recepción DE v150 (mismo para instancia rDE dentro del lote). */
export const SIFEN_SIRECEP_DE_V150_XSD_URL = "https://ekuatia.set.gov.py/sifen/xsd/siRecepDE_v150.xsd";

export function buildSifenSiRecepDeV150SchemaLocation(): string {
  return `${SIFEN_EKUATIA_TARGET_NS} ${SIFEN_SIRECEP_DE_V150_XSD_URL}`;
}
