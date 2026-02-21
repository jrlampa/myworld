/**
 * SettingsModal/index.tsx
 * Responsabilidade: Orquestração do modal de configurações.
 * Lógica de abas separada em GeneralTab e ProjectTab.
 * Rodapé de exportação em ExportFooter.
 */
import React, { useState } from 'react';
import { X, Cpu } from 'lucide-react';
import { AppSettings, GeoLocation, SelectionMode } from '../../types';
import GeneralTab from './GeneralTab';
import ProjectTab from './ProjectTab';
import ExportFooter from './ExportFooter';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (s: AppSettings) => void;

  // Selection Props
  selectionMode?: SelectionMode;
  onSelectionModeChange?: (mode: SelectionMode) => void;
  radius?: number;
  onRadiusChange?: (radius: number) => void;
  polygon?: GeoLocation[];
  onClearPolygon?: () => void;

  // Export Props
  hasData?: boolean;
  isDownloading?: boolean;
  onExportDxf?: () => void;
  onExportGeoJSON?: () => void;

  // Persistence Props
  onSaveProject?: () => void;
  onLoadProject?: (file: File) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  hasData,
  isDownloading,
  onExportDxf,
  onExportGeoJSON,
  onSaveProject,
  onLoadProject,
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'project'>('general');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center glass-overlay p-4">
      <div className="glass-card w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">

        {/* Cabeçalho */}
        <div className="flex items-center justify-between p-6 border-b border-white/20">
          <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--enterprise-blue)' }}>
            <Cpu size={24} style={{ color: 'var(--enterprise-blue-light)' }} />
            Painel de Controle
          </h2>
          <button onClick={onClose} className="text-slate-600 hover:text-slate-800 transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Abas */}
        <div className="flex border-b border-white/20">
          {(['general', 'project'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-sm font-medium transition-all ${activeTab === tab
                ? 'border-b-2 glass-panel-hover'
                : 'text-slate-600 hover:text-slate-800 hover:bg-white/20'}`}
              style={activeTab === tab ? {
                color: 'var(--enterprise-blue)',
                borderBottomColor: 'var(--enterprise-blue)',
              } : {}}
            >
              {tab === 'general' ? 'Geral & Exportação' : 'Projeto & Metadados'}
            </button>
          ))}
        </div>

        {/* Conteúdo */}
        <div className="p-6 space-y-8 overflow-y-auto custom-scrollbar flex-1">
          {activeTab === 'project' ? (
            <ProjectTab
              settings={settings}
              onUpdateSettings={onUpdateSettings}
              onSaveProject={onSaveProject}
              onLoadProject={onLoadProject}
            />
          ) : (
            <GeneralTab
              settings={settings}
              onUpdateSettings={onUpdateSettings}
            />
          )}
        </div>

        {/* Rodapé de Exportação */}
        <ExportFooter
          hasData={hasData}
          isDownloading={isDownloading}
          onExportDxf={onExportDxf}
          onExportGeoJSON={onExportGeoJSON}
        />
      </div>
    </div>
  );
};

export default SettingsModal;
