'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { FilaQueMostrar } from '@/components/filtros/FilaQueMostrar';
import { TarjetaQueMostrar } from '@/components/filtros/TarjetaQueMostrar';
import { useProAuthStore } from '@/store/useProAuthStore';
import { setTheme, useThemeStore } from '@/store/useThemeStore';
import { agendaColors, agendaFontSerif } from '@/theme/agendaColors';
import { NegocioSwitcherSheet } from './NegocioSwitcherSheet';
import { VisualProfesional } from './VisualProfesional';

const TAMANO_VISUAL = 40;

const saludoStyle = {
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: 22,
  fontStyle: 'italic',
  lineHeight: 1.1,
  fontFamily: agendaFontSerif,
  color: agendaColors.primaryDeep,
} as const;

const trazo = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

// Alterna claro/oscuro sobre el tema ya aplicado, igual que el atajo de la agenda.
function BotonTema() {
  const t = useTranslations('common.ThemeToggle');
  const aOscuro = useThemeStore((s) => s.resolvedTheme) === 'light';

  return (
    <button
      type="button"
      onClick={() => setTheme(aOscuro ? 'dark' : 'light')}
      aria-label={t(aOscuro ? 'toDark' : 'toLight')}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        width: 40,
        height: 40,
        padding: 0,
        borderRadius: 20,
        cursor: 'pointer',
        border: `1px solid ${agendaColors.border}`,
        backgroundColor: agendaColors.surface,
        color: agendaColors.text,
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" {...trazo}>
        {aOscuro ? (
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        ) : (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </>
        )}
      </svg>
    </button>
  );
}

// Encabezado de las pantallas con negocio activo: foto (o logo) y saludo a la
// izquierda, tema a la derecha, y debajo la fila "Negocio" solo si la persona
// tiene más de uno. La cuenta se alcanza desde la navegación inferior.
export function ProHeader() {
  const t = useTranslations('profesionales.ProHeader');
  const vinculos = useProAuthStore((s) => s.vinculos);
  const activoId = useProAuthStore((s) => s.vinculoActivoId);
  const [abierto, setAbierto] = useState(false);
  const fila = useRef<HTMLButtonElement>(null);

  const activo = vinculos.find((v) => v.id === activoId) ?? null;
  const puedeCambiar = activo !== null && vinculos.length > 1;
  const profesional = activo?.profesional ?? null;

  function cerrar() {
    setAbierto(false);
    fila.current?.focus();
  }

  return (
    <>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '20px 20px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <VisualProfesional profesional={profesional} size={TAMANO_VISUAL} radioLogo={10} prioridad />
          <span style={saludoStyle}>{profesional ? t('saludo', { nombre: profesional.nombre }) : t('marca')}</span>
        </div>
        <BotonTema />
      </header>
      {puedeCambiar && (
        <div style={{ padding: '0 20px 12px' }}>
          <TarjetaQueMostrar>
            <FilaQueMostrar
              ref={fila}
              abreDialogo
              ariaLabel={t('cambiarNegocio', { negocio: activo.negocioNombre })}
              leading={
                <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" style={{ color: agendaColors.sub }} {...trazo}>
                  <path d="m2 7 1.5-4h17L22 7" />
                  <path d="M4 21V10M20 21V10" />
                  <path d="M2 7a3.3 3.3 0 0 0 6.7 0 3.3 3.3 0 0 0 6.6 0A3.3 3.3 0 0 0 22 7" />
                  <path d="M3 21h18" />
                </svg>
              }
              titulo={t('negocio')}
              valor={activo.negocioNombre}
              activo
              onClick={() => setAbierto(true)}
            />
          </TarjetaQueMostrar>
        </div>
      )}
      {puedeCambiar && <NegocioSwitcherSheet abierto={abierto} onCerrar={cerrar} />}
    </>
  );
}
