'use client';

import { useParams } from 'next/navigation';
import { DetalleServicioScreen } from '@/components/reservaOnline/DetalleServicioScreen';
import { useIr } from '@/components/reservaOnline/hooks';

// Pagina delgada: slug e id vienen de la URL y la navegacion se inyecta al
// componente, que concentra la logica y los tests (decision D1).
export default function Page() {
  const params = useParams<{ slug: string; id: string }>();
  const ir = useIr();
  return <DetalleServicioScreen slug={params.slug} servicioId={Number(params.id)} ir={ir} />;
}
