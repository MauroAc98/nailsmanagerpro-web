'use client';

import { Fragment, Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { TrendingDown, TrendingUp } from 'lucide-react';
import BackButton from '@/components/BackButton';
import { agendaColors as colors, agendaShadows as shadows, agendaFontSerif } from '@/theme/agendaColors';
import { withAlpha } from '@/theme/colors';
import { useProfesionalStore } from '@/store/useProfesionalStore';
import { statsService, DashboardStats, PuntoGanancia, BucketOcupacion } from '@/services/statsService';
import { extraerMensajeError } from '@/services/clienteService';
import { nombreMes, nombreDia, diasSemanaCortos, formatoYMD } from '@/lib/dateFormat';
import { formatMonto } from '@/lib/money';

// Delega a formatoYMD (componentes LOCALES) — d.toISOString().split('T')[0]
// corre la fecha un día para atrás en husos negativos como ART/BRT
// (UTC-3) cuando `d` no es medianoche local, como el default de
// rangoPersonalizado más abajo (new Date() = hora actual).
function formatFecha(d: Date): string {
  return formatoYMD(d);
}

function rangoDelMes(viewDate: Date): { desde: string; hasta: string } {
  const desde = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  const hasta = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0);
  return { desde: formatFecha(desde), hasta: formatFecha(hasta) };
}

