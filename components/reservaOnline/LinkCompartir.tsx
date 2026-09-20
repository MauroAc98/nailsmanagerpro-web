'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { linkReservaCorto } from '@/lib/reservaOnline/linkPublico';
import { agendaColors as colors } from '@/theme/agendaColors';
import { IcoGlobo } from './iconos';
import { QrLinkModal } from './QrLinkModal';
import { Etiqueta, Tarjeta } from './ui';

const boton = {
  flex: 1,
  height: 40,
  borderRadius: 10,
  border: `1px solid ${colors.border}`,
  background: 'transparent',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 13,
  fontWeight: 600,
  color: colors.primaryDeep,
  cursor: 'pointer',
  textDecoration: 'none',
} as const;

// Link para compartir: copiar, enviar por WhatsApp o ver como QR (el QR se
// genera perezosamente, solo mientras QrLinkModal esta abierto).
// `habilitado` = reservas activas Y Mercado Pago conectado (decision S12).
export function LinkCompartir({ url, habilitado }: { url: string; habilitado: boolean }) {
  const t = useTranslations('reservaOnline.settings');
  const [copiado, setCopiado] = useState(false);
  const [mostrarQr, setMostrarQr] = useState(false);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // sin permiso de portapapeles el link sigue visible para copiarlo a mano
    }
  };

  return (
    <Tarjeta>
      <Etiqueta>{t('linkTitulo')}</Etiqueta>
      {habilitado ? (
        <>
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 8, minHeight: 44, borderRadius: 10, background: colors.surface2,
              padding: '0 12px', fontSize: 13.5, color: colors.strong, wordBreak: 'break-all',
            }}
          >
            <IcoGlobo color={colors.primaryDeep} />
            <span style={{ flex: 1 }}>{linkReservaCorto(url)}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button type="button" onClick={copiar} style={boton}>
              {copiado ? t('copiado') : t('copiar')}
            </button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(t('mensajeWhatsapp', { link: url }))}`}
              target="_blank"
              rel="noopener noreferrer"
              style={boton}
            >
              {t('enviar')}
            </a>
            <button type="button" onClick={() => setMostrarQr(true)} style={boton}>
              {t('verQr')}
            </button>
          </div>
          {mostrarQr && <QrLinkModal url={url} onClose={() => setMostrarQr(false)} />}
        </>
      ) : (
        <div style={{ fontSize: 13, color: colors.sub, lineHeight: 1.5 }}>{t('linkBloqueado')}</div>
      )}
    </Tarjeta>
  );
}
