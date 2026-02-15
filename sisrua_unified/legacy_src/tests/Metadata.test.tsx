import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SettingsModal from '../components/SettingsModal';

describe('SettingsModal Metadata', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    layers: { buildings: true },
    onLayersChange: vi.fn(),
    crs: 'auto',
    onCrsChange: vi.fn(),
    exportFormat: 'dxf',
    onExportFormatChange: vi.fn(),
    showAnalysis: false,
    onShowAnalysisChange: vi.fn(),
    clientName: 'Initial Client',
    onClientNameChange: vi.fn(),
    projectId: 'Initial Project',
    onProjectIdChange: vi.fn(),
  };

  it('renders project metadata fields correctly', () => {
    render(<SettingsModal {...defaultProps} />);

    // Switch to Project tab
    const projectTab = screen.getByText(/Project/i);
    fireEvent.click(projectTab);

    expect(screen.getByDisplayValue('Initial Client')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Initial Project')).toBeInTheDocument();
  });

  it('calls onClientNameChange when input changes', () => {
    render(<SettingsModal {...defaultProps} />);

    const projectTab = screen.getByText(/Project/i);
    fireEvent.click(projectTab);

    const clientInput = screen.getByDisplayValue('Initial Client');
    fireEvent.change(clientInput, { target: { value: 'New Company' } });

    expect(defaultProps.onClientNameChange).toHaveBeenCalledWith('New Company');
  });

  it('calls onProjectIdChange when input changes', () => {
    render(<SettingsModal {...defaultProps} />);

    const projectTab = screen.getByText(/Project/i);
    fireEvent.click(projectTab);

    const projectInput = screen.getByDisplayValue('Initial Project');
    fireEvent.change(projectInput, { target: { value: 'PRJ-2026' } });

    expect(defaultProps.onProjectIdChange).toHaveBeenCalledWith('PRJ-2026');
  });
});
