'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { agendaColors as colors } from '@/theme/agendaColors';
import { useAuthStore } from '@/store/useAuthStore';
import { senaConfigurada } from '@/lib/senaPreview';
import { reservaOnlineActivaParaNegocio } from '@/lib/reservaOnline/activa';

const CLAVE_CERRADO = 'aviso_comision_sena_cerrado';

function leerCerrado(): boolean {
  try {
    return window.sessionStorage.getItem(CLAVE_CERRADO) === '1';
  } catch {
    return false;
  }
}

// Aviso de la lista de servicios: con seña por porcentaje, la comisión de Mercado
// Pago sale de la seña y cada servicio puede mostrar un precio sugerido para
// cubrirla. Se puede cerrar y vuelve la próxima vez que se abre la app (se recuerda solo en la sesión).
// Solo existe si hay algo que avisar: seña por porcentaje bien configurada,
// comisión vigente mayor a 0 y reserva online activa.
export default function AvisoComisionSena() {
  const t = useTranslations('configuracion.AvisoComisionSena');
  const user = useAuthStore(s => s.user);
  const [cerrado, setCerrado] = useState(leerCerrado);

  if (cerrado || !user) return null;
  if (user.sena_tipo !== 'porcentaje' || !senaConfigurada(user)) return null;
  if (!((user.comision_mp_vigente ?? 0) > 0)) return null;
  if (!reservaOnlineActivaParaNegocio(user)) return null;

  const cerrar = () => {
    setCerrado(true);
    try {
      window.sessionStorage.setItem(CLAVE_CERRADO, '1');
    } catch {
      // sin almacenamiento: el aviso se cierra solo hasta salir de la lista
    }
  };

  return (
    <div
      role="note"
      style={{
        margin: '0 20px 14px', padding: '12px 12px 12px 14px', borderRadius: 12,
        backgroundColor: colors.surfaceSubtle, display: 'flex', alignItems: 'flex-start', gap: 10,
      }}
    >
      <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, lineHeight: 1.45, color: colors.text }}>
        {t('body')}
      </span>
      <button
        type="button"
        onClick={cerrar}
        aria-label={t('close')}
        style={{ flexShrink: 0, display: 'flex', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
      >
        <X size={16} color={colors.muted} strokeWidth={2} />
      </button>
    </div>
  );
}
