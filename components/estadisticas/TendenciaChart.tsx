'use client';

import { useId } from 'react';
import {
  Area, AreaChart, Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis,
  type TooltipContentProps,
} from 'recharts';
import { agendaColors as colors } from '@/theme/agendaColors';
import { formatMonto } from '@/lib/money';
import { TooltipCard } from './TooltipCard';

export interface PuntoTendencia {
  label: string;
  // null = día futuro del mes en curso: no se dibuja (ni como 0).
  monto: number | null;
  // false = bucket (semana/mes) que el rango elegido cubre solo en parte.
  completo?: boolean;
}

interface Props {
  puntos: PuntoTendencia[];
  // Un valor por punto (mismo índice), mes anterior alineado por día del mes.
  previo?: (number | undefined)[];
  previoLabel?: string;
  // 'area' para día a día (con comparación); 'barras' para semana/mes, donde
  // un bucket parcial se dibuja más claro.
  tipo: 'area' | 'barras';
  ocultarMonto: boolean;
  parcialLabel: string;
  ariaLabel: string;
  height?: number;
}

const MONTO_OCULTO = '$ ●●●●●';

export default function TendenciaChart({
  puntos, previo, previoLabel, tipo, ocultarMonto, parcialLabel, ariaLabel, height = 150,
}: Props) {
  const gradId = useId().replace(/:/g, '');
  const data = puntos.map((p, i) => ({ ...p, previo: previo?.[i] }));
  const fmt = (n: number) => (ocultarMonto ? MONTO_OCULTO : `$${formatMonto(n)}`);

  const tooltip = (props: TooltipContentProps) => {
    if (!props.active || !props.payload?.length) return null;
    const fila = props.payload[0].payload as PuntoTendencia & { previo?: number };
    if (fila.monto === null) return null;
    const rows = [{ label: fila.label, value: fmt(fila.monto), color: colors.primaryDeep }];
    if (fila.previo !== undefined && previoLabel) {
      rows.push({ label: previoLabel, value: fmt(fila.previo), color: colors.muted });
    }
    return (
      <TooltipCard
        title={fila.completo === false ? `${fila.label} (${parcialLabel})` : fila.label}
        rows={rows}
      />
    );
  };

  const eje = (
    <XAxis
      dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={28}
      tick={{ fontSize: 10, fill: colors.muted }}
    />
  );

  return (
    <div style={{ height, width: '100%' }}>
      <ResponsiveContainer width="100%" height="100%">
        {tipo === 'area' ? (
          <AreaChart data={data} title={ariaLabel} margin={{ top: 8, right: 6, left: 6, bottom: 0 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors.primary} stopOpacity={0.35} />
                <stop offset="100%" stopColor={colors.primary} stopOpacity={0} />
              </linearGradient>
            </defs>
            {eje}
            <YAxis hide domain={[0, 'auto']} />
            <Tooltip content={tooltip} cursor={{ stroke: colors.primaryDeep, strokeDasharray: '3 3' }} />
            {previo && (
              <Area
                dataKey="previo" type="monotone" stroke={colors.muted} strokeWidth={1.5} strokeDasharray="4 4"
                fill="none" dot={false} activeDot={false} isAnimationActive="auto"
              />
            )}
            <Area
              dataKey="monto" type="monotone" stroke={colors.primaryDeep} strokeWidth={2.4} fill={`url(#${gradId})`}
              dot={false} isAnimationActive="auto"
              activeDot={{ r: 5, stroke: colors.primaryDeep, strokeWidth: 2.5, fill: colors.surface }}
            />
          </AreaChart>
        ) : (
          <BarChart data={data} title={ariaLabel} margin={{ top: 8, right: 6, left: 6, bottom: 0 }}>
            {eje}
            <YAxis hide domain={[0, 'auto']} />
            <Tooltip content={tooltip} cursor={{ fill: colors.surfaceSubtle }} />
            <Bar dataKey="monto" radius={[4, 4, 0, 0]} isAnimationActive="auto">
              {data.map((p, i) => (
                <Cell key={i} fill={colors.primaryDeep} fillOpacity={p.completo === false ? 0.45 : 1} />
              ))}
            </Bar>
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
