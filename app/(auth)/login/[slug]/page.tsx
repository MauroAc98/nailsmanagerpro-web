'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { LoginScreen } from '@/components/LoginScreen';
import { colors } from '@/theme/colors';

export default function LoginPageConSlug() {
  const params = useParams<{ slug: string }>();
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;

  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', backgroundColor: colors.background }} />}>
      {/* key=slug: si navegan de /login/a a /login/b sin recargar, remonta
          en vez de arrastrar el branding del negocio anterior mientras
          resuelve el nuevo fetch. */}
      <LoginScreen key={slug} slug={slug} />
    </Suspense>
  );
}
