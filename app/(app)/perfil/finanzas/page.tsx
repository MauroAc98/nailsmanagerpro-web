'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import BackButton from '@/components/BackButton';
import { agendaColors as colors, agendaShadows as shadows, agendaFontSerif } from '@/theme/agendaColors';

// Agrupa 3 pantallas que ya existen sin tocarlas (BackButton usa
// router.back(), no una ruta fija — ver Finanzas en el rediseño de Perfil).
const OPCIONES = [
  {
    path: '/configuracion/gastos',
    titleKey: 'gastos',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={colors.primaryDeep} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2" /><path d="M6 12h.01M18 12h.01" />
      </svg>
    ),
  },
  {
    path: '/configuracion/ingresos',
    titleKey: 'ingresos',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={colors.primaryDeep} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
      </svg>
    ),
  },
  {
    path: '/configuracion/estadisticas',
    titleKey: 'estadisticas',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={colors.primaryDeep} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
];

export default function FinanzasPage() {
  const router = useRouter();
  const t = useTranslations('perfil.FinanzasPage');

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.background, paddingBottom: 100 }}>
      <div style={{ padding: '20px 20px 4px' }}>
        <BackButton />
      </div>
      <div style={{ padding: '4px 20px 12px' }}>
        <h1 style={{ fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 26, lineHeight: 1.15, color: colors.textStrong, margin: 0 }}>{t('title')}</h1>
      </div>

      <div style={{ padding: '16px 20px 10px' }}>
        <div style={{
          backgroundColor: colors.surface, border: `1px solid ${colors.border}`,
          boxShadow: shadows.card, borderRadius: 14, overflow: 'hidden',
        }}>
          {OPCIONES.map((op, i) => (
            <button
              key={op.path}
              onClick={() => router.push(op.path)}
              style={{
                display: 'flex', alignItems: 'center', gap: 14, width: '100%',
                backgroundColor: 'transparent', border: 'none',
                borderBottom: i < OPCIONES.length - 1 ? `1px solid ${colors.border}` : 'none',
                padding: '13px 16px', cursor: 'pointer', textAlign: 'left',
              }}
            >
              <div style={{
                width: 34, height: 34, backgroundColor: colors.surfaceSubtle,
                borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                {op.icon}
              </div>
              <span style={{ flex: 1, fontSize: 15, fontWeight: 600, color: colors.text }}>
                {t(op.titleKey)}
              </span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.placeholder} strokeWidth="2">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
