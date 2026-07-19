'use client';

import { colors, withAlpha } from '@/theme/colors';
import { User } from '@/services/authService';

interface Props {
  user: User;
}

export function HeroPerfil({ user }: Props) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      backgroundColor: withAlpha(colors.primary, '12'), borderRadius: 20, padding: 18,
    }}>
      <div style={{
        width: 54, height: 54, borderRadius: 27,
        backgroundColor: withAlpha(colors.primary, '33'), border: `2px solid ${colors.surface}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <span style={{ fontSize: 22, fontWeight: 700, color: colors.primary }}>
          {user.name.charAt(0).toUpperCase()}
        </span>
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: 16, fontWeight: 700, color: colors.textStrong, margin: 0 }}>{user.name}</p>
        <p style={{ fontSize: 12, color: colors.subtext, margin: '2px 0 0' }}>{user.email}</p>
      </div>
    </div>
  );
}
