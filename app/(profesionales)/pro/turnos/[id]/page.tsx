import { DetalleTurnoPro } from '@/components/pro/DetalleTurnoPro';

// Detalle de un turno. El id lo lee y valida el componente cliente (useParams);
// ProGuard (en el layout) decide si la persona puede estar acá.
export default function DetalleTurnoPage() {
  return <DetalleTurnoPro />;
}
