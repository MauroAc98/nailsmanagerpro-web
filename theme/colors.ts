// Los valores reales (claro/oscuro) viven como custom properties en
// app/globals.css (:root y [data-theme="dark"]) — acá solo referenciamos
// los nombres, así el árbol entero de componentes con style={{ color: colors.text }}
// sigue funcionando sin cambios y responde al tema activo automáticamente.
// Valor crudo para consumidores que no pasan por el cascade de CSS y por lo
// tanto no pueden resolver var(...) — ej. el <meta name="theme-color"> del
// viewport de Next.js. Mismo valor en ambos temas (colors.primary no cambia
// entre claro/oscuro), así que no hace falta una versión "oscura".
export const primaryRaw = '#d79ea4';

export const colors = {
  primary: 'var(--color-primary)',
  background: 'var(--color-background)',
  text: 'var(--color-text)',
  subtext: 'var(--color-subtext)',
  border: 'var(--color-border)',
  success: 'var(--color-success)',
  danger: 'var(--color-danger)',
  dangerBg: 'var(--color-danger-bg)',
  dangerBorder: 'var(--color-danger-border)',
  surface: 'var(--color-surface)',
  surfaceSubtle: 'var(--color-surface-subtle)',
  textStrong: 'var(--color-text-strong)',
  muted: 'var(--color-muted)',
  placeholder: 'var(--color-placeholder)',
  divider: 'var(--color-divider)',
  primaryDisabled: 'var(--color-primary-disabled)',
  warningBg: 'var(--color-warning-bg)',
  warningFg: 'var(--color-warning-fg)',
  amber: 'var(--color-amber)',
  amberBg: 'var(--color-amber-bg)',
  successBg: 'var(--color-success-bg)',
  successBorder: 'var(--color-success-border)',
  dangerAccent: 'var(--color-danger-accent)',
  chart1: 'var(--color-chart-1)',
  chart2: 'var(--color-chart-2)',
};

export const shadows = {
  card: 'var(--shadow-card)',
  sheet: 'var(--shadow-sheet)',
};

// Helper para los casos que necesitan una variante translúcida de un color
// del tema (ej. fondo de un toggle "activo" a colors.primary al 40%). Antes
// esto se hacía concatenando un sufijo hex de alpha directo al string
// ('#d79ea4' + '66'), truco que dejó de funcionar al pasar los colores a
// var(...): no se le puede pegar un sufijo hex a una custom property.
// alphaHex es un byte en hex (ej. '66' = ~40%, '22' = ~13%), igual que antes.
export function withAlpha(color: string, alphaHex: string): string {
  const pct = Math.round((parseInt(alphaHex, 16) / 255) * 100);
  return `color-mix(in srgb, ${color} ${pct}%, transparent)`;
}

// Paleta curada para distinguir profesionales en la agenda multi-agenda
// (chips, badges, nombre en las cards). Colores separados entre sí en tono
// para que sean identificables incluso en textos chicos de 9-10px.
export const profesionalPalette = [
  '#d79ea4', // rosa (primary)
  '#8ecae6', // celeste
  '#ffb703', // ámbar
  '#06d6a0', // verde agua
  '#c77dff', // lila
  '#f4978e', // coral
  '#577590', // azul petróleo
  '#9c6644', // marrón
];