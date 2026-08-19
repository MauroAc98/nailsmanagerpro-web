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
let qrRefreshTimeout: ReturnType<typeof setTimeout> | null = null;
let pollingIniciadoEn: number | null = null;
let qrRefreshDelay = 0;

// Cada refresh de QR pega instance/connect en Evolution, que reinicia el
// socket de Baileys. A ritmo fijo (antes: cada 25s siempre) esto genera un
// patrón de reconexión metronómico que WhatsApp puede leer como
// automatización. El backoff progresivo espacia los reintentos en vez de
// martillar Evolution al mismo ritmo mientras la profesional no escanea.
const QR_REFRESH_MS_INICIAL = 25_000;
const QR_REFRESH_MS_MAX     = 60_000;
const QR_REFRESH_BACKOFF    = 1.5;
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

    const refrescarQr = async () => {
      if (get().estado !== 'conectado') {
        try {
          const { qr_base64 } = await whatsappService.conectar();
          set({ qrBase64: qr_base64 });
        } catch {
          // se mantiene el QR visible, reintenta con el próximo delay
        }
      }

      qrRefreshDelay = Math.min(qrRefreshDelay * QR_REFRESH_BACKOFF, QR_REFRESH_MS_MAX);
      qrRefreshTimeout = setTimeout(refrescarQr, qrRefreshDelay);
    };

    qrRefreshDelay = QR_REFRESH_MS_INICIAL;
    qrRefreshTimeout = setTimeout(refrescarQr, qrRefreshDelay);
  },

  detenerPolling: () => {
    if (pollingInterval)  { clearInterval(pollingInterval);  pollingInterval = null; }
    if (qrRefreshTimeout) { clearTimeout(qrRefreshTimeout);  qrRefreshTimeout = null; }
    pollingIniciadoEn = null;
    qrRefreshDelay = 0;
    set({ polling: false });
  },

  reset: () => {
    get().detenerPolling();
    set({ estado: 'desconectado', qrBase64: null, loading: false, error: null, expirado: false });
  },
}));
