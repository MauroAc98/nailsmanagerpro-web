'use client';

import React from 'react';
import { colors } from '@/theme/colors';
import { ALL_EMOJIS } from '@/constants/editor';
import { TextoLibre } from '@/hooks/useGenerarHistoria';

interface Props {
  textoInput:        string;
  setTextoInput:     (v: string) => void;
  textosCanvas:      TextoLibre[];
  mostrarEmojis:     boolean;
  setMostrarEmojis:  (fn: (v: boolean) => boolean) => void;
  onAgregarTexto:    () => void;
  onEliminarTexto:   (id: string) => void;
  onCambiarFontSize: (id: string, delta: 1 | -1) => void;
}

export function TextoLibreInput({
  textoInput, setTextoInput, textosCanvas, mostrarEmojis, setMostrarEmojis,
  onAgregarTexto, onEliminarTexto, onCambiarFontSize,
}: Props) {
  return (
    <div style={{ width: '100%', marginTop: 16 }}>

      {/* Input row */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            value={textoInput}
            onChange={e => setTextoInput(e.target.value)}
            placeholder="Agregá un texto a tu historia..."
            maxLength={60}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: '#fff', border: '1px solid #EEE', borderRadius: 12,
              padding: '10px 44px 10px 14px', fontSize: 14, color: '#333',
            }}
          />
          <button
            type="button"
            onClick={() => setMostrarEmojis(v => !v)}
            style={{
              position: 'absolute', right: 8, top: 0, bottom: 0, width: 32,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'none', border: 'none', cursor: 'pointer', fontSize: 18,
            }}
          >
            😊
          </button>
        </div>

        <button
          type="button"
          onClick={onAgregarTexto}
          disabled={!textoInput.trim()}
          style={{
            background: colors.primary, borderRadius: 12, border: 'none',
            padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', opacity: !textoInput.trim() ? 0.4 : 1,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      {/* Emoji picker */}
      {mostrarEmojis && (
        <div style={{
          marginTop: 8, background: '#FAFAFA', borderRadius: 12,
          border: '1px solid #EFEFEF', padding: '8px 0',
          display: 'flex', gap: 4, overflowX: 'auto',
        }}>
          {ALL_EMOJIS.map((emoji, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setTextoInput(textoInput + emoji)}
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

      {/* Added texts list */}
      {textosCanvas.map(t => (
        <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <span style={{ color: '#CCC', fontSize: 14 }}>⠿</span>
          <span style={{
            flex: 1, fontSize: 13, color: '#666', fontStyle: 'italic',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {t.texto}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              onClick={() => onCambiarFontSize(t.id, -1)}
              style={{
                background: '#F0F0F0', borderRadius: 6, border: 'none',
                padding: '4px 8px', fontSize: 11, fontWeight: 700, color: '#555', cursor: 'pointer',
              }}
            >
              A-
            </button>
            <span style={{ fontSize: 11, color: '#999', minWidth: 20, textAlign: 'center' }}>{t.fontSize}</span>
            <button
              type="button"
              onClick={() => onCambiarFontSize(t.id, 1)}
              style={{
                background: '#F0F0F0', borderRadius: 6, border: 'none',
                padding: '4px 8px', fontSize: 11, fontWeight: 700, color: '#555', cursor: 'pointer',
              }}
            >
              A+
            </button>
          </div>
          <button
            type="button"
            onClick={() => onEliminarTexto(t.id)}
            style={{ background: 'none', border: 'none', color: '#CCC', fontSize: 16, cursor: 'pointer', lineHeight: 1 }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
