'use client';

import React, { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ChevronLeft, MessageSquareWarning, CheckCircle2 } from 'lucide-react';
import { agendaColors as colors, agendaShadows as shadows, agendaFontSerif } from '@/theme/agendaColors';
import { WhatsappGlyph } from '@/components/icons/WhatsappGlyph';
import { useRecordatoriosPendientesStore } from '@/store/useRecordatoriosPendientesStore';
import { useProfesionalStore } from '@/store/useProfesionalStore';
import { useWhatsappTemplates } from '@/hooks/useWhatsappTemplates';
import { whatsappHelper } from '@/lib/whatsappHelper';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function fechaDeHora(fechaHora: string): string {
  return fechaHora.slice(0, 10); // "YYYY-MM-DD"
}

function horaDeHora(fechaHora: string): string {
  return fechaHora.slice(11, 16); // "HH:MM"
}

export default function RecordatoriosPendientesPage() {
  const router = useRouter();
  const t = useTranslations('agenda.RecordatoriosPendientesPage');

  const { turnos: turnosParaRecordar, loading, error, fetchRecordatoriosPendientes, marcarEnviado } = useRecordatoriosPendientesStore();
  const { profesionales, fetchProfesionales } = useProfesionalStore();
  const { obtenerContenido } = useWhatsappTemplates();

  useEffect(() => {
    fetchRecordatoriosPendientes();
    if (profesionales.length === 0) fetchProfesionales();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const profesionalesById = useMemo(
    () => new Map(profesionales.map(p => [p.id, p])),
    [profesionales]
  );

  // Igual criterio que la card principal de agenda: la etiqueta de
  // profesional en cada turno solo aporta si hay más de una activa.
  const mostrarEtiquetaProfesional = profesionales.filter(p => p.activo).length > 1;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.background, paddingBottom: 48 }}>

      {/* Header */}
      <div style={{ padding: '20px 20px 4px' }}>
        <button
          onClick={() => router.back()}
          aria-label={t('back')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, marginLeft: -4, display: 'flex', color: colors.text }}
        >
          <ChevronLeft size={24} strokeWidth={2} />
        </button>
      </div>

      <div style={{ padding: '4px 20px 18px' }}>
        <p style={{
          fontSize: 11, fontWeight: 700, color: colors.primaryDeep, letterSpacing: 1.5,
          textTransform: 'uppercase', margin: '0 0 4px',
        }}>
          {t('subtitle')}
        </p>
        <h1 style={{ fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 26, lineHeight: 1.15, color: colors.textStrong, margin: 0 }}>
          {t('title')}
        </h1>
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

        {!loading && !error && turnosParaRecordar.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16,
            padding: '12px 16px', borderRadius: 18,
            border: `1px solid ${colors.border}`, backgroundColor: colors.amberBg,
          }}>
            <span style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              width: 36, height: 36, borderRadius: 18, backgroundColor: colors.amber, color: colors.amberBg,
            }}>
              <MessageSquareWarning size={18} strokeWidth={2} />
            </span>
            <p style={{ flex: 1, margin: 0, fontSize: 13, fontWeight: 700, color: colors.amberFg }}>
              {t('bannerCount', { count: turnosParaRecordar.length })}
            </p>
          </div>
        )}

        {!loading && !error && turnosParaRecordar.length === 0 && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
            padding: '48px 24px', marginTop: 12, borderRadius: 24,
            backgroundColor: colors.successBg, textAlign: 'center',
          }}>
            <CheckCircle2 size={40} color={colors.success} strokeWidth={1.75} />
            <h2 style={{ fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 22, color: colors.textStrong, margin: '4px 0 0' }}>
              {t('emptyTitle')}
            </h2>
            <p style={{ fontSize: 14, color: colors.subtext, margin: 0 }}>
              {t('empty')}
            </p>
          </div>
        )}

        {!loading && !error && turnosParaRecordar.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {turnosParaRecordar.map(turno => {
              const profesional = turno.profesional_id != null
                ? profesionalesById.get(turno.profesional_id)
                : undefined;
              const nombresServicios = turno.servicios
                .filter(s => s != null)
                .map(s => s.nombre)
                .join(' + ');

              return (
                <article
                  key={turno.id}
                  style={{
                    borderRadius: 18, border: `1px solid ${colors.border}`,
                    backgroundColor: colors.surface, boxShadow: shadows.card, padding: 14,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{ fontSize: 15, fontWeight: 600, color: colors.text, margin: 0 }}>
                        {turno.cliente.nombre} {turno.cliente.apellido}
                      </p>
                      <p style={{ fontSize: 13, color: colors.subtext, margin: '2px 0 0' }}>
                        {horaDeHora(turno.fecha_hora)} · {nombresServicios}
                      </p>
                    </div>
                    {mostrarEtiquetaProfesional && profesional && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, maxWidth: 90 }}>
                        <span style={{
                          width: 6, height: 6, borderRadius: 3, flexShrink: 0,
                          backgroundColor: profesional.color || colors.primary,
                        }} />
                        <span style={{
                          fontSize: 10, fontWeight: 700, color: colors.subtext,
                          textTransform: 'uppercase', letterSpacing: 0.3,
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                          {profesional.nombre}
                        </span>
                      </span>
                    )}
                  </div>

                  <a
                    href={whatsappHelper.buildUrl({
                      clienteNombre:   turno.cliente.nombre,
                      clienteApellido: turno.cliente.apellido,
                      clienteTelefono: turno.cliente.telefono!,
                      servicio:        nombresServicios,
                      fecha:           fechaDeHora(turno.fecha_hora),
                      hora:            horaDeHora(turno.fecha_hora),
                      plantilla:       obtenerContenido('recordatorio'),
                      profesional:     profesional?.nombre,
                    })}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => marcarEnviado(turno.id)}
                    style={{
                      marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      width: '100%', padding: '11px 0', borderRadius: 12,
                      backgroundColor: colors.whatsapp, color: colors.primaryFg,
                      fontSize: 13, fontWeight: 700, textDecoration: 'none',
                    }}
                  >
                    <WhatsappGlyph size={16} />
                    {t('sendButton')}
                  </a>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
