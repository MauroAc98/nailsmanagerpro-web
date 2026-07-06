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
