import { create } from 'zustand';
import { loadMessages, es, type Messages } from '@/messages';
import { DEFAULT_LOCALE, resolveLocale, type Locale } from '@/lib/locale';

// Mismo esquema que useThemeStore: el valor real ya fue resuelto y
// aplicado a document.documentElement.lang antes de que React hidrate,
// por el script inline en app/layout.tsx (evita el flash de idioma
// incorrecto). initLocale() solo sincroniza este store con lo que ese
// script ya decidió y carga el catálogo de mensajes correspondiente.

const STORAGE_KEY = 'locale';
const COOKIE_KEY = 'locale';
const AUTH_USER_KEY = 'auth_user';

interface LocaleState {
  locale: Locale;
  messages: Messages;
  mensajesListos: boolean;
}

// `messages` arranca en `es` (no `null`): NextIntlClientProvider necesita un
// catálogo válido desde el primer render de servidor, antes de que
// initLocale() corra en el cliente — si no, cualquier useTranslations()
// evaluado en ese instante (ej. los sheet hosts globales de providers.tsx,
// que se montan siempre) tira MISSING_MESSAGE. `es` ya está importado
// estático, así que no hace falta esperar ningún async import para tenerlo.
export const useLocaleStore = create<LocaleState>(() => ({
  locale: DEFAULT_LOCALE,
  messages: es,
  mensajesListos: false,
}));

function readStoredLocale(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    // localStorage no disponible (ej. modo privado)
    return null;
  }
}

function readAuthUserLocale(): string | null {
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { locale?: unknown };
    return typeof parsed.locale === 'string' ? parsed.locale : null;
  } catch {
    return null;
  }
}

function persistLocale(locale: Locale) {
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // localStorage no disponible — la elección no persiste entre sesiones, no bloqueamos
  }
  document.cookie = `${COOKIE_KEY}=${locale};path=/;max-age=31536000`;
  document.documentElement.lang = locale;
}

// Llamar una sola vez, en cliente, desde el useEffect de montaje en
// app/providers.tsx (igual que initTheme()).
export async function initLocale(): Promise<void> {
  const raw = readStoredLocale() ?? readAuthUserLocale();
  const locale = resolveLocale(raw);
  const messages = await loadMessages(locale);
  useLocaleStore.setState({ locale, messages, mensajesListos: true });
}

// Usado por el selector manual de idioma (Fase 4) y por el reconcile de
// cross-device en useAuthStore (Fase 4). No dispara reload: el
// NextIntlClientProvider re-renderiza todo el árbol con los nuevos
// mensajes.
export async function setLocale(locale: Locale): Promise<void> {
  const messages = await loadMessages(locale);
  persistLocale(locale);
  useLocaleStore.setState({ locale, messages, mensajesListos: true });
}

// Traductor plano para código que corre fuera de un componente (stores,
// hooks, services) y por lo tanto no puede usar el hook useTranslations().
// Solo hace lookup + sustitución simple de tokens `{token}` (no ICU
// completo: sin plural/select) — alcanza para los mensajes de error y
// validación que lo usan, ninguno tiene esas formas. Seguro de llamar desde
// cualquier lado en cualquier momento porque `messages` nunca es null.
export function tStatic(path: string, values?: Record<string, string | number>): string {
  const { messages } = useLocaleStore.getState();
  const template = path
    .split('.')
    .reduce<unknown>((acc, key) => (acc as Record<string, unknown> | undefined)?.[key], messages);
  if (typeof template !== 'string') return path;
  if (!values) return template;
  return Object.entries(values).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, String(v)), template);
}
