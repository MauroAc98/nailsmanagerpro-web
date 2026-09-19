'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import BackButton from '@/components/BackButton';
import { agendaColors as colors, agendaShadows as shadows, agendaFontSerif } from '@/theme/agendaColors';
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
  const nombreProfesional = (id: number | null): string => {
    if (id === null) return t('todoElSalon');
    return profesionales.find(p => p.id === id)?.nombre_completo ?? t('profesionalDesconocida');
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
            <p style={{ textAlign: 'center', marginTop: 50, color: colors.subtext, fontSize: 16 }}>
              {t('empty')}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {bloqueos.map(b => (
                <div
                  key={b.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    backgroundColor: colors.surface, border: `1px solid ${colors.border}`,
                    boxShadow: shadows.card, borderRadius: 14, padding: '14px 16px',
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{
                      margin: 0, fontSize: 15, fontWeight: 600, color: colors.text,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {formatFechaBloqueo(b.fecha)}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: colors.subtext }}>
                      {nombreProfesional(b.profesional_id)} · {rangoHorario(b)}
                    </p>
                    {b.motivo && (
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: colors.subtext, fontStyle: 'italic' }}>
                        {b.motivo}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleEliminar(b)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', flexShrink: 0 }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.danger} strokeWidth="2">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                      <path d="M10 11v6M14 11v6"/>
                      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
