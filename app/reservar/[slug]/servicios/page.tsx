'use client';

import { useParams } from 'next/navigation';
import { ServiciosScreen } from '@/components/reservaOnline/ServiciosScreen';
import { useIr } from '@/components/reservaOnline/hooks';

// Pagina delgada: el slug viene de la URL y la navegacion se inyecta al
// componente, que concentra la logica y los tests (decision D1).
export default function Page() {
  const params = useParams<{ slug: string }>();
  const ir = useIr();
  return <ServiciosScreen slug={params.slug} ir={ir} />;
}
