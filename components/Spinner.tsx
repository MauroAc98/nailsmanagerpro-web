'use client';

import { agendaColors } from '@/theme/agendaColors';
import { colors as baseColors } from '@/theme/colors';

// Qué paleta usa el aro:
//  - 'agenda': la de las pantallas con AgendaThemeScope (la mayoría).
//  - 'base': la global, para lo que vive fuera de ese scope (el overlay de
//    <Loader>, que se monta en providers.tsx).
//  - 'sobreOscuro': blanco translúcido, para encima de una foto o un fondo oscuro.
type Variante = 'agenda' | 'base' | 'sobreOscuro';

interface Props {
  size?: number;
  variante?: Variante;
  // Qué se está cargando, para lectores de pantalla (el loader no muestra
  // texto). Sin etiqueta el spinner es decorativo: acompaña a algo que ya dice
  // qué pasa (un overlay sobre un avatar, una pantalla que redirige).
  label?: string;
}

function colorDe(variante: Variante): { aro: string; punta: string } {
  if (variante === 'sobreOscuro') return { aro: 'rgba(255,255,255,0.4)', punta: '#fff' };
  const paleta = variante === 'base' ? baseColors : agendaColors;
  return { aro: paleta.border, punta: paleta.primaryDeep };
}

const grosorDe = (size: number) => (size >= 40 ? 4 : size >= 22 ? 3 : 2);

// Loader en línea (dentro de una lista, un bloque o un overlay puntual), con la
// animación global .loader-spinner. El overlay de pantalla completa es <Loader>.
export function Spinner({ size = 32, variante = 'agenda', label }: Props) {
  const { aro, punta } = colorDe(variante);
  return (
    <div
      {...(label ? { role: 'status', 'aria-label': label } : { 'aria-hidden': true })}
      className="loader-spinner"
      style={{
        width: size, height: size, borderRadius: size / 2, flexShrink: 0,
        borderStyle: 'solid', borderWidth: grosorDe(size), borderColor: aro, borderTopColor: punta,
      }}
    />
  );
}
