// Raíz del portal (profesionales.turnetto.com/ se reescribe a /pro). No tiene
// contenido: la sesión vive en localStorage, así que solo el cliente sabe a
// dónde ir y es ProGuard (en el layout) quien redirige según el estado.
export default function PortalRootPage() {
  return null;
}
