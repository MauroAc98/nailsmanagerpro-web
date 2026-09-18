import { describe, expect, it } from 'vitest';
import { parseFechaLocal, formatCellDate } from './agendaDateHelpers';

describe('parseFechaLocal', () => {
  it('parses a YYYY-MM-DD string into a local Date at midnight, no UTC shift', () => {
    const d = parseFechaLocal('2026-09-17');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(8); // septiembre, 0-indexado
    expect(d.getDate()).toBe(17);
  });

  it('round-trips with formatCellDate for any date, including month/year boundaries', () => {
    expect(formatCellDate(parseFechaLocal('2026-01-01'))).toBe('2026-01-01');
    expect(formatCellDate(parseFechaLocal('2026-12-31'))).toBe('2026-12-31');
  });
});
