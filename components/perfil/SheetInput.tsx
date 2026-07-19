'use client';

import React from 'react';
import { colors } from '@/theme/colors';

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: colors.placeholder, letterSpacing: 1,
  textTransform: 'uppercase', marginBottom: 8,
};

interface Props {
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  rightAdornment?: React.ReactNode;
}

export function SheetInput({ label, icon, value, onChange, placeholder, type = 'text', inputMode, rightAdornment }: Props) {
  return (
    <div style={{ marginBottom: 16 }}>
      <p style={sectionLabelStyle}>{label}</p>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        backgroundColor: colors.surfaceSubtle, border: `1px solid ${colors.border}`, borderRadius: 12,
        padding: '12px 14px', position: 'relative',
      }}>
        {icon}
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          type={type}
          inputMode={inputMode}
          style={{
            flex: 1, border: 'none', background: 'none', outline: 'none',
            fontSize: 15, color: colors.text, minWidth: 0,
          }}
        />
        {rightAdornment}
      </div>
    </div>
  );
}
