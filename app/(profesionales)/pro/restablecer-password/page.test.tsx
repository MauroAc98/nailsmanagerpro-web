import { describe, expect, it } from 'vitest';
import { metadata } from './page';

describe('página de restablecer contraseña', () => {
  it('pide al navegador no mandar Referer (el link del correo puede traer datos en la URL)', () => {
    expect(metadata.referrer).toBe('no-referrer');
  });
});
