import { describe, expect, it, vi } from 'vitest';
import { fireEvent, renderWithProviders, screen } from '@/test/render';
import { CampoPassword } from './CampoPassword';

function montar(extra: Partial<React.ComponentProps<typeof CampoPassword>> = {}) {
  const onChange = vi.fn();
  renderWithProviders(
    <CampoPassword id="pw" label="Contraseña" value="secreta" onChange={onChange} autoComplete="current-password" {...extra} />,
  );
  return { onChange, input: screen.getByLabelText('Contraseña') as HTMLInputElement };
}

describe('CampoPassword', () => {
  it('tiene label asociado y arranca oculto', () => {
    const { input } = montar();
    expect(input).toHaveAttribute('type', 'password');
    expect(input).toHaveAttribute('autocomplete', 'current-password');
  });

  it('el botón alterna entre texto y password y cambia su etiqueta', () => {
    const { input } = montar();
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña' }));
    expect(input).toHaveAttribute('type', 'text');

    fireEvent.click(screen.getByRole('button', { name: 'Ocultar contraseña' }));
    expect(input).toHaveAttribute('type', 'password');
  });

  it('el botón no envía el formulario y es tocable (44 px)', () => {
    montar();
    const boton = screen.getByRole('button', { name: 'Mostrar contraseña' });
    expect(boton).toHaveAttribute('type', 'button');
    expect(boton).toHaveStyle({ minHeight: '44px', minWidth: '44px' });
    expect(screen.getByLabelText('Contraseña')).toHaveStyle({ minHeight: '44px' });
  });

  it('avisa los cambios con el valor escrito', () => {
    const { onChange, input } = montar();
    fireEvent.change(input, { target: { value: 'otra' } });
    expect(onChange).toHaveBeenCalledWith('otra');
  });

  it('con error lo marca inválido y lo describe', () => {
    const { input } = montar({ error: true, describedBy: 'err' });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'err');
  });

  it('deshabilitado bloquea el campo', () => {
    const { input } = montar({ disabled: true });
    expect(input).toBeDisabled();
  });

  it('no escribe el valor en ningún atributo ni en el texto', () => {
    const { input } = montar();
    expect(input.outerHTML.replace(/value="secreta"/, '')).not.toContain('secreta');
    expect(screen.queryByText('secreta')).toBeNull();
  });
});
