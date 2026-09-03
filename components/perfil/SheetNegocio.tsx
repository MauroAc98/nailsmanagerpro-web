'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { agendaColors as colors } from '@/theme/agendaColors';
import { SheetInput } from './SheetInput';
import PillToggle from '@/components/PillToggle';
import { WhatsappGlyph } from '@/components/icons/WhatsappGlyph';
import { phoneUtils } from '@/lib/phoneUtils';
import { cuerpoPlantillaWhatsapp } from '@/lib/whatsappHelper';
import {
  sanitizarLineaSimple,
  validarSenaConfig,
  formatearMontoSena,
  armarDatosCuentaSena,
  type SenaCampo,
} from '@/lib/senaConfig';

const HORAS_RECORDATORIO = ['18:00', '19:00', '20:00', '21:00', '22:00'];

type TipoPreview = 'confirmacion' | 'recordatorio';

interface Props {
  senaMonto: string;
  setSenaMonto: (v: string) => void;
  // Opt-in "pedir seña" + datos bancarios que viajan en la confirmación de
  // WhatsApp. El estado vive en el padre (perfil/page.tsx) igual que el resto
  // del sheet; acá solo se editan y se validan antes de guardar.
  whatsappPideSena: boolean;
  setWhatsappPideSena: (v: boolean) => void;
  senaTitular: string;
  setSenaTitular: (v: string) => void;
  senaEntidad: string;
  setSenaEntidad: (v: string) => void;
  senaAlias: string;
  setSenaAlias: (v: string) => void;
  senaCbu: string;
  setSenaCbu: (v: string) => void;
  confirmacionAutomatica: boolean;
  setConfirmacionAutomatica: (v: boolean) => void;
  recordatorioAutomatico: boolean;
  setRecordatorioAutomatico: (v: boolean) => void;
  horaRecordatorio: string;
  setHoraRecordatorio: (v: string) => void;
  nombreNegocio: string;
  telefonoContacto: string;
  direccionNegocio: string;
  // Errores 422 del backend ya mapeados por campo (mensaje completo en
  // castellano). Se muestran junto al input correspondiente, combinados con
  // la validación local.
  erroresServidor?: Partial<Record<SenaCampo, string>>;
  onGuardar: () => void;
  guardando: boolean;
  error: string | null;
  onClose: () => void;
}

// Renderiza *texto* en negrita, igual que WhatsApp interpreta los asteriscos
// — para que la vista previa se vea tal cual llega al chat real, no como
// texto plano con asteriscos sueltos.
function renderConNegritas(texto: string) {
  return texto.split(/(\*[^*]+\*)/g).map((parte, i) =>
    parte.startsWith('*') && parte.endsWith('*')
      ? <strong key={i}>{parte.slice(1, -1)}</strong>
      : <span key={i}>{parte}</span>
  );
}

interface DatosPreview {
  tipo: TipoPreview;
  negocio: string;
  telefono: string;
  direccion: string;
  // Cuando el salón activó "pedir seña", la confirmación real es la
  // plantilla reserva_turno_sena — el preview la muestra con estos datos.
  pideSena: boolean;
  senaMonto: string;
  senaTitular: string;
  senaEntidad: string;
  senaAlias: string;
  senaCbu: string;
}

