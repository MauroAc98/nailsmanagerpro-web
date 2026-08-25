'use client';

import { agendaColors as colors } from '@/theme/agendaColors';

interface Props {
  label: string;
  valor: string | null | undefined;
}

export function FilaDato({ label, valor }: Props) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <span style={{ fontSize: 13, color: colors.subtext }}>{label}</span>
      {valor ? (
        <span style={{
          fontSize: 13, fontWeight: 600, color: colors.text, textAlign: 'right',
          maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {valor}
        </span>
      ) : (
        <span style={{ fontSize: 13, fontStyle: 'italic', color: colors.placeholder, textAlign: 'right', maxWidth: '60%' }}>
          Sin completar
        </span>
      )}
    </div>
  );
}
