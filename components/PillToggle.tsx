'use client';

import { colors, withAlpha } from '@/theme/colors';

interface Props {
  value:            boolean;
  onChange:         (v: boolean) => void;
  stopPropagation?: boolean;
}

// ─────────────────────────────────────────────
// PillToggle — shared on/off switch. `stopPropagation` defaults to false;
// opt in from list rows nested inside a clickable card so the toggle click
// doesn't also trigger the card's own onClick.
// ─────────────────────────────────────────────
export default function PillToggle({ value, onChange, stopPropagation = false }: Props) {
  return (
    <div
      onClick={e => {
        if (stopPropagation) e.stopPropagation();
        onChange(!value);
      }}
      style={{
        width: 44, height: 26, borderRadius: 13,
        backgroundColor: value ? withAlpha(colors.primary, '66') : colors.surfaceSubtle,
        position: 'relative', cursor: 'pointer',
        transition: 'background 0.2s', flexShrink: 0,
      }}
    >
      <div style={{
        position: 'absolute', top: 3,
        left: value ? 21 : 3,
        width: 20, height: 20, borderRadius: 10,
        backgroundColor: value ? colors.primary : colors.placeholder,
        transition: 'left 0.2s',
      }} />
    </div>
  );
}
