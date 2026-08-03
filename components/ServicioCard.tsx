'use client';

import React, { useRef } from 'react';
import { useTranslations } from 'next-intl';
import { CSS } from '@dnd-kit/utilities';
import { useSortable } from '@dnd-kit/sortable';
import { colors, withAlpha, shadows } from '@/theme/colors';
import { Servicio } from '@/services/servicioService';
import { formatMonto } from '@/lib/money';
import PillToggle from '@/components/PillToggle';

// Mismos valores que agenda/page.tsx (SwipeableTurnoCard) — mismo gesto,
// mismo feel. No se importa desde ahí a propósito: ese archivo es solo
// referencia para esta tarea, no se toca ni se extrae un componente común.
const SWIPE_REVEAL    = 80;
const SWIPE_THRESHOLD = 55;

interface Props {
  servicio: Servicio;
  onEdit:   () => void;
  onToggle: (activo: boolean) => void;
  onDelete: () => void;
  // Ausente cuando la card se renderiza sin drag-and-drop (resultados de
  // búsqueda: lista plana, reordenar no tiene sentido — ver page.tsx).
  draggable?: boolean;
}

export default function ServicioCard({ servicio, onEdit, onToggle, onDelete, draggable = false }: Props) {
  const t = useTranslations('configuracion.ServiciosPage');
  const precioLabel = servicio.precio ? `  ·  $${formatMonto(Number(servicio.precio))}` : '';

  // useSortable siempre se llama (regla de hooks) pero `disabled` cuando
  // `draggable` es false lo deja inerte: sin listeners, sin transform.
  const {
    attributes, listeners, setNodeRef, setActivatorNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: servicio.id, disabled: !draggable });

  // Swipe-to-delete — misma técnica que SwipeableTurnoCard en agenda/page.tsx:
  // sin estado de React para el offset, mutación directa de style.transform
  // vía refs (nada de setState por frame) para que el drag se sienta 1:1
  // con el dedo. setNodeRef/transform de dnd-kit van en el contenedor
  // exterior (mueve la card entera al reordenar); este ref/transform propio
  // va en la capa interior que se desliza — dos transforms independientes,
  // cada uno en su propio nodo, para que no se pisen entre sí.
  const cardRef    = useRef<HTMLDivElement>(null);
  const startX     = useRef(0);
  const initOffset = useRef(0);
  const liveOffset = useRef(0);
  const dragged    = useRef(false);

  const applyTransform = (offset: number, animate: boolean) => {
    if (!cardRef.current) return;
    cardRef.current.style.transition = animate
      ? 'transform 0.32s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
      : 'none';
    cardRef.current.style.transform = `translateX(${offset}px)`;
  };

  const snapTo = (target: number) => {
    liveOffset.current = target;
    applyTransform(target, true);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current     = e.touches[0].clientX;
    initOffset.current = liveOffset.current;
    dragged.current    = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const delta   = e.touches[0].clientX - startX.current;
    if (Math.abs(delta) > 5) dragged.current = true;
    const clamped = Math.min(0, Math.max(-SWIPE_REVEAL, initOffset.current + delta));
    liveOffset.current = clamped;
    applyTransform(clamped, false);
  };

  const handleTouchEnd = () => {
    snapTo(liveOffset.current < -SWIPE_THRESHOLD ? -SWIPE_REVEAL : 0);
  };

  const handleCardClick = () => {
    if (dragged.current) return;
    if (liveOffset.current < -10) { snapTo(0); return; }
    onEdit();
  };

  const cardBg = servicio.activo ? colors.surface : colors.surfaceSubtle;

  return (
    <div
      ref={draggable ? setNodeRef : undefined}
      style={{
        position: 'relative', overflow: 'hidden', borderRadius: 14,
        border: `1px solid ${colors.border}`, boxShadow: shadows.card,
        backgroundColor: cardBg,
        opacity: servicio.activo ? (isDragging ? 0.5 : 1) : 0.65,
        transform: draggable ? CSS.Transform.toString(transform) : undefined,
        transition: draggable ? transition : undefined,
        zIndex: isDragging ? 1 : undefined,
      }}
    >
      {/* Panel de eliminar — detrás, se revela con el swipe. Llena todo el
          viewport (misma técnica que el panel CANCELAR de SwipeableTurnoCard). */}
      <div
        onClick={onDelete}
        style={{
          position: 'absolute', inset: 0,
          display: 'flex', justifyContent: 'flex-end',
        }}
      >
        <div style={{
          width: SWIPE_REVEAL, height: '100%',
          backgroundColor: colors.dangerAccent,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
          cursor: 'pointer',
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.danger} strokeWidth="2">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
          </svg>
          <span style={{ fontSize: 10, fontWeight: 700, color: colors.danger, letterSpacing: 0.5 }}>
            {t('delete')}
          </span>
        </div>
      </div>

      {/* Foreground deslizable — todo el contenido de la card (antes era la
          única capa del componente). */}
      <div
        ref={cardRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleCardClick}
        style={{
          position: 'relative', transform: 'translateX(0)',
          display: 'flex', alignItems: 'center', gap: 12,
          backgroundColor: cardBg,
          padding: '14px 16px', cursor: 'pointer', userSelect: 'none',
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
          // Handle de drag-and-kit — su propio gesto (pointer events, vía
          // listeners) empieza en este mismo nodo. Sin cortar la propagación
          // de los touch events acá, un touch que arranca sobre el grip
          // también dispara los handlers de swipe del ancestro (los touch
          // events burbujean por su cuenta, independientes de los pointer
          // events que usa dnd-kit) — los dos gestos pelearían por el mismo
          // toque. onClick ya cortaba esto para el click; ahora se corta
          // igual para touchstart/move/end, todo el ciclo del gesto.
          <div
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            onClick={e => e.stopPropagation()}
            onTouchStart={e => e.stopPropagation()}
            onTouchMove={e => e.stopPropagation()}
            onTouchEnd={e => e.stopPropagation()}
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
    </div>
  );
}
