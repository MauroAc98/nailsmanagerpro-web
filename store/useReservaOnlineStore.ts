import { create } from 'zustand';
import type { FlowData } from '@/lib/reservaOnline/pasoMinimo';
import type { ClienteInput, Fecha, Hora } from '@/lib/reservaOnline/types';

// Estado del flujo publico de reserva (decision D6). Se persiste en
// sessionStorage con clave POR SLUG (`ro_flow_<slug>`): un refresh o deep link
// restaura lo elegido, y dos salones abiertos en pestanas distintas no se
// pisan. sessionStorage (no local): el flujo muere al cerrar la pestana.
//
// La persistencia es manual (no el middleware `persist`) porque la clave
// depende del slug, que solo se conoce en runtime.

export const claveFlujo = (slug: string): string => `ro_flow_${slug}`;

const vacio = (): FlowData => ({
  servicioIds: [],
  profesionalId: 'any',
  fecha: null,
  hora: null,
  cliente: { nombre: '', apellido: '', whatsapp: '' },
  reservaId: null,
  nota: '',
});

interface FlowState extends FlowData {
  slug: string | null;
  activarSlug: (slug: string) => void;
  setServicios: (ids: number[]) => void;
  setProfesional: (id: number | 'any') => void;
  setHorario: (fecha: Fecha, hora: Hora) => void;
  setCliente: (parcial: Partial<ClienteInput>) => void;
  setReservaId: (id: string) => void;
  setNota: (nota: string) => void;
  // Reserva confirmada: limpia lo guardado y el estado (conserva el slug).
  confirmar: () => void;
  reiniciar: () => void;
}

const datosDe = (s: FlowState): FlowData => ({
  servicioIds: s.servicioIds,
  profesionalId: s.profesionalId,
  fecha: s.fecha,
  hora: s.hora,
  cliente: s.cliente,
  reservaId: s.reservaId,
  nota: s.nota,
});

function leer(slug: string): FlowData | null {
  try {
    const raw = sessionStorage.getItem(claveFlujo(slug));
    if (!raw) return null;
    return { ...vacio(), ...(JSON.parse(raw) as Partial<FlowData>) };
  } catch {
    // sessionStorage no disponible o JSON corrupto: se arranca vacio
    return null;
  }
}

function escribir(slug: string, datos: FlowData | null): void {
  try {
    if (datos) sessionStorage.setItem(claveFlujo(slug), JSON.stringify(datos));
    else sessionStorage.removeItem(claveFlujo(slug));
  } catch {
    // sin storage el flujo sigue funcionando en memoria, solo no sobrevive al refresh
  }
}

export const useReservaOnlineStore = create<FlowState>((set, get) => {
  // Aplica un cambio y lo persiste bajo el slug activo.
  const aplicar = (cambio: Partial<FlowData>) => {
    set(cambio);
    const s = get();
    if (s.slug) escribir(s.slug, datosDe(s));
  };

  return {
    slug: null,
    ...vacio(),
    activarSlug: (slug) => set({ slug, ...(leer(slug) ?? vacio()) }),
    // Cambiar servicios o profesional invalida el horario ya elegido: los
    // slots dependen de la duracion total y de quien atiende.
    setServicios: (ids) => aplicar({ servicioIds: ids, fecha: null, hora: null }),
    setProfesional: (id) => aplicar({ profesionalId: id, fecha: null, hora: null }),
    setHorario: (fecha, hora) => aplicar({ fecha, hora }),
    setCliente: (parcial) => aplicar({ cliente: { ...get().cliente, ...parcial } }),
    setReservaId: (id) => aplicar({ reservaId: id }),
    setNota: (nota) => aplicar({ nota }),
    confirmar: () => {
      const { slug } = get();
      if (slug) escribir(slug, null);
      set({ ...vacio() });
    },
    reiniciar: () => set({ slug: null, ...vacio() }),
  };
});