// El texto de `confirmacion_turno` y `recordatorio_turno` sale de
// cuerpoPlantillaWhatsapp() (lib/whatsappHelper) — misma fuente que usa el
// envío manual por wa.me, así el preview y lo que realmente llega al chat no
// pueden divergir. `reserva_turno_sena` se arma acá abajo porque nunca se
// manda a mano. El backend (NailsManagerProApi) tiene su propia copia de los
// tres: si el texto cambia en Meta hay que tocar los dos lados.
//
// El nombre de la profesional es un dato de ejemplo fijo acá — este preview
// no tiene un turno real. nombreNegocio, telefono, direccion y los datos de
// seña sí son reales (vienen de la cuenta / del formulario) porque son los
// que el cliente va a ver tal cual.
function textoPreview(d: DatosPreview): string {
  const nombreCliente = 'Martina';
  const fecha = '20/08';
  const hora = '15:30';
  const servicio = 'Manicura semipermanente';
  const profesional = 'Fernanda';
  const tel = d.telefono.trim()
    ? phoneUtils.formatArWhatsapp(d.telefono)
    : '(agregá tu teléfono en Datos personales)';
  const dir = d.direccion.trim() || '(agregá tu dirección en Datos personales)';

  if (d.tipo === 'recordatorio') {
    return cuerpoPlantillaWhatsapp('recordatorio', {
      nombreCliente, negocio: d.negocio, fecha, hora,
      servicios: servicio, direccion: dir, profesional, telefono: tel,
    });
  }

  if (d.pideSena) {
    // reserva_turno_sena
    const aviso = `⚠️ Desde este número solo se envían avisos. Si respondés a este mensaje, *${profesional} no lo recibe y no puede contestarte.*`;
    const montoN = montoComoNumero(d.senaMonto);
    const monto = montoN != null && montoN > 0 ? formatearMontoSena(montoN) : '(cargá el monto de la seña)';
    const cuenta = armarDatosCuentaSena({
      titular: d.senaTitular, entidad: d.senaEntidad, alias: d.senaAlias, cbu: d.senaCbu,
    }) || '(cargá los datos de la cuenta)';
    return `Hola ${nombreCliente}, tu turno en *${d.negocio}* quedó reservado.\n\n🗓️ ${fecha} · 🕒 ${hora} hs\n✨ ${servicio}\n📍 ${dir}\n\nPara confirmar tu turno se debe abonar una seña de ${monto}.\n\n*Datos para el pago:*\n${cuenta}\n\n${aviso}\n\nComunicate al ${tel} para enviar el comprobante de la seña o por consultas y cambios de turno. Los cambios deben avisarse con al menos 24 hs de anticipación.`;
  }

  // confirmacion_turno
  return cuerpoPlantillaWhatsapp('confirmacion', {
    nombreCliente, negocio: d.negocio, fecha, hora,
    servicios: servicio, direccion: dir, profesional, telefono: tel,
  });
}

// Parsea el monto (string editable) a número para la regla de negocio.
// `undefined` = vacío/ilegible; el guardado del padre hace la validación de
// formato fina (parsearSenaMonto) — acá solo interesa si es > 0.
function montoComoNumero(texto: string): number | undefined {
  const limpio = texto.trim().replace(',', '.');
  if (limpio === '') return undefined;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : undefined;
}

function IconClose() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function IconMoney() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M15 9.5c0-1.5-1.5-2.5-3-2.5s-3 1-3 2.5 1.5 2 3 2.5 3 1 3 2.5-1.5 2.5-3 2.5-3-1-3-2.5" />
    </svg>
  );
}

function IconBank() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18M4 10h16M5 10V7l7-4 7 4v3M6 21v-8M10 21v-8M14 21v-8M18 21v-8" />
    </svg>
  );
}

