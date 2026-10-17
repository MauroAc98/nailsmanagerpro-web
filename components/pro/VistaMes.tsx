'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Spinner } from '@/components/Spinner';
import { useProMarcasMes } from '@/hooks/pro/useProMarcasMes';
import { hoyDelDispositivo } from '@/lib/pro/hoy';
import { desfaseLunes, etiquetaDeMes, mesAnterior, mesSiguiente, ultimoDia } from '@/lib/pro/mes';
import { useProAgendaStore } from '@/store/useProAgendaStore';
import { agendaColors, agendaFontSerif } from '@/theme/agendaColors';
import { MensajeErrorPro } from './MensajeErrorPro';

const TACTIL = 44;

const botonNavegacion = (deshabilitado: boolean) => ({
  minWidth: TACTIL,
  minHeight: TACTIL,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'none',
  border: 'none',
  cursor: deshabilitado ? 'default' : 'pointer',
  opacity: deshabilitado ? 0.35 : 1,
});

// Flecha del selector de mes (SVG propio: el portal no importa lucide-react).
function Flecha({ derecha }: { derecha: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={agendaColors.sub} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={derecha ? 'M9 6l6 6-6 6' : 'M15 6l-6 6 6 6'} />
    </svg>
  );
}

// "14 de octubre": se formatea en UTC con partes numéricas, la zona del
// dispositivo no puede correr el día.
function etiquetaDeDia(mes: string, dia: number, locale: string): string {
  const [anio, m] = mes.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(anio, m - 1, dia)),
  );
}

// Lunes a domingo, en una inicial: 2024-01-01 fue lunes.
function inicialesDeSemana(locale: string): string[] {
  const f = new Intl.DateTimeFormat(locale, { weekday: 'narrow', timeZone: 'UTC' });
  return Array.from({ length: 7 }, (_, i) => f.format(new Date(Date.UTC(2024, 0, 1 + i))));
}

// Vista mensual del portal: solo cuántos turnos hay cada día (nunca montos ni
// resúmenes). Tocar un día lleva a la vista de día de esa fecha. Un error de las
// marcas no bloquea: la grilla sigue y se puede reintentar.
export function VistaMes() {
  const t = useTranslations('profesionales.Mes');
  const tAgenda = useTranslations('profesionales.Agenda');
  const locale = useLocale();
  const mes = useProAgendaStore((s) => s.mesVisto);
  const fecha = useProAgendaStore((s) => s.fecha);
  const marcas = useProMarcasMes(mes);

  const anterior = mesAnterior(mes);
  const siguiente = mesSiguiente(mes);
  const etiqueta = etiquetaDeMes(mes, locale);
  const desfase = desfaseLunes(mes) ?? 0;
  const cantidadDias = Number((ultimoDia(mes) ?? '').slice(8, 10)) || 0;
  const hoy = hoyDelDispositivo();
  const cuenta = new Map((marcas.data?.dias ?? []).map((d) => [d.fecha, d.cantidad]));

  const elegir = (f: string) => {
    const store = useProAgendaStore.getState();
    store.setFecha(f);
    store.setVista('dia');
  };

  return (
    <section style={{ padding: '0 16px 16px' }}>
      <div
        style={{
          padding: 12,
          borderRadius: 24,
          border: `1px solid ${agendaColors.border}`,
          backgroundColor: agendaColors.surface,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <button
            type="button"
            aria-label={t('anterior')}
            disabled={anterior === null}
            onClick={() => anterior !== null && useProAgendaStore.getState().setMesVisto(anterior)}
            style={botonNavegacion(anterior === null)}
          >
            <Flecha derecha={false} />
          </button>
          <h2
            style={{
              margin: 0,
              fontFamily: agendaFontSerif,
              fontWeight: 400,
              fontSize: 18,
              color: agendaColors.strong,
              textTransform: 'capitalize',
            }}
          >
            {etiqueta}
          </h2>
          <button
            type="button"
            aria-label={t('siguiente')}
            disabled={siguiente === null}
            onClick={() => siguiente !== null && useProAgendaStore.getState().setMesVisto(siguiente)}
            style={botonNavegacion(siguiente === null)}
          >
            <Flecha derecha />
          </button>
        </div>

        <div aria-hidden style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
          {inicialesDeSemana(locale).map((d, i) => (
            <div
              key={i}
              style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: agendaColors.muted }}
            >
              {d}
            </div>
          ))}
        </div>

        <div
          role="group"
          aria-label={etiqueta}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px 0' }}
        >
          {Array.from({ length: desfase }, (_, i) => (
            <span key={`hueco-${i}`} aria-hidden />
          ))}
          {Array.from({ length: cantidadDias }, (_, i) => {
            const dia = i + 1;
            const f = `${mes}-${String(dia).padStart(2, '0')}`;
            const cantidad = cuenta.get(f) ?? 0;
            const conTurnos = cantidad > 0;
            const elegido = f === fecha;
            const nombre = etiquetaDeDia(mes, dia, locale);
            return (
              <button
                key={f}
                type="button"
                data-testid={`mes-dia-${f}`}
                data-con-turnos={conTurnos ? 'true' : undefined}
                aria-label={conTurnos ? t('irAlDia', { dia: nombre, cantidad }) : t('sinTurnos', { dia: nombre })}
                aria-current={f === hoy ? 'date' : undefined}
                onClick={() => elegir(f)}
                style={{
                  minWidth: TACTIL,
                  minHeight: TACTIL,
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  justifySelf: 'center',
                  border: 'none',
                  borderRadius: 22,
                  cursor: 'pointer',
                  fontSize: 15,
                  fontWeight: elegido || f === hoy ? 700 : 400,
                  backgroundColor: elegido ? agendaColors.primarySolid : 'transparent',
                  color: elegido ? agendaColors.primaryFg : f === hoy ? agendaColors.primaryDeep : agendaColors.text,
                }}
              >
                {dia}
                {conTurnos && (
                  <span
                    aria-hidden
                    style={{
                      position: 'absolute',
                      bottom: 2,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      minWidth: 16,
                      height: 16,
                      padding: '0 4px',
                      boxSizing: 'border-box',
                      borderRadius: 8,
                      fontSize: 10,
                      fontWeight: 900,
                      lineHeight: '16px',
                      textAlign: 'center',
                      backgroundColor: agendaColors.primarySoft,
                      color: agendaColors.primaryDeep,
                    }}
                  >
                    {cantidad}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {marcas.data === null && marcas.error === null && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 12 }}>
            <Spinner label={tAgenda('cargando')} />
          </div>
        )}
        {marcas.error !== null && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8, paddingTop: 12 }}>
            <p id="mes-error-texto" style={{ margin: 0, fontSize: 14, color: agendaColors.sub }}>
              {t('errorMarcas')}
            </p>
            <MensajeErrorPro error={marcas.error} id="mes-error" />
            <button
              type="button"
              onClick={marcas.reintentar}
              aria-describedby="mes-error"
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
    </section>
  );
}
