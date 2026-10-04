'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { agendaColors as colors } from '@/theme/agendaColors';
import { tieneNotaTurno } from './IconoNotaTurno';

// Cuatro lineas de texto entran en ~120 caracteres o 3 saltos de linea: pasado eso
// la nota se recorta y se ofrece "Ver todo".
const esLarga = (texto: string): boolean => texto.length > 120 || (texto.match(/\n/g) ?? []).length >= 3;

// Bloque de solo lectura con la idea que el cliente escribio al reservar online
// ("Contanos tu idea"), arriba de los campos de la pantalla de editar turno.
// Sin nota no dibuja nada.
export function IdeaDelTurno({ notas, origenWeb }: { notas?: string | null; origenWeb: boolean }) {
  const t = useTranslations('agenda.NotaTurno');
  const [abierta, setAbierta] = useState(false);
  if (!tieneNotaTurno(notas)) return null;
  const texto = (notas as string).trim();
  const larga = esLarga(texto);

  return (
    <section
      style={{
        display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 14px', marginBottom: 20,
        borderRadius: 16, background: colors.amberBg,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: colors.amberFg }}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z" />
          <path d="M5.5 6.5h5M5.5 8.5h3" />
        </svg>
        <h2 style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>{t('title')}</h2>
      </div>
      <p
        style={{
          margin: 0, fontSize: 14.5, lineHeight: 1.5, color: colors.strong, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
          ...(larga && !abierta
            ? { display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }
            : {}),
        }}
      >
        {texto}
      </p>
      {larga && (
        <button
          type="button"
          onClick={() => setAbierta((v) => !v)}
          style={{
            alignSelf: 'flex-start', minHeight: 32, padding: '4px 0', border: 'none', background: 'none',
            fontSize: 13, fontWeight: 700, color: colors.amberFg, cursor: 'pointer',
          }}
        >
          {abierta ? t('verMenos') : t('verTodo')}
        </button>
      )}
      {origenWeb && <small style={{ fontSize: 11.5, color: colors.sub }}>{t('escritaAlReservar')}</small>}
    </section>
  );
}
