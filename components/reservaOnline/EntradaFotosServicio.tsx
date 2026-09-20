'use client';

import { useTranslations } from 'next-intl';
import { reservaOnlineHabilitada } from '@/lib/reservaOnline';
import { servicioService } from '@/services/servicioService';
import { agendaColors as colors, agendaShadows as shadows } from '@/theme/agendaColors';
import { useCarga } from './hooks';
import { IcoImagen } from './iconos';

// Fila "Fotos de tus trabajos" de Configuracion > Servicios > editar servicio.
// Oculta con la flag apagada; abre el gestor de fotos del servicio. Lee la
// cantidad via servicioService (autenticado, lib/api) — este es un
// componente de Configuracion, no del flujo publico de reserva online, asi
// que no pasa por getService()/lib/reservaOnline.
export function EntradaFotosServicio({ servicioId, onAbrir }: { servicioId: number; onAbrir: () => void }) {
  const habilitada = reservaOnlineHabilitada();
  const t = useTranslations('reservaOnline');
  const { data } = useCarga(
    () => (habilitada ? servicioService.getOne(servicioId).then((s) => s.fotos ?? []) : Promise.resolve([])),
    `entrada-fotos|${habilitada}|${servicioId}`,
  );
  if (!habilitada) return null;

  return (
    <button
      type="button"
      onClick={onAbrir}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', cursor: 'pointer',
        background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 12, boxShadow: shadows.card,
        padding: '12px 16px',
      }}
    >
      <IcoImagen color={colors.primaryDeep} size={20} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: colors.text }}>{t('fotos.fila')}</span>
        <span style={{ display: 'block', fontSize: 12, color: colors.sub, marginTop: 2 }}>
          {data && data.length > 0 ? t('servicios.fotos', { count: data.length }) : t('fotos.sinFotos')}
        </span>
      </span>
      <span aria-hidden="true" style={{ color: colors.muted, fontSize: 18 }}>›</span>
    </button>
  );
}
