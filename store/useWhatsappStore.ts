import { create } from 'zustand';
import { whatsappService, WhatsappEstado } from '@/services/whatsappService';
import { extraerMensajeError } from '@/services/clienteService';
import { withGlobalLoader } from '@/store/helpers/withGlobalLoader';

interface WhatsappState {
  estado: WhatsappEstado;
  qrBase64: string | null;
  loading: boolean;
  polling: boolean;
  error: string | null;
  // El QR de Evolution expira y el polling se refresca solo, pero si el
  // usuario nunca escanea no tiene sentido pedir códigos nuevos para
  // siempre — a los MAX_POLLING_MS se corta y se pide una acción explícita.
  expirado: boolean;

  conectar: () => Promise<boolean>;
  consultarEstado: () => Promise<void>;
  desconectar: () => Promise<boolean>;
  iniciarPolling: () => void;
  detenerPolling: () => void;
  reset: () => void;
}

let pollingInterval: ReturnType<typeof setInterval> | null = null;
let qrRefreshInterval: ReturnType<typeof setInterval> | null = null;
let pollingIniciadoEn: number | null = null;
const QR_REFRESH_MS   = 25_000;
const MAX_POLLING_MS  = 3 * 60_000; // 3 minutos sin escanear = corta el polling

export const useWhatsappStore = create<WhatsappState>((set, get) => ({
  estado: 'desconectado',
  qrBase64: null,
  loading: false,
  polling: false,
  error: null,
  expirado: false,

  conectar: async () => {
    set({ loading: true, error: null, expirado: false });
    return withGlobalLoader(async () => {
      try {
        const { qr_base64, estado } = await whatsappService.conectar();
        set({ qrBase64: qr_base64, estado, loading: false });
        get().iniciarPolling();
        return true;
      } catch (e) {
        set({ loading: false, error: extraerMensajeError(e) });
        return false;
      }
    });
  },

  consultarEstado: async () => {
    try {
      const { estado } = await whatsappService.consultarEstado();
      set({ estado });
      if (estado === 'conectado') get().detenerPolling();
    } catch {
      // silencioso — el polling reintenta en el próximo ciclo
    }
  },

  desconectar: async () => {
    set({ loading: true, error: null });
    return withGlobalLoader(async () => {
      try {
        await whatsappService.desconectar();
        set({ estado: 'desconectado', qrBase64: null, loading: false });
        get().detenerPolling();
        return true;
      } catch (e) {
        set({ loading: false, error: extraerMensajeError(e) });
        return false;
      }
    });
  },

  iniciarPolling: () => {
    if (pollingInterval) return;
    set({ polling: true, expirado: false });
    pollingIniciadoEn = Date.now();

    pollingInterval = setInterval(() => {
      if (pollingIniciadoEn && Date.now() - pollingIniciadoEn > MAX_POLLING_MS) {
        get().detenerPolling();
        set({ expirado: true });
        return;
      }
      get().consultarEstado();
    }, 3_000);

    qrRefreshInterval = setInterval(async () => {
      if (get().estado === 'conectado') return;
      try {
        const { qr_base64 } = await whatsappService.conectar();
        set({ qrBase64: qr_base64 });
      } catch {
        // se mantiene el QR visible, reintenta el próximo ciclo
      }
    }, QR_REFRESH_MS);
  },

  detenerPolling: () => {
    if (pollingInterval)   { clearInterval(pollingInterval);   pollingInterval = null; }
    if (qrRefreshInterval) { clearInterval(qrRefreshInterval); qrRefreshInterval = null; }
    pollingIniciadoEn = null;
    set({ polling: false });
  },

  reset: () => {
    get().detenerPolling();
    set({ estado: 'desconectado', qrBase64: null, loading: false, error: null, expirado: false });
  },
}));
