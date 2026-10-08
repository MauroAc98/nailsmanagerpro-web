'use client';

import { Fragment, Suspense, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Eye, EyeOff, Sparkles, TrendingDown, TrendingUp, X } from 'lucide-react';
import { MontoFit } from '@/components/estadisticas/MontoFit';
import { Consejo } from '@/components/estadisticas/Consejo';
import { acumular, alinearPrevio, diferenciaAcumulada, promedioDiario } from '@/lib/estadisticas/acumulado';
import { brechaServicio, diaFlojo, diaPico, franjaLibre, retencion } from '@/lib/estadisticas/insights';
import {
  horaPicoDelDia, rangoMesAnterior, rangoMesAnteriorMismoPeriodo, serviciosParaBurbujas, ticketDiaSemana,
  ticketPromedio, topConOtros, unirServicios, variacionPorcentual,
} from '@/lib/estadisticas/metricas';
import { useOcultarMonto } from '@/hooks/useOcultarMonto';
import BackButton from '@/components/BackButton';
import { agendaColors as colors, agendaShadows as shadows, agendaFontSerif } from '@/theme/agendaColors';
import { withAlpha } from '@/theme/colors';
import { inicialesProfesional } from '@/lib/inicialesProfesional';
import { useProfesionalStore } from '@/store/useProfesionalStore';
import { statsService, DashboardStats, PuntoGanancia, BucketOcupacion } from '@/services/statsService';
import { extraerMensajeError } from '@/services/clienteService';
import { nombreMes, nombreDia, diasSemanaCortos, formatoYMD } from '@/lib/dateFormat';
import { labelCategoriaIngreso } from '@/lib/categoriaLabel';
import { formatMonto } from '@/lib/money';

