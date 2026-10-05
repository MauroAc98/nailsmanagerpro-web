import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SegmentedControl } from './SegmentedControl';

const options = [
  { value: 'a', label: 'Uno' },
  { value: 'b', label: 'Dos' },
] as const;

describe('SegmentedControl', () => {
  it('marks only the selected option as pressed', () => {
    render(<SegmentedControl options={options} value="b" onChange={vi.fn()} ariaLabel="Modo" />);
    expect(screen.getByRole('button', { name: 'Uno' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Dos' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('calls onChange with the option value', () => {
    const onChange = vi.fn();
    render(<SegmentedControl options={options} value="a" onChange={onChange} ariaLabel="Modo" />);
    fireEvent.click(screen.getByRole('button', { name: 'Dos' }));
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('exposes a labelled group', () => {
    render(<SegmentedControl options={options} value="a" onChange={vi.fn()} ariaLabel="Modo" />);
    expect(screen.getByRole('group', { name: 'Modo' })).toBeInTheDocument();
  });
});
