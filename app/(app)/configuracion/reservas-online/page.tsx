'use client';

import { notFound } from 'next/navigation';
import { useTranslations } from 'next-intl';
import BackButton from '@/components/BackButton';
import { ContactanosReservaOnline } from '@/components/reservaOnline/ContactanosReservaOnline';
import { ReservasOnlineSettings } from '@/components/reservaOnline/ReservasOnlineSettings';
import { reservaOnlineActivaParaNegocio } from '@/lib/reservaOnline/activa';
import { reservaOnlineHabilitada } from '@/lib/reservaOnline/flag';
import { useAuthStore } from '@/store/useAuthStore';
import { agendaColors as colors, agendaFontSerif } from '@/theme/agendaColors';

// Configuracion > Reservas online (mockup ConfigReservas). Con la flag apagada
// la ruta responde 404 (decision D4), igual que el flujo publico. Con la flag
// prendida pero sin el add-on del negocio, se ofrece contactar al equipo.
export default function ReservasOnlinePage() {
  const t = useTranslations('reservaOnline.settings');
  const user = useAuthStore((s) => s.user);
  const slug = user?.slug;
  if (!reservaOnlineHabilitada()) notFound();

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.background, paddingBottom: 100 }}>
      <div style={{ padding: '20px 20px 4px' }}>
        <BackButton />
      </div>
      <div style={{ padding: '4px 20px 12px' }}>
        <h1 style={{ fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 26, lineHeight: 1.15, color: colors.textStrong, margin: 0 }}>
          {t('title')}
        </h1>
        <div style={{ fontSize: 14, color: colors.subtext, marginTop: 4 }}>{t('subtitle')}</div>
      </div>
      <div style={{ padding: '0 20px' }}>{reservaOnlineActivaParaNegocio(user) ? slug && <ReservasOnlineSettings slug={slug} /> : <ContactanosReservaOnline />}</div>
    </div>
  );
}
