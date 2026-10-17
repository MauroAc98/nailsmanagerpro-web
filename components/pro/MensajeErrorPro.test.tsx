import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderWithProviders, screen } from '@/test/render';
import { es } from '@/messages';
import type { ProError } from '@/lib/pro/errores';
import { MensajeErrorPro } from './MensajeErrorPro';

const ERRORES = es.profesionales.Errores;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const TODOS: ProError[] = [
  { kind: 'invalidCredentials' },
  { kind: 'sessionRevoked' },
  { kind: 'mustChangePassword' },
  { kind: 'changeNotRequired' },
  { kind: 'vinculoRequired' },
  { kind: 'vinculoDisabled' },
  { kind: 'noService', motivo: null },
  { kind: 'notFound' },
  { kind: 'portalUnavailable' },
  { kind: 'rateLimited', retryAfterSec: null, lockout: false },
  { kind: 'validation', fields: {} },
  { kind: 'network' },
  { kind: 'server' },
];

describe('MensajeErrorPro', () => {
  it.each(TODOS)('muestra el copy de Errores.$kind', (error) => {
    renderWithProviders(<MensajeErrorPro error={error} id="e" />);
    const alerta = screen.getByRole('alert');
    expect(alerta).toHaveAttribute('id', 'e');
    expect(alerta).toHaveTextContent(ERRORES[error.kind]);
  });

  it('nunca muestra el mensaje crudo del backend', () => {
    const error = { kind: 'server', message: 'SQLSTATE[23000] secreto' } as ProError;
    renderWithProviders(<MensajeErrorPro error={error} id="e" />);
    expect(screen.queryByText(/SQLSTATE/)).toBeNull();
  });

  it('el texto del alert es estático: los segundos van en un span aria-live="off"', () => {
    renderWithProviders(<MensajeErrorPro error={{ kind: 'rateLimited', retryAfterSec: 90, lockout: true }} id="e" />);
    const alerta = screen.getByRole('alert');
    const segundos = alerta.querySelector('[aria-live="off"]') as HTMLElement;
    expect(segundos).not.toBeNull();
    expect(segundos).toHaveTextContent('90');
    const estatico = (alerta.textContent ?? '').replace(segundos.textContent ?? '', '');
    expect(estatico).toContain(ERRORES.rateLimited);

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(segundos).toHaveTextContent('87');
    expect((alerta.textContent ?? '').replace(segundos.textContent ?? '', '')).toBe(estatico);
  });

  it('con `restantes` recibido no arranca su propio temporizador', () => {
    renderWithProviders(
      <MensajeErrorPro error={{ kind: 'rateLimited', retryAfterSec: 90, lockout: true }} id="e" restantes={42} />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('42');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rateLimited con segundos cuenta hacia atrás cada segundo', () => {
    renderWithProviders(<MensajeErrorPro error={{ kind: 'rateLimited', retryAfterSec: 90, lockout: true }} id="e" />);
    expect(screen.getByRole('alert')).toHaveTextContent('en 90 segundos');

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByRole('alert')).toHaveTextContent('en 87 segundos');
  });

  it('al llegar a cero vuelve al copy sin segundos', () => {
    renderWithProviders(<MensajeErrorPro error={{ kind: 'rateLimited', retryAfterSec: 2, lockout: true }} id="e" />);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByRole('alert')).toHaveTextContent(ERRORES.rateLimited);
  });

  it('rateLimited sin segundos usa el copy genérico', () => {
    renderWithProviders(<MensajeErrorPro error={{ kind: 'rateLimited', retryAfterSec: null, lockout: false }} id="e" />);
    expect(screen.getByRole('alert')).toHaveTextContent(ERRORES.rateLimited);
    expect(screen.getByRole('alert')).not.toHaveTextContent(/segundos/);
  });

  it('limpia el intervalo al desmontar', () => {
    const { unmount } = renderWithProviders(
      <MensajeErrorPro error={{ kind: 'rateLimited', retryAfterSec: 90, lockout: true }} id="e" />,
    );
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
