import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { iniciarResetDeStoresPorCambioDeCuenta } from './resetearStoresDeDatos';
import { useAuthStore } from '@/store/useAuthStore';
import { useClientesStore } from '@/store/useClienteStore';
import { useServiciosStore } from '@/store/useServicioStore';

const usuario = (id: number) => ({ id }) as never;

describe('iniciarResetDeStoresPorCambioDeCuenta', () => {
  let detener: () => void;

  beforeEach(() => {
    useAuthStore.setState({ user: null });
    useClientesStore.setState(useClientesStore.getInitialState(), true);
    useServiciosStore.setState(useServiciosStore.getInitialState(), true);
    detener = iniciarResetDeStoresPorCambioDeCuenta();
  });

  afterEach(() => detener());

  it('vacía los stores de datos cuando el usuario cierra sesión', () => {
    useAuthStore.setState({ user: usuario(1) });
    useClientesStore.setState({ clientes: [{ id: 9 }] as never });
    useServiciosStore.setState({ servicios: [{ id: 3 }] as never });

    useAuthStore.setState({ user: null });

    expect(useClientesStore.getState().clientes).toEqual([]);
    expect(useServiciosStore.getState().servicios).toEqual([]);
  });

  it('vacía los stores cuando entra otra cuenta sin pasar por null', () => {
    useAuthStore.setState({ user: usuario(1) });
    useClientesStore.setState({ clientes: [{ id: 9 }] as never });

    useAuthStore.setState({ user: usuario(2) });

    expect(useClientesStore.getState().clientes).toEqual([]);
  });

  it('no borra datos en el primer login (null -> usuario)', () => {
    useClientesStore.setState({ clientes: [{ id: 9 }] as never });

    useAuthStore.setState({ user: usuario(1) });

    expect(useClientesStore.getState().clientes).toHaveLength(1);
  });

  it('no borra datos si cambia otro campo del mismo usuario', () => {
    useAuthStore.setState({ user: usuario(1) });
    useClientesStore.setState({ clientes: [{ id: 9 }] as never });

    useAuthStore.setState({ user: usuario(1), loading: true });

    expect(useClientesStore.getState().clientes).toHaveLength(1);
  });
});
