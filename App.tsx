
import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import Editor from './components/Editor';
import ProjectView from './components/ProjectView';
import Settings from './components/Settings';
import Login from './components/Login';
import { Project, Unit, ProfileSystem, Language, Accessory, AppData } from './types';
import { MOCK_PROJECTS, PROFILE_SYSTEMS, MOCK_ACCESSORIES } from './constants';
import { v4 as uuidv4 } from 'uuid';
import { t } from './translations';

type ViewState = 'DASHBOARD' | 'PROJECT_VIEW' | 'EDITOR' | 'SETTINGS';

// HARDCODED PASSWORD - Change this to whatever you want
const ACCESS_PASSWORD = "alumetric2025";

const App: React.FC = () => {
  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
      // Check session storage to keep user logged in during refresh, but logout on tab close
      return sessionStorage.getItem('alumetric_auth') === 'true';
  });

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

  const [accessories, setAccessories] = useState<Accessory[]>(() => {
    try {
        const saved = localStorage.getItem('alucraft_accessories');
        return saved ? JSON.parse(saved) : MOCK_ACCESSORIES;
    } catch (e) {
        return MOCK_ACCESSORIES;
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

  useEffect(() => {
    localStorage.setItem('alucraft_accessories', JSON.stringify(accessories));
  }, [accessories]);


  const activeProject = projects.find(p => p.id === activeProjectId);

  // Auth Handler
  const handleLogin = (password: string): boolean => {
      if (password === ACCESS_PASSWORD) {
          setIsAuthenticated(true);
          sessionStorage.setItem('alumetric_auth', 'true');
          return true;
      }
      return false;
  };

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

  const handleUpdateProject = (updatedProject: Project) => {
    setProjects(prevProjects => prevProjects.map(p => 
      p.id === updatedProject.id ? updatedProject : p
    ));
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

  const handleDeleteUnit = (unitId: string) => {
    if (!activeProjectId) return;
    
    if (window.confirm(t(lang, 'deleteConfirm'))) {
       setProjects(prevProjects => prevProjects.map(p => {
        if (p.id === activeProjectId) {
          return { ...p, units: p.units.filter(u => u.id !== unitId) };
        }
        return p;
      }));
    }
  };
  
  const handleAddSystem = (newSystem: ProfileSystem) => {
    setSystems([...systems, newSystem]);
  };

  const handleUpdateSystem = (updatedSystem: ProfileSystem) => {
    setSystems(systems.map(s => s.id === updatedSystem.id ? updatedSystem : s));
  };

  const handleAddAccessory = (acc: Accessory) => {
    setAccessories([...accessories, acc]);
  };

  const handleUpdateAccessory = (updatedAcc: Accessory) => {
    setAccessories(accessories.map(a => a.id === updatedAcc.id ? updatedAcc : a));
  };

  // --- Import / Export Handlers ---
  const handleExportData = () => {
    const data: AppData = {
        projects,
        systems,
        accessories,
        version: '1.0.0',
        date: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `alumetric_backup_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportData = (data: AppData) => {
      if (data.projects) setProjects(data.projects);
      if (data.systems) setSystems(data.systems);
      if (data.accessories) setAccessories(data.accessories);
      // Reset view to dashboard to avoid conflicts with deleted/changed projects
      setView('DASHBOARD');
      setActiveProjectId(null);
  };

  if (!isAuthenticated) {
      return <Login lang={lang} onLogin={handleLogin} />;
  }

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
          accessories={accessories}
          lang={lang}
          onAddSystem={handleAddSystem}
          onUpdateSystem={handleUpdateSystem}
          onAddAccessory={handleAddAccessory}
          onUpdateAccessory={handleUpdateAccessory}
          onBack={() => setView('DASHBOARD')}
          onExportData={handleExportData}
          onImportData={handleImportData}
        />
      )}
      
      {view === 'PROJECT_VIEW' && activeProject && (
        <ProjectView 
          project={activeProject}
          systems={systems}
          accessories={accessories}
          lang={lang}
          onBack={() => setView('DASHBOARD')}
          onUpdateProject={handleUpdateProject}
          onAddUnit={handleAddUnit}
          onEditUnit={handleEditUnit}
          onDeleteUnit={handleDeleteUnit}
        />
      )}

      {view === 'EDITOR' && (
        <div className="h-screen w-full fixed top-0 left-0 z-50 bg-slate-900">
            <Editor 
                unit={activeUnit}
                systems={systems}
                accessories={accessories}
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
