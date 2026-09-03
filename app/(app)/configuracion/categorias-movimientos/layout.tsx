'use client';

import { AgendaThemeScope } from '@/components/AgendaThemeScope';

// Igual que ingresos/gastos: la pantalla usa el sistema agendaColors, así
// que necesita el scope que define las vars --ag-* (sin esto se ve rota en
// claro y en oscuro).
export default function CategoriasMovimientosLayout({ children }: { children: React.ReactNode }) {
  return <AgendaThemeScope>{children}</AgendaThemeScope>;
}
