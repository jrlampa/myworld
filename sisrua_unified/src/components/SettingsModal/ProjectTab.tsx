import React, { useRef } from 'react';
import { Save, FolderOpen, Briefcase } from 'lucide-react';
import { AppSettings, ProjectMetadata } from '../../types';

interface ProjectTabProps {
  settings: AppSettings;
  onUpdateSettings: (s: AppSettings) => void;
  onSaveProject?: () => void;
  onLoadProject?: (file: File) => void;
}

const ProjectTab: React.FC<ProjectTabProps> = ({
  settings,
  onUpdateSettings,
  onSaveProject,
  onLoadProject,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateMetadata = (key: keyof ProjectMetadata, value: string) => {
    onUpdateSettings({
      ...settings,
      projectMetadata: {
        ...settings.projectMetadata,
        [key]: value,
      },
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onLoadProject) {
      onLoadProject(file);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onSaveProject}
          disabled={!onSaveProject}
          className="btn-enterprise flex items-center justify-center gap-2 p-3 rounded-lg border border-white/30 text-slate-700 hover:text-slate-900 transition-all disabled:opacity-50"
        >
          <Save size={16} /> Salvar Projeto (.osmpro)
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={!onLoadProject}
          className="btn-enterprise flex items-center justify-center gap-2 p-3 rounded-lg border border-white/30 text-slate-700 hover:text-slate-900 transition-all disabled:opacity-50"
        >
          <FolderOpen size={16} /> Carregar Projeto
        </button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".osmpro,.json"
          className="hidden"
        />
      </div>

      <div className="glass-panel p-4 rounded-lg border border-white/20">
        <div className="flex items-center gap-2 mb-4" style={{ color: 'var(--enterprise-blue)' }}>
          <Briefcase size={18} />
          <h3 className="font-bold text-sm uppercase">Carimbo (Title Block)</h3>
        </div>
        <p className="text-xs text-slate-600 mb-4">Dados automáticos para o arquivo CAD.</p>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-600 block mb-1">Nome do Projeto</label>
            <input
              type="text"
              value={settings.projectMetadata?.projectName || ''}
              onChange={(e) => updateMetadata('projectName', e.target.value)}
              className="w-full glass-panel border border-white/30 rounded p-2 text-sm text-slate-800 focus:border-blue-400 outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-slate-600 block mb-1">Empresa</label>
            <input
              type="text"
              value={settings.projectMetadata?.companyName || ''}
              onChange={(e) => updateMetadata('companyName', e.target.value)}
              className="w-full glass-panel border border-white/30 rounded p-2 text-sm text-slate-800 focus:border-blue-400 outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-600 block mb-1">Responsável</label>
              <input
                type="text"
                value={settings.projectMetadata?.engineerName || ''}
                onChange={(e) => updateMetadata('engineerName', e.target.value)}
                className="w-full glass-panel border border-white/30 rounded p-2 text-sm text-slate-800 focus:border-blue-400 outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-slate-600 block mb-1">Data</label>
              <input
                type="text"
                value={settings.projectMetadata?.date || ''}
                onChange={(e) => updateMetadata('date', e.target.value)}
                className="w-full glass-panel border border-white/30 rounded p-2 text-sm text-slate-800 focus:border-blue-400 outline-none"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectTab;
