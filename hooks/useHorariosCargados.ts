import { useEffect, useRef, useState } from 'react';
import { slotService } from '@/services/slotService';

// Whether each person has at least one ACTIVE horario loaded ("Horarios
// Disponibles", the slots the Slots screen manages). Same rule the backend
// uses to decide online availability (DisponibilidadService::horasActivas:
// active slots of that professional), read through GET /slots?profesional_id.
// Ids still loading, or whose request failed, are simply absent from the
// result: callers must treat "unknown" as "say nothing".
export function useHorariosCargados(ids: number[]): Record<number, boolean> {
  const [cargados, setCargados] = useState<Record<number, boolean>>({});
  const pedidos = useRef(new Set<number>());
  const clave = [...new Set(ids)].sort((a, b) => a - b).join(',');

  useEffect(() => {
    const pendientes = (clave ? clave.split(',').map(Number) : []).filter(id => !pedidos.current.has(id));
    pendientes.forEach(id => {
      pedidos.current.add(id);
      slotService.getAll(id)
        .then(slots => setCargados(prev => ({ ...prev, [id]: slots.some(s => s.activo) })))
        .catch(() => pedidos.current.delete(id));
    });
  }, [clave]);

  return cargados;
}
