import React from 'react';
import { Project, Language } from '../types';
import { FolderOpen, Plus, Calendar, Package, Settings, Globe } from 'lucide-react';
import { t } from '../translations';

interface DashboardProps {
  projects: Project[];
  lang: Language;
  setLang: (lang: Language) => void;
  onCreateProject: () => void;
  onSelectProject: (id: string) => void;
  onOpenSettings: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ projects, lang, setLang, onCreateProject, onSelectProject, onOpenSettings }) => {
  
  const toggleLang = () => setLang(lang === 'en' ? 'tr' : 'en');

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-10">
        <div>
            <h1 className="text-3xl font-bold text-white mb-2">{t(lang, 'projects')}</h1>
            <p className="text-slate-400">{t(lang, 'manageEstimations')}</p>
        </div>
        <div className="flex gap-3">
            <button 
              onClick={toggleLang}
              className="bg-slate-800 hover:bg-slate-700 text-blue-400 px-4 py-3 rounded-lg flex items-center gap-2 font-medium transition-all border border-slate-700 uppercase"
            >
              <Globe size={20} /> {lang}
            </button>
            <button 
              onClick={onOpenSettings}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-3 rounded-lg flex items-center gap-2 font-medium transition-all border border-slate-700"
            >
              <Settings size={20} /> {t(lang, 'systems')}
            </button>
            <button 
              onClick={onCreateProject}
              className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-lg flex items-center gap-2 font-medium transition-all shadow-lg shadow-blue-900/20"
            >
              <Plus size={20} /> {t(lang, 'newProject')}
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project) => (
          <div 
            key={project.id}
            onClick={() => onSelectProject(project.id)}
            className="group bg-slate-800 border border-slate-700 hover:border-blue-500 rounded-xl p-6 cursor-pointer transition-all hover:shadow-xl hover:-translate-y-1 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <FolderOpen size={64} />
            </div>

            <div className="flex justify-between items-start mb-4">
                <div className={`px-3 py-1 rounded-full text-xs font-medium border ${
                    project.status === 'Draft' ? 'bg-yellow-900/30 border-yellow-700 text-yellow-500' :
                    project.status === 'Production' ? 'bg-emerald-900/30 border-emerald-700 text-emerald-500' :
                    'bg-slate-700 border-slate-600 text-slate-400'
                }`}>
                    {project.status === 'Draft' ? t(lang, 'statusDraft') : 
                     project.status === 'Production' ? t(lang, 'statusProd') : t(lang, 'statusComp')}
                </div>
            </div>

            <h3 className="text-xl font-semibold text-white mb-1 group-hover:text-blue-400 transition-colors">{project.name}</h3>
            <p className="text-slate-400 text-sm mb-6">{project.client}</p>

            <div className="flex items-center justify-between text-sm text-slate-500 border-t border-slate-700 pt-4">
                <div className="flex items-center gap-2">
                    <Calendar size={14} />
                    <span>{project.date}</span>
                </div>
                <div className="flex items-center gap-2">
                    <Package size={14} />
                    <span>{project.units.length} {t(lang, 'units')}</span>
                </div>
            </div>
          </div>
        ))}

        {/* Empty State / Create New Card */}
        <button 
            onClick={onCreateProject}
            className="border-2 border-dashed border-slate-700 rounded-xl p-6 flex flex-col items-center justify-center text-slate-500 hover:text-blue-400 hover:border-blue-500/50 hover:bg-slate-800/50 transition-all group"
        >
            <div className="w-12 h-12 rounded-full bg-slate-800 group-hover:bg-blue-900/30 flex items-center justify-center mb-4 transition-colors">
                <Plus size={24} />
            </div>
            <span className="font-medium">{t(lang, 'createProject')}</span>
        </button>
      </div>
    </div>
  );
};

export default Dashboard;
