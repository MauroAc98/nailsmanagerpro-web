import { describe, expect, it } from 'vitest';
import {
  armarPayloadLote,
  bloqueNuevoDesde,
  detalleResumen,
  diaLargo,
  evaluarBloque,
  horaCorta12,
  itemsDeConfirmacion,
  quitarBloque,
  tituloResumen,
  type BloqueTurno,
} from '@/lib/turnosLote';
import type { Servicio } from '@/services/servicioService';
import type { Turno } from '@/services/turnoService';

const bloque = (over: Partial<BloqueTurno> = {}): BloqueTurno => ({
  fecha: '2099-01-05', hora: '10:00', servicioIds: [1], profesionalId: null, ...over,
});
const servicio = (id: number, duracion = 30): Servicio => ({
  id, user_id: 1, nombre: `S${id}`, duracion_minutos: duracion, precio: '1', activo: true,
  es_promo: false, orden: 0, categoria_id: null, created_at: '', updated_at: '',
});
const slots = [{ id: 1, hora: '09:00', activo: true }, { id: 2, hora: '18:00', activo: true }] as never;
const turnoExistente = (over: Partial<Turno> = {}): Turno => ({
  id: 50, cliente_id: 9, cliente: { nombre: 'Otra', apellido: 'Persona' },
  servicios: [{ id: 7, nombre: 'Otro' }], fecha_hora: '2099-01-05 10:00:00', duracion_total_minutos: 60,
  estado: 'confirmado', estado_visual: 'confirmado', ...over,
});
const params = (over = {}) => ({
  bloque: bloque(), clienteId: 5, servicios: [servicio(1), servicio(2)], turnos: [] as Turno[],
  slots, bloqueos: [], profesional: null, requiereProfesional: false, ...over,
});

describe('armarPayloadLote', () => {
  it('arma cliente_id y un item por bloque con fecha_hora YYYY-MM-DD HH:MM', () => {
    const payload = armarPayloadLote(5, [
      bloque({ fecha: '2099-01-05', hora: '10:00', servicioIds: [1, 2] }),
      bloque({ fecha: '2099-01-07', hora: '15:30', servicioIds: [2] }),
    ]);
    expect(payload).toEqual({
      cliente_id: 5,
      turnos: [
        { fecha_hora: '2099-01-05 10:00', servicio_ids: [1, 2] },
        { fecha_hora: '2099-01-07 15:30', servicio_ids: [2] },
      ],
    });
  });

  it('manda profesional_id solo en los bloques que lo tienen', () => {
    const payload = armarPayloadLote(5, [bloque({ profesionalId: 3 }), bloque({ profesionalId: null })]);
    expect(payload.turnos[0]).toHaveProperty('profesional_id', 3);
    expect(payload.turnos[1]).not.toHaveProperty('profesional_id');
  });
});

describe('bloqueNuevoDesde', () => {
  it('hereda dia y profesional, sin servicios, con la hora inicial dada', () => {
    expect(bloqueNuevoDesde(bloque({ fecha: '2099-01-09', profesionalId: 4, servicioIds: [1, 2] }), '14:00'))
      .toEqual({ fecha: '2099-01-09', hora: '14:00', servicioIds: [], profesionalId: 4 });
  });
});

describe('quitarBloque', () => {
  const tres = [bloque({ hora: '10:00' }), bloque({ hora: '11:00' }), bloque({ hora: '12:00' })];

  it('quita el bloque y abre el anterior', () => {
    const r = quitarBloque(tres, 2);
    expect(r.bloques.map(b => b.hora)).toEqual(['10:00', '11:00']);
    expect(r.activo).toBe(1);
  });

  it('si se quita el primero abre el que pasa a ser primero', () => {
    const r = quitarBloque(tres, 0);
    expect(r.bloques.map(b => b.hora)).toEqual(['11:00', '12:00']);
    expect(r.activo).toBe(0);
  });

  it('no deja quitar el unico bloque', () => {
    const r = quitarBloque([bloque()], 0);
    expect(r.bloques).toHaveLength(1);
    expect(r.activo).toBe(0);
  });
});

