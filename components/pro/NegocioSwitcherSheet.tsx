'use client';

import { useEffect, useRef, type KeyboardEvent } from 'react';
import { useTranslations } from 'next-intl';
import { BottomSheet } from '@/components/BottomSheet';
import { bloqueoEfectivo } from '@/lib/pro/acceso';
import { useProAuthStore } from '@/store/useProAuthStore';
import { agendaColors, agendaFontSerif } from '@/theme/agendaColors';
import { FilaVinculo } from './FilaVinculo';

interface Props {
  abierto: boolean;
  onCerrar: () => void;
}

const SNAP_POINTS = [0.6];

function Contenido({ onCerrar }: { onCerrar: () => void }) {
  const t = useTranslations('profesionales.NegocioSwitcher');
  const vinculos = useProAuthStore((s) => s.vinculos);
  const bloqueos = useProAuthStore((s) => s.bloqueos);
  const activoId = useProAuthStore((s) => s.vinculoActivoId);
  const titulo = useRef<HTMLHeadingElement>(null);

  // El foco entra al diálogo apenas se monta; quien lo abrió lo recupera al cerrar.
  useEffect(() => {
    titulo.current?.focus();
  }, []);

  function alTeclear(e: KeyboardEvent) {
    if (e.key === 'Escape') onCerrar();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pro-switcher-titulo"
      onKeyDown={alTeclear}
      style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 16px 24px', minWidth: 0 }}
    >
      <h2
        id="pro-switcher-titulo"
        ref={titulo}
        tabIndex={-1}
        style={{ margin: 0, fontSize: 20, fontFamily: agendaFontSerif, color: agendaColors.strong, outline: 'none' }}
      >
        {t('titulo')}
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {vinculos.map((v) => {
          const actual = v.id === activoId;
          return (
            <FilaVinculo
              key={v.id}
              vinculo={v}
              bloqueo={bloqueoEfectivo(v, bloqueos)}
              actual={actual}
              etiqueta={actual ? t('actual') : undefined}
              onElegir={(id) => {
                useProAuthStore.getState().elegirVinculo(id);
                onCerrar();
              }}
            />
          );
        })}
      </div>
      <button
        type="button"
        onClick={onCerrar}
        style={{
          minHeight: 44,
          border: 'none',
          borderRadius: 12,
          fontSize: 16,
          fontWeight: 600,
          cursor: 'pointer',
          backgroundColor: 'transparent',
          color: agendaColors.primaryDeep,
        }}
      >
        {t('cerrar')}
      </button>
    </div>
  );
}

// Cambio de negocio sin salir de la pantalla (SE-9, SE-10). Lo abre ProHeader
// y también lo usarán las pantallas de estado (P7b). Elegir cierra el sheet; el
// store vacía los datos del negocio anterior ANTES de cambiar.
export function NegocioSwitcherSheet({ abierto, onCerrar }: Props) {
  if (!abierto) return null;
  return (
    <>
      <div
        data-testid="fondo-selector"
        aria-hidden="true"
        onClick={onCerrar}
        style={{ position: 'fixed', inset: 0, zIndex: 59, backgroundColor: 'rgba(0, 0, 0, 0.35)' }}
      />
      <BottomSheet
        snapPoints={SNAP_POINTS}
        initialIndex={0}
        enablePanDownToClose
        onChange={(indice) => {
          if (indice < 0) onCerrar();
        }}
        backgroundColor={agendaColors.bg}
        zIndex={60}
      >
        <Contenido onCerrar={onCerrar} />
      </BottomSheet>
    </>
  );
}
