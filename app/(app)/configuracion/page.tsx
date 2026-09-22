'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { agendaColors as colors, agendaShadows as shadows, agendaFontSerif } from '@/theme/agendaColors';
import { AgendaThemeScope } from '@/components/AgendaThemeScope';

// Antes esta pantalla tenía 11 items en 3 grupos sin relación clara entre sí
// (Gastos, Estadísticas, Apariencia, Idioma, Ayuda no tienen nada que ver con
// "configurar" en el sentido que le da su nombre). Se redujo a su propósito
// original: lo que hace falta cargado ANTES de poder agendar un turno. Todo
// lo demás se mudó a /perfil ("Mi negocio") — Reservas online y Seña y pagos
// quedaron juntas ahí, Gastos/Ingresos/Estadísticas bajo "Finanzas".
const OPCIONES = [
  {
    path: '/configuracion/servicios',
    titleKey: 'servicios',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={colors.primaryDeep} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    ),
  },
  {
    path: '/configuracion/slots',
    titleKey: 'slots',
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
    path: '/configuracion/bloqueos',
    titleKey: 'bloqueos',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={colors.primaryDeep} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
        <line x1="8" y1="14" x2="16" y2="18"/>
      </svg>
    ),
  },
];

export default function ConfiguracionPage() {
  const router = useRouter();
  const t = useTranslations('configuracion.ConfiguracionPage');

  return (
    // AgendaThemeScope acá, no en un layout.tsx del segmento: /configuracion
    // es un índice con hermanos (servicios, etc.) todavía sin migrar
    // al sistema agendaColors — un layout.tsx en configuracion/ scopearía
    // .agenda-light/.agenda-dark también a esas rutas hijas, que siguen
    // leyendo theme/colors.ts. Scope acotado a este único componente hasta
    // que el resto del módulo migre.
    <AgendaThemeScope>
      <div style={{ minHeight: '100vh', backgroundColor: colors.background, paddingBottom: 100 }}>
        <div style={{ padding: '24px 20px 4px' }}>
          <h1 style={{ fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 26, lineHeight: 1.15, color: colors.textStrong, margin: 0 }}>{t('title')}</h1>
          <div style={{ fontSize: 13, color: colors.subtext, marginTop: 6, lineHeight: 1.4 }}>{t('subtitle')}</div>
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
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
            ))}
          </div>
        </div>
      </div>
    </AgendaThemeScope>
  );
}
