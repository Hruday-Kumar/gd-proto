import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ButtonBusyLabel } from './ButtonBusyLabel.jsx';

describe('ButtonBusyLabel', () => {
  it('renders the given label alongside an aria-hidden spinner icon', () => {
    render(<ButtonBusyLabel label="Signing in…" />);

    expect(screen.getByText('Signing in…')).toBeInTheDocument();
    const icon = screen.getByText('progress_activity');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
    expect(icon.className).toContain('animate-spin');
  });
});
