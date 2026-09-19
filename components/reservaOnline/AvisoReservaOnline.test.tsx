import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test/render';
import { setServiceParaTests } from '@/lib/reservaOnline';
import type { MockReservaOnlineService } from '@/lib/reservaOnline/adapters/mock';
import { AvisoReservaOnline } from './AvisoReservaOnline';
import { AHORA, prepararServicio } from './testUtils';
import { crearPendiente } from '@/lib/reservaOnline/adapters/mockTestHelpers';

const HORA = 60 * 60_000;

async function reservaPagada(svc: MockReservaOnlineService, nota?: string) {
  const r = await crearPendiente(svc, 'demo', {
    nota,
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

  it('el aviso no menciona ningun total: solo dia y hora', async () => {
    vi.stubEnv('NEXT_PUBLIC_RESERVA_ONLINE', 'true');
    await reservaPagada(svc);
    renderWithProviders(<AvisoReservaOnline ahora={() => AHORA} />);
    const aviso = await screen.findByRole('status');
    expect(aviso).not.toHaveTextContent(/total|\$/i);
  });

  it('si la clienta dejo su idea, el aviso la muestra', async () => {
    vi.stubEnv('NEXT_PUBLIC_RESERVA_ONLINE', 'true');
    await reservaPagada(svc, 'flores y dorado');
    renderWithProviders(<AvisoReservaOnline ahora={() => AHORA} />);
    expect(await screen.findByText('Idea: flores y dorado')).toBeInTheDocument();
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
