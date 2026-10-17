'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { SegmentedControl } from '@/components/SegmentedControl';
import { NAV_HEIGHT, NAV_Z_INDEX } from '@/constants/layout';
import { useRutaPro } from '@/hooks/useRutaPro';
import { rutaLimpiaPro } from '@/lib/pro/rutas';
import { useProAgendaStore, type VistaAgenda } from '@/store/useProAgendaStore';
import { agendaColors } from '@/theme/agendaColors';

// Alto de la fila del selector día/mes (solo en la agenda) y del nav completo:
// quien muestre contenido debajo del nav suma este espacio como padding inferior.
const ALTO_SELECTOR = 64;
export const PRO_NAV_ALTURA_AGENDA = NAV_HEIGHT + ALTO_SELECTOR;

// Navegación inferior del portal: solo Agenda y Cuenta (nada del negocio). En la
// agenda suma el selector día/mes.
export function ProNav() {
  const t = useTranslations('profesionales');
  const ruta = useRutaPro();
  const pathname = usePathname();
  const vista = useProAgendaStore((s) => s.vista);
  const limpia = rutaLimpiaPro(pathname);
  const enAgenda = limpia === '/agenda';
  const enCuenta = limpia === '/cuenta';

  const opciones: readonly { value: VistaAgenda; label: string }[] = [
    { value: 'dia', label: t('Agenda.dia') },
    { value: 'mes', label: t('Agenda.mes') },
  ];

  const enlace = (activo: boolean): React.CSSProperties => ({
    flex: 1,
    minHeight: 44,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 15,
    fontWeight: activo ? 700 : 500,
    textDecoration: 'none',
    color: activo ? agendaColors.primaryDeep : agendaColors.sub,
  });

  return (
    <nav
      aria-label={t('Nav.etiqueta')}
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: NAV_Z_INDEX,
        boxSizing: 'border-box',
        paddingBottom: 'env(safe-area-inset-bottom)',
        backgroundColor: agendaColors.surface,
        borderTop: `1px solid ${agendaColors.border}`,
      }}
    >
      {enAgenda && (
        <div style={{ padding: '8px 16px 0' }}>
          <SegmentedControl
            ariaLabel={t('Agenda.vista')}
            options={opciones}
            value={vista}
            onChange={(v) => useProAgendaStore.getState().setVista(v)}
          />
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', minHeight: NAV_HEIGHT - 20, padding: '0 16px' }}>
        <Link href={ruta('/agenda')} aria-current={enAgenda ? 'page' : undefined} style={enlace(enAgenda)}>
          {t('Nav.agenda')}
        </Link>
        <Link href={ruta('/cuenta')} aria-current={enCuenta ? 'page' : undefined} style={enlace(enCuenta)}>
          {t('Nav.cuenta')}
        </Link>
      </div>
    </nav>
  );
}
