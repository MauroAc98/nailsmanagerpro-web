'use client';

import { useTranslations } from 'next-intl';
import type { MpConnection } from '@/lib/reservaOnline/types';
import { agendaColors as colors } from '@/theme/agendaColors';
import { Tarjeta } from './ui';

const AZUL_MP = '#009ee3'; // color de marca de Mercado Pago (no es del tema)

// Tarjeta de conexion con Mercado Pago (mock en el slice 1: el OAuth real llega
// en un slice posterior). Presentacional: recibe el estado y los callbacks.
export function MpConnectionCard({
  mp,
  onConnect,
  onDisconnect,
}: {
  mp: MpConnection;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  const t = useTranslations('reservaOnline.mp');
  return (
    <Tarjeta>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          aria-hidden="true"
          style={{ width: 40, height: 40, borderRadius: 10, background: AZUL_MP, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 13, flexShrink: 0 }}
        >
          MP
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: colors.strong }}>{t('titulo')}</div>
          <div
            style={{
              fontSize: 12, fontWeight: 600, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              color: mp.conectada ? colors.success : colors.sub,
            }}
          >
            {mp.conectada ? t('conectada', { cuenta: mp.cuenta ?? '' }) : t('noConectada')}
          </div>
        </div>
        <button
          type="button"
          onClick={mp.conectada ? onDisconnect : onConnect}
          style={{
            flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            color: mp.conectada ? colors.sub : colors.primaryDeep,
          }}
        >
          {mp.conectada ? t('desconectar') : t('connect')}
        </button>
      </div>
      <div style={{ fontSize: 12, color: colors.sub, marginTop: 10, lineHeight: 1.5 }}>{t('nota')}</div>
    </Tarjeta>
  );
}
