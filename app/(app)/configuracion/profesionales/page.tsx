'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import BackButton from '@/components/BackButton';
import { agendaColors as colors, agendaShadows as shadows, agendaFontSerif } from '@/theme/agendaColors';
import { useProfesionalStore } from '@/store/useProfesionalStore';
import { Profesional, profesionalJefa } from '@/services/profesionalService';
import { useAuthStore } from '@/store/useAuthStore';
import { alertDialog } from '@/store/useConfirmStore';
import { mensajeBloqueoParalelo } from '@/lib/promoComponentes';
import { NAV_CLEARANCE } from '@/constants/layout';
import PillToggle from '@/components/PillToggle';
import { inicialesProfesional } from '@/lib/inicialesProfesional';
import { formatearDiasAtencion } from '@/lib/formatearDiasAtencion';

// Abreviaturas lunes-primero para el texto de días — reusa las mismas
// traducciones que WeekdayPicker (`*Full`, recortadas a 3 letras: "Lunes" ->
// "Lun") en vez de duplicar un set de claves nuevo solo para esto.
function useAbreviaturasDias(): Record<number, string> {
  const t = useTranslations('common.WeekdayPicker');
  return {
    0: t('sunFull').slice(0, 3),
    1: t('monFull').slice(0, 3),
    2: t('tueFull').slice(0, 3),
    3: t('wedFull').slice(0, 3),
    4: t('thuFull').slice(0, 3),
    5: t('friFull').slice(0, 3),
    6: t('satFull').slice(0, 3),
  };
}

