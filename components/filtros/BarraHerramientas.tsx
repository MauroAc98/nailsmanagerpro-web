import type { LucideIcon } from 'lucide-react';
import { agendaColors as colors } from '@/theme/agendaColors';

interface Item {
  id: string;
  icono: LucideIcon;
  label: string;
}

interface Props {
  items: Item[];
  activo: string;
  onChange: (id: string) => void;
}

// Fila de botones de herramienta (círculo con ícono + etiqueta); el activo
// va sobre fondo blanco con borde divider.
export function BarraHerramientas({ items, activo, onChange }: Props) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 16, width: '100%' }}>
      {items.map(({ id, icono: Icono, label }) => {
        const active = activo === id;
        return (
          <button
            key={id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(id)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '10px 0',
              borderRadius: 14, cursor: 'pointer',
              background: active ? colors.surface : 'transparent',
              border: `1px solid ${active ? colors.divider : 'transparent'}`,
            }}
          >
            <span style={{
              width: 40, height: 40, borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: colors.primarySoft,
            }}>
              <Icono size={18} strokeWidth={2} color={colors.primaryDeep} aria-hidden="true" />
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, color: colors.textStrong }}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
