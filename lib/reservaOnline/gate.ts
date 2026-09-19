import { notFound } from 'next/navigation';
import { reservaOnlineHabilitada } from './flag';

interface Deps {
  habilitada?: () => boolean;
  notFound?: () => never;
}

// Gate del layout app/reservar/[slug]: con la flag apagada la ruta responde
// 404. Extraido para poder testearlo sin montar un Server Component; las
// dependencias se inyectan (sin mockear modulos).
export function exigirReservaOnlineHabilitada(deps: Deps = {}): void {
  const habilitada = deps.habilitada ?? reservaOnlineHabilitada;
  const noEncontrada = deps.notFound ?? notFound;
  if (!habilitada()) noEncontrada();
}
