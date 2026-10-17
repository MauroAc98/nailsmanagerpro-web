'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { NAV_BUBBLE_POKE, NAV_BUBBLE_SIZE, NAV_HEIGHT, NAV_Z_INDEX } from '@/constants/layout';
import { useRutaPro } from '@/hooks/useRutaPro';
import { rutaLimpiaPro } from '@/lib/pro/rutas';
import { agendaColors, agendaShadows } from '@/theme/agendaColors';

// Alto del nav: quien muestre contenido debajo suma este espacio como padding inferior.
export const PRO_NAV_ALTURA = NAV_HEIGHT;

const BURBUJA_INTERIOR = 48;

// Primary al 55 % (como la app): el portal no importa theme/colors, así que la mezcla va directa.
const FONDO_BURBUJA = `color-mix(in srgb, ${agendaColors.primary} 55%, transparent)`;

// Mismos íconos que la navegación de la app (calendario y persona), en SVG
// propio: el portal no importa lucide-react.
function Icono({ tipo, activo }: { tipo: 'agenda' | 'cuenta'; activo: boolean }) {
  const tamano = activo ? 24 : 22;
  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 24 24"
      fill="none"
      stroke={activo ? agendaColors.primaryDeep : agendaColors.muted}
      strokeWidth={activo ? 2.4 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {tipo === 'agenda' ? (
        <>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </>
      ) : (
        <>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21a8 8 0 0 1 16 0" />
        </>
      )}
    </svg>
  );
}

interface PestanaProps {
  href: string;
  tipo: 'agenda' | 'cuenta';
  etiqueta: string;
  activa: boolean;
}

// La activa lleva la burbuja flotante (asoma por arriba de la barra); la
// inactiva, solo el ícono. La etiqueta baja para dejarle lugar a la burbuja.
function Pestana({ href, tipo, etiqueta, activa }: PestanaProps) {
  return (
    <Link
      href={href}
      aria-current={activa ? 'page' : undefined}
      style={{
        flex: 1,
        height: NAV_HEIGHT,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        textDecoration: 'none',
      }}
    >
      {activa ? (
        <div
          className="nav-bubble-enter"
          style={{
            position: 'absolute',
            top: -NAV_BUBBLE_POKE,
            left: '50%',
            transform: 'translateX(-50%)',
            width: NAV_BUBBLE_SIZE,
            height: NAV_BUBBLE_SIZE,
            borderRadius: '50%',
            backgroundColor: agendaColors.surface,
            border: `1px solid ${agendaColors.border}`,
            boxShadow: agendaShadows.card,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: BURBUJA_INTERIOR,
              height: BURBUJA_INTERIOR,
              borderRadius: '50%',
              backgroundColor: FONDO_BURBUJA,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icono tipo={tipo} activo />
          </div>
        </div>
      ) : (
        <Icono tipo={tipo} activo={false} />
      )}
      <span
        style={{
          fontSize: 11,
          fontWeight: activa ? 700 : 400,
          color: activa ? agendaColors.primaryDeep : agendaColors.sub,
          marginTop: activa ? NAV_BUBBLE_SIZE - 30 : 0,
        }}
      >
        {etiqueta}
      </span>
    </Link>
  );
}

// Navegación inferior del portal: solo Agenda y Cuenta (nada del negocio).
export function ProNav() {
  const t = useTranslations('profesionales');
  const ruta = useRutaPro();
  const limpia = rutaLimpiaPro(usePathname());

  return (
    <nav
      aria-label={t('Nav.etiqueta')}
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: NAV_Z_INDEX,
        paddingBottom: 'env(safe-area-inset-bottom)',
        borderRadius: '20px 20px 0 0',
        backgroundColor: agendaColors.surface,
        boxShadow: agendaShadows.sheet,
        display: 'flex',
        alignItems: 'center',
        // La burbuja de la pestaña activa se dibuja fuera de la barra.
        overflow: 'visible',
      }}
    >
      <Pestana href={ruta('/agenda')} tipo="agenda" etiqueta={t('Nav.agenda')} activa={limpia === '/agenda'} />
      <Pestana href={ruta('/cuenta')} tipo="cuenta" etiqueta={t('Nav.cuenta')} activa={limpia === '/cuenta'} />
    </nav>
  );
}
