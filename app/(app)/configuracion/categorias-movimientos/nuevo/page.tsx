'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import CategoriaMovimientoForm from '@/components/configuracion/CategoriaMovimientoForm';

// `?tab={gasto|ingreso}` — mismo param que usa la lista; sin él (o con un valor
// inesperado) cae en 'gasto', el default histórico.
function Content() {
  const searchParams = useSearchParams();
  const tipo = searchParams.get('tab') === 'ingreso' ? 'ingreso' : 'gasto';
  return <CategoriaMovimientoForm tipo={tipo} nombreOriginal={null} />;
}

// Suspense por useSearchParams (mismo patrón que servicios/nuevo/page.tsx).
export default function NuevaCategoriaMovimientoPage() {
  return (
    <Suspense fallback={null}>
      <Content />
    </Suspense>
  );
}
