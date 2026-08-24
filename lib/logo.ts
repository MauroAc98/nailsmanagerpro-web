// Proporción fija del logo del negocio en todo el resto de la app (el
// object-fit:contain de LoginScreen, LOGO_MAX_HEIGHT ahí, ver
// components/LoginScreen.tsx) — LogoCropModal fuerza el recorte a este mismo
// aspect ratio, así lo que sale de acá siempre calza sin dejar franjas de
// color alrededor ni depender de que el negocio suba a mano la proporción
// "correcta".
export const LOGO_ASPECT_RATIO = 3 / 2; // ancho:alto
const LOGO_CANVAS_WIDTH = 1200;
const LOGO_CANVAS_HEIGHT = Math.round(LOGO_CANVAS_WIDTH / LOGO_ASPECT_RATIO); // 800

export interface AreaRecorte {
  x: number;
  y: number;
  width: number;
  height: number;
}

function cargarImagen(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('recortarLogo: no se pudo cargar la imagen elegida'));
    img.src = url;
  });
}

// Toma el área que el usuario recortó en LogoCropModal (en píxeles de la
// imagen original, ya con el aspect ratio 3:2 forzado por el Cropper) y la
// redibuja en un lienzo de tamaño fijo — normaliza el archivo final a un
// tamaño consistente sin importar la resolución de la foto subida.
export async function recortarLogo(imageSrc: string, area: AreaRecorte): Promise<File> {
  const img = await cargarImagen(imageSrc);

  const canvas = document.createElement('canvas');
  canvas.width = LOGO_CANVAS_WIDTH;
  canvas.height = LOGO_CANVAS_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('recortarLogo: sin contexto 2d');

  ctx.drawImage(
    img,
    area.x, area.y, area.width, area.height,
    0, 0, LOGO_CANVAS_WIDTH, LOGO_CANVAS_HEIGHT,
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) {
        reject(new Error('recortarLogo: toBlob devolvió null'));
        return;
      }
      resolve(new File([blob], 'logo.png', { type: 'image/png' }));
    }, 'image/png');
  });
}
