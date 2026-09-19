'use client';

import { useTranslations } from 'next-intl';
import { getService } from '@/lib/reservaOnline';
import { rutaPaso } from '@/lib/reservaOnline/rutas';
import { totalesDeServicios } from '@/lib/reservaOnline/totales';
import { formatMontoCorto } from '@/lib/money';
import { useReservaOnlineStore } from '@/store/useReservaOnlineStore';
import { agendaColors as colors, agendaFontSerif } from '@/theme/agendaColors';
import { useCarga, useGuardaPaso, type Ir } from './hooks';
import { BarraInferior, BotonPrimario, Mensaje, PasoHeader } from './ui';

// Pantalla 2: seleccion multiple de servicios con total y duracion corriente.
export function ServiciosScreen({ slug, ir }: { slug: string; ir: Ir }) {
  const t = useTranslations('reservaOnline');
  const listo = useGuardaPaso(slug, 'servicios', ir);
  const { data: servicios, error, cargando, reintentar } = useCarga(
    () => getService().getServices(slug),
    slug,
  );
  const seleccion = useReservaOnlineStore((s) => s.servicioIds);
  const setServicios = useReservaOnlineStore((s) => s.setServicios);

  if (!listo) return null;

  const alternar = (id: number) =>
    setServicios(seleccion.includes(id) ? seleccion.filter((x) => x !== id) : [...seleccion, id]);
  const totales = totalesDeServicios(servicios ?? [], seleccion);

  return (
    <div>
      <PasoHeader titulo={t('servicios.title')} paso={1} onVolver={() => ir(rutaPaso(slug))} />
      {error && (
        <>
          <Mensaje tono="error">{t('errores.generico')}</Mensaje>
          <button type="button" onClick={reintentar}>{t('comun.reintentar')}</button>
        </>
      )}
      {cargando && !error && <Mensaje>{t('comun.cargando')}</Mensaje>}
      {servicios && servicios.length === 0 && <Mensaje>{t('servicios.vacio')}</Mensaje>}
      {servicios?.map((s) => {
        const elegido = seleccion.includes(s.id);
        return (
          <button
            key={s.id}
            type="button"
            role="checkbox"
            aria-checked={elegido}
            aria-label={s.nombre}
            onClick={() => alternar(s.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
              background: colors.surface, borderRadius: 14, padding: '14px 16px', marginBottom: 8, cursor: 'pointer',
              border: `${elegido ? 1.5 : 1}px solid ${elegido ? colors.primarySolid : colors.border}`,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15.5, fontWeight: 700, color: colors.textStrong, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {s.nombre}
              </div>
              <div style={{ fontSize: 12.5, color: colors.sub, marginTop: 3 }}>{s.duracionMinutos} min</div>
            </div>
            <div style={{ fontFamily: agendaFontSerif, fontSize: 18, color: colors.textStrong, flexShrink: 0 }}>
              ${formatMontoCorto(s.precio)}
            </div>
            <div
              aria-hidden="true"
              style={{
                width: 24, height: 24, borderRadius: 12, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: elegido ? colors.primarySolid : 'transparent',
                border: elegido ? 'none' : `1.5px solid ${colors.border}`,
              }}
            >
              {elegido && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.primaryFg} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
          </button>
        );
      })}

      <BarraInferior>
        {seleccion.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: colors.sub, marginBottom: 10 }}>
            <span>{t('servicios.resumen', { count: seleccion.length, minutos: totales.duracionMinutos })}</span>
            <b style={{ color: colors.textStrong, fontFamily: agendaFontSerif, fontSize: 18 }}>
              ${formatMontoCorto(totales.precio)}
            </b>
          </div>
        )}
        <BotonPrimario disabled={seleccion.length === 0} onClick={() => ir(rutaPaso(slug, 'horario'))}>
          {t('comun.continuar')}
        </BotonPrimario>
      </BarraInferior>
    </div>
  );
}
