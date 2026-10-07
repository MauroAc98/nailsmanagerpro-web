'use client';

import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { linkReserva } from '@/lib/reservaOnline/linkPublico';
import { senaConfigurada } from '@/lib/senaPreview';
import { FilaAvisosReservas } from '@/components/perfil/FilaAvisosReservas';
import { useAuthStore } from '@/store/useAuthStore';
import { agendaColors as colors } from '@/theme/agendaColors';
import { LinkCompartir } from './LinkCompartir';
import { Tarjeta } from './ui';

// Cuerpo de Configuracion > Reservas online. `slug` es el del salon.
//
// Esta pantalla solo se abre con la reserva online ya activada por el equipo
// (ver la pagina), asi que no tiene interruptor propio: el que habia era un
// mock guardado en el navegador que no controlaba nada real (el backend solo
// mira el add-on y la suscripcion), y mantenia oculto el link aunque ya
// estuviera activa. El link, el QR y los botones de compartir se ven siempre.
//
// Tampoco hay tarjeta de Mercado Pago ni ajustes numericos: la cuenta de MP la
// conecta a mano el equipo de Turnetto y la seña real se configura en Perfil >
// Seña y pagos; aca solo se muestra cual es la vigente y se ofrece cambiarla.
export function ReservasOnlineSettings({ slug }: { slug: string }) {
  const t = useTranslations('reservaOnline.settings');
  const locale = useLocale();
  const numero = locale === 'es' ? 'es-AR' : locale;
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  // Base configurable (ej. https://reservar.turnetto.com); sin ella, `${origin}/reservar` (dev).
  const url = linkReserva(slug, {
    base: process.env.NEXT_PUBLIC_RESERVA_BASE_URL,
    origin: typeof window === 'undefined' ? '' : window.location.origin,
  });

  const configurada = !!user && senaConfigurada(user);
  const resumen = !user || !configurada
    ? t('senaSinConfigurar')
    : user.sena_tipo === 'porcentaje'
      ? t('senaActualPorcentaje', { pct: user.sena_porcentaje ?? 0 })
      : t('senaActualFijo', { monto: `$${new Intl.NumberFormat(numero, { maximumFractionDigits: 2 }).format(Number(user.sena_monto ?? 0))}` });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <LinkCompartir url={url} />

      <Tarjeta estilo={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ fontSize: 14, color: colors.strong, lineHeight: 1.4, minWidth: 0 }}>{resumen}</div>
        <button
          type="button"
          onClick={() => router.push('/perfil?sheet=senaYPagos')}
          style={{
            flexShrink: 0, minHeight: 44, padding: '0 14px', borderRadius: 10, border: `1px solid ${colors.border}`,
            background: 'transparent', fontSize: 13, fontWeight: 600, color: colors.primaryDeep, cursor: 'pointer',
          }}
        >
          {configurada ? t('cambiarSena') : t('configurarSena')}
        </button>
      </Tarjeta>

      {/* Avisos al celular de cada reserva nueva: solo tienen sentido con la
          reserva online activa, por eso viven acá y no sueltos en Perfil. */}
      <Tarjeta estilo={{ padding: 0 }}>
        <FilaAvisosReservas />
      </Tarjeta>
    </div>
  );
}
