import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import Editor from './components/Editor';
import ProjectView from './components/ProjectView';
import Settings from './components/Settings';
import { Project, Unit, ProfileSystem, Language } from './types';
import { MOCK_PROJECTS, PROFILE_SYSTEMS } from './constants';
import { v4 as uuidv4 } from 'uuid';
import { t } from './translations';

type ViewState = 'DASHBOARD' | 'PROJECT_VIEW' | 'EDITOR' | 'SETTINGS';

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>('DASHBOARD');
  
  // Initialize state from LocalStorage if available
  const [projects, setProjects] = useState<Project[]>(() => {
    try {
        const saved = localStorage.getItem('alucraft_projects');
        return saved ? JSON.parse(saved) : MOCK_PROJECTS;
    } catch (e) {
        return MOCK_PROJECTS;
    }
  });

  const [systems, setSystems] = useState<ProfileSystem[]>(() => {
    try {
        const saved = localStorage.getItem('alucraft_systems');
        return saved ? JSON.parse(saved) : PROFILE_SYSTEMS;
    } catch (e) {
        return PROFILE_SYSTEMS;
    }
  });

  const [lang, setLang] = useState<Language>('tr');
  
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeUnit, setActiveUnit] = useState<Unit | undefined>(undefined);

  // Persistence Effects
  useEffect(() => {
    localStorage.setItem('alucraft_projects', JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    localStorage.setItem('alucraft_systems', JSON.stringify(systems));
  }, [systems]);


  const activeProject = projects.find(p => p.id === activeProjectId);

  const handleCreateProject = () => {
    const newProject: Project = {
      id: uuidv4(),
      name: `New Project ${projects.length + 1}`,
      client: t(lang, 'unknownClient'),
      date: new Date().toISOString().split('T')[0],
      status: 'Draft',
      units: []
    };
    setProjects([newProject, ...projects]);
    setActiveProjectId(newProject.id);
    setView('PROJECT_VIEW');
  };

  const handleSelectProject = (id: string) => {
    setActiveProjectId(id);
    setView('PROJECT_VIEW');
  };

  const handleAddUnit = () => {
    setActiveUnit(undefined); // New unit
    setView('EDITOR');
  };

  const handleEditUnit = (unit: Unit) => {
    setActiveUnit(unit);
    setView('EDITOR');
  };

  const handleSaveUnit = (unit: Unit) => {
    if (!activeProjectId) return;
    
    setProjects(prevProjects => prevProjects.map(p => {
      if (p.id === activeProjectId) {
        // Check if updating existing unit or adding new
        const unitExists = p.units.some(u => u.id === unit.id);
        const updatedUnits = unitExists 
          ? p.units.map(u => u.id === unit.id ? unit : u)
          : [...p.units, unit];
          
        return { ...p, units: updatedUnits };
      }
      return p;
    }));
    
    setView('PROJECT_VIEW');
  };
  
  const handleAddSystem = (newSystem: ProfileSystem) => {
    setSystems([...systems, newSystem]);
  };

  const handleUpdateSystem = (updatedSystem: ProfileSystem) => {
    setSystems(systems.map(s => s.id === updatedSystem.id ? updatedSystem : s));
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 font-sans selection:bg-blue-500 selection:text-white">
      {view === 'DASHBOARD' && (
        <Dashboard 
          projects={projects}
          lang={lang}
          setLang={setLang}
          onCreateProject={handleCreateProject}
          onSelectProject={handleSelectProject}
          onOpenSettings={() => setView('SETTINGS')}
        />
      )}
      
      {view === 'SETTINGS' && (
        <Settings 
          systems={systems}
          lang={lang}
          onAddSystem={handleAddSystem}
          onUpdateSystem={handleUpdateSystem}
          onBack={() => setView('DASHBOARD')}
        />
      )}
      
      {view === 'PROJECT_VIEW' && activeProject && (
        <ProjectView 
          project={activeProject}
          systems={systems}
          lang={lang}
          onBack={() => setView('DASHBOARD')}
          onAddUnit={handleAddUnit}
          onEditUnit={handleEditUnit}
        />
      )}

      {view === 'EDITOR' && (
        <div className="h-screen w-full fixed top-0 left-0 z-50 bg-slate-900">
            <Editor 
                unit={activeUnit}
                systems={systems}
                lang={lang}
                onSave={handleSaveUnit}
                onCancel={() => setView('PROJECT_VIEW')}
            />
        </div>
      )}
    </div>
  );
};

export default App;