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

  it('con categoriaId manda categoria_id y omite profesional_id aunque se pase', async () => {
    await turnoService.getDisponibilidad('2026-10-01', '2026-10-31', 4, 9);
    expect(api.get).toHaveBeenCalledWith('/turnos/disponibilidad', {
      params: { desde: '2026-10-01', hasta: '2026-10-31', categoria_id: 9 },
    });
  });
});
