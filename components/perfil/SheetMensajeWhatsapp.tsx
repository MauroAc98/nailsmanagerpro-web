'use client';

import { useState } from 'react';
import { colors } from '@/theme/colors';
import { ALL_EMOJIS } from '@/constants/editor';
import { TipoPlantilla } from '@/services/authService';
import { useWhatsappTemplates } from '@/hooks/useWhatsappTemplates';

const VARIABLES = ['{nombre}', '{apellido}', '{servicios}', '{fecha}', '{hora}'];

const PREVIEW_DATA = {
  clienteNombre: 'Carla',
  clienteApellido: 'Gomez',
  servicio: 'Esculpidas + Nail Art',
  fecha: 'Lunes 11',
  hora: '16:00',
};

function sustituirVariables(mensaje: string): string {
  return mensaje
    .replace(/{nombre}/g, PREVIEW_DATA.clienteNombre)
    .replace(/{apellido}/g, PREVIEW_DATA.clienteApellido)
    .replace(/{servicios}/g, PREVIEW_DATA.servicio)
    .replace(/{fecha}/g, PREVIEW_DATA.fecha)
    .replace(/{hora}/g, PREVIEW_DATA.hora);
}

function IconClose() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

interface Props {
  onClose: () => void;
}

export function SheetMensajeWhatsapp({ onClose }: Props) {
  const { cargando, guardando, obtenerContenido, actualizar, resetear } = useWhatsappTemplates();
  const [tipoActual, setTipoActual] = useState<TipoPlantilla>('recordatorio');
  const [mensaje, setMensaje] = useState(() => obtenerContenido('recordatorio'));
  const [mostrarEmojis, setMostrarEmojis] = useState(false);

  // Reseed `mensaje` when `tipoActual` changes, or once the async template
  // fetch resolves (the initial seed above runs before it — while it still
  // falls back to DEFAULTS) — "adjust state during render" pattern (no
  // effect) so in-progress edits survive unrelated re-renders.
  const [tipoAnterior, setTipoAnterior] = useState(tipoActual);
  const [cargaPendiente, setCargaPendiente] = useState(cargando);
  if (tipoActual !== tipoAnterior) {
    setTipoAnterior(tipoActual);
    setMensaje(obtenerContenido(tipoActual));
  } else if (cargaPendiente && !cargando) {
    setCargaPendiente(false);
    setMensaje(obtenerContenido(tipoActual));
  }

  const handleAgregarVariable = (variable: string) => {
    setMensaje(prev => prev + variable);
  };

  const handleResetear = async () => {
    const label = tipoActual === 'recordatorio' ? 'recordatorio' : 'confirmación';
    if (!confirm(`¿Restablecer el mensaje de ${label} al predeterminado?`)) return;
    const reseteada = await resetear(tipoActual);
    if (reseteada) setMensaje(reseteada.contenido);
  };

  const handleGuardar = async () => {
    if (!mensaje.trim()) {
      alert('El mensaje no puede estar vacío.');
      return;
    }
    await actualizar(tipoActual, mensaje);
  };

  return (
    <div style={{ padding: '4px 20px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: '#333', margin: 0 }}>Mensajes de WhatsApp</h2>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <IconClose />
        </button>
      </div>

      <div style={{ display: 'flex', background: '#EBEBEB', borderRadius: 20, padding: 3, marginBottom: 16 }}>
        {(['recordatorio', 'confirmacion'] as TipoPlantilla[]).map(tipo => (
          <button
            key={tipo}
            onClick={() => setTipoActual(tipo)}
            style={{
              flex: 1, textAlign: 'center', padding: '8px 18px', borderRadius: 17, border: 'none',
              cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: tipoActual === tipo ? colors.primary : 'transparent',
              color: tipoActual === tipo ? '#fff' : '#666',
            }}
          >
            {tipo === 'recordatorio' ? 'Recordatorio' : 'Confirmación'}
          </button>
        ))}
      </div>

      <p style={{ fontSize: 11, fontWeight: 700, color: '#AAA', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
        Variables disponibles
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {VARIABLES.map(v => (
          <button
            key={v}
            onClick={() => handleAgregarVariable(v)}
            style={{
              borderRadius: 20, padding: '6px 12px', fontSize: 13, cursor: 'pointer',
              border: `1px solid ${colors.primary}`, background: '#fff', color: colors.primary,
            }}
          >
            {v}
          </button>
        ))}
      </div>

      <div style={{ position: 'relative', marginBottom: 16 }}>
        <textarea
          value={mensaje}
          onChange={e => setMensaje(e.target.value)}
          style={{
            width: '100%', boxSizing: 'border-box', minHeight: 110, resize: 'vertical',
            background: '#F8F8F8', border: '1px solid #EFEFEF', borderRadius: 12,
            padding: '12px 44px 12px 14px', fontSize: 14, color: '#333', fontFamily: 'inherit',
          }}
        />
        <button
          type="button"
          onClick={() => setMostrarEmojis(v => !v)}
          style={{
            position: 'absolute', right: 8, bottom: 8, width: 32, height: 32,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#fff', border: '1px solid #EEE', borderRadius: 8, cursor: 'pointer', fontSize: 16,
          }}
        >
          😊
        </button>
      </div>

      {mostrarEmojis && (
        <div style={{
          marginBottom: 16, background: '#FAFAFA', borderRadius: 12,
          border: '1px solid #EFEFEF', padding: '8px 0',
          display: 'flex', gap: 4, overflowX: 'auto',
        }}>
          {ALL_EMOJIS.map((emoji, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setMensaje(mensaje + emoji)}
              style={{
                flex: '0 0 auto', width: 40, height: 40, borderRadius: 10,
                background: '#fff', border: 'none', cursor: 'pointer', fontSize: 18,
                marginLeft: idx === 0 ? 8 : 0, marginRight: idx === ALL_EMOJIS.length - 1 ? 8 : 0,
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      <p style={{ fontSize: 11, fontWeight: 700, color: '#AAA', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
        Vista previa
      </p>
      <div style={{
        backgroundColor: '#DCF8C6', borderRadius: 12, padding: '12px 14px', marginBottom: 20,
      }}>
        <p style={{ margin: 0, fontSize: 14, color: '#333', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {sustituirVariables(mensaje)}
        </p>
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
          Resetear
        </button>
        <button
          onClick={handleGuardar}
          disabled={guardando}
          style={{
            flex: 1, background: colors.primary, borderRadius: 14, padding: 14,
            border: 'none', color: '#fff', fontWeight: 700, fontSize: 14,
            cursor: 'pointer', opacity: guardando ? 0.6 : 1,
          }}
        >
          {guardando ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </div>
  );
}
