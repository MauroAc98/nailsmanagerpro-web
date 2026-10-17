'use client';

import type { CSSProperties } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { BottomSheet } from '@/components/BottomSheet';
import { CalendarioMensual } from '@/components/agenda/CalendarioMensual';
import { Spinner } from '@/components/Spinner';
import type { ProError } from '@/lib/pro/errores';
import { esFechaValida, FECHA_MINIMA } from '@/lib/pro/fechaHora';
import { hoyDelDispositivo } from '@/lib/pro/hoy';
import { etiquetaDeDia, mesAnterior, mesSiguiente, mesValido } from '@/lib/pro/mes';
import { agendaColors, agendaFontSerif } from '@/theme/agendaColors';
import { MensajeErrorPro } from './MensajeErrorPro';

interface Props {
  abierto: boolean;
  // Mes que se ve ("YYYY-MM") y día resaltado ("YYYY-MM-DD"): los maneja quien lo usa.
  mes: string;
  fecha: string;
  // Cuántos turnos hay cada día del mes; nunca montos ni datos de los turnos.
  // null = todavía no hay nada que mostrar (se ve el spinner).
  marcas: { fecha: string; cantidad: number }[] | null;
  error: ProError | null;
  onReintentar: () => void;
  onElegir: (fecha: string) => void;
  onCerrar: () => void;
  onCambiarMes: (mes: string) => void;
  // Capa de la hoja (su fondo va una por debajo). Sube cuando se abre desde otra hoja.
  zIndex?: number;
}

const SNAP_POINTS = [0.8];
const TACTIL = 44;

const botonLlano: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'none',
  border: 'none',
  padding: 0,
};

// Cruz de cerrar como SVG propio.
function Icono({ trazo, tam, color }: { trazo: string; tam: number; color: string }) {
  return (
    <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={trazo} />
    </svg>
  );
}

// Hoja "Elegir fecha" del portal: calendario mensual que elige UN día. Reutiliza
// el CalendarioMensual de la agenda de la titular, pero es presentacional: la fecha,
// el mes visto y las marcas entran por props y los cambios salen por callbacks,
// así la usan tanto la tira semanal como la hoja de filtros.
// Tocar un día ES la confirmación; "Hoy" solo lleva el calendario al mes actual.
export function CalendarioFechaSheet({
  abierto,
  mes,
  fecha,
  marcas,
  error,
  onReintentar,
  onElegir,
  onCerrar,
  onCambiarMes,
  zIndex = 60,
}: Props) {
  const t = useTranslations('profesionales.Calendario');
  const tAgenda = useTranslations('profesionales.Agenda');
  const locale = useLocale();
  if (!abierto) return null;

  const hoy = hoyDelDispositivo();
  // El calendario compartido trabaja con Date local; el mes del portal es "YYYY-MM".
  const mesVisto = mesValido(mes) ? new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)) - 1, 1) : null;

  return (
    <>
      <div
        data-testid="fondo-calendario"
        aria-hidden="true"
        onClick={onCerrar}
        style={{ position: 'fixed', inset: 0, zIndex: zIndex - 1, backgroundColor: 'rgba(0, 0, 0, 0.35)' }}
      />
      <BottomSheet
        snapPoints={SNAP_POINTS}
        initialIndex={0}
        enablePanDownToClose
        onChange={(indice) => {
          if (indice < 0) onCerrar();
        }}
        handleColor={agendaColors.border}
        backgroundColor={agendaColors.surface}
        zIndex={zIndex}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pro-calendario-titulo"
          onKeyDown={(e) => {
            if (e.key === 'Escape') onCerrar();
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 20px 12px' }}>
            <h2 id="pro-calendario-titulo" style={{ margin: 0, fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 19, color: agendaColors.textStrong }}>
              {t('titulo')}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                onClick={() => onCambiarMes(hoy.slice(0, 7))}
                style={{
                  minHeight: TACTIL,
                  padding: '0 14px',
                  borderRadius: 22,
                  border: `1px solid ${agendaColors.border}`,
                  backgroundColor: agendaColors.surface,
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                  color: agendaColors.text,
                  cursor: 'pointer',
                }}
              >
                {t('hoy')}
              </button>
              <button
                type="button"
                onClick={onCerrar}
                aria-label={t('cerrar')}
                style={{
                  ...botonLlano,
                  width: TACTIL,
                  height: TACTIL,
                  borderRadius: TACTIL / 2,
                  border: `1px solid ${agendaColors.divider}`,
                  backgroundColor: agendaColors.surface,
                  cursor: 'pointer',
                }}
              >
                <Icono trazo="M18 6 6 18M6 6l12 12" tam={16} color={agendaColors.text} />
              </button>
            </div>
          </div>

          {mesVisto !== null && (
            <CalendarioMensual
              viewDate={mesVisto}
              onMonthChange={(d) => {
                // Misma regla que antes: nunca antes de 2000-01 ni más allá del rango válido.
                const destino = d < mesVisto ? mesAnterior(mes) : mesSiguiente(mes);
                if (destino !== null) onCambiarMes(destino);
              }}
              fechaSeleccionada={fecha}
              turnosMes={marcas ?? []}
              onDayClick={onElegir}
              diaDeshabilitado={(f) => !esFechaValida(f)}
              mesMinimo={FECHA_MINIMA.slice(0, 7)}
              etiquetas={{
                anterior: t('anterior'),
                siguiente: t('siguiente'),
                dia: (f, cantidad) =>
                  cantidad > 0 ? t('irAlDia', { dia: etiquetaDeDia(f, locale), cantidad }) : t('sinTurnos', { dia: etiquetaDeDia(f, locale) }),
              }}
            />
          )}
          <div style={{ padding: '0 20px 24px' }}>
            {marcas === null && error === null && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 12 }}>
                <Spinner label={tAgenda('cargando')} />
              </div>
            )}
            {error !== null && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8, paddingTop: 12 }}>
                <p style={{ margin: 0, fontSize: 14, color: agendaColors.sub }}>{t('errorMarcas')}</p>
                <MensajeErrorPro error={error} id="calendario-error" />
                <button
                  type="button"
                  onClick={onReintentar}
                  aria-describedby="calendario-error"
                  style={{
                    minHeight: TACTIL,
                    padding: '0 16px',
                    border: `1px solid ${agendaColors.fieldBorder}`,
                    borderRadius: 12,
                    fontSize: 15,
                    fontWeight: 600,
                    cursor: 'pointer',
                    backgroundColor: agendaColors.surface,
                    color: agendaColors.strong,
                  }}
                >
                  {t('reintentar')}
                </button>
              </div>
            )}
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
