'use client';

import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { colors } from '@/theme/colors';

// Predicado puro reutilizado tanto acá adentro como por
// app/(app)/agenda/page.tsx (Change 2 del rediseño del home): solo el
// banner de mayor prioridad ENTRE los que aplican se renderiza a la vez, así
// que la página necesita poder preguntar "¿aplicaría este banner?" sin
// montarlo. No duplica la condición — este hook es la única fuente de verdad,
// el componente de abajo lo consume igual que antes.
export function useSubscriptionWarningVisible(): boolean {
  const { daysLeft, supportInfo } = useAuth();
  const warningDays = supportInfo?.subscription_warning_days ?? 15;
  return daysLeft !== null && daysLeft <= warningDays;
}

// ─────────────────────────────────────────────
// SubscriptionWarningBanner — mismo criterio que el equivalente de RN
// (src/components/common/SubscriptionWarningBanner.tsx): oculto salvo que
// falten subscription_warning_days días o menos para el vencimiento, estilo
// "urgente" (rojo) a partir de 3 días. Nunca se muestra para cuentas exentas
// (daysLeft viene null en ese caso, ver AuthController::subscriptionStatus).
// ─────────────────────────────────────────────
export function SubscriptionWarningBanner({ onDismiss }: { onDismiss?: () => void }) {
  const t = useTranslations('common.SubscriptionWarningBanner');
  const { daysLeft, supportInfo } = useAuth();
  const visible = useSubscriptionWarningVisible();

  // El segundo check es puramente para el narrowing de TS (visible=true ya
  // implica daysLeft !== null vía useSubscriptionWarningVisible) — no
  // reimplementa la condición de warningDays, así que no hay lógica
  // duplicada acá.
  if (!visible || daysLeft === null) return null;

  const isUrgent = daysLeft <= 3;

  const handleWhatsApp = () => {
    if (!supportInfo?.whatsapp) return;
    const numero = supportInfo.whatsapp.replace(/\D/g, '');
    const mensaje = encodeURIComponent(t('renewWhatsappMessage'));
    window.open(`https://wa.me/${numero}?text=${mensaje}`, '_blank');
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '10px 16px',
      backgroundColor: isUrgent ? colors.dangerBg : colors.warningBg,
    }}>
      <svg
        width="18" height="18" viewBox="0 0 24 24" fill="none"
        stroke={isUrgent ? colors.danger : colors.warningFg} strokeWidth="2"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: isUrgent ? colors.danger : colors.warningFg }}>
        {daysLeft === 0
          ? t('expiresToday')
          : t('expiresInDays', { days: daysLeft })}
      </span>
      <button
        onClick={handleWhatsApp}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          fontSize: 13, fontWeight: 700, textDecoration: 'underline',
          color: isUrgent ? colors.danger : colors.warningFg,
        }}
      >
        {t('renew')}
      </button>
      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label={t('dismiss')}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'none', border: 'none', cursor: 'pointer', padding: 4, flexShrink: 0,
            color: isUrgent ? colors.danger : colors.warningFg, opacity: 0.7,
          }}
        >
          <X size={14} strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}
