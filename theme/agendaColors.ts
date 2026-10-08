import { withAlpha } from '@/theme/colors';

// Agenda redesign palette — reads the --ag-* custom properties scoped to
// .agenda-light/.agenda-dark (app/globals.css), the same var()-indirection
// pattern as theme/colors.ts but kept separate so this visual refresh stays
// contained to the Agenda screen instead of repainting the whole app.
export const agendaColors = {
  bg: 'var(--ag-bg)',
  surface: 'var(--ag-surface)',
  surface2: 'var(--ag-surface-2)',
  text: 'var(--ag-text)',
  strong: 'var(--ag-strong)',
  sub: 'var(--ag-sub)',
  muted: 'var(--ag-muted)',
  border: 'var(--ag-border)',
  hairline: 'var(--ag-hairline)',
  primary: 'var(--ag-primary)',
  primaryDeep: 'var(--ag-primary-deep)',
  primarySolid: 'var(--ag-primary-solid)',
  primarySoft: 'var(--ag-primary-soft)',
  primaryFg: 'var(--ag-primary-fg)',
  amber: 'var(--ag-amber)',
  amberBg: 'var(--ag-amber-bg)',
  amberFg: 'var(--ag-amber-fg)',
  scrim: 'var(--ag-scrim)',
  success: 'var(--ag-success)',
  successBg: 'var(--ag-success-bg)',
  danger: 'var(--ag-danger)',
  whatsapp: 'var(--ag-whatsapp)',

  // ── theme/colors.ts-compatible aliases ──────────────────────────────
  // app/(app)/agenda/page.tsx (SwipeableTurnoCard, FinalizadoCard,
  // CalendarioMensual, SelectorProfesionalDia, AgendaListHeader,
  // FiltroSheetContent, AgendaPage) was written against the global
  // `colors` object's key names. Mirroring those same keys here — instead
  // of renaming every `colors.x` reference across ~1000 lines of gesture/
  // swipe code — lets that whole file swap its import to this palette
  // (`import { agendaColors as colors } from '@/theme/agendaColors'`)
  // with zero risk of touching the pointer-event math along the way.
  background: 'var(--ag-bg)',
  subtext: 'var(--ag-sub)',
  textStrong: 'var(--ag-strong)',
  surfaceSubtle: 'var(--ag-surface-2)',
  divider: 'var(--ag-hairline)',
  placeholder: 'var(--ag-muted)',
  warningBg: 'var(--ag-amber-bg)',
  warningFg: 'var(--ag-amber-fg)',
  successBorder: withAlpha('var(--ag-success)', '73'),
  // Antes se calculaban con withAlpha sobre --ag-danger en vez de apuntar
  // directo a los mismos hex planos que usa el resto de la app (ServicioCard/
  // GastoCard, el botón de "Cerrar sesión", el badge "cancelado") — dos
  // fórmulas distintas para el mismo "rojo suave" que podían verse
  // ligeramente distintas según qué había detrás del alpha. Alias directo,
  // mismo criterio que --ag-primary.
  dangerBg: 'var(--color-danger-bg)',
  dangerBorder: 'var(--color-danger-border)',
  primaryDisabled: withAlpha('var(--ag-primary)', '59'),
  // Los dos colores de la comparación nuevas/recurrentes en Estadísticas no
  // tienen equivalente --ag-* (no son parte de la paleta de Agenda), así que
  // apuntan directo al global.
  chart1: 'var(--color-chart-1)',
  chart2: 'var(--color-chart-2)',
};

export const agendaShadows = {
  // Subida de 0.06 a 0.10 de opacidad, y de un tinte negro puro a uno cálido
  // (mismo --ag-strong que el texto) — 2026-09-30, feedback de contraste:
  // en modo claro esta sombra era más débil que --shadow-card del tema base
  // (0.09), y junto con --ag-border casi imperceptible dejaba las cards sin
  // separarse de la página. No es theme-scoped (a diferencia de --ag-*): en
  // oscuro la separación ya la da el color de fondo/superficie, así que una
  // sombra un poco más marcada ahí no molesta.
  card: '0 2px 6px rgba(43, 34, 38, 0.10)',
  sheet: '0 -8px 28px rgba(0, 0, 0, 0.14)',
};

// The app's single serif — self-hosted next/font/google (app/layout.tsx),
// opted into per-component via this CSS variable instead of swapping the
// body's sans font globally. Used for every screen title across the app
// (Agenda, Historia, Login, Estadísticas, TarjetaPrecios) — unified from
// three separate serifs (Playfair/Cormorant/Georgia-Times) to this one,
// design decision 2026-08-17.
export const agendaFontSerif = 'var(--font-agenda-serif), Georgia, serif';
