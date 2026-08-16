import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
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

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const code   = error.response?.data?.code;

    if (status === 401) {
      try {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
      } catch {
        // sin acceso a localStorage — igual avisamos del logout vía el evento
      }
      window.dispatchEvent(new CustomEvent('session-expired'));
    }

    if (status === 403 && code === 'SUBSCRIPTION_EXPIRED') {
      window.dispatchEvent(new CustomEvent('subscription-expired'));
    }

    return Promise.reject(error);
  }
);

export default api;