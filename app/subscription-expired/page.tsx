'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { colors } from '@/theme/colors';

export default function SubscriptionExpiredPage() {
  const router = useRouter();
  const { supportInfo, logout } = useAuth();

  const handleWhatsApp = () => {
    if (!supportInfo?.whatsapp) return;
    const number = supportInfo.whatsapp.replace(/\D/g, '');
    const message = encodeURIComponent('Hola! Quiero renovar mi suscripción de Nailsmanagerpro.');
    window.open(`https://wa.me/${number}?text=${message}`, '_blank');
  };

  const handleEmail = () => {
    if (!supportInfo?.email) return;
    window.location.href = `mailto:${supportInfo.email}?subject=Renovar suscripción Nailsmanagerpro`;
  };

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', backgroundColor: colors.background, paddingTop: 60, paddingBottom: 60, paddingLeft: 28, paddingRight: 28 }}>

      {/* Contenido central */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
        
        {/* Ícono */}
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth="2" style={{ marginBottom: 20 }}>
          <rect x="3" y="11" width="18" height="11" rx="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>

        {/* Título */}
        <h1 style={{ fontSize: 24, fontWeight: 'bold', color: colors.text, marginTop: 20, marginBottom: 12, textAlign: 'center', margin: 0 }}>
          Tu suscripción venció
        </h1>

        {/* Subtítulo */}
        <p style={{ fontSize: 14, color: '#999', textAlign: 'center', lineHeight: 1.6, marginBottom: 8, margin: 0, marginTop: 12, maxWidth: 320 }}>
          Para continuar usando Nailsmanagerpro necesitás renovar tu suscripción. Contactanos y te ayudamos.
        </p>

        {/* Botones */}
        <div style={{ width: '100%', marginTop: 32, display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* WhatsApp Button */}
          <button
            onClick={handleWhatsApp}
            disabled={!supportInfo?.whatsapp}
            style={{
              backgroundColor: '#25D366',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              paddingTop: 14,
              paddingBottom: 14,
              borderRadius: 10,
              border: 'none',
              cursor: supportInfo?.whatsapp ? 'pointer' : 'not-allowed',
              gap: 10,
              opacity: supportInfo?.whatsapp ? 1 : 0.6,
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#fff' }}>
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.67-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.076 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421-7.403h-.004a9.87 9.87 0 00-4.783 1.14L4.08 3.86 5.239 8.35c-.788 1.356-1.24 2.923-1.24 4.581 0 4.444 3.645 8.426 8.127 8.426 2.205 0 4.281-.824 5.83-2.304 1.547-1.48 2.399-3.519 2.399-5.631 0-4.445-3.646-8.426-8.127-8.426"/>
            </svg>
            <span style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>Renovar por WhatsApp</span>
          </button>

          {/* Email Button */}
          <button
            onClick={handleEmail}
            disabled={!supportInfo?.email}
            style={{
              borderWidth: 1.5,
              borderColor: colors.primary,
              borderStyle: 'solid',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              paddingTop: 14,
              paddingBottom: 14,
              borderRadius: 10,
              backgroundColor: 'transparent',
              cursor: supportInfo?.email ? 'pointer' : 'not-allowed',
              gap: 10,
              opacity: supportInfo?.email ? 1 : 0.6,
              border: `1.5px solid ${colors.primary}`,
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
            <span style={{ color: colors.primary, fontSize: 15, fontWeight: '600' }}>Enviar un email</span>
          </button>
        </div>
      </div>

      {/* Logout Button */}
      <button
        onClick={handleLogout}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: colors.subtext,
          fontSize: 14,
          fontWeight: '600',
          padding: 12,
          alignSelf: 'center',
        }}
      >
        Cerrar sesión
      </button>
    </div>
  );
}