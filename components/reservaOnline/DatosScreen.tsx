'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { esWhatsappE164, normalizarWhatsappE164 } from '@/lib/reservaOnline/whatsappE164';
import { rutaPaso } from '@/lib/reservaOnline/rutas';
import { useReservaOnlineStore } from '@/store/useReservaOnlineStore';
import { agendaColors as colors } from '@/theme/agendaColors';
import { useGuardaPaso, type Ir } from './hooks';
import { BarraInferior, BotonPrimario, Mensaje, PasoHeader } from './ui';

const campo = {
  width: '100%',
  height: 50,
  borderRadius: 12,
  background: colors.surface,
  border: `1px solid ${colors.border}`,
  padding: '0 14px',
  fontSize: 16,
  color: colors.strong,
  boxSizing: 'border-box' as const,
};
const etiqueta = { display: 'block', fontSize: 13, fontWeight: 600, color: colors.text, marginBottom: 6 };

// Pantalla 4: datos de la clienta. El WhatsApp se guarda normalizado (E.164).
export function DatosScreen({ slug, ir }: { slug: string; ir: Ir }) {
  const t = useTranslations('reservaOnline');
  const listo = useGuardaPaso(slug, 'datos', ir);
  const cliente = useReservaOnlineStore((s) => s.cliente);
  const setCliente = useReservaOnlineStore((s) => s.setCliente);
  // El input conserva lo tipeado (con espacios); el store guarda la version normalizada.
  const [whatsappCrudo, setWhatsappCrudo] = useState(cliente.whatsapp);

  if (!listo) return null;

  const whatsappValido = esWhatsappE164(cliente.whatsapp);
  const mostrarError = whatsappCrudo.length > 0 && !whatsappValido;
  const completo = cliente.nombre.trim() !== '' && cliente.apellido.trim() !== '' && whatsappValido;

  return (
    <div>
      <PasoHeader titulo={t('datos.title')} paso={3} onVolver={() => ir(rutaPaso(slug, 'horario'))} />
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <label htmlFor="ro-nombre" style={etiqueta}>{t('datos.nombre')}</label>
          <input
            id="ro-nombre"
            autoComplete="given-name"
            style={campo}
            value={cliente.nombre}
            onChange={(e) => setCliente({ nombre: e.target.value })}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label htmlFor="ro-apellido" style={etiqueta}>{t('datos.apellido')}</label>
          <input
            id="ro-apellido"
            autoComplete="family-name"
            style={campo}
            value={cliente.apellido}
            onChange={(e) => setCliente({ apellido: e.target.value })}
          />
        </div>
      </div>
      <div style={{ marginBottom: 16 }}>
        <label htmlFor="ro-whatsapp" style={etiqueta}>{t('datos.whatsapp')}</label>
        <input
          id="ro-whatsapp"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+54 9 11 5555 1234"
          style={campo}
          value={whatsappCrudo}
          onChange={(e) => {
            setWhatsappCrudo(e.target.value);
            setCliente({ whatsapp: normalizarWhatsappE164(e.target.value) });
          }}
        />
        {mostrarError ? (
          <Mensaje tono="error">{t('errores.whatsappInvalido')}</Mensaje>
        ) : (
          <div style={{ fontSize: 12, color: colors.sub, marginTop: 6 }}>{t('datos.whatsappAyuda')}</div>
        )}
      </div>
      <div style={{ fontSize: 12.5, color: colors.sub, lineHeight: 1.5, marginTop: 4 }}>{t('datos.privacidad')}</div>

      <BarraInferior>
        <BotonPrimario disabled={!completo} onClick={() => ir(rutaPaso(slug, 'resumen'))}>
          {t('comun.continuar')}
        </BotonPrimario>
      </BarraInferior>
    </div>
  );
}
