import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SettingsModal from '../SettingsModal';
import { AppSettings } from '../../types';

const mockSettings: AppSettings = {
  enableAI: true,
  simplificationLevel: 'low',
  layers: {
    buildings: true,
    roads: true,
    nature: true,
    terrain: true,
    furniture: true,
    labels: true
  },
  projection: 'local',
  theme: 'dark',
  mapProvider: 'vector'
};

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  settings: mockSettings,
  onUpdateSettings: vi.fn(),
  selectionMode: 'radius' as const,
  onSelectionModeChange: vi.fn(),
  radius: 500,
  onRadiusChange: vi.fn(),
  polygon: [],
  onClearPolygon: vi.fn(),
  hasData: true,
  isDownloading: false,
  onExportDxf: vi.fn(),
  onExportGeoJSON: vi.fn()
};

describe('SettingsModal Component', () => {
  it('renders correctly when open', () => {
    render(<SettingsModal {...defaultProps} />);
    expect(screen.getByText('Painel de Controle')).toBeInTheDocument();
    expect(screen.getByText('Exportar Resultados')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<SettingsModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByText('Painel de Controle')).not.toBeInTheDocument();
  });

  it('calls onUpdateSettings when toggling theme', () => {
    render(<SettingsModal {...defaultProps} />);
    const themeButton = screen.getByText(/Tema Escuro/i).parentElement?.querySelector('button');
    fireEvent.click(themeButton!);
    expect(defaultProps.onUpdateSettings).toHaveBeenCalledWith(
      expect.objectContaining({ theme: 'light' })
    );
  });

  it('calls onUpdateSettings when changing simplification level', () => {
    render(<SettingsModal {...defaultProps} />);
    const highButton = screen.getByText('high');
    fireEvent.click(highButton);
    expect(defaultProps.onUpdateSettings).toHaveBeenCalledWith(
      expect.objectContaining({ simplificationLevel: 'high' })
    );
  });

  it('calls onExportDxf when button is clicked', () => {
    render(<SettingsModal {...defaultProps} />);
    const exportButton = screen.getByText('DXF (CAD)');
    fireEvent.click(exportButton);
    expect(defaultProps.onExportDxf).toHaveBeenCalled();
  });

  it('disables export buttons when isDownloading is true', () => {
    render(<SettingsModal {...defaultProps} isDownloading={true} />);
    const exportButton = screen.getByText(/DXF/i).closest('button');
    expect(exportButton).toBeDisabled();
  });
});