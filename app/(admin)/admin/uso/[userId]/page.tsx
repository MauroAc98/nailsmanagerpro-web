'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { isAxiosError } from 'axios';
import { ArrowLeft, CalendarCheck2, MessageCircle, Bell, TriangleAlert } from 'lucide-react';
import { adminService, UsoDetalleNegocioResponse } from '@/services/adminService';
import { colors, shadows, withAlpha } from '@/theme/colors';

function extraerMensajeError(e: unknown, fallback: string): string {
  if (isAxiosError(e)) {
    return e.response?.data?.error ?? e.response?.data?.message ?? fallback;
  }
  return fallback;
}

function formatFechaCorta(iso: string): string {
  // iso es 'YYYY-MM-DD' — construir el Date con los componentes evita el
  // corrimiento de un día que da `new Date('YYYY-MM-DD')` al interpretarlo
  // como medianoche UTC y mostrarlo en un huso horario más atrasado.
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
}

const statCard = (valor: number, label: string, color: string, bg: string, Icon: typeof CalendarCheck2) => (
  <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 14, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
    <div style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icon size={16} color={color} />
    </div>
    <div style={{ minWidth: 0 }}>
      <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: colors.textStrong }}>{valor}</p>
      <p style={{ margin: 0, fontSize: 11, color: colors.subtext }}>{label}</p>
    </div>
  </div>
);

