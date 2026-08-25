'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import BackButton from '@/components/BackButton';
import { agendaColors as colors, agendaShadows as shadows, agendaFontSerif } from '@/theme/agendaColors';

// ─────────────────────────────────────────────
// IDs estables — no dependen del texto traducido (el título se usaba antes
// como key de estado; ahora que el título viene de i18n, un id fijo evita
// que cambiar la traducción rompa qué sección queda abierta).
// ─────────────────────────────────────────────
const SECTION_IDS = [
  'gettingStarted',
  'initialSetup',
  'bookingAppointment',
  'services',
  'priceStory',
  'availableSlots',
  'clients',
  'professionals',
  'instagramStory',
  'whatsappLink',
  'whatsappMessages',
  'myProfile',
  'statistics',
  'pendingPayments',
  'appearance',
  'language',
] as const;

function IconChevron({ abierto }: { abierto: boolean }) {
  return (
    <svg
      width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.muted} strokeWidth="2"
      style={{ transform: abierto ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export default function AyudaPage() {
  const t = useTranslations('configuracion.AyudaPage');
  const [abierta, setAbierta] = useState<string | null>(null);

  const secciones = SECTION_IDS.map(id => ({
    id,
    titulo: t(`sections.${id}.title`),
    texto: t(`sections.${id}.text`),
  }));

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.background, paddingBottom: 40 }}>
      {/* Header — BackButton en su propia fila, h1 serif debajo (mismo
          patrón que el resto de las pantallas migradas). */}
      <div style={{ padding: '20px 20px 4px' }}>
        <BackButton />
      </div>
      <div style={{ padding: '4px 20px 12px' }}>
        <h1 style={{ fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 26, lineHeight: 1.15, color: colors.textStrong, margin: 0 }}>{t('title')}</h1>
      </div>

      <div style={{ padding: '0 20px 8px' }}>
        <p style={{ fontSize: 13, color: colors.subtext, margin: 0 }}>
          {t('subtitle')}
        </p>
      </div>

      <div style={{ padding: '10px 20px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {secciones.map(s => {
          const abierto = abierta === s.id;
          return (
            <div
              key={s.id}
              style={{
                backgroundColor: colors.surface, border: `1px solid ${colors.border}`,
                boxShadow: shadows.card, borderRadius: 14, overflow: 'hidden',
              }}
            >
              <button
                onClick={() => setAbierta(abierto ? null : s.id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: 10, padding: '14px 16px', border: 'none', backgroundColor: 'transparent',
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                <span style={{ fontSize: 15, fontWeight: 600, color: colors.text }}>{s.titulo}</span>
                <IconChevron abierto={abierto} />
              </button>
              {abierto && (
                <p style={{
                  margin: 0, padding: '0 16px 16px', fontSize: 13.5, color: colors.subtext, lineHeight: 1.6,
                  whiteSpace: 'pre-line',
                }}>
                  {s.texto}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
