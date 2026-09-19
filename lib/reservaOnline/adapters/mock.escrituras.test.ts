import { describe, expect, it } from 'vitest';
import { createMockService, memoriaStorage, MOCK_STORAGE_KEY } from './mock';
import type { ReservaCompleta } from './mockTestHelpers';
import { crearPendiente } from './mockTestHelpers';

const AHORA = Date.UTC(2026, 8, 19, 15, 0); // 12:00 hora del salon
const MIN = 60_000;

const entrada = (over: Partial<ReservaCompleta> = {}): ReservaCompleta => ({
  servicioIds: [1],
  profesionalId: 1,
  fecha: '2026-09-25',
  hora: '10:30',
  cliente: { nombre: 'Sofi', apellido: 'Gomez', whatsapp: '+5491155551234' },
  ...over,
});

function escenario() {
  const reloj = { ms: AHORA };
  const storage = memoriaStorage();
  const crear = () => createMockService({ now: () => reloj.ms, storage });
  return { reloj, storage, crear, svc: crear() };
}

describe('mock: crear reserva', () => {
  it('crea una reserva pendiente que vence en 15 min (ventana por defecto)', async () => {
    const { svc } = escenario();
    const r = await crearPendiente(svc, 'demo', entrada());
    expect(r.status).toBe('pending_payment');
    expect(r.expiresAtMs).toBe(AHORA + 15 * MIN);
    expect(r.checkoutUrl).toContain(r.id);
  });

  it('el resumen refleja sena y duracion, y nunca un total', async () => {
    const { svc } = escenario();
    const r = await crearPendiente(svc, 'demo', entrada({ servicioIds: [1, 2] }));
    const st = await svc.getReservationStatus('demo', r.id);
    expect(st.summary).toMatchObject({ duracionTotalMinutos: 75, hora: '10:30' });
    expect(st.summary).not.toHaveProperty('total');
    expect(st.summary.deposito).toBeGreaterThan(0);
  });

  it('un horario tomado por una reserva pendiente deja de estar disponible', async () => {
    const { svc } = escenario();
    await crearPendiente(svc, 'demo', entrada({ hora: '10:30', servicioIds: [1, 2] })); // [10:30, 11:45)
    const disp = await svc.getAvailability('demo', {
      fecha: '2026-09-25',
      servicioIds: [1],
      profesionalId: 1,
    });
    const horas = disp.slots.map((s) => s.hora);
    expect(horas).not.toContain('10:30');
    expect(horas).not.toContain('11:30'); // solapa aunque su inicio este libre
    expect(horas).toContain('13:00');
  });

  it('reservar un horario ya tomado falla con slot_taken', async () => {
    const { svc } = escenario();
    await crearPendiente(svc, 'demo', entrada());
    await expect(crearPendiente(svc, 'demo', entrada())).rejects.toMatchObject({ code: 'slot_taken' });
  });

  it('el mismo horario con otro profesional sigue libre', async () => {
    const { svc } = escenario();
    await crearPendiente(svc, 'demo', entrada({ profesionalId: 1 }));
    await expect(crearPendiente(svc, 'demo', entrada({ profesionalId: 2 }))).resolves.toBeDefined();
  });

  it('sin profesionalId ("Cualquiera") el backend asigna la primera libre y la devuelve en el estado', async () => {
    const { svc } = escenario();
    await crearPendiente(svc, 'demo', entrada({ profesionalId: 1 })); // Ana ocupada a las 10:30
    const sinProfesional = { ...entrada(), profesionalId: undefined };
    const r = await crearPendiente(svc, 'demo', sinProfesional);
    expect((await svc.getReservationStatus('demo', r.id)).summary.profesionalId).toBe(2);
  });

  it('con "Cualquiera" y todas ocupadas a esa hora falla con slot_taken (el horario se acaba de ocupar)', async () => {
    const { svc } = escenario();
    await crearPendiente(svc, 'demo', entrada({ profesionalId: 1 }));
    await crearPendiente(svc, 'demo', entrada({ profesionalId: 2 }));
    const sinProfesional = { ...entrada(), profesionalId: undefined };
    await expect(crearPendiente(svc, 'demo', sinProfesional)).rejects.toMatchObject({ code: 'slot_taken' });
  });

  it('un turno que se ocupa DESPUES de traer los horarios hace fallar la creacion con slot_taken (por solape, no solo por hora exacta)', async () => {
    const { svc } = escenario();
    const antes = await svc.getAvailability('demo', { fecha: '2026-09-25', servicioIds: [1], profesionalId: 1 });
    expect(antes.slots.map((s) => s.hora)).toContain('11:30');
    // Otra clienta toma 10:30 (75 min) mientras esta mira la lista: 11:30 ahora solapa.
    await crearPendiente(svc, 'demo', entrada({ hora: '10:30', servicioIds: [1, 2] }));
    await expect(crearPendiente(svc, 'demo', entrada({ hora: '11:30' }))).rejects.toMatchObject({
      name: 'ReservaOnlineError',
      code: 'slot_taken',
    });
  });

  it('slug inexistente falla con not_found', async () => {
    const { svc } = escenario();
    await expect(crearPendiente(svc, 'nope', entrada())).rejects.toMatchObject({ code: 'not_found' });
  });
});

