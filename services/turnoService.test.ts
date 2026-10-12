import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', () => ({
  default: { get: vi.fn().mockResolvedValue({ data: [] }) },
}));

import api from '@/lib/api';
import { turnoService } from './turnoService';

describe('turnoService.getDisponibilidad', () => {
  beforeEach(() => vi.mocked(api.get).mockClear());

  it('sin filtros manda solo desde/hasta', async () => {
    await turnoService.getDisponibilidad('2026-10-01', '2026-10-31');
    expect(api.get).toHaveBeenCalledWith('/turnos/disponibilidad', {
      params: { desde: '2026-10-01', hasta: '2026-10-31' },
    });
  });

  it('con profesionalId manda profesional_id (comportamiento de siempre)', async () => {
    await turnoService.getDisponibilidad('2026-10-01', '2026-10-31', 4);
    expect(api.get).toHaveBeenCalledWith('/turnos/disponibilidad', {
      params: { desde: '2026-10-01', hasta: '2026-10-31', profesional_id: 4 },
    });
  });

  it('con servicioIds manda servicio_ids junto a profesional_id', async () => {
    await turnoService.getDisponibilidad('2026-10-01', '2026-10-31', 4, [7, 8]);
    expect(api.get).toHaveBeenCalledWith('/turnos/disponibilidad', {
      params: { desde: '2026-10-01', hasta: '2026-10-31', profesional_id: 4, servicio_ids: [7, 8] },
    });
  });

  it('con servicioIds y sin profesional manda solo servicio_ids (equipo)', async () => {
    await turnoService.getDisponibilidad('2026-10-01', '2026-10-31', undefined, [7]);
    expect(api.get).toHaveBeenCalledWith('/turnos/disponibilidad', {
      params: { desde: '2026-10-01', hasta: '2026-10-31', servicio_ids: [7] },
    });
  });

  it('con servicioIds vacío no manda servicio_ids', async () => {
    await turnoService.getDisponibilidad('2026-10-01', '2026-10-31', 4, []);
    expect(api.get).toHaveBeenCalledWith('/turnos/disponibilidad', {
      params: { desde: '2026-10-01', hasta: '2026-10-31', profesional_id: 4 },
    });
  });
});
