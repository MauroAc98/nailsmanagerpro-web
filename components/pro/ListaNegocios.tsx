'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { bloqueoEfectivo } from '@/lib/pro/acceso';
import { useProAuthStore } from '@/store/useProAuthStore';
import { agendaColors, agendaFontSerif } from '@/theme/agendaColors';
import { FilaVinculo } from './FilaVinculo';
import { LogoPortal } from './LogoPortal';

// Elegir negocio (SE-9). NO navega: elegirVinculo deja un negocio activo y
// ProGuard lleva a la agenda. Los negocios no disponibles se ven deshabilitados
// con su motivo; no se ocultan.
export function ListaNegocios() {
  const t = useTranslations('profesionales.ListaNegocios');
  const vinculos = useProAuthStore((s) => s.vinculos);
  const bloqueos = useProAuthStore((s) => s.bloqueos);
  const titulo = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    titulo.current?.focus();
  }, []);

  return (
    <main
      style={{
        minHeight: '100dvh',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 20,
        padding: 24,
        backgroundColor: agendaColors.bg,
      }}
    >
      <LogoPortal />
      <section style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
        <h1
          ref={titulo}
          tabIndex={-1}
          style={{ margin: 0, fontSize: 22, fontFamily: agendaFontSerif, color: agendaColors.strong, outline: 'none' }}
        >
          {t('titulo')}
        </h1>
        <p style={{ margin: 0, fontSize: 15, color: agendaColors.strong }}>{t('subtitulo')}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {vinculos.map((v) => (
            <FilaVinculo
              key={v.id}
              vinculo={v}
              bloqueo={bloqueoEfectivo(v, bloqueos)}
              etiqueta={t('disponible')}
              onElegir={(id) => useProAuthStore.getState().elegirVinculo(id)}
            />
          ))}
        </div>
      </section>
    </main>
  );
}
