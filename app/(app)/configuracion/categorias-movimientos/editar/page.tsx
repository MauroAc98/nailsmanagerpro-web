'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import CategoriaMovimientoForm from '@/components/configuracion/CategoriaMovimientoForm';

// `?tab={gasto|ingreso}&nombre=<categoría>` — la categoría se identifica por
// nombre porque son strings del perfil, sin id.
function Content() {
  const searchParams = useSearchParams();
  const tipo = searchParams.get('tab') === 'ingreso' ? 'ingreso' : 'gasto';
  const nombre = searchParams.get('nombre') ?? '';
  return <CategoriaMovimientoForm key={`${tipo}:${nombre}`} tipo={tipo} nombreOriginal={nombre} />;
}

export default function EditarCategoriaMovimientoPage() {
  return (
    <Suspense fallback={null}>
      <Content />
    </Suspense>
  );
}
