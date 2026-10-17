'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';

// Marca del portal (public/pro-logo.png, 256 px). Tamaño fijo en width/height:
// reserva el espacio y no hay salto de layout al cargar. `priority` porque es
// lo primero que se ve en las pantallas de ingreso.
export function LogoPortal() {
  const t = useTranslations('profesionales.LogoPortal');
  return <Image src="/pro-logo.png" alt={t('alt')} width={96} height={96} priority style={{ borderRadius: 20 }} />;
}
