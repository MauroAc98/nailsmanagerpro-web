'use client';

import { useTranslations } from 'next-intl';
import type { ProfesionalPublico } from '@/lib/reservaOnline/types';
import { agendaColors as colors } from '@/theme/agendaColors';
import { AvatarProfesional } from './AvatarProfesional';

const tile = (activo: boolean) =>
  ({
    position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
    minWidth: 0, minHeight: 44, padding: '12px 4px 10px', borderRadius: 16, cursor: 'pointer',
    fontSize: 13, fontWeight: 600,
    border: `1.5px solid ${activo ? colors.primary : colors.hairline}`,
    background: activo ? colors.primarySoft : colors.surface2,
    color: activo ? colors.strong : colors.text,
  }) as const;

function Tilde() {
  return (
    <span
      aria-hidden="true"
      style={{
        position: 'absolute', top: 6, right: 6, width: 16, height: 16, borderRadius: '50%',
        background: colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke={colors.primaryFg} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3.5 8.4l3 3 6-6.4" />
      </svg>
    </span>
  );
}

// Modo "una persona": un mosaico con "Cualquiera" (las profesionales apiladas) y
// cada profesional que hace todos los servicios, con avatar grande y tilde en la
// elegida. Tocar la elegida de nuevo vuelve a "Cualquiera".
export function ElegirPersona({
  profesionales,
  selectedId,
  onSelect,
}: {
  profesionales: ProfesionalPublico[];
  // null = "Cualquiera"
  selectedId: number | null;
  onSelect: (id: number | null) => void;
}) {
  const t = useTranslations('reservaOnline');
  const cualquiera = selectedId === null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))', gap: 8 }}>
      <button type="button" aria-pressed={cualquiera} onClick={() => onSelect(null)} style={tile(cualquiera)}>
        <span style={{ height: 44, display: 'flex', alignItems: 'center' }}>
          {profesionales.slice(0, 3).map((p, i) => (
            <span
              key={p.id}
              style={{
                marginLeft: i === 0 ? 0 : -12, borderRadius: '50%',
                border: `2px solid ${cualquiera ? colors.primarySoft : colors.surface2}`, display: 'flex',
              }}
            >
              <AvatarProfesional nombre={p.nombre} avatarUrl={p.avatarUrl} size={30} sinTexto />
            </span>
          ))}
        </span>
        <span style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {t('horario.cualquiera')}
        </span>
        {cualquiera && <Tilde />}
      </button>
      {profesionales.map((p) => {
        const activa = selectedId === p.id;
        return (
          <button key={p.id} type="button" aria-pressed={activa} onClick={() => onSelect(activa ? null : p.id)} style={tile(activa)}>
            <AvatarProfesional nombre={p.nombre} avatarUrl={p.avatarUrl} size={44} />
            <span style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {p.nombre}
            </span>
            {activa && <Tilde />}
          </button>
        );
      })}
    </div>
  );
}
