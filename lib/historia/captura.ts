// Shared DOM-capture primitives for the historia (story) export pipeline —
// html-to-image serializes the captured node into an SVG foreignObject and
// rasterizes it through its own off-DOM <img>, which can't embed
// cross-origin images served without Access-Control-Allow-Origin, and (on
// iOS WebKit) frequently drops raster images on the first pass unless the
// live <img> has already finished decoding. Every consumer that rasterizes
// a DOM node with <img>s (agenda story — one background photo; price
// story — up to N photos) needs the same fetch->data:/decode()/settle
// sequence before capture, so it lives here once instead of per-hook.
// See design decision D2 in sdd/dynamic-price-story for the full
// rationale and the bug this generalizes away from (a second, un-resized
// photo picked in the same session exporting a black background).

// ─────────────────────────────────────────────
// fetchAsDataUrl — converts a same-origin URL (e.g. our proxy
// /api/historia-fondo) to a data: URL via fetch()+FileReader. Reused both
// by the effect that proactively resolves a saved background/photo as soon
// as it's known, and by prepararImagenesParaCaptura's defensive fallback
// below.
// ─────────────────────────────────────────────
export async function fetchAsDataUrl(url: string): Promise<string> {
  const res  = await fetch(url);
  const blob = await res.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

// ─────────────────────────────────────────────
// resizeFondoFile — client-side resize applied to a picked photo BEFORE it
// ever becomes state or gets uploaded. html-to-image rasterizes embedded
// <img>s at their ORIGINAL resolution regardless of how small the on-screen
// object-fit renders them, and does so twice per capture (warm-up + real
// pass, see prepararImagenesParaCaptura below). An un-resized camera photo
// (easily several MB, thousands of px per side) accumulates decode memory
// pressure across captures — iOS Safari documentedly returns blank/black
// buffers under that pressure instead of throwing, the same silent failure
// mode this whole pipeline works around. Shrinking here, once, keeps every
// downstream step (state, the DOM <img>, both toBlob() passes per capture,
// and any upload + refetch) cheap. Loads the original file via an object
// URL (not FileReader) so a giant base64 of the untouched original is never
// materialized just to be thrown away — the base64 is generated only from
// the already-shrunk blob.
// ─────────────────────────────────────────────
const FONDO_MAX_EDGE     = 1440;
const FONDO_JPEG_QUALITY = 0.82;

export function resizeFondoFile(file: File): Promise<{ dataUrl: string; file: File }> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      const longEdge = Math.max(img.naturalWidth, img.naturalHeight);
      const scale    = longEdge > FONDO_MAX_EDGE ? FONDO_MAX_EDGE / longEdge : 1;
      const targetW  = Math.max(1, Math.round(img.naturalWidth * scale));
      const targetH  = Math.max(1, Math.round(img.naturalHeight * scale));

      const canvas = document.createElement('canvas');
      canvas.width  = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('resizeFondoFile: sin contexto 2d'));
        return;
      }
      ctx.drawImage(img, 0, 0, targetW, targetH);
      URL.revokeObjectURL(objectUrl);

      canvas.toBlob(blob => {
        if (!blob) {
          reject(new Error('resizeFondoFile: toBlob devolvió null'));
          return;
        }
        const resized = new File([blob], 'fondo-historia.jpg', { type: 'image/jpeg' });
        const reader  = new FileReader();
        reader.onload  = () => resolve({ dataUrl: reader.result as string, file: resized });
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      }, 'image/jpeg', FONDO_JPEG_QUALITY);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('resizeFondoFile: no se pudo cargar la imagen elegida'));
    };

    img.src = objectUrl;
  });
}

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

// ─────────────────────────────────────────────
// prepararImagenesParaCaptura — resolves every <img> under `root` that
// isn't already a data: URL to one, waits for every <img> to finish
// decoding, then gives WebKit two paint frames of settle time before the
// caller rasterizes the node with html-to-image.
//
// Generalizes the former single-<img> capture path (a plain
// `querySelector('img')`) to N images so a canvas with multiple photos
// (price story) captures reliably, while staying behavior-neutral for the
// single-image case (agenda story) — N=1 is just this loop's degenerate
// case. Per-image fetch failures are swallowed the same way the singular
// version already did (falls back to the original network URL; the
// decode()/settle step below is still attempted as a best effort).
//
// Returns a Map<originalSrc, dataUrl> instead of touching any component
// state itself — each caller reconciles ITS OWN React state (fondoUri,
// fotos[].url, etc.) from the map; this module holds none.
// ─────────────────────────────────────────────
export async function prepararImagenesParaCaptura(root: HTMLElement): Promise<Map<string, string>> {
  const resueltas = new Map<string, string>();
  const imgs = Array.from(root.querySelectorAll('img'));

  await Promise.all(imgs.map(async img => {
    const src = img.src;
    if (!src || src.startsWith('data:')) return;
    try {
      const dataUrl = await fetchAsDataUrl(src);
      img.src = dataUrl;
      resueltas.set(src, dataUrl);
    } catch {
      // prefetch falló (offline, proxy caído) — seguimos con la url de red
      // original, el decode()+settle de abajo es el mejor esfuerzo que queda
    }
  }));

  await Promise.allSettled(imgs.map(img => img.decode()));

  await nextFrame();
  await nextFrame();

  return resueltas;
}
