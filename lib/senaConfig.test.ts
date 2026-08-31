import { describe, expect, it } from 'vitest';
import {
  sanitizarLineaSimple,
  validarSenaConfig,
  formatearMontoSena,
  formatearCbuSena,
  armarDatosCuentaSena,
} from './senaConfig';

// Mirrors the backend seña guard (`AuthController::updatePerfil`) and the
// `WhatsappTemplate::unaLinea` whitespace handling. Frontend must reject the
// same states client-side so the user never round-trips a 422.

describe('sanitizarLineaSimple', () => {
  it('strips carriage returns, newlines and tabs', () => {
    expect(sanitizarLineaSimple('Ana\r\nGomez\tSA')).toBe('Ana Gomez SA');
  });

  it('collapses interior runs of whitespace to a single space', () => {
    expect(sanitizarLineaSimple('Banco    Nacion')).toBe('Banco Nacion');
  });

  it('trims the edges', () => {
    expect(sanitizarLineaSimple('  ana.gomez.mp  ')).toBe('ana.gomez.mp');
  });

  it('returns an empty string when the value is only whitespace', () => {
    expect(sanitizarLineaSimple('  \n\t ')).toBe('');
  });

  it('leaves an already-clean value untouched', () => {
    expect(sanitizarLineaSimple('ana.gomez.mp')).toBe('ana.gomez.mp');
  });
});

describe('formatearMontoSena', () => {
  it('formats es-AR with a $ sign, dot thousands and comma decimals', () => {
    expect(formatearMontoSena(5000)).toBe('$5.000,00');
    expect(formatearMontoSena(3500.5)).toBe('$3.500,50');
    expect(formatearMontoSena(12)).toBe('$12,00');
  });
});

describe('formatearCbuSena', () => {
  it('groups the digits in fours', () => {
    expect(formatearCbuSena('2850001040094993682358')).toBe('2850 0010 4009 4993 6823 58');
  });

  it('strips non-digits before grouping', () => {
    expect(formatearCbuSena('2850-0010 4009')).toBe('2850 0010 4009');
  });
});

describe('armarDatosCuentaSena', () => {
  it('joins the filled fields in one line, labelling alias and CBU', () => {
    expect(armarDatosCuentaSena({
      titular: 'Ana Pérez', entidad: 'Banco Macro SA',
      alias: 'ana.mp', cbu: '2850001040094993682358',
    })).toBe('Ana Pérez · Banco Macro SA · Alias: ana.mp · CBU: 2850 0010 4009 4993 6823 58');
  });

  it('omits empty fields without leaving dangling separators', () => {
    expect(armarDatosCuentaSena({ titular: 'Ana Pérez', entidad: '', alias: 'ana.mp', cbu: '' }))
      .toBe('Ana Pérez · Alias: ana.mp');
  });

  it('collapses interior whitespace in each part', () => {
    expect(armarDatosCuentaSena({ titular: 'Ana\n\tPérez', entidad: '', alias: '', cbu: '' }))
      .toBe('Ana Pérez');
  });
});

describe('validarSenaConfig', () => {
  const valido = {
    monto: 5000,
    direccion: 'Av. Siempreviva 742',
    titular: 'Ana Gomez',
    alias: 'ana.gomez.mp',
    cbu: '',
  };

  it('returns no errors when monto, direccion, titular and alias are present', () => {
    expect(validarSenaConfig(valido)).toEqual({});
  });

  it('accepts CBU instead of alias', () => {
    expect(validarSenaConfig({ ...valido, alias: '', cbu: '0000003100010000000001' })).toEqual({});
  });

  it('does not require entidad or CBU when alias is present', () => {
    expect(validarSenaConfig({ ...valido, cbu: '' })).toEqual({});
  });

  it('flags a missing monto', () => {
    expect(validarSenaConfig({ ...valido, monto: undefined }).sena_monto).toBe('montoRequerido');
  });

  it('flags a zero or negative monto', () => {
    expect(validarSenaConfig({ ...valido, monto: 0 }).sena_monto).toBe('montoRequerido');
  });

  it('flags a missing direccion, pointing the user to the other sheet', () => {
    expect(validarSenaConfig({ ...valido, direccion: '   ' }).direccion).toBe('direccionRequerida');
  });

  it('flags a missing titular', () => {
    expect(validarSenaConfig({ ...valido, titular: '' }).whatsapp_sena_titular).toBe('titularRequerido');
  });

  it('flags the alias field when neither alias nor CBU is provided', () => {
    const errores = validarSenaConfig({ ...valido, alias: '', cbu: '' });
    expect(errores.whatsapp_sena_alias).toBe('aliasOCbuRequerido');
  });

  it('reports every missing field at once', () => {
    expect(validarSenaConfig({ monto: undefined, direccion: '', titular: '', alias: '', cbu: '' })).toEqual({
      sena_monto: 'montoRequerido',
      direccion: 'direccionRequerida',
      whatsapp_sena_titular: 'titularRequerido',
      whatsapp_sena_alias: 'aliasOCbuRequerido',
    });
  });
});
