import { describe, expect, it } from 'vitest';
import { renderWithProviders, screen } from '@/test/render';
import { PublicShell } from './PublicShell';

describe('PublicShell', () => {
  it('renderiza los hijos dentro del contenedor .reserva-publica', () => {
    renderWithProviders(
      <PublicShell>
        <p>contenido</p>
      </PublicShell>,
    );
    const hijo = screen.getByText('contenido');
    expect(hijo.closest('.reserva-publica')).not.toBeNull();
  });

  it('queda dentro de un scope de tema agenda (paleta del rediseno)', () => {
    renderWithProviders(
      <PublicShell>
        <p>contenido</p>
      </PublicShell>,
    );
    const scope = screen.getByText('contenido').closest('.agenda-light, .agenda-dark');
    expect(scope).not.toBeNull();
  });
});
