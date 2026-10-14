'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { agendaColors as colors } from '@/theme/agendaColors';
import { useAuthStore } from '@/store/useAuthStore';
import { senaConfigurada } from '@/lib/senaPreview';
import { reservaOnlineActivaParaNegocio } from '@/lib/reservaOnline/activa';

const CLAVE_CERRADO = 'aviso_comision_sena_cerrado';

const botonTextoStyle = {
  minHeight: 44, padding: 0, background: 'none', border: 'none', cursor: 'pointer',
  color: colors.primaryDeep, fontSize: 13.5, fontWeight: 600, textAlign: 'left',
} as const;

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
interface Props {
  // Primer servicio con precio: el aviso lleva directo ahí, donde está la sugerencia.
  primero?: { id: number; nombre: string } | null;
  onVer?: (id: number) => void;
}

export default function AvisoComisionSena({ primero, onVer }: Props = {}) {
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
        margin: '0 20px 14px', padding: '12px 14px', borderRadius: 12,
        backgroundColor: colors.surfaceSubtle, display: 'flex', flexDirection: 'column', gap: 4,
      }}
    >
      <span style={{ fontSize: 13.5, lineHeight: 1.45, color: colors.text }}>{t('body')}</span>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        {primero && onVer ? (
          <button type="button" onClick={() => onVer(primero.id)} style={botonTextoStyle}>
            {t('seeFirst', { nombre: primero.nombre })}
          </button>
        ) : <span />}
        <button type="button" onClick={cerrar} style={{ ...botonTextoStyle, color: colors.subtext, fontWeight: 500 }}>
          {t('close')}
        </button>
      </div>
    </div>
  );
}
