import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HistoryListSkeleton } from './HistoryListSkeleton.jsx';

describe('HistoryListSkeleton', () => {
  it('renders a recognizable placeholder', () => {
    render(<HistoryListSkeleton />);
    expect(screen.getByTestId('history-list-skeleton')).toBeInTheDocument();
  });
});
