import api from '@/lib/api';

export type WhatsappEstado = 'desconectado' | 'conectando' | 'conectado';

export interface ConectarResponse {
  qr_base64: string;
  estado: WhatsappEstado;
}

export interface EstadoResponse {
  estado: WhatsappEstado;
}

export const whatsappService = {
  conectar: async (): Promise<ConectarResponse> => {
    const { data } = await api.post<ConectarResponse>('/whatsapp/conectar');
    return data;
  },

  consultarEstado: async (): Promise<EstadoResponse> => {
    const { data } = await api.get<EstadoResponse>('/whatsapp/estado');
    return data;
  },

  desconectar: async (): Promise<void> => {
    await api.delete('/whatsapp/desconectar');
  },
};
