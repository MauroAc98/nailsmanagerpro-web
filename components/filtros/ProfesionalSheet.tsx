'use client';

import type { ReactNode } from 'react';
import { Check, Users } from 'lucide-react';
import { BottomSheet } from '@/components/BottomSheet';
import { NAV_CLEARANCE } from '@/constants/layout';
import { agendaColors as colors } from '@/theme/agendaColors';
import { AvatarProfesional } from './AvatarProfesional';

export interface ProfesionalSheetOption {
  id: number;
  nombre: string;
  apellido?: string | null;
  color?: string | null;
  avatarUrl?: string | null;
  // Opcional: p. ej. las categorías que hace.
  subtitulo?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  // id de la profesional elegida, o 'equipo'.
  onSelect: (sel: number | 'equipo') => void;
  title: string;
  // Opcionales: sin equipoLabel no hay fila "todo el equipo" (pantallas que
  // siempre trabajan con una profesional).
  equipoLabel?: string;
  equipoSubtitulo?: string;
  cerrarLabel: string;
  profesionales: ProfesionalSheetOption[];
  selectedId: number | 'equipo';
  // z-index del fondo oscuro. 39 por defecto; 40 si se abre desde otra BottomSheet.
  backdropZIndex?: number;
}

export function EquipoIcono({ size = 32 }: { size?: number }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: size / 2, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft,
    }}>
      <Users size={Math.round(size * 0.5)} strokeWidth={2} color={colors.primaryDeep} aria-hidden="true" />
    </span>
  );
}

// Hoja de selección de profesional: tocar una fila elige y cierra (sin CTA).
// Mismo armado que ServiciosSheet: BottomSheet sobre el nav + fondo oscuro.
export function ProfesionalSheet(props: Props) {
  if (!props.open) return null;
  return <ProfesionalSheetAbierta {...props} />;
}

function ProfesionalSheetAbierta({
  onClose, onSelect, title, equipoLabel, equipoSubtitulo, cerrarLabel, profesionales, selectedId, backdropZIndex = 39,
}: Props) {
  const elegir = (sel: number | 'equipo') => {
    onSelect(sel);
    onClose();
  };

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: backdropZIndex, backgroundColor: 'rgba(43, 34, 38, 0.40)' }}
      />
      <BottomSheet
        snapPoints={[0.6]}
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
            <span style={{ flex: 1, minHeight: 44, display: 'flex', alignItems: 'center', fontSize: 16, fontWeight: 700, color: colors.textStrong }}>
              {title}
            </span>
            <button
              type="button"
              onClick={onClose}
              style={{
                minHeight: 44, minWidth: 44, padding: '0 4px', background: 'none', border: 'none',
                cursor: 'pointer', fontSize: 14, fontWeight: 600, color: colors.primaryDeep,
              }}
            >
              {cerrarLabel}
            </button>
          </div>

          <div role="listbox" aria-label={title} style={{ padding: '4px 16px 12px' }}>
            {equipoLabel && (
              <Fila
                seleccionada={selectedId === 'equipo'}
                leading={<EquipoIcono />}
                nombre={equipoLabel}
                subtitulo={equipoSubtitulo}
                onClick={() => elegir('equipo')}
              />
            )}
            {profesionales.map(p => (
              <Fila
                key={p.id}
                seleccionada={selectedId === p.id}
                leading={<AvatarProfesional nombre={p.nombre} apellido={p.apellido} color={p.color} avatarUrl={p.avatarUrl} />}
                nombre={p.nombre}
                subtitulo={p.subtitulo}
                onClick={() => elegir(p.id)}
              />
            ))}
          </div>
        </div>
      </BottomSheet>
    </>
  );
}

function Fila({ seleccionada, leading, nombre, subtitulo, onClick }: {
  seleccionada: boolean; leading: ReactNode; nombre: string; subtitulo?: string; onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={seleccionada}
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, width: '100%', height: 60, padding: 0,
        background: 'none', border: 'none', borderBottom: `1px solid ${colors.hairline}`,
        cursor: 'pointer', textAlign: 'left',
      }}
    >
      {leading}
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 15, color: colors.textStrong, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {nombre}
        </span>
        {subtitulo && (
          <span style={{ fontSize: 12, color: colors.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {subtitulo}
          </span>
        )}
      </span>
      {seleccionada && <Check size={18} strokeWidth={2.5} color={colors.primary} style={{ flexShrink: 0 }} />}
    </button>
  );
}
