'use client';

import { colors, withAlpha } from '@/theme/colors';
import { SheetInput } from './SheetInput';

const HORAS_RECORDATORIO = ['18:00', '19:00', '20:00', '21:00', '22:00'];

interface Props {
  senaMonto: string;
  setSenaMonto: (v: string) => void;
  recordatorioAutomatico: boolean;
  setRecordatorioAutomatico: (v: boolean) => void;
  horaRecordatorio: string;
  setHoraRecordatorio: (v: string) => void;
  onGuardar: () => void;
  guardando: boolean;
  onClose: () => void;
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

function PillToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      onClick={() => onChange(!value)}
      style={{
        width: 44, height: 26, borderRadius: 13,
        backgroundColor: value ? withAlpha(colors.primary, '66') : colors.border,
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

export function SheetNegocio({
  senaMonto, setSenaMonto, recordatorioAutomatico, setRecordatorioAutomatico,
  horaRecordatorio, setHoraRecordatorio, onGuardar, guardando, onClose,
}: Props) {
  return (
    <div style={{ padding: '4px 20px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: colors.text, margin: 0 }}>Mi negocio</h2>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <IconClose />
        </button>
      </div>

      <SheetInput
        label="Monto de seña ($)"
        icon={<IconMoney />}
        value={senaMonto}
        onChange={setSenaMonto}
        placeholder="0"
        type="text"
        inputMode="decimal"
      />

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        backgroundColor: colors.surfaceSubtle, borderRadius: 12, padding: '14px 16px', marginBottom: 16,
      }}>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: colors.text }}>Recordatorio automático</p>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: colors.subtext }}>
            Enviá un WhatsApp la noche anterior a tus clientes
          </p>
        </div>
        <PillToggle value={recordatorioAutomatico} onChange={setRecordatorioAutomatico} />
      </div>

      {recordatorioAutomatico && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {HORAS_RECORDATORIO.map(h => (
            <button
              key={h}
              onClick={() => setHoraRecordatorio(h)}
              style={{
                borderRadius: 20, padding: '8px 16px', fontSize: 14, border: 'none', cursor: 'pointer',
                backgroundColor: horaRecordatorio === h ? colors.primary : colors.border,
                color: horaRecordatorio === h ? '#fff' : colors.subtext,
              }}
            >
              {h}
            </button>
          ))}
        </div>
      )}

      <button
        onClick={onGuardar}
        disabled={guardando}
        style={{
          width: '100%', background: colors.primary, borderRadius: 14, padding: 16,
          border: 'none', color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer',
          opacity: guardando ? 0.6 : 1,
        }}
      >
        {guardando ? 'Guardando...' : 'Guardar cambios'}
      </button>
    </div>
  );
}
