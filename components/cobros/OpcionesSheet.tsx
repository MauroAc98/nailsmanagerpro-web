'use client';

import { useEffect } from 'react';
import { colors, shadows } from '@/theme/colors';

const Z_INDEX = 100; // mismo nivel que ConfirmSheetHost y MotivoCancelacionSheetHost
const DURACION_MS = 280;

interface Props {
  visible: boolean;
  titulo: string;
  opciones: { valor: string; texto: string }[];
  valor: string;
  onElegir: (valor: string) => void;
  onCerrar: () => void;
}

// Hoja inferior para elegir UNA opción de una lista corta. Misma animación que
// PrecioServiciosSheetHost y MotivoCancelacionSheetHost: siempre montada, el
// panel desliza con translateY y el fondo se desvanece, al abrir y al cerrar.
// Elegir una opción aplica y cierra; tocar el fondo o Escape cierra sin cambiar.
export default function OpcionesSheet({ visible, titulo, opciones, valor, onElegir, onCerrar }: Props) {
  useEffect(() => {
    if (!visible) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar();
    };
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [visible, onCerrar]);

  return (
    <div
      aria-hidden={!visible}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: Z_INDEX,
        pointerEvents: visible ? 'auto' : 'none',
        // Cerrada no debe poder enfocarse con Tab; se oculta recién cuando
        // termina de deslizar para no cortar la animación de salida.
        visibility: visible ? 'visible' : 'hidden',
        transition: visible ? 'none' : `visibility 0s linear ${DURACION_MS}ms`,
      }}
    >
      <div
        data-testid="hoja-fondo"
        onClick={onCerrar}
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.4)',
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.2s ease',
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: colors.surface,
          borderRadius: '20px 20px 0 0',
          boxShadow: shadows.sheet,
          padding: '28px 20px calc(20px + env(safe-area-inset-bottom))',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: `transform ${DURACION_MS / 1000}s cubic-bezier(0.25, 0.46, 0.45, 0.94)`,
        }}
      >
        <p style={{ fontSize: 16, fontWeight: 600, color: colors.text, margin: '0 0 16px' }}>{titulo}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {opciones.map(o => {
            const elegida = o.valor === valor;
            return (
              <button
                key={o.valor}
                type="button"
                aria-pressed={elegida}
                onClick={() => onElegir(o.valor)}
                style={{
                  textAlign: 'left', padding: '12px 14px', borderRadius: 12, cursor: 'pointer',
                  border: `1px solid ${elegida ? colors.primaryDeep : colors.border}`,
                  backgroundColor: elegida ? colors.surfaceSubtle : colors.surface,
                  fontSize: 14, fontWeight: elegida ? 600 : 400, color: colors.text,
                }}
              >
                {o.texto}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
