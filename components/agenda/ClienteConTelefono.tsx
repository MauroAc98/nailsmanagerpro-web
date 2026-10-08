'use client';

import { agendaColors as colors } from '@/theme/agendaColors';

interface Props {
  cliente: { nombre: string; apellido?: string | null; telefono?: string | null };
  // 'fila': una opción de la lista (nombre y, debajo, el teléfono).
  // 'campo': el cliente ya elegido, en el campo del formulario (en una línea).
  variante: 'fila' | 'campo';
}

// Nombre del cliente con su teléfono: dos clientes pueden llamarse igual, y el
// teléfono es lo que los distingue al elegir uno.
export function ClienteConTelefono({ cliente, variante }: Props) {
  const nombre = `${cliente.nombre} ${cliente.apellido ?? ''}`.trim();
  const telefono = cliente.telefono?.trim() || null;

  if (variante === 'campo') {
    return (
      <span style={{
        flex: 1, minWidth: 0, display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 15, color: colors.text,
      }}>
        <span style={{ minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nombre}</span>
        {telefono && <span style={{ flexShrink: 0, fontSize: 12, color: colors.subtext }}>{telefono}</span>}
      </span>
    );
  }

  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 15, color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis' }}>{nombre}</div>
      {telefono && <div style={{ marginTop: 2, fontSize: 12, color: colors.subtext }}>{telefono}</div>}
    </div>
  );
}
