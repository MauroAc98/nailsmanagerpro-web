import { OlvidePasswordForm } from '@/components/pro/OlvidePasswordForm';

// Pedido del código de recuperación. ProGuard (en el layout) deja pasar solo a
// quien no tiene sesión.
export default function OlvidePasswordPage() {
  return <OlvidePasswordForm />;
}
