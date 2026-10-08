import { describe, expect, it } from 'vitest';
import type { Turno } from '@/services/turnoService';
import { agruparVisitas, type VisitaAgenda } from './visitasAgenda';
import { urlWhatsappVisita } from './visitasWhatsapp';

type Tramo = NonNullable<Turno['grupo']>['tramos'][number];

const tramo = (turno_id: number, profesional_id: number, nombre: string, fecha_hora: string, servicio: string, over: Partial<Tramo> = {}): Tramo => ({
  turno_id, profesional_id, profesional_nombre: nombre, fecha_hora, duracion_total_minutos: 60, estado: 'confirmado',
  servicios: [{ id: turno_id, nombre: servicio }], ...over,
});

const NEGOCIO = { nombre: 'Estudio Luna', direccion: 'Calle 1 123', telefono: '3764111111' };

const visitaDe = (tramos: Tramo[], cliente: Turno['cliente'] = { nombre: 'Fulano', apellido: 'Detal', telefono: '3764000000' }): VisitaAgenda => {
  const turnos = tramos
    .filter((t) => t.fecha_hora.startsWith('2026-10-09'))
    .map((t) => ({
      id: t.turno_id, cliente_id: 1, cliente, servicios: t.servicios!, estado: 'confirmado', estado_visual: 'confirmado',
      fecha_hora: t.fecha_hora, duracion_total_minutos: 60, profesional_id: t.profesional_id,
      grupo_id: 7, grupo: { id: 7, modo: 'secuencia', promo: null, tramos },
    }) as Turno);
  return agruparVisitas(turnos, null)[0] as VisitaAgenda;
};

// El texto del mensaje, ya decodificado.
const texto = (url: string | null): string => decodeURIComponent((url ?? '').split('text=')[1] ?? '');

const MAURO_Y_MENGANO = [
  tramo(1, 10, 'Mauro', '2026-10-09T09:00:00', 'Capping'),
  tramo(2, 20, 'Mengano', '2026-10-09T10:30:00', 'Soft gel'),
];

describe('urlWhatsappVisita', () => {
  it('con varias profesionales manda un solo mensaje con cada servicio y quien lo hace, y el aviso nombra al equipo', () => {
    const url = urlWhatsappVisita(visitaDe(MAURO_Y_MENGANO), NEGOCIO);

    expect(url).toMatch(/^https:\/\/wa\.me\/\d+\?text=/);
    const t = texto(url);
    expect(t).toContain('Capping con Mauro · Soft gel con Mengano');
    expect(t).toContain('el equipo');
    expect(t).toContain('09/10');
    expect(t).toContain('09:00');
    expect(t).toContain('Estudio Luna');
  });

  it('con una sola profesional junta los servicios con " + " y la nombra en el aviso', () => {
    const t = texto(urlWhatsappVisita(visitaDe([
      tramo(1, 10, 'Mauro', '2026-10-09T09:00:00', 'Capping'),
      tramo(2, 10, 'Mauro', '2026-10-09T10:30:00', 'Soft gel'),
    ]), NEGOCIO));

    expect(t).toContain('Capping + Soft gel');
    expect(t).not.toContain(' con Mauro');
    expect(t).toContain('Mauro no lo recibe');
  });

  it('usa solo el primer nombre de cada profesional', () => {
    const t = texto(urlWhatsappVisita(visitaDe([
      tramo(1, 10, 'María José', '2026-10-09T09:00:00', 'Capping'),
      tramo(2, 20, 'Ana Laura', '2026-10-09T10:30:00', 'Soft gel'),
    ]), NEGOCIO));

    expect(t).toContain('Capping con María · Soft gel con Ana');
  });

  it('solo incluye los pasos confirmados del dia de la tarjeta: no los completados ni los de otro dia', () => {
    const t = texto(urlWhatsappVisita(visitaDe([
      tramo(1, 10, 'Mauro', '2026-10-09T09:00:00', 'Capping', { estado: 'completado' }),
      tramo(2, 20, 'Mengano', '2026-10-09T10:30:00', 'Soft gel'),
      tramo(3, 30, 'Ana', '2026-10-10T10:00:00', 'Pedicura'),
    ]), NEGOCIO));

    expect(t).toContain('Soft gel');
    expect(t).not.toContain('Capping');
    expect(t).not.toContain('Pedicura');
    expect(t).toContain('10:30');
  });

  it('toma la fecha y la hora del primer paso confirmado', () => {
    const t = texto(urlWhatsappVisita(visitaDe([
      tramo(2, 20, 'Mengano', '2026-10-09T10:30:00', 'Soft gel'),
      tramo(1, 10, 'Mauro', '2026-10-09T09:00:00', 'Capping'),
    ]), NEGOCIO));

    expect(t).toContain('09:00');
    expect(t).not.toContain('10:30');
  });

  it('sin telefono del cliente no hay enlace', () => {
    expect(urlWhatsappVisita(visitaDe(MAURO_Y_MENGANO, { nombre: 'Fulano', apellido: 'Detal' }), NEGOCIO)).toBeNull();
  });

  it('sin ningun paso confirmado ese dia no hay enlace', () => {
    const visita = visitaDe([
      tramo(1, 10, 'Mauro', '2026-10-09T09:00:00', 'Capping', { estado: 'completado' }),
      tramo(2, 20, 'Mengano', '2026-10-09T10:30:00', 'Soft gel', { estado: 'completado' }),
    ]);

    expect(urlWhatsappVisita(visita, NEGOCIO)).toBeNull();
  });
});
