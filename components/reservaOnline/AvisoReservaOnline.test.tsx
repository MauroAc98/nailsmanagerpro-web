import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test/render';
import { setServiceParaTests } from '@/lib/reservaOnline';
import type { MockReservaOnlineService } from '@/lib/reservaOnline/adapters/mock';
import { AvisoReservaOnline } from './AvisoReservaOnline';
import { AHORA, prepararServicio } from './testUtils';

const HORA = 60 * 60_000;

async function reservaPagada(svc: MockReservaOnlineService) {
  const r = await svc.createReservation('demo', {
    servicioIds: [1],
    profesionalId: 1,
    fecha: '2026-09-25',
    hora: '13:00',
    cliente: { nombre: 'Marta', apellido: 'Ríos', whatsapp: '+5493765123456' },
  });
  await svc.simulatePayment(r.id);
}

describe('AvisoReservaOnline', () => {
  let svc: MockReservaOnlineService;
  beforeEach(() => {
    svc = prepararServicio();
  });
  afterEach(() => {
    setServiceParaTests(null);
    vi.unstubAllEnvs();
  });

  it('con la flag apagada no renderiza nada', async () => {
    vi.stubEnv('NEXT_PUBLIC_RESERVA_ONLINE', 'false');
    await reservaPagada(svc);
    const { container } = renderWithProviders(<AvisoReservaOnline ahora={() => AHORA} />);
    await new Promise((r) => setTimeout(r, 20));
    expect(container).toBeEmptyDOMElement();
  });

  it('con la flag prendida avisa de la ultima reserva pagada', async () => {
    vi.stubEnv('NEXT_PUBLIC_RESERVA_ONLINE', 'true');
    await reservaPagada(svc);
    renderWithProviders(<AvisoReservaOnline ahora={() => AHORA} />);
    expect(await screen.findByText('Marta Ríos reservó y pagó la seña')).toBeInTheDocument();
    expect(screen.getByText('viernes 25 13:00')).toBeInTheDocument();
  });

  it('sin reservas pagadas no muestra aviso', async () => {
    vi.stubEnv('NEXT_PUBLIC_RESERVA_ONLINE', 'true');
    const { container } = renderWithProviders(<AvisoReservaOnline ahora={() => AHORA} />);
    await new Promise((r) => setTimeout(r, 20));
    expect(container).toBeEmptyDOMElement();
  });

  it('una reserva pagada hace mas de 24 h ya no se anuncia', async () => {
    vi.stubEnv('NEXT_PUBLIC_RESERVA_ONLINE', 'true');
    await reservaPagada(svc);
    const { container } = renderWithProviders(<AvisoReservaOnline ahora={() => AHORA + 25 * HORA} />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});
