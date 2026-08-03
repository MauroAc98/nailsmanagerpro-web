'use client';

import { CSS } from '@dnd-kit/utilities';
import { useSortable } from '@dnd-kit/sortable';
import { colors, withAlpha, shadows } from '@/theme/colors';
import { Servicio } from '@/services/servicioService';
import { formatMonto } from '@/lib/money';
import PillToggle from '@/components/PillToggle';

interface Props {
  servicio: Servicio;
  onEdit:   () => void;
  onToggle: (activo: boolean) => void;
  // Ausente cuando la card se renderiza sin drag-and-drop (resultados de
  // búsqueda: lista plana, reordenar no tiene sentido — ver page.tsx).
  draggable?: boolean;
}

export default function ServicioCard({ servicio, onEdit, onToggle, draggable = false }: Props) {
  const precioLabel = servicio.precio ? `  ·  $${formatMonto(Number(servicio.precio))}` : '';

  // useSortable siempre se llama (regla de hooks) pero `disabled` cuando
  // `draggable` es false lo deja inerte: sin listeners, sin transform.
  const {
    attributes, listeners, setNodeRef, setActivatorNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: servicio.id, disabled: !draggable });

  return (
    <div
      ref={draggable ? setNodeRef : undefined}
      onClick={onEdit}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        backgroundColor: servicio.activo ? colors.surface : colors.surfaceSubtle,
        border: `1px solid ${colors.border}`,
        boxShadow: shadows.card, borderRadius: 14,
        padding: '14px 16px', cursor: 'pointer',
        opacity: servicio.activo ? (isDragging ? 0.5 : 1) : 0.65,
        userSelect: 'none',
        transform: draggable ? CSS.Transform.toString(transform) : undefined,
        transition: draggable ? transition : undefined,
        zIndex: isDragging ? 1 : undefined,
        position: 'relative',
      }}
    >
      <div style={{
        width: 36, height: 36,
        backgroundColor: servicio.activo ? withAlpha(colors.primary, '15') : colors.surfaceSubtle,
        borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke={servicio.activo ? colors.primary : colors.placeholder} strokeWidth="2">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
      </div>

      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: servicio.activo ? colors.text : colors.placeholder }}>
          {servicio.nombre}
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: colors.subtext }}>
          {servicio.duracion_minutos} min{precioLabel}
        </p>
      </div>

      <PillToggle value={servicio.activo} onChange={onToggle} stopPropagation />

      {draggable && (
        <div
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          onClick={e => e.stopPropagation()}
          style={{
            width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none', flexShrink: 0,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill={colors.placeholder}>
            <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" />
            <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
            <circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
          </svg>
        </div>
      )}

      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.placeholder} strokeWidth="2">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </div>
  );
}
