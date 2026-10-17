import { CambiarPasswordProForm } from '@/components/pro/CambiarPasswordProForm';

// Cambio forzado de contraseña: solo accesible con sesión restringida (lo decide ProGuard).
export default function CambiarPasswordProPage() {
  return <CambiarPasswordProForm />;
}
