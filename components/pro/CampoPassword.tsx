'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { agendaColors } from '@/theme/agendaColors';

interface Props {
  id: string;
  label: string;
  value: string;
  onChange: (valor: string) => void;
  autoComplete: 'current-password' | 'new-password';
  error?: boolean;
  describedBy?: string;
  // Solo lectura (no disabled): mientras se envía el campo no se edita pero
  // conserva el foco.
  soloLectura?: boolean;
}

// Campo de contraseña con ojo para verla. El valor vive solo en el estado de
// quien lo usa: no se guarda, no se registra y no se pinta como texto.
export function CampoPassword({ id, label, value, onChange, autoComplete, error, describedBy, soloLectura }: Props) {
  const t = useTranslations('profesionales.CampoPassword');
  const [visible, setVisible] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <label htmlFor={id} style={{ fontSize: 14, fontWeight: 600, color: agendaColors.strong }}>
        {label}
      </label>
      <div style={{ position: 'relative', display: 'flex', minWidth: 0 }}>
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          readOnly={soloLectura}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 44,
            boxSizing: 'border-box',
            padding: '0 52px 0 14px',
            fontSize: 16,
            borderRadius: 12,
            border: `1px solid ${error ? agendaColors.danger : agendaColors.fieldBorder}`,
            backgroundColor: agendaColors.surface,
            color: agendaColors.strong,
          }}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            minWidth: 44,
            minHeight: 44,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            fontSize: 18,
            color: agendaColors.sub,
          }}
        >
          <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
            <circle cx="12" cy="12" r="3" />
            {visible && <path d="M3 3l18 18" />}
          </svg>
          <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
            {visible ? t('ocultar') : t('mostrar')}
          </span>
        </button>
      </div>
    </div>
  );
}
