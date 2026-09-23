'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { getService } from '@/lib/reservaOnline';
import { rutaPaso } from '@/lib/reservaOnline/rutas';
import { ReservaOnlineError } from '@/lib/reservaOnline/service';
import { esWhatsappE164, localDeWhatsapp, whatsappArgentino } from '@/lib/reservaOnline/whatsappE164';
import { useReservaOnlineStore } from '@/store/useReservaOnlineStore';
import { agendaColors as colors } from '@/theme/agendaColors';
import { useGuardaPaso, useHold, type Ir } from './hooks';
import { HoldVencido } from './HoldVencido';
import { NoDisponibleAun } from './NoDisponibleAun';
import { BarraInferior, BotonPrimario, HoldPill, Mensaje, PasoHeader } from './ui';

const NOTA_MAX = 300;

const cajaCampo = {
  width: '100%',
  minHeight: 52,
  borderRadius: 14,
  background: colors.surface,
  border: `1px solid ${colors.border}`,
  padding: '0 14px',
  fontSize: 16,
  color: colors.strong,
  boxSizing: 'border-box' as const,
};
const campo = { ...cajaCampo, height: 52 };
const etiqueta = { display: 'block', fontSize: 13, fontWeight: 600, color: colors.text, marginBottom: 6 };
const ayuda = { fontSize: 12, color: colors.sub, marginTop: 6, lineHeight: 1.4 };

