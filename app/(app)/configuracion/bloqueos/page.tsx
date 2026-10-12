'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import BackButton from '@/components/BackButton';
import BloqueoCard from '@/components/BloqueoCard';
import { agendaColors as colors, agendaFontSerif } from '@/theme/agendaColors';
import { useBloqueosAgendaStore } from '@/store/useBloqueosAgendaStore';
import { useProfesionalStore } from '@/store/useProfesionalStore';
import { BloqueoAgenda } from '@/services/bloqueoAgendaService';
import { confirmDialog, alertDialog } from '@/store/useConfirmStore';
import { showToast } from '@/store/useToastStore';
import { nombreDia, nombreMes } from '@/lib/dateFormat';
import { NAV_CLEARANCE } from '@/constants/layout';

// "Domingo, 5 de enero de 2099" — mismo orden "de {mes} de {año}" que
// funciona sin cambios en pt-BR ("Domingo, 5 de janeiro de 2099").
function formatFechaBloqueo(fecha: string): string {
  const d = new Date(`${fecha}T00:00:00`);
  return `${nombreDia(d, 'long')}, ${d.getDate()} de ${nombreMes(d, 'long', 'ninguna')} de ${d.getFullYear()}`;
}

export default function BloqueosPage() {
  const t = useTranslations('configuracion.BloqueosPage');
  const router = useRouter();
  const { bloqueos, loading, error, fetchBloqueos, eliminarBloqueo } = useBloqueosAgendaStore();
  const { profesionales, fetchProfesionales } = useProfesionalStore();

  useEffect(() => { fetchBloqueos(); fetchProfesionales(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // `null` = bloqueo salon-wide; un id que ya no matchea ninguna profesional
  // cargada (borrada) cae al fallback genérico en vez de romper el render.
  const profesionalDe = (id: number | null) => (id === null ? null : profesionales.find(p => p.id === id));

  const nombreProfesional = (id: number | null): string => {
    if (id === null) return t('todoElSalon');
    return profesionalDe(id)?.nombre_completo ?? t('profesionalDesconocida');
  };

  const rangoHorario = (b: BloqueoAgenda): string =>
    b.hora_desde && b.hora_hasta ? `${b.hora_desde} - ${b.hora_hasta}` : t('todoElDia');

  const handleEliminar = async (bloqueo: BloqueoAgenda) => {
    const confirmado = await confirmDialog(t('deleteConfirm'), { confirmText: t('deleteConfirmButton'), danger: true });
    if (!confirmado) return;

    const result = await eliminarBloqueo(bloqueo.id);
    if (result.success) showToast(t('deleted'));
    else await alertDialog(result.message ?? t('deleteError'));
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.background, paddingBottom: 100 }}>
      {/* Header — BackButton en su propia fila, h1 serif debajo (mismo
          patrón que el resto de las pantallas migradas). */}
      <div style={{ padding: '20px 20px 4px' }}>
        <BackButton />
      </div>
      <div style={{ padding: '4px 20px 12px' }}>
        <h1 style={{ fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 26, lineHeight: 1.15, color: colors.textStrong, margin: 0 }}>{t('title')}</h1>
        <p style={{ margin: '8px 0 0', fontSize: 13, color: colors.subtext }}>{t('subtitle')}</p>
      </div>

      {/* FAB */}
      <button
        onClick={() => router.push('/configuracion/bloqueos/nuevo')}
        style={{
          position: 'fixed', bottom: `calc(${NAV_CLEARANCE}px + env(safe-area-inset-bottom) + 8px)`, right: 24,
          width: 56, height: 56, borderRadius: 28,
          backgroundColor: colors.primarySolid, border: 'none',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(215,158,164,0.5)', zIndex: 10,
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>

      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Error */}
        {error && (
          <div style={{ padding: '12px 16px', borderRadius: 8, backgroundColor: colors.dangerBg, borderLeft: `4px solid ${colors.dangerBorder}` }}>
            <p style={{ fontSize: 14, color: colors.danger, margin: 0 }}>{error}</p>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <p style={{ color: colors.subtext, fontSize: 15 }}>{t('loading')}</p>
          </div>
        )}

        {/* List — ya viene ordenada por fecha desde el backend (GET
            /bloqueos ordena por `fecha`, ver BloqueoAgendaController::index). */}
        {!loading && !error && (
          bloqueos.length === 0 ? (
            <div style={{ textAlign: 'center', marginTop: 50 }}>
              <p style={{ margin: 0, color: colors.textStrong, fontSize: 16, fontWeight: 600 }}>
                {t('emptyTitle')}
              </p>
              <p style={{ margin: '6px 0 0', color: colors.subtext, fontSize: 13 }}>
                {t('emptyText')}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {bloqueos.map(b => {
                const profesional = profesionalDe(b.profesional_id);
                const rango = rangoHorario(b);
                const esHorarioPuntual = Boolean(b.hora_desde && b.hora_hasta);

                return (
                  <BloqueoCard
                    key={b.id}
                    fecha={formatFechaBloqueo(b.fecha)}
                    horario={rango}
                    esHorarioPuntual={esHorarioPuntual}
                    motivo={b.motivo}
                    nombreProfesional={nombreProfesional(b.profesional_id)}
                    profesional={profesional ? {
                      nombre: profesional.nombre,
                      apellido: profesional.apellido,
                      color: profesional.color,
                      avatarUrl: profesional.avatar_url,
                    } : null}
                    onDelete={() => handleEliminar(b)}
                  />
                );
              })}
            </div>
          )
        )}
      </div>
    </div>
  );
}