describe('mock: expiracion y pago (reloj inyectado)', () => {
  it('pasados 15 min sin pagar, el estado es expired', async () => {
    const { svc, reloj } = escenario();
    const r = await crearPendiente(svc, 'demo', entrada());
    reloj.ms = AHORA + 14 * MIN;
    expect((await svc.getReservationStatus('demo', r.id)).status).toBe('pending_payment');
    reloj.ms = AHORA + 15 * MIN;
    expect((await svc.getReservationStatus('demo', r.id)).status).toBe('expired');
  });

  it('una reserva vencida libera el horario', async () => {
    const { svc, reloj } = escenario();
    await crearPendiente(svc, 'demo', entrada());
    reloj.ms = AHORA + 16 * MIN;
    await expect(crearPendiente(svc, 'demo', entrada())).resolves.toBeDefined();
  });

  it('simulatePayment la pasa a confirmed', async () => {
    const { svc } = escenario();
    const r = await crearPendiente(svc, 'demo', entrada());
    await svc.simulatePayment(r.id);
    expect((await svc.getReservationStatus('demo', r.id)).status).toBe('confirmed');
  });

  it('simulatePayment sobre una reserva vencida falla y no confirma', async () => {
    const { svc, reloj } = escenario();
    const r = await crearPendiente(svc, 'demo', entrada());
    reloj.ms = AHORA + 20 * MIN;
    await expect(svc.simulatePayment(r.id)).rejects.toBeDefined();
    expect((await svc.getReservationStatus('demo', r.id)).status).toBe('expired');
  });

  it('cancelar una reserva confirmada la marca cancelled y libera el horario', async () => {
    const { svc } = escenario();
    const r = await crearPendiente(svc, 'demo', entrada());
    await svc.simulatePayment(r.id);
    await svc.cancelReservation('demo', r.id);
    expect((await svc.getReservationStatus('demo', r.id)).status).toBe('cancelled');
    await expect(crearPendiente(svc, 'demo', entrada())).resolves.toBeDefined();
  });

  it('un id desconocido falla con not_found', async () => {
    const { svc } = escenario();
    await expect(svc.getReservationStatus('demo', 'zzz')).rejects.toMatchObject({ code: 'not_found' });
  });
});

describe('mock: persistencia', () => {
  it('otra instancia sobre el mismo storage ve la reserva (refresh)', async () => {
    const { svc, crear, storage } = escenario();
    const r = await crearPendiente(svc, 'demo', entrada());
    expect(storage.getItem(MOCK_STORAGE_KEY)).not.toBeNull();
    const otra = crear();
    expect((await otra.getReservationStatus('demo', r.id)).id).toBe(r.id);
  });

  it('ids nuevos no chocan con los persistidos', async () => {
    const { svc, crear } = escenario();
    const a = await crearPendiente(svc, 'demo', entrada({ hora: '10:30' }));
    const b = await crearPendiente(crear(), 'demo', entrada({ hora: '11:30' }));
    expect(b.id).not.toBe(a.id);
  });
});

