// Parsers PUROS de las respuestas del portal. Cada uno CONSTRUYE el objeto
// clave por clave (lista blanca): lo que el backend mande de más no se copia,
// así que no puede llegar a un store ni al DOM. Una fila malformada se descarta
// o se normaliza a un valor seguro; ningún parser lanza.

import { compararFechaHora, esFechaValida, partirFechaHora } from '@/lib/pro/fechaHora';
import { MOTIVOS_VINCULO, type MotivoVinculo } from '@/lib/pro/errores';
import {
  ESTADOS_VISUALES,
  type EstadoVisual,
  type ProListaTurnos,
  type ProMarcaDia,
  type ProMarcas,
  type ProMe,
  type ProServicio,
  type ProServicios,
  type ProTurno,
  type ProVinculo,
} from '@/lib/pro/tipos';

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function esIdValido(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isSafeInteger(valor) && valor > 0;
}

// Texto no vacío (tras trim) o null. El valor se devuelve tal cual llegó.
function textoONull(valor: unknown): string | null {
  return typeof valor === 'string' && valor.trim() !== '' ? valor : null;
}

// El backend arma avatar_url con Storage::disk('public')->url() (APP_URL +
// /storage): siempre absoluta, pero http en local/staging, así que no se exige
// https. Solo se aceptan http(s) absolutas: nada de javascript:, data: ni rutas
// relativas (la UI cae a las iniciales).
const URL_HTTP_ABSOLUTA = /^https?:\/\/[^\s/]/i;

function urlHttpONull(valor: unknown): string | null {
  return typeof valor === 'string' && URL_HTTP_ABSOLUTA.test(valor) ? valor : null;
}

function estadoVisualDe(valor: unknown): EstadoVisual {
  // Un estado nuevo o desconocido se muestra como confirmado (badge neutro),
  // nunca rompe la lista.
  return ESTADOS_VISUALES.find((estado) => estado === valor) ?? 'confirmado';
}

function parseServicio(raw: unknown): ProServicio | null {
  if (!esObjeto(raw) || !esIdValido(raw.id)) return null;
  const nombre = textoONull(raw.nombre);
  return nombre === null ? null : { id: raw.id, nombre };
}

// Parsea cada elemento de una lista y cuenta los que no pasaron. Si `raw` NO es
// una lista devuelve null: un cuerpo de error, el HTML de un portal cautivo o
// un envoltorio inesperado no es "una lista vacía" y el servicio lo trata como
// error del servidor en vez de mostrar "sin turnos".
function listaDe<T>(raw: unknown, parseItem: (item: unknown) => T | null): { items: T[]; descartados: number } | null {
  if (!Array.isArray(raw)) return null;
  const items = raw.flatMap((item) => {
    const parseado = parseItem(item);
    return parseado === null ? [] : [parseado];
  });
  return { items, descartados: raw.length - items.length };
}

export function parseProTurno(raw: unknown): ProTurno | null {
  if (!esObjeto(raw) || !esIdValido(raw.id)) return null;
  // Fila sin una fecha_hora de pared válida: no hay dónde ubicarla en la agenda.
  if (typeof raw.fecha_hora !== 'string' || partirFechaHora(raw.fecha_hora) === null) return null;

  const cliente = esObjeto(raw.cliente) ? raw.cliente : {};
  const promo = esObjeto(raw.promo) ? textoONull(raw.promo.nombre) : null;
  const duracion = raw.duracion_total_minutos;

  return {
    id: raw.id,
    fecha_hora: raw.fecha_hora,
    duracion_total_minutos: typeof duracion === 'number' && Number.isInteger(duracion) && duracion > 0 ? duracion : 0,
    estado_visual: estadoVisualDe(raw.estado_visual),
    notas: textoONull(raw.notas),
    cliente: { nombre: textoONull(cliente.nombre), apellido: textoONull(cliente.apellido) },
    // Dentro de un turno, servicios ausente o no-lista es simplemente "sin servicios".
    servicios: listaDe(raw.servicios, parseServicio)?.items ?? [],
    promo: promo === null ? null : { nombre: promo },
  };
}

// null si el cuerpo no tiene la forma `{ data: [...] }`.
export function parseListaTurnos(body: unknown): ProListaTurnos | null {
  const cuerpo = esObjeto(body) ? body : {};
  const lista = listaDe(cuerpo.data, parseProTurno);
  if (lista === null) return null;
  // sort es estable: dos turnos a la misma hora conservan el orden del backend.
  lista.items.sort((a, b) => compararFechaHora(a.fecha_hora, b.fecha_hora));
  return { turnos: lista.items, truncated: cuerpo.truncated === true, descartados: lista.descartados };
}

function motivoDe(valor: unknown): MotivoVinculo | null {
  return MOTIVOS_VINCULO.find((motivo) => motivo === valor) ?? null;
}

function parseVinculo(raw: unknown): ProVinculo | null {
  if (!esObjeto(raw) || !esIdValido(raw.id)) return null;
  const negocio = esObjeto(raw.negocio) ? raw.negocio : {};
  const profesional = esObjeto(raw.profesional) ? raw.profesional : {};
  return {
    id: raw.id,
    negocioNombre: typeof negocio.nombre === 'string' ? negocio.nombre : '',
    profesional: {
      nombre: typeof profesional.nombre === 'string' ? profesional.nombre : '',
      apellido: textoONull(profesional.apellido),
      avatar_url: urlHttpONull(profesional.avatar_url),
    },
    // Falla cerrado: solo un `true` exacto habilita el negocio.
    disponible: raw.disponible === true,
    motivo: motivoDe(raw.motivo),
  };
}

// null si el cuerpo no trae `vinculos` como lista.
export function parseProMe(raw: unknown): ProMe | null {
  const cuerpo = esObjeto(raw) ? raw : {};
  const lista = listaDe(cuerpo.vinculos, parseVinculo);
  if (lista === null) return null;
  const cuenta = esObjeto(cuerpo.cuenta) ? cuerpo.cuenta : {};
  return { email: textoONull(cuenta.email), vinculos: lista.items, descartados: lista.descartados };
}

function parseMarca(raw: unknown): ProMarcaDia | null {
  if (!esObjeto(raw) || typeof raw.fecha !== 'string' || !esFechaValida(raw.fecha)) return null;
  const cantidad = raw.cantidad;
  if (typeof cantidad !== 'number' || !Number.isInteger(cantidad) || cantidad < 0) return null;
  return { fecha: raw.fecha, cantidad };
}

// null si el cuerpo no trae `dias` como lista.
export function parseMarcas(raw: unknown): ProMarcas | null {
  const lista = listaDe(esObjeto(raw) ? raw.dias : null, parseMarca);
  return lista === null ? null : { dias: lista.items, descartados: lista.descartados };
}

// El backend devuelve la lista plana (sin envoltorio `data`); null si no lo es.
export function parseServicios(raw: unknown): ProServicios | null {
  const lista = listaDe(raw, parseServicio);
  return lista === null ? null : { servicios: lista.items, descartados: lista.descartados };
}
