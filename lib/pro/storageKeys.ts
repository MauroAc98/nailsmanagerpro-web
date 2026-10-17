// Keys de localStorage de la sesión del portal de profesionales —
// deliberadamente distintas de las del salón (auth_token/auth_user) y de las
// del panel admin (admin_*). Viven en un módulo propio, sin dependencias, para
// que proApi/proService (que las leen y escriben) y el store/guard (que filtra
// el evento `storage` de otras pestañas) compartan la misma fuente.
export const PRO_STORAGE_KEYS = {
  token: 'pro_token',
  tipo: 'pro_token_tipo',
  expiresAt: 'pro_token_expires_at',
  // Solo es el default para el próximo arranque: NO es parte de la sesión y el
  // filtro de sincronización entre pestañas lo ignora (un cambio de negocio en
  // una pestaña no debe mover la agenda de otra).
  ultimoVinculo: 'pro_ultimo_vinculo',
} as const;

const CLAVES_SESION_PRO: readonly string[] = [
  PRO_STORAGE_KEYS.token,
  PRO_STORAGE_KEYS.tipo,
  PRO_STORAGE_KEYS.expiresAt,
];

export function esClaveSesionPro(key: string | null): boolean {
  return key !== null && CLAVES_SESION_PRO.includes(key);
}