describe('mock: ajustes, Mercado Pago y reservas online', () => {
  it('los ajustes arrancan con la reserva online apagada y se persisten al guardar', async () => {
    const { svc, crear } = escenario();
    expect((await svc.getSettings()).habilitada).toBe(false);
    await svc.saveSettings({ habilitada: true, deposito: 7000 });
    const s = await crear().getSettings();
    expect(s).toMatchObject({ habilitada: true, deposito: 7000, ventanaPagoMinutos: 15 });
  });

  it('getTerms refleja los ajustes guardados', async () => {
    const { svc } = escenario();
    await svc.saveSettings({ deposito: 9000, ventanaPagoMinutos: 20 });
    expect(await svc.getTerms('demo')).toMatchObject({ deposito: 9000, ventanaPagoMinutos: 20 });
  });

  it('la ventana de pago guardada rige para reservas nuevas', async () => {
    const { svc } = escenario();
    await svc.saveSettings({ ventanaPagoMinutos: 30 });
    const r = await crearPendiente(svc, 'demo', entrada());
    expect(r.expiresAtMs).toBe(AHORA + 30 * MIN);
  });

  it('conectar y desconectar Mercado Pago', async () => {
    const { svc } = escenario();
    expect((await svc.getMpConnection()).conectada).toBe(false);
    expect((await svc.connectMp()).conectada).toBe(true);
    expect((await svc.getMpConnection()).cuenta).not.toBeNull();
    expect(await svc.disconnectMp()).toEqual({ conectada: false, cuenta: null });
  });

  it('listOnlineBookings solo trae las reservas pagadas, mas recientes primero', async () => {
    const { svc, reloj } = escenario();
    const a = await crearPendiente(svc, 'demo', entrada({ hora: '10:30' }));
    await crearPendiente(svc, 'demo', entrada({ hora: '11:30' })); // sin pagar
    reloj.ms = AHORA + 1 * MIN;
    await svc.simulatePayment(a.id);
    const b = await crearPendiente(svc, 'demo', entrada({ hora: '14:00' }));
    reloj.ms = AHORA + 2 * MIN;
    await svc.simulatePayment(b.id);
    const lista = await svc.listOnlineBookings();
    expect(lista.map((x) => x.id)).toEqual([b.id, a.id]);
    expect(lista[0]).toMatchObject({ clienteNombre: 'Sofi Gomez', fecha: '2026-09-25', hora: '14:00' });
  });

  it('la nota "Contanos tu idea" viaja en la reserva y llega al estado y al aviso del salon', async () => {
    const { svc } = escenario();
    const r = await crearPendiente(svc, 'demo', entrada({ nota: 'flores y dorado' }));
    expect((await svc.getReservationStatus('demo', r.id)).summary.nota).toBe('flores y dorado');
    await svc.simulatePayment(r.id);
    expect((await svc.listOnlineBookings())[0].nota).toBe('flores y dorado');
  });

  it('el estado expone la URL de checkout para "Volver a Mercado Pago"', async () => {
    const { svc } = escenario();
    const r = await crearPendiente(svc, 'demo', entrada());
    expect((await svc.getReservationStatus('demo', r.id)).checkoutUrl).toBe(r.checkoutUrl);
  });
});

describe('mock: fotos de servicios (lado del salon)', () => {
  it('sin fotos guardadas devuelve []', async () => {
    const { svc } = escenario();
    expect(await svc.getFotosServicio(99)).toEqual([]);
  });

  it('guarda y relee la lista (orden incluido) por servicio', async () => {
    const { svc, crear } = escenario();
    await svc.saveFotosServicio(5, ['data:a', 'data:b']);
    await svc.saveFotosServicio(6, ['data:z']);
    expect(await crear().getFotosServicio(5)).toEqual(['data:a', 'data:b']);
    expect(await crear().getFotosServicio(6)).toEqual(['data:z']);
  });

  it('respeta el maximo de 12 fotos', async () => {
    const { svc } = escenario();
    const trece = Array.from({ length: 13 }, (_, i) => `data:${i}`);
    await expect(svc.saveFotosServicio(5, trece)).rejects.toMatchObject({ code: 'validation' });
  });
});


const RETENER = { servicioIds: [1], profesionalId: 1, fecha: '2026-09-25', hora: '10:30' };
const CLIENTE = { nombre: 'Sofi', apellido: 'Gomez', whatsapp: '+5491155551234' };
const horasLibres = async (svc: ReturnType<typeof escenario>['svc'], profesionalId = 1) =>
  (await svc.getAvailability('demo', { fecha: '2026-09-25', servicioIds: [1], profesionalId })).slots.map((s) => s.hora);

