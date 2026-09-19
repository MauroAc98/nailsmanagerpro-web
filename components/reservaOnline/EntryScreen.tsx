'use client';

import { useTranslations } from 'next-intl';
import { getService } from '@/lib/reservaOnline';
import { rutaPaso } from '@/lib/reservaOnline/rutas';
import { agendaColors as colors, agendaFontSerif } from '@/theme/agendaColors';
import { useCarga, type Ir } from './hooks';
import { BarraInferior, BotonPrimario, Etiqueta, Mensaje, Tarjeta } from './ui';

// Pantalla 1: entrada. Presenta el salon y explica como funciona la reserva.
export function EntryScreen({ slug, ir }: { slug: string; ir: Ir }) {
  const t = useTranslations('reservaOnline');
  const { data: salon, error, cargando } = useCarga(() => getService().getSalon(slug), slug);

  if (error) {
    return (
      <Mensaje tono="error">
        {error.code === 'not_found' ? t('errores.noEncontrado') : t('errores.generico')}
      </Mensaje>
    );
  }
  if (cargando || !salon) return <Mensaje>{t('comun.cargando')}</Mensaje>;

  const inicial = salon.nombre.trim().charAt(0).toUpperCase();
  const pasos = [t('entry.step1'), t('entry.step2'), t('entry.step3')];

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', paddingTop: 24 }}>
        <div
          style={{
            width: 72, height: 72, borderRadius: 36, background: colors.primarySoft,
            display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
            fontFamily: agendaFontSerif, fontSize: 30, color: colors.primaryDeep,
          }}
        >
          {salon.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={salon.logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            inicial
          )}
        </div>
        <h1 style={{ margin: '14px 0 0', fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 28, color: colors.textStrong }}>
          {salon.nombre}
        </h1>
        {salon.direccion && (
          <div style={{ fontSize: 14, color: colors.sub, marginTop: 6 }}>{salon.direccion}</div>
        )}
      </div>

      <div style={{ marginTop: 26 }}>
        <Tarjeta>
          <Etiqueta>{t('entry.howItWorksTitle')}</Etiqueta>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12, fontSize: 14, color: colors.text }}>
            {pasos.map((texto, i) => (
              <div key={i} style={{ display: 'flex', gap: 10 }}>
                <b style={{ color: colors.primaryDeep }}>{i + 1}</b> {texto}
              </div>
            ))}
          </div>
        </Tarjeta>
      </div>
      <div style={{ padding: '14px 8px 0', fontSize: 13, color: colors.sub, textAlign: 'center' }}>
        {t('entry.depositNote')}
      </div>

      <BarraInferior>
        <BotonPrimario onClick={() => ir(rutaPaso(slug, 'servicios'))}>{t('entry.cta')}</BotonPrimario>
      </BarraInferior>
    </div>
  );
}
