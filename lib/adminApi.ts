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
// (lib/api.ts). app/(admin)/admin/layout.tsx escucha este y solo limpia
// useAdminAuthStore — nunca useAuthStore/auth_token. Un 401 admin no debe
// poder disparar el logout tenant bajo ninguna circunstancia.
adminApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      try {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
      } catch {
        // sin acceso a localStorage — igual avisamos del logout vía el evento
      }
      window.dispatchEvent(new CustomEvent('admin-session-expired'));
    }
    return Promise.reject(error);
  }
);

export default adminApi;
