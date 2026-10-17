'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { AvatarProfesional } from '@/components/filtros/AvatarProfesional';
import { useProAuthStore } from '@/store/useProAuthStore';
import { agendaColors, agendaFontSerif } from '@/theme/agendaColors';
import { NegocioSwitcherSheet } from './NegocioSwitcherSheet';

const truncar = { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } as const;

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      <span style={{ fontSize: 13, color: agendaColors.sub }}>{etiqueta}</span>
      {children}
    </div>
  );
}

// Cuenta de la profesional (SE-12): quién es, en qué negocio está, cambiar de
// negocio y cerrar sesión. Nada de precios, comisiones ni notificaciones.
export function CuentaPro() {
  const t = useTranslations('profesionales.Cuenta');
  const email = useProAuthStore((s) => s.email);
  const vinculos = useProAuthStore((s) => s.vinculos);
  const activoId = useProAuthStore((s) => s.vinculoActivoId);
  const [abierto, setAbierto] = useState(false);

  const activo = vinculos.find((v) => v.id === activoId) ?? null;
  const puedeCambiar = vinculos.length > 1;
  const valor = { ...truncar, fontSize: 16, color: agendaColors.strong } as const;

  return (
    <main style={{ boxSizing: 'border-box', minHeight: '100dvh', padding: 24, backgroundColor: agendaColors.bg }}>
      <div style={{ maxWidth: 420, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontFamily: agendaFontSerif, color: agendaColors.strong }}>{t('titulo')}</h1>
        {email !== null && (
          <Dato etiqueta={t('correo')}>
            <span style={valor}>{email}</span>
          </Dato>
        )}
        {activo && (
          <>
            <Dato etiqueta={t('negocio')}>
              <span style={valor}>{activo.negocioNombre}</span>
            </Dato>
            <Dato etiqueta={t('profesional')}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <AvatarProfesional
                  nombre={activo.profesional.nombre}
                  apellido={activo.profesional.apellido}
                  avatarUrl={activo.profesional.avatar_url}
                  size={40}
                />
                <span style={valor}>{[activo.profesional.nombre, activo.profesional.apellido].filter(Boolean).join(' ')}</span>
              </span>
            </Dato>
          </>
        )}
        {puedeCambiar && (
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={() => setAbierto(true)}
            style={{
              minHeight: 44,
              border: `1px solid ${agendaColors.fieldBorder}`,
              borderRadius: 12,
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
              backgroundColor: agendaColors.surface,
              color: agendaColors.strong,
            }}
          >
            {t('cambiarNegocio')}
          </button>
        )}
        <button
          type="button"
          onClick={() => void useProAuthStore.getState().logout()}
          style={{
            minHeight: 44,
            border: `1px solid ${agendaColors.border}`,
            borderRadius: 12,
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
            backgroundColor: 'transparent',
            color: agendaColors.sub,
          }}
        >
          {t('cerrarSesion')}
        </button>
      </div>
      {puedeCambiar && <NegocioSwitcherSheet abierto={abierto} onCerrar={() => setAbierto(false)} />}
    </main>
  );
}
