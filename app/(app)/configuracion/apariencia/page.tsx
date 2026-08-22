'use client';

import { useTranslations } from 'next-intl';
import BackButton from '@/components/BackButton';
import { colors, withAlpha, shadows } from '@/theme/colors';
import { useThemeStore, setTheme, ThemePreference } from '@/store/useThemeStore';

export default function AparienciaPage() {
  const t = useTranslations('configuracion.AparienciaPage');
  const theme  = useThemeStore(state => state.theme);

  const OPCIONES: { value: ThemePreference; title: string; subtitle: string }[] = [
    { value: 'light',  title: t('light'),  subtitle: t('lightSubtitle') },
    { value: 'dark',   title: t('dark'),   subtitle: t('darkSubtitle') },
    { value: 'system', title: t('system'), subtitle: t('systemSubtitle') },
  ];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.surface, paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ padding: '20px 20px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <BackButton />
        <h1 style={{ fontSize: 20, fontWeight: 700, color: colors.text, margin: 0 }}>{t('title')}</h1>
      </div>

      <p style={{ margin: '0 20px 16px', fontSize: 14, color: colors.subtext, lineHeight: 1.5 }}>
        {t('subtitle')}
      </p>

      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {OPCIONES.map(op => {
          const selected = theme === op.value;
          return (
            <button
              key={op.value}
              onClick={() => setTheme(op.value)}
              style={{
                display: 'flex', alignItems: 'center', gap: 15,
                backgroundColor: selected ? withAlpha(colors.primary, '12') : colors.surface,
                border: `1px solid ${selected ? colors.primaryDeep : colors.border}`,
                boxShadow: shadows.card, borderRadius: 14,
                padding: '14px 16px', cursor: 'pointer', textAlign: 'left',
              }}
            >
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: colors.text }}>{op.title}</p>
                <p style={{ margin: '2px 0 0', fontSize: 13, color: colors.subtext }}>{op.subtitle}</p>
              </div>
              {selected && (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.primaryDeep} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
