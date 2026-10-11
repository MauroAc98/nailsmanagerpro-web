import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { Skeleton } from './Skeleton';

describe('Skeleton', () => {
  it('es una barra decorativa con la animación compartida y las medidas pedidas', () => {
    const { container } = render(<Skeleton width={40} height={10} />);
    const barra = container.firstElementChild as HTMLElement;
    expect(barra).toHaveAttribute('aria-hidden', 'true');
    expect(barra).toHaveClass('rz-skeleton');
    expect(barra.style.width).toBe('40px');
    expect(barra.style.height).toBe('10px');
  });
});