export default function UsoDetalleNegocioPage() {
  const params = useParams();
  const userId = Number(params.userId);
  const searchParams = useSearchParams();
  const desde = searchParams.get('desde') ?? undefined;
  const hasta = searchParams.get('hasta') ?? undefined;

  const [data, setData] = useState<UsoDetalleNegocioResponse | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = async () => {
    setCargando(true);
    setError(null);
    try {
      const resultado = await adminService.obtenerUsoDetalleNegocio(userId, desde, hasta);
      setData(resultado);
    } catch (e: unknown) {
      setData(null);
      setError(extraerMensajeError(e, 'No se pudo cargar el detalle de uso.'));
    } finally {
      setCargando(false);
    }
  };

  // cargar se redefine cada render (cierra sobre userId/desde/hasta) — sumarla
  // a las deps dispararía el efecto en loop. Mismo criterio que UsoPage.
  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    cargar();
  }, [userId, desde, hasta]);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  const maxTotal = useMemo(() => {
    if (!data) return 1;
    return Math.max(1, ...data.dias.map((d) => d.turnos + d.confirmaciones + d.recordatorios));
  }, [data]);

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (desde) p.set('desde', desde);
    if (hasta) p.set('hasta', hasta);
    return p.toString();
  }, [desde, hasta]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 24px', backgroundColor: colors.background }}>
      <div style={{ width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column' }}>
        <Link
          href={qs ? `/uso?${qs}` : '/uso'}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: colors.subtext, textDecoration: 'none', marginBottom: 20 }}
        >
          <ArrowLeft size={16} />
          Volver a todos los negocios
        </Link>

        {cargando && <p style={{ fontSize: 14, color: colors.subtext, textAlign: 'center', padding: '16px 0' }}>Cargando...</p>}

        {!cargando && error && (
          <div style={{ padding: '12px 16px', borderRadius: 12, backgroundColor: colors.dangerBg, borderLeft: `4px solid ${colors.dangerBorder}`, display: 'flex', flexDirection: 'column', gap: 10 }} role="alert">
            <p style={{ fontSize: 13, fontWeight: 500, color: colors.danger, margin: 0 }}>{error}</p>
            <button
              type="button"
              onClick={cargar}
              style={{ alignSelf: 'flex-start', padding: '8px 14px', borderRadius: 10, border: `1px solid ${colors.dangerBorder}`, backgroundColor: 'transparent', color: colors.danger, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              Reintentar
            </button>
          </div>
        )}

        {!cargando && !error && data && (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: colors.textStrong, margin: 0 }}>{data.nombre ?? `Negocio #${data.user_id}`}</h1>
              <span style={{ fontSize: 12.5, color: colors.subtext }}>{formatFechaCorta(data.desde)} — {formatFechaCorta(data.hasta)}</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
              {statCard(data.totales.turnos, 'Turnos agendados', colors.chart1, withAlpha(colors.chart1, '22'), CalendarCheck2)}
              {statCard(data.totales.confirmaciones, 'Confirmaciones', colors.chart2, withAlpha(colors.chart2, '22'), MessageCircle)}
              {statCard(data.totales.recordatorios, 'Recordatorios', '#8b5cf6', 'rgba(139,92,246,0.14)', Bell)}
              {statCard(data.totales.fallos, 'Mensajes fallidos', colors.danger, colors.dangerBg, TriangleAlert)}
            </div>

            <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 14, boxShadow: shadows.card, padding: '16px 14px', marginBottom: 18 }}>
              <p style={{ margin: '0 0 12px', fontSize: 12.5, fontWeight: 700, color: colors.textStrong }}>Actividad por día</p>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 110 }}>
                {data.dias.map((d) => {
                  const total = d.turnos + d.confirmaciones + d.recordatorios;
                  const altoTotal = Math.max(3, Math.round((total / maxTotal) * 100));
                  const altoTurnos = total > 0 ? Math.round((d.turnos / total) * altoTotal) : 0;
                  const altoConfirmaciones = total > 0 ? Math.round((d.confirmaciones / total) * altoTotal) : 0;
                  const altoRecordatorios = altoTotal - altoTurnos - altoConfirmaciones;
                  return (
                    <Link
                      key={d.fecha}
                      href={`/uso/${userId}/dia?fecha=${d.fecha}`}
                      title={`${formatFechaCorta(d.fecha)}: ${d.turnos} turnos, ${d.confirmaciones + d.recordatorios} mensajes${d.fallos > 0 ? `, ${d.fallos} fallidos` : ''}`}
                      style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', minWidth: 0 }}
                    >
                      {d.fallos > 0 && <span style={{ width: 4, height: 4, borderRadius: '50%', backgroundColor: colors.danger, marginBottom: 2, flexShrink: 0 }} />}
                      <div style={{ width: '100%', maxWidth: 10, display: 'flex', flexDirection: 'column-reverse', borderRadius: 2, overflow: 'hidden', height: altoTotal }}>
                        <div style={{ width: '100%', backgroundColor: colors.chart1, height: altoTurnos }} />
                        <div style={{ width: '100%', backgroundColor: colors.chart2, height: altoConfirmaciones }} />
                        <div style={{ width: '100%', backgroundColor: '#8b5cf6', height: altoRecordatorios }} />
                      </div>
                    </Link>
                  );
                })}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: colors.subtext }}>
                  <span style={{ width: 7, height: 7, borderRadius: 2, backgroundColor: colors.chart1 }} /> Turnos
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: colors.subtext }}>
                  <span style={{ width: 7, height: 7, borderRadius: 2, backgroundColor: colors.chart2 }} /> Confirmaciones
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: colors.subtext }}>
                  <span style={{ width: 7, height: 7, borderRadius: 2, backgroundColor: '#8b5cf6' }} /> Recordatorios
                </span>
              </div>
              <p style={{ margin: '8px 0 0', fontSize: 11, color: colors.subtext }}>Tocá un día para ver el detalle por hora.</p>
            </div>

            {data.fallos_recientes.length > 0 && (
              <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 14, boxShadow: shadows.card, overflow: 'hidden' }}>
                <div style={{ padding: '14px 14px 10px' }}>
                  <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: colors.textStrong }}>Mensajes fallidos recientes</p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: colors.subtext }}>El motivo exacto lo informa Meta al momento del fallo.</p>
                </div>
                {data.fallos_recientes.map((f, i) => (
                  <div key={i} style={{ padding: '12px 14px', borderTop: `1px solid ${colors.divider}`, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, color: colors.subtext }}>{formatFechaCorta(f.fecha)}</span>
                      <span
                        style={{
                          fontSize: 10.5, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
                          color: f.tipo === 'confirmacion' ? '#b5541d' : '#5b3fa3',
                          backgroundColor: f.tipo === 'confirmacion' ? withAlpha(colors.chart2, '22') : 'rgba(139,92,246,0.14)',
                        }}
                      >
                        {f.tipo === 'confirmacion' ? 'Confirmación' : 'Recordatorio'}
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 600, color: f.origen === 'meta' ? colors.subtext : colors.danger }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: f.origen === 'meta' ? colors.subtext : colors.danger }} />
                        {f.origen === 'meta' ? 'Meta' : 'Nuestro lado'}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: colors.textStrong }}>
                      {f.motivo}
                      {f.codigo !== null && <span style={{ fontSize: 11, color: colors.subtext }}> · código {f.codigo}</span>}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
