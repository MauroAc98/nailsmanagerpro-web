import { describe, expect, it } from 'vitest';
import { createMockService, memoriaStorage, MOCK_STORAGE_KEY } from './mock';
import type { CreateReservationInput } from '../types';

const AHORA = Date.UTC(2026, 8, 19, 15, 0); // 12:00 hora del salon
const MIN = 60_000;

const entrada = (over: Partial<CreateReservationInput> = {}): CreateReservationInput => ({
  servicioIds: [1],
  profesionalId: 1,
  fecha: '2026-09-25',
  hora: '10:00',
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
    const r = await svc.createReservation('demo', entrada());
    expect(r.status).toBe('pending_payment');
    expect(r.expiresAtMs).toBe(AHORA + 15 * MIN);
    expect(r.checkoutUrl).toContain(r.id);
  });

  it('el resumen refleja sena y duracion, y nunca un total', async () => {
    const { svc } = escenario();
    const r = await svc.createReservation('demo', entrada({ servicioIds: [1, 2] }));
    const st = await svc.getReservationStatus('demo', r.id);
    expect(st.summary).toMatchObject({ duracionTotalMinutos: 75, hora: '10:00' });
    expect(st.summary).not.toHaveProperty('total');
    expect(st.summary.deposito).toBeGreaterThan(0);
  });

  it('un horario tomado por una reserva pendiente deja de estar disponible', async () => {
    const { svc } = escenario();
    await svc.createReservation('demo', entrada({ hora: '10:00' }));
    const disp = await svc.getAvailability('demo', {
      fecha: '2026-09-25',
      servicioIds: [1],
      profesionalId: 1,
    });
    const horas = disp.slots.map((s) => s.hora);
    expect(horas).not.toContain('10:00');
    expect(horas).not.toContain('10:30'); // solapa (45 min)
    expect(horas).toContain('11:00'); // adyacente (termina 10:45) libre
  });

  it('reservar un horario ya tomado falla con slot_taken', async () => {
    const { svc } = escenario();
    await svc.createReservation('demo', entrada());
    await expect(svc.createReservation('demo', entrada())).rejects.toMatchObject({ code: 'slot_taken' });
  });

  it('el mismo horario con otro profesional sigue libre', async () => {
    const { svc } = escenario();
    await svc.createReservation('demo', entrada({ profesionalId: 1 }));
    await expect(svc.createReservation('demo', entrada({ profesionalId: 2 }))).resolves.toBeDefined();
  });

  it('sin profesionalId ("Cualquiera") el backend asigna la primera libre y la devuelve en el estado', async () => {
    const { svc } = escenario();
    await svc.createReservation('demo', entrada({ profesionalId: 1 })); // Ana ocupada a las 10:00
    const { profesionalId: _omitida, ...sinProfesional } = entrada();
    const r = await svc.createReservation('demo', sinProfesional);
    expect((await svc.getReservationStatus('demo', r.id)).summary.profesionalId).toBe(2);
  });

  it('con "Cualquiera" y todas ocupadas a esa hora falla con slot_taken (el horario se acaba de ocupar)', async () => {
    const { svc } = escenario();
    await svc.createReservation('demo', entrada({ profesionalId: 1 }));
    await svc.createReservation('demo', entrada({ profesionalId: 2 }));
    const { profesionalId: _omitida, ...sinProfesional } = entrada();
    await expect(svc.createReservation('demo', sinProfesional)).rejects.toMatchObject({ code: 'slot_taken' });
  });

  it('un turno que se ocupa DESPUES de traer los horarios hace fallar la creacion con slot_taken (por solape, no solo por hora exacta)', async () => {
    const { svc } = escenario();
    const antes = await svc.getAvailability('demo', { fecha: '2026-09-25', servicioIds: [1], profesionalId: 1 });
    expect(antes.slots.map((s) => s.hora)).toContain('10:30');
    // Otra clienta toma 10:00 (45 min) mientras esta mira la lista: 10:30 ahora solapa.
    await svc.createReservation('demo', entrada({ hora: '10:00' }));
    await expect(svc.createReservation('demo', entrada({ hora: '10:30' }))).rejects.toMatchObject({
      name: 'ReservaOnlineError',
      code: 'slot_taken',
    });
  });

  it('slug inexistente falla con not_found', async () => {
    const { svc } = escenario();
    await expect(svc.createReservation('nope', entrada())).rejects.toMatchObject({ code: 'not_found' });
  });
});

