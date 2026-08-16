// Encaja cualquier logo subido dentro de un lienzo 3:2 fijo, sin recortarlo
// (mismo criterio "nunca se recorta" que el object-fit:contain de
// LoginScreen — LOGO_MAX_HEIGHT ahí ya está calibrado para esta proporción,
// ver components/LoginScreen.tsx). Normaliza la salida para que todos los
// logos se muestren con el mismo encuadre, en vez de depender de que cada
// negocio suba a mano la proporción "correcta". Fondo transparente (PNG):
// el margen que deja el contain se funde con el tinte del hero sea cual sea
// el color del logo.
//
// Mismo patrón Image+objectURL+canvas que resizeFondoFile
// (lib/historia/captura.ts) en vez de createImageBitmap — por las mismas
// dudas de soporte/WebKit que documenta ese archivo.
const LOGO_ASPECT_RATIO = 3 / 2; // ancho:alto
const LOGO_CANVAS_WIDTH = 1200;
const LOGO_CANVAS_HEIGHT = Math.round(LOGO_CANVAS_WIDTH / LOGO_ASPECT_RATIO); // 800

export function ajustarLogoAProporcion(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      const escala = Math.min(
        LOGO_CANVAS_WIDTH / img.naturalWidth,
        LOGO_CANVAS_HEIGHT / img.naturalHeight,
      );
      const anchoDestino = img.naturalWidth * escala;
      const altoDestino = img.naturalHeight * escala;

      const canvas = document.createElement('canvas');
      canvas.width = LOGO_CANVAS_WIDTH;
      canvas.height = LOGO_CANVAS_HEIGHT;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('ajustarLogoAProporcion: sin contexto 2d'));
        return;
      }

      ctx.drawImage(
        img,
        (LOGO_CANVAS_WIDTH - anchoDestino) / 2,
        (LOGO_CANVAS_HEIGHT - altoDestino) / 2,
        anchoDestino,
        altoDestino,
      );
      URL.revokeObjectURL(objectUrl);

      canvas.toBlob(blob => {
        if (!blob) {
          reject(new Error('ajustarLogoAProporcion: toBlob devolvió null'));
          return;
        }
        resolve(new File([blob], 'logo.png', { type: 'image/png' }));
      }, 'image/png');
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('ajustarLogoAProporcion: no se pudo cargar la imagen elegida'));
    };

    img.src = objectUrl;
  });
}
