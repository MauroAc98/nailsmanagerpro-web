'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useRutaPro } from '@/hooks/useRutaPro';
import { useProAuthStore } from '@/store/useProAuthStore';
import { agendaColors, agendaFontSerif } from '@/theme/agendaColors';
import { NegocioSwitcherSheet } from './NegocioSwitcherSheet';

const nombreStyle = {
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: 18,
  fontFamily: agendaFontSerif,
  color: agendaColors.strong,
} as const;

// Encabezado de las pantallas con negocio activo: nombre del negocio (tocable
// solo si la persona tiene más de uno) y acceso a la cuenta.
export function ProHeader() {
  const t = useTranslations('profesionales.ProHeader');
  const ruta = useRutaPro();
  const vinculos = useProAuthStore((s) => s.vinculos);
  const activoId = useProAuthStore((s) => s.vinculoActivoId);
  const [abierto, setAbierto] = useState(false);
  const boton = useRef<HTMLButtonElement>(null);

  const nombre = vinculos.find((v) => v.id === activoId)?.negocioNombre ?? null;
  const puedeCambiar = nombre !== null && vinculos.length > 1;

  function cerrar() {
    setAbierto(false);
    boton.current?.focus();
  }

  return (
    <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 16px' }}>
      {nombre === null ? (
        <span style={{ flex: 1 }} />
      ) : puedeCambiar ? (
        <button
          ref={boton}
          type="button"
          aria-haspopup="dialog"
          aria-label={t('cambiarNegocio', { negocio: nombre })}
          onClick={() => setAbierto(true)}
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 44,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            border: 'none',
            padding: 0,
            textAlign: 'left',
            cursor: 'pointer',
            backgroundColor: 'transparent',
          }}
        >
          <span style={nombreStyle}>{nombre}</span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
            <path d="M4 6l4 4 4-4" stroke={agendaColors.strong} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ) : (
        <span style={{ ...nombreStyle, flex: 1 }}>{nombre}</span>
      )}
      <Link
        href={ruta('/cuenta')}
        aria-label={t('cuenta')}
        style={{
          flexShrink: 0,
          minWidth: 44,
          minHeight: 44,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: agendaColors.strong,
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" />
          <path d="M4 20c0-4 4-6 8-6s8 2 8 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </Link>
      {puedeCambiar && <NegocioSwitcherSheet abierto={abierto} onCerrar={cerrar} />}
    </header>
  );
}
