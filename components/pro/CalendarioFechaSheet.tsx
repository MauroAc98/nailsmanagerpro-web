'use client';

import type { CSSProperties } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { BottomSheet } from '@/components/BottomSheet';
import { Spinner } from '@/components/Spinner';
import type { ProError } from '@/lib/pro/errores';
import { esFechaValida } from '@/lib/pro/fechaHora';
import { hoyDelDispositivo } from '@/lib/pro/hoy';
import { celdasDeMes, etiquetaDeDia, inicialesDeSemana, mesAnterior, mesSiguiente } from '@/lib/pro/mes';
import { agendaColors, agendaFontSerif, agendaShadows } from '@/theme/agendaColors';
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

const botonMes = (deshabilitado: boolean): CSSProperties => ({
  ...botonLlano,
  minWidth: TACTIL,
  minHeight: TACTIL,
  cursor: deshabilitado ? 'default' : 'pointer',
  opacity: deshabilitado ? 0.35 : 1,
});

// Flecha y cruz como SVG propio: el portal no importa lucide-react.
function Icono({ trazo, tam, color }: { trazo: string; tam: number; color: string }) {
  return (
    <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={trazo} />
    </svg>
  );
}

// Hoja "Elegir fecha" del portal: calendario mensual que elige UN día. Mismo
// diseño que la hoja de la agenda de la titular, pero presentacional: la fecha,
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

  const anterior = mesAnterior(mes);
  const siguiente = mesSiguiente(mes);
  const hoy = hoyDelDispositivo();
  const cuenta = new Map((marcas ?? []).map((m) => [m.fecha, m.cantidad]));
  const celdas = celdasDeMes(mes) ?? [];
  const etiquetaMes = new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)) - 1, 1)),
  );

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

          <div style={{ padding: '0 20px 24px' }}>
            <div
              style={{
                padding: 16,
                borderRadius: 24,
                border: `1px solid ${agendaColors.border}`,
                backgroundColor: agendaColors.surface,
                boxShadow: agendaShadows.card,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <button
                  type="button"
                  aria-label={t('anterior')}
                  disabled={anterior === null}
                  onClick={() => anterior !== null && onCambiarMes(anterior)}
                  style={botonMes(anterior === null)}
                >
                  <Icono trazo="m15 18-6-6 6-6" tam={18} color={agendaColors.sub} />
                </button>
                <span style={{ fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 18, color: agendaColors.textStrong, textTransform: 'capitalize' }}>
                  {etiquetaMes} {mes.slice(0, 4)}
                </span>
                <button
                  type="button"
                  aria-label={t('siguiente')}
                  disabled={siguiente === null}
                  onClick={() => siguiente !== null && onCambiarMes(siguiente)}
                  style={botonMes(siguiente === null)}
                >
                  <Icono trazo="m9 18 6-6-6-6" tam={18} color={agendaColors.sub} />
                </button>
              </div>

              <div aria-hidden style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
                {inicialesDeSemana(locale).map((d, i) => (
                  <div key={i} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: agendaColors.muted, paddingBottom: 4 }}>
                    {d}
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px 0' }}>
                {celdas.map((celda) => {
                  const f = celda.fecha;
                  const elegido = f === fecha;
                  const esHoy = f === hoy;
                  const pasado = f < hoy;
                  const cantidad = cuenta.get(f) ?? 0;
                  const nombre = etiquetaDeDia(f, locale);
                  return (
                    <button
                      key={f}
                      type="button"
                      data-testid={`cal-dia-${f}`}
                      data-fuera-del-mes={celda.delMes ? undefined : 'true'}
                      aria-label={cantidad > 0 ? t('irAlDia', { dia: nombre, cantidad }) : t('sinTurnos', { dia: nombre })}
                      aria-pressed={elegido}
                      aria-current={esHoy ? 'date' : undefined}
                      disabled={!esFechaValida(f)}
                      onClick={() => onElegir(f)}
                      style={{
                        ...botonLlano,
                        minWidth: TACTIL,
                        minHeight: TACTIL,
                        width: '100%',
                        cursor: 'pointer',
                        opacity: celda.delMes ? 1 : 0.25,
                      }}
                    >
                      <span
                        style={{
                          position: 'relative',
                          width: 40,
                          height: 40,
                          borderRadius: 20,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontFamily: elegido || esHoy ? agendaFontSerif : undefined,
                          fontSize: 15,
                          fontWeight: elegido || esHoy ? 700 : 400,
                          backgroundColor: elegido ? agendaColors.primarySolid : 'transparent',
                          color: elegido
                            ? agendaColors.primaryFg
                            : pasado
                              ? agendaColors.placeholder
                              : esHoy
                                ? agendaColors.primaryDeep
                                : agendaColors.text,
                        }}
                      >
                        {Number(f.slice(8, 10))}
                        {cantidad > 0 && !pasado && !elegido && (
                          <span
                            aria-hidden
                            style={{
                              position: 'absolute',
                              bottom: -2,
                              left: '50%',
                              transform: 'translateX(-50%)',
                              minWidth: 14,
                              height: 14,
                              padding: '0 3px',
                              boxSizing: 'border-box',
                              borderRadius: 7,
                              fontFamily: 'inherit',
                              fontSize: 8,
                              fontWeight: 900,
                              lineHeight: '14px',
                              textAlign: 'center',
                              backgroundColor: agendaColors.primarySoft,
                              color: agendaColors.primaryDeep,
                            }}
                          >
                            {cantidad}
                          </span>
                        )}
                        {cantidad > 0 && pasado && !elegido && (
                          <span
                            aria-hidden
                            data-punto=""
                            style={{
                              position: 'absolute',
                              bottom: 6,
                              left: '50%',
                              transform: 'translateX(-50%)',
                              width: 4,
                              height: 4,
                              borderRadius: 2,
                              backgroundColor: agendaColors.divider,
                            }}
                          />
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>

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
        </div>
      </BottomSheet>
    </>
  );
}
