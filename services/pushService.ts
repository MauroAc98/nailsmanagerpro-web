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
  borrarSuscripcion: async (endpoint: string): Promise<void> => {
    await api.delete('/push/subscriptions', { data: { endpoint } });
  },
};