// Pantalla 4: datos de la clienta. El WhatsApp es de Argentina con prefijo fijo
// "+54 9": ella tipea el numero local y se guarda normalizado (E.164). "Contanos
// tu idea" es opcional. Al continuar los datos se guardan sobre el hold; si el
// hold vencio se muestra "Se liberó tu horario". `ahora`/`cadaMs` inyectables.
export function DatosScreen({
  slug,
  ir,
  ahora = Date.now,
  cadaMs = 1000,
}: {
  slug: string;
  ir: Ir;
  ahora?: () => number;
  cadaMs?: number;
}) {
  const t = useTranslations('reservaOnline');
  const listo = useGuardaPaso(slug, 'datos', ir);
  const cliente = useReservaOnlineStore((s) => s.cliente);
  const nota = useReservaOnlineStore((s) => s.nota);
  const setCliente = useReservaOnlineStore((s) => s.setCliente);
  const setNota = useReservaOnlineStore((s) => s.setNota);
  const { hold, restanteMs, vencido } = useHold(ahora, cadaMs);
  // Lo tipeado (con espacios); null = todavia no toco el campo, se deriva del store.
  const [whatsappCrudo, setWhatsappCrudo] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [holdPerdido, setHoldPerdido] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState(false);
  const [limiteIntentos, setLimiteIntentos] = useState(false);
  // Telefono con una reserva reciente sin pagar (minutos restantes) o
  // pendiente de verificar por WhatsApp (decision A4 del diseno).
  const [avisoTelefono, setAvisoTelefono] = useState<{ tipo: 'phone_cooldown'; minutos: number } | { tipo: 'verification_required' } | null>(null);
  // Kill switch del backend apagado: a pantalla completa, como en Horario.
  const [noDisponible, setNoDisponible] = useState(false);

  if (!listo) return null;
  if (noDisponible) return <NoDisponibleAun />;
  if (vencido || holdPerdido) return <HoldVencido slug={slug} ir={ir} />;

  const whatsappVisible = whatsappCrudo ?? localDeWhatsapp(cliente.whatsapp);
  const whatsappValido = esWhatsappE164(cliente.whatsapp);
  const mostrarError = whatsappVisible.length > 0 && !whatsappValido;
  const completo = cliente.nombre.trim() !== '' && cliente.apellido.trim() !== '' && whatsappValido;

  const continuar = async () => {
    if (!hold) return;
    setEnviando(true);
    setErrorGuardar(false);
    setLimiteIntentos(false);
    setAvisoTelefono(null);
    try {
      await getService().actualizarDatosReserva(slug, hold.reservaId, {
        cliente,
        nota: nota.trim() || undefined,
      });
      ir(rutaPaso(slug, 'resumen'));
    } catch (e) {
      if (e instanceof ReservaOnlineError && e.code === 'hold_expired') setHoldPerdido(true);
      else if (e instanceof ReservaOnlineError && e.code === 'creation_disabled') setNoDisponible(true);
      else if (e instanceof ReservaOnlineError && e.code === 'phone_cooldown') {
        setAvisoTelefono({ tipo: 'phone_cooldown', minutos: Math.ceil((e.retryAfterSeconds ?? 0) / 60) });
      } else if (e instanceof ReservaOnlineError && e.code === 'verification_required') {
        setAvisoTelefono({ tipo: 'verification_required' });
      } else if (e instanceof ReservaOnlineError && e.code === 'rate_limited') {
        // Bug real: caia al error generico ("Ocurrio un error") en vez del
        // aviso especifico que ya usan Horario/Resumen para el mismo codigo.
        setLimiteIntentos(true);
      } else {
        setErrorGuardar(true);
      }
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div>
      <PasoHeader
        titulo={t('datos.title')}
        subtitulo={t('datos.subtitle')}
        paso={3}
        onVolver={() => ir(rutaPaso(slug, 'horario'))}
        pill={<HoldPill restanteMs={restanteMs} />}
      />
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <label htmlFor="ro-nombre" style={etiqueta}>{t('datos.nombre')}</label>
          <input
            id="ro-nombre"
            autoComplete="given-name"
            style={campo}
            value={cliente.nombre}
            onChange={(e) => setCliente({ nombre: e.target.value })}
          />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
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
        <div style={{ ...cajaCampo, display: 'flex', alignItems: 'center' }}>
          <span
            style={{
              paddingRight: 10, marginRight: 10, borderRight: `1px solid ${colors.border}`,
              fontSize: 15, fontWeight: 600, color: colors.strong, whiteSpace: 'nowrap',
            }}
          >
            +54 9
          </span>
          <input
            id="ro-whatsapp"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="376 512 3456"
            style={{ flex: 1, minWidth: 0, height: 50, border: 'none', outline: 'none', background: 'transparent', fontSize: 16, color: colors.strong }}
            value={whatsappVisible}
            onChange={(e) => {
              setWhatsappCrudo(e.target.value);
              setCliente({ whatsapp: whatsappArgentino(e.target.value) });
            }}
          />
        </div>
        {mostrarError ? (
          <Mensaje tono="error">{t('errores.whatsappInvalido')}</Mensaje>
        ) : (
          <div style={ayuda}>{t('datos.whatsappAyuda')}</div>
        )}
      </div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
          <label htmlFor="ro-nota" style={{ ...etiqueta, marginBottom: 0 }}>{t('datos.notaLabel')}</label>
          <span style={{ fontSize: 13, color: colors.muted, fontWeight: 500 }}>{t('datos.opcional')}</span>
        </div>
        <textarea
          id="ro-nota"
          maxLength={NOTA_MAX}
          placeholder={t('datos.notaPlaceholder')}
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          style={{
            ...cajaCampo, height: 92, minHeight: 92, padding: '12px 14px', fontSize: 15, lineHeight: 1.4,
            fontFamily: 'inherit', resize: 'none',
          }}
        />
        <div style={ayuda}>{t('datos.notaAyuda')}</div>
      </div>
      <div style={{ fontSize: 12.5, color: colors.sub, lineHeight: 1.5, marginTop: 4 }}>{t('datos.privacidad')}</div>
      {avisoTelefono?.tipo === 'phone_cooldown' && (
        <Mensaje tono="error">{t('errores.telefonoEnfriamiento', { minutos: avisoTelefono.minutos })}</Mensaje>
      )}
      {avisoTelefono?.tipo === 'verification_required' && <Mensaje tono="error">{t('errores.verificacionRequerida')}</Mensaje>}
      {limiteIntentos && <Mensaje tono="error">{t('errores.limiteIntentos')}</Mensaje>}
      {errorGuardar && <Mensaje tono="error">{t('errores.generico')}</Mensaje>}

      <BarraInferior>
        <BotonPrimario disabled={!completo || enviando} onClick={continuar}>
          {t('comun.continuar')}
        </BotonPrimario>
      </BarraInferior>
    </div>
  );
}
