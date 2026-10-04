// Borrador del formulario de servicio que sobrevive al viaje a "Horarios
// Disponibles" (la pantalla se desmonta al navegar). Vive en sessionStorage y
// se guarda justo antes de navegar; se CONSUME (lee y borra) en la primera
// lectura, así una visita posterior arranca vacía. Todo acceso al storage va
// en try/catch: sin storage la pantalla funciona igual, solo sin borrador.

export const BORRADOR_TTL_MS = 30 * 60 * 1000;
const PREFIJO = 'servicioBorrador:';

// Clave por formulario: 'nuevo' o `editar-<id>`.
export function guardarBorrador(clave: string, datos: unknown, ahora: number = Date.now()): void {
  try {
    window.sessionStorage.setItem(PREFIJO + clave, JSON.stringify({ guardadoEn: ahora, datos }));
  } catch {
    // sin storage: no hay borrador
  }
}

export function limpiarBorrador(clave: string): void {
  try {
    window.sessionStorage.removeItem(PREFIJO + clave);
  } catch {
    // sin storage: nada que limpiar
  }
}

export function consumirBorrador<T>(clave: string, ahora: number = Date.now()): T | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = window.sessionStorage.getItem(PREFIJO + clave);
    if (raw === null) return null;
    window.sessionStorage.removeItem(PREFIJO + clave);
    const parsed = JSON.parse(raw) as { guardadoEn?: unknown; datos?: unknown };
    if (typeof parsed.guardadoEn !== 'number' || ahora - parsed.guardadoEn > BORRADOR_TTL_MS) return null;
    return (parsed.datos ?? null) as T | null;
  } catch {
    return null;
  }
}
