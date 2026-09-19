import { describe, expect, it } from 'vitest';
import { linkComoLlegar, linkGoogleCalendar } from './calendario';

describe('linkGoogleCalendar', () => {
  it('arma fechas de inicio/fin de pared a partir de fecha, hora y duracion', () => {
    const url = new URL(
      linkGoogleCalendar({ titulo: 'Turno en Studio Demo', fecha: '2026-09-22', hora: '13:00', duracionMinutos: 75 }),
    );
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render');
    expect(url.searchParams.get('action')).toBe('TEMPLATE');
    expect(url.searchParams.get('text')).toBe('Turno en Studio Demo');
    expect(url.searchParams.get('dates')).toBe('20260922T130000/20260922T141500');
    expect(url.searchParams.get('ctz')).toBe('America/Argentina/Buenos_Aires');
  });

  it('un turno que cruza la medianoche termina al dia siguiente', () => {
    const url = new URL(
      linkGoogleCalendar({ titulo: 'x', fecha: '2026-09-22', hora: '23:30', duracionMinutos: 60 }),
    );
    expect(url.searchParams.get('dates')).toBe('20260922T233000/20260923T003000');
  });

  it('incluye la ubicacion si existe', () => {
    const url = new URL(
      linkGoogleCalendar({ titulo: 'x', fecha: '2026-09-22', hora: '10:00', duracionMinutos: 30, ubicacion: 'Av. X 1' }),
    );
    expect(url.searchParams.get('location')).toBe('Av. X 1');
  });
});

describe('linkComoLlegar', () => {
  it('busca la direccion en Google Maps', () => {
    const url = new URL(linkComoLlegar('Av. Siempreviva 742'));
    expect(url.searchParams.get('query')).toBe('Av. Siempreviva 742');
  });
});
