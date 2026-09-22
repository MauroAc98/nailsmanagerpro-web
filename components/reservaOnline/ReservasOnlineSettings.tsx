'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { getService } from '@/lib/reservaOnline';
import { linkReserva } from '@/lib/reservaOnline/linkPublico';
import type { ReservaOnlineSettings as Ajustes } from '@/lib/reservaOnline/types';
import { agendaColors as colors } from '@/theme/agendaColors';
import { useCarga } from './hooks';
import { LinkCompartir } from './LinkCompartir';
import { Hueso, Mensaje, Tarjeta } from './ui';

// Forma del layout real (tarjeta de switch + link para compartir), para que
// no salte nada al llegar los datos.
function ReservasOnlineSettingsSkeleton() {
  return (
    <div data-testid="reservas-online-settings-skeleton" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Tarjeta estilo={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <Hueso w={140} h={15} />
            <Hueso w={70} h={12} style={{ marginTop: 8 }} />
          </div>
          <Hueso w={42} h={24} r={12} />
        </div>
      </Tarjeta>
      <Tarjeta estilo={{ padding: '14px 16px' }}>
        <Hueso w="80%" h={15} />
      </Tarjeta>
    </div>
  );
}

// Cuerpo de Configuracion > Reservas online. `slug` es el del salon.
//
// La tarjeta de conexion con Mercado Pago (OAuth) y la de ajustes numericos
// (sena, ventana de pago, antelacion, cancelacion) se sacaron de esta
// pantalla: eran una maqueta de una fase anterior del diseno que nunca se
// conecto a lo que terminamos construyendo (Fase 1: la cuenta de MP se
// conecta a mano por el equipo de Turnetto, no por OAuth desde aca) y el
// monto de "seña" de esa tarjeta era un campo mockeado, totalmente separado
// del sena_monto real de Perfil — el negocio editaba un numero que despues
// nunca se usaba para cobrar nada, lo que generaba confusion real.
export function ReservasOnlineSettings({ slug }: { slug: string }) {
  const t = useTranslations('reservaOnline');
  const router = useRouter();
  const { data, error, reintentar } = useCarga(() => getService().getSettings(), 'settings');

  if (error) return <Mensaje tono="error">{t('errores.generico')}</Mensaje>;
  if (!data) return <ReservasOnlineSettingsSkeleton />;

  const ajustes = data;
  const guardar = async (patch: Partial<Ajustes>) => {
    await getService().saveSettings(patch);
    reintentar();
  };
  const alternar = () => void guardar({ habilitada: !ajustes.habilitada });

  // Base configurable (ej. https://reservar.turnetto.com); sin ella, `${origin}/reservar` (dev).
  const url = linkReserva(slug, {
    base: process.env.NEXT_PUBLIC_RESERVA_BASE_URL,
    origin: window.location.origin,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Tarjeta estilo={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div id="ro-aceptar" style={{ fontSize: 15, fontWeight: 700, color: colors.strong }}>{t('settings.aceptar')}</div>
            <div style={{ fontSize: 12, color: colors.sub, marginTop: 2 }}>
              {ajustes.habilitada ? t('settings.activo') : t('settings.inactivo')}
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={ajustes.habilitada}
            aria-labelledby="ro-aceptar"
            onClick={alternar}
            style={{
              width: 42, height: 24, borderRadius: 12, border: 'none', padding: 0, position: 'relative', flexShrink: 0, cursor: 'pointer',
              background: ajustes.habilitada ? colors.primarySolid : colors.border,
            }}
          >
            <span
              style={{
                position: 'absolute', top: 3, width: 18, height: 18, borderRadius: 9, background: '#fff',
                left: ajustes.habilitada ? 21 : 3, transition: 'left 0.15s',
              }}
            />
          </button>
        </div>
      </Tarjeta>

      <LinkCompartir url={url} habilitado={ajustes.habilitada} />

      <Tarjeta estilo={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ fontSize: 13, color: colors.sub, lineHeight: 1.4 }}>{t('settings.senaPerfilNota')}</div>
        <button
          type="button"
          onClick={() => router.push('/perfil')}
          style={{
            flexShrink: 0, padding: '8px 14px', borderRadius: 10, border: `1px solid ${colors.border}`,
            background: 'transparent', fontSize: 13, fontWeight: 600, color: colors.primaryDeep, cursor: 'pointer',
          }}
        >
          {t('settings.irAPerfil')}
        </button>
      </Tarjeta>
    </div>
  );
}
