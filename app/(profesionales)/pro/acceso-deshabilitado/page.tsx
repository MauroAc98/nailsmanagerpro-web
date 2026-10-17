import { EstadoVinculo } from '@/components/pro/EstadoVinculo';

// Destino del guard cuando el acceso al negocio fue quitado (resolveProRoute).
export default function AccesoDeshabilitadoPage() {
  return <EstadoVinculo variante="deshabilitado" />;
}
