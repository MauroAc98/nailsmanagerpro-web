import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AvisoEnvioEmail } from './AvisoEnvioEmail';

// El backend responde `email_enviado: false` (con 201) cuando el negocio se
// creó pero el mail con la contraseña provisoria falló: quien administra tiene
// que pasarla a mano. Con `true` o ausente (backend anterior) el aviso es el de siempre.
describe('AvisoEnvioEmail', () => {
  it('con el email enviado avisa y deja la pantalla como respaldo', () => {
    render(<AvisoEnvioEmail email="ana@negocio.com" enviado />);
    expect(screen.getByText(/También se envió esta contraseña por email a ana@negocio\.com/)).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('si la respuesta no trae el dato (backend anterior) se comporta como enviado', () => {
    render(<AvisoEnvioEmail email="ana@negocio.com" enviado={undefined} />);
    expect(screen.getByText(/También se envió esta contraseña por email/)).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('si el email falló, muestra una alerta para pasar la contraseña a mano', () => {
    render(<AvisoEnvioEmail email="ana@negocio.com" enviado={false} />);
    const alerta = screen.getByRole('alert');
    expect(alerta.textContent).toMatch(/No se pudo enviar el email a ana@negocio\.com/);
    expect(alerta.textContent).toMatch(/Pasale la contraseña provisoria/);
    expect(screen.queryByText(/También se envió/)).toBeNull();
  });
});
