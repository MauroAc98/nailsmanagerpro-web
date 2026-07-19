'use client';

import { useAuth } from '@/hooks/useAuth';
import { colors } from '@/theme/colors';

// ─────────────────────────────────────────────
// SubscriptionWarningBanner — mismo criterio que el equivalente de RN
// (src/components/common/SubscriptionWarningBanner.tsx): oculto salvo que
// falten subscription_warning_days días o menos para el vencimiento, estilo
// "urgente" (rojo) a partir de 3 días. Nunca se muestra para cuentas exentas
// (daysLeft viene null en ese caso, ver AuthController::subscriptionStatus).
// ─────────────────────────────────────────────
export function SubscriptionWarningBanner() {
  const { daysLeft, supportInfo } = useAuth();

  const warningDays = supportInfo?.subscription_warning_days ?? 15;

  if (daysLeft === null || daysLeft > warningDays) return null;

  const isUrgent = daysLeft <= 3;

  const handleWhatsApp = () => {
    if (!supportInfo?.whatsapp) return;
    const numero = supportInfo.whatsapp.replace(/\D/g, '');
    const mensaje = encodeURIComponent('Hola! Quiero renovar mi suscripción de Nailsmanagerpro.');
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
          ? 'Tu suscripción vence hoy'
          : `Tu suscripción vence en ${daysLeft} día${daysLeft === 1 ? '' : 's'}`}
      </span>
      <button
        onClick={handleWhatsApp}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          fontSize: 13, fontWeight: 700, textDecoration: 'underline',
          color: isUrgent ? colors.danger : colors.warningFg,
        }}
      >
        Renovar
      </button>
    </div>
  );
}
