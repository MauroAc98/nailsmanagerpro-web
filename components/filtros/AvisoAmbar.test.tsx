import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AvisoAmbar } from './AvisoAmbar';

describe('AvisoAmbar', () => {
  it('renders the message as a span by default', () => {
    render(<AvisoAmbar>Aviso</AvisoAmbar>);
    expect(screen.getByText('Aviso').tagName).toBe('SPAN');
  });

  it('can render as a paragraph and merges the style override', () => {
    render(<AvisoAmbar as="p" style={{ margin: '22px 0 0' }}>Aviso</AvisoAmbar>);
    const el = screen.getByText('Aviso');
    expect(el.tagName).toBe('P');
    expect(el.style.margin).toBe('22px 0px 0px');
    expect(el.style.fontSize).toBe('12.5px');
  });
});
