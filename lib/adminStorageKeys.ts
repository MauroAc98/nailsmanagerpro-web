// Keys de localStorage de la sesión admin — deliberadamente distintas de las
// del salón (auth_token/auth_user, ver services/authService.ts), design
// admin-panel decisión #7. Viven en un módulo propio, sin dependencias, para
// que adminService (que las escribe) y el layout del panel (que filtra el
// evento `storage` de otras pestañas) compartan la misma fuente.
export const ADMIN_STORAGE_KEYS = {
  token: 'admin_token',
  admin: 'admin_user',
  expiresAt: 'admin_token_expires_at',
} as const;

const CLAVES_ADMIN: readonly string[] = Object.values(ADMIN_STORAGE_KEYS);

export function esClaveAdmin(key: string | null): boolean {
  return key !== null && CLAVES_ADMIN.includes(key);
}
