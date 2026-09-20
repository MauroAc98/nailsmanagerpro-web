// Utilidades de las fotos de trabajos de un servicio (lado del salon, mock).
// Mientras el backend no tenga almacenamiento las fotos viven como data URLs en
// localStorage, por eso se reducen y se topea su tamano.

// Tope por foto ya reducida: 12 fotos de 400 KB caben en la cuota de localStorage.
export const TOPE_BYTES_FOTO = 400 * 1024;
const LADO_MAXIMO_PX = 1024;
const CALIDAD_JPEG = 0.72;

// Mueve el elemento `indice` `delta` posiciones (la primera es la portada).
// En los extremos no hace nada. Siempre devuelve una lista nueva. Generico:
// lo usa tanto el viejo mock (arrays de data URLs) como
// FotosServicioEditor (arrays de ids numericos, para el reordenar real).
export function moverFoto<T>(fotos: T[], indice: number, delta: -1 | 1): T[] {
  const destino = indice + delta;
  const copia = [...fotos];
  if (indice < 0 || indice >= fotos.length || destino < 0 || destino >= fotos.length) return copia;
  [copia[indice], copia[destino]] = [copia[destino], copia[indice]];
  return copia;
}

export function quitarFoto(fotos: string[], indice: number): string[] {
  return fotos.filter((_, i) => i !== indice);
}

// Bytes decodificados aproximados de un data URL base64.
export function bytesDeDataUrl(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const relleno = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - relleno;
}

const leerComoDataUrl = (archivo: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(String(lector.result));
    lector.onerror = () => reject(lector.error);
    lector.readAsDataURL(archivo);
  });

// Convierte un archivo de imagen en data URL, reducido a LADO_MAXIMO_PX en el
// lado mayor y recomprimido a JPEG. Si el entorno no puede decodificar/dibujar
// (sin createImageBitmap/canvas) cae al data URL original.
export async function reducirImagen(archivo: File): Promise<string> {
  try {
    if (typeof createImageBitmap === 'function' && typeof document !== 'undefined') {
      const bitmap = await createImageBitmap(archivo);
      const escala = Math.min(1, LADO_MAXIMO_PX / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bitmap.width * escala);
      canvas.height = Math.round(bitmap.height * escala);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close?.();
        return canvas.toDataURL('image/jpeg', CALIDAD_JPEG);
      }
    }
  } catch {
    // formato no decodificable en este navegador: se usa el original
  }
  return leerComoDataUrl(archivo);
}
