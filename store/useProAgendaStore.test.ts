import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useProAgendaStore } from '@/store/useProAgendaStore';
import { useProAuthStore, registrarResetPorNegocio } from '@/store/useProAuthStore';
import { cacheTurnosDia, vaciarCachesPro } from '@/lib/pro/caches';
import { hoyDelDispositivo } from '@/lib/pro/hoy';
import type { ProVinculo } from '@/lib/pro/tipos';

const vinculo = (id: number): ProVinculo => ({
  id,
  negocioNombre: `Negocio ${id}`,
  profesional: { nombre: 'Ana', apellido: null, avatar_url: null },
  disponible: true,
  motivo: null,
});

const lista = { turnos: [], truncated: false, descartados: 0 };

describe('useProAgendaStore', () => {
  beforeEach(() => {
    vaciarCachesPro();
    useProAgendaStore.getState().reset();
    useProAuthStore.setState({
      status: 'full',
      token: 't',
      vinculos: [vinculo(1), vinculo(2)],
      vinculoActivoId: 1,
      bloqueos: {},
    });
  });
  afterEach(() => vi.useRealTimers());

  it('arranca en hoy, mes de hoy y sin filtros', () => {
    const hoy = hoyDelDispositivo();
    const s = useProAgendaStore.getState();
    expect(s.fecha).toBe(hoy);
    expect(s.mesVisto).toBe(hoy.slice(0, 7));
    expect(s.filtros).toEqual({ buscar: '', servicioId: null, desde: null, hasta: null });
  });

  it('setFecha acomoda mesVisto al mes de la fecha', () => {
    useProAgendaStore.getState().setFecha('2026-03-09');
    const s = useProAgendaStore.getState();
    expect(s.fecha).toBe('2026-03-09');
    expect(s.mesVisto).toBe('2026-03');
  });

  it('ignora una fecha o un mes inválidos', () => {
    const antes = useProAgendaStore.getState().fecha;
    useProAgendaStore.getState().setFecha('2026-02-31');
    useProAgendaStore.getState().setMesVisto('2026-13');
    expect(useProAgendaStore.getState().fecha).toBe(antes);
    expect(useProAgendaStore.getState().mesVisto).toBe(antes.slice(0, 7));
  });

  it('setFiltros combina sin pisar los demás filtros', () => {
    const { setFiltros } = useProAgendaStore.getState();
    setFiltros({ buscar: 'ana' });
    setFiltros({ servicioId: 4 });
    const s = useProAgendaStore.getState();
    expect(s.filtros).toEqual({ buscar: 'ana', servicioId: 4, desde: null, hasta: null });
  });

  it('limpiarFiltros vuelve a hoy', () => {
    const { setFiltros, setFecha, limpiarFiltros } = useProAgendaStore.getState();
    setFecha('2026-03-09');
    setFiltros({ buscar: 'x', desde: '2026-03-01', hasta: '2026-03-10' });
    limpiarFiltros();
    const s = useProAgendaStore.getState();
    expect(s.fecha).toBe(hoyDelDispositivo());
    expect(s.filtros).toEqual({ buscar: '', servicioId: null, desde: null, hasta: null });
  });

  it('un cambio de negocio vuelve a hoy, sin filtros, y vacía las cachés (SE-10 S1)', () => {
    useProAgendaStore.getState().setFecha('2026-03-09');
    useProAgendaStore.getState().setFiltros({ buscar: 'ana' });
    cacheTurnosDia.set('1:dia:2026-03-09', lista);
    useProAuthStore.getState().elegirVinculo(2);
    expect(useProAgendaStore.getState().fecha).toBe(hoyDelDispositivo());
    expect(useProAgendaStore.getState().filtros.buscar).toBe('');
    expect(cacheTurnosDia.get('1:dia:2026-03-09')).toBeUndefined();
  });

  it('el cierre de sesión también lo reinicia', async () => {
    useProAgendaStore.getState().setFiltros({ buscar: 'ana' });
    cacheTurnosDia.set('1:dia:2026-03-09', lista);
    useProAuthStore.getState().expirar('expired');
    expect(useProAgendaStore.getState().filtros.buscar).toBe('');
    expect(cacheTurnosDia.size()).toBe(0);
  });

  it('el reset registrado sigue activo junto con otros registros', () => {
    const otro = vi.fn();
    const baja = registrarResetPorNegocio(otro);
    useProAgendaStore.getState().setFiltros({ buscar: 'ana' });
    useProAuthStore.getState().expirar('expired');
    expect(otro).toHaveBeenCalled();
    expect(useProAgendaStore.getState().filtros.buscar).toBe('');
    baja();
  });
});
