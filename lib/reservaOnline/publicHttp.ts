import axios, { type AxiosAdapter, type AxiosInstance } from 'axios';

// Cliente HTTP de los endpoints publicos /api/public/{slug} (decision D5).
// Instancia AXIOS APARTE de lib/api.ts a proposito: aquella agrega Authorization
// y dispara eventos de sesion en 401/403, y una clienta anonima no tiene sesion
// que revocar. `adapter` es inyectable para stubbear HTTP en los tests sin
// mockear modulos.
export interface PublicHttpOptions {
  baseURL?: string;
  adapter?: AxiosAdapter;
}

export function crearPublicHttp(opts: PublicHttpOptions = {}): AxiosInstance {
  return axios.create({
    baseURL: opts.baseURL ?? process.env.NEXT_PUBLIC_API_URL,
    adapter: opts.adapter,
    timeout: 15000,
  });
}
