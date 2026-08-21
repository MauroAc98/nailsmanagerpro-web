'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CheckCircle2, XCircle, Send } from 'lucide-react';
import BackButton from '@/components/BackButton';
import { agendaColors as colors, agendaFontSerif } from '@/theme/agendaColors';
import { useNotificacionesStore } from '@/store/useNotificacionesStore';
import { WhatsappGlyph } from '@/components/icons/WhatsappGlyph';

// Renderiza *texto* en negrita, igual que WhatsApp interpreta los
// asteriscos — mismo helper que components/perfil/SheetNegocio.tsx
// (preview de "Mi negocio"), duplicado a propósito: es una función chica y
// pura, no vale la pena una dependencia compartida por esto solo.
function renderConNegritas(texto: string) {
  return (texto ?? '').split(/(\*[^*]+\*)/g).map((parte, i) =>
    parte.startsWith('*') && parte.endsWith('*')
      ? <strong key={i}>{parte.slice(1, -1)}</strong>
      : <span key={i}>{parte}</span>
  );
}

export default function DetalleNotificacionPage() {
  const t = useTranslations('agenda.DetalleNotificacionPage');
  const router = useRouter();
  const params = useParams();
  const id = Number(Array.isArray(params?.id) ? params.id[0] : params?.id ?? '0');

  const { data, loading, fetchNotificaciones } = useNotificacionesStore();
  const mensaje = data?.mensajes.find(m => m.id === id);

  useEffect(() => {
    // El detalle solo tiene sentido con datos de HOY (el backend no guarda
    // días anteriores en este endpoint) — si no está en el store (entrada
    // directa, refresh, o el store nunca se cargó en esta sesión) se pide
    // una vez; si sigue sin aparecer después, es que no es de hoy.
    if (!data) fetchNotificaciones();
  }, [data, fetchNotificaciones]);

  const cliente = mensaje
    ? [mensaje.cliente_nombre, mensaje.cliente_apellido].filter(Boolean).join(' ') || t('clienteDesconocido')
    : '';

  const esFallido = mensaje?.status === 'failed';
  const Icono = esFallido ? XCircle : mensaje?.status === 'manual' ? Send : CheckCircle2;
  const colorEstado = esFallido ? colors.danger : colors.success;
  const textoEstado = esFallido
    ? t('estadoFallido')
    : mensaje?.status === 'manual'
      ? t('estadoManual')
      : t('estadoEnviado');

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.background, paddingBottom: 48 }}>
      <div style={{ padding: '20px 20px 4px' }}>
        <BackButton />
      </div>

      <div style={{ padding: '4px 20px 18px' }}>
        <p style={{
          fontSize: 11, fontWeight: 700, color: colors.primaryDeep, letterSpacing: 1.5,
          textTransform: 'uppercase', margin: '0 0 4px',
        }}>
          {mensaje?.tipo === 'recordatorio' ? t('subtitleRecordatorio') : t('subtitleConfirmacion')}
        </p>
        <h1 style={{ fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 26, lineHeight: 1.15, color: colors.textStrong, margin: 0 }}>
          {t('title')}
        </h1>
      </div>

      <div style={{ padding: '0 20px' }}>
        {loading && !mensaje && (
          <p style={{ fontSize: 14, color: colors.subtext, marginTop: 12 }}>{t('loading')}</p>
        )}

        {!loading && !mensaje && (
          <p style={{ fontSize: 14, color: colors.subtext, marginTop: 12 }}>{t('notFound')}</p>
        )}

        {mensaje && (
          <>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16,
              padding: '12px 16px', borderRadius: 18,
              border: `1px solid ${colors.border}`, backgroundColor: colors.surface,
            }}>
              <span style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                width: 36, height: 36, borderRadius: 18,
                backgroundColor: esFallido ? colors.dangerBg : colors.successBg,
              }}>
                <Icono size={18} color={colorEstado} strokeWidth={2} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: colors.text }}>
                  {cliente}
                </p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: colorEstado }}>
                  {textoEstado}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <WhatsappGlyph size={14} color={colors.success} />
              <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: colors.subtext, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {esFallido ? t('mensajeFallido') : t('mensajeEnviado')}
              </p>
            </div>

            <div style={{
              backgroundColor: esFallido ? colors.dangerBg : colors.successBg,
              border: `1px solid ${esFallido ? colors.dangerBorder : colors.successBorder}`,
              borderRadius: 12, padding: '14px 16px',
            }}>
              <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: colors.text, whiteSpace: 'pre-line' }}>
                {renderConNegritas(mensaje.mensaje)}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
