
import React, { useState, useEffect, useCallback } from 'react';
import Dashboard from './components/Dashboard';
import Editor from './components/Editor';
import ProjectView from './components/ProjectView';
import Settings from './components/Settings';
import Login from './components/Login';
import { Project, Unit, ProfileSystem, Language, Accessory, MachineConfig, AppData } from './types';
import { MOCK_PROJECTS, PROFILE_SYSTEMS, MOCK_ACCESSORIES } from './constants';
import { v4 as uuidv4 } from 'uuid';
import { t } from './translations';
import { 
  validateLicense, 
  getSessionInfo, 
  cloud_getProjects, 
  cloud_saveProject, 
  cloud_getSystems,
  cloud_saveSystems,
  cloud_getAccessories,
  cloud_saveAccessories,
  cloud_getMachines,
  cloud_saveMachines
} from './services/authService';
import { Cloud, Loader2, AlertTriangle, ShieldAlert } from 'lucide-react';

type ViewState = 'DASHBOARD' | 'PROJECT_VIEW' | 'EDITOR' | 'SETTINGS';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => sessionStorage.getItem('alumetric_auth') === 'true');
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [permissionError, setPermissionError] = useState(false);
  const [view, setView] = useState<ViewState>('DASHBOARD');
  const [lang, setLang] = useState<Language>('tr');
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeUnit, setActiveUnit] = useState<Unit | undefined>(undefined);

  const [projects, setProjects] = useState<Project[]>([]);
  const [systems, setSystems] = useState<ProfileSystem[]>([]);
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [machines, setMachines] = useState<MachineConfig[]>([]);
  
  const [companyName, setCompanyName] = useState<string>(() => sessionStorage.getItem('alumetric_company') || 'Unknown');

  const session = getSessionInfo();

  const loadCloudData = useCallback(async () => {
    if (!isAuthenticated || !session.key) return;
    setIsSyncing(true);
    setPermissionError(false);
    try {
      const freshLicense = await validateLicense(session.key);
      if (freshLicense) {
          setCompanyName(freshLicense.companyName);
      }

      const cloudProjects = await cloud_getProjects(session.key);
      const cloudSystems = await cloud_getSystems(session.key);
      const cloudAccessories = await cloud_getAccessories(session.key);
      const cloudMachines = await cloud_getMachines(session.key);

      setProjects(cloudProjects.length > 0 ? cloudProjects : MOCK_PROJECTS);
      setSystems(cloudSystems || PROFILE_SYSTEMS);
      setAccessories(cloudAccessories || MOCK_ACCESSORIES);
      setMachines(cloudMachines || []);
      setIsDataLoaded(true);
    } catch (e: any) {
      console.error("Bulut veri yükleme hatası:", e);
      if (e.code === 'permission-denied') {
          setPermissionError(true);
      }
      setProjects(MOCK_PROJECTS);
      setSystems(PROFILE_SYSTEMS);
      setAccessories(MOCK_ACCESSORIES);
      setMachines([]);
      setIsDataLoaded(true);
    } finally {
      setIsSyncing(false);
    }
  }, [isAuthenticated, session.key]);

  useEffect(() => {
    if (isAuthenticated) loadCloudData();
  }, [isAuthenticated, loadCloudData]);

  const handleLogin = async (licenseKey: string): Promise<boolean> => {
      try {
          const license = await validateLicense(licenseKey);
          if (license) {
              setCompanyName(license.companyName);
              setIsAuthenticated(true);
              return true;
          }
          return false;
      } catch (err: any) {
          return false;
      }
  };

  const handleCreateProject = async () => {
    const newProject: Project = {
      id: uuidv4(),
      name: `Yeni Proje ${projects.length + 1}`,
      client: t(lang, 'unknownClient'),
      date: new Date().toISOString().split('T')[0],
      status: 'Draft',
      units: [],
      isExport: false
    };
    const updated = [newProject, ...projects];
    setProjects(updated);
    setActiveProjectId(newProject.id);
    setView('PROJECT_VIEW');
    setIsSyncing(true);
    try { await cloud_saveProject(session.key, newProject); } catch (e) {}
    setIsSyncing(false);
  };

  const handleUpdateProject = async (updatedProject: Project) => {
    setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
    setIsSyncing(true);
    try { await cloud_saveProject(session.key, updatedProject); } catch (e) {}
    setIsSyncing(false);
  };

  const handleSaveUnit = async (unit: Unit) => {
    if (!activeProjectId) return;
    let targetProject: Project | undefined;
    setProjects(prevProjects => prevProjects.map(p => {
      if (p.id === activeProjectId) {
        const unitExists = p.units.some(u => u.id === unit.id);
        const updatedUnits = unitExists ? p.units.map(u => u.id === unit.id ? unit : u) : [...p.units, unit];
        targetProject = { ...p, units: updatedUnits };
        return targetProject;
      }
      return p;
    }));
    setView('PROJECT_VIEW');
    if (targetProject) {
      setIsSyncing(true);
      try { await cloud_saveProject(session.key, targetProject); } catch (e) {}
      setIsSyncing(false);
    }
  };

  const handleDeleteUnit = async (unitId: string) => {
    if (!activeProjectId) return;
    if (window.confirm(t(lang, 'deleteConfirm'))) {
       let targetProject: Project | undefined;
       setProjects(prevProjects => prevProjects.map(p => {
        if (p.id === activeProjectId) {
          targetProject = { ...p, units: p.units.filter(u => u.id !== unitId) };
          return targetProject;
        }
        return p;
      }));
      if (targetProject) {
        setIsSyncing(true);
        try { await cloud_saveProject(session.key, targetProject); } catch (e) {}
        setIsSyncing(false);
      }
    }
  };
  
  const handleAddSystem = async (newSystem: ProfileSystem) => {
    const updated = [...systems, newSystem];
    setSystems(updated);
    setIsSyncing(true);
    try { await cloud_saveSystems(session.key, updated); } catch (e) {}
    setIsSyncing(false);
  };

  const handleUpdateSystem = async (updatedSystem: ProfileSystem) => {
    const updated = systems.map(s => s.id === updatedSystem.id ? updatedSystem : s);
    setSystems(updated);
    setIsSyncing(true);
    try { await cloud_saveSystems(session.key, updated); } catch (e) {}
    setIsSyncing(false);
  };

  const handleAddAccessory = async (acc: Accessory) => {
    const updated = [...accessories, acc];
    setAccessories(updated);
    setIsSyncing(true);
    try { await cloud_saveAccessories(session.key, updated); } catch (e) {}
    setIsSyncing(false);
  };

  const handleUpdateAccessory = async (updatedAcc: Accessory) => {
    const updated = accessories.map(a => a.id === updatedAcc.id ? updatedAcc : a);
    setAccessories(updated);
    setIsSyncing(true);
    try { await cloud_saveAccessories(session.key, updated); } catch (e) {}
    setIsSyncing(false);
  };

  const handleAddMachine = async (mach: MachineConfig) => {
    const updated = [...machines, mach];
    setMachines(updated);
    setIsSyncing(true);
    try { await cloud_saveMachines(session.key, updated); } catch (e) {}
    setIsSyncing(false);
  };

  const handleUpdateMachine = async (updatedMach: MachineConfig) => {
    const updated = machines.map(m => m.id === updatedMach.id ? updatedMach : m);
    setMachines(updated);
    setIsSyncing(true);
    try { await cloud_saveMachines(session.key, updated); } catch (e) {}
    setIsSyncing(false);
  };

  const handleDeleteMachine = async (id: string) => {
    const updated = machines.filter(m => m.id !== id);
    setMachines(updated);
    setIsSyncing(true);
    try { await cloud_saveMachines(session.key, updated); } catch (e) {}
    setIsSyncing(false);
  };

  const handleExportData = () => {
    const data: AppData = { projects, systems, accessories, machines };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Alumetric_Backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportData = async (data: AppData) => {
    setIsSyncing(true);
    try {
        if (data.projects) setProjects(data.projects);
        if (data.systems) setSystems(data.systems);
        if (data.accessories) setAccessories(data.accessories);
        if (data.machines) setMachines(data.machines);

        // Buluta kaydet
        if (data.systems) await cloud_saveSystems(session.key, data.systems);
        if (data.accessories) await cloud_saveAccessories(session.key, data.accessories);
        if (data.machines) await cloud_saveMachines(session.key, data.machines);
        for (const p of (data.projects || [])) {
            await cloud_saveProject(session.key, p);
        }
        alert(t(lang, 'importSuccess'));
    } catch (e) {
        console.error("Import hatası:", e);
        alert("Veri içe aktarılırken hata oluştu.");
    } finally {
        setIsSyncing(false);
    }
  };

  if (isAuthenticated && !isDataLoaded) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center">
          <Loader2 className="text-blue-500 animate-spin mb-4" size={48} />
          <h2 className="text-white text-xl font-bold">Verileriniz Senkronize Ediliyor</h2>
          <p className="text-slate-400 mt-2">Bulut hesabınıza bağlanılıyor...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
      return <Login lang={lang} onLogin={handleLogin} />;
  }

  const activeProject = projects.find(p => p.id === activeProjectId);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 font-sans selection:bg-blue-500 selection:text-white">
      
      {permissionError && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] w-full max-w-2xl px-4 animate-in fade-in slide-in-from-top-4">
              <div className="bg-red-600/90 backdrop-blur-md border border-red-400/50 rounded-2xl p-6 shadow-2xl flex items-start gap-5">
                  <div className="bg-white/20 p-3 rounded-full text-white shrink-0">
                      <ShieldAlert size={24} />
                  </div>
                  <div className="flex-1">
                      <h3 className="font-bold text-white text-lg leading-tight">Veritabanı Erişim Hatası</h3>
                      <p className="text-red-100 text-sm mt-1 leading-relaxed">
                          Firebase Firestore kurallarınız buluta veri yazılmasını veya okunmasını engelliyor.
                      </p>
                      <button onClick={() => setPermissionError(false)} className="mt-4 bg-white text-red-600 px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-red-50 transition-colors">Anladım</button>
                  </div>
              </div>
          </div>
      )}

      <div className="fixed bottom-4 right-4 z-[60] flex items-center gap-2 px-3 py-1.5 bg-slate-800/80 backdrop-blur border border-white/5 rounded-full text-[10px] font-bold uppercase tracking-widest pointer-events-none transition-all">
          {isSyncing ? (
            <><Loader2 size={12} className="text-blue-400 animate-spin" /><span className="text-blue-400">Buluta Yazılıyor...</span></>
          ) : permissionError ? (
            <><AlertTriangle size={12} className="text-red-400" /><span className="text-red-400">Erişim Yetkisi Yok</span></>
          ) : (
            <><Cloud size={12} className="text-emerald-400" /><span className="text-emerald-400">Bulut ile Senkronize</span></>
          )}
      </div>

      {view === 'DASHBOARD' && (
        <Dashboard 
          projects={projects}
          lang={lang}
          setLang={setLang}
          onCreateProject={handleCreateProject}
          onSelectProject={(id) => { setActiveProjectId(id); setView('PROJECT_VIEW'); }}
          onUpdateProject={handleUpdateProject}
          onOpenSettings={() => setView('SETTINGS')}
          forcedName={companyName} 
        />
      )}
      
      {view === 'SETTINGS' && (
        <Settings 
          systems={systems}
          accessories={accessories}
          machines={machines}
          lang={lang}
          onAddSystem={handleAddSystem}
          onUpdateSystem={handleUpdateSystem}
          onAddAccessory={handleAddAccessory}
          onUpdateAccessory={handleUpdateAccessory}
          onAddMachine={handleAddMachine}
          onUpdateMachine={handleUpdateMachine}
          onDeleteMachine={handleDeleteMachine}
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
          machines={machines}
          lang={lang}
          onBack={() => setView('DASHBOARD')}
          onUpdateProject={handleUpdateProject}
          onAddUnit={() => { setActiveUnit(undefined); setView('EDITOR'); }}
          onEditUnit={(unit) => { setActiveUnit(unit); setView('EDITOR'); }}
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
