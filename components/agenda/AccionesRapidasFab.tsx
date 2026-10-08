'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Plus, CalendarPlus, ArrowDownCircle, ArrowUpCircle, Wallet } from 'lucide-react';
import { agendaColors as colors, agendaShadows as shadows } from '@/theme/agendaColors';
import { withAlpha } from '@/theme/colors';
import { NAV_CLEARANCE } from '@/constants/layout';
import { usePendientesDeCobroStore } from '@/store/usePendientesDeCobroStore';

// Duración del fundido del fondo y del menú; la misma que usan las otras hojas
// con fondo oscuro (OpcionesSheet).
const DURACION_MS = 280;

interface Props {
  fechaSeleccionada: string;
  // "Nuevo turno" no tiene sentido en una fecha pasada ni con un filtro activo:
  // sin esa acción el menú ofrece solo las de Finanzas, que no dependen del día.
  mostrarNuevoTurno: boolean;
}

interface Accion {
  clave: string;
  etiqueta: string;
  icono: ReactNode;
  ruta: string;
  contador?: number;
}

// Botón "+" de la Agenda: abre un menú con "Nuevo turno" y las acciones de
// Finanzas que antes solo estaban dentro de Negocio.
export function AccionesRapidasFab({ fechaSeleccionada, mostrarNuevoTurno }: Props) {
  const t = useTranslations('agenda.AccionesRapidas');
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const { pendientes, error } = usePendientesDeCobroStore();
  const porCobrar = error ? 0 : pendientes.length;

  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false); };
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [abierto]);

  const iconoAccion = { size: 20, color: colors.primaryDeep, strokeWidth: 2 } as const;

  // De arriba hacia abajo; la más cercana al botón es la más usada.
  const acciones: Accion[] = [
    { clave: 'cobros', etiqueta: t('cobrar'), icono: <Wallet {...iconoAccion} />, ruta: '/configuracion/cobros', contador: porCobrar },
    { clave: 'ingreso', etiqueta: t('ingreso'), icono: <ArrowUpCircle {...iconoAccion} />, ruta: '/configuracion/ingresos/nuevo' },
    { clave: 'gasto', etiqueta: t('gasto'), icono: <ArrowDownCircle {...iconoAccion} />, ruta: '/configuracion/gastos/nuevo' },
    ...(mostrarNuevoTurno
      ? [{ clave: 'turno', etiqueta: t('turno'), icono: <CalendarPlus {...iconoAccion} />, ruta: `/agenda/nuevo?fecha=${fechaSeleccionada}` }]
      : []),
  ];

  const ir = (ruta: string) => {
    setAbierto(false);
    router.push(ruta);
  };

  const bottomFab = `calc(${NAV_CLEARANCE}px + env(safe-area-inset-bottom) + 8px)`;

  return (
    <>
      {/* Siempre montado para poder animar la entrada y la salida. Cerrado queda
          oculto con visibility (tras el fundido), así no recibe foco ni toques. */}
      <div
        aria-hidden={!abierto}
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: `calc(${NAV_CLEARANCE}px + env(safe-area-inset-bottom))`,
          zIndex: 44,
          pointerEvents: abierto ? 'auto' : 'none',
          visibility: abierto ? 'visible' : 'hidden',
          transition: abierto ? 'none' : `visibility 0s linear ${DURACION_MS}ms`,
        }}
      >
          <button
            type="button"
            data-testid="acciones-fondo"
            aria-label={t('cerrar')}
            tabIndex={abierto ? 0 : -1}
            onClick={() => setAbierto(false)}
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              border: 'none', padding: 0, cursor: 'default', backgroundColor: colors.scrim,
              opacity: abierto ? 1 : 0, transition: `opacity ${DURACION_MS}ms ease`,
            }}
          />
          <div
            data-testid="acciones-menu"
            style={{
              position: 'absolute', right: 24, bottom: 76,
              display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10,
              opacity: abierto ? 1 : 0, transform: abierto ? 'translateY(0)' : 'translateY(12px)',
              transition: `opacity ${DURACION_MS}ms ease, transform ${DURACION_MS}ms ease`,
            }}
          >
            {acciones.map(a => (
              <button
                key={a.clave}
                type="button"
                onClick={() => ir(a.ruta)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, border: 'none', background: 'none', padding: 0, cursor: 'pointer',
                }}
              >
                <span style={{
                  backgroundColor: colors.surface, borderRadius: 12, padding: '8px 12px', fontSize: 13, fontWeight: 600,
                  color: colors.text, boxShadow: shadows.card, whiteSpace: 'nowrap',
                }}>
                  {a.etiqueta}
                </span>
                <span style={{
                  position: 'relative', width: 44, height: 44, borderRadius: 22, flexShrink: 0,
                  backgroundColor: colors.surface, border: `1px solid ${colors.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {a.icono}
                  {a.contador != null && a.contador > 0 && (
                    <span style={{
                      position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 8, padding: '0 4px',
                      boxSizing: 'border-box', backgroundColor: colors.amber, color: colors.amberBg,
                      fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {a.contador > 9 ? '9+' : a.contador}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
      </div>

      <button
        type="button"
        aria-label={t('abrir')}
        aria-expanded={abierto}
        onClick={() => setAbierto(v => !v)}
        style={{
          position: 'fixed', bottom: bottomFab, right: 24,
          width: 56, height: 56, borderRadius: 28,
          backgroundColor: colors.primarySolid, border: 'none',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 8px 20px ${withAlpha(colors.primary, '80')}`, zIndex: 45,
        }}
      >
        <Plus
          size={24}
          color={colors.primaryFg}
          strokeWidth={2.5}
          style={{ transform: abierto ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s' }}
        />
      </button>
    </>
  );
}
