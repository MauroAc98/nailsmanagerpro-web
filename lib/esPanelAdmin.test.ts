import { describe, expect, it } from 'vitest';
import { esPanelAdmin } from './esPanelAdmin';

describe('esPanelAdmin', () => {
  it('admin.turnetto.com es el panel en cualquier ruta (URLs limpias, sin /admin)', () => {
    expect(esPanelAdmin('admin.turnetto.com', '/')).toBe(true);
    expect(esPanelAdmin('admin.turnetto.com', '/login')).toBe(true);
    expect(esPanelAdmin('admin.turnetto.com', '/suscripciones')).toBe(true);
  });

  it('en cualquier otro host, /admin y todo lo que cuelga de ahi es el panel', () => {
    expect(esPanelAdmin('localhost', '/admin')).toBe(true);
    expect(esPanelAdmin('localhost', '/admin/login')).toBe(true);
    expect(esPanelAdmin('app.turnetto.com', '/admin/negocios')).toBe(true);
  });

  it('una ruta que solo empieza con las mismas letras no es el panel', () => {
    expect(esPanelAdmin('localhost', '/administracion')).toBe(false);
    expect(esPanelAdmin('localhost', '/adminX/login')).toBe(false);
  });

  it('sin host (renderizado en servidor) decide solo el prefijo de la ruta', () => {
    expect(esPanelAdmin(null, '/admin')).toBe(true);
    expect(esPanelAdmin(null, '/admin/login')).toBe(true);
    expect(esPanelAdmin(null, '/agenda')).toBe(false);
    expect(esPanelAdmin(null, '/login')).toBe(false);
  });

  it('las pantallas del salon no son el panel', () => {
    expect(esPanelAdmin('localhost', '/agenda')).toBe(false);
    expect(esPanelAdmin('app.turnetto.com', '/login')).toBe(false);
  });
});
