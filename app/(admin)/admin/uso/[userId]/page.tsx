'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { isAxiosError } from 'axios';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from 'recharts';
import { agendaColors as colors, agendaShadows as shadows, agendaFontSerif } from '@/theme/agendaColors';
import { adminService, UsoDetalleNegocioResponse, UsoDia } from '@/services/adminService';
import { FiltroPills } from '@/components/FiltroPills';
import { Spinner } from '@/components/Spinner';
import { TooltipCard } from '@/components/estadisticas/TooltipCard';
import { diasDesde, formatFechaHora, formatUltimoTurno } from '@/lib/usoFechas';

const pad = (n: number) => String(n).padStart(2, '0');
const toISODate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

type Preset = '7d' | '30d' | 'mes' | 'otro';

function calcularRango(preset: Exclude<Preset, 'otro'>): { desde: string; hasta: string } {
  const hoy = new Date();
  if (preset === 'mes') {
    return { desde: toISODate(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), hasta: toISODate(hoy) };
  }
  const desde = new Date(hoy);
  desde.setDate(hoy.getDate() - (preset === '7d' ? 6 : 29));
  return { desde: toISODate(desde), hasta: toISODate(hoy) };
}

// Si el enlace trae desde/hasta que coinciden con un preset, lo marca; si no,
// es un rango propio.
function presetInicial(desde?: string, hasta?: string): Preset {
  if (!desde || !hasta) return '30d';
  for (const p of ['7d', '30d', 'mes'] as const) {
    const r = calcularRango(p);
    if (r.desde === desde && r.hasta === hasta) return p;
  }
  return 'otro';
}

function extraerMensajeError(e: unknown, fallback: string): string {
  if (isAxiosError(e)) {
    return e.response?.data?.error ?? e.response?.data?.message ?? fallback;
  }
  return fallback;
}

