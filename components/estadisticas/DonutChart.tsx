'use client';

import { useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { agendaColors as colors, agendaFontSerif } from '@/theme/agendaColors';

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
  // Sin tarjeta flotante: en una dona de ~110-128px el tooltip (hasta 220px)
  // tapaba la propia dona y su leyenda. El detalle de la rebanada se muestra en
  // el centro: al pasar el mouse (hover) o, en el celular, al tocarla (fija
  // hasta tocarla de nuevo). Hover y fijado van separados para que un click
  // con el mouse encima no borre lo que se está viendo.
  const [hover, setHover] = useState<number | null>(null);
  const [fijo, setFijo] = useState<number | null>(null);
  const activo = hover ?? fijo;
  const rebanada = activo !== null ? data[activo] : undefined;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart title={ariaLabel}>
            <Pie
              data={data} dataKey="value" nameKey="name" innerRadius="66%" outerRadius="100%"
              paddingAngle={data.length > 1 ? 2 : 0} stroke="none" isAnimationActive="auto"
              onMouseEnter={(_: unknown, i: number) => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onClick={(_: unknown, i: number) => setFijo(prev => (prev === i ? null : i))}
            >
              {data.map((d, i) => (
                <Cell key={d.name} fill={d.color} fillOpacity={activo === null || activo === i ? 1 : 0.35} style={{ cursor: 'pointer' }} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div data-testid="dona-centro" style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
        }}>
          <span style={{ fontFamily: agendaFontSerif, fontSize: 22, lineHeight: 1, color: colors.textStrong }}>
            {rebanada ? rebanada.value : centerValue}
          </span>
          <span style={{
            fontSize: 10, color: colors.subtext, marginTop: 2, maxWidth: size * 0.56, textAlign: 'center', lineHeight: 1.15,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere',
          }}>
            {rebanada ? rebanada.name : centerLabel}
          </span>
        </div>
      </div>
      <ul style={{ flex: 1, minWidth: 0, margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 9 }}>
        {data.map((d, i) => (
          <li key={d.name} style={{
            display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, minWidth: 0,
            color: colors.text, fontWeight: activo === i ? 700 : 400,
          }}>
            <span style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: d.color, flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
            <b style={{ flexShrink: 0 }}>{d.valorLabel}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}
