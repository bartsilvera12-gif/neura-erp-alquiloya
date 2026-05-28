import { getClientSchema, isSingleClientMode } from "@/lib/env/instance-mode";
import PlanesLegacyClient from "./PlanesLegacyClient";
import PlanesPublicacionClient from "./PlanesPublicacionClient";

export const dynamic = "force-dynamic";

/**
 * Para instancias monocliente AlquiloYa, el módulo "planes" se reutiliza como
 * editor de planes de publicación inmobiliaria (alquiloya.planes_publicacion).
 * Para el resto de clientes, sigue funcionando el editor legado de planes ERP.
 */
export default function PlanesPage() {
  if (isSingleClientMode() && getClientSchema() === "alquiloya") {
    return <PlanesPublicacionClient />;
  }
  return <PlanesLegacyClient />;
}
