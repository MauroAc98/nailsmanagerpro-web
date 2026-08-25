'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { agendaColors as colors } from '@/theme/agendaColors';
import { SheetInput } from './SheetInput';
import PillToggle from '@/components/PillToggle';
import { WhatsappGlyph } from '@/components/icons/WhatsappGlyph';
import { phoneUtils } from '@/lib/phoneUtils';

const HORAS_RECORDATORIO = ['18:00', '19:00', '20:00', '21:00', '22:00'];

type TipoPreview = 'confirmacion' | 'recordatorio';

interface Props {
  senaMonto: string;
  setSenaMonto: (v: string) => void;
  confirmacionAutomatica: boolean;
  setConfirmacionAutomatica: (v: boolean) => void;
  recordatorioAutomatico: boolean;
  setRecordatorioAutomatico: (v: boolean) => void;
  horaRecordatorio: string;
  setHoraRecordatorio: (v: string) => void;
  nombreNegocio: string;
  telefonoContacto: string;
  direccionNegocio: string;
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

// Mismo texto fijo que arma WhatsappTemplate::mensajeLegible() en el backend
// (NailsManagerProApi) — si ese texto cambia ahí, hay que actualizarlo acá
// también, no hay una fuente única compartida entre frontend y backend.
//
// El nombre de la profesional ({{7}} en el backend, sale de
// turno.profesional.nombre) es un dato de ejemplo fijo acá — este preview
// no tiene un turno real de referencia, así que no hay una profesional
// puntual para mostrar. nombreNegocio, telefono y direccion sí son reales
// (vienen de la cuenta) porque son los que el cliente va a ver tal cual.
function textoPreview(tipo: TipoPreview, negocio: string, telefono: string, direccion: string): string {
  const nombreCliente = 'Martina';
  const fecha = '20/08';
  const hora = '15:30';
  const servicio = 'Manicura semipermanente';
  const nombreProfesionalEjemplo = 'Fernanda';
  const tel = telefono.trim() ? phoneUtils.formatDisplay(telefono) : '(agregá tu teléfono en Datos personales)';
  const dir = direccion.trim() || '(agregá tu dirección en Datos personales)';

  const linea2 = tipo === 'confirmacion'
    ? `✅ Turno confirmado en ${negocio}`
    : `⏰ Recordatorio: tu turno es *mañana* en ${negocio}`;

  return `Hola ${nombreCliente} ✨\n\n${linea2}\n🗓️ ${fecha} · 🕒 ${hora} hs\n✨ ${servicio}\n📍 ${dir}\n\n*¡Te esperamos!*\n\n📞 ¿Consultas o cambios de turno? Si ya hablaste con ${nombreProfesionalEjemplo} previamente, comunicate por ahí. Si no, este es su número: 💬 ${tel}.\nPor favor, avisar con 24hs de anticipación. ¡Gracias!\n\nEste es un mensaje automático, no hace falta responder.`;
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

export function SheetNegocio({
  senaMonto, setSenaMonto, confirmacionAutomatica, setConfirmacionAutomatica,
  recordatorioAutomatico, setRecordatorioAutomatico,
  horaRecordatorio, setHoraRecordatorio, nombreNegocio, telefonoContacto,
  direccionNegocio, onGuardar, guardando, error, onClose,
}: Props) {
  const t = useTranslations('perfil.SheetNegocio');
  const [previewAbierto, setPreviewAbierto] = useState(false);
  const [tipoPreview, setTipoPreview] = useState<TipoPreview>('confirmacion');
  const faltaDireccion = !direccionNegocio.trim();

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
                {tipo === 'confirmacion' ? t('previewTabConfirmacion') : t('previewTabRecordatorio')}
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
              {renderConNegritas(textoPreview(tipoPreview, nombreNegocio || t('previewSampleNegocio'), telefonoContacto, direccionNegocio))}
            </p>
          </div>
          <p style={{ margin: '8px 2px 0', fontSize: 11.5, color: colors.subtext }}>
            {t('previewDisclaimer')}
          </p>
        </div>
      )}

      <button
        onClick={onGuardar}
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
