'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { colors } from '@/theme/colors';
import { ALL_EMOJIS } from '@/constants/editor';
import { TipoPlantilla } from '@/services/authService';
import { useWhatsappTemplates } from '@/hooks/useWhatsappTemplates';
import { useProfesionalStore } from '@/store/useProfesionalStore';
import { confirmDialog, alertDialog } from '@/store/useConfirmStore';
import { showToast } from '@/store/useToastStore';

const VARIABLES_BASE = ['{nombre}', '{apellido}', '{servicios}', '{fecha}', '{hora}'];

const PREVIEW_DATA = {
  clienteNombre: 'Carla',
  clienteApellido: 'Gomez',
  servicio: 'Esculpidas + Nail Art',
  fecha: 'Lunes 11',
  hora: '16:00',
  profesional: 'Fio',
};

function sustituirVariables(mensaje: string): string {
  return mensaje
    .replace(/{nombre}/g, PREVIEW_DATA.clienteNombre)
    .replace(/{apellido}/g, PREVIEW_DATA.clienteApellido)
    .replace(/{servicios}/g, PREVIEW_DATA.servicio)
    .replace(/{fecha}/g, PREVIEW_DATA.fecha)
    .replace(/{hora}/g, PREVIEW_DATA.hora)
    .replace(/{profesional}/g, PREVIEW_DATA.profesional);
}

function IconClose() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

interface Props {
  onClose: () => void;
}

