import type { Metadata } from 'next';
import { AgendaThemeScope } from '@/components/AgendaThemeScope';
import { ProGuard } from '@/components/pro/ProGuard';

// Server Component a propósito: solo así puede exportar `metadata`. El guard (de
// cliente) y el tema van adentro.
//
// Next mezcla la metadata de los segmentos de forma SUPERFICIAL: `appleWebApp`
// del layout raíz se reemplaza entera por esta, así que se repite completa
// (capable y statusBarStyle incluidos) con el nombre del portal.
export const metadata: Metadata = {
  title: 'Turnetto Profesionales',
  description: 'Consultá tu agenda de turnos en cada negocio donde trabajás',
  manifest: '/pro-manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Turnetto Pro',
  },
};

// El tema va por FUERA del guard para que también el Spinner y las pantallas de
// estado (sus colores son variables --ag-* de este scope) queden con la paleta.
export default function ProLayout({ children }: { children: React.ReactNode }) {
  return (
    <AgendaThemeScope>
      <ProGuard>{children}</ProGuard>
    </AgendaThemeScope>
  );
}
