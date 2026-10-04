import axios from 'axios';

// Instancia de Axios completamente separada de lib/api.ts (la del tenant).
// Ver design admin-panel decisión #7 (frontend isolation): un interceptor
// compartido limpiaría auth_token/auth_user cuando el token admin expira,
// desconectando a la profesional logueada sin que ella hiciera nada.
const adminApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Mismo criterio que lib/api.ts: localStorage puede tirar (modo privado de
// iOS Safari, storage deshabilitado) — sin el try/catch, esa excepción rompe
// la request entera y un fallo de storage se confunde con un login inválido.
adminApi.interceptors.request.use((config) => {
  let token: string | null = null;
  try {
    token = localStorage.getItem('admin_token');
  } catch {
    // sin acceso a localStorage — seguimos sin el header de auth en vez de romper la request
  }
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 'admin-session-expired' es un evento propio, distinto de 'session-expired'
// (lib/api.ts). app/(admin)/admin/layout.tsx escucha este y pide
// reautenticación en useAdminAuthStore — nunca toca useAuthStore/auth_token.
// Un 401 admin no debe poder disparar el logout tenant bajo ninguna
// circunstancia.
//
// Deliberadamente NO borra admin_token/admin_user de localStorage acá
// (a diferencia de antes) — el store mantiene el token/admin en memoria para
// que la pantalla actual (y cualquier formulario sin guardar) siga montada
// mientras se pide reautenticación; ver useAdminAuthStore.reautenticacionRequerida.
// Un reingreso exitoso sobreescribe el token guardado; un logout explícito
// (botón "Cerrar sesión" del modal) limpia localStorage por su cuenta.
adminApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      window.dispatchEvent(new CustomEvent('admin-session-expired'));
    }
    return Promise.reject(error);
  }
);

export default adminApi;