export function SheetMensajeWhatsapp({ onClose }: Props) {
  const t = useTranslations('perfil.SheetMensajeWhatsapp');
  const { cargando, guardando, error, obtenerContenido, actualizar, resetear, recargar } = useWhatsappTemplates();
  const [tipoActual, setTipoActual] = useState<TipoPlantilla>('recordatorio');
  const [mensaje, setMensaje] = useState(() => obtenerContenido('recordatorio'));
  const [mostrarEmojis, setMostrarEmojis] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Multi-agenda — {profesional} solo se ofrece como variable cuando la
  // cuenta tiene más de una profesional activa (misma regla que el resto
  // de la app, ver app/(app)/agenda/nuevo/page.tsx).
  const { profesionales, fetchProfesionales } = useProfesionalStore();
  useEffect(() => {
    if (profesionales.length === 0) fetchProfesionales();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const activeProfesionales        = profesionales.filter(p => p.activo);
  const mostrarSelectorProfesional = activeProfesionales.length > 1;
  const VARIABLES = mostrarSelectorProfesional
    ? [...VARIABLES_BASE, '{profesional}']
    : VARIABLES_BASE;

  // Reseed `mensaje` when `tipoActual` changes, or once the async template
  // fetch resolves (the initial seed above runs before it — while it still
  // falls back to DEFAULTS) — "adjust state during render" pattern (no
  // effect) so in-progress edits survive unrelated re-renders. If the fetch
  // failed, `obtenerContenido` can't tell "no custom template yet" apart
  // from "fetch failed" — never seed DEFAULTS in that case, so a save can't
  // silently overwrite the real (unknown) template with generic text.
  const [tipoAnterior, setTipoAnterior] = useState(tipoActual);
  const [cargandoAnterior, setCargandoAnterior] = useState(cargando);
  if (tipoActual !== tipoAnterior) {
    setTipoAnterior(tipoActual);
    setMensaje(error ? '' : obtenerContenido(tipoActual));
  } else if (cargando !== cargandoAnterior) {
    setCargandoAnterior(cargando);
    if (!cargando) setMensaje(error ? '' : obtenerContenido(tipoActual));
  }

  // Inserta en la posición del cursor (o reemplaza la selección activa), no
  // al final — un textarea controlado no mueve el cursor solo cuando el
  // value cambia por código, así que sin esto la variable/emoji siempre
  // caía al final sin importar dónde estuviera tipiando el usuario. La
  // referencia al <textarea> (no el evento del botón) es la única forma de
  // leer selectionStart/selectionEnd, porque el click en el botón le saca el
  // foco al textarea antes de que este handler corra.
  const insertarEnCursor = (texto: string) => {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? mensaje.length;
    const end   = textarea?.selectionEnd   ?? mensaje.length;
    const nuevoMensaje = mensaje.slice(0, start) + texto + mensaje.slice(end);
    setMensaje(nuevoMensaje);

    // El re-render con el nuevo value todavía no corrió en este mismo tick
    // — setSelectionRange antes de eso apunta al texto viejo. rAF espera al
    // próximo paint, que ya lo tiene.
    const cursorPos = start + texto.length;
    requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(cursorPos, cursorPos);
    });
  };

  const handleAgregarVariable = (variable: string) => {
    insertarEnCursor(variable);
  };

  const handleResetear = async () => {
    const label = tipoActual === 'recordatorio' ? t('reminderLower') : t('confirmationLower');
    if (!(await confirmDialog(t('resetConfirm', { label }), { confirmText: t('resetConfirmButton') }))) return;
    const reseteada = await resetear(tipoActual);
    if (reseteada) setMensaje(reseteada.contenido);
  };

  const handleGuardar = async () => {
    if (!mensaje.trim()) {
      await alertDialog(t('emptyMessage'));
      return;
    }
    const ok = await actualizar(tipoActual, mensaje);
    if (ok) showToast(t('saved'));
    else await alertDialog(t('saveError'));
  };

  return (
    <div style={{ padding: '4px 20px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: colors.text, margin: 0 }}>{t('title')}</h2>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <IconClose />
        </button>
      </div>

      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
          marginBottom: 16, backgroundColor: colors.dangerBg, border: `1px solid ${colors.dangerBorder}`,
          borderRadius: 12, padding: '12px 14px',
        }}>
          <p style={{ margin: 0, fontSize: 13, color: colors.danger }}>{error}</p>
          <button
            onClick={() => recargar()}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0,
              fontSize: 13, fontWeight: 700, color: colors.danger, textDecoration: 'underline',
            }}
          >
            {t('retry')}
          </button>
        </div>
      )}

      <div style={{ display: 'flex', background: colors.surfaceSubtle, borderRadius: 20, padding: 3, marginBottom: 16 }}>
        {(['recordatorio', 'confirmacion'] as TipoPlantilla[]).map(tipo => (
          <button
            key={tipo}
            onClick={() => setTipoActual(tipo)}
            style={{
              flex: 1, textAlign: 'center', padding: '8px 18px', borderRadius: 17, border: 'none',
              cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: tipoActual === tipo ? colors.primary : 'transparent',
              color: tipoActual === tipo ? '#fff' : colors.subtext,
            }}
          >
            {tipo === 'recordatorio' ? t('reminder') : t('confirmation')}
          </button>
        ))}
      </div>

      <p style={{ fontSize: 11, fontWeight: 700, color: colors.muted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
        {t('availableVariables')}
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {VARIABLES.map(v => (
          <button
            key={v}
            onClick={() => handleAgregarVariable(v)}
            style={{
              borderRadius: 20, padding: '6px 12px', fontSize: 13, cursor: 'pointer',
              border: `1px solid ${colors.primary}`, background: colors.surface, color: colors.primary,
            }}
          >
            {v}
          </button>
        ))}
      </div>

      <div style={{ position: 'relative', marginBottom: 16 }}>
        <textarea
          ref={textareaRef}
          value={mensaje}
          onChange={e => setMensaje(e.target.value)}
          style={{
            width: '100%', boxSizing: 'border-box', minHeight: 110, resize: 'vertical',
            background: colors.surfaceSubtle, border: `1px solid ${colors.border}`, borderRadius: 12,
            padding: '12px 44px 12px 14px', fontSize: 14, color: colors.text, fontFamily: 'inherit',
          }}
        />
        <button
          type="button"
          onClick={() => setMostrarEmojis(v => !v)}
          style={{
            position: 'absolute', right: 8, bottom: 8, width: 32, height: 32,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 8, cursor: 'pointer', fontSize: 16,
          }}
        >
          😊
        </button>
      </div>

      {mostrarEmojis && (
        <div style={{
          marginBottom: 16, background: colors.surfaceSubtle, borderRadius: 12,
          border: `1px solid ${colors.border}`, padding: '8px 0',
          display: 'flex', gap: 4, overflowX: 'auto',
        }}>
          {ALL_EMOJIS.map((emoji, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => insertarEnCursor(emoji)}
              style={{
                flex: '0 0 auto', width: 40, height: 40, borderRadius: 10,
                background: colors.surface, border: 'none', cursor: 'pointer', fontSize: 18,
                marginLeft: idx === 0 ? 8 : 0, marginRight: idx === ALL_EMOJIS.length - 1 ? 8 : 0,
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      <p style={{ fontSize: 11, fontWeight: 700, color: colors.muted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
        {t('preview')}
      </p>
      {/* Burbuja de chat de WhatsApp — imita el fondo doodle + el bubble
          verde claro reales de WhatsApp a propósito, así que quedan fijos
          (no siguen el tema de la app), igual que el ícono verde de
          WhatsApp en otras pantallas. El texto también queda fijo en
          oscuro: si siguiera colors.text se volvería claro en modo oscuro
          y quedaría ilegible sobre este verde. */}
      <div style={{
        backgroundColor: '#DDD5CC', backgroundImage: 'url(/whatsapp/bg_wpp.png)',
        backgroundSize: '220px', borderRadius: 16, padding: 14, marginBottom: 20,
      }}>
        <div style={{
          backgroundColor: '#DCF8C6', borderRadius: 12, padding: '12px 14px',
          maxWidth: '82%', boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        }}>
          <p style={{ margin: 0, fontSize: 14, color: '#111b21', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {sustituirVariables(mensaje)}
          </p>
          <p style={{ margin: '5px 0 0', fontSize: 9, fontWeight: 700, color: '#4FC3F7', textAlign: 'right' }}>
            18:30 ✓✓
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={handleResetear}
          disabled={guardando}
          style={{
            flex: 1, background: 'transparent', borderRadius: 14, padding: 14,
            border: `1px solid ${colors.primary}`, color: colors.primary, fontWeight: 700, fontSize: 14,
            cursor: 'pointer', opacity: guardando ? 0.6 : 1,
          }}
        >
          {t('reset')}
        </button>
        <button
          onClick={handleGuardar}
          disabled={guardando || !!error}
          style={{
            flex: 1, background: colors.primary, borderRadius: 14, padding: 14,
            border: 'none', color: '#fff', fontWeight: 700, fontSize: 14,
            cursor: 'pointer', opacity: (guardando || error) ? 0.6 : 1,
          }}
        >
          {guardando ? t('saving') : t('save')}
        </button>
      </div>
    </div>
  );
}
