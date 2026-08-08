import { useEffect, useState } from 'react';
import { authService, WhatsappTemplate, TipoPlantilla } from '@/services/authService';
import { extraerMensajeError } from '@/services/clienteService';

const DEFAULTS: Record<TipoPlantilla, string> = {
  recordatorio: 'Hola {nombre} 💅 Te recuerdo tu turno el {fecha} a las {hora} para {servicios}. ¡Te espero!',
  confirmacion: 'Hola {nombre} 💅 Tu turno de {servicios} está confirmado para el {fecha} a las {hora}. ¡Te espero!',
};

export function useWhatsappTemplates() {
  const [templates, setTemplates] = useState<WhatsappTemplate[]>([]);
  const [cargando,  setCargando]  = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = async () => {
    try {
      setCargando(true);
      const data = await authService.whatsappTemplates.obtener();
      setTemplates(data);
      setError(null);
    } catch (e) {
      console.error('cargar plantillas whatsapp:', e);
      setError(extraerMensajeError(e));
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setCargando(true);
        const data = await authService.whatsappTemplates.obtener();
        if (cancelled) return;
        setTemplates(data);
        setError(null);
      } catch (e) {
        if (cancelled) return;
        console.error('cargar plantillas whatsapp:', e);
        setError(extraerMensajeError(e));
      } finally {
        if (!cancelled) setCargando(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const obtenerContenido = (tipo: TipoPlantilla): string =>
    templates.find(t => t.tipo === tipo)?.contenido ?? DEFAULTS[tipo];

  const actualizar = async (tipo: TipoPlantilla, contenido: string): Promise<boolean> => {
    try {
      setGuardando(true);
      const updated = await authService.whatsappTemplates.actualizar(tipo, contenido);
      setTemplates(prev => prev.map(t => t.tipo === tipo ? updated : t));
      return true;
    } catch (e) {
      console.error('actualizar plantilla whatsapp:', e);
      return false;
    } finally {
      setGuardando(false);
    }
  };

  const resetear = async (tipo: TipoPlantilla): Promise<WhatsappTemplate | null> => {
    try {
      setGuardando(true);
      const reseteada = await authService.whatsappTemplates.resetear(tipo);
      setTemplates(prev => prev.map(t => t.tipo === tipo ? reseteada : t));
      return reseteada;
    } catch (e) {
      console.error('resetear plantilla whatsapp:', e);
      return null;
    } finally {
      setGuardando(false);
    }
  };

  return { templates, cargando, guardando, error, obtenerContenido, actualizar, resetear, recargar: cargar };
}
