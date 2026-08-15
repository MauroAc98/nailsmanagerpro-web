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
  primarySoft: 'var(--ag-primary-soft)',
  primaryFg: 'var(--ag-primary-fg)',
  amber: 'var(--ag-amber)',
  amberBg: 'var(--ag-amber-bg)',
  amberFg: 'var(--ag-amber-fg)',
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
  successBorder: 'color-mix(in srgb, var(--ag-success) 45%, transparent)',
  dangerBg: 'color-mix(in srgb, var(--ag-danger) 12%, transparent)',
  dangerBorder: 'color-mix(in srgb, var(--ag-danger) 45%, transparent)',
  // Global directo (no --ag-*): el mismo rosa clarito que usa ServicioCard/
  // GastoCard para el fondo del swipe-to-delete. Antes apuntaba a
  // --ag-danger (igual que `danger`), dejando el ícono/texto del mismo
  // color que su propio fondo — invisibles.
  dangerAccent: 'var(--color-danger-accent)',
  primaryDisabled: 'color-mix(in srgb, var(--ag-primary) 35%, transparent)',
};

export const agendaShadows = {
  card: '0 1px 3px rgba(0, 0, 0, 0.06)',
  sheet: '0 -8px 28px rgba(0, 0, 0, 0.14)',
};

// Agenda-scoped serif — same self-hosted next/font/google pattern as
// serifDisplay in app/layout.tsx (Cormorant, opted-in per component via a
// CSS variable), so the "Mi Agenda" header / turno-card time / calendar
// month / bottom-sheet title match the v0 redesign's Playfair Display
// without swapping the app-wide sans body font.
export const agendaFontSerif = 'var(--font-agenda-serif), Georgia, serif';