// Recharts pesa ~100KB: se carga solo al entrar a esta pantalla (no en el
// bundle de Agenda ni del resto), y sin SSR — mide el contenedor con
// ResizeObserver, que no existe en el servidor.
function ChartSkeleton({ height }: { height: number }) {
  return <div style={{ height, borderRadius: 12, backgroundColor: colors.surfaceSubtle }} aria-hidden />;
}
const TendenciaChart = dynamic(() => import('@/components/estadisticas/TendenciaChart'), {
  ssr: false, loading: () => <ChartSkeleton height={150} />,
});
const RitmoSemanaChart = dynamic(() => import('@/components/estadisticas/RitmoSemanaChart'), {
  ssr: false, loading: () => <ChartSkeleton height={130} />,
});
const DonutChart = dynamic(() => import('@/components/estadisticas/DonutChart'), {
  ssr: false, loading: () => <ChartSkeleton height={128} />,
});
const AcumuladoChart = dynamic(() => import('@/components/estadisticas/AcumuladoChart'), {
  ssr: false, loading: () => <ChartSkeleton height={170} />,
});
const BurbujasChart = dynamic(() => import('@/components/estadisticas/BurbujasChart'), {
  ssr: false, loading: () => <ChartSkeleton height={230} />,
});

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
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13 }}>
        <span style={{ color: colors.text, fontWeight: 600, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nombre}</span>
        <span style={{ color: colors.subtext, flexShrink: 0, whiteSpace: 'nowrap' }}>{valorLabel ?? cantidad}</span>
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
  // Las labels de categoría de "otros ingresos" son las del catálogo de
  // Ingresos — se reusan acá en vez de duplicarlas bajo este namespace,
  // mismo criterio que NuevoGastoPage con las de Gastos.
  const tIngresos = useTranslations('configuracion.IngresosPage');
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
  const [ocultarMonto, toggleOcultarMonto] = useOcultarMonto();

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
  // Mes anterior (solo modo "mes"): alimenta la insignia de variación y la
  // línea punteada de la tendencia. Guarda la clave (mes + profesional) que lo
  // generó para no mostrar el previo de otro período mientras llega el nuevo
  // — mismo patrón que ResumenMesCard.
  const [previo, setPrevio] = useState<{ key: string; stats: DashboardStats } | null>(null);
  const previoKey = `${profesionalFiltro ?? 'all'}:${viewDate.getFullYear()}-${viewDate.getMonth()}`;
  // Mes en curso: la insignia compara contra el MISMO tramo del mes anterior
  // (día 1 al día de hoy). La línea punteada sigue usando el mes entero.
  const hoy = new Date();
  const periodoPrevio = modoRango === 'mes' ? rangoMesAnteriorMismoPeriodo(viewDate, hoy) : null;
  const previoParcialKey = periodoPrevio ? `${previoKey}:${periodoPrevio.dia}` : null;
  const [previoParcial, setPrevioParcial] = useState<{ key: string; stats: DashboardStats } | null>(null);
  // Día de la semana ISO elegido tocando el gráfico de ritmo (null = ninguno):
  // abre el resumen del día y resalta su columna en el heatmap de ocupación.
  const [diaSeleccionado, setDiaSeleccionado] = useState<number | null>(null);
  const alternarDia = (iso: number) => setDiaSeleccionado(prev => (prev === iso ? null : iso));

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

  useEffect(() => {
    if (modoRango !== 'mes') return;
    let cancelled = false;
    const r = rangoMesAnterior(viewDate);

    statsService.getDashboard(r.desde, r.hasta, profesionalFiltro ?? undefined)
      .then(data => { if (!cancelled) setPrevio({ key: previoKey, stats: data }); })
      .catch(() => { /* la comparación es opcional: sin ella la pantalla funciona igual */ });

    return () => { cancelled = true; };
  }, [modoRango, viewDate, profesionalFiltro, retryTick, previoKey]);

  useEffect(() => {
    if (!periodoPrevio || !previoParcialKey) return;
    let cancelled = false;

    statsService.getDashboard(periodoPrevio.desde, periodoPrevio.hasta, profesionalFiltro ?? undefined)
      .then(data => { if (!cancelled) setPrevioParcial({ key: previoParcialKey, stats: data }); })
      .catch(() => { /* comparación opcional */ });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previoParcialKey, profesionalFiltro, retryTick]);

  const cambiarMes = (delta: number) => {
    setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  const servicios = stats?.servicios_mas_pedidos ?? [];
  const gananciasPorServicio = stats?.ganancias_por_servicio ?? [];
  const maxMonto = gananciasPorServicio.reduce((max, s) => Math.max(max, s.monto), 0);
  const montoPorFecha = new Map((stats?.ganancias_por_dia ?? []).map(d => [d.fecha, d.monto]));
  const puntosGananciasPorDia = diasDelRango.map(fechaStr => {
    const fecha = new Date(`${fechaStr}T00:00:00`);
    // Mes en curso: los días futuros no existen todavía — null (no se dibujan),
    // nunca 0, que se vería como un derrumbe. Hoy sin turnos sí es 0.
    const esFuturo = modoRango === 'mes' && periodoPrevio !== null && fechaStr > formatFecha(hoy);
    return {
      label: `${fecha.getDate()}/${fecha.getMonth() + 1}`,
      monto: esFuturo ? null : (montoPorFecha.get(fechaStr) ?? 0),
    };
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

  // Ingresos: lo que factura la agenda (turnos completados) vs. lo que la
  // dueña carga a mano ajeno a su rubro. `ingresos_agenda` es el nombre
  // nuevo de `ganancias` (mismo valor) — se cae a `ganancias` para builds
  // servidos por un backend viejo. `ingresos_otros` y su desglose los
  // devuelve el backend en 0 cuando se filtra por profesional (un ingreso
  // del salón no tiene profesional), así que ese bloque se oculta con el
  // filtro activo en vez de mostrar un $0 permanente.
  const ingresosAgenda = stats?.ingresos_agenda ?? stats?.ganancias ?? 0;
  const ingresosOtros = stats?.ingresos_otros ?? 0;
  const ingresosTotales = ingresosAgenda + ingresosOtros;
  const ingresosOtrosPorCategoria = (stats?.ingresos_otros_por_categoria ?? []).filter(c => c.monto > 0);
  const desglosarIngresos = profesionalFiltro === null && ingresosOtros > 0;
  const coloresOrigen = [colors.amber, colors.chart1, colors.chart2, colors.muted];
  const origenIngresos = [
    { nombre: t('incomeFromWork'), monto: ingresosAgenda, color: colors.primaryDeep },
    ...ingresosOtrosPorCategoria.map((c, i) => ({
      nombre: labelCategoriaIngreso(c.categoria, tIngresos),
      monto: c.monto,
      color: coloresOrigen[i % coloresOrigen.length],
    })),
  ].filter(o => o.monto > 0);

  // Comparación con el mes anterior (solo modo "mes").
  const mesAnteriorDate = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1);
  const statsPrevio = modoRango === 'mes' && previo?.key === previoKey ? previo.stats : null;
  // Base de la insignia: mes en curso -> mismo tramo; mes cerrado -> mes entero.
  const statsBase = periodoPrevio
    ? (previoParcial?.key === previoParcialKey ? previoParcial.stats : null)
    : statsPrevio;
  const gananciaNetaPrevia = statsBase ? (statsBase.ganancia_neta ?? statsBase.ganancias) : null;
  const variacion = gananciaNetaPrevia !== null ? variacionPorcentual(gananciaNeta, gananciaNetaPrevia) : null;
  // Línea punteada: mismo día del mes, alineada por posición. Sin ingresos el
  // mes anterior sería una recta en 0 — ruido, no comparación.
  const previoSerie = (() => {
    if (granularidadGanancias !== 'dia' || !statsPrevio) return null;
    if (statsPrevio.ganancias_por_dia.every(d => d.monto <= 0)) return null;
    const montoPrevioPorFecha = new Map(statsPrevio.ganancias_por_dia.map(d => [d.fecha, d.monto]));
    return diasDelRango.map((_, i) => {
      const f = new Date(mesAnteriorDate.getFullYear(), mesAnteriorDate.getMonth(), i + 1);
      return f.getMonth() === mesAnteriorDate.getMonth() ? (montoPrevioPorFecha.get(formatFecha(f)) ?? 0) : undefined;
    });
  })();

  // Acumulado vs mes anterior (solo modo "mes"): las barras son el cobro del
  // día, la curva el acumulado. La serie del mes en curso se corta en hoy
  // (puntosGananciasPorDia ya trae null en los días futuros); la del mes
  // anterior va entera. Sin cobros el mes anterior no hay base: sin tarjeta.
  const montosActuales = puntosGananciasPorDia.map(pt => pt.monto);
  const acumuladoActual = acumular(montosActuales);
  const montosPrevioDiarios = (() => {
    if (modoRango !== 'mes' || !statsPrevio) return null;
    const r = rangoMesAnterior(viewDate);
    const porFecha = new Map(statsPrevio.ganancias_por_dia.map(d => [d.fecha, d.monto]));
    return enumerarFechas(r.desde, r.hasta).map(f => porFecha.get(f) ?? 0);
  })();
  const acumuladoPrevio = montosPrevioDiarios && montosPrevioDiarios.some(m => m > 0)
    ? alinearPrevio(montosPrevioDiarios, diasDelRango.length)
    : null;
  const ritmoAcumulado = acumuladoPrevio && (stats?.ganancias ?? 0) > 0
    ? {
      serie: puntosGananciasPorDia.map((pt, i) => ({
        label: pt.label, monto: pt.monto, acumulado: acumuladoActual[i], previo: acumuladoPrevio[i],
      })),
      diferencia: diferenciaAcumulada(acumuladoActual, acumuladoPrevio),
    }
    : null;
  // Línea de promedio diario: solo de los días ya transcurridos.
  const promedioDia = granularidadGanancias === 'dia' ? promedioDiario(montosActuales) : null;

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
  const picoSemana = diaPico(ritmoDias);
  const flojoSemana = diaFlojo(ritmoDias);
  const ticket = ticketPromedio(ingresosAgenda, completados);

  // Servicios: top 4 + "Otros" en la dona (más de 5 rebanadas no se leen).
  const serviciosAgrupados = topConOtros(
    servicios.map(s => ({ nombre: s.nombre, valor: s.cantidad })), 4, t('topServicesOthers'),
  );
  const totalServiciosTurnos = serviciosAgrupados.reduce((a, s) => a + s.valor, 0);
  const coloresDonut = [colors.primaryDeep, colors.primary, colors.chart1, colors.amber, colors.muted];
  const donutServicios = serviciosAgrupados.map((s, i) => ({
    name: s.nombre,
    value: s.valor,
    color: coloresDonut[i % coloresDonut.length],
    valorLabel: `${Math.round((s.valor / totalServiciosTurnos) * 100)}%`,
  }));
  const retencionClientas = retencion(stats?.clientes.nuevas ?? 0, stats?.clientes.recurrentes ?? 0);

  // Burbujas: se unen por servicio_id. Ojo: turnos = confirmados + completados
  // pero monto = solo completados, así que el ticket subestima un poco mientras
  // haya turnos confirmados sin cobrar (mes en curso).
  const serviciosUnidos = unirServicios(servicios, gananciasPorServicio);
  const coloresBurbuja = [colors.primaryDeep, colors.amber, colors.chart1, colors.chart2, colors.primary, colors.muted];
  const burbujas = serviciosParaBurbujas(serviciosUnidos).map((sv, i) => ({
    servicio_id: sv.servicio_id, nombre: sv.nombre, turnos: sv.turnos, ticket: sv.ticket as number,
    monto: sv.monto, color: coloresBurbuja[i % coloresBurbuja.length],
  }));
  const brecha = burbujas.length > 0 ? brechaServicio(serviciosUnidos) : null;

  // Resumen del día elegido: todo derivado de datos reales del período.
  const resumenDia = diaSeleccionado !== null
    ? {
      ritmo: ritmoDias.find(d => d.dia_semana === diaSeleccionado)!,
      horaPico: horaPicoDelDia(ocupacion, diaSeleccionado),
      ticket: ticketDiaSemana(stats?.ganancias_por_dia ?? [], ritmoDias, diaSeleccionado),
    }
    : null;
  const nombreDiaElegido = diaSeleccionado !== null ? nombreDiaLargoIso(diaSeleccionado) : '';

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

  const hueco = franjaLibre(ocupacion);

  const cardStyle: React.CSSProperties = {
    backgroundColor: colors.surface, border: `1px solid ${colors.border}`,
    boxShadow: shadows.card, borderRadius: 20, padding: 16,
  };
  const tituloCard: React.CSSProperties = {
    fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 19, color: colors.textStrong, margin: '0 0 12px',
  };

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
                display: 'flex', alignItems: 'center', gap: 6,
                borderRadius: 20, padding: '4px 16px 4px 4px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                border: `1px solid ${profesionalFiltro === null ? colors.primarySolid : colors.border}`,
                backgroundColor: profesionalFiltro === null ? colors.primarySolid : colors.surface,
                color: profesionalFiltro === null ? colors.primaryFg : colors.text,
              }}
            >
              {/* Ícono de grupo — mismo criterio que Agenda/Gastos: distingue
                  la opción agregadora de las profesionales puntuales, que
                  llevan su avatar con iniciales. */}
              <span style={{
                width: 20, height: 20, borderRadius: 10, flexShrink: 0,
                backgroundColor: profesionalFiltro === null ? withAlpha(colors.primaryFg, '3D') : withAlpha(colors.primary, '26'),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                  stroke={profesionalFiltro === null ? colors.primaryFg : colors.primaryDeep} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </span>
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
                    borderRadius: 20, padding: '4px 16px 4px 4px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    border: `1px solid ${selected ? color : colors.border}`,
                    backgroundColor: selected ? color : colors.surface,
                    color: selected ? '#FFF' : colors.text,
                  }}
                >
                  <span style={{
                    width: 20, height: 20, borderRadius: 10, flexShrink: 0, overflow: 'hidden',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, fontWeight: 800,
                    backgroundColor: selected ? withAlpha('#fff', '3D') : withAlpha(color, '26'),
                    color: selected ? '#fff' : color,
                  }}>
                    {p.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      inicialesProfesional(p.nombre, p.apellido)
                    )}
                  </span>
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
            {/* Héroe — ganancia neta (lo que importa) + comparación con el mes
                anterior y tres números de contexto. */}
            {/* Mismo estilo que ResumenMesCard (Agenda): degradado suave del
                primario, borde sutil, destellos + etiqueta en mayúsculas. Todo
                con tokens del tema, así sirve igual en claro y oscuro. */}
            <div style={{
              background: `linear-gradient(135deg, ${colors.primarySoft}, ${colors.surface})`,
              border: `1px solid color-mix(in srgb, ${colors.primary} 25%, transparent)`,
              color: colors.strong, borderRadius: 24,
              padding: 18, boxShadow: shadows.card,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                  <Sparkles size={14} color={colors.primaryDeep} strokeWidth={2.5} style={{ flexShrink: 0 }} />
                  <p style={{
                    margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: colors.primaryDeep,
                    textTransform: 'uppercase', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {t('netProfit')}{mostrarSelectorProfesional && nombreProfesionalActivo ? ` · ${nombreProfesionalActivo}` : ''}
                  </p>
                </div>
                {/* Misma preferencia compartida (useOcultarMonto) que
                    ResumenMesCard en Agenda — privacidad situacional. */}
                <span
                  onClick={toggleOcultarMonto}
                  role="button"
                  aria-label={ocultarMonto ? t('showAmount') : t('hideAmount')}
                  style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', padding: 4, margin: -4, flexShrink: 0 }}
                >
                  {ocultarMonto
                    ? <EyeOff size={16} color={colors.sub} strokeWidth={2} />
                    : <Eye size={16} color={colors.sub} strokeWidth={2} />}
                </span>
              </div>
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                {ocultarMonto ? (
                  <span style={{ fontSize: 38, lineHeight: 1, fontFamily: agendaFontSerif, color: colors.strong }}>
                    ${' '}<span style={{ fontSize: 28, letterSpacing: 3 }}>●●●●●</span>
                  </span>
                ) : (
                  // El monto se achica para entrar en el ancho; nunca se parte
                  // dígito por dígito ni se corta, por grande que sea.
                  <MontoFit maxFontSize={38} minFontSize={18} style={{ lineHeight: 1, fontFamily: agendaFontSerif, color: colors.strong }}>
                    {gananciaNeta < 0 ? `-$${formatMonto(-gananciaNeta)}` : `$${formatMonto(gananciaNeta)}`}
                  </MontoFit>
                )}
                {variacion !== null && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 999,
                    backgroundColor: variacion >= 0 ? colors.successBg : colors.dangerBg,
                    color: variacion >= 0 ? colors.success : colors.danger, fontSize: 12, fontWeight: 700,
                  }}>
                    {variacion >= 0 ? <TrendingUp size={13} strokeWidth={2.5} /> : <TrendingDown size={13} strokeWidth={2.5} />}
                    {periodoPrevio
                      ? t('vsPreviousToDay', { pct: Math.abs(variacion), mes: nombreMes(mesAnteriorDate, 'long'), dia: periodoPrevio.dia })
                      : t('vsPrevious', { pct: Math.abs(variacion), mes: nombreMes(mesAnteriorDate, 'long') })}
                  </span>
                )}
              </div>
              <p style={{ margin: '6px 0 0', fontSize: 12, color: colors.sub }}>
                {t('heroIncomeExpenses', {
                  ingresos: ocultarMonto ? '••••' : `$${formatMonto(ingresosTotales)}`,
                  gastos: ocultarMonto ? '••••' : `$${formatMonto(stats?.gastos ?? 0)}`,
                })}
              </p>
              {/* Una sola franja con divisores (no tres cajitas): en el celular
                  cada cajita quedaba muy angosta y cortaba el monto y las
                  etiquetas ("promedio p…"). Monto corto sin decimales y
                  etiquetas que bajan de renglón en vez de cortarse. */}
              <div
                data-testid="hero-kpis"
                style={{
                  marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                  backgroundColor: colors.surface, borderRadius: 14, overflow: 'hidden',
                  border: `1px solid color-mix(in srgb, ${colors.primary} 15%, transparent)`,
                }}
              >
                {[
                  { value: String(stats?.total_turnos ?? 0), label: t('kpiAppointments') },
                  {
                    value: ticket === null ? '—' : ocultarMonto ? '••••' : `$${formatMonto(ticket)}`,
                    label: t('kpiAverageTicket'),
                  },
                  { value: tasaCancelacion === null ? '—' : `${tasaCancelacion}%`, label: t('kpiCancellations') },
                ].map((k, i) => (
                  <div key={k.label} style={{
                    minWidth: 0, padding: '10px 6px', textAlign: 'center',
                    borderLeft: i === 0 ? 'none' : `1px solid color-mix(in srgb, ${colors.primary} 15%, transparent)`,
                  }}>
                    <p style={{ margin: 0 }}>
                      <MontoFit maxFontSize={17} minFontSize={10} style={{ lineHeight: 1.1, fontFamily: agendaFontSerif, color: colors.strong }}>{k.value}</MontoFit>
                    </p>
                    <p style={{ margin: '3px 0 0', fontSize: 10.5, lineHeight: 1.2, color: colors.sub, whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{k.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Tendencia de ganancias. Igual que antes: si el total ya es $0
                no hay nada que la tendencia agregue; el error de la
                tendencia sí se muestra porque ahí el problema es el fetch. */}
            {((stats?.ganancias ?? 0) > 0 || errorPeriodo) && (
              <div style={cardStyle}>
                <h2 style={tituloCard}>{t(`earningsTrendLabel_${granularidadGanancias}`)}</h2>
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
                    <TendenciaChart
                      key={`${granularidadGanancias}-${rangoActivo.desde}-${rangoActivo.hasta}`}
                      puntos={puntosGananciasChart}
                      tipo={granularidadGanancias === 'dia' ? 'area' : 'barras'}
                      previo={previoSerie ?? undefined}
                      previoLabel={previoSerie ? nombreMes(mesAnteriorDate, 'long') : undefined}
                      ocultarMonto={ocultarMonto}
                      parcialLabel={t('earningsPartialBucket')}
                      ariaLabel={t('trendAria')}
                      promedio={promedioDia}
                      promedioLabel={promedioDia ? t('avgLabel', { monto: `$${formatMonto(Math.round(promedioDia))}` }) : undefined}
                    />
                    {previoSerie && (
                      <div style={{ display: 'flex', gap: 14, marginTop: 8, fontSize: 11, color: colors.subtext }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <i style={{ width: 14, height: 3, borderRadius: 2, backgroundColor: colors.primaryDeep, display: 'inline-block' }} />
                          {nombreMes(viewDate, 'long')}
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <i style={{ width: 14, borderTop: `2px dashed ${colors.muted}`, display: 'inline-block' }} />
                          {nombreMes(mesAnteriorDate, 'long')}
                        </span>
                      </div>
                    )}
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
              </div>
            )}

            {/* ¿Cómo vas contra el mes pasado? — barras del día + acumulado,
                contra el acumulado del mes anterior a igual día. */}
            {ritmoAcumulado && (
              <div style={cardStyle}>
                <h2 style={{ ...tituloCard, marginBottom: 4 }}>{t('paceTitle')}</h2>
                <p style={{ fontSize: 12, color: colors.subtext, margin: '0 0 10px' }}>{t('paceSubtitle')}</p>
                {ritmoAcumulado.diferencia && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 999,
                    marginBottom: 10, fontSize: 12, fontWeight: 700,
                    backgroundColor: ritmoAcumulado.diferencia.diff >= 0 ? colors.successBg : colors.amberBg,
                    color: ritmoAcumulado.diferencia.diff >= 0 ? colors.success : colors.amberFg,
                  }}>
                    {ritmoAcumulado.diferencia.diff >= 0 ? <TrendingUp size={13} strokeWidth={2.5} /> : <TrendingDown size={13} strokeWidth={2.5} />}
                    {t(ritmoAcumulado.diferencia.diff >= 0 ? 'paceAbove' : 'paceBelow', {
                      monto: ocultarMonto ? '••••' : `$${formatMonto(Math.abs(ritmoAcumulado.diferencia.diff))}`,
                      mes: nombreMes(mesAnteriorDate, 'long'),
                      dia: ritmoAcumulado.diferencia.dia,
                    })}
                  </span>
                )}
                <AcumuladoChart
                  key={`acum-${rangoActivo.desde}-${rangoActivo.hasta}`}
                  serie={ritmoAcumulado.serie}
                  labels={{ daily: t('paceDaily'), cumulative: t('paceCumulative'), previous: nombreMes(mesAnteriorDate, 'long') }}
                  ocultarMonto={ocultarMonto}
                  ariaLabel={t('paceAria')}
                />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 8, fontSize: 11, color: colors.subtext }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <i style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: colors.primarySoft, display: 'inline-block' }} />
                    {t('paceDaily')}
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <i style={{ width: 14, height: 3, borderRadius: 2, backgroundColor: colors.primaryDeep, display: 'inline-block' }} />
                    {t('paceCumulative')}
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <i style={{ width: 14, borderTop: `2px dashed ${colors.muted}`, display: 'inline-block' }} />
                    {nombreMes(mesAnteriorDate, 'long')}
                  </span>
                </div>
              </div>
            )}

            {/* De dónde viene la plata — solo con ingresos manuales y sin
                filtro de profesional (un ingreso del salón no tiene
                profesional; el backend lo devuelve en 0 con el filtro). */}
            {desglosarIngresos && (
              <div style={cardStyle}>
                <h2 style={tituloCard}>{t('sourceTitle')}</h2>
                <div style={{ display: 'flex', height: 14, borderRadius: 999, overflow: 'hidden', gap: 2 }}>
                  {origenIngresos.map(o => (
                    <span key={o.nombre} style={{ flex: o.monto, backgroundColor: o.color, minWidth: 4 }} />
                  ))}
                </div>
                <ul style={{ margin: '12px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {origenIngresos.map(o => (
                    <li key={o.nombre} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: colors.text, minWidth: 0 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: o.color, flexShrink: 0 }} />
                      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.nombre}</span>
                      <b style={{ flexShrink: 0 }}>
                        {ocultarMonto ? '••••' : `$${formatMonto(o.monto)}`} · {Math.round((o.monto / ingresosTotales) * 100)}%
                      </b>
                    </li>
                  ))}
                </ul>
                {(stats?.gastos ?? 0) > 0 && (
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 12, paddingTop: 10,
                    borderTop: `1px solid ${colors.hairline}`, fontSize: 13, color: colors.danger,
                  }}>
                    <span>{t('expenses')}</span>
                    <b>{ocultarMonto ? '••••' : `-$${formatMonto(stats?.gastos ?? 0)}`}</b>
                  </div>
                )}
              </div>
            )}

            {/* Servicios — dona por cantidad de turnos + ranking de lo que
                aportó cada uno en plata. */}
            <div style={cardStyle}>
              <h2 style={tituloCard}>{t('topServices')}</h2>
              {servicios.length === 0 ? (
                <p style={{ fontSize: 13, color: colors.subtext, margin: 0 }}>
                  {t('noServicesThisPeriod')}
                </p>
              ) : (
                <>
                  <DonutChart
                    data={donutServicios}
                    centerValue={totalServiciosTurnos}
                    centerLabel={t('donutAppointments')}
                    ariaLabel={t('servicesAria')}
                  />
                  {gananciasPorServicio.length > 0 && (
                    <>
                      <p style={{ fontSize: 12, fontWeight: 600, color: colors.subtext, margin: '16px 0 8px' }}>
                        {t('earningsByService')}
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {gananciasPorServicio.map(s => (
                          <BarraRanking
                            key={s.servicio_id}
                            nombre={s.nombre}
                            cantidad={s.monto}
                            maxCantidad={maxMonto}
                            valorLabel={ocultarMonto ? '••••' : `$${formatMonto(s.monto)}`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>

            {/* Qué servicio rinde más — turnos vs. ticket, tamaño = plata total.
                Solo con >=3 servicios con plata cobrada. */}
            {burbujas.length > 0 && (
              <div style={cardStyle}>
                <h2 style={{ ...tituloCard, marginBottom: 4 }}>{t('bubblesTitle')}</h2>
                <p style={{ fontSize: 12, color: colors.subtext, margin: '0 0 12px' }}>{t('bubblesSubtitle')}</p>
                <BurbujasChart
                  servicios={burbujas}
                  ejes={{ turnos: t('bubbleAxisTurnos'), ticket: t('bubbleAxisTicket'), monto: t('bubbleAxisTotal') }}
                  ocultarMonto={ocultarMonto}
                  ariaLabel={t('bubblesAria')}
                />
                <ul style={{ margin: '12px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {burbujas.map(b => (
                    <li key={b.servicio_id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: colors.text, minWidth: 0 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: b.color, flexShrink: 0 }} />
                      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.nombre}</span>
                      <span style={{ flexShrink: 0, color: colors.subtext }}>{t('bubblesTurnosCount', { count: b.turnos })}</span>
                      <b style={{ flexShrink: 0, minWidth: 74, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {ocultarMonto ? '••••' : `${formatMonto(b.monto)}`}
                      </b>
                    </li>
                  ))}
                </ul>
                {brecha && (
                  <Consejo>{t('tipServiceGap', { nombre: brecha.nombre, pctTurnos: brecha.pctTurnos, pctPlata: brecha.pctPlata })}</Consejo>
                )}
              </div>
            )}

            {/* Ritmo de turnos — completados/confirmados/cancelados por día
                de la semana, agregados sobre todo el período elegido. */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <h2 style={{ ...tituloCard, marginBottom: 0 }}>{t('peakLoad')}</h2>
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
                  {/* Tocar un día lo filtra: chip para limpiar o, sin día, la
                      pista de que se puede tocar. */}
                  {diaSeleccionado !== null ? (
                    <button
                      type="button"
                      onClick={() => setDiaSeleccionado(null)}
                      aria-label={t('dayFilterClear', { dia: nombreDiaElegido })}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 36, padding: '0 12px', marginBottom: 8,
                        border: 'none', borderRadius: 999, cursor: 'pointer', touchAction: 'manipulation',
                        backgroundColor: colors.primarySolid, color: colors.primaryFg, fontSize: 12, fontWeight: 700,
                      }}
                    >
                      {nombreDiaElegido.charAt(0).toUpperCase() + nombreDiaElegido.slice(1)}
                      <X size={13} strokeWidth={2.5} aria-hidden />
                    </button>
                  ) : (
                    <p style={{ fontSize: 11, color: colors.subtext, margin: '0 0 6px' }}>{t('dayFilterHint')}</p>
                  )}
                  <RitmoSemanaChart
                    seleccionado={diaSeleccionado}
                    onSeleccionar={alternarDia}
                    dias={ritmoDias}
                    labels={{ completed: t('completed'), confirmed: t('confirmed'), cancelled: t('cancelled') }}
                    ariaLabel={t('rhythmAria')}
                  />
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 8, fontSize: 10, color: colors.subtext }}>
                    {([['completed', colors.success], ['confirmed', colors.primary], ['cancelled', colors.danger]] as const).map(([k, c]) => (
                      <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <i style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c, display: 'inline-block' }} />
                        {t(k)}
                      </span>
                    ))}
                  </div>
                  {resumenDia && (
                    <div data-testid="resumen-dia" style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
                      {[
                        { value: String(resumenDia.ritmo.completados), label: t('completed') },
                        { value: String(resumenDia.ritmo.confirmados), label: t('confirmed') },
                        { value: String(resumenDia.ritmo.cancelados), label: t('cancelled') },
                        ...(resumenDia.horaPico !== null ? [{ value: t('occupancyPeakHourBadge', { hora: resumenDia.horaPico }), label: t('dayPeakHour') }] : []),
                        ...(resumenDia.ticket !== null
                          ? [{ value: ocultarMonto ? '••••' : `$${formatMonto(resumenDia.ticket)}`, label: t('dayTicket') }]
                          : []),
                      ].map(k => (
                        <div key={k.label} style={{ backgroundColor: colors.surfaceSubtle, borderRadius: 14, padding: '10px 12px', minWidth: 0 }}>
                          <p style={{ margin: 0 }}>
                            <MontoFit maxFontSize={18} minFontSize={10} style={{ fontFamily: agendaFontSerif, color: colors.textStrong }}>{k.value}</MontoFit>
                          </p>
                          <p style={{ margin: '2px 0 0', fontSize: 10.5, lineHeight: 1.2, color: colors.subtext, whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{k.label}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {tasaCancelacion !== null && (
                    <p style={{ margin: '8px 0 0', fontSize: 12, color: colors.subtext }}>
                      {t('cancellationRate', { pct: tasaCancelacion })}
                    </p>
                  )}
                  {picoSemana && (
                    <Consejo>{t('tipPeakDay', { dia: nombreDiaLargoIso(picoSemana.dia_semana), pct: picoSemana.pct })}</Consejo>
                  )}
                  {flojoSemana && (
                    <Consejo>{t('tipQuietDay', { dia: nombreDiaLargoIso(flojoSemana.dia_semana), pct: flojoSemana.pct })}</Consejo>
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
                      <span key={iso} style={{
                        textAlign: 'center', fontSize: 9, fontWeight: 700,
                        color: diaSeleccionado === iso ? colors.primaryDeep : colors.muted,
                        opacity: diaSeleccionado === null || diaSeleccionado === iso ? 1 : 0.4,
                      }}>
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
                                // Con un día elegido en el ritmo, su columna queda resaltada.
                                opacity: diaSeleccionado === null || diaSeleccionado === iso ? 1 : 0.3,
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
                  {hueco && (
                    <Consejo>{t(`tipFreeSlot_${hueco.franja}`, { dia: nombreDiaLargoIso(hueco.dia_semana) })}</Consejo>
                  )}
                </div>
              )}
            </div>

            {/* Clientas nuevas vs. recurrentes */}
            <div style={cardStyle}>
              <h2 style={tituloCard}>{t('clients')}</h2>
              {totalClientes === 0 ? (
                <p style={{ fontSize: 13, color: colors.subtext, margin: 0 }}>
                  {t('noConfirmedAppointmentsThisPeriod')}
                </p>
              ) : (
                <>
                  <DonutChart
                    data={[
                      { name: t('newClients'), value: stats!.clientes.nuevas, color: colors.chart1, valorLabel: String(stats!.clientes.nuevas) },
                      { name: t('returningClients'), value: stats!.clientes.recurrentes, color: colors.chart2, valorLabel: String(stats!.clientes.recurrentes) },
                    ]}
                    centerValue={totalClientes}
                    centerLabel={t('donutClients')}
                    ariaLabel={t('clientsAria')}
                    size={110}
                  />
                  {retencionClientas && <Consejo>{t('tipRetention', { pct: retencionClientas.pct })}</Consejo>}
                </>
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