// Enumera cada fecha entre desde y hasta (inclusive) como "YYYY-MM-DD" — se
// usa para rellenar con $0 los días sin turnos en el gráfico de ganancias
// por día, sea el rango un mes calendario o un rango personalizado elegido
// a mano (puede cruzar meses, por eso no puede asumirse "día 1..N de un mes").
function enumerarFechas(desde: string, hasta: string): string[] {
  const fechas: string[] = [];
  const cursor = new Date(`${desde}T00:00:00`);
  const fin = new Date(`${hasta}T00:00:00`);
  while (cursor <= fin) {
    fechas.push(formatFecha(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return fechas;
}

// dia_semana del backend es ISO (1=lunes...7=domingo); diasSemanaCortos()
// devuelve Domingo..Sábado (índice 0=domingo, igual orden que Date#getDay).
// iso % 7 mapea 7 (domingo) -> 0 y 1..6 (lunes..sábado) -> 1..6, sin tabla
// de conversión aparte.
function nombreDiaCortoIso(iso: number, dias: string[]): string {
  return dias[iso % 7];
}

// Reconstruye una fecha real a partir de un dia_semana ISO (1=lunes) para
// poder pedirle el nombre largo a `nombreDia` — 2024-01-01 es lunes, ancla
// arbitraria en hora local (mismo cuidado de diasSemanaCortos: nunca UTC).
function nombreDiaLargoIso(iso: number): string {
  const lunesBase = new Date(2024, 0, 1);
  const d = new Date(lunesBase);
  d.setDate(lunesBase.getDate() + (iso - 1));
  return nombreDia(d, 'long', 'ninguna');
}

// ─────────────────────────────────────────────
// Gráfico de barras compacto — una serie de puntos {label, monto} en una
// sola fila, todos visibles sin scroll (pensado para "todo el mes junto").
// Genérico a propósito: sirve igual para día, semana o mes — solo cambia
// qué datos y labels le pasa el caller. No pinta un label por barra (se
// pondría ilegible con ~30 puntos); dos labels de referencia (primero/
// último) alcanzan para orientarse.
//
// El monto exacto NO vive solo en el `title` nativo — en mobile (el
// contexto real de esta app) no hay hover, así que un `title` a secas deja
// el gráfico ilegible: solo la silueta, sin ningún número. Por eso cada
// barra es un <button> tocable que fija el detalle (fecha + monto) arriba,
// y el máximo del período queda siempre visible como referencia de escala
// — sin eso, una barra al 100% de alto no dice si fue $10 o $10.000.000.
// ─────────────────────────────────────────────
function MiniBarChart({
  puntos, height = 90,
}: { puntos: { label: string; monto: number; completo?: boolean }[]; height?: number }) {
  const t = useTranslations('estadisticas.EstadisticasPage');
  const [seleccionado, setSeleccionado] = useState<number | null>(null);
  const maxMonto = puntos.reduce((max, p) => Math.max(max, p.monto), 0);
  if (puntos.length === 0) return null;

  // Con maxMonto=0 las barras quedan en su altura mínima (2%), casi
  // invisibles — indistinguible de "el gráfico no cargó". Un mensaje
  // explícito es más honesto que un rectángulo vacío.
  if (maxMonto === 0) {
    return (
      <div style={{
        backgroundColor: colors.surface, border: `1px solid ${colors.border}`,
        boxShadow: shadows.card, borderRadius: 16, padding: '16px',
        height, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <p style={{ fontSize: 13, color: colors.subtext, margin: 0 }}>{t('earningsChartEmpty')}</p>
      </div>
    );
  }

  const activo = seleccionado != null ? puntos[seleccionado] : null;

  return (
    <div style={{
      backgroundColor: colors.surface, border: `1px solid ${colors.border}`,
      boxShadow: shadows.card, borderRadius: 16, padding: '16px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: colors.subtext, flexShrink: 0 }}>
          {t('earningsChartMax', { monto: formatMonto(maxMonto) })}
        </span>
        <span style={{
          fontSize: 12, fontWeight: activo ? 700 : 400,
          color: activo ? colors.textStrong : colors.subtext,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {activo
            ? `${activo.label} · $${formatMonto(activo.monto)}${activo.completo === false ? ` (${t('earningsPartialBucket')})` : ''}`
            : t('earningsChartHint')}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 2, height }}>
        {puntos.map((p, i) => {
          const pct = maxMonto > 0 ? Math.max((p.monto / maxMonto) * 100, p.monto > 0 ? 4 : 2) : 2;
          const esParcial = p.completo === false;
          const esSeleccionado = seleccionado === i;
          return (
            <button
              key={i}
              type="button"
              onClick={() => setSeleccionado(prev => (prev === i ? null : i))}
              title={`${p.label}: $${formatMonto(p.monto)}`}
              aria-label={`${p.label}: $${formatMonto(p.monto)}`}
              style={{
                flex: 1, minWidth: 2, height: '100%', padding: 0, border: 'none',
                background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'flex-end',
              }}
            >
              <span style={{
                display: 'block', width: '100%', height: `${pct}%`,
                backgroundColor: p.monto > 0 ? colors.success : colors.surfaceSubtle,
                opacity: esParcial ? 0.5 : (seleccionado === null || esSeleccionado ? 1 : 0.4),
                outline: esSeleccionado ? `2px solid ${colors.primaryDeep}` : 'none',
                outlineOffset: -1,
                borderRadius: '3px 3px 0 0',
              }} />
            </button>
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10, color: colors.subtext }}>
        <span>{puntos[0].label}</span>
        {puntos.length > 1 && <span>{puntos[puntos.length - 1].label}</span>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Gráfico de ritmo — barras apiladas (completados/confirmados/cancelados)
// por día de la semana. Mismo criterio táctil que MiniBarChart: en mobile
// no hay hover, así que el desglose exacto de cada día vive en un `button`
// tocable con detalle fijado arriba, no en un `title` nativo (invisible sin
// mouse).
// ─────────────────────────────────────────────
function RitmoTurnosChart({
  dias,
}: { dias: { dia_semana: number; label: string; completados: number; confirmados: number; cancelados: number }[] }) {
  const t = useTranslations('estadisticas.EstadisticasPage');
  const [seleccionado, setSeleccionado] = useState<number | null>(null);
  const maxTotal = dias.reduce((max, d) => Math.max(max, d.completados + d.confirmados + d.cancelados), 0);
  const activo = seleccionado != null ? dias[seleccionado] : null;

  return (
    <div style={{
      backgroundColor: colors.surface, border: `1px solid ${colors.border}`,
      boxShadow: shadows.card, borderRadius: 16, padding: 16,
    }}>
      <p style={{
        fontSize: 12, fontWeight: activo ? 700 : 400,
        color: activo ? colors.textStrong : colors.subtext, margin: '0 0 10px',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {activo
          ? `${activo.label} · ${t('completed')}: ${activo.completados} · ${t('confirmed')}: ${activo.confirmados} · ${t('cancelled')}: ${activo.cancelados}`
          : t('earningsChartHint')}
      </p>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 112 }}>
        {dias.map((d, i) => {
          const total = d.completados + d.confirmados + d.cancelados;
          const alturaPct = maxTotal > 0 ? Math.max((total / maxTotal) * 100, total > 0 ? 6 : 2) : 2;
          const esSeleccionado = seleccionado === i;
          return (
            <button
              key={d.dia_semana}
              type="button"
              onClick={() => setSeleccionado(prev => (prev === i ? null : i))}
              aria-label={`${d.label}: ${total}`}
              style={{
                flex: 1, minWidth: 2, height: '100%', padding: 0, border: 'none',
                background: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 8, justifyContent: 'flex-end',
              }}
            >
              <div style={{
                width: '100%', height: `${alturaPct}%`, borderRadius: '6px 6px 0 0', overflow: 'hidden',
                display: 'flex', flexDirection: 'column', backgroundColor: colors.surfaceSubtle,
                opacity: seleccionado === null || esSeleccionado ? 1 : 0.4,
                outline: esSeleccionado ? `2px solid ${colors.primaryDeep}` : 'none', outlineOffset: -1,
              }}>
                {total > 0 && (
                  <>
                    <span style={{ display: 'block', flexGrow: d.completados || 0, backgroundColor: colors.success }} />
                    <span style={{ display: 'block', flexGrow: d.confirmados || 0, backgroundColor: colors.primary }} />
                    <span style={{ display: 'block', flexGrow: d.cancelados || 0, backgroundColor: colors.danger }} />
                  </>
                )}
              </div>
              <span style={{ fontSize: 9, fontWeight: 700, color: colors.subtext }}>{d.label}</span>
            </button>
          );
        })}
      </div>
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 14, borderTop: `1px solid ${colors.hairline}`,
        marginTop: 14, paddingTop: 12, fontSize: 10, color: colors.subtext,
      }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <i style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success, display: 'inline-block' }} />
          {t('completed')}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <i style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, display: 'inline-block' }} />
          {t('confirmed')}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <i style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger, display: 'inline-block' }} />
          {t('cancelled')}
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Barra de ranking — magnitud de una sola serie (servicios más pedidos).
// El nombre del servicio ya identifica la barra, así que un solo color
// (colors.primary) alcanza; la etiqueta de valor va afuera, en tinta de
// texto, nunca en el color de la barra.
// ─────────────────────────────────────────────
function BarraRanking({
  nombre, cantidad, maxCantidad, valorLabel, color = colors.primary,
}: { nombre: string; cantidad: number; maxCantidad: number; valorLabel?: string; color?: string }) {
  const pct = maxCantidad > 0 ? Math.max((cantidad / maxCantidad) * 100, 4) : 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
        <span style={{ color: colors.text, fontWeight: 600 }}>{nombre}</span>
        <span style={{ color: colors.subtext }}>{valorLabel ?? cantidad}</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, backgroundColor: colors.surfaceSubtle, overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`, height: '100%', borderRadius: 3,
          backgroundColor: color, transition: 'width 0.3s ease',
        }} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Stat tile — identidad por swatch + etiqueta (nunca color en el número).
// ─────────────────────────────────────────────
function StatTile({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    // minWidth: 0 es necesario para que flex:1 pueda achicar la tarjeta por
    // debajo del ancho de contenido — sin esto, en filas de 2-3 tiles, en
    // pantallas angostas (~320px), la última tarjeta se corta y se sale
    // del contenedor en vez de compartir el espacio en partes iguales.
    <div style={{
      flex: 1, minWidth: 0, backgroundColor: colors.surface, border: `1px solid ${colors.border}`,
      boxShadow: shadows.card, borderRadius: 16, padding: '14px 12px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, minWidth: 0 }}>
        <span style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, flexShrink: 0 }} />
        <span style={{
          fontSize: 12, color: colors.subtext, fontWeight: 600,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {label}
        </span>
      </div>
      {/* wordBreak — un monto largo ($45.678,90) es un solo token sin
          espacios; sin esto el navegador no tiene dónde cortarlo y desborda
          la tarjeta en vez de ajustarse (mismo problema de fondo que
          minWidth: 0 arriba, pero ese solo resuelve el contenedor, no el
          texto sin espacios adentro). */}
      <span style={{
        display: 'block', fontSize: 26, fontWeight: 700, color: colors.textStrong,
        wordBreak: 'break-word',
      }}>
        {value}
      </span>
    </div>
  );
}

// Parsea el query param "mes" (YYYY-MM) que llega desde el card de Agenda.
// Si falta o es inválido, cae en el mes actual — mismo default que entrar
// directo desde Configuración.
function parseMesParam(mes: string | null): Date {
  const t = new Date();
  if (mes) {
    const match = /^(\d{4})-(\d{2})$/.exec(mes);
    if (match) return new Date(Number(match[1]), Number(match[2]) - 1, 1);
  }
  return new Date(t.getFullYear(), t.getMonth(), 1);
}

function EstadisticasContent() {
  const t = useTranslations('estadisticas.EstadisticasPage');
  const searchParams = useSearchParams();
  const { profesionales, fetchProfesionales } = useProfesionalStore();

  const [viewDate, setViewDate] = useState<Date>(() => parseMesParam(searchParams.get('mes')));
  const [profesionalFiltro, setProfesionalFiltro] = useState<number | null>(() => {
    const p = searchParams.get('profesional');
    return p ? Number(p) : null;
  });
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);

  // Alternativa al navegador de mes: elegir un "desde"/"hasta" a mano en vez
  // de un mes calendario completo (ej. "ganancias del 8 al 14 de junio").
  // Reusa el mismo /stats/dashboard, que ya acepta cualquier rango.
  const [modoRango, setModoRango] = useState<'mes' | 'personalizado'>('mes');
  const [rangoPersonalizado, setRangoPersonalizado] = useState(() => {
    const hasta = new Date();
    const desde = new Date();
    desde.setDate(desde.getDate() - 6);
    return { desde: formatFecha(desde), hasta: formatFecha(hasta) };
  });
  const rangoInvalido = modoRango === 'personalizado' && rangoPersonalizado.hasta < rangoPersonalizado.desde;

  const [puntosPeriodo, setPuntosPeriodo] = useState<PuntoGanancia[]>([]);
  const [truncadoPeriodo, setTruncadoPeriodo] = useState(false);
  const [errorPeriodo, setErrorPeriodo] = useState<string | null>(null);

  const [ocupacion, setOcupacion] = useState<BucketOcupacion[]>([]);
  const [errorOcupacion, setErrorOcupacion] = useState<string | null>(null);
  // Celda tocada en el heatmap de ocupación — el `title` nativo del <span>
  // (tooltip on-hover) nunca se disparaba con un tap en mobile, que es como
  // se usa esta pantalla en la práctica. Clickear la misma celda de nuevo
  // deselecciona (mismo patrón toggle que el resto de la app).
  const [celdaOcupacion, setCeldaOcupacion] = useState<{ iso: number; hora: number; cantidad: number } | null>(null);

  useEffect(() => {
    if (profesionales.length === 0) fetchProfesionales();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const activeProfesionales = profesionales.filter(p => p.activo);
  const mostrarSelectorProfesional = activeProfesionales.length > 1;
  const nombreProfesionalActivo = profesionalFiltro
    ? activeProfesionales.find(p => p.id === profesionalFiltro)?.nombre
    : t('all');

  const rangoActivo = modoRango === 'mes' ? rangoDelMes(viewDate) : rangoPersonalizado;
  // Rellena todos los días del rango activo (no solo los que tuvieron
  // turnos) para que el gráfico muestre un eje continuo, sin huecos. Se basa
  // en `rangoActivo`, no en el mes de `viewDate` — con rango personalizado
  // el período puede no coincidir con un mes calendario.
  const diasDelRango = rangoInvalido ? [] : enumerarFechas(rangoActivo.desde, rangoActivo.hasta);
  // El ANCHO del rango decide cómo se agrupa el gráfico de ganancias — nunca
  // una elección manual. Un toggle "Agrupar por Día/Semana/Mes" aparte se
  // probó hoy y, confirmado con revisión externa (fable + patrones de Stripe/
  // GlossGenius), resultó un control de nivel analista que nadie entendía
  // sin explicación repetida. Con esto, "una semana" siempre se ve día a
  // día y "un año" siempre se ve mes a mes, sin que nadie tenga que decidirlo.
  const granularidadGanancias: 'dia' | 'semana' | 'mes' =
    diasDelRango.length <= 31 ? 'dia' : diasDelRango.length <= 90 ? 'semana' : 'mes';

  useEffect(() => {
    if (rangoInvalido) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    statsService.getDashboard(rangoActivo.desde, rangoActivo.hasta, profesionalFiltro ?? undefined)
      .then(data => { if (!cancelled) setStats(data); })
      .catch(e => { if (!cancelled) setError(extraerMensajeError(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangoActivo.desde, rangoActivo.hasta, profesionalFiltro, retryTick, rangoInvalido]);

  useEffect(() => {
    if (granularidadGanancias === 'dia' || rangoInvalido) return;
    let cancelled = false;
    setErrorPeriodo(null);

    statsService.getGananciasPorPeriodo(granularidadGanancias, profesionalFiltro ?? undefined, rangoActivo)
      .then(({ puntos, truncado }) => {
        if (cancelled) return;
        setPuntosPeriodo(puntos);
        setTruncadoPeriodo(truncado);
      })
      .catch(e => { if (!cancelled) setErrorPeriodo(extraerMensajeError(e)); });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [granularidadGanancias, rangoActivo.desde, rangoActivo.hasta, profesionalFiltro, retryTick, rangoInvalido]);

  useEffect(() => {
    if (rangoInvalido) return;
    let cancelled = false;
    setErrorOcupacion(null);
    setCeldaOcupacion(null);

    statsService.getOcupacion(rangoActivo.desde, rangoActivo.hasta, profesionalFiltro ?? undefined)
      .then(data => { if (!cancelled) setOcupacion(data); })
      .catch(e => { if (!cancelled) setErrorOcupacion(extraerMensajeError(e)); });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangoActivo.desde, rangoActivo.hasta, profesionalFiltro, retryTick, rangoInvalido]);

  const cambiarMes = (delta: number) => {
    setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  const servicios = stats?.servicios_mas_pedidos ?? [];
  const maxCantidad = servicios.reduce((max, s) => Math.max(max, s.cantidad), 0);
  const gananciasPorServicio = stats?.ganancias_por_servicio ?? [];
  const maxMonto = gananciasPorServicio.reduce((max, s) => Math.max(max, s.monto), 0);
  const montoPorFecha = new Map((stats?.ganancias_por_dia ?? []).map(d => [d.fecha, d.monto]));
  const puntosGananciasPorDia = diasDelRango.map(fechaStr => {
    const fecha = new Date(`${fechaStr}T00:00:00`);
    return { label: `${fecha.getDate()}/${fecha.getMonth() + 1}`, monto: montoPorFecha.get(fechaStr) ?? 0 };
  });

  const puntosGananciasChart = granularidadGanancias === 'dia'
    ? puntosGananciasPorDia
    : puntosPeriodo.map(p => {
      const fecha = new Date(`${p.fecha}T00:00:00`);
      const label = granularidadGanancias === 'mes'
        ? nombreMes(fecha, 'short')
        : `${fecha.getDate()}/${fecha.getMonth() + 1}`;
      return { label, monto: p.monto, completo: p.completo };
    });
  const algunBucketParcial = granularidadGanancias !== 'dia' && puntosPeriodo.some(p => !p.completo);
  const totalClientes = (stats?.clientes.nuevas ?? 0) + (stats?.clientes.recurrentes ?? 0);
  // `ganancia_neta` es additive en el payload (ver statsService.ts) — cae a
  // `ganancias` cuando el backend todavía no la sirve, no a 0, para no
  // mostrar "ganancia neta $0" con ganancias reales en pantalla.
  const gananciaNeta = stats?.ganancia_neta ?? stats?.ganancias ?? 0;

  const { completados = 0, confirmados = 0, cancelados = 0 } = stats?.turnos_por_estado ?? {};
  const totalConCancelados = completados + confirmados + cancelados;
  const tasaCancelacion = totalConCancelados > 0 ? Math.round((cancelados / totalConCancelados) * 100) : null;

  // Ritmo de turnos — 7 entradas (dia_semana ISO 1..7, siempre completas)
  // reordenadas Lunes..Domingo con label corto ya resuelto en el locale
  // activo, listas para el gráfico apilado.
  const diasCortos = diasSemanaCortos();
  const ritmoDias = [1, 2, 3, 4, 5, 6, 7].map(iso => {
    const d = stats?.turnos_por_estado_por_dia_semana?.find(x => x.dia_semana === iso)
      ?? { dia_semana: iso, completados: 0, confirmados: 0, cancelados: 0 };
    return { ...d, label: nombreDiaCortoIso(iso, diasCortos) };
  });
  const maxRitmo = ritmoDias.reduce((max, d) => Math.max(max, d.completados + d.confirmados + d.cancelados), 0);
  const diaPico = maxRitmo > 0
    ? ritmoDias.reduce((best, d) => (d.completados + d.confirmados) > (best.completados + best.confirmados) ? d : best, ritmoDias[0])
    : null;

  // Ocupación — grilla hora × día de la semana. Las filas son el rango
  // CONTIGUO de horas observadas en los datos (no un horario fijo asumido),
  // rellenando con 0 las horas intermedias sin turnos.
  const ocupacionMap = new Map(ocupacion.map(b => [`${b.dia_semana}-${b.hora}`, b.cantidad]));
  const horasConDatos = ocupacion.map(b => b.hora);
  const horaMin = horasConDatos.length > 0 ? Math.min(...horasConDatos) : null;
  const horaMax = horasConDatos.length > 0 ? Math.max(...horasConDatos) : null;
  const filasHoras = horaMin !== null && horaMax !== null
    ? Array.from({ length: horaMax - horaMin + 1 }, (_, i) => horaMin + i)
    : [];
  const maxOcupacion = ocupacion.reduce((max, b) => Math.max(max, b.cantidad), 0);
  const horaPico = maxOcupacion > 0
    ? ocupacion.reduce((best, b) => b.cantidad > best.cantidad ? b : best, ocupacion[0]).hora
    : null;

  function colorCeldaOcupacion(cantidad: number): string {
    if (cantidad === 0 || maxOcupacion === 0) return colors.surfaceSubtle;
    const ratio = cantidad / maxOcupacion;
    if (ratio <= 0.33) return colors.primarySoft;
    if (ratio <= 0.66) return withAlpha(colors.primary, '8C');
    return colors.primaryDeep;
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.background, paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ padding: '20px 20px 4px' }}>
        <BackButton />
      </div>
      <div style={{ padding: '4px 20px 18px' }}>
        <h1 style={{ fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 26, lineHeight: 1.15, color: colors.textStrong, margin: 0 }}>
          {t('title')}
        </h1>
      </div>

      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Modo: mes calendario vs. rango de fechas elegido a mano — para
            consultas puntuales tipo "cuánto gané del 8 al 14 de junio". Es
            el único control manual que queda: la agrupación del gráfico de
            ganancias (día/semana/mes) ya no se elige acá, se infiere sola
            del ancho del rango (ver `granularidadGanancias` más arriba en
            el componente). */}
        <div style={{
          display: 'flex', backgroundColor: colors.surfaceSubtle, borderRadius: 14, padding: 3, alignSelf: 'flex-start',
        }}>
          {(['mes', 'personalizado'] as const).map(m => (
            <button
              key={m}
              onClick={() => setModoRango(m)}
              style={{
                border: 'none', borderRadius: 11, padding: '8px 14px', fontSize: 11, fontWeight: 700,
                cursor: 'pointer',
                backgroundColor: modoRango === m ? colors.primarySolid : 'transparent',
                color: modoRango === m ? colors.primaryFg : colors.subtext,
                boxShadow: modoRango === m ? `0 2px 6px ${withAlpha(colors.primary, '59')}` : 'none',
              }}
            >
              {t(`rangeMode_${m}`)}
            </button>
          ))}
        </div>

        {modoRango === 'mes' ? (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            backgroundColor: colors.surface, border: `1px solid ${colors.border}`,
            boxShadow: shadows.card, borderRadius: 16, padding: '10px 14px',
          }}>
            <button
              onClick={() => cambiarMes(-1)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, display: 'flex' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.textStrong} strokeWidth="2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <span style={{ fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 18, color: colors.textStrong }}>
              {nombreMes(viewDate, 'long')} {viewDate.getFullYear()}
            </span>
            <button
              onClick={() => cambiarMes(1)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, display: 'flex' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.textStrong} strokeWidth="2">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        ) : (
          <div style={{
            backgroundColor: colors.surface, border: `1px solid ${colors.border}`,
            boxShadow: shadows.card, borderRadius: 16, padding: '12px 14px',
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <label style={{ fontSize: 13, color: colors.subtext, width: 50 }}>{t('rangeFrom')}</label>
              <input
                type="date"
                value={rangoPersonalizado.desde}
                max={rangoPersonalizado.hasta}
                onChange={e => setRangoPersonalizado(prev => ({ ...prev, desde: e.target.value }))}
                style={{
                  flex: 1, border: `1px solid ${colors.border}`, borderRadius: 10, padding: '8px 10px',
                  fontSize: 14, color: colors.text, backgroundColor: colors.surface,
                }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <label style={{ fontSize: 13, color: colors.subtext, width: 50 }}>{t('rangeTo')}</label>
              <input
                type="date"
                value={rangoPersonalizado.hasta}
                min={rangoPersonalizado.desde}
                onChange={e => setRangoPersonalizado(prev => ({ ...prev, hasta: e.target.value }))}
                style={{
                  flex: 1, border: `1px solid ${colors.border}`, borderRadius: 10, padding: '8px 10px',
                  fontSize: 14, color: colors.text, backgroundColor: colors.surface,
                }}
              />
            </div>
            {rangoInvalido && (
              <p style={{ fontSize: 12, color: colors.danger, margin: 0 }}>{t('rangeInvalid')}</p>
            )}
          </div>
        )}

        {/* Selector de profesional — invisible con ≤1 profesional activa.
            Sin card propia (a diferencia del resto de las secciones): los
            chips flotan directo sobre el fondo, mismo tratamiento que usa
            el selector de "Historia de turnos". */}
        {mostrarSelectorProfesional && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button
              onClick={() => setProfesionalFiltro(null)}
              style={{
                borderRadius: 20, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                border: `1px solid ${profesionalFiltro === null ? colors.primarySolid : colors.border}`,
                backgroundColor: profesionalFiltro === null ? colors.primarySolid : colors.surface,
                color: profesionalFiltro === null ? colors.primaryFg : colors.text,
              }}
            >
              {t('all')}
            </button>
            {activeProfesionales.map(p => {
              const selected = profesionalFiltro === p.id;
              const color = p.color || colors.primary;
              return (
                <button
                  key={p.id}
                  onClick={() => setProfesionalFiltro(selected ? null : p.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    borderRadius: 20, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    border: `1px solid ${selected ? color : colors.border}`,
                    backgroundColor: selected ? color : colors.surface,
                    color: selected ? '#FFF' : colors.text,
                  }}
                >
                  <span style={{
                    width: 8, height: 8, borderRadius: 4, flexShrink: 0,
                    backgroundColor: selected ? '#FFF' : color,
                  }} />
                  {p.nombre}
                </button>
              );
            })}
          </div>
        )}

        {rangoInvalido ? null : error ? (
          <div style={{
            margin: '20px 0', padding: '12px 16px', borderRadius: 8,
            backgroundColor: colors.dangerBg, borderLeft: `4px solid ${colors.dangerBorder}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
          }}>
            <p style={{ fontSize: 14, color: colors.danger, margin: 0 }}>{error}</p>
            <button
              onClick={() => setRetryTick(v => v + 1)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                fontSize: 13, fontWeight: 700, textDecoration: 'underline', color: colors.danger, flexShrink: 0,
              }}
            >
              {t('retry')}
            </button>
          </div>
        ) : loading ? (
          <p style={{ textAlign: 'center', color: colors.subtext, fontSize: 14, marginTop: 40 }}>{t('loading')}</p>
        ) : (
          <>
            {/* Hero figure — el número que lidera la pantalla */}
            <div style={{ textAlign: 'center', padding: '4px 0 2px' }}>
              <span style={{ fontSize: 48, fontWeight: 700, color: colors.textStrong, lineHeight: 1, letterSpacing: -1 }}>
                {stats?.total_turnos ?? 0}
              </span>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: colors.subtext }}>
                {t('period')}{mostrarSelectorProfesional && nombreProfesionalActivo ? ` · ${nombreProfesionalActivo}` : ''}
              </p>
            </div>

            {/* Ritmo de turnos — completados/confirmados/cancelados por día
                de la semana, agregados sobre todo el período elegido. */}
            <div>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 10 }}>
                <div>
                  <h2 style={{ fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 19, color: colors.textStrong, margin: 0 }}>
                    {t('peakLoad')}
                  </h2>
                  <p style={{ fontSize: 12, color: colors.subtext, margin: '2px 0 0' }}>{t('peakLoadSubtitle')}</p>
                </div>
                {cancelados > 0 && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: colors.danger, flexShrink: 0 }}>
                    {t('cancelledBadge', { count: cancelados })}
                  </span>
                )}
              </div>
              {totalConCancelados === 0 ? (
                <p style={{ fontSize: 13, color: colors.subtext, margin: 0 }}>
                  {t('noConfirmedAppointmentsThisPeriod')}
                </p>
              ) : (
                <>
                  <RitmoTurnosChart dias={ritmoDias} />
                  {diaPico && (
                    <p style={{ fontSize: 12, color: colors.subtext, margin: '8px 0 0' }}>
                      {t('peakDayInsight', { dia: nombreDiaLargoIso(diaPico.dia_semana) })}
                    </p>
                  )}
                  {tasaCancelacion !== null && (
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: colors.subtext }}>
                      {t('cancellationRate', { pct: tasaCancelacion })}
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Ganancias */}
            <div>
              <h2 style={{ fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 19, color: colors.textStrong, margin: '0 0 10px' }}>
                {t('earnings')}
              </h2>
              {/* Ganancia neta es el número que importa (ganancias por sí
                  solas no dicen si el período fue rentable) — extiende el
                  mismo tratamiento tipográfico del hero figure de arriba
                  (grande, bold, centrado), un escalón más chico para no
                  competir con el hero real de la pantalla (total_turnos). */}
              <div style={{ textAlign: 'center', padding: '4px 0 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    fontSize: 36, fontWeight: 700, lineHeight: 1, wordBreak: 'break-word',
                    color: gananciaNeta >= 0 ? colors.success : colors.danger,
                  }}>
                    {gananciaNeta < 0 ? `-$${formatMonto(-gananciaNeta)}` : `$${formatMonto(gananciaNeta)}`}
                  </span>
                  {gananciaNeta >= 0
                    ? <TrendingUp size={20} color={colors.success} strokeWidth={2} />
                    : <TrendingDown size={20} color={colors.danger} strokeWidth={2} />}
                </div>
                <p style={{ margin: 0, fontSize: 13, color: colors.subtext }}>{t('netProfit')}</p>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <StatTile
                  label={t('earnings')}
                  value={`$${formatMonto(stats?.ganancias ?? 0)}`}
                  color={colors.success}
                />
                <StatTile
                  label={t('expenses')}
                  value={`$${formatMonto(stats?.gastos ?? 0)}`}
                  color={colors.danger}
                />
              </div>
              {gananciasPorServicio.length > 0 && (
                <>
                  <p style={{ fontSize: 12, fontWeight: 600, color: colors.subtext, margin: '14px 0 6px' }}>
                    {t('earningsByService')}
                  </p>
                  <div style={{
                    backgroundColor: colors.surface, border: `1px solid ${colors.border}`,
                    boxShadow: shadows.card, borderRadius: 16, padding: '16px', display: 'flex',
                    flexDirection: 'column', gap: 14,
                  }}>
                    {gananciasPorServicio.map(s => (
                      <BarraRanking
                        key={s.servicio_id}
                        nombre={s.nombre}
                        cantidad={s.monto}
                        maxCantidad={maxMonto}
                        valorLabel={`$${formatMonto(s.monto)}`}
                      />
                    ))}
                  </div>
                </>
              )}
              {/* Igual que "Por servicio" arriba: si el total ya es $0, no hay
                  nada que la tendencia agregue — mostrar un título "Por día"
                  seguido de un cartel "sin ganancias" es ruido, no información.
                  El error de la tendencia sí se muestra aunque el total sea
                  $0, porque ahí el problema es otro (falló el fetch). */}
              {((stats?.ganancias ?? 0) > 0 || errorPeriodo) && (
                <>
                  <p style={{ fontSize: 12, fontWeight: 600, color: colors.subtext, margin: '14px 0 6px' }}>
                    {t(`earningsTrendLabel_${granularidadGanancias}`)}
                  </p>
                  {granularidadGanancias !== 'dia' && errorPeriodo ? (
                    <div style={{
                      padding: '12px 16px', borderRadius: 16, backgroundColor: colors.dangerBg,
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                    }}>
                      <p style={{ fontSize: 13, color: colors.danger, margin: 0 }}>{errorPeriodo}</p>
                      <button
                        onClick={() => setRetryTick(v => v + 1)}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                          fontSize: 13, fontWeight: 700, textDecoration: 'underline', color: colors.danger, flexShrink: 0,
                        }}
                      >
                        {t('retry')}
                      </button>
                    </div>
                  ) : (
                    <>
                      <MiniBarChart key={`${granularidadGanancias}-${rangoActivo.desde}-${rangoActivo.hasta}`} puntos={puntosGananciasChart} />
                      {algunBucketParcial && (
                        <p style={{ fontSize: 11, color: colors.subtext, margin: '6px 0 0' }}>
                          {t('earningsScope_parcial')}
                        </p>
                      )}
                      {truncadoPeriodo && (
                        <p style={{ fontSize: 11, color: colors.subtext, margin: '6px 0 0' }}>
                          {t('earningsScope_truncado')}
                        </p>
                      )}
                    </>
                  )}
                </>
              )}
            </div>

            {/* Ocupación de agenda — heatmap hora × día de la semana. Filas
                acotadas al rango de horas realmente observado en los datos
                (nunca un horario fijo asumido). */}
            <div>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 10 }}>
                <div>
                  <h2 style={{ fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 19, color: colors.textStrong, margin: 0 }}>
                    {t('occupancy')}
                  </h2>
                  <p style={{ fontSize: 12, color: colors.subtext, margin: '2px 0 0' }}>{t('occupancySubtitle')}</p>
                </div>
                {horaPico !== null && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: colors.primaryDeep, flexShrink: 0 }}>
                    {t('occupancyPeakHourBadge', { hora: horaPico })}
                  </span>
                )}
              </div>
              {errorOcupacion ? (
                <div style={{
                  padding: '12px 16px', borderRadius: 16, backgroundColor: colors.dangerBg,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                }}>
                  <p style={{ fontSize: 13, color: colors.danger, margin: 0 }}>{errorOcupacion}</p>
                  <button
                    onClick={() => setRetryTick(v => v + 1)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                      fontSize: 13, fontWeight: 700, textDecoration: 'underline', color: colors.danger, flexShrink: 0,
                    }}
                  >
                    {t('retry')}
                  </button>
                </div>
              ) : filasHoras.length === 0 ? (
                <p style={{ fontSize: 13, color: colors.subtext, margin: 0 }}>{t('occupancyEmpty')}</p>
              ) : (
                <div style={{
                  backgroundColor: colors.surface, border: `1px solid ${colors.border}`,
                  boxShadow: shadows.card, borderRadius: 16, padding: 16,
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '30px repeat(7, 1fr)', gap: 5 }}>
                    <span />
                    {[1, 2, 3, 4, 5, 6, 7].map(iso => (
                      <span key={iso} style={{ textAlign: 'center', fontSize: 9, fontWeight: 700, color: colors.muted }}>
                        {nombreDiaCortoIso(iso, diasCortos).slice(0, 1)}
                      </span>
                    ))}
                    {filasHoras.map(hora => (
                      <Fragment key={hora}>
                        <span style={{ alignSelf: 'center', fontSize: 9, color: colors.muted }}>
                          {t('occupancyPeakHourBadge', { hora })}
                        </span>
                        {[1, 2, 3, 4, 5, 6, 7].map(iso => {
                          const cantidad = ocupacionMap.get(`${iso}-${hora}`) ?? 0;
                          const seleccionada = celdaOcupacion?.iso === iso && celdaOcupacion?.hora === hora;
                          return (
                            <button
                              key={`${iso}-${hora}`}
                              type="button"
                              onClick={() => setCeldaOcupacion(prev =>
                                prev?.iso === iso && prev?.hora === hora ? null : { iso, hora, cantidad }
                              )}
                              aria-label={t('occupancyCellDetail', { dia: nombreDiaLargoIso(iso), hora, count: cantidad })}
                              style={{
                                aspectRatio: '1 / 1', borderRadius: 6, backgroundColor: colorCeldaOcupacion(cantidad),
                                border: 'none', padding: 0, cursor: 'pointer',
                                outline: seleccionada ? `1.5px solid ${colors.primaryDeep}` : 'none',
                                outlineOffset: 1,
                              }}
                            />
                          );
                        })}
                      </Fragment>
                    ))}
                  </div>
                  {/* Detalle de la celda tocada — el `title` nativo (tooltip
                      on-hover) nunca se disparaba con un tap en mobile, que
                      es como se usa esta pantalla en la práctica. */}
                  <p style={{
                    marginTop: 12, fontSize: celdaOcupacion ? 12 : 10,
                    fontWeight: celdaOcupacion ? 700 : 400,
                    color: celdaOcupacion ? colors.textStrong : colors.subtext,
                  }}>
                    {celdaOcupacion
                      ? t('occupancyCellDetail', { dia: nombreDiaLargoIso(celdaOcupacion.iso), hora: celdaOcupacion.hora, count: celdaOcupacion.cantidad })
                      : t('occupancyFootnote')}
                  </p>
                </div>
              )}
            </div>

            {/* Clientes nuevas vs. recurrentes */}
            <div>
              <h2 style={{ fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 19, color: colors.textStrong, margin: '0 0 10px' }}>
                {t('clients')}
              </h2>
              {totalClientes === 0 ? (
                <p style={{ fontSize: 13, color: colors.subtext, margin: 0 }}>
                  {t('noConfirmedAppointmentsThisPeriod')}
                </p>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <StatTile label={t('newClients')} value={stats!.clientes.nuevas} color={colors.chart1} />
                    <StatTile label={t('returningClients')} value={stats!.clientes.recurrentes} color={colors.chart2} />
                  </div>
                  <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', marginTop: 10, gap: 2 }}>
                    <div style={{ flex: stats!.clientes.nuevas || 0.0001, backgroundColor: colors.chart1, borderRadius: 4 }} />
                    <div style={{ flex: stats!.clientes.recurrentes || 0.0001, backgroundColor: colors.chart2, borderRadius: 4 }} />
                  </div>
                </>
              )}
            </div>

            {/* Servicios más pedidos */}
            <div>
              <h2 style={{ fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 19, color: colors.textStrong, margin: '0 0 10px' }}>
                {t('topServices')}
              </h2>
              {servicios.length === 0 ? (
                <p style={{ fontSize: 13, color: colors.subtext, margin: 0 }}>
                  {t('noServicesThisPeriod')}
                </p>
              ) : (
                <div style={{
                  backgroundColor: colors.surface, border: `1px solid ${colors.border}`,
                  boxShadow: shadows.card, borderRadius: 16, padding: '16px', display: 'flex',
                  flexDirection: 'column', gap: 14,
                }}>
                  {servicios.map(s => (
                    <BarraRanking
                      key={s.servicio_id} nombre={s.nombre} cantidad={s.cantidad} maxCantidad={maxCantidad}
                      color={colors.primaryDeep}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function EstadisticasPage() {
  const t = useTranslations('estadisticas.EstadisticasPage');
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: colors.subtext }}>{t('loading')}</div>}>
      <EstadisticasContent />
    </Suspense>
  );
}
