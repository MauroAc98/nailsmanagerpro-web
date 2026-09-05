'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { agendaColors as colors, agendaShadows as shadows, agendaFontSerif } from '@/theme/agendaColors';
import { AgendaThemeScope } from '@/components/AgendaThemeScope';

const OPCIONES = [
  {
    path: '/configuracion/servicios',
    titleKey: 'servicios',
    grupo: 'negocio' as const,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={colors.primaryDeep} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    ),
  },
  {
    path: '/configuracion/slots',
    titleKey: 'slots',
    grupo: 'negocio' as const,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={colors.primaryDeep} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
  },
  {
    path: '/configuracion/profesionales',
    titleKey: 'profesionales',
    grupo: 'negocio' as const,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={colors.primaryDeep} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    path: '/configuracion/gastos',
    titleKey: 'gastos',
    grupo: 'negocio' as const,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={colors.primaryDeep} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <circle cx="12" cy="12" r="2" />
        <path d="M6 12h.01M18 12h.01" />
      </svg>
    ),
  },
  {
    path: '/configuracion/ingresos',
    titleKey: 'ingresos',
    grupo: 'negocio' as const,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={colors.primaryDeep} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="19" x2="12" y2="5" />
        <polyline points="5 12 12 5 19 12" />
      </svg>
    ),
  },
  {
    path: '/configuracion/categorias-movimientos',
    titleKey: 'categoriasMovimientos',
    grupo: 'negocio' as const,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={colors.primaryDeep} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="8" y1="6" x2="21" y2="6"/>
        <line x1="8" y1="12" x2="21" y2="12"/>
        <line x1="8" y1="18" x2="21" y2="18"/>
        <line x1="3" y1="6" x2="3.01" y2="6"/>
        <line x1="3" y1="12" x2="3.01" y2="12"/>
        <line x1="3" y1="18" x2="3.01" y2="18"/>
      </svg>
    ),
  },
  {
    path: '/configuracion/estadisticas',
    titleKey: 'estadisticas',
    grupo: 'cuenta' as const,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={colors.primaryDeep} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/>
        <line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    ),
  },
  {
    path: '/configuracion/apariencia',
    titleKey: 'apariencia',
    grupo: 'cuenta' as const,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={colors.primaryDeep} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="5"/>
        <line x1="12" y1="1" x2="12" y2="3"/>
        <line x1="12" y1="21" x2="12" y2="23"/>
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
        <line x1="1" y1="12" x2="3" y2="12"/>
        <line x1="21" y1="12" x2="23" y2="12"/>
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
      </svg>
    ),
  },
  {
    path: '/configuracion/idioma',
    titleKey: 'idioma',
    grupo: 'cuenta' as const,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={colors.primaryDeep} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="2" y1="12" x2="22" y2="12"/>
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
      </svg>
    ),
  },
  {
    path: '/configuracion/ayuda',
    titleKey: 'ayuda',
    grupo: 'soporte' as const,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={colors.primaryDeep} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    ),
  },
];

// Orden de aparición de los grupos — separado de OPCIONES para no depender
// del orden en que aparece cada item ahí.
const GRUPOS = ['negocio', 'cuenta', 'soporte'] as const;

export default function ConfiguracionPage() {
  const router = useRouter();
  const t = useTranslations('configuracion.ConfiguracionPage');

  return (
    // AgendaThemeScope acá, no en un layout.tsx del segmento: /configuracion
    // es un índice con hermanos (gastos, servicios, etc.) todavía sin migrar
    // al sistema agendaColors — un layout.tsx en configuracion/ scopearía
    // .agenda-light/.agenda-dark también a esas rutas hijas, que siguen
    // leyendo theme/colors.ts. Scope acotado a este único componente hasta
    // que el resto del módulo migre.
    <AgendaThemeScope>
      <div style={{ minHeight: '100vh', backgroundColor: colors.background, paddingBottom: 100 }}>
        <div style={{ padding: '24px 20px 12px' }}>
          <h1 style={{ fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 26, lineHeight: 1.15, color: colors.textStrong, margin: 0 }}>{t('title')}</h1>
        </div>

        <div style={{ padding: '10px 20px', display: 'flex', flexDirection: 'column', gap: 22 }}>
          {GRUPOS.map(grupo => {
            const items = OPCIONES.filter(op => op.grupo === grupo);
            return (
              <div key={grupo}>
                <p style={{
                  fontSize: 12, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase',
                  color: colors.subtext, margin: '0 0 8px 4px',
                }}>
                  {t(`group_${grupo}`)}
                </p>
                <div style={{
                  backgroundColor: colors.surface, border: `1px solid ${colors.border}`,
                  boxShadow: shadows.card, borderRadius: 14, overflow: 'hidden',
                }}>
                  {items.map((op, i) => (
                    <button
                      key={op.path}
                      onClick={() => router.push(op.path)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 14, width: '100%',
                        backgroundColor: 'transparent', border: 'none',
                        borderBottom: i < items.length - 1 ? `1px solid ${colors.border}` : 'none',
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
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AgendaThemeScope>
  );
}
