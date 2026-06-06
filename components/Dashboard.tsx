
import React, { useState } from 'react';
import { Project, Language } from '../types';
import { Plus, Settings, User, Search, MoreVertical, Calendar, X, Save, Edit2, Sparkles } from 'lucide-react';
import { t } from '../translations';
import Logo from './Logo';
import { getSessionInfo } from '../services/authService';

interface DashboardProps {
  projects: Project[];
  lang: Language;
  setLang: (lang: Language) => void;
  onCreateProject: () => void;
  onSelectProject: (id: string) => void;
  onUpdateProject: (project: Project) => void;
  onOpenSettings: () => void;
  forcedName?: string;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  projects, 
  lang, 
  setLang, 
  onCreateProject, 
  onSelectProject, 
  onUpdateProject,
  onOpenSettings, 
  forcedName 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [showMenuId, setShowMenuId] = useState<string | null>(null);
  
  const toggleLang = () => setLang(lang === 'en' ? 'tr' : 'en');
  const session = getSessionInfo();
  const displayName = forcedName || session.companyName;

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.client.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusLabel = (status: Project['status']) => {
    switch(status) {
      case 'Draft': return t(lang, 'statusDraft');
      case 'Production': return t(lang, 'statusProd');
      case 'Completed': return t(lang, 'statusComp');
      default: return status;
    }
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProject) {
      onUpdateProject(editingProject);
      setEditingProject(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <div className="border-b border-white/5 bg-slate-900/40 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-3 flex justify-between items-center">
            <div className="flex items-center gap-3">
                <Logo className="w-8 h-8" />
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full animate-pulse-slow">
                    <Sparkles size={10} className="text-emerald-500" />
                    <span className="text-[9px] font-black text-emerald-500 tracking-tighter uppercase">{t(lang, 'version')} {t(lang, 'softwareUpdated')}</span>
                </div>
            </div>
            
            <div className="flex items-center gap-6">
                <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-slate-800/50 rounded-full border border-white/5 text-xs">
                    <User size={14} className="text-blue-400" />
                    <span className="text-slate-300 font-medium">{displayName}</span>
                    <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded text-[10px] uppercase font-bold tracking-tighter">
                      {session.plan}
                    </span>
                </div>
                
                <div className="flex items-center gap-4">
                    <button onClick={onOpenSettings} className="p-2 text-slate-400 hover:text-white transition-colors">
                        <Settings size={20} />
                    </button>
                    <button onClick={toggleLang} className="text-xs font-bold text-slate-500 hover:text-blue-400 transition-colors border border-slate-800 px-2 py-1 rounded">
                        {lang.toUpperCase()}
                    </button>
                </div>
            </div>
        </div>
      </div>

      <div className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div>
                <h1 className="text-4xl font-extrabold text-white tracking-tight mb-2">{t(lang, 'projects')}</h1>
                <p className="text-slate-400 max-w-md">{t(lang, 'manageEstimations')}</p>
            </div>
            <button onClick={onCreateProject} className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-xl flex items-center justify-center gap-3 font-bold transition-all shadow-2xl shadow-blue-900/20 hover:-translate-y-0.5">
                <Plus size={22} strokeWidth={3} /> {t(lang, 'newProject')}
            </button>
        </div>

        <div className="mb-8 flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input 
                  type="text" 
                  placeholder={t(lang, 'searchPlaceholder')} 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                  className="w-full bg-slate-900 border border-white/5 rounded-xl py-3 pl-12 pr-4 text-white outline-none focus:border-blue-500/30 transition-all" 
                />
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((project) => (
            <div key={project.id} onClick={() => onSelectProject(project.id)} className="group bg-slate-900/40 border border-white/5 hover:border-blue-500/30 rounded-2xl p-6 cursor-pointer transition-all hover:-translate-y-1 relative">
              <div className="flex justify-between items-start mb-6">
                  <div className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest border ${
                      project.status === 'Draft' ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500' : 
                      project.status === 'Production' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' :
                      'bg-slate-500/10 border-slate-500/20 text-slate-400'
                  }`}>
                    {getStatusLabel(project.status)}
                  </div>
                  <div className="relative">
                    <button 
                      onClick={(e) => { e.stopPropagation(); setShowMenuId(showMenuId === project.id ? null : project.id); }} 
                      className="text-slate-600 hover:text-white transition-colors p-1"
                    >
                      <MoreVertical size={18} />
                    </button>
                    {showMenuId === project.id && (
                      <div className="absolute right-0 top-8 w-40 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-30 py-1 overflow-hidden">
                        <button 
                          onClick={(e) => { e.stopPropagation(); setEditingProject(project); setShowMenuId(null); }}
                          className="w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 flex items-center gap-2"
                        >
                          <Edit2 size={14} /> {t(lang, 'edit')}
                        </button>
                      </div>
                    )}
                  </div>
              </div>
              <h3 className="text-xl font-bold text-white mb-1 group-hover:text-blue-400 transition-colors">{project.name}</h3>
              <p className="text-slate-500 text-sm mb-6 flex items-center gap-2"><User size={14} /> {project.client}</p>
              <div className="flex items-center justify-between text-xs text-slate-500 border-t border-white/5 pt-4">
                  <div className="flex items-center gap-2"><Calendar size={14} /><span>{project.date}</span></div>
                  <div className="flex items-center gap-2 px-2 py-1 bg-slate-800 rounded"><Logo className="w-4 h-4" showText={false} /><span className="text-slate-300 font-mono">{project.units.length} {t(lang, 'positions')}</span></div>
              </div>
            </div>
          ))}
          <button onClick={onCreateProject} className="border-2 border-dashed border-white/5 rounded-2xl p-6 flex flex-col items-center justify-center text-slate-600 hover:text-blue-400 hover:border-blue-500/20 transition-all group min-h-[220px]">
              <div className="w-12 h-12 rounded-full bg-slate-900 group-hover:bg-blue-500/10 flex items-center justify-center mb-4 transition-colors"><Plus size={24} /></div>
              <span className="font-bold text-sm tracking-wide">{t(lang, 'createProject')}</span>
          </button>
        </div>
      </div>

      {/* Edit Project Modal */}
      {editingProject && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setEditingProject(null)}>
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Edit2 size={18} className="text-blue-500" />
                {t(lang, 'editProjectInfo')}
              </h2>
              <button onClick={() => setEditingProject(null)} className="text-slate-500 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">{t(lang, 'projectName')}</label>
                <input 
                  autoFocus
                  required
                  value={editingProject.name}
                  onChange={e => setEditingProject({...editingProject, name: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-sm outline-none focus:border-blue-500/50"
                  placeholder={t(lang, 'projectNamePlaceholder')}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">{t(lang, 'clientName')}</label>
                <input 
                  required
                  value={editingProject.client}
                  onChange={e => setEditingProject({...editingProject, client: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-sm outline-none focus:border-blue-500/50"
                  placeholder="Müşteri adı giriniz..."
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">{t(lang, 'projectDate')}</label>
                <input 
                  type="date"
                  required
                  value={editingProject.date}
                  onChange={e => setEditingProject({...editingProject, date: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-sm outline-none focus:border-blue-500/50 mb-3"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">{lang === 'tr' ? 'Proje Durumu' : 'Project Status'}</label>
                <select
                  value={editingProject.status || 'Draft'}
                  onChange={e => setEditingProject({...editingProject, status: e.target.value as any})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-sm outline-none focus:border-blue-500/50 cursor-pointer"
                >
                  <option value="Draft">{t(lang, 'statusDraft')}</option>
                  <option value="Production">{t(lang, 'statusProd')}</option>
                  <option value="Completed">{t(lang, 'statusComp')}</option>
                </select>
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setEditingProject(null)} className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition-all">
                  {t(lang, 'cancel')}
                </button>
                <button type="submit" className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2">
                  <Save size={18} /> {t(lang, 'saveChanges')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      <div className="border-t border-white/5 py-8 mt-12 text-center text-sm text-slate-600">
          <p>&copy; {new Date().getFullYear()} Alumetric Suite.</p>
      </div>

      <style>{`
        @keyframes pulse-slow {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.8; transform: scale(0.98); }
        }
        .animate-pulse-slow {
            animation: pulse-slow 3s infinite ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default Dashboard;
