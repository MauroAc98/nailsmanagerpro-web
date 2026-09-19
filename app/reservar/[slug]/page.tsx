'use client';

import { useParams } from 'next/navigation';
import { EntryScreen } from '@/components/reservaOnline/EntryScreen';
import { useIr } from '@/components/reservaOnline/hooks';

// Pagina delgada: el slug viene de la URL y la navegacion se inyecta al
// componente, que concentra la logica y los tests (decision D1).
export default function Page() {
  const params = useParams<{ slug: string }>();
  const ir = useIr();
  return <EntryScreen slug={params.slug} ir={ir} />;
}
