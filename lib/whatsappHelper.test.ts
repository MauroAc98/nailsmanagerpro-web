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
  it('builds confirmacion_turno with the approved wording (🕒 with "hs")', () => {
    expect(cuerpoPlantillaWhatsapp('confirmacion', base)).toBe(
      'Hola Martina, tu turno en *Estudio Bella* quedó confirmado.\n\n' +
      '🗓️ 20/08 · 🕒 15:30 hs\n' +
      '✨ Manicura semipermanente\n' +
      '📍 Av. Siempreviva 742\n\n' +
      '⚠️ Desde este número solo se envían avisos. Si respondés a este mensaje, *Fernanda no lo recibe y no puede contestarte.*\n\n' +
      'Para consultas o cambios de turno, comunicate al +54 9 11 2345-6789 con al menos 24 hs de anticipación.'
    );
  });

  it('builds recordatorio_turno with 🕒 and no "hs", and the period inside the business bold', () => {
    const body = cuerpoPlantillaWhatsapp('recordatorio', base);
    expect(body).toContain('te recordamos tu turno de mañana en *Estudio Bella.*');
    expect(body).toContain('🗓️ 20/08 · 🕒 15:30\n');
    expect(body).not.toContain('🕒 15:30 hs');
  });

  it('drops the 📍 line when there is no address', () => {
    const body = cuerpoPlantillaWhatsapp('confirmacion', { ...base, direccion: '' });
    expect(body).not.toContain('📍');
    expect(body).toContain('✨ Manicura semipermanente\n\n⚠️');
  });

  it('drops the contact line when there is no business phone', () => {
    const body = cuerpoPlantillaWhatsapp('recordatorio', { ...base, telefono: '' });
    expect(body).not.toContain('comunicate al');
    expect(body.endsWith('no puede contestarte.*')).toBe(true);
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
    expect(texto).toContain('comunicate al +54 9 376 474-1700');
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
    expect(texto).not.toContain('no puede contestarte');
    expect(texto).toContain('📍 Av. Siempreviva 742\n\nPara consultas o cambios de turno');
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
    expect(texto).not.toContain('comunicate al');
    expect(texto.endsWith('✨ Manicura')).toBe(true);
  });
});

describe('quitarAvisoUnidireccional', () => {
  it('removes the warning paragraph from a backend-built message and keeps the rest intact', () => {
    const conAviso = cuerpoPlantillaWhatsapp('confirmacion', base);
    expect(quitarAvisoUnidireccional(conAviso)).toBe(
      'Hola Martina, tu turno en *Estudio Bella* quedó confirmado.\n\n' +
      '🗓️ 20/08 · 🕒 15:30 hs\n' +
      '✨ Manicura semipermanente\n' +
      '📍 Av. Siempreviva 742\n\n' +
      'Para consultas o cambios de turno, comunicate al +54 9 11 2345-6789 con al menos 24 hs de anticipación.'
    );
  });

  it('works when the warning is the last paragraph', () => {
    const conAviso = cuerpoPlantillaWhatsapp('recordatorio', { ...base, telefono: '' });
    const sinAviso = quitarAvisoUnidireccional(conAviso);
    expect(sinAviso).not.toContain('⚠️');
    expect(sinAviso.endsWith('📍 Av. Siempreviva 742')).toBe(true);
  });

  it('leaves a text without the warning untouched', () => {
    expect(quitarAvisoUnidireccional('Hola Martina')).toBe('Hola Martina');
  });
});
