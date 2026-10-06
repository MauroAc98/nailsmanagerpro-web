import { nombreArchivoHistoria, type Historia } from '@/lib/historiaHistorias';
import type { ResultadoDensidad } from '@/lib/historiaDensidad';

// Lógica pura (sin DOM ni React) de la exportación de TODAS las historias del
// modo "una por categoría". Las APIs del navegador entran por parámetro para
// poder testear el orden, los nombres y los fallos sin un navegador real.

export interface ResumenAjustes {
  entraTodas: boolean;
  historiasQueNoEntran: Historia[];
}

// Junta los reportes de ajuste por historia (id -> resultado de TarjetaPrecios).
// Una historia sin reporte todavía cuenta como "entra" (igual que el estado
// inicial del ajuste de la historia actual); los reportes de historias que ya
// no existen se ignoran.
export function agregarAjustes(
  historias: Historia[],
  reportes: Record<string, ResultadoDensidad | undefined>,
): ResumenAjustes {
  const historiasQueNoEntran = historias.filter(h => reportes[h.id]?.entra === false);
  return { entraTodas: historiasQueNoEntran.length === 0, historiasQueNoEntran };
}

// Un nombre de archivo por historia, sin colisiones: si el slug se repite (o no
// hay título) la 2da, 3ra... llevan "-2", "-3" antes de la extensión.
export function nombresArchivoUnicos(titulos: Array<string | null>): string[] {
  const vistos = new Map<string, number>();
  return titulos.map(titulo => {
    const base = nombreArchivoHistoria(titulo);
    const n = (vistos.get(base) ?? 0) + 1;
    vistos.set(base, n);
    return n === 1 ? base : base.replace(/\.png$/, `-${n}.png`);
  });
}

export interface NavegadorCompartir {
  share?:    (data: ShareData) => Promise<void>;
  canShare?: (data: ShareData) => boolean;
}

// Web Share con archivos si el navegador lo soporta para ESTE lote; si no,
// descargas sucesivas.
export function decidirEnvio(files: File[], nav: NavegadorCompartir): 'compartir' | 'descargar' {
  return nav.share && nav.canShare && nav.canShare({ files }) ? 'compartir' : 'descargar';
}

export const ERROR_AJUSTE_CAMBIO = 'El ajuste de las historias cambió durante la captura';

interface OpcionesExportar {
  historias: Pick<Historia, 'id' | 'titulo'>[];
  // Espera fuentes y un frame asentado (ver useHistoriaPrecios).
  asentar: () => Promise<void>;
  // Firma del ajuste de todas las historias; si cambia entre el inicio y el
  // fin de la captura, alguna se re-midió a mitad de camino y el lote se
  // descarta en vez de entregar imágenes con densidades inconsistentes.
  firma: () => string;
  capturar: (id: string) => Promise<Blob | null>;
}

// Captura una por una (nunca en paralelo: html-to-image + imágenes pesadas) y
// corta ante el primer fallo — no se devuelve un lote parcial.
export async function exportarHistorias({ historias, asentar, firma, capturar }: OpcionesExportar): Promise<File[]> {
  await asentar();
  const firmaInicial = firma();
  const nombres = nombresArchivoUnicos(historias.map(h => h.titulo));
  const archivos: File[] = [];
  for (let i = 0; i < historias.length; i++) {
    const blob = await capturar(historias[i].id);
    if (!blob) throw new Error(`No se pudo capturar la historia ${historias[i].id}`);
    archivos.push(new File([blob], nombres[i], { type: 'image/png' }));
  }
  if (firma() !== firmaInicial) throw new Error(ERROR_AJUSTE_CAMBIO);
  return archivos;
}

interface OpcionesDescarga {
  descargar: (file: File) => void;
  esperar:   () => Promise<void>;
}

// Los navegadores pueden bloquear varias descargas automáticas seguidas; la
// pausa entre archivos reduce ese riesgo (no lo elimina).
export async function descargarSecuencial(files: File[], { descargar, esperar }: OpcionesDescarga): Promise<void> {
  for (let i = 0; i < files.length; i++) {
    descargar(files[i]);
    if (i < files.length - 1) await esperar();
  }
}

// ── Textos ───────────────────────────────────────────────────────────────────
// `t` es la función de traducción del namespace HistoriaPreciosPage.
type Traducir = (key: string, values?: Record<string, string | number>) => string;

// Aviso (ámbar) junto a los botones: nombra la primera que no entra y cuenta
// el resto, sin armar listas por locale.
export function avisoNoEntran(noEntran: Pick<Historia, 'titulo'>[], t: Traducir): string | null {
  if (noEntran.length === 0) return null;
  const nombre = noEntran[0].titulo ?? '';
  return noEntran.length === 1
    ? t('historiasNoEntranUna', { nombre })
    : t('historiasNoEntranVarias', { nombre, resto: noEntran.length - 1 });
}

// Leyenda bajo el preview; marca las historias que no entran para que se
// puedan encontrar con las flechas.
export function leyendaPosicion(
  { actual, total, nombre, noEntra }: { actual: number; total: number; nombre: string; noEntra: boolean },
  t: Traducir,
): string {
  return t(noEntra ? 'historiaPosicionNoEntra' : 'historiaPosicion', { actual, total, nombre });
}

// "Guardar" / "Compartir", con la cantidad cuando se exportan varias imágenes.
export function etiquetaAccion(accion: 'guardar' | 'compartir', cantidad: number, t: Traducir): string {
  if (cantidad <= 1) return t(accion === 'guardar' ? 'save' : 'share');
  return t(accion === 'guardar' ? 'guardarVarias' : 'compartirVarias', { count: cantidad });
}
