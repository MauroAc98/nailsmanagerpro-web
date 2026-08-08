import { useLocaleStore } from '@/store/useLocaleStore';

// Utilidad única de nombres de día/mes, consolidando los arrays locales de
// 'Lunes'/'Enero' que estaban duplicados en 8 archivos (ver design.md,
// Fase 2 — "Date util consolidation"). Construida sobre `Intl.DateTimeFormat`
// leyendo el locale activo, no sobre next-intl `useFormatter` — tres de los
// call sites (useGenerarHistoria.ts, y en el futuro whatsappHelper.ts /
// turnoValidaciones.ts) no son componentes React y no pueden usar un hook.
//
// Gotcha documentado en el design: `Intl` devuelve los nombres en minúscula
// para es/pt-BR ('domingo', 'enero'), mientras los arrays reemplazados acá
// estaban capitalizados ('Domingo', 'Enero') o en mayúsculas totales
// ('DOM'). La capitalización queda siempre explícita en esta utilidad —
// nunca implícita ni delegada al call site — para que ningún reemplazo
// cambie el texto visible.

export type FormatoNombre = 'long' | 'short';
export type Capitalizacion = 'ninguna' | 'primera' | 'mayusculas';

function localeActivo(): string {
  return useLocaleStore.getState().locale;
}

function capitalizar(texto: string, capitalizacion: Capitalizacion): string {
  switch (capitalizacion) {
    case 'mayusculas':
      return texto.toUpperCase();
    case 'primera':
      return texto.charAt(0).toUpperCase() + texto.slice(1);
    case 'ninguna':
    default:
      return texto;
  }
}

/**
 * Nombre del día de la semana de `fecha` en el locale activo.
 * `formato='short'` da la abreviatura de 3 letras usada en headers de
 * calendario ('Dom', 'Lun', ...); `'long'` da el nombre completo
 * ('Domingo', 'Lunes', ...).
 */
export function nombreDia(
  fecha: Date,
  formato: FormatoNombre = 'long',
  capitalizacion: Capitalizacion = 'primera'
): string {
  const nombre = new Intl.DateTimeFormat(localeActivo(), { weekday: formato }).format(fecha);
  return capitalizar(nombre, capitalizacion);
}

/**
 * Nombre del mes de `fecha` en el locale activo. Mismo motivo de
 * capitalización explícita que `nombreDia`.
 */
export function nombreMes(
  fecha: Date,
  formato: FormatoNombre = 'long',
  capitalizacion: Capitalizacion = 'primera'
): string {
  const nombre = new Intl.DateTimeFormat(localeActivo(), { month: formato }).format(fecha);
  return capitalizar(nombre, capitalizacion);
}

/**
 * Los 7 nombres cortos de día en orden Domingo..Sábado — mismo orden que
 * `Date#getDay()` — para headers de calendario tipo "Dom Lun Mar...".
 * Se calcula sobre una semana ancla fija en hora LOCAL (2023-01-01 fue
 * domingo). Es clave que sea local y no UTC: `Intl.DateTimeFormat` formatea
 * en el huso horario local del navegador por default (igual que
 * `Date#getDay()`, que usan el resto de los call sites de esta utilidad).
 * Un ancla en UTC desalinea el índice del día un día completo para husos
 * negativos como Argentina/Brasil (UTC-3): medianoche UTC del 1/1/2023 cae
 * el 31/12/2022 a la tarde en hora local, un sábado, no un domingo.
 */
export function diasSemanaCortos(capitalizacion: Capitalizacion = 'primera'): string[] {
  const domingoBase = new Date(2023, 0, 1);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(domingoBase);
    d.setDate(domingoBase.getDate() + i);
    return nombreDia(d, 'short', capitalizacion);
  });
}

/**
 * Presets de formateo compuesto para los patrones que ya se repetían
 * byte-a-byte entre pantallas antes de esta consolidación.
 * - `diaSemanaFechaMes`: "Domingo, 5 De Enero" (día largo, fecha, "De"
 *   capitalizado tal como lo tenían `agenda/[id]/page.tsx` y
 *   `agenda/nuevo/page.tsx`).
 */
export type PresetFecha = 'diaSemanaFechaMes';

export function formatFecha(fecha: Date, preset: PresetFecha): string {
  switch (preset) {
    case 'diaSemanaFechaMes':
      return `${nombreDia(fecha, 'long')}, ${fecha.getDate()} De ${nombreMes(fecha, 'long')}`;
  }
}

/**
 * Fecha de mañana en formato "YYYY-MM-DD". Construida a mano (no
 * `toISOString()`) para evitar el corrimiento de día que mete la
 * conversión a UTC en husos horarios negativos como ART.
 */
export function fechaDeManana(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
