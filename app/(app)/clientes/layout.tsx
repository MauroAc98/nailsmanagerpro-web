'use client';

import { AgendaThemeScope } from '@/components/AgendaThemeScope';

export default function ClientesLayout({ children }: { children: React.ReactNode }) {
  return <AgendaThemeScope>{children}</AgendaThemeScope>;
}
