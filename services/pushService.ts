import api from '@/lib/api';

export interface SuscripcionPush {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  content_encoding?: string;
  user_agent?: string;
}

export const pushService = {
  getPublicKey: async (): Promise<string> => {
    const { data } = await api.get<{ public_key: string }>('/push/public-key');
    return data.public_key;
  },
  guardarSuscripcion: async (s: SuscripcionPush): Promise<void> => {
    await api.post('/push/subscriptions', s);
  },
  // `token` explícito: el logout limpia localStorage antes de llamar, y el
  // interceptor lee el token de ahí; sin esto el DELETE saldría sin sesión.
  borrarSuscripcion: async (endpoint: string, token?: string | null): Promise<void> => {
    await api.delete('/push/subscriptions', {
      data: { endpoint },
      ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
    });
  },
};
