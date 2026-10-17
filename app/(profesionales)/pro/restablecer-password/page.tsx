import { Suspense } from 'react';
import type { Metadata } from 'next';
import { RestablecerForm } from '@/components/pro/RestablecerForm';

// El link del correo puede traer el correo y el código en la URL. El formulario
// los saca de la barra al montar, pero hasta entonces (y en cualquier recurso
// que cargue la página) el navegador no debe mandarlos como Referer a nadie.
export const metadata: Metadata = {
  referrer: 'no-referrer',
};

// useSearchParams necesita Suspense en el render estático. ProGuard (en el
// layout) deja pasar solo a quien no tiene sesión.
export default function RestablecerPasswordPage() {
  return (
    <Suspense fallback={null}>
      <RestablecerForm />
    </Suspense>
  );
}
