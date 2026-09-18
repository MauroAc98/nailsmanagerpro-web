import { nombreDia } from '@/lib/dateFormat';

// Helpers compartidos entre los distintos componentes de la pantalla de
// agenda (page.tsx, SwipeableTurnoCard, WeekStrip) — extraídos a un módulo
// aparte porque page.tsx no puede re-exportar componentes/funciones propias
// (Next.js valida en build time que un archivo `page.tsx` del App Router
// solo exporte las convenciones de ruta soportadas — default, metadata,
// generateStaticParams, etc. — cualquier otro named export rompe
// `tsc --noEmit` contra `.next/types/.../page.ts`).

export function fechaDeHora(fechaHora: string): string {
  return fechaHora.slice(0, 10); // "YYYY-MM-DD"
}

export function horaDeHora(fechaHora: string): string {
  return fechaHora.slice(11, 16); // "HH:MM"
}

export function formatFechaMini(fechaHora: string): string {
  const dateStr = fechaDeHora(fechaHora);
  const parts   = dateStr.split('-');
  const mm      = parts[1];
  const dd      = parts[2];
  const d       = new Date(dateStr + 'T00:00:00');
  return `${nombreDia(d, 'short')} ${dd}/${mm}`;
}

export function formatCellDate(d: Date): string {
  const y   = d.getFullYear();
  const m   = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Multi-agenda — nombre + color de la profesional a cargo, para la tercera
// línea de timeSection en SwipeableTurnoCard/FinalizadoCard. undefined/null
// = no se muestra (cuenta con ≤1 profesional activa, o la vista ya está
// filtrada a una sola).
export interface ProfesionalLabel {
  nombre: string;
  color:  string;
}
