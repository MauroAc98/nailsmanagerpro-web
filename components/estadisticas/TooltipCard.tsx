import { agendaColors as colors, agendaShadows as shadows } from '@/theme/agendaColors';

export interface FilaTooltip {
  label: string;
  value: string;
  color?: string;
}

// Tarjeta de tooltip compartida por todos los gráficos de Estadísticas —
// mismo look que el resto de la pantalla (superficie + borde + sombra del
// tema Agenda), nunca el estilo por defecto de Recharts.
export function TooltipCard({ title, rows }: { title: string; rows: FilaTooltip[] }) {
  return (
    <div style={{
      backgroundColor: colors.surface, border: `1px solid ${colors.border}`, boxShadow: shadows.card,
      borderRadius: 12, padding: '8px 10px', fontSize: 12, color: colors.text, maxWidth: 220,
    }}>
      <p style={{ margin: '0 0 4px', fontWeight: 700, color: colors.textStrong }}>{title}</p>
      {rows.map(r => (
        <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          {r.color && <span style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: r.color, flexShrink: 0 }} />}
          <span style={{ color: colors.subtext, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span>
          <span style={{ marginLeft: 'auto', fontWeight: 700, flexShrink: 0, paddingLeft: 8 }}>{r.value}</span>
        </div>
      ))}
    </div>
  );
}
