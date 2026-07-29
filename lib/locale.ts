// Fuente única de verdad de los locales soportados por la app, compartida
// entre el script inline de app/layout.tsx (evita el flash de idioma
// incorrecto), store/useLocaleStore.ts y messages/index.ts.
//
// `Locale` incluye los 3 valores que el backend puede persistir, pero
// `SUPPORTED` solo expone los que ya tienen catálogo completo y selector
// visible. pt-BR se agrega a SUPPORTED recién en la Fase 11 (catálogo
// completo); hasta entonces resolveLocale() degrada cualquier valor no
// soportado a 'es', igual que si el campo del backend no existiera.

export type Locale = 'es' | 'pt-BR' | 'en';

export const DEFAULT_LOCALE: Locale = 'es';

// Fase 1: solo 'es' es un locale seleccionable. pt-BR se habilita en la
// Fase 11 cuando su catálogo esté completo (ver design.md, "Migration /
// Rollout"). 'en' nunca se agrega — es scaffold estructural puro, cae
// siempre al fallback de 'es' (ver spec, "en Scaffold Only, es Fallback").
export const SUPPORTED: readonly Locale[] = ['es'];

// Autónimos: cada idioma se muestra en su propio nombre (igual que
// cualquier selector de idioma estándar), no traducido al locale activo.
// Cubre los 3 valores de Locale aunque hoy solo 'es' esté en SUPPORTED —
// el selector de Fase 4 itera SUPPORTED, así que agregar pt-BR a
// SUPPORTED en la Fase 11 alcanza para que aparezca sin tocar este mapa.
export const LOCALE_LABELS: Record<Locale, string> = {
  es: 'Español',
  'pt-BR': 'Português (Brasil)',
  en: 'English',
};

/**
 * Resuelve un valor arbitrario (string del backend, localStorage, JSON
 * parseado, etc.) a un Locale válido y soportado. Cualquier valor
 * ausente, null, inválido o todavía no soportado degrada a DEFAULT_LOCALE.
 */
export function resolveLocale(raw: unknown): Locale {
  if (typeof raw === 'string' && (SUPPORTED as readonly string[]).includes(raw)) {
    return raw as Locale;
  }
  return DEFAULT_LOCALE;
}