describe('mock: expiracion y pago (reloj inyectado)', () => {
  it('pasados 15 min sin pagar, el estado es expired', async () => {
    const { svc, reloj } = escenario();
    const r = await svc.createReservation('demo', entrada());
    reloj.ms = AHORA + 14 * MIN;
    expect((await svc.getReservationStatus('demo', r.id)).status).toBe('pending_payment');
    reloj.ms = AHORA + 15 * MIN;
    expect((await svc.getReservationStatus('demo', r.id)).status).toBe('expired');
  });

  it('una reserva vencida libera el horario', async () => {
    const { svc, reloj } = escenario();
    await svc.createReservation('demo', entrada());
    reloj.ms = AHORA + 16 * MIN;
    await expect(svc.createReservation('demo', entrada())).resolves.toBeDefined();
  });

  it('simulatePayment la pasa a confirmed', async () => {
    const { svc } = escenario();
    const r = await svc.createReservation('demo', entrada());
    await svc.simulatePayment(r.id);
    expect((await svc.getReservationStatus('demo', r.id)).status).toBe('confirmed');
  });

  it('simulatePayment sobre una reserva vencida falla y no confirma', async () => {
    const { svc, reloj } = escenario();
    const r = await svc.createReservation('demo', entrada());
    reloj.ms = AHORA + 20 * MIN;
    await expect(svc.simulatePayment(r.id)).rejects.toBeDefined();
    expect((await svc.getReservationStatus('demo', r.id)).status).toBe('expired');
  });

  it('cancelar una reserva confirmada la marca cancelled y libera el horario', async () => {
    const { svc } = escenario();
    const r = await svc.createReservation('demo', entrada());
    await svc.simulatePayment(r.id);
    await svc.cancelReservation('demo', r.id);
    expect((await svc.getReservationStatus('demo', r.id)).status).toBe('cancelled');
    await expect(svc.createReservation('demo', entrada())).resolves.toBeDefined();
  });

  it('un id desconocido falla con not_found', async () => {
    const { svc } = escenario();
    await expect(svc.getReservationStatus('demo', 'zzz')).rejects.toMatchObject({ code: 'not_found' });
  });
});

describe('mock: persistencia', () => {
  it('otra instancia sobre el mismo storage ve la reserva (refresh)', async () => {
    const { svc, crear, storage } = escenario();
    const r = await svc.createReservation('demo', entrada());
    expect(storage.getItem(MOCK_STORAGE_KEY)).not.toBeNull();
    const otra = crear();
    expect((await otra.getReservationStatus('demo', r.id)).id).toBe(r.id);
  });

  it('ids nuevos no chocan con los persistidos', async () => {
    const { svc, crear } = escenario();
    const a = await svc.createReservation('demo', entrada({ hora: '10:00' }));
    const b = await crear().createReservation('demo', entrada({ hora: '12:00' }));
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
    const r = await svc.createReservation('demo', entrada());
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
    const a = await svc.createReservation('demo', entrada({ hora: '10:00' }));
    await svc.createReservation('demo', entrada({ hora: '12:00' })); // sin pagar
    reloj.ms = AHORA + 1 * MIN;
    await svc.simulatePayment(a.id);
    const b = await svc.createReservation('demo', entrada({ hora: '14:00' }));
    reloj.ms = AHORA + 2 * MIN;
    await svc.simulatePayment(b.id);
    const lista = await svc.listOnlineBookings();
    expect(lista.map((x) => x.id)).toEqual([b.id, a.id]);
    expect(lista[0]).toMatchObject({ clienteNombre: 'Sofi Gomez', fecha: '2026-09-25', hora: '14:00' });
  });

  it('la nota "Contanos tu idea" viaja en la reserva y llega al estado y al aviso del salon', async () => {
    const { svc } = escenario();
    const r = await svc.createReservation('demo', entrada({ nota: 'flores y dorado' }));
    expect((await svc.getReservationStatus('demo', r.id)).summary.nota).toBe('flores y dorado');
    await svc.simulatePayment(r.id);
    expect((await svc.listOnlineBookings())[0].nota).toBe('flores y dorado');
  });

  it('el estado expone la URL de checkout para "Volver a Mercado Pago"', async () => {
    const { svc } = escenario();
    const r = await svc.createReservation('demo', entrada());
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

