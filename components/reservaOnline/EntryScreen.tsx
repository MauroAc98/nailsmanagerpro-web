'use client';

import { useLocale, useTranslations } from 'next-intl';
import { getService } from '@/lib/reservaOnline';
import { linkComoLlegar } from '@/lib/reservaOnline/calendario';
import { rutaPaso } from '@/lib/reservaOnline/rutas';
import { agendaColors as colors, agendaFontSerif } from '@/theme/agendaColors';
import { useCarga, type Ir } from './hooks';
import { IcoBrillo, IcoCalendario, IcoCheck, IcoEscudo, IcoPin } from './iconos';
import { Avatar, BarraInferior, BotonPrimario, Mensaje, Tarjeta } from './ui';

// Pantalla 1: entrada. Banda de portada con degrade de marca (el DTO no trae
// imagen de portada), avatar con logo o inicial, direccion con "Como llegar",
// como funciona, quienes atienden y la cancelacion gratis.
export function EntryScreen({ slug, ir }: { slug: string; ir: Ir }) {
  const t = useTranslations('reservaOnline');
  const locale = useLocale();
  const { data, error, cargando } = useCarga(async () => {
    const svc = getService();
    const [salon, terminos] = await Promise.all([svc.getSalon(slug), svc.getTerms(slug)]);
    return { salon, terminos };
  }, slug);

  if (error) {
    return (
      <Mensaje tono="error">
        {error.code === 'not_found' ? t('errores.noEncontrado') : t('errores.generico')}
      </Mensaje>
    );
  }
  if (cargando || !data) return <Mensaje>{t('comun.cargando')}</Mensaje>;

  const { salon, terminos } = data;
  const inicial = salon.nombre.trim().charAt(0).toUpperCase();
  const primerNombre = (n: string) => n.trim().split(/\s+/)[0];
  const nombres = new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(
    salon.profesionales.map((p) => primerNombre(p.nombre)),
  );
  const pasos = [
    { icono: <IcoBrillo color={colors.primaryDeep} />, texto: t('entry.como1') },
    { icono: <IcoEscudo color={colors.primaryDeep} />, texto: t('entry.como2') },
    { icono: <IcoCheck color={colors.primaryDeep} size={15} sw={3} />, texto: t('entry.como3') },
  ];

  return (
    <div>
      <div
        aria-hidden="true"
        style={{
          height: 150,
          margin: '-16px -20px 0',
          background: `linear-gradient(135deg, ${colors.primary}, ${colors.primarySolid})`,
        }}
      />
      <div style={{ marginTop: -38, position: 'relative' }}>
        <div
          style={{
            width: 76, height: 76, borderRadius: 38, background: colors.surface, border: `4px solid ${colors.bg}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', boxSizing: 'border-box',
            fontFamily: agendaFontSerif, fontSize: 32, color: colors.primaryDeep,
          }}
        >
          {salon.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={salon.logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            inicial
          )}
        </div>
        <h1 style={{ margin: '10px 0 0', fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 28, lineHeight: 1.1, color: colors.textStrong }}>
          {salon.nombre}
        </h1>
        {salon.direccion && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 14, color: colors.sub, marginTop: 8, lineHeight: 1.4 }}>
            <span style={{ marginTop: 2 }}><IcoPin color={colors.primaryDeep} /></span>
            <div>
              {salon.direccion}
              <div>
                <a
                  href={linkComoLlegar(salon.direccion)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: colors.primaryDeep, fontWeight: 600, textDecoration: 'none' }}
                >
                  {t('entry.comoLlegar')}
                </a>
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop: 20 }}>
        <Tarjeta estilo={{ borderRadius: 16, padding: '16px 16px 14px' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {pasos.map((p, i) => (
              <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                <div
                  style={{
                    width: 44, height: 44, borderRadius: 22, background: colors.primarySoft, margin: '0 auto 8px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {p.icono}
                </div>
                <div style={{ fontSize: 12.5, color: colors.text, lineHeight: 1.35, fontWeight: 600 }}>{p.texto}</div>
              </div>
            ))}
          </div>
        </Tarjeta>

        {salon.profesionales.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14 }}>
            <div style={{ display: 'flex' }}>
              {salon.profesionales.slice(0, 4).map((p, i) => (
                <div key={p.id} style={{ marginLeft: i === 0 ? 0 : -8 }}>
                  <Avatar nombre={p.nombre} />
                </div>
              ))}
            </div>
            <div style={{ fontSize: 13.5, color: colors.sub, lineHeight: 1.4 }}>
              {t('entry.teAtienden')} <b style={{ color: colors.strong }}>{nombres}</b>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: colors.sub, marginTop: 12 }}>
          <IcoCalendario color={colors.primaryDeep} />
          {t('entry.cancelacion', { horas: terminos.ventanaCancelacionHoras })}
        </div>
      </div>

      <BarraInferior>
        <div style={{ textAlign: 'center', fontSize: 12.5, color: colors.muted, marginBottom: 10 }}>
          {t('entry.pagoSeguro')}
        </div>
        <BotonPrimario onClick={() => ir(rutaPaso(slug, 'servicios'))}>{t('entry.cta')}</BotonPrimario>
      </BarraInferior>
    </div>
  );
}
