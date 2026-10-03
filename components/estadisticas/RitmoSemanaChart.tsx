'use client';

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from 'recharts';
import { agendaColors as colors } from '@/theme/agendaColors';
import { TooltipCard } from './TooltipCard';

export interface DiaRitmoChart {
  dia_semana: number;
  label: string;
  completados: number;
  confirmados: number;
  cancelados: number;
}

interface Props {
  dias: DiaRitmoChart[];
  labels: { completed: string; confirmed: string; cancelled: string };
  ariaLabel: string;
  height?: number;
}

export default function RitmoSemanaChart({ dias, labels, ariaLabel, height = 130 }: Props) {
  const tooltip = (props: TooltipContentProps) => {
    if (!props.active || !props.payload?.length) return null;
    const d = props.payload[0].payload as DiaRitmoChart;
    return (
      <TooltipCard
        title={d.label}
        rows={[
          { label: labels.completed, value: String(d.completados), color: colors.success },
          { label: labels.confirmed, value: String(d.confirmados), color: colors.primary },
          { label: labels.cancelled, value: String(d.cancelados), color: colors.danger },
        ]}
      />
    );
  };

  return (
    <div style={{ height, width: '100%' }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dias} title={ariaLabel} margin={{ top: 4, right: 4, left: 4, bottom: 0 }} barCategoryGap="22%">
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: colors.muted }} />
          <YAxis hide allowDecimals={false} />
          <Tooltip content={tooltip} cursor={{ fill: colors.surfaceSubtle }} />
          <Bar dataKey="completados" stackId="turnos" fill={colors.success} isAnimationActive="auto" />
          <Bar dataKey="confirmados" stackId="turnos" fill={colors.primary} isAnimationActive="auto" />
          <Bar dataKey="cancelados" stackId="turnos" fill={colors.danger} radius={[4, 4, 0, 0]} isAnimationActive="auto" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
