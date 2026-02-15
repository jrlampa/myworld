import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Dashboard from '../components/Dashboard';

describe('Dashboard Component', () => {
  const mockData = {
    buildings: 10,
    roads: 5,
    poles: 20,
    trees: 15,
    totalArea: 1000,
    totalLength: 500,
    violations: 2,
    coverageScore: 85
  };

  it('renders basic statistics correcty', () => {
    render(<Dashboard data={mockData} onAskAI={vi.fn()} />);

    expect(screen.getAllByText('10')).toHaveLength(2); // Buildings (standalone in both)
    expect(screen.getByText('20')).toBeInTheDocument(); // Poles (standalone in card only)
    expect(screen.getByText(/20 postes\/torres/)).toBeInTheDocument(); // Poles in report
    expect(screen.getByText(/1\.000.*m²/)).toBeInTheDocument(); // Area (stat card)
  });

  it('displays the Safety Audit card with violations', () => {
    render(<Dashboard data={mockData} onAskAI={vi.fn()} />);

    expect(screen.getByText('2 points')).toBeInTheDocument();
    expect(screen.getAllByText(/85%/)).toHaveLength(2);
  });

  it('shows a success state when violations are zero', () => {
    const cleanData = { ...mockData, violations: 0 };
    render(<Dashboard data={cleanData} onAskAI={vi.fn()} />);

    expect(screen.getByText('0 points')).toBeInTheDocument();
    expect(screen.getByText(/✅ Safe/)).toBeInTheDocument();
  });
});
