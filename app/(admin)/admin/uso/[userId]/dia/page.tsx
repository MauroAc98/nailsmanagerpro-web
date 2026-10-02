'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { isAxiosError } from 'axios';
import { ArrowLeft } from 'lucide-react';
import { adminService, UsoDetalleNegocioPorDiaResponse } from '@/services/adminService';
import { colors, shadows, withAlpha } from '@/theme/colors';

function extraerMensajeError(e: unknown, fallback: string): string {
  if (isAxiosError(e)) {
    return e.response?.data?.error ?? e.response?.data?.message ?? fallback;
  }
  return fallback;
}

function formatFechaLarga(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function UsoDetalleNegocioPorDiaPage() {
  const params = useParams();
  const userId = Number(params.userId);
  const searchParams = useSearchParams();
  const fecha = searchParams.get('fecha') ?? '';

  const [data, setData] = useState<UsoDetalleNegocioPorDiaResponse | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = async () => {
    if (!fecha) {
      setError('Falta la fecha a mostrar.');
      setCargando(false);
      return;
    }
    setCargando(true);
    setError(null);
    try {
      const resultado = await adminService.obtenerUsoDetalleNegocioPorDia(userId, fecha);
      setData(resultado);
    } catch (e: unknown) {
      setData(null);
      setError(extraerMensajeError(e, 'No se pudo cargar el detalle por hora.'));
    } finally {
      setCargando(false);
    }
  };

  // cargar se redefine cada render (cierra sobre userId/fecha) — sumarla a
  // las deps dispararía el efecto en loop. Mismo criterio que UsoPage.
  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    cargar();
  }, [userId, fecha]);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  const totales = useMemo(() => {
    if (!data) return { turnos: 0, confirmaciones: 0, recordatorios: 0, fallos: 0 };
    return data.horas.reduce(
      (acc, h) => ({
        turnos: acc.turnos + h.turnos,
        confirmaciones: acc.confirmaciones + h.confirmaciones,
        recordatorios: acc.recordatorios + h.recordatorios,
        fallos: acc.fallos + h.fallos,
      }),
      { turnos: 0, confirmaciones: 0, recordatorios: 0, fallos: 0 }
    );
  }, [data]);

  const maxTotal = useMemo(() => {
    if (!data) return 1;
    return Math.max(1, ...data.horas.map((h) => h.turnos + h.confirmaciones + h.recordatorios));
  }, [data]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 24px', backgroundColor: colors.background }}>
      <div style={{ width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column' }}>
        <Link
          href={`/uso/${userId}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: colors.subtext, textDecoration: 'none', marginBottom: 20 }}
        >
          <ArrowLeft size={16} />
          Volver al detalle del negocio
        </Link>

        {cargando && <p style={{ fontSize: 14, color: colors.subtext, textAlign: 'center', padding: '16px 0' }}>Cargando...</p>}

        {!cargando && error && (
          <div style={{ padding: '12px 16px', borderRadius: 12, backgroundColor: colors.dangerBg, borderLeft: `4px solid ${colors.dangerBorder}`, display: 'flex', flexDirection: 'column', gap: 10 }} role="alert">
            <p style={{ fontSize: 13, fontWeight: 500, color: colors.danger, margin: 0 }}>{error}</p>
            {fecha && (
              <button
                type="button"
                onClick={cargar}
                style={{ alignSelf: 'flex-start', padding: '8px 14px', borderRadius: 10, border: `1px solid ${colors.dangerBorder}`, backgroundColor: 'transparent', color: colors.danger, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                Reintentar
              </button>
            )}
          </div>
        )}

        {!cargando && !error && data && (
          <>
            <div style={{ marginBottom: 18 }}>
              <h1 style={{ fontSize: 19, fontWeight: 700, color: colors.textStrong, margin: 0, textTransform: 'capitalize' }}>{formatFechaLarga(data.fecha)}</h1>
              <p style={{ margin: '2px 0 0', fontSize: 12.5, color: colors.subtext }}>Detalle por hora</p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, backgroundColor: withAlpha(colors.chart1, '18'), borderRadius: 999, padding: '5px 11px' }}>
                <span style={{ width: 7, height: 7, borderRadius: 2, backgroundColor: colors.chart1 }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: colors.textStrong }}>{totales.turnos} turnos</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, backgroundColor: withAlpha(colors.chart2, '18'), borderRadius: 999, padding: '5px 11px' }}>
                <span style={{ width: 7, height: 7, borderRadius: 2, backgroundColor: colors.chart2 }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: colors.textStrong }}>{totales.confirmaciones} confirmaciones</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, backgroundColor: 'rgba(139,92,246,0.14)', borderRadius: 999, padding: '5px 11px' }}>
                <span style={{ width: 7, height: 7, borderRadius: 2, backgroundColor: '#8b5cf6' }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: colors.textStrong }}>{totales.recordatorios} recordatorios</span>
              </span>
              {totales.fallos > 0 && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, backgroundColor: colors.dangerBg, border: `1px solid ${colors.dangerBorder}`, borderRadius: 999, padding: '5px 11px' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: colors.danger }}>{totales.fallos} fallidos</span>
                </span>
              )}
            </div>

            <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 14, boxShadow: shadows.card, padding: '16px 14px' }}>
              <p style={{ margin: '0 0 12px', fontSize: 12.5, fontWeight: 700, color: colors.textStrong }}>Actividad por hora</p>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 110 }}>
                {data.horas.map((h) => {
                  const total = h.turnos + h.confirmaciones + h.recordatorios;
                  const altoTotal = total > 0 ? Math.max(3, Math.round((total / maxTotal) * 100)) : 0;
                  const altoTurnos = total > 0 ? Math.round((h.turnos / total) * altoTotal) : 0;
                  const altoConfirmaciones = total > 0 ? Math.round((h.confirmaciones / total) * altoTotal) : 0;
                  const altoRecordatorios = altoTotal - altoTurnos - altoConfirmaciones;
                  return (
                    <div
                      key={h.hora}
                      title={`${String(h.hora).padStart(2, '0')}h: ${h.turnos} turnos, ${h.confirmaciones + h.recordatorios} mensajes${h.fallos > 0 ? `, ${h.fallos} fallidos` : ''}`}
                      style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', minWidth: 0 }}
                    >
                      {h.fallos > 0 && <span style={{ width: 4, height: 4, borderRadius: '50%', backgroundColor: colors.danger, marginBottom: 2, flexShrink: 0 }} />}
                      <div style={{ width: '100%', maxWidth: 12, display: 'flex', flexDirection: 'column-reverse', borderRadius: 2, overflow: 'hidden', height: altoTotal }}>
                        <div style={{ width: '100%', backgroundColor: colors.chart1, height: altoTurnos }} />
                        <div style={{ width: '100%', backgroundColor: colors.chart2, height: altoConfirmaciones }} />
                        <div style={{ width: '100%', backgroundColor: '#8b5cf6', height: altoRecordatorios }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: 3, marginTop: 4 }}>
                {data.horas.map((h) => (
                  <div key={h.hora} style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
                    {h.hora % 3 === 0 && <span style={{ fontSize: 9, color: colors.subtext }}>{String(h.hora).padStart(2, '0')}</span>}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