describe('mock: retencion del horario (hold) al elegirlo', () => {
  it('retiene el horario 10 min y devuelve reserva, vencimiento y profesional resuelta', async () => {
    const { svc } = escenario();
    const h = await svc.retenerHorario('demo', RETENER);
    expect(h.expiresAtMs).toBe(AHORA + 10 * MIN);
    expect(h.profesionalId).toBe(1);
    expect(h.reservaId).toMatch(/^mock-/);
  });

  it('"Cualquiera" (sin profesionalId) se resuelve en ese momento: la primera libre', async () => {
    const { svc } = escenario();
    await svc.retenerHorario('demo', RETENER); // Ana retenida
    const cualquiera = { ...RETENER, profesionalId: undefined };
    expect((await svc.retenerHorario('demo', cualquiera)).profesionalId).toBe(2);
  });

  it('el hold ocupa el horario: desaparece de la disponibilidad y retenerlo de nuevo falla con slot_taken', async () => {
    const { svc } = escenario();
    await svc.retenerHorario('demo', RETENER);
    expect(await horasLibres(svc)).not.toContain('10:30');
    await expect(svc.retenerHorario('demo', RETENER)).rejects.toMatchObject({ code: 'slot_taken' });
  });

  it('el solape (no solo la hora exacta) tambien es slot_taken', async () => {
    const { svc } = escenario();
    const largo = { ...RETENER, servicioIds: [1, 2] };
    await svc.retenerHorario('demo', largo); // [10:30, 11:45)
    await expect(svc.retenerHorario('demo', { ...RETENER, hora: '11:30' })).rejects.toMatchObject({ code: 'slot_taken' });
    await expect(svc.retenerHorario('demo', { ...RETENER, hora: '13:00' })).resolves.toBeDefined(); // fuera del rango
  });

  it('pasados 10 min sin avanzar el hold vence y libera el horario', async () => {
    const { svc, reloj } = escenario();
    await svc.retenerHorario('demo', RETENER);
    reloj.ms = AHORA + 10 * MIN;
    expect(await horasLibres(svc)).toContain('10:30');
  });

  it('retener en un slug inexistente falla con not_found', async () => {
    const { svc } = escenario();
    await expect(svc.retenerHorario('nope', RETENER)).rejects.toMatchObject({ code: 'not_found' });
  });

  it('liberarHold libera el horario, es idempotente y tolera ids desconocidos', async () => {
    const { svc } = escenario();
    const h = await svc.retenerHorario('demo', RETENER);
    await svc.liberarHold('demo', h.reservaId);
    await svc.liberarHold('demo', h.reservaId);
    await svc.liberarHold('demo', 'mock-999');
    expect(await horasLibres(svc)).toContain('10:30');
  });

  it('un hold sin pagar todavia no es una reserva consultable (not_found en el estado)', async () => {
    const { svc } = escenario();
    const h = await svc.retenerHorario('demo', RETENER);
    await expect(svc.getReservationStatus('demo', h.reservaId)).rejects.toMatchObject({ code: 'not_found' });
  });
});

describe('mock: datos y pago sobre el hold', () => {
  it('actualizarDatosReserva guarda cliente y nota en el hold', async () => {
    const { svc } = escenario();
    const h = await svc.retenerHorario('demo', RETENER);
    await svc.actualizarDatosReserva('demo', h.reservaId, { cliente: CLIENTE, nota: 'flores' });
    await svc.iniciarPago('demo', h.reservaId);
    await svc.simulatePayment(h.reservaId);
    expect((await svc.listOnlineBookings())[0]).toMatchObject({ clienteNombre: 'Sofi Gomez', nota: 'flores' });
  });

  it('actualizarDatosReserva sobre un hold vencido falla con hold_expired', async () => {
    const { svc, reloj } = escenario();
    const h = await svc.retenerHorario('demo', RETENER);
    reloj.ms = AHORA + 10 * MIN;
    await expect(svc.actualizarDatosReserva('demo', h.reservaId, { cliente: CLIENTE })).rejects.toMatchObject({
      code: 'hold_expired',
    });
  });

  it('iniciarPago extiende la reserva a la ventana de pago completa (15 min desde ese instante)', async () => {
    const { svc, reloj } = escenario();
    const h = await svc.retenerHorario('demo', RETENER);
    await svc.actualizarDatosReserva('demo', h.reservaId, { cliente: CLIENTE });
    reloj.ms = AHORA + 6 * MIN;
    const pago = await svc.iniciarPago('demo', h.reservaId);
    expect(pago).toMatchObject({ id: h.reservaId, status: 'pending_payment', expiresAtMs: AHORA + 21 * MIN });
    expect((await svc.getReservationStatus('demo', h.reservaId)).status).toBe('pending_payment');
  });

  it('iniciarPago sobre un hold vencido falla con hold_expired y nunca deja la reserva pendiente', async () => {
    const { svc, reloj } = escenario();
    const h = await svc.retenerHorario('demo', RETENER);
    reloj.ms = AHORA + 11 * MIN;
    await expect(svc.iniciarPago('demo', h.reservaId)).rejects.toMatchObject({ code: 'hold_expired' });
    expect((await svc.getReservationStatus('demo', h.reservaId)).status).toBe('expired');
  });

  it('iniciarPago repetido (doble toque) devuelve la misma reserva pendiente sin extender de nuevo', async () => {
    const { svc, reloj } = escenario();
    const h = await svc.retenerHorario('demo', RETENER);
    const a = await svc.iniciarPago('demo', h.reservaId);
    reloj.ms = AHORA + 2 * MIN;
    expect((await svc.iniciarPago('demo', h.reservaId)).expiresAtMs).toBe(a.expiresAtMs);
  });
});
