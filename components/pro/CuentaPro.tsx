'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useProAuthStore } from '@/store/useProAuthStore';
import { agendaColors, agendaFontSerif } from '@/theme/agendaColors';
import { NegocioSwitcherSheet } from './NegocioSwitcherSheet';
import { VisualProfesional } from './VisualProfesional';

const truncar = { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } as const;
const trazo = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

const grupoStyle = {
  overflow: 'hidden',
  borderRadius: 14,
  border: `1px solid ${agendaColors.divider}`,
  backgroundColor: agendaColors.surface,
} as const;

const filaStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  width: '100%',
  boxSizing: 'border-box',
  minHeight: 44,
  padding: '13px 14px',
  fontSize: 14.5,
  fontWeight: 600,
  color: agendaColors.text,
} as const;

function IconoFila({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        width: 32,
        height: 32,
        borderRadius: 9,
        backgroundColor: agendaColors.bg,
        color: agendaColors.primaryDeep,
      }}
    >
      <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true" {...trazo}>
        {children}
      </svg>
    </span>
  );
}

// Cuenta de la profesional (SE-12), con el mismo orden que el Perfil de la agenda:
// quién es, su negocio, cambiar de negocio y cerrar sesión. Nada de precios,
// comisiones ni notificaciones.
export function CuentaPro() {
  const t = useTranslations('profesionales.Cuenta');
  const email = useProAuthStore((s) => s.email);
  const vinculos = useProAuthStore((s) => s.vinculos);
  const activoId = useProAuthStore((s) => s.vinculoActivoId);
  const [abierto, setAbierto] = useState(false);
  const fila = useRef<HTMLButtonElement>(null);

  const activo = vinculos.find((v) => v.id === activoId) ?? null;
  const puedeCambiar = vinculos.length > 1;
  const profesional = activo?.profesional ?? null;
  const nombre = profesional ? [profesional.nombre, profesional.apellido].filter(Boolean).join(' ') : null;

  function cerrar() {
    setAbierto(false);
    fila.current?.focus();
  }

  return (
    <main style={{ boxSizing: 'border-box', minHeight: '100dvh', backgroundColor: agendaColors.bg }}>
      <div style={{ maxWidth: 420, margin: '0 auto', minWidth: 0 }}>
        <div style={{ padding: '24px 20px 12px' }}>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 400, lineHeight: 1.15, fontFamily: agendaFontSerif, color: agendaColors.strong }}>
            {t('titulo')}
          </h1>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0, padding: '10px 20px 16px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              minWidth: 0,
              padding: 18,
              borderRadius: 20,
              backgroundColor: agendaColors.primarySoft,
            }}
          >
            <VisualProfesional profesional={profesional} size={54} radioLogo={14} />
            <div style={{ minWidth: 0 }}>
              {nombre && <p style={{ ...truncar, margin: 0, fontSize: 16, fontWeight: 700, color: agendaColors.strong }}>{nombre}</p>}
              {email !== null && <p style={{ ...truncar, margin: '2px 0 0', fontSize: 12, color: agendaColors.sub }}>{email}</p>}
            </div>
          </div>
          {activo && (
            <section>
              <h2
                style={{
                  margin: '0 0 6px 4px',
                  fontSize: 11.5,
                  fontWeight: 700,
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                  color: agendaColors.sub,
                }}
              >
                {t('negocio')}
              </h2>
              <div style={grupoStyle}>
                <div style={{ ...filaStyle, borderBottom: puedeCambiar ? `1px solid ${agendaColors.divider}` : 'none' }}>
                  <IconoFila>
                    <path d="M3 9l1.5-5h15L21 9" />
                    <path d="M3 9v10a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V9" />
                    <path d="M3 9h18" />
                    <path d="M9 20v-6h6v6" />
                  </IconoFila>
                  <span style={{ flexShrink: 0 }}>{t('negocio')}</span>
                  <span style={{ ...truncar, flex: 1, textAlign: 'right', fontSize: 12, fontWeight: 400, color: agendaColors.sub }}>
                    {activo.negocioNombre}
                  </span>
                </div>
                {puedeCambiar && (
                  <button
                    ref={fila}
                    type="button"
                    aria-haspopup="dialog"
                    onClick={() => setAbierto(true)}
                    style={{ ...filaStyle, border: 'none', textAlign: 'left', cursor: 'pointer', backgroundColor: 'transparent' }}
                  >
                    <IconoFila>
                      <path d="m17 2 4 4-4 4" />
                      <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
                      <path d="m7 22-4-4 4-4" />
                      <path d="M21 13v1a4 4 0 0 1-4 4H3" />
                    </IconoFila>
                    <span style={{ flex: 1 }}>{t('cambiarNegocio')}</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0, color: agendaColors.muted }} {...trazo}>
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </button>
                )}
              </div>
            </section>
          )}
          <button
            type="button"
            onClick={() => void useProAuthStore.getState().logout()}
            style={{
              boxSizing: 'border-box',
              width: '100%',
              minHeight: 44,
              padding: 14,
              borderRadius: 14,
              border: `1px solid ${agendaColors.dangerBorder}`,
              fontSize: 15,
              fontWeight: 600,
              textAlign: 'center',
              cursor: 'pointer',
              backgroundColor: agendaColors.dangerBg,
              color: agendaColors.danger,
            }}
          >
            {t('cerrarSesion')}
          </button>
        </div>
      </div>
      {puedeCambiar && <NegocioSwitcherSheet abierto={abierto} onCerrar={cerrar} />}
    </main>
  );
}
