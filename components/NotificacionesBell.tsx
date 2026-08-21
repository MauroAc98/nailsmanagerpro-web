'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Bell, CalendarDays, ChevronRight, CheckCircle2, XCircle, Clock, Send } from 'lucide-react';
import { agendaColors as colors } from '@/theme/agendaColors';
import { useNotificacionesStore } from '@/store/useNotificacionesStore';
import type { NotificacionMensaje } from '@/services/turnoService';

const PANEL_WIDTH_MAX = 300;
const MARGEN_PANTALLA = 20;

// Solo se renderiza dentro de app/(app)/agenda/page.tsx (mismo criterio que
// RecordatoriosPendientesBanner) — no dispara su propio fetch, lee el store
// que ya alimenta app/(app)/layout.tsx (fetchea al montar y al volver a
// primer plano). El badge es `no_vistos` (persistido server-side vía
// notificaciones_vistas_at, ver marcarVistas) — abrir el panel lo baja a 0,
// un mensaje nuevo posterior vuelve a sumar.
export function NotificacionesBell() {
  const t = useTranslations('common.NotificacionesBell');
  const router = useRouter();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [abierto, setAbierto] = useState(false);
  // Offset horizontal del panel relativo a este wrapper (no al viewport) —
  // se recalcula cada vez que se abre, midiendo dónde está la campanita en
  // pantalla en ESE momento. Antes probamos anclar el panel directo con
  // right:0 al wrapper chico (se salía por la izquierda, la campanita no
  // está pegada al borde derecho) y después al header entero (quedaba
  // "lejos" del ícono, porque el header es más alto que el botón — el
  // título de dos líneas empuja el punto de anclaje hacia abajo). Medir la
  // posición real evita las dos fallas: vertical queda pegado al botón
  // (top:100% de ESTE wrapper, no del header) y horizontal nunca se sale.
  const [panelLeft, setPanelLeft] = useState(0);
  // El ancho también se recalcula al abrir — en un viewport angosto (visto
  // en la práctica: bastante más angosto que el ancho "de ventana", por lo
  // que sea que reporte el dispositivo/navegador) ni PANEL_WIDTH_MAX +
  // los dos márgenes entran; sin achicar el ancho el clamp de panelLeft
  // se rompe (el máximo permitido queda por debajo del mínimo).
  const [panelWidth, setPanelWidth] = useState(PANEL_WIDTH_MAX);

  const { data, loading, error, fetchNotificaciones, marcarVistas } = useNotificacionesStore();

  const mensajes = data?.mensajes ?? [];
  const turnosManana = data?.turnos_manana ?? 0;
  const badgeCount = data?.no_vistos ?? 0;

  const toggleAbierto = () => {
    if (!abierto && wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      const anchoDisponible = Math.max(window.innerWidth - MARGEN_PANTALLA * 2, 200);
      const ancho = Math.min(PANEL_WIDTH_MAX, anchoDisponible);
      const idealLeftEnPantalla = rect.right - ancho; // pegado al borde derecho de la campanita
      const maxLeftEnPantalla = window.innerWidth - ancho - MARGEN_PANTALLA;
      const leftEnPantalla = Math.min(Math.max(idealLeftEnPantalla, MARGEN_PANTALLA), maxLeftEnPantalla);
      setPanelWidth(ancho);
      setPanelLeft(leftEnPantalla - rect.left);
    }
    setAbierto(v => !v);
    marcarVistas();
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <button
        onClick={toggleAbierto}
        aria-label={t('title')}
        style={{
          position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 38, height: 38, borderRadius: 19,
          border: `1px solid ${colors.border}`, backgroundColor: colors.surface, cursor: 'pointer',
        }}
      >
        <Bell size={18} color={colors.text} strokeWidth={1.8} />
        {badgeCount > 0 && (
          <span style={{
            position: 'absolute', top: -2, right: -2, minWidth: 16, height: 16, borderRadius: 8,
            backgroundColor: colors.danger, color: '#fff', fontSize: 10, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px',
          }}>
            {badgeCount > 9 ? '9+' : badgeCount}
          </span>
        )}
      </button>

      {abierto && (
        <>
          {/* Backdrop invisible para cerrar al tocar afuera — mismo patrón
              que los dropdowns de selector de cliente en agenda/nuevo. */}
          <div
            onClick={() => setAbierto(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 40 }}
          />
          {/* Absolute (no fixed): scrollea junto con la página en vez de
              quedar pegado al viewport mientras la campanita se mueve —
              necesitábamos que siguiera al ícono, no al scroll. */}
          <div style={{
            position: 'absolute', top: '100%', marginTop: 8, left: panelLeft, width: panelWidth,
            maxHeight: '60vh', overflowY: 'auto',
            backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 16,
            boxShadow: '0 8px 24px rgba(0,0,0,0.18)', zIndex: 41,
          }}>
            <p style={{ margin: 0, padding: '14px 16px 10px', fontSize: 13, fontWeight: 700, color: colors.textStrong }}>
              {t('title')}
            </p>

            {turnosManana > 0 && (
              <button
                onClick={() => { setAbierto(false); router.push('/agenda/manana'); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 16px',
                  border: 'none', borderTop: `1px solid ${colors.hairline}`, borderBottom: `1px solid ${colors.hairline}`,
                  backgroundColor: 'transparent', cursor: 'pointer', textAlign: 'left',
                }}
              >
                <CalendarDays size={16} color={colors.primary} strokeWidth={2} style={{ flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 13, color: colors.text }}>
                  {t('turnosManana', { count: turnosManana })}
                </span>
                <ChevronRight size={14} color={colors.subtext} strokeWidth={2} style={{ flexShrink: 0 }} />
              </button>
            )}

            {loading && !data && (
              <p style={{ padding: 16, margin: 0, fontSize: 13, color: colors.subtext, textAlign: 'center' }}>
                {t('loading')}
              </p>
            )}

            {!loading && error && !data && (
              <div style={{ padding: 16, textAlign: 'center' }}>
                <p style={{ margin: '0 0 8px', fontSize: 13, color: colors.dangerBorder }}>{error}</p>
                <button
                  onClick={() => fetchNotificaciones()}
                  style={{
                    border: `1px solid ${colors.border}`, borderRadius: 10, padding: '6px 14px',
                    background: 'transparent', color: colors.text, fontSize: 12, cursor: 'pointer',
                  }}
                >
                  {t('retry')}
                </button>
              </div>
            )}

            {!loading && !error && mensajes.length === 0 && turnosManana === 0 && (
              <p style={{ padding: 16, margin: 0, fontSize: 13, color: colors.subtext, textAlign: 'center' }}>
                {t('empty')}
              </p>
            )}

            {mensajes.map(m => (
              <NotificacionRow key={m.id} mensaje={m} onClick={() => { setAbierto(false); router.push(`/agenda/notificaciones/${m.id}`); }} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function formatTiempoRelativo(iso: string, tHaceUnMomento: string, tMin: (n: number) => string, tHoras: (n: number) => string): string {
  const minutos = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutos < 1) return tHaceUnMomento;
  if (minutos < 60) return tMin(minutos);
  const horas = Math.floor(minutos / 60);
  return tHoras(horas);
}

function NotificacionRow({ mensaje, onClick }: { mensaje: NotificacionMensaje; onClick: () => void }) {
  const t = useTranslations('common.NotificacionesBell');
  const cliente = [mensaje.cliente_nombre, mensaje.cliente_apellido].filter(Boolean).join(' ') || t('clienteDesconocido');

  const esFallido = mensaje.status === 'failed';
  const Icono = esFallido ? XCircle : mensaje.status === 'manual' ? Send : CheckCircle2;
  const colorIcono = esFallido ? colors.danger : colors.success;

  const textoKey = esFallido
    ? (mensaje.tipo === 'confirmacion' ? 'confirmacionFallida' : 'recordatorioFallido')
    : (mensaje.tipo === 'confirmacion' ? 'confirmacionEnviada' : 'recordatorioEnviado');

  const tiempo = formatTiempoRelativo(
    mensaje.created_at,
    t('haceUnMomento'),
    n => t('haceMinutos', { count: n }),
    n => t('haceHoras', { count: n }),
  );

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10, width: '100%', padding: '12px 16px',
        border: 'none', borderBottom: `1px solid ${colors.hairline}`,
        backgroundColor: 'transparent', cursor: 'pointer', textAlign: 'left',
      }}
    >
      <Icono size={16} color={colorIcono} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, color: colors.text, lineHeight: 1.4 }}>
          {t(textoKey, { cliente })}
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 11, color: colors.subtext, display: 'flex', alignItems: 'center', gap: 4 }}>
          <Clock size={11} strokeWidth={2} />
          {tiempo}
        </p>
      </div>
      <ChevronRight size={14} color={colors.subtext} strokeWidth={2} style={{ flexShrink: 0, marginTop: 2 }} />
    </button>
  );
}