export function SheetNegocio({
  senaMonto, setSenaMonto,
  whatsappPideSena, setWhatsappPideSena,
  senaTitular, setSenaTitular, senaEntidad, setSenaEntidad,
  senaAlias, setSenaAlias, senaCbu, setSenaCbu,
  confirmacionAutomatica, setConfirmacionAutomatica,
  recordatorioAutomatico, setRecordatorioAutomatico,
  horaRecordatorio, setHoraRecordatorio, nombreNegocio, telefonoContacto,
  direccionNegocio, erroresServidor, onGuardar, guardando, error, onClose,
}: Props) {
  const t = useTranslations('perfil.SheetNegocio');
  const [previewAbierto, setPreviewAbierto] = useState(false);
  const [tipoPreview, setTipoPreview] = useState<TipoPreview>('confirmacion');
  const [erroresLocales, setErroresLocales] = useState<Partial<Record<SenaCampo, string>>>({});
  const faltaDireccion = !direccionNegocio.trim();

  // Código de validación local -> mensaje traducido. Los errores del backend
  // ya llegan como string completo, así que el fallback (`?? v`) los deja pasar.
  const MENSAJES_ERROR: Record<string, string> = {
    montoRequerido: t('senaMontoRequired'),
    direccionRequerida: t('senaAddressRequired'),
    titularRequerido: t('senaTitularRequired'),
    aliasOCbuRequerido: t('senaAliasOrCbuRequired'),
  };
  const errores: Partial<Record<SenaCampo, string>> = { ...erroresServidor, ...erroresLocales };
  const textoError = (campo: SenaCampo): string | null => {
    const v = errores[campo];
    if (!v) return null;
    return MENSAJES_ERROR[v] ?? v;
  };

  const handleGuardar = () => {
    if (whatsappPideSena) {
      const errs = validarSenaConfig({
        monto: montoComoNumero(senaMonto),
        direccion: direccionNegocio,
        titular: senaTitular,
        alias: senaAlias,
        cbu: senaCbu,
      });
      if (Object.keys(errs).length > 0) {
        setErroresLocales(errs);
        return;
      }
    }
    setErroresLocales({});

    // Espeja el saneo del backend (rechaza \r\n\t y colapsa espacios en los
    // datos bancarios antes de mandarlos a Meta). El padre vuelve a sanear al
    // armar el payload — esto mantiene el estado del sheet consistente.
    const pares: [string, (v: string) => void][] = [
      [senaTitular, setSenaTitular],
      [senaEntidad, setSenaEntidad],
      [senaAlias, setSenaAlias],
      [senaCbu, setSenaCbu],
    ];
    for (const [valor, setter] of pares) {
      const limpio = sanitizarLineaSimple(valor);
      if (limpio !== valor) setter(limpio);
    }

    onGuardar();
  };

  return (
    <div style={{ padding: '4px 20px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: colors.text, margin: 0 }}>{t('title')}</h2>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <IconClose />
        </button>
      </div>

      <SheetInput
        label={t('depositAmount')}
        icon={<IconMoney />}
        value={senaMonto}
        onChange={setSenaMonto}
        placeholder="0"
        type="text"
        inputMode="decimal"
      />

      {error && (
        <p style={{ fontSize: 12, color: colors.danger, marginTop: -8, marginBottom: 16 }}>{error}</p>
      )}

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        backgroundColor: colors.surfaceSubtle, borderRadius: 12, padding: '14px 16px', marginBottom: 16,
      }}>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: colors.text }}>{t('depositRequest')}</p>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: colors.subtext }}>
            {t('depositRequestSubtitle')}
          </p>
        </div>
        <PillToggle
          value={whatsappPideSena}
          onChange={setWhatsappPideSena}
          ariaLabel={t('depositRequest')}
        />
      </div>

      {whatsappPideSena && (
        <div style={{ marginBottom: 16 }}>
          {textoError('sena_monto') && (
            <p style={{ fontSize: 12, color: colors.danger, margin: '0 0 12px', lineHeight: 1.4 }}>{textoError('sena_monto')}</p>
          )}
          {textoError('direccion') && (
            <p style={{ fontSize: 12, color: colors.danger, margin: '0 0 12px', lineHeight: 1.4 }}>{textoError('direccion')}</p>
          )}

          <SheetInput
            label={t('depositHolder')}
            icon={<IconBank />}
            value={senaTitular}
            onChange={setSenaTitular}
            placeholder={t('depositHolderPlaceholder')}
          />
          {textoError('whatsapp_sena_titular') && (
            <p style={{ fontSize: 12, color: colors.danger, margin: '-8px 0 12px', lineHeight: 1.4 }}>{textoError('whatsapp_sena_titular')}</p>
          )}

          <SheetInput
            label={t('depositBank')}
            icon={<IconBank />}
            value={senaEntidad}
            onChange={setSenaEntidad}
            placeholder={t('depositBankPlaceholder')}
          />

          <SheetInput
            label={t('depositAlias')}
            icon={<IconBank />}
            value={senaAlias}
            onChange={setSenaAlias}
            placeholder={t('depositAliasPlaceholder')}
          />

          <SheetInput
            label={t('depositCbu')}
            icon={<IconBank />}
            value={senaCbu}
            onChange={setSenaCbu}
            placeholder={t('depositCbuPlaceholder')}
            inputMode="numeric"
          />
          {textoError('whatsapp_sena_alias') && (
            <p style={{ fontSize: 12, color: colors.danger, margin: '-8px 0 8px', lineHeight: 1.4 }}>{textoError('whatsapp_sena_alias')}</p>
          )}
          <p style={{ fontSize: 12, color: colors.subtext, margin: '0 2px', lineHeight: 1.4 }}>
            {t('depositAliasOrCbuHelp')}
          </p>
        </div>
      )}

      {faltaDireccion && (
        <p style={{ fontSize: 12, color: colors.danger, marginBottom: 12, lineHeight: 1.4 }}>
          {t('addressRequiredWarning')}
        </p>
      )}

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        backgroundColor: colors.surfaceSubtle, borderRadius: 12, padding: '14px 16px', marginBottom: 16,
      }}>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: colors.text }}>{t('autoConfirmation')}</p>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: colors.subtext }}>
            {t('autoConfirmationSubtitle')}
          </p>
        </div>
        <PillToggle
          value={confirmacionAutomatica}
          onChange={setConfirmacionAutomatica}
          disabled={faltaDireccion && !confirmacionAutomatica}
          ariaLabel={t('autoConfirmation')}
        />
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        backgroundColor: colors.surfaceSubtle, borderRadius: 12, padding: '14px 16px', marginBottom: 16,
      }}>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: colors.text }}>{t('autoReminder')}</p>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: colors.subtext }}>
            {t('autoReminderSubtitle')}
          </p>
        </div>
        <PillToggle
          value={recordatorioAutomatico}
          onChange={setRecordatorioAutomatico}
          disabled={faltaDireccion && !recordatorioAutomatico}
          ariaLabel={t('autoReminder')}
        />
      </div>

      {recordatorioAutomatico && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {HORAS_RECORDATORIO.map(h => (
            <button
              key={h}
              onClick={() => setHoraRecordatorio(h)}
              style={{
                borderRadius: 20, padding: '8px 16px', fontSize: 14, border: 'none', cursor: 'pointer',
                backgroundColor: horaRecordatorio === h ? colors.primarySolid : colors.border,
                color: horaRecordatorio === h ? '#fff' : colors.subtext,
              }}
            >
              {h}
            </button>
          ))}
        </div>
      )}

      <button
        onClick={() => setPreviewAbierto(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          background: 'transparent', border: `1px solid ${colors.border}`, borderRadius: 12,
          padding: '12px 16px', color: colors.text, fontSize: 14, fontWeight: 600,
          cursor: 'pointer', marginBottom: previewAbierto ? 12 : 16,
        }}
      >
        <WhatsappGlyph size={16} color={colors.success} />
        {previewAbierto ? t('previewHide') : t('previewShow')}
      </button>

      {previewAbierto && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            {(['confirmacion', 'recordatorio'] as const).map(tipo => (
              <button
                key={tipo}
                onClick={() => setTipoPreview(tipo)}
                style={{
                  flex: 1, borderRadius: 20, padding: '8px 12px', fontSize: 13, fontWeight: 600,
                  border: 'none', cursor: 'pointer',
                  backgroundColor: tipoPreview === tipo ? colors.primarySolid : colors.border,
                  color: tipoPreview === tipo ? '#fff' : colors.subtext,
                }}
              >
                {tipo === 'recordatorio'
                  ? t('previewTabRecordatorio')
                  : whatsappPideSena
                    ? t('previewTabReserva')
                    : t('previewTabConfirmacion')}
              </button>
            ))}
          </div>

          <div style={{
            backgroundColor: colors.successBg, border: `1px solid ${colors.successBorder}`,
            borderRadius: 12, padding: '14px 16px',
          }}>
            <p style={{
              margin: 0, fontSize: 13.5, lineHeight: 1.6, color: colors.text, whiteSpace: 'pre-line',
            }}>
              {renderConNegritas(textoPreview({
                tipo: tipoPreview,
                negocio: nombreNegocio || t('previewSampleNegocio'),
                telefono: telefonoContacto,
                direccion: direccionNegocio,
                pideSena: whatsappPideSena,
                senaMonto, senaTitular, senaEntidad, senaAlias, senaCbu,
              }))}
            </p>
          </div>
          <p style={{ margin: '8px 2px 0', fontSize: 11.5, color: colors.subtext }}>
            {t('previewDisclaimer')}
          </p>
        </div>
      )}

      <button
        onClick={handleGuardar}
        disabled={guardando}
        style={{
          width: '100%', background: colors.primarySolid, borderRadius: 14, padding: 16,
          border: 'none', color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer',
          opacity: guardando ? 0.6 : 1,
        }}
      >
        {guardando ? t('saving') : t('save')}
      </button>
    </div>
  );
}
