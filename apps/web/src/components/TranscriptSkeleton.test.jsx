import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TranscriptSkeleton } from './TranscriptSkeleton.jsx';

describe('TranscriptSkeleton', () => {
  it('renders a recognizable placeholder', () => {
    render(<TranscriptSkeleton />);
    expect(screen.getByTestId('transcript-skeleton')).toBeInTheDocument();
  });
});
