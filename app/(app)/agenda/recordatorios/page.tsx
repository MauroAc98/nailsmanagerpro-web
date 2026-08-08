'use client';

import React, { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { colors, shadows } from '@/theme/colors';
import { useTurnoStore } from '@/store/useTurnoStore';
import { useProfesionalStore } from '@/store/useProfesionalStore';
import { useWhatsappTemplates } from '@/hooks/useWhatsappTemplates';
import { whatsappHelper } from '@/lib/whatsappHelper';
import { fechaDeManana } from '@/lib/dateFormat';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function horaDeHora(fechaHora: string): string {
  return fechaHora.slice(11, 16); // "HH:MM"
}

// ─────────────────────────────────────────────
// Style constants
// ─────────────────────────────────────────────
const cardStyle: React.CSSProperties = {
  backgroundColor: colors.surface, border: `1px solid ${colors.border}`,
  boxShadow: shadows.card, borderRadius: 14, padding: '14px 16px',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
};

export default function RecordatoriosPendientesPage() {
  const router = useRouter();
  const t = useTranslations('agenda.RecordatoriosPendientesPage');

  const { turnos, loading, error, fetchTurnos } = useTurnoStore();
  const { profesionales, fetchProfesionales } = useProfesionalStore();
  const { obtenerContenido } = useWhatsappTemplates();

  const fechaManana = useMemo(() => fechaDeManana(), []);

  useEffect(() => {
    fetchTurnos(fechaManana);
    if (profesionales.length === 0) fetchProfesionales();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const profesionalesById = useMemo(
    () => new Map(profesionales.map(p => [p.id, p])),
    [profesionales]
  );

  const turnosParaRecordar = turnos.filter(
    turno => turno.estado_visual === 'confirmado' && !!turno.cliente?.telefono
  );

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.background, paddingBottom: 100 }}>

      {/* Header */}
      <div style={{ padding: '20px 20px 8px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => router.back()}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={colors.text} strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: colors.text, margin: 0 }}>{t('title')}</h1>
      </div>

      <div style={{ padding: '8px 20px 16px' }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: colors.primary, letterSpacing: 0.5, margin: 0, textTransform: 'uppercase' }}>
          {t('subtitle')}
        </p>
      </div>

      <div style={{ padding: '0 20px' }}>
        {loading && (
          <p style={{ fontSize: 14, color: colors.subtext, marginTop: 12 }}>
            {t('loading')}
          </p>
        )}

        {!loading && error && (
          <p style={{ fontSize: 14, color: colors.danger, marginTop: 12 }}>
            {t('loadError')}
          </p>
        )}

        {!loading && !error && turnosParaRecordar.length === 0 && (
          <p style={{ fontSize: 14, color: colors.subtext, marginTop: 12 }}>
            {t('empty')}
          </p>
        )}

        {!loading && !error && turnosParaRecordar.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {turnosParaRecordar.map(turno => {
              const profesionalNombreWhatsapp = turno.profesional_id != null
                ? profesionalesById.get(turno.profesional_id)?.nombre
                : undefined;
              const nombresServicios = turno.servicios
                .filter(s => s != null)
                .map(s => s.nombre)
                .join(' + ');

              return (
                <div key={turno.id} style={cardStyle}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 15, fontWeight: 600, color: colors.text, margin: 0 }}>
                      {turno.cliente.nombre} {turno.cliente.apellido}
                    </p>
                    <p style={{ fontSize: 13, color: colors.subtext, margin: '2px 0 0' }}>
                      {horaDeHora(turno.fecha_hora)} · {nombresServicios}
                    </p>
                  </div>
                  <a
                    href={whatsappHelper.buildUrl({
                      clienteNombre:   turno.cliente.nombre,
                      clienteApellido: turno.cliente.apellido,
                      clienteTelefono: turno.cliente.telefono!,
                      servicio:        nombresServicios,
                      fecha:           fechaManana,
                      hora:            horaDeHora(turno.fecha_hora),
                      plantilla:       obtenerContenido('recordatorio'),
                      profesional:     profesionalNombreWhatsapp,
                    })}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      flexShrink: 0, width: 38, height: 38, borderRadius: 19,
                      backgroundColor: colors.successBg, border: `1px solid ${colors.successBorder}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="#25D366">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                  </a>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
