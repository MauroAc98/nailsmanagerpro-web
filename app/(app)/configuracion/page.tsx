'use client';

import { useRouter } from 'next/navigation';
import { colors } from '@/theme/colors';

const OPCIONES = [
  {
    path: '/configuracion/servicios',
    title: 'Servicios',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    ),
  },
  {
    path: '/configuracion/slots',
    title: 'Horarios Disponibles',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
  },
  {
    path: '/configuracion/profesionales',
    title: 'Profesionales',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    path: '/configuracion/whatsapp',
    title: 'Vincular WhatsApp',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={colors.primary} xmlns="http://www.w3.org/2000/svg">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
      </svg>
    ),
  },
  {
    path: '/configuracion/ayuda',
    title: 'Ayuda',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    ),
  },
];

export default function ConfiguracionPage() {
  const router = useRouter();

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#fff', paddingBottom: 100 }}>
      <div style={{ padding: '24px 20px 12px' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: colors.text, margin: 0 }}>Configuración</h1>
      </div>

      <div style={{ padding: '10px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {OPCIONES.map(op => (
          <button
            key={op.path}
            onClick={() => router.push(op.path)}
            style={{
              display: 'flex', alignItems: 'center', gap: 15,
              backgroundColor: '#FFF', border: '1px solid #EEE',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)', borderRadius: 14,
              padding: '14px 16px', cursor: 'pointer', textAlign: 'left',
            }}
          >
            <div style={{
              width: 40, height: 40, backgroundColor: '#F9F9F9',
              borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              {op.icon}
            </div>
            <span style={{ flex: 1, fontSize: 16, fontWeight: 600, color: colors.text }}>
              {op.title}
            </span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#CCC" strokeWidth="2">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}
