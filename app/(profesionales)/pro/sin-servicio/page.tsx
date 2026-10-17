import { EstadoVinculo } from '@/components/pro/EstadoVinculo';

// Destino del guard cuando el negocio no tiene servicio (resolveProRoute).
export default function SinServicioPage() {
  return <EstadoVinculo variante="sinServicio" />;
}
