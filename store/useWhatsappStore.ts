import { create } from 'zustand';
import { whatsappService, WhatsappEstado } from '@/services/whatsappService';

interface WhatsappState {
  estado: WhatsappEstado;
  qrBase64: string | null;
  loading: boolean;
  polling: boolean;

  conectar: () => Promise<boolean>;
  consultarEstado: () => Promise<void>;
  desconectar: () => Promise<void>;
  iniciarPolling: () => void;
  detenerPolling: () => void;
  reset: () => void;
}

let pollingInterval: ReturnType<typeof setInterval> | null = null;
let qrRefreshInterval: ReturnType<typeof setInterval> | null = null;
const QR_REFRESH_MS = 25_000;

export const useWhatsappStore = create<WhatsappState>((set, get) => ({
  estado: 'desconectado',
  qrBase64: null,
  loading: false,
  polling: false,

  conectar: async () => {
    set({ loading: true });
    try {
      const { qr_base64, estado } = await whatsappService.conectar();
      set({ qrBase64: qr_base64, estado, loading: false });
      get().iniciarPolling();
      return true;
    } catch {
      set({ loading: false });
      return false;
    }
  },

  consultarEstado: async () => {
    try {
      const { estado } = await whatsappService.consultarEstado();
      set({ estado });
      if (estado === 'conectado') get().detenerPolling();
    } catch {
      // silent — polling retries on next cycle
    }
  },

  desconectar: async () => {
    set({ loading: true });
    try {
      await whatsappService.desconectar();
      set({ estado: 'desconectado', qrBase64: null, loading: false });
      get().detenerPolling();
    } catch {
      set({ loading: false });
    }
  },

  iniciarPolling: () => {
    if (pollingInterval) return;
    set({ polling: true });

    pollingInterval = setInterval(() => get().consultarEstado(), 3_000);

    qrRefreshInterval = setInterval(async () => {
      if (get().estado === 'conectado') return;
      try {
        const { qr_base64 } = await whatsappService.conectar();
        set({ qrBase64: qr_base64 });
      } catch {
        // keep existing QR visible, retry next cycle
      }
    }, QR_REFRESH_MS);
  },

  detenerPolling: () => {
    if (pollingInterval)   { clearInterval(pollingInterval);   pollingInterval = null; }
    if (qrRefreshInterval) { clearInterval(qrRefreshInterval); qrRefreshInterval = null; }
    set({ polling: false });
  },

  reset: () => {
    get().detenerPolling();
    set({ estado: 'desconectado', qrBase64: null, loading: false });
  },
}));
