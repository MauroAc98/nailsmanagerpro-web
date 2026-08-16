import { Suspense } from 'react';
import type { Metadata } from 'next';
import { LoginScreen } from '@/components/LoginScreen';
import { colors } from '@/theme/colors';

interface Props {
  params: Promise<{ slug: string }>;
}

// Server Component (única excepción a "todo cliente" en las rutas
// dinámicas de este proyecto): generateMetadata solo corre en componentes
// de servidor, y es la única forma de que "Agregar a Inicio" instale un
// ícono con el manifest correcto por negocio — ver
// app/api/manifest/[slug]/route.ts para el porqué.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return { manifest: `/api/manifest/${slug}` };
}

export default async function LoginPageConSlug({ params }: Props) {
  const { slug } = await params;

  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', backgroundColor: colors.background }} />}>
      {/* key=slug: si navegan de /login/a a /login/b sin recargar, remonta
          en vez de arrastrar el branding del negocio anterior mientras
          resuelve el nuevo fetch. */}
      <LoginScreen key={slug} slug={slug} />
    </Suspense>
  );
}
