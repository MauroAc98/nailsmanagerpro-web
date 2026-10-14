// Búsqueda de servicios por nombre en la reserva online: sin distinguir mayúsculas
// ni tildes ("pestanas" encuentra "pestañas") y con la parte que coincide marcada.

const sinMarcas = (s: string): string => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

export const normalizarBusqueda = (s: string): string => sinMarcas(s).trim().replace(/\s+/g, ' ');

export function coincide(nombre: string, busqueda: string): boolean {
  const q = normalizarBusqueda(busqueda);
  return q === '' || sinMarcas(nombre).includes(q);
}

export interface Fragmento {
  texto: string;
  coincide: boolean;
}

// Parte `nombre` en fragmentos, marcando el primero que coincide con la búsqueda.
// Los fragmentos conservan el texto original (con sus tildes y mayúsculas); la
// comparación se hace carácter a carácter para que las posiciones calcen.
export function partirPorCoincidencia(nombre: string, busqueda: string): Fragmento[] {
  const entero = [{ texto: nombre, coincide: false }];
  const q = normalizarBusqueda(busqueda);
  if (q === '') return entero;

  const caracteres = Array.from(nombre);
  const normalizados = caracteres.map(sinMarcas);
  // Si algún carácter cambia de largo al normalizarse no se puede mapear: sin marcar.
  if (normalizados.some((c) => c.length !== 1)) return entero;

  const inicio = normalizados.join('').indexOf(q);
  if (inicio < 0) return entero;
  const fin = inicio + q.length;

  const partes: Fragmento[] = [
    { texto: caracteres.slice(0, inicio).join(''), coincide: false },
    { texto: caracteres.slice(inicio, fin).join(''), coincide: true },
    { texto: caracteres.slice(fin).join(''), coincide: false },
  ];
  return partes.filter((p) => p.texto !== '');
}
