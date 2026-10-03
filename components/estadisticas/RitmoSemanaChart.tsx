'use client';

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from 'recharts';
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
  // Día de la semana ISO elegido para filtrar (null = ninguno). El toggle lo
  // resuelve el padre: este componente solo avisa qué día se tocó.
  seleccionado: number | null;
  onSeleccionar: (diaSemana: number) => void;
  height?: number;
}

const MARGEN = 4;

export default function RitmoSemanaChart({ dias, labels, ariaLabel, seleccionado, onSeleccionar, height = 130 }: Props) {
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

  // Los demás días se atenúan cuando hay uno elegido.
  const opacidad = (dia: number) => (seleccionado === null || seleccionado === dia ? 1 : 0.28);
  const celdas = (color: string) => dias.map(d => <Cell key={d.dia_semana} fill={color} fillOpacity={opacidad(d.dia_semana)} />);
  const alTocar = (_: unknown, index: number) => onSeleccionar(dias[index].dia_semana);

  return (
    <div>
      {/* touch-action: pan-y — el tap selecciona pero el arrastre vertical
          sigue siendo scroll de la página. */}
      <div style={{ height, width: '100%', touchAction: 'pan-y' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={dias} title={ariaLabel} margin={{ top: 4, right: MARGEN, left: MARGEN, bottom: 0 }} barCategoryGap="22%">
            <XAxis dataKey="label" hide />
            <YAxis hide allowDecimals={false} />
            <Tooltip content={tooltip} cursor={{ fill: colors.surfaceSubtle }} />
            <Bar dataKey="completados" stackId="turnos" fill={colors.success} onClick={alTocar} isAnimationActive="auto">
              {celdas(colors.success)}
            </Bar>
            <Bar dataKey="confirmados" stackId="turnos" fill={colors.primary} onClick={alTocar} isAnimationActive="auto">
              {celdas(colors.primary)}
            </Bar>
            <Bar dataKey="cancelados" stackId="turnos" fill={colors.danger} radius={[4, 4, 0, 0]} onClick={alTocar} isAnimationActive="auto">
              {celdas(colors.danger)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* Fila de botones reales alineada con las columnas: target cómodo
          (>=44px), accesible por teclado y sin depender de acertarle a una
          barra finita con el dedo. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', padding: `0 ${MARGEN}px`, marginTop: 2 }}>
        {dias.map(d => {
          const activo = seleccionado === d.dia_semana;
          return (
            <button
              key={d.dia_semana}
              type="button"
              aria-pressed={activo}
              onClick={() => onSeleccionar(d.dia_semana)}
              style={{
                minHeight: 44, minWidth: 0, border: 'none', cursor: 'pointer', touchAction: 'manipulation',
                background: 'none', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <span style={{
                minWidth: 28, padding: '4px 0', borderRadius: 999, fontSize: 11, fontWeight: 700,
                backgroundColor: activo ? colors.primarySolid : 'transparent',
                color: activo ? colors.primaryFg : colors.subtext,
              }}>
                {d.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
