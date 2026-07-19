import { create } from 'zustand';

// Preferencia de tema del usuario — 'system' sigue el prefers-color-scheme
// del SO. El valor efectivamente aplicado (resolvedTheme) es siempre
// 'light' | 'dark', nunca 'system': eso es lo que termina en
// document.documentElement.dataset.theme, que es lo que lee app/globals.css.
//
// El valor real ya fue aplicado antes de que React hidrate por el script
// inline en app/layout.tsx (evita el flash blanco); initTheme() solo
// sincroniza este store con lo que ese script ya decidió, y deja armado el
// listener de cambios de tema del SO para cuando la preferencia es 'system'.

export type ThemePreference = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'theme';

interface ThemeState {
  theme: ThemePreference;
  resolvedTheme: ResolvedTheme;
}

export const useThemeStore = create<ThemeState>(() => ({
  theme: 'system',
  resolvedTheme: 'light',
}));

function resolveTheme(pref: ThemePreference): ResolvedTheme {
  if (pref !== 'system') return pref;
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(resolved: ResolvedTheme) {
  document.documentElement.dataset.theme = resolved;
}

function readStoredPreference(): ThemePreference {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  } catch {
    // localStorage no disponible (ej. modo privado) — cae a 'system'
  }
  return 'system';
}

let mediaListenerAttached = false;

function handleSystemChange() {
  if (useThemeStore.getState().theme !== 'system') return;
  const resolved = resolveTheme('system');
  applyTheme(resolved);
  useThemeStore.setState({ resolvedTheme: resolved });
}

// Llamar una sola vez, en cliente (ej. desde el useEffect de montaje en
// app/providers.tsx que ya corre inicializar() de useAuthStore).
export function initTheme() {
  const theme    = readStoredPreference();
  const resolved = resolveTheme(theme);
  applyTheme(resolved);
  useThemeStore.setState({ theme, resolvedTheme: resolved });

  if (!mediaListenerAttached) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', handleSystemChange);
    mediaListenerAttached = true;
  }
}

export function setTheme(theme: ThemePreference) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // localStorage no disponible — la elección no persiste entre sesiones, no bloqueamos
  }
  const resolved = resolveTheme(theme);
  applyTheme(resolved);
  useThemeStore.setState({ theme, resolvedTheme: resolved });
}
