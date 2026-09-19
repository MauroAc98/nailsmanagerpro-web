'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { getService } from '@/lib/reservaOnline';
import { linkReserva } from '@/lib/reservaOnline/linkPublico';
import type { ReservaOnlineSettings as Ajustes } from '@/lib/reservaOnline/types';
import { agendaColors as colors } from '@/theme/agendaColors';
import { useCarga } from './hooks';
import { LinkCompartir } from './LinkCompartir';
import { MpConnectionCard } from './MpConnectionCard';
import { Mensaje, Tarjeta } from './ui';

// Fila numerica editable: guarda al salir del campo; vacio/0/no numerico se
// descarta y vuelve al valor guardado. `key={valor}` en el uso remonta la fila
// cuando el valor persistido cambia (sin efecto de sincronizacion).
function FilaAjuste({
  id,
  etiqueta,
  valor,
  sufijo,
  onGuardar,
}: {
  id: string;
  etiqueta: string;
  valor: number;
  sufijo: string;
  onGuardar: (n: number) => void;
}) {
  const [borrador, setBorrador] = useState(String(valor));
  const confirmar = () => {
    const n = Number(borrador);
    if (!Number.isFinite(n) || n <= 0) {
      setBorrador(String(valor));
      return;
    }
    if (n !== valor) onGuardar(n);
  };
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', gap: 12 }}>
      <label htmlFor={id} style={{ fontSize: 14, color: colors.text }}>{etiqueta}</label>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 700, color: colors.strong }}>
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={1}
          value={borrador}
          onChange={(e) => setBorrador(e.target.value)}
          onBlur={confirmar}
          style={{
            width: 72, height: 36, textAlign: 'right', borderRadius: 8, padding: '0 8px',
            border: `1px solid ${colors.border}`, background: colors.surface, color: colors.strong, fontSize: 14, fontWeight: 700,
          }}
        />
        <span style={{ fontSize: 13, fontWeight: 400, color: colors.sub, minWidth: 28 }}>{sufijo}</span>
      </span>
    </div>
  );
}

// Cuerpo de Configuracion > Reservas online (mockup ConfigReservas). Todo
// contra el mock de settings/MP del servicio (slice 1). `slug` es el del salon.
export function ReservasOnlineSettings({ slug }: { slug: string }) {
  const t = useTranslations('reservaOnline');
  const { data, error, reintentar } = useCarga(async () => {
    const svc = getService();
    const [ajustes, mp] = await Promise.all([svc.getSettings(), svc.getMpConnection()]);
    return { ajustes, mp };
  }, 'settings');
  const [avisoMp, setAvisoMp] = useState(false);

  if (error) return <Mensaje tono="error">{t('errores.generico')}</Mensaje>;
  if (!data) return <Mensaje>{t('comun.cargando')}</Mensaje>;

  const { ajustes, mp } = data;
  const guardar = async (patch: Partial<Ajustes>) => {
    await getService().saveSettings(patch);
    reintentar();
  };
  const alternar = () => {
    if (!ajustes.habilitada && !mp.conectada) {
      setAvisoMp(true);
      return;
    }
    setAvisoMp(false);
    void guardar({ habilitada: !ajustes.habilitada });
  };
  const cambiarMp = async (accion: 'connectMp' | 'disconnectMp') => {
    await getService()[accion]();
    setAvisoMp(false);
    reintentar();
  };

  // Base configurable (ej. https://reservar.turnetto.com); sin ella, `${origin}/reservar` (dev).
  const url = linkReserva(slug, {
    base: process.env.NEXT_PUBLIC_RESERVA_BASE_URL,
    origin: window.location.origin,
  });
  const separador = { height: 1, background: colors.border, margin: '6px 0' };

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
        {avisoMp && <Mensaje tono="error">{t('settings.necesitaMp')}</Mensaje>}
      </Tarjeta>

      <LinkCompartir url={url} habilitado={ajustes.habilitada && mp.conectada} />

      <MpConnectionCard mp={mp} onConnect={() => cambiarMp('connectMp')} onDisconnect={() => cambiarMp('disconnectMp')} />

      <Tarjeta estilo={{ padding: '14px 16px' }}>
        <FilaAjuste
          key={`d${ajustes.deposito}`}
          id="ro-deposito"
          etiqueta={t('settings.senia')}
          valor={ajustes.deposito}
          sufijo="$"
          onGuardar={(n) => guardar({ deposito: n })}
        />
        <div style={separador} />
        <FilaAjuste
          key={`p${ajustes.ventanaPagoMinutos}`}
          id="ro-pago"
          etiqueta={t('settings.ventanaPago')}
          valor={ajustes.ventanaPagoMinutos}
          sufijo="min"
          onGuardar={(n) => guardar({ ventanaPagoMinutos: n })}
        />
        <div style={separador} />
        <FilaAjuste
          key={`a${ajustes.anticipacionMinutos}`}
          id="ro-antelacion"
          etiqueta={t('settings.anticipacion')}
          valor={ajustes.anticipacionMinutos / 60}
          sufijo="h"
          onGuardar={(h) => guardar({ anticipacionMinutos: Math.round(h * 60) })}
        />
        <div style={separador} />
        <FilaAjuste
          key={`c${ajustes.ventanaCancelacionHoras}`}
          id="ro-cancelacion"
          etiqueta={t('settings.cancelacion')}
          valor={ajustes.ventanaCancelacionHoras}
          sufijo="h"
          onGuardar={(n) => guardar({ ventanaCancelacionHoras: n })}
        />
      </Tarjeta>
    </div>
  );
}
