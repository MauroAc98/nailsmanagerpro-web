'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Spinner } from '@/components/Spinner';
import { calcularAcceso } from '@/lib/pro/acceso';
import { resolveProRoute } from '@/lib/pro/resolveProRoute';
import { useLocaleStore } from '@/store/useLocaleStore';
import { iniciarEscuchasPro, useProAuthStore } from '@/store/useProAuthStore';
import { agendaColors } from '@/theme/agendaColors';

// Guard del portal de profesionales. Vive en el layout del portal
// (app/(profesionales)/pro/layout.tsx) y es la ÚNICA puerta: app/providers.tsx
// no hace nada en este portal (esSuperficieAjenaAlSalon). No toca ningún store,
// evento ni splash del tenant: mientras decide muestra un Spinner neutro, nunca
// el BootSplash ni la bienvenida del salón.
//
// La decisión es de lib/pro/resolveProRoute.ts (pura): el efecto de navegación
// y el render leen el mismo resultado y no pueden contradecirse. `pathname` es
// el que ve el navegador: limpio en profesionales.turnetto.com, bajo /pro en
// localhost; el resolver devuelve los redirects ya en ese mismo modo.
export function ProGuard({ children }: { children: React.ReactNode }) {
  const t = useTranslations('profesionales.Guard');
  const router = useRouter();
  const pathname = usePathname();
  const status = useProAuthStore((s) => s.status);
  const vinculos = useProAuthStore((s) => s.vinculos);
  const vinculoActivoId = useProAuthStore((s) => s.vinculoActivoId);
  const bloqueos = useProAuthStore((s) => s.bloqueos);
  // Igual que el guard del salón: con pt-BR el catálogo carga con un import
  // asíncrono y, sin esperar, el primer pintado saldría en español.
  const mensajesListos = useLocaleStore((s) => s.mensajesListos);

  // Las escuchas se montan ANTES de inicializar: así un 401 o un 404 que llegue
  // durante el arranque no se pierde.
  useEffect(() => {
    const quitarEscuchas = iniciarEscuchasPro();
    useProAuthStore.getState().inicializar();
    return quitarEscuchas;
  }, []);

  const ruta = mensajesListos
    ? resolveProRoute({ status, acceso: calcularAcceso(vinculos, vinculoActivoId, bloqueos) }, pathname)
    : ({ type: 'blank' } as const);

  const destino = ruta.type === 'redirect' ? ruta.to : null;
  useEffect(() => {
    if (destino !== null) router.replace(destino);
  }, [destino, router]);

  if (ruta.type === 'allow') return <>{children}</>;

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: agendaColors.bg,
      }}
    >
      <Spinner label={t('esperando')} />
    </div>
  );
}
