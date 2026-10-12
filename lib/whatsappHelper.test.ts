import { describe, it, expect } from 'vitest';
import { cuerpoPlantillaWhatsapp, quitarAvisoUnidireccional, whatsappHelper, type DatosPlantillaWhatsapp } from './whatsappHelper';

const base: DatosPlantillaWhatsapp = {
  nombreCliente: 'Martina',
  negocio:       'Estudio Bella',
  fecha:         '20/08',
  hora:          '15:30',
  servicios:     'Manicura semipermanente',
  direccion:     'Av. Siempreviva 742',
  profesional:   'Fernanda',
  telefono:      '+54 9 11 2345-6789',
};

describe('cuerpoPlantillaWhatsapp', () => {
  it('builds confirmacion_turno with the approved wording', () => {
    expect(cuerpoPlantillaWhatsapp('confirmacion', base)).toBe(
      'Hola Martina, tu turno en *Estudio Bella* quedó confirmado.\n\n' +
      '🗓️ 20/08 · 🕒 15:30 hs\n' +
      '✨ Manicura semipermanente\n' +
      '📍 Av. Siempreviva 742\n\n' +
      '⚠️ No responder a este mensaje: *Fernanda* no lo recibe.\n\n' +
      '📲 Para consultas o cambios, avisar al +54 9 11 2345-6789 con 24 hs de anticipación.'
    );
  });

  it('builds recordatorio_turno with the approved wording (🕒 with "hs", period inside the business bold)', () => {
    expect(cuerpoPlantillaWhatsapp('recordatorio', base)).toBe(
      'Hola Martina, te recordamos tu turno de mañana en *Estudio Bella.*\n\n' +
      '🗓️ 20/08 · 🕒 15:30 hs\n' +
      '✨ Manicura semipermanente\n' +
      '📍 Av. Siempreviva 742\n\n' +
      '⚠️ No responder a este mensaje: *Fernanda* no lo recibe.\n\n' +
      '📲 Para consultas o cambios, avisar al +54 9 11 2345-6789 con 24 hs de anticipación.'
    );
  });

  it('drops the 📍 line when there is no address', () => {
    const body = cuerpoPlantillaWhatsapp('confirmacion', { ...base, direccion: '' });
    expect(body).not.toContain('📍');
    expect(body).toContain('✨ Manicura semipermanente\n\n⚠️');
  });

  it('drops the contact line when there is no business phone', () => {
    const body = cuerpoPlantillaWhatsapp('recordatorio', { ...base, telefono: '' });
    expect(body).not.toContain('📲');
    expect(body.endsWith('*Fernanda* no lo recibe.')).toBe(true);
  });
});

describe('whatsappHelper.buildUrl', () => {
  it('targets wa.me with the AR mobile "9" prefix and the encoded body', () => {
    const url = whatsappHelper.buildUrl({
      clienteNombre:   'Martina',
      clienteTelefono: '5493764741700',
      servicio:        'Manicura',
      fecha:           '2026-08-20',
      hora:            '15:30',
      tipo:            'confirmacion',
      negocio:         'Estudio Bella',
      direccion:       'Av. Siempreviva 742',
      telefonoNegocio: '3764741700',
    });
    expect(url.startsWith('https://wa.me/5493764741700?text=')).toBe(true);
    const texto = decodeURIComponent(url.split('text=')[1]);
    expect(texto).toContain('Hola Martina, tu turno en *Estudio Bella* quedó confirmado.');
    expect(texto).toContain('🗓️ 20/08 · 🕒 15:30 hs');
    expect(texto).toContain('📲 Para consultas o cambios, avisar al +54 9 376 474-1700 con 24 hs de anticipación.');
  });

  it('never includes the "only notices" warning: a manual wa.me send comes from the salon\'s own WhatsApp', () => {
    const url = whatsappHelper.buildUrl({
      clienteNombre:   'Martina',
      clienteTelefono: '5493764741700',
      servicio:        'Manicura',
      fecha:           '2026-08-20',
      hora:            '15:30',
      tipo:            'confirmacion',
      negocio:         'Estudio Bella',
      direccion:       'Av. Siempreviva 742',
      telefonoNegocio: '3764741700',
    });
    const texto = decodeURIComponent(url.split('text=')[1]);
    expect(texto).not.toContain('⚠️');
    expect(texto).not.toContain('No responder');
    expect(texto).toContain('📍 Av. Siempreviva 742\n\n📲 Para consultas o cambios');
  });

  it('drops the optional lines without leaving the notice behind', () => {
    const url = whatsappHelper.buildUrl({
      clienteNombre:   'Martina',
      clienteTelefono: '5493764741700',
      servicio:        'Manicura',
      fecha:           '2026-08-20',
      hora:            '15:30',
      tipo:            'recordatorio',
      negocio:         'Estudio Bella',
      direccion:       null,
      telefonoNegocio: null,
    });
    const texto = decodeURIComponent(url.split('text=')[1]);
    expect(texto).not.toContain('no lo recibe');
    expect(texto).not.toContain('📍');
    expect(texto).not.toContain('📲');
    expect(texto.endsWith('✨ Manicura')).toBe(true);
  });
});

