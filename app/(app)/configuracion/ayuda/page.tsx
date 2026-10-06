'use client';

import { CONTENT_BOTTOM_PADDING } from '@/constants/layout';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import BackButton from '@/components/BackButton';
import { agendaColors as colors, agendaShadows as shadows, agendaFontSerif } from '@/theme/agendaColors';

// ─────────────────────────────────────────────
// IDs estables — no dependen del texto traducido (el título se usaba antes
// como key de estado; ahora que el título viene de i18n, un id fijo evita
// que cambiar la traducción rompa qué sección queda abierta).
//
// Agrupados por tema (2026-10-01, antes era una lista plana de 16 ítems sin
// ningún orden temático — feedback: "está muy suelta"). De paso se suman
// 3 pantallas que ya existían en la app pero no tenían ninguna mención acá
// (bloqueos, categories, incomes) y se actualiza el contenido de varias que
// había quedado desactualizado (professionals, whatsappMessages, myProfile).
// Reserva online queda afuera a propósito: la flag NEXT_PUBLIC_RESERVA_ONLINE
// está apagada en producción, documentar un feature que nadie puede ver en
// su app generaría más confusión que ayuda.
// ─────────────────────────────────────────────
const GROUPS = [
  { id: 'onboarding', sectionIds: ['gettingStarted', 'initialSetup'] },
  { id: 'agenda', sectionIds: ['bookingAppointment', 'bloqueos', 'instagramStory'] },
  { id: 'servicesPricing', sectionIds: ['services', 'categories', 'priceStory'] },
  { id: 'clientsAndTeam', sectionIds: ['clients', 'professionals', 'availableSlots'] },
  { id: 'whatsapp', sectionIds: ['whatsappLink', 'whatsappMessages'] },
  { id: 'statsAndMoney', sectionIds: ['statistics', 'pendingPayments', 'incomes', 'expenses'] },
  { id: 'myBusiness', sectionIds: ['myProfile', 'appearance', 'language'] },
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

  const textoDe = (id: string) => ({
    id,
    titulo: t(`sections.${id}.title`),
    texto: t(`sections.${id}.text`),
  });

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.background, paddingBottom: CONTENT_BOTTOM_PADDING }}>
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

      <div style={{ padding: '10px 20px 0', display: 'flex', flexDirection: 'column', gap: 22 }}>
        {GROUPS.map(group => (
          <div key={group.id}>
            <p style={{
              margin: '0 0 10px 2px', fontSize: 11, fontWeight: 700, color: colors.primaryDeep,
              letterSpacing: 1, textTransform: 'uppercase',
            }}>
              {t(`groups.${group.id}`)}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {group.sectionIds.map(id => {
                const s = textoDe(id);
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
        ))}
      </div>
    </div>
  );
}
