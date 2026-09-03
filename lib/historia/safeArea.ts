// Safe-area insets for the shareable "story" exports (agenda StoryCanvas and
// price TarjetaPrecios).
//
// Both canvases export a 1080x1920 (9:16) PNG — the resolution Instagram
// Stories and WhatsApp Estados document as standard (see STORY_EXPORT_WIDTH
// in hooks/useGenerarHistoria.ts). Two things then eat whatever sits near
// the top/bottom edges:
//
//   1. Platform chrome — the avatar + handle + progress bar overlay the top
//      of the viewport, and the caption + reply/send bar overlay the bottom.
//      Anything under them is simply not readable.
//   2. Fill-crop on tall phones — a modern viewport is ~19.5:9 to 20:9, not
//      9:16. Both apps scale the 9:16 media to *fill* that taller frame by
//      default, cropping the edges. The user works around it by pinch-
//      shrinking the image, which then letterboxes it — not what we want.
//
// Meta's published guidance is to keep text and logos clear of roughly the
// top ~11% and bottom ~16% of the 1920px canvas (the bottom is larger
// because the DM/reply bar is taller than the header). We inset the CONTENT
// layer of each canvas by these ratios while the background photo stays
// full-bleed, so the header and footer survive both the chrome and the
// fill-crop with no manual nudging.
//
// Ratios (not fixed px) so the same value holds for the on-screen preview
// (viewport-relative height) and the scaled-up export.

export const SAFE_INSET_TOP_RATIO    = 0.11;
export const SAFE_INSET_BOTTOM_RATIO = 0.16;

export interface SafeAreaInsets {
  top:    number;
  bottom: number;
}

// canvasHeight is 0 until the preview canvas has been measured (canvasWidth
// starts at 0 in useGenerarHistoria) — round(0) is 0, so an unmeasured
// canvas just gets no insets until the first real measurement lands.
export function safeAreaInsets(canvasHeight: number): SafeAreaInsets {
  const h = Number.isFinite(canvasHeight) && canvasHeight > 0 ? canvasHeight : 0;
  return {
    top:    Math.round(h * SAFE_INSET_TOP_RATIO),
    bottom: Math.round(h * SAFE_INSET_BOTTOM_RATIO),
  };
}
