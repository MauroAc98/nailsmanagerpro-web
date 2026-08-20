import { create } from 'zustand';
import { turnoService, Turno } from '@/services/turnoService';
import { extraerMensajeError } from '@/services/clienteService';
import { alertDialog } from '@/store/useConfirmStore';
import { tStatic } from '@/store/useLocaleStore';

interface RecordatoriosPendientesState {
  turnos: Turno[];
  loading: boolean;
  error: string | null;

  fetchRecordatoriosPendientes: () => Promise<void>;
  marcarEnviado: (turnoId: number) => Promise<void>;
  marcarConfirmacionManual: (turnoId: number) => Promise<void>;
}

export const useRecordatoriosPendientesStore = create<RecordatoriosPendientesState>((set, get) => ({
  turnos: [],
  loading: false,
  error: null,

  fetchRecordatoriosPendientes: async () => {
    // Antes esto se gateaba acá mismo con
    // `useAuthStore.getState().user?.whatsapp_requiere_envio_manual` — la
    // lógica era "el 99% de las cuentas tiene el WhatsApp automático sano,
    // no vale la pena gastarles una request". Eso ya no es cierto: ese 99%
    // puede tener envíos automáticos individuales que fallan (número
    // inválido, plantilla rechazada, etc.) y antes nadie se enteraba. El
    // endpoint ahora cubre ambos casos (ver TurnoController::recordatoriosPendientes),
    // así que el fetch tiene que correr siempre, para cualquier cuenta.
    set({ loading: true, error: null });
    try {
      // El backend ya devuelve la unión de "turnos de mañana sin
      // recordatorio gestionado" (cuentas de envío manual) y "envíos
      // automáticos fallidos" (cualquier cuenta), con cliente con teléfono
      // — no hace falta repetir ese filtro acá.
      const turnos = await turnoService.recordatoriosPendientes();
      set({ turnos });
    } catch (e) {
      // No se pisa `turnos` acá a propósito: si ya había datos de un fetch
      // anterior exitoso, un fallo puntual no debe hacerlos desaparecer.
      // `error` es lo que le avisa al banner que el conteo puede no ser
      // confiable — ver RecordatoriosPendientesBanner.
      set({ error: extraerMensajeError(e) });
    } finally {
      set({ loading: false });
    }
  },

  marcarEnviado: async (turnoId) => {
    set({ turnos: get().turnos.filter(t => t.id !== turnoId) }); // optimista
    try {
      await turnoService.marcarRecordatorioManual(turnoId);
    } catch (e) {
      console.error('marcarRecordatorioManual:', e);
      // No revertimos el filtro optimista: si falló, el próximo fetch
      // (foreground) lo va a traer de nuevo si de verdad no quedó guardado
      // — pero eso pasa en silencio; sin este aviso la profesional cree que
      // ya lo gestionó y no se entera de que hay que reintentar.
      await alertDialog(tStatic('agenda.RecordatoriosPendientesPage.marcarEnviadoError'));
    }
  },

  marcarConfirmacionManual: async (turnoId) => {
    set({ turnos: get().turnos.filter(t => t.id !== turnoId) }); // optimista
    try {
      await turnoService.marcarConfirmacionManual(turnoId);
    } catch (e) {
      console.error('marcarConfirmacionManual:', e);
      // Mismo criterio que marcarEnviado: no revertimos el filtro optimista,
      // solo avisamos para que la profesional sepa que puede tener que
      // reintentar más tarde.
      await alertDialog(tStatic('agenda.RecordatoriosPendientesPage.marcarEnviadoError'));
    }
  },
}));
