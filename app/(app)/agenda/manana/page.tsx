'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Clock, CheckCircle2, XCircle, Send, Clock3 } from 'lucide-react';
import BackButton from '@/components/BackButton';
import { agendaColors as colors, agendaShadows as shadows, agendaFontSerif } from '@/theme/agendaColors';
import { turnoService, TurnoManana } from '@/services/turnoService';
import { extraerMensajeError } from '@/services/clienteService';

function horaDeHora(fechaHora: string): string {
  return fechaHora.slice(11, 16);
}

// Colapsa los 5 status reales de WhatsappMensaje (pending/delivered/read/
// failed/manual) a 3 estados visuales — para esta vista de referencia
// rápida no interesa el detalle fino que sí muestra la campanita
// (NotificacionesBell), solo "¿ya salió, o hay que preocuparse?".
function EstadoRecordatorio({ status }: { status: TurnoManana['recordatorio_status'] }) {
  const t = useTranslations('agenda.TurnosMananaPage');

  if (status === null) {
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: colors.subtext }}>
        <Clock3 size={13} strokeWidth={2} />
        {t('recordatorioPendiente')}
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: colors.danger }}>
        <XCircle size={13} strokeWidth={2} />
        {t('recordatorioFallido')}
      </span>
    );
  }
  const Icono = status === 'manual' ? Send : CheckCircle2;
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: colors.success }}>
      <Icono size={13} strokeWidth={2} />
      {t('recordatorioEnviado')}
    </span>
  );
}

export default function TurnosMananaPage() {
  const t = useTranslations('agenda.TurnosMananaPage');
  const [turnos, setTurnos] = useState<TurnoManana[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cargar = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await turnoService.turnosManana();
        setTurnos(data);
      } catch (e) {
        setError(extraerMensajeError(e));
      } finally {
        setLoading(false);
      }
    };
    cargar();
  }, []);

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
          {t('subtitle')}
        </p>
        <h1 style={{ fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 26, lineHeight: 1.15, color: colors.textStrong, margin: 0 }}>
          {t('title')}
        </h1>
      </div>

      <div style={{ padding: '0 20px' }}>
        {loading && (
          <p style={{ fontSize: 14, color: colors.subtext, marginTop: 12 }}>{t('loading')}</p>
        )}

        {!loading && error && (
          <p style={{ fontSize: 14, color: colors.danger, marginTop: 12 }}>{error}</p>
        )}

        {!loading && !error && turnos.length === 0 && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
            padding: '48px 24px', marginTop: 12, borderRadius: 24,
            backgroundColor: colors.surfaceSubtle, textAlign: 'center',
          }}>
            <Clock size={40} color={colors.subtext} strokeWidth={1.5} />
            <h2 style={{ fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 22, color: colors.textStrong, margin: '4px 0 0' }}>
              {t('emptyTitle')}
            </h2>
            <p style={{ fontSize: 14, color: colors.subtext, margin: 0 }}>{t('empty')}</p>
          </div>
        )}

        {!loading && !error && turnos.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {turnos.map(turno => {
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
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{ fontSize: 15, fontWeight: 600, color: colors.text, margin: 0 }}>
                        {turno.cliente.nombre} {turno.cliente.apellido}
                      </p>
                      <p style={{ fontSize: 13, color: colors.subtext, margin: '2px 0 0' }}>
                        {horaDeHora(turno.fecha_hora)} · {nombresServicios}
                      </p>
                    </div>
                    <EstadoRecordatorio status={turno.recordatorio_status} />
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
