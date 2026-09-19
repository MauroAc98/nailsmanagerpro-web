import { exigirReservaOnlineHabilitada } from '@/lib/reservaOnline/gate';
import { PublicShell } from '@/components/reservaOnline/PublicShell';

// Server Component: con la flag apagada la ruta entera responde 404 (decision
// D4). Ruta neutral en lib/authRouteClasses.ts: no pasa por el guard de auth.
export default function ReservarLayout({ children }: { children: React.ReactNode }) {
  exigirReservaOnlineHabilitada();
  return <PublicShell>{children}</PublicShell>;
}
