'use client';

import {
  Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
  type TooltipContentProps,
} from 'recharts';
import { agendaColors as colors } from '@/theme/agendaColors';
import { formatMonto } from '@/lib/money';
import { TooltipCard } from './TooltipCard';

export interface PuntoAcumulado {
  label: string;
  // null = día futuro del mes en curso: ni barra ni punto en la curva.
  monto: number | null;
  acumulado: number | null;
  // Acumulado del mes anterior a igual día; undefined si ese mes no tiene el día.
  previo?: number;
}

interface Props {
  serie: PuntoAcumulado[];
  labels: { daily: string; cumulative: string; previous: string };
  ocultarMonto: boolean;
  ariaLabel: string;
  height?: number;
}

const MONTO_OCULTO = '$ ●●●●●';

export default function AcumuladoChart({ serie, labels, ocultarMonto, ariaLabel, height = 170 }: Props) {
  const fmt = (n: number) => (ocultarMonto ? MONTO_OCULTO : `$${formatMonto(n)}`);

  const tooltip = (props: TooltipContentProps) => {
    if (!props.active || !props.payload?.length) return null;
    const p = props.payload[0].payload as PuntoAcumulado;
    if (p.monto === null || p.acumulado === null) return null;
    const rows = [
      { label: labels.daily, value: fmt(p.monto), color: colors.primary },
      { label: labels.cumulative, value: fmt(p.acumulado), color: colors.primaryDeep },
    ];
    if (p.previo !== undefined) rows.push({ label: labels.previous, value: fmt(p.previo), color: colors.muted });
    return <TooltipCard title={p.label} rows={rows} />;
  };

  return (
    <div style={{ height, width: '100%' }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={serie} title={ariaLabel} margin={{ top: 8, right: 6, left: 6, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={colors.hairline} />
          <XAxis
            dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={28}
            tick={{ fontSize: 10, fill: colors.muted }}
          />
          {/* Dos escalas ocultas: el día suelto es mucho menor que el acumulado. */}
          <YAxis yAxisId="dia" hide domain={[0, 'auto']} />
          <YAxis yAxisId="acum" hide domain={[0, 'auto']} />
          <Tooltip content={tooltip} cursor={{ fill: colors.surfaceSubtle }} />
          <Bar yAxisId="dia" dataKey="monto" fill={colors.primarySoft} radius={[3, 3, 0, 0]} isAnimationActive="auto" />
          <Line
            yAxisId="acum" dataKey="acumulado" type="monotone" stroke={colors.primaryDeep} strokeWidth={2.6}
            dot={false} isAnimationActive="auto"
            activeDot={{ r: 5, stroke: colors.primaryDeep, strokeWidth: 2.5, fill: colors.surface }}
          />
          <Line
            yAxisId="acum" dataKey="previo" type="monotone" stroke={colors.muted} strokeWidth={1.8}
            strokeDasharray="4 4" dot={false} activeDot={false} isAnimationActive="auto"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
