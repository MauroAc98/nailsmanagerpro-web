import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  // Bound every request so a hung connection can never wedge the caller
  // forever — most critically the boot `subscription-status` call, which
  // gates the whole app behind a blank screen until it settles. 15s is long
  // enough for the slowest normal endpoint yet short enough to fail fast.
  // Calls that legitimately need longer (e.g. the WhatsApp Embedded Signup
  // connect on `adminApi`) pass their own `timeout` override.
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Interceptor para agregar el token en cada request. localStorage puede
// tirar (modo privado de iOS Safari, storage deshabilitado) — sin el
// try/catch, esa excepción rompía la request entera y un fallo de storage
// se confundía con un login inválido pese a que el backend nunca llegaba a
// ver la request. Mismo patrón que useThemeStore/useLocaleStore.
api.interceptors.request.use((config) => {
  let token: string | null = null;
  try {
    token = localStorage.getItem('auth_token');
  } catch {
    // sin acceso a localStorage — seguimos sin el header de auth en vez de romper la request
  }
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Intent-only (design D3): the interceptor NEVER mutates the auth store or
// latches subscription state. It clears the stored token synchronously on 401
// (so a reload cannot re-auth) and emits a single `window` CustomEvent asking
// the store to run the authoritative transition. `app/providers.tsx` listens
// and delegates to `handleSessionRevoked()` / `recheckSubscription()`.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;

    if (status === 401) {
      try {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
      } catch {
        // sin acceso a localStorage — igual avisamos del logout vía el evento
      }
      window.dispatchEvent(new CustomEvent('auth:session-revoked'));
    }

    // Any 403 on a gated endpoint — a known `SUBSCRIPTION_*` / `NO_SUBSCRIPTION`
    // code, an unrecognized future code, or no code at all — is treated as a
    // "recheck" hint, never a direct block. The store calls
    // `/auth/subscription-status` (single-flighted) and that result is
    // authoritative; a spurious permission 403 just triggers a no-op recheck.
    if (status === 403) {
      window.dispatchEvent(new CustomEvent('auth:subscription-suspect'));
    }

    return Promise.reject(error);
  }
);

export default api;