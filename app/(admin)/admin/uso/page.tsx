'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { isAxiosError } from 'axios';
import { ArrowLeft, Activity, ChevronRight, CalendarCheck2, MessageCircle, TriangleAlert } from 'lucide-react';
import { adminService, UsoNegocioResumen } from '@/services/adminService';
import { colors, shadows, withAlpha } from '@/theme/colors';

const pad = (n: number) => String(n).padStart(2, '0');
const toISODate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

type RangoPreset = '7d' | '30d' | 'mes';

// Umbral simple para la señal de "baja actividad" en la lista — un negocio
// que en el rango elegido casi no generó turnos ni mensajes es candidato a
// estar dejando de usar la app. No es una regla de negocio formal, solo una
// pista visual para el admin.
const UMBRAL_BAJA_ACTIVIDAD = 5;

function calcularRango(preset: RangoPreset): { desde: string; hasta: string } {
  const hoy = new Date();
  if (preset === 'mes') {
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    return { desde: toISODate(inicioMes), hasta: toISODate(hoy) };
  }
  const dias = preset === '7d' ? 6 : 29;
  const desde = new Date(hoy);
  desde.setDate(hoy.getDate() - dias);
  return { desde: toISODate(desde), hasta: toISODate(hoy) };
}

function extraerMensajeError(e: unknown, fallback: string): string {
  if (isAxiosError(e)) {
    return e.response?.data?.error ?? e.response?.data?.message ?? fallback;
  }
  return fallback;
}

export default function UsoPage() {
  const [preset, setPreset] = useState<RangoPreset>('30d');
  const [negocios, setNegocios] = useState<UsoNegocioResumen[] | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const rango = useMemo(() => calcularRango(preset), [preset]);

  const cargar = async () => {
    setCargando(true);
    setError(null);
    try {
      const data = await adminService.obtenerUsoResumen(rango.desde, rango.hasta);
      setNegocios(data.negocios);
    } catch (e: unknown) {
      setNegocios(null);
      setError(extraerMensajeError(e, 'No se pudo cargar el uso por negocio.'));
    } finally {
      setCargando(false);
    }
  };

  // Mismo patrón que SuscripcionesPage: fetch inicial al montar/cambiar de
  // rango, no durante el render.
  // cargar se redefine cada render (cierra sobre rango) — sumarla a las deps
  // dispararía el efecto en loop. set-state-in-effect: ídem SuscripcionesPage,
  // un fetch async disparado al montar/cambiar de rango no tiene alternativa
  // válida durante el render.
  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    cargar();
  }, [rango.desde, rango.hasta]);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  const maxVal = useMemo(() => {
    if (!negocios || negocios.length === 0) return 1;
    return Math.max(1, ...negocios.flatMap((n) => [n.turnos, n.confirmaciones, n.recordatorios]));
  }, [negocios]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 24px', backgroundColor: colors.background }}>
      <div style={{ width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column' }}>
        <Link
          href="/"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: colors.subtext, textDecoration: 'none', marginBottom: 20 }}
        >
          <ArrowLeft size={16} />
          Volver al panel
        </Link>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 18 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: colors.textStrong, margin: 0 }}>Uso de la app</h1>
          <p style={{ fontSize: 14, color: colors.subtext, margin: 0 }}>
            Turnos agendados y mensajes automáticos por negocio — para detectar quién la usa de verdad y quién dejó de hacerlo.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          {([
            ['7d', 'Últimos 7 días'],
            ['30d', 'Últimos 30 días'],
            ['mes', 'Este mes'],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setPreset(value)}
              style={{
                padding: '7px 12px',
                borderRadius: 999,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
                border: preset === value ? 'none' : `1px solid ${colors.border}`,
                backgroundColor: preset === value ? colors.primarySolid : 'transparent',
                color: preset === value ? '#fff' : colors.subtext,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {cargando && <p style={{ fontSize: 14, color: colors.subtext, textAlign: 'center', padding: '16px 0' }}>Cargando...</p>}

        {!cargando && error && (
          <div style={{ marginBottom: 20, padding: '12px 16px', borderRadius: 12, backgroundColor: colors.dangerBg, borderLeft: `4px solid ${colors.dangerBorder}`, display: 'flex', flexDirection: 'column', gap: 10 }} role="alert">
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

        {!cargando && !error && negocios !== null && negocios.length === 0 && (
          <p style={{ fontSize: 14, color: colors.subtext, textAlign: 'center', padding: '16px 0' }}>Sin actividad en este período.</p>
        )}

        {!cargando && !error && negocios !== null && negocios.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {negocios.map((n) => {
              const bajo = n.turnos + n.confirmaciones + n.recordatorios < UMBRAL_BAJA_ACTIVIDAD;
              return (
                <Link
                  key={n.user_id}
                  href={`/uso/${n.user_id}?desde=${rango.desde}&hasta=${rango.hasta}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '14px 16px',
                    borderRadius: 14,
                    backgroundColor: colors.surface,
                    border: `1px solid ${colors.border}`,
                    boxShadow: shadows.card,
                    textDecoration: 'none',
                  }}
                >
                  <Activity size={18} color={withAlpha(colors.primary, 'aa')} style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: colors.textStrong, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {n.nombre ?? `Negocio #${n.user_id}`}
                      </p>
                      {bajo && (
                        <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, color: colors.amber, backgroundColor: colors.amberBg, padding: '2px 7px', borderRadius: 999 }}>
                          Baja actividad
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: colors.subtext }}>
                        <CalendarCheck2 size={12} /> {n.turnos} turnos
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: colors.subtext }}>
                        <MessageCircle size={12} /> {n.confirmaciones + n.recordatorios} mensajes
                      </span>
                      {n.fallos > 0 && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: colors.danger }}>
                          <TriangleAlert size={12} /> {n.fallos} fallidos
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 6 }}>
                      <div style={{ height: 3, borderRadius: 2, backgroundColor: withAlpha(colors.chart1, '22') }}>
                        <div style={{ height: 3, borderRadius: 2, backgroundColor: colors.chart1, width: `${Math.max(4, Math.round((n.turnos / maxVal) * 100))}%` }} />
                      </div>
                      <div style={{ height: 3, borderRadius: 2, backgroundColor: withAlpha(colors.chart2, '22') }}>
                        <div style={{ height: 3, borderRadius: 2, backgroundColor: colors.chart2, width: `${Math.max(4, Math.round((n.confirmaciones / maxVal) * 100))}%` }} />
                      </div>
                    </div>
                  </div>
                  <ChevronRight size={16} color={colors.subtext} style={{ flexShrink: 0 }} />
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
