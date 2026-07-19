'use client';

import { useRouter } from 'next/navigation';
import { colors, withAlpha, shadows } from '@/theme/colors';
import { useThemeStore, setTheme, ThemePreference } from '@/store/useThemeStore';

const OPCIONES: { value: ThemePreference; title: string; subtitle: string }[] = [
  { value: 'light',  title: 'Claro',   subtitle: 'Fondo blanco, siempre' },
  { value: 'dark',   title: 'Oscuro',  subtitle: 'Fondo oscuro, siempre' },
  { value: 'system', title: 'Sistema', subtitle: 'Sigue la configuración del dispositivo' },
];

export default function AparienciaPage() {
  const router = useRouter();
  const theme  = useThemeStore(state => state.theme);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.surface, paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ padding: '20px 20px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => router.back()}
          style={{
            width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceSubtle,
            border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.textStrong} strokeWidth="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: colors.text, margin: 0 }}>Apariencia</h1>
      </div>

      <p style={{ margin: '0 20px 16px', fontSize: 14, color: colors.subtext, lineHeight: 1.5 }}>
        Elegí cómo se ve la app. "Sistema" sigue el modo claro u oscuro configurado en tu dispositivo.
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
                border: `1px solid ${selected ? colors.primary : colors.border}`,
                boxShadow: shadows.card, borderRadius: 14,
                padding: '14px 16px', cursor: 'pointer', textAlign: 'left',
              }}
            >
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: colors.text }}>{op.title}</p>
                <p style={{ margin: '2px 0 0', fontSize: 13, color: colors.subtext }}>{op.subtitle}</p>
              </div>
              {selected && (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