// 'YYYY-MM-DD' -> '10 sep' sin pasar por Date (evita el corrimiento de huso).
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function formatFechaCorta(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${MESES[m - 1]}`;
}

const card: React.CSSProperties = {
  backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 14, boxShadow: shadows.card, boxSizing: 'border-box',
};

const inputFecha: React.CSSProperties = {
  flex: 1, minWidth: 0, height: 40, boxSizing: 'border-box', padding: '0 10px', borderRadius: 10, fontSize: 14,
  border: `1px solid ${colors.border}`, backgroundColor: colors.surface, color: colors.text,
};

function Stat({ valor, label }: { valor: number; label: string }) {
  return (
    <div style={{ ...card, padding: '14px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 0 }}>
      <span style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.1, color: colors.textStrong, whiteSpace: 'nowrap' }}>{valor}</span>
      <span style={{ fontSize: 12, color: colors.subtext, textAlign: 'center' }}>{label}</span>
    </div>
  );
}

export default function UsoDetalleNegocioPage() {
  const params = useParams();
  const router = useRouter();
  const userId = Number(params.userId);
  const searchParams = useSearchParams();
  const desdeParam = searchParams.get('desde') ?? undefined;
  const hastaParam = searchParams.get('hasta') ?? undefined;

  const [preset, setPreset] = useState<Preset>(() => presetInicial(desdeParam, hastaParam));
  const [rango, setRango] = useState<{ desde: string; hasta: string }>(() => {
    const p = presetInicial(desdeParam, hastaParam);
    return p === 'otro' && desdeParam && hastaParam ? { desde: desdeParam, hasta: hastaParam } : calcularRango(p === 'otro' ? '30d' : p);
  });

  const [data, setData] = useState<UsoDetalleNegocioResponse | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      setData(await adminService.obtenerUsoDetalleNegocio(userId, rango.desde, rango.hasta));
    } catch (e: unknown) {
      setData(null);
      setError(extraerMensajeError(e, 'No se pudo cargar el detalle de uso.'));
    } finally {
      setCargando(false);
    }
  }, [userId, rango.desde, rango.hasta]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { cargar(); }, [cargar]);

  const elegirPreset = (p: Preset) => {
    setPreset(p);
    if (p !== 'otro') setRango(calcularRango(p));
  };

  const cambiarFecha = (campo: 'desde' | 'hasta', valor: string) => {
    const nuevo = { ...rango, [campo]: valor };
    if (nuevo.desde && nuevo.hasta && nuevo.desde <= nuevo.hasta) setRango(nuevo);
    else setRango(r => ({ ...r, [campo]: valor }));
  };

  const dias = data ? diasDesde(data.ultimo_turno_epoch) : null;
  const ultimoTurno = !data || data.ultimo_turno_epoch === null
    ? 'Nunca agendó un turno'
    : `Último turno: ${formatUltimoTurno(data.ultimo_turno_epoch)} · ${dias === 0 ? 'hoy' : `hace ${dias} ${dias === 1 ? 'día' : 'días'}`}`;

  const tooltip = (props: TooltipContentProps) => {
    if (!props.active || !props.payload?.length) return null;
    const d = props.payload[0].payload as UsoDia;
    return <TooltipCard title={formatFechaCorta(d.fecha)} rows={[{ label: 'Turnos', value: String(d.turnos), color: colors.primary }]} />;
  };

  const fallos = useMemo(() => data?.fallos_recientes ?? [], [data]);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.background, color: colors.text }}>
      <div style={{ maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', paddingBottom: 32 }}>
        <div style={{ padding: '12px 20px 0' }}>
          <Link
            href="/uso"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minHeight: 44, fontSize: 14, color: colors.subtext, textDecoration: 'none' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.subtext} strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
            Uso de la app
          </Link>
        </div>

        {cargando && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
            <Spinner size={32} label="Cargando detalle" />
          </div>
        )}

        {!cargando && error && (
          <div style={{ margin: '12px 20px 0', padding: '12px 16px', borderRadius: 12, backgroundColor: colors.dangerBg, borderLeft: `4px solid ${colors.dangerBorder}`, display: 'flex', flexDirection: 'column', gap: 10 }} role="alert">
            <p style={{ fontSize: 13, fontWeight: 500, color: colors.danger, margin: 0 }}>{error}</p>
            <button
              type="button"
              onClick={cargar}
              style={{ alignSelf: 'flex-start', padding: '8px 14px', minHeight: 36, borderRadius: 10, border: `1px solid ${colors.dangerBorder}`, backgroundColor: 'transparent', color: colors.danger, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              Reintentar
            </button>
          </div>
        )}

        {!cargando && !error && data && (
          <>
            <div style={{ padding: '4px 20px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <h1 style={{ fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 26, lineHeight: 1.15, color: colors.textStrong, margin: 0, overflowWrap: 'anywhere' }}>
                {data.nombre ?? `Negocio #${data.user_id}`}
              </h1>
              <span style={{ fontSize: 14, color: colors.subtext }}>{ultimoTurno}</span>
            </div>

            <div style={{ padding: '0 20px 12px', overflowX: 'auto' }}>
              <FiltroPills
                ariaLabel="Período"
                options={[
                  { value: '7d', label: '7 días' },
                  { value: '30d', label: '30 días' },
                  { value: 'mes', label: 'Este mes' },
                  { value: 'otro', label: 'Otro rango' },
                ]}
                value={preset}
                onChange={elegirPreset}
              />
            </div>

            {preset === 'otro' && (
              <div style={{ padding: '0 20px 12px', display: 'flex', gap: 8 }}>
                <input type="date" aria-label="Desde" value={rango.desde} max={rango.hasta || undefined} onChange={e => cambiarFecha('desde', e.target.value)} style={inputFecha} />
                <input type="date" aria-label="Hasta" value={rango.hasta} min={rango.desde || undefined} onChange={e => cambiarFecha('hasta', e.target.value)} style={inputFecha} />
              </div>
            )}

            <div style={{ padding: '4px 20px 16px', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
              <Stat valor={data.totales.turnos} label="Turnos" />
              <Stat valor={data.totales.confirmaciones} label="Confirmaciones" />
              <Stat valor={data.totales.recordatorios} label="Recordatorios" />
            </div>

            <div style={{ padding: '0 20px 16px' }}>
              <div style={{ ...card, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: colors.text }}>Turnos agendados por día</p>
                <div style={{ height: 90, width: '100%', touchAction: 'pan-y' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.dias} title="Turnos agendados por día" margin={{ top: 4, right: 0, left: 0, bottom: 0 }} barCategoryGap="12%">
                      <XAxis dataKey="fecha" hide />
                      <YAxis hide allowDecimals={false} />
                      <Tooltip content={tooltip} cursor={{ fill: colors.surfaceSubtle }} />
                      <Bar
                        dataKey="turnos"
                        fill={colors.primary}
                        radius={[2, 2, 0, 0]}
                        minPointSize={2}
                        isAnimationActive="auto"
                        onClick={(_: unknown, i: number) => router.push(`/uso/${userId}/dia?fecha=${data.dias[i].fecha}`)}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: colors.muted }}>
                  <span>{formatFechaCorta(data.desde)}</span>
                  <span>{formatFechaCorta(data.hasta)}</span>
                </div>
                <p style={{ margin: 0, fontSize: 11, color: colors.muted }}>Tocá una barra para ver el detalle por hora.</p>
              </div>
            </div>

            <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ margin: '0 0 0 4px', fontSize: 13, color: colors.subtext }}>
                {data.totales.fallos === 0
                  ? 'Sin mensajes fallidos'
                  : `${data.totales.fallos} ${data.totales.fallos === 1 ? 'mensaje fallido' : 'mensajes fallidos'}`}
              </p>
              {fallos.map((f, i) => {
                const { fecha, hora } = formatFechaHora(f.epoch);
                return (
                  <div key={i} style={{ ...card, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                      <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: colors.text, minWidth: 0 }}>{fecha}</p>
                      <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999, backgroundColor: colors.surfaceSubtle, color: colors.text }}>
                        {f.tipo === 'confirmacion' ? 'Confirmación' : 'Recordatorio'}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: colors.subtext }}>{hora} hs</p>
                    <p style={{ margin: '2px 0 0', fontSize: 13, color: colors.text, lineHeight: 1.4, overflowWrap: 'anywhere' }}>{f.motivo}</p>
                    <p style={{ margin: 0, fontSize: 11, color: colors.muted }}>
                      {f.origen === 'meta' ? 'Origen: Meta' : 'Origen: nuestro lado'}
                      {f.codigo !== null && ` · código ${f.codigo}`}
                    </p>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
