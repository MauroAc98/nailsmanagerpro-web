'use client';

import { useTranslations } from 'next-intl';
import BackButton from '@/components/BackButton';
import SelectorOpciones from '@/components/SelectorOpciones';
import { agendaColors as colors, agendaFontSerif } from '@/theme/agendaColors';
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
      {/* Header — BackButton en su propia fila, h1 serif debajo: mismo
          patrón de las demás pantallas migradas (historia-precios,
          agenda/recordatorios), no la fila inline BackButton+h1 anterior. */}
      <div style={{ padding: '20px 20px 4px' }}>
        <BackButton />
      </div>
      <div style={{ padding: '4px 20px 12px' }}>
        <h1 style={{ fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 26, lineHeight: 1.15, color: colors.textStrong, margin: 0 }}>{t('title')}</h1>
      </div>

      <p style={{ margin: '0 20px 16px', fontSize: 14, color: colors.subtext, lineHeight: 1.5 }}>
        {t('subtitle')}
      </p>

      <SelectorOpciones opciones={OPCIONES} selected={theme} onSelect={setTheme} />
    </div>
  );
}
