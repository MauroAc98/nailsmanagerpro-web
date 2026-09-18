'use client';

import React, { useRef } from 'react';
import { useTranslations } from 'next-intl';
import { CSS } from '@dnd-kit/utilities';
import { useSortable } from '@dnd-kit/sortable';
import { agendaColors as colors, agendaShadows as shadows, agendaFontSerif } from '@/theme/agendaColors';
import { withAlpha } from '@/theme/colors';
import { Servicio } from '@/services/servicioService';
import { formatMontoCorto } from '@/lib/money';
import PillToggle from '@/components/PillToggle';

// Mismos valores que agenda/page.tsx (SwipeableTurnoCard) — mismo gesto,
// mismo feel. No se importa desde ahí a propósito: ese archivo es solo
// referencia para esta tarea, no se toca ni se extrae un componente común.
const SWIPE_REVEAL    = 80;
const SWIPE_THRESHOLD = 55;
// Resting/closed offset — mismo criterio que SwipeableTurnoCard (Change 4,
// agenda): un sliver del panel de eliminar queda visible en reposo en vez de
// translateX(0), como pista de que la card se puede deslizar.
const SWIPE_PEEK = 8;
// La capa se desplaza -SWIPE_PEEK y el borde de la card recorta esos px: el
// padding izquierdo suma SWIPE_PEEK para que el contenido no pierda margen.

interface Props {
  servicio: Servicio;
  onEdit:   () => void;
  onToggle: (activo: boolean) => void;
  onDelete: () => void;
  // Ausente cuando la card se renderiza sin drag-and-drop (resultados de
  // búsqueda: lista plana, reordenar no tiene sentido — ver page.tsx).
  draggable?: boolean;
  // Chip "PROMO" junto al nombre — reemplaza la sub-sección "Promociones"
  // que existía antes (Slice B aplana esa lista en un único listado por
  // categoría).
  showPromoBadge?: boolean;
}

export default function ServicioCard({ servicio, onEdit, onToggle, onDelete, draggable = false, showPromoBadge = false }: Props) {
  const t = useTranslations('configuracion.ServiciosPage');
  const precioLabel = servicio.precio ? `$${formatMontoCorto(Number(servicio.precio))}` : null;

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
  const liveOffset = useRef(-SWIPE_PEEK);
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
    snapTo(liveOffset.current < -SWIPE_THRESHOLD ? -SWIPE_REVEAL : -SWIPE_PEEK);
  };

  const handleCardClick = () => {
    if (dragged.current) return;
    if (liveOffset.current < -10) { snapTo(-SWIPE_PEEK); return; }
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
          backgroundColor: colors.dangerBg,
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
          position: 'relative', transform: `translateX(${-SWIPE_PEEK}px)`,
          display: 'flex', alignItems: 'center', gap: 12,
          backgroundColor: cardBg,
          padding: `14px 14px 14px ${16 + SWIPE_PEEK}px`, cursor: 'pointer', userSelect: 'none',
        }}
      >
        {/* Barra lateral de estado: verde = activo, gris = pausado. Vive dentro
            de la capa deslizable (left = SWIPE_PEEK) para que, con el
            desplazamiento de -SWIPE_PEEK, quede pegada al borde de la card. */}
        <div style={{
          position: 'absolute', left: SWIPE_PEEK, top: 0, bottom: 0, width: 4,
          backgroundColor: servicio.activo ? colors.primary : colors.border,
        }} />

        {/* minWidth:0 — sin esto un nombre largo no se comprime y empuja el
            toggle / el handle / el chevron fuera de la card. Mismo criterio
            en la fila nombre+badge: minWidth:0 en el nombre, flexShrink:0 en
            el badge PROMO, así un nombre largo no lo empuja fuera. */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <p style={{
              margin: 0, fontSize: 16, fontWeight: 700,
              color: servicio.activo ? colors.text : colors.placeholder,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              minWidth: 0,
            }}>
              {servicio.nombre}
            </p>
            {showPromoBadge && (
              <span style={{
                flexShrink: 0, fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
                color: colors.primaryDeep, backgroundColor: withAlpha(colors.primary, '15'),
                borderRadius: 6, padding: '2px 6px',
              }}>
                {t('promoBadge')}
              </span>
            )}
            {!servicio.activo && (
              <span style={{
                flexShrink: 0, fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
                color: colors.amberFg, backgroundColor: colors.amberBg,
                borderRadius: 6, padding: '2px 6px',
              }}>
                {t('pausedBadge')}
              </span>
            )}
          </div>
          <p style={{
            margin: '2px 0 0', fontSize: 12, color: colors.subtext,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {servicio.duracion_minutos} min
          </p>
        </div>

        {precioLabel && (
          <span style={{
            flexShrink: 0, fontFamily: agendaFontSerif, fontSize: 19,
            color: servicio.activo ? colors.textStrong : colors.placeholder,
          }}>
            {precioLabel}
          </span>
        )}

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

      </div>
    </div>
  );
}
