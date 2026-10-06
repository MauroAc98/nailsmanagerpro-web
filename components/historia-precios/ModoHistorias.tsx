'use client';

import { useTranslations } from 'next-intl';
import { agendaColors as colors } from '@/theme/agendaColors';
import type { ModoHistorias as Modo } from '@/lib/historiaHistorias';

interface Props {
  modo:               Modo;
  onChange:           (modo: Modo) => void;
  cantidadServicios:  number;
  // Historias que saldrían en modo "una por categoría".
  cantidadHistorias:  number;
  // La historia actual entra legible (ver TarjetaPrecios/onFitChange).
  entra:              boolean;
}

// "¿Cómo querés armarla?" — dos tarjetas tipo radio (botones con aria-pressed).
// El reparto no cambia la selección de servicios, solo cuántas imágenes salen.
export function ModoHistorias({ modo, onChange, cantidadServicios, cantidadHistorias, entra }: Props) {
  const t = useTranslations('historia.HistoriaPreciosPage');
  // Solo se recomienda partir cuando la única historia no entra; sin umbral inventado.
  const recomendarCategoria = modo === 'una' && !entra;

  const opciones: { id: Modo; titulo: string; desc: string; cuenta: string; recomendado: boolean; aviso: boolean }[] = [
    {
      id: 'una', titulo: t('modoUnaTitle'), desc: t('modoUnaDesc'),
      cuenta: cantidadServicios > 0 ? t('modoUnaCuenta', { count: cantidadServicios }) : t('modoVacio'),
      recomendado: false, aviso: cantidadServicios === 0,
    },
    {
      id: 'categoria', titulo: t('modoCategoriaTitle'), desc: t('modoCategoriaDesc'),
      cuenta: cantidadHistorias > 0 ? t('modoCategoriaCuenta', { count: cantidadHistorias }) : t('modoVacio'),
      recomendado: recomendarCategoria, aviso: cantidadHistorias === 0,
    },
  ];

  return (
    <div style={{ width: '100%', marginTop: 22, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p style={{ fontSize: 14, fontWeight: 700, color: colors.textStrong, margin: 0 }}>{t('modoTitle')}</p>
      {opciones.map(o => {
        const activo = modo === o.id;
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={activo}
            onClick={() => onChange(o.id)}
            style={{
              width: '100%', boxSizing: 'border-box', display: 'flex', alignItems: 'flex-start', gap: 12,
              padding: 14, borderRadius: 14, cursor: 'pointer', textAlign: 'left', font: 'inherit',
              color: colors.text, background: colors.surface,
              border: activo ? `2px solid ${colors.primaryDeep}` : `1px solid ${colors.border}`,
            }}
          >
            <span
              aria-hidden
              style={{
                width: 22, height: 22, boxSizing: 'border-box', borderRadius: 11, flexShrink: 0, marginTop: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: `2px solid ${activo ? colors.primaryDeep : colors.border}`,
              }}
            >
              {activo && <span style={{ width: 10, height: 10, borderRadius: 5, background: colors.primaryDeep }} />}
            </span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, flexGrow: 1 }}>
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: colors.textStrong }}>{o.titulo}</span>
                {o.recomendado && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                    background: colors.primarySoft, color: colors.primaryDeep, borderRadius: 8,
                    padding: '3px 8px', whiteSpace: 'nowrap',
                  }}>
                    {t('modoRecomendado')}
                  </span>
                )}
              </span>
              <span style={{ fontSize: 12.5, lineHeight: 1.35, color: colors.subtext }}>{o.desc}</span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: o.aviso ? colors.amberFg : colors.primaryDeep }}>
                {o.cuenta}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
