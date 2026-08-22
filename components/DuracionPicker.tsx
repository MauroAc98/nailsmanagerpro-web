'use client';

import { useTranslations } from 'next-intl';
import { colors, withAlpha } from '@/theme/colors';

const MINUTE_STEPS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

interface Props {
  value: number;
  onChange: (minutos: number) => void;
}

function minutesToParts(total: number) {
  const h = Math.floor(total / 60);
  const rawMin = total % 60;
  const mIdx = MINUTE_STEPS.reduce((best, step, i) =>
    Math.abs(step - rawMin) < Math.abs(MINUTE_STEPS[best] - rawMin) ? i : best, 0);
  return { h, mIdx };
}

function partsToMinutes(h: number, mIdx: number) {
  return h * 60 + MINUTE_STEPS[mIdx];
}

function formatLabel(t: ReturnType<typeof useTranslations>, total: number, h: number, mins: number) {
  if (h > 0 && mins > 0) return t('summaryHoursAndMinutes', { h, mins, total });
  if (h > 0) return t('summaryHoursOnly', { h, total });
  return t('summaryMinutesOnly', { mins });
}

const btnStyle: React.CSSProperties = {
  width: 32, height: 32, borderRadius: 8,
  backgroundColor: withAlpha(colors.primary, '12'), border: 'none',
  cursor: 'pointer', fontSize: 20, color: colors.primaryDeep,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontWeight: 300, lineHeight: 1,
};

export default function DuracionPicker({ value, onChange }: Props) {
  const t = useTranslations('common.DuracionPicker');
  const { h, mIdx } = minutesToParts(value);
  const mins = MINUTE_STEPS[mIdx];
  const total = partsToMinutes(h, mIdx);

  const changeH = (dir: number) => {
    const newH = Math.max(0, Math.min(8, h + dir));
    const newMIdx = newH === 0 && mIdx === 0 ? 1 : mIdx;
    onChange(partsToMinutes(newH, newMIdx));
  };

  const changeM = (dir: number) => {
    const newMIdx = (mIdx + dir + MINUTE_STEPS.length) % MINUTE_STEPS.length;
    const safeIdx = h === 0 && newMIdx === 0
      ? (dir > 0 ? 1 : MINUTE_STEPS.length - 1)
      : newMIdx;
    onChange(partsToMinutes(h, safeIdx));
  };

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center',
        backgroundColor: colors.surface, border: `1px solid ${colors.border}`,
        borderRadius: 12, padding: '8px 6px',
      }}>
        {/* Horas */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: colors.subtext, textTransform: 'uppercase', letterSpacing: 0.8 }}>
            {t('hoursLabel')}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button style={btnStyle} onClick={() => changeH(-1)}>−</button>
            <span style={{ fontSize: 28, fontWeight: 700, color: colors.text, minWidth: 44, textAlign: 'center' }}>
              {h}
            </span>
            <button style={btnStyle} onClick={() => changeH(1)}>+</button>
          </div>
          <span style={{ fontSize: 12, color: colors.subtext, fontWeight: 500 }}>{t('hoursUnit')}</span>
        </div>

        <div style={{ width: 1, height: 44, backgroundColor: colors.border, margin: '0 6px' }} />

        {/* Minutos */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: colors.subtext, textTransform: 'uppercase', letterSpacing: 0.8 }}>
            {t('minutesLabel')}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button style={btnStyle} onClick={() => changeM(-1)}>−</button>
            <span style={{ fontSize: 28, fontWeight: 700, color: colors.text, minWidth: 44, textAlign: 'center' }}>
              {String(mins).padStart(2, '0')}
            </span>
            <button style={btnStyle} onClick={() => changeM(1)}>+</button>
          </div>
          <span style={{ fontSize: 12, color: colors.subtext, fontWeight: 500 }}>{t('minutesUnit')}</span>
        </div>
      </div>

      {/* Summary pill */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        backgroundColor: withAlpha(colors.primary, '12'), border: `1px solid ${colors.primaryDeep}`,
        borderRadius: 20, padding: '6px 14px', marginTop: 10,
      }}>
        <div style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary }} />
        <span style={{ fontSize: 13, color: colors.primaryDeep, fontWeight: 600 }}>
          {formatLabel(t, total, h, mins)}
        </span>
      </div>
    </div>
  );
}
