'use client';

import { useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { ServiciosHojaBase, botonCabeceraStyle } from './ServiciosSheetBase';
import { SelectorServicios } from '@/components/SelectorServicios';
import { AvisoAmbar } from './AvisoAmbar';
import { NAV_CLEARANCE } from '@/constants/layout';
import { agendaColors as colors } from '@/theme/agendaColors';
import type { Servicio } from '@/services/servicioService';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  // Already filtered by the caller (e.g. by profesional).
  servicios: Servicio[];
  // Committed selection; [] = all services.
  selectedIds: number[];
  onConfirm: (ids: number[]) => void;
  // 'multi' (default): draft + CTA. 'single': tap = choose and close, no CTA.
  mode?: 'multi' | 'single';
  // multi only. count = draft length (0 = all).
  ctaLabel?: (count: number) => string;
  todosLabel?: string;
  fotoCategoria?: (categoriaId: number) => string | null | undefined;
  // Non-null => amber notice above the selector and the CTA is disabled.
  aviso?: (draftIds: number[]) => string | null;
  // Dato a la derecha de cada servicio (por defecto la duración).
  detalle?: (servicio: Servicio) => ReactNode;
  // z-index del fondo oscuro. 39 por defecto; sube a 40 cuando la hoja se abre
  // desde dentro de otra BottomSheet (z 40) para que el fondo quede encima.
  backdropZIndex?: number;
}

// Bottom sheet with a draft copy of the selection: nothing is committed until
// the CTA is tapped. The BottomSheet itself sits above the nav (bottomOffset =
// NAV_CLEARANCE), so the sticky footer needs no extra nav padding.
export function ServiciosSheet(props: Props) {
  if (!props.open) return null;
  return <ServiciosSheetAbierta {...props} />;
}

function ServiciosSheetAbierta({
  onClose, title, servicios, selectedIds, onConfirm, mode = 'multi', ctaLabel, todosLabel, fotoCategoria, aviso, detalle, backdropZIndex = 39,
}: Props) {
  const t = useTranslations('common.ServiciosSheet');
  const [draft, setDraft] = useState<number[]>(selectedIds);

  // Mounted only while open (see ServiciosSheet), so every open starts the
  // draft from the committed selection.
  const mensaje = aviso?.(draft) ?? null;
  const bloqueado = mensaje !== null;

  const single = mode === 'single';

  const elegirUno = (ids: number[]) => {
    onConfirm(ids);
    onClose();
  };

  const confirmar = () => {
    if (bloqueado) return;
    onConfirm(draft);
    onClose();
  };

  return (
    <ServiciosHojaBase
      title={title}
      onClose={onClose}
      closeLabel={t('close')}
      backdropZIndex={backdropZIndex}
      bottomOffset={NAV_CLEARANCE}
      centrarTitulo={!single}
      leading={!single && (
        <button type="button" onClick={onClose} style={{ ...botonCabeceraStyle, textAlign: 'left' }}>
          {t('cancel')}
        </button>
      )}
      trailing={!single && (
        <button type="button" onClick={() => setDraft([])} style={{ ...botonCabeceraStyle, textAlign: 'right' }}>
          {t('clear')}
        </button>
      )}
      footer={!single && ctaLabel && (
        <div style={{
          position: 'sticky', bottom: 0, zIndex: 1, backgroundColor: colors.surface,
          padding: '10px 16px 14px', borderTop: `1px solid ${colors.hairline}`,
        }}>
          <button
            type="button"
            onClick={confirmar}
            disabled={bloqueado}
            aria-disabled={bloqueado}
            style={{
              width: '100%', height: 50, borderRadius: 14, border: 'none',
              fontSize: 15, fontWeight: 700,
              cursor: bloqueado ? 'not-allowed' : 'pointer',
              backgroundColor: bloqueado ? colors.divider : colors.primarySolid,
              color: bloqueado ? colors.muted : colors.primaryFg,
              opacity: bloqueado ? 0.7 : 1,
            }}
          >
            {ctaLabel(draft.length)}
          </button>
        </div>
      )}
    >
      {mensaje && (
        <AvisoAmbar>
          {mensaje}
        </AvisoAmbar>
      )}
      <SelectorServicios
        mode={single ? 'single' : 'multi'}
        servicios={servicios}
        selectedIds={single ? selectedIds : draft}
        onChange={single ? elegirUno : setDraft}
        todosLabel={single ? undefined : todosLabel}
        fotoCategoria={fotoCategoria}
        detalle={detalle}
      />
    </ServiciosHojaBase>
  );
}
