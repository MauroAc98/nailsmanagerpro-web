'use client';

import { Suspense } from 'react';
import { LoginScreen } from '@/components/LoginScreen';
import { colors } from '@/theme/colors';

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', backgroundColor: colors.background }} />}>
      <LoginScreen />
    </Suspense>
  );
}