describe('textos del resumen', () => {
  it('horaCorta12 pasa a 12 horas sin "hs"', () => {
    expect(horaCorta12('15:30')).toBe('3:30 p. m.');
    expect(horaCorta12('00:05')).toBe('12:05 a. m.');
    expect(horaCorta12('12:00')).toBe('12:00 p. m.');
  });

  it('tituloResumen: dia corto, fecha, mes corto y hora', () => {
    // 2099-01-05 es lunes
    expect(tituloResumen('2099-01-05', '15:30')).toMatch(/^lun\.? 5 ene\.? · 3:30 p\. m\.$/);
  });

  it('diaLargo: nombre completo del dia y del mes, sin coma', () => {
    const texto = diaLargo('2099-01-05');
    expect(texto).toMatch(/lunes/i);
    expect(texto).toMatch(/enero/i);
    expect(texto).not.toContain(',');
  });

  it('detalleResumen une servicios con " + " y agrega la profesional si viene', () => {
    expect(detalleResumen(['Esmaltado', 'Retiro'], 'con Lucía')).toBe('Esmaltado + Retiro · con Lucía');
    expect(detalleResumen(['Esmaltado'], null)).toBe('Esmaltado');
  });
});

describe('itemsDeConfirmacion', () => {
  it('saca fecha, hora y servicios (unidos con " + ") de cada turno creado', () => {
    const items = itemsDeConfirmacion([
      turnoExistente({ fecha_hora: '2099-01-05 10:00:00', servicios: [{ id: 1, nombre: 'A' }, { id: 2, nombre: 'B' }] }),
      turnoExistente({ fecha_hora: '2099-01-07T15:30:00', servicios: [{ id: 3, nombre: 'C' }] }),
    ]);
    expect(items).toEqual([
      { fecha: '2099-01-05', hora: '10:00', servicios: 'A + B' },
      { fecha: '2099-01-07', hora: '15:30', servicios: 'C' },
    ]);
  });
});

describe('evaluarBloque', () => {
  it('un bloque valido no tiene error ni aviso', () => {
    expect(evaluarBloque(params())).toEqual({ error: null, advertencia: null });
  });

  it('sin servicios es error', () => {
    expect(evaluarBloque(params({ bloque: bloque({ servicioIds: [] }) })).error).toEqual(expect.any(String));
  });

  it('pide profesional cuando corresponde', () => {
    expect(evaluarBloque(params({ requiereProfesional: true })).error).toEqual(expect.any(String));
  });

  it('hora fuera del horario de atencion es error (mismas reglas de validarTurno)', () => {
    expect(evaluarBloque(params({ bloque: bloque({ hora: '23:00' }) })).error).toEqual(expect.any(String));
  });

  it('fecha pasada es error', () => {
    expect(evaluarBloque(params({ bloque: bloque({ fecha: '2000-01-05' }) })).error).toEqual(expect.any(String));
  });

  it('solo cuenta los turnos de la fecha del bloque para el choque de horario', () => {
    const otroDia = turnoExistente({ fecha_hora: '2099-01-06 10:00:00' });
    expect(evaluarBloque(params({ turnos: [otroDia] })).error).toBeNull();
    const mismoDia = turnoExistente();
    expect(evaluarBloque(params({ turnos: [mismoDia] })).error).toEqual(expect.any(String));
  });

  it('solo cuenta los turnos de la profesional del bloque', () => {
    const deOtra = turnoExistente({ profesional_id: 2 });
    expect(evaluarBloque(params({ turnos: [deOtra], bloque: bloque({ profesionalId: 1 }), requiereProfesional: true })).error).toBeNull();
  });

  it('devuelve el aviso no bloqueante de un dia bloqueado', () => {
    const bloqueos = [{
      id: 1, user_id: 1, profesional_id: null, fecha: '2099-01-05', hora_desde: null, hora_hasta: null,
      motivo: 'Feriado', created_at: '', updated_at: '',
    }];
    const r = evaluarBloque(params({ bloqueos }));
    expect(r.error).toBeNull();
    expect(r.advertencia).toContain('Feriado');
  });
});
