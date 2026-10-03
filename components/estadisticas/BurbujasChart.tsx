'use client';

import {
  Cell, CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis,
  type TooltipContentProps,
} from 'recharts';
import { agendaColors as colors } from '@/theme/agendaColors';
import { formatMonto } from '@/lib/money';
import { TooltipCard } from './TooltipCard';

export interface BurbujaServicio {
  servicio_id: number;
  nombre: string;
  turnos: number;
  ticket: number;
  monto: number;
  color: string;
}

interface Props {
  servicios: BurbujaServicio[];
  ejes: { turnos: string; ticket: string; monto: string };
  ocultarMonto: boolean;
  ariaLabel: string;
  height?: number;
}

const MONTO_OCULTO = '$ ●●●●●';

export default function BurbujasChart({ servicios, ejes, ocultarMonto, ariaLabel, height = 230 }: Props) {
  const fmt = (n: number) => (ocultarMonto ? MONTO_OCULTO : `$${formatMonto(n)}`);

  const tooltip = (props: TooltipContentProps) => {
    if (!props.active || !props.payload?.length) return null;
    const s = props.payload[0].payload as BurbujaServicio;
    return (
      <TooltipCard
        title={s.nombre}
        rows={[
          { label: ejes.turnos, value: String(s.turnos), color: s.color },
          { label: ejes.ticket, value: fmt(s.ticket) },
          { label: ejes.monto, value: fmt(s.monto) },
        ]}
      />
    );
  };

  return (
    <div style={{ height, width: '100%', borderRadius: 16, backgroundColor: colors.surfaceSubtle, padding: '8px 4px 0 0' }}>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart title={ariaLabel} margin={{ top: 14, right: 22, left: 4, bottom: 4 }}>
          <CartesianGrid stroke={colors.hairline} strokeDasharray="3 3" />
          <XAxis
            type="number" dataKey="turnos" name={ejes.turnos} allowDecimals={false} domain={[0, 'auto']}
            tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: colors.muted }}
          />
          <YAxis
            type="number" dataKey="ticket" name={ejes.ticket} width={ocultarMonto ? 8 : 44} domain={[0, 'auto']}
            tickLine={false} axisLine={false} tick={ocultarMonto ? false : { fontSize: 10, fill: colors.muted }}
            tickFormatter={(v: number) => `$${formatMonto(v).replace(/,\d+$/, '')}`}
          />
          <ZAxis type="number" dataKey="monto" name={ejes.monto} range={[260, 1500]} />
          <Tooltip content={tooltip} cursor={{ strokeDasharray: '3 3', stroke: colors.border }} />
          <Scatter data={servicios} isAnimationActive="auto">
            {servicios.map(s => <Cell key={s.servicio_id} fill={s.color} fillOpacity={0.88} stroke={colors.surface} strokeWidth={1.5} />)}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
