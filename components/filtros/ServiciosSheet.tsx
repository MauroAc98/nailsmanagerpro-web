'use client';

import { useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { BottomSheet } from '@/components/BottomSheet';
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
  // count = draft length (0 = all).
  ctaLabel: (count: number) => string;
  todosLabel?: string;
  fotoCategoria?: (categoriaId: number) => string | null | undefined;
  // Non-null => amber notice above the selector and the CTA is disabled.
  aviso?: (draftIds: number[]) => string | null;
  // Dato a la derecha de cada servicio (por defecto la duración).
  detalle?: (servicio: Servicio) => ReactNode;
}

const headerButton = {
  minHeight: 44, minWidth: 44, padding: '0 4px', background: 'none', border: 'none',
  cursor: 'pointer', fontSize: 14, fontWeight: 600, color: colors.primaryDeep,
} as const;

// Bottom sheet with a draft copy of the selection: nothing is committed until
// the CTA is tapped. The BottomSheet itself sits above the nav (bottomOffset =
// NAV_CLEARANCE), so the sticky footer needs no extra nav padding.
export function ServiciosSheet(props: Props) {
  if (!props.open) return null;
  return <ServiciosSheetAbierta {...props} />;
}

function ServiciosSheetAbierta({
  onClose, title, servicios, selectedIds, onConfirm, ctaLabel, todosLabel, fotoCategoria, aviso, detalle,
}: Props) {
  const t = useTranslations('common.ServiciosSheet');
  const [draft, setDraft] = useState<number[]>(selectedIds);

  // Mounted only while open (see ServiciosSheet), so every open starts the
  // draft from the committed selection.
  const mensaje = aviso?.(draft) ?? null;
  const bloqueado = mensaje !== null;

  const confirmar = () => {
    if (bloqueado) return;
    onConfirm(draft);
    onClose();
  };

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 39, backgroundColor: 'rgba(43, 34, 38, 0.40)' }}
      />
      <BottomSheet
        snapPoints={[0.85]}
        initialIndex={0}
        enablePanDownToClose
        bottomOffset={NAV_CLEARANCE}
        onChange={index => { if (index < 0) onClose(); }}
      >
        <div role="dialog" aria-label={title} style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
          <div style={{
            position: 'sticky', top: 0, zIndex: 1, backgroundColor: colors.surface,
            display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px',
          }}>
            <button type="button" onClick={onClose} style={{ ...headerButton, textAlign: 'left' }}>
              {t('cancel')}
            </button>
            <span style={{
              flex: 1, minWidth: 0, textAlign: 'center', fontSize: 16, fontWeight: 700, color: colors.textStrong,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {title}
            </span>
            <button type="button" onClick={() => setDraft([])} style={{ ...headerButton, textAlign: 'right' }}>
              {t('clear')}
            </button>
          </div>

          <div style={{ flex: 1, padding: '8px 16px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {mensaje && (
              <AvisoAmbar>
                {mensaje}
              </AvisoAmbar>
            )}
            <SelectorServicios
              mode="multi"
              servicios={servicios}
              selectedIds={draft}
              onChange={setDraft}
              todosLabel={todosLabel}
              fotoCategoria={fotoCategoria}
              detalle={detalle}
            />
          </div>

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
        </div>
      </BottomSheet>
    </>
  );
}
