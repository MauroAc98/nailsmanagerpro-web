import { describe, expect, it } from 'vitest';
import { bytesDeDataUrl, moverFoto, quitarFoto, TOPE_BYTES_FOTO } from './fotos';

describe('moverFoto', () => {
  it('mueve una foto una posicion a la derecha', () => {
    expect(moverFoto(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
  });
  it('mueve una foto una posicion a la izquierda', () => {
    expect(moverFoto(['a', 'b', 'c'], 2, -1)).toEqual(['a', 'c', 'b']);
  });
  it('en los extremos no hace nada (devuelve una copia igual)', () => {
    const lista = ['a', 'b'];
    expect(moverFoto(lista, 0, -1)).toEqual(['a', 'b']);
    expect(moverFoto(lista, 1, 1)).toEqual(['a', 'b']);
    expect(moverFoto(lista, 0, -1)).not.toBe(lista);
  });
  it('mover a la izquierda la segunda foto la vuelve portada', () => {
    expect(moverFoto(['a', 'b', 'c'], 1, -1)[0]).toBe('b');
  });
});

describe('quitarFoto', () => {
  it('quita la foto del indice y conserva el orden del resto', () => {
    expect(quitarFoto(['a', 'b', 'c'], 1)).toEqual(['a', 'c']);
  });
  it('quitar la portada promueve a la siguiente', () => {
    expect(quitarFoto(['a', 'b'], 0)[0]).toBe('b');
  });
  it('un indice fuera de rango no cambia la lista', () => {
    expect(quitarFoto(['a'], 5)).toEqual(['a']);
  });
});

describe('bytesDeDataUrl', () => {
  it('estima los bytes decodificados del base64', () => {
    // 8 caracteres base64 = 6 bytes
    expect(bytesDeDataUrl('data:image/jpeg;base64,AAAAAAAA')).toBe(6);
  });
  it('el tope es de 400 KB', () => {
    expect(TOPE_BYTES_FOTO).toBe(400 * 1024);
  });
});
