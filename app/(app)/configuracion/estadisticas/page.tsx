'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import BackButton from '@/components/BackButton';
import { colors, shadows } from '@/theme/colors';
import { useProfesionalStore } from '@/store/useProfesionalStore';
import { statsService, DashboardStats, PuntoGanancia } from '@/services/statsService';
import { extraerMensajeError } from '@/services/clienteService';
import { nombreMes, formatoYMD } from '@/lib/dateFormat';
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
        boxShadow: shadows.card, borderRadius: 14, padding: '16px',
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
      boxShadow: shadows.card, borderRadius: 14, padding: '16px',
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
                outline: esSeleccionado ? `2px solid ${colors.primary}` : 'none',
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
// Barra de ranking — magnitud de una sola serie (servicios más pedidos).
// El nombre del servicio ya identifica la barra, así que un solo color
// (colors.primary) alcanza; la etiqueta de valor va afuera, en tinta de
// texto, nunca en el color de la barra.
// ─────────────────────────────────────────────
function BarraRanking({
  nombre, cantidad, maxCantidad, valorLabel,
}: { nombre: string; cantidad: number; maxCantidad: number; valorLabel?: string }) {
  const pct = maxCantidad > 0 ? Math.max((cantidad / maxCantidad) * 100, 4) : 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
        <span style={{ color: colors.text, fontWeight: 600 }}>{nombre}</span>
        <span style={{ color: colors.subtext }}>{valorLabel ?? cantidad}</span>
      </div>
      <div style={{ height: 10, borderRadius: 5, backgroundColor: colors.surfaceSubtle, overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`, height: '100%', borderRadius: 5,
          backgroundColor: colors.primary, transition: 'width 0.3s ease',
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
    // debajo del ancho de contenido — sin esto, en filas de 3 (Turnos por
    // estado) el navegador respeta el min-width de contenido de cada hijo y,
    // en pantallas angostas (~320px), la última tarjeta se corta y se sale
    // del contenedor en vez de compartir el espacio en partes iguales.
    <div style={{
      flex: 1, minWidth: 0, backgroundColor: colors.surface, border: `1px solid ${colors.border}`,
      boxShadow: shadows.card, borderRadius: 14, padding: '14px 12px',
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
        display: 'block', fontSize: 28, fontWeight: 700, color: colors.textStrong,
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
  const router = useRouter();
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

  useEffect(() => {
    if (profesionales.length === 0) fetchProfesionales();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const activeProfesionales = profesionales.filter(p => p.activo);
  const mostrarSelectorProfesional = activeProfesionales.length > 1;

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

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.background, paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ padding: '20px 20px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <BackButton />
        <h1 style={{ fontSize: 20, fontWeight: 700, color: colors.text, margin: 0 }}>{t('title')}</h1>
      </div>

      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Modo: mes calendario vs. rango de fechas elegido a mano — para
            consultas puntuales tipo "cuánto gané del 8 al 14 de junio". Es
            el único control manual que queda: la agrupación del gráfico de
            ganancias (día/semana/mes) ya no se elige acá, se infiere sola
            del ancho del rango (ver `granularidadGanancias` más arriba en
            el componente). */}
        <div style={{
          display: 'flex', backgroundColor: colors.surfaceSubtle, borderRadius: 8, padding: 2, alignSelf: 'flex-start',
        }}>
          {(['mes', 'personalizado'] as const).map(m => (
            <button
              key={m}
              onClick={() => setModoRango(m)}
              style={{
                border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600,
                cursor: 'pointer',
                backgroundColor: modoRango === m ? colors.surface : 'transparent',
                color: modoRango === m ? colors.text : colors.subtext,
                boxShadow: modoRango === m ? shadows.card : 'none',
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
            boxShadow: shadows.card, borderRadius: 14, padding: '10px 14px',
          }}>
            <button
              onClick={() => cambiarMes(-1)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, display: 'flex' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.textStrong} strokeWidth="2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <span style={{ fontSize: 15, fontWeight: 600, color: colors.text }}>
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
            boxShadow: shadows.card, borderRadius: 14, padding: '12px 14px',
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
                  flex: 1, border: `1px solid ${colors.border}`, borderRadius: 8, padding: '8px 10px',
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
                  flex: 1, border: `1px solid ${colors.border}`, borderRadius: 8, padding: '8px 10px',
                  fontSize: 14, color: colors.text, backgroundColor: colors.surface,
                }}
              />
            </div>
            {rangoInvalido && (
              <p style={{ fontSize: 12, color: colors.danger, margin: 0 }}>{t('rangeInvalid')}</p>
            )}
          </div>
        )}

        {/* Selector de profesional — invisible con ≤1 profesional activa. Con
            superficie propia (igual que el de Agenda) y un chip "Todas"
            explícito, para que quede claro qué se está mirando apenas
            entrás — sin esto, sin selección no había ningún chip resaltado. */}
        {mostrarSelectorProfesional && (
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 8,
            backgroundColor: colors.surface, border: `1px solid ${colors.border}`,
            boxShadow: shadows.card, borderRadius: 14, padding: '10px 14px',
          }}>
            <button
              onClick={() => setProfesionalFiltro(null)}
              style={{
                borderRadius: 20, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                border: `1px solid ${profesionalFiltro === null ? colors.primary : colors.divider}`,
                backgroundColor: profesionalFiltro === null ? colors.primary : colors.surface,
                color: profesionalFiltro === null ? '#FFF' : colors.text,
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
                    borderRadius: 20, padding: '8px 16px', fontSize: 13, cursor: 'pointer',
                    border: `1px solid ${selected ? color : colors.divider}`,
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
              <span style={{ fontSize: 48, fontWeight: 700, color: colors.textStrong, lineHeight: 1 }}>
                {stats?.total_turnos ?? 0}
              </span>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: colors.subtext }}>{t('period')}</p>
            </div>

            {/* Turnos por estado */}
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: colors.textStrong, margin: '0 0 10px' }}>
                {t('appointmentsByStatus')}
              </h2>
              {totalConCancelados === 0 ? (
                <p style={{ fontSize: 13, color: colors.subtext, margin: 0 }}>
                  {t('noAppointmentsThisPeriod')}
                </p>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <StatTile label={t('completed')} value={completados} color={colors.success} />
                    <StatTile label={t('confirmed')} value={confirmados} color={colors.muted} />
                    <StatTile label={t('cancelled')} value={cancelados} color={colors.danger} />
                  </div>
                  {tasaCancelacion !== null && (
                    <p style={{ margin: '8px 0 0', fontSize: 12, color: colors.subtext }}>
                      {t('cancellationRate', { pct: tasaCancelacion })}
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Ganancias */}
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: colors.textStrong, margin: '0 0 10px' }}>
                {t('earnings')}
              </h2>
              {/* Ganancia neta es el número que importa (ganancias por sí
                  solas no dicen si el período fue rentable) — extiende el
                  mismo tratamiento tipográfico del hero figure de arriba
                  (grande, bold, centrado), un escalón más chico para no
                  competir con el hero real de la pantalla (total_turnos). */}
              <div style={{ textAlign: 'center', padding: '4px 0 14px' }}>
                <span style={{
                  fontSize: 36, fontWeight: 700, lineHeight: 1, wordBreak: 'break-word',
                  color: gananciaNeta >= 0 ? colors.success : colors.danger,
                }}>
                  {gananciaNeta < 0 ? `-$${formatMonto(-gananciaNeta)}` : `$${formatMonto(gananciaNeta)}`}
                </span>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: colors.subtext }}>{t('netProfit')}</p>
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
                    boxShadow: shadows.card, borderRadius: 14, padding: '16px', display: 'flex',
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
                      padding: '12px 16px', borderRadius: 14, backgroundColor: colors.dangerBg,
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

            {/* Clientes nuevas vs. recurrentes */}
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: colors.textStrong, margin: '0 0 10px' }}>
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
              <h2 style={{ fontSize: 14, fontWeight: 700, color: colors.textStrong, margin: '0 0 10px' }}>
                {t('topServices')}
              </h2>
              {servicios.length === 0 ? (
                <p style={{ fontSize: 13, color: colors.subtext, margin: 0 }}>
                  {t('noServicesThisPeriod')}
                </p>
              ) : (
                <div style={{
                  backgroundColor: colors.surface, border: `1px solid ${colors.border}`,
                  boxShadow: shadows.card, borderRadius: 14, padding: '16px', display: 'flex',
                  flexDirection: 'column', gap: 14,
                }}>
                  {servicios.map(s => (
                    <BarraRanking key={s.servicio_id} nombre={s.nombre} cantidad={s.cantidad} maxCantidad={maxCantidad} />
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
