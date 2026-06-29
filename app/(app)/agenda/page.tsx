'use client';

import { useAuth } from '@/hooks/useAuth';

export default function AgendaPage() {
  const { nombreEstudio } = useAuth();

  return (
    <div style={{ padding: '24px', paddingBottom: '100px' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#333', marginBottom: 16 }}>
        Hola, {nombreEstudio || 'Profesional'}
      </h1>
      
      <p style={{ color: '#666', marginBottom: 24 }}>
        Agenda de turnos
      </p>

      <div style={{ backgroundColor: '#f5f5f5', padding: 24, borderRadius: 12, textAlign: 'center' }}>
        <p style={{ color: '#999' }}>
          La agenda se está desarrollando...
        </p>
      </div>
    </div>
  );
}