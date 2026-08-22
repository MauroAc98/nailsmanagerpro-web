'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { agendaColors as colors } from '@/theme/agendaColors';
import { ALL_EMOJIS } from '@/constants/editor';
import { TextoLibre } from '@/hooks/useGenerarHistoria';

interface Props {
  textoInput:        string;
  setTextoInput:     (v: string) => void;
  textosCanvas:      TextoLibre[];
  mostrarEmojis:     boolean;
  setMostrarEmojis:  (fn: (v: boolean) => boolean) => void;
  editandoId:        string | null;
  onAgregarTexto:    () => void;
  onIniciarEdicion:  (id: string) => void;
  onCancelarEdicion: () => void;
  onEliminarTexto:   (id: string) => void;
  onCambiarFontSize: (id: string, delta: 1 | -1) => void;
}

export function TextoLibreInput({
  textoInput, setTextoInput, textosCanvas, mostrarEmojis, setMostrarEmojis, editandoId,
  onAgregarTexto, onIniciarEdicion, onCancelarEdicion, onEliminarTexto, onCambiarFontSize,
}: Props) {
  const t = useTranslations('historia.TextoLibreInput');
  return (
    <div style={{ width: '100%', marginTop: 16 }}>

      {/* Input row */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            value={textoInput}
            onChange={e => setTextoInput(e.target.value)}
            placeholder={t('placeholder')}
            maxLength={60}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: colors.surface, border: `1px solid ${editandoId ? colors.primaryDeep : colors.border}`, borderRadius: 12,
              padding: '10px 44px 10px 14px', fontSize: 14, color: colors.text,
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

        {editandoId && (
          <button
            type="button"
            onClick={onCancelarEdicion}
            style={{
              background: colors.surfaceSubtle, borderRadius: 12, border: 'none',
              padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: colors.muted, fontSize: 18, lineHeight: 1,
            }}
          >
            ×
          </button>
        )}

        <button
          type="button"
          onClick={onAgregarTexto}
          disabled={!textoInput.trim()}
          style={{
            background: colors.primarySolid, borderRadius: 12, border: 'none',
            padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', opacity: !textoInput.trim() ? 0.4 : 1,
          }}
        >
          {editandoId ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.primaryFg} strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.primaryFg} strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          )}
        </button>
      </div>

      {/* Emoji picker */}
      {mostrarEmojis && (
        <div style={{
          marginTop: 8, background: colors.surfaceSubtle, borderRadius: 12,
          border: `1px solid ${colors.border}`, padding: '8px 0',
          display: 'flex', gap: 4, overflowX: 'auto',
        }}>
          {ALL_EMOJIS.map((emoji, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setTextoInput(textoInput + emoji)}
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

      {/* Added texts list — tap the text to edit it in place */}
      {textosCanvas.map(t => (
        <div
          key={t.id}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, marginTop: 8,
            padding: '4px 6px', borderRadius: 8,
            background: editandoId === t.id ? colors.primarySoft : 'transparent',
          }}
        >
          <span style={{ color: colors.placeholder, fontSize: 14 }}>⠿</span>
          <span
            role="button"
            tabIndex={0}
            onClick={() => onIniciarEdicion(t.id)}
            style={{
              flex: 1, fontSize: 13, color: colors.subtext, fontStyle: 'italic',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              cursor: 'pointer',
            }}
          >
            {t.texto}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              onClick={() => onCambiarFontSize(t.id, -1)}
              style={{
                background: colors.surfaceSubtle, borderRadius: 6, border: 'none',
                padding: '4px 8px', fontSize: 11, fontWeight: 700, color: colors.textStrong, cursor: 'pointer',
              }}
            >
              A-
            </button>
            <span style={{ fontSize: 11, color: colors.subtext, minWidth: 20, textAlign: 'center' }}>{t.fontSize}</span>
            <button
              type="button"
              onClick={() => onCambiarFontSize(t.id, 1)}
              style={{
                background: colors.surfaceSubtle, borderRadius: 6, border: 'none',
                padding: '4px 8px', fontSize: 11, fontWeight: 700, color: colors.textStrong, cursor: 'pointer',
              }}
            >
              A+
            </button>
          </div>
          <button
            type="button"
            onClick={() => onEliminarTexto(t.id)}
            style={{ background: 'none', border: 'none', color: colors.placeholder, fontSize: 16, cursor: 'pointer', lineHeight: 1 }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
