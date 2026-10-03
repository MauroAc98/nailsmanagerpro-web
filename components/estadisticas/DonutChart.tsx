'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, type TooltipContentProps } from 'recharts';
import { agendaColors as colors, agendaFontSerif } from '@/theme/agendaColors';
import { TooltipCard } from './TooltipCard';

export interface RebanadaDonut {
  name: string;
  value: number;
  color: string;
  // Texto que va en la leyenda a la derecha (ej. "35%" o "41").
  valorLabel: string;
}

interface Props {
  data: RebanadaDonut[];
  centerValue: string | number;
  centerLabel: string;
  ariaLabel: string;
  size?: number;
}

export default function DonutChart({ data, centerValue, centerLabel, ariaLabel, size = 128 }: Props) {
  const tooltip = (props: TooltipContentProps) => {
    if (!props.active || !props.payload?.length) return null;
    const d = props.payload[0].payload as RebanadaDonut;
    return <TooltipCard title={d.name} rows={[{ label: centerLabel, value: String(d.value), color: d.color }]} />;
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart title={ariaLabel}>
            <Tooltip content={tooltip} />
            <Pie
              data={data} dataKey="value" nameKey="name" innerRadius="66%" outerRadius="100%"
              paddingAngle={data.length > 1 ? 2 : 0} stroke="none" isAnimationActive="auto"
            >
              {data.map(d => <Cell key={d.name} fill={d.color} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
        }}>
          <span style={{ fontFamily: agendaFontSerif, fontSize: 22, lineHeight: 1, color: colors.textStrong }}>{centerValue}</span>
          <span style={{ fontSize: 10, color: colors.subtext, marginTop: 2 }}>{centerLabel}</span>
        </div>
      </div>
      <ul style={{ flex: 1, minWidth: 0, margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 9 }}>
        {data.map(d => (
          <li key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: colors.text, minWidth: 0 }}>
            <span style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: d.color, flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
            <b style={{ flexShrink: 0 }}>{d.valorLabel}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}