function ProfesionalCard({
  profesional,
  esJefa,
  onEdit,
  onToggle,
}: {
  profesional: Profesional;
  esJefa:      boolean;
  onEdit:      () => void;
  onToggle:    (activo: boolean) => void;
}) {
  const t = useTranslations('configuracion.ProfesionalesPage');
  const abreviaturasDias = useAbreviaturasDias();
  const color = profesional.color || colors.primary;
  const cantidadServicios = profesional.servicios?.length ?? 0;
  const textoDias = formatearDiasAtencion(profesional.dias_atencion, abreviaturasDias, t('allDays'), t('dayRangeConnector'));
  const textoServicios = cantidadServicios === 0 ? t('noServices') : t('serviceCount', { count: cantidadServicios });

  return (
    <div
      onClick={onEdit}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        backgroundColor: profesional.activo ? colors.surface : colors.surfaceSubtle,
        border: `1px solid ${colors.border}`,
        boxShadow: shadows.card, borderRadius: 16,
        padding: '12px 14px', cursor: 'pointer',
        userSelect: 'none',
      }}
    >
      <div style={{ position: 'relative', flexShrink: 0 }}>
        {profesional.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profesional.avatar_url}
            alt=""
            style={{
              width: 46, height: 46, borderRadius: 23, objectFit: 'cover',
              border: `1.5px solid ${colors.border}`,
              filter: profesional.activo ? 'none' : 'grayscale(0.6)',
              opacity: profesional.activo ? 1 : 0.6,
            }}
          />
        ) : (
          <div style={{
            width: 46, height: 46, borderRadius: 23,
            backgroundColor: color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#FFF', fontSize: 16, fontWeight: 700, fontFamily: agendaFontSerif,
            opacity: profesional.activo ? 1 : 0.6,
          }}>
            {inicialesProfesional(profesional.nombre, profesional.apellido)}
          </div>
        )}
        {esJefa && (
          <span
            aria-label={t('jefaBadge')}
            title={t('jefaBadge')}
            style={{
              position: 'absolute', bottom: -2, right: -2, width: 17, height: 17, borderRadius: 8,
              backgroundColor: '#E8B84B', border: `1.5px solid ${colors.surface}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="9" height="9" viewBox="0 0 24 24" fill="#fff"><path d="M5 16L3 6l6 4 3-6 3 6 6-4-2 10z"/></svg>
          </span>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <p style={{
            margin: 0, fontSize: 15, fontWeight: 700,
            color: profesional.activo ? colors.text : colors.placeholder,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0,
          }}>
            {profesional.nombre_completo}
          </p>
          {!profesional.activo && (
            <span style={{
              flexShrink: 0, fontSize: 9, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase',
              color: colors.subtext, backgroundColor: colors.border, padding: '2px 7px', borderRadius: 6,
            }}>
              {t('inactiveLabel')}
            </span>
          )}
        </div>
        <p style={{
          display: 'flex', alignItems: 'center', gap: 6,
          margin: '3px 0 0', fontSize: 11.5, color: colors.subtext,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{textoDias}</span>
          <span style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: colors.placeholder, flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{textoServicios}</span>
        </p>
      </div>

      <PillToggle value={profesional.activo} onChange={onToggle} stopPropagation />
    </div>
  );
}

export default function ProfesionalesPage() {
  const t = useTranslations('configuracion.ProfesionalesPage');
  const router = useRouter();
  const { profesionales, loading, error, fetchProfesionales, toggleActivo } = useProfesionalStore();
  const { user, updatePerfil } = useAuthStore();
  const [guardandoParalelo, setGuardandoParalelo] = useState(false);

  useEffect(() => { fetchProfesionales(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Nada nuevo aparece si no hace falta (principio de simplicidad): con una
  // sola profesional activa "atender en paralelo" no tiene sentido.
  const activas = profesionales.filter(p => p.activo).length;
  const mostrarParalelo = activas > 1;

  const handleToggleParalelo = async (valor: boolean) => {
    setGuardandoParalelo(true);
    try {
      await updatePerfil({ atiende_en_paralelo: valor });
    } catch (e) {
      // El ajuste vuelve solo a su valor anterior: no hay estado optimista
      // local, `PillToggle` refleja `user.atiende_en_paralelo`, que
      // `updatePerfil` deja sin tocar cuando tira el 422.
      await alertDialog(mensajeBloqueoParalelo(e));
    } finally {
      setGuardandoParalelo(false);
    }
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
        onClick={() => router.push('/configuracion/profesionales/nuevo')}
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

      <div style={{ padding: '0 20px 8px' }}>
        <p style={{ fontSize: 13, color: colors.subtext, margin: 0 }}>
          {t('disclaimer')}
        </p>
      </div>

      {/* Ajuste del salón "atiende en paralelo" (PR 2d): solo con más de una
          profesional activa, apagado por defecto, una sola línea de ayuda. */}
      {mostrarParalelo && (
        <div style={{ padding: '0 20px 16px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            backgroundColor: colors.surface, border: `1px solid ${colors.border}`,
            boxShadow: shadows.card, borderRadius: 14, padding: '13px 16px',
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 14.5, fontWeight: 600, color: colors.text }}>{t('paraleloTitle')}</p>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: colors.subtext, lineHeight: 1.4 }}>{t('paraleloHint')}</p>
            </div>
            <PillToggle
              value={user?.atiende_en_paralelo ?? false}
              onChange={handleToggleParalelo}
              disabled={guardandoParalelo}
              ariaLabel={t('paraleloTitle')}
            />
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ margin: '0 20px 16px', padding: '12px 16px', borderRadius: 8, backgroundColor: colors.dangerBg, borderLeft: `4px solid ${colors.dangerBorder}` }}>
          <p style={{ fontSize: 14, color: colors.danger, margin: 0 }}>{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ padding: '40px 20px', textAlign: 'center' }}>
          <p style={{ color: colors.subtext, fontSize: 15 }}>{t('loading')}</p>
        </div>
      )}

      {/* List */}
      {!loading && !error && (
        <div style={{ padding: '10px 20px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {profesionales.length === 0 ? (
            <p style={{ textAlign: 'center', marginTop: 50, color: colors.subtext, fontSize: 16 }}>
              {t('emptyState')}
            </p>
          ) : (
            (() => {
              const jefa = profesionalJefa(profesionales);
              return profesionales.map(p => (
                <ProfesionalCard
                  key={p.id}
                  profesional={p}
                  esJefa={jefa?.id === p.id}
                  onEdit={() => router.push(`/configuracion/profesionales/${p.id}`)}
                  onToggle={activo => toggleActivo(p.id, activo)}
                />
              ));
            })()
          )}
        </div>
      )}
    </div>
  );
}