describe('quitarAvisoUnidireccional', () => {
  it('removes the new warning paragraph and keeps the rest intact', () => {
    const conAviso = cuerpoPlantillaWhatsapp('confirmacion', base);
    expect(conAviso).toContain('⚠️ No responder a este mensaje:');
    expect(quitarAvisoUnidireccional(conAviso)).toBe(
      'Hola Martina, tu turno en *Estudio Bella* quedó confirmado.\n\n' +
      '🗓️ 20/08 · 🕒 15:30 hs\n' +
      '✨ Manicura semipermanente\n' +
      '📍 Av. Siempreviva 742\n\n' +
      '📲 Para consultas o cambios, avisar al +54 9 11 2345-6789 con 24 hs de anticipación.'
    );
  });

  it('regression: removes the OLD warning stored by the backend before the template change', () => {
    const viejo =
      'Hola Martina, tu turno en *Estudio Bella* quedó confirmado.\n\n' +
      '🗓️ 20/08 · 🕒 15:30 hs\n' +
      '✨ Manicura semipermanente\n' +
      '📍 Av. Siempreviva 742\n\n' +
      '⚠️ Desde este número solo se envían avisos. Si respondés a este mensaje, *Fernanda no lo recibe y no puede contestarte.*\n\n' +
      'Para consultas o cambios de turno, comunicate al +54 9 11 2345-6789 con al menos 24 hs de anticipación.';
    expect(quitarAvisoUnidireccional(viejo)).toBe(
      'Hola Martina, tu turno en *Estudio Bella* quedó confirmado.\n\n' +
      '🗓️ 20/08 · 🕒 15:30 hs\n' +
      '✨ Manicura semipermanente\n' +
      '📍 Av. Siempreviva 742\n\n' +
      'Para consultas o cambios de turno, comunicate al +54 9 11 2345-6789 con al menos 24 hs de anticipación.'
    );
  });

  it('works when the new warning is the last paragraph', () => {
    const conAviso = cuerpoPlantillaWhatsapp('recordatorio', { ...base, telefono: '' });
    const limpio = quitarAvisoUnidireccional(conAviso);
    expect(limpio).not.toContain('⚠️');
    expect(limpio.endsWith('📍 Av. Siempreviva 742')).toBe(true);
  });

  it('never leaves three consecutive line breaks or surrounding whitespace', () => {
    const limpio = quitarAvisoUnidireccional(cuerpoPlantillaWhatsapp('recordatorio', base));
    expect(limpio).not.toMatch(/\n{3,}/);
    expect(limpio).toBe(limpio.trim());
  });

  it('leaves a text without the warning untouched', () => {
    expect(quitarAvisoUnidireccional('Hola Martina')).toBe('Hola Martina');
  });
});
