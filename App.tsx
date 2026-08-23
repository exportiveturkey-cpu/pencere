
import React, { useState, useEffect, useCallback } from 'react';
import Dashboard from './components/Dashboard';
import Editor from './components/Editor';
import ProjectView from './components/ProjectView';
import Settings from './components/Settings';
import Login from './components/Login';
import { ClientPortal } from './components/ClientPortal';
import { GlassAnalysis } from './components/GlassAnalysis';
import { Project, Unit, ProfileSystem, Language, Accessory, MachineConfig, AppData, Customer } from './types';
import { MOCK_PROJECTS, PROFILE_SYSTEMS, MOCK_ACCESSORIES } from './constants';
import { v4 as uuidv4 } from 'uuid';
import { t } from './translations';
import { 
  validateLicense, 
  getSessionInfo, 
  cloud_getProjects, 
  cloud_saveProject, 
  cloud_deleteProject,
  cloud_getSystems,
  cloud_saveSystems,
  cloud_getAccessories,
  cloud_saveAccessories,
  cloud_getMachines,
  cloud_saveMachines,
  cloud_getCustomers,
  cloud_saveCustomers
} from './services/authService';
import { Cloud, Loader2, AlertTriangle, ShieldAlert } from 'lucide-react';

type ViewState = 'DASHBOARD' | 'PROJECT_VIEW' | 'EDITOR' | 'SETTINGS' | 'GLASS_ANALYSIS';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => sessionStorage.getItem('alumetric_auth') === 'true');
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [permissionError, setPermissionError] = useState(false);
  const [view, setView] = useState<ViewState>('DASHBOARD');
  const [lang, setLang] = useState<Language>('tr');
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeUnit, setActiveUnit] = useState<Unit | undefined>(undefined);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('alucraft_theme') as 'light' | 'dark') || 'light';
  });

  // Client interactive portal share states
  const [portalBidData, setPortalBidData] = useState<{
    licenseKey: string;
    projectId: string;
    project: Project;
    systems: ProfileSystem[];
    accessories: Accessory[];
  } | null>(null);
  const [loadingPortal, setLoadingPortal] = useState(false);

  useEffect(() => {
    // Client Portal (Paylaşılabilir Canlı Dijital Sayfa) iptal edildi.
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    if (theme === 'light') {
      root.classList.add('light-theme');
      body.classList.add('light-theme');
      root.classList.remove('dark');
      body.classList.remove('dark');
    } else {
      root.classList.remove('light-theme');
      body.classList.remove('light-theme');
      root.classList.add('dark');
      body.classList.add('dark');
    }
    localStorage.setItem('alucraft_theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      const key = sessionStorage.getItem('alumetric_key');
      const cachedStr = (key && localStorage.getItem('cached_projects_' + key)) || localStorage.getItem('alumetric_local_projects_backup');
      if (cachedStr) {
        const parsed = JSON.parse(cachedStr);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return [];
  });
  const [systems, setSystems] = useState<ProfileSystem[]>([]);
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [machines, setMachines] = useState<MachineConfig[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);
  
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
      const cloudCustomers = await cloud_getCustomers(session.key);

      let finalSystems: ProfileSystem[] = [];
      if (cloudSystems && cloudSystems.length > 0) {
        const oldIds = ['kurt-l60'];
        const oldPrefixes = ['asas-', 'saray-', 'cuha-', 'akpa-'];
        const isOld = (id: string) => oldIds.includes(id) || oldPrefixes.some(pref => id.startsWith(pref));
        
        // Filter out legacy systems
        const preservedSystems = cloudSystems.filter(s => !isOld(s.id));
        
        // Always merge with PROFILE_SYSTEMS to guarantee standard systems exist
        const mergedSystems = [...preservedSystems];
        for (const stdSys of PROFILE_SYSTEMS) {
          if (!mergedSystems.some(s => s.id === stdSys.id)) {
            mergedSystems.push(stdSys);
          }
        }
        finalSystems = mergedSystems;
      } else {
        finalSystems = PROFILE_SYSTEMS;
      }

      setProjects(prev => {
        if (cloudProjects.length > 0) return cloudProjects;
        if (prev.length > 0) return prev;
        return MOCK_PROJECTS;
      });
      setSystems(finalSystems);
      setAccessories(cloudAccessories || MOCK_ACCESSORIES);
      setMachines(cloudMachines || []);
      setCustomers(cloudCustomers || []);
      setIsDataLoaded(true);
    } catch (e: any) {
      console.error("Bulut veri yükleme hatası:", e);
      if (e.code === 'permission-denied') {
          setPermissionError(true);
      }
      let fallbackProjects: Project[] = [];
      try {
        const cachedStr = localStorage.getItem('cached_projects_' + session.key) || localStorage.getItem('alumetric_local_projects_backup');
        if (cachedStr) {
          fallbackProjects = JSON.parse(cachedStr);
        }
      } catch (err) {}

      setProjects(prev => {
        if (fallbackProjects.length > 0) return fallbackProjects;
        if (prev.length > 0) return prev;
        return MOCK_PROJECTS;
      });
      setSystems(PROFILE_SYSTEMS);
      setAccessories(MOCK_ACCESSORIES);
      setMachines([]);
      setCustomers([]);
      setIsDataLoaded(true);
    } finally {
      setIsSyncing(false);
    }
  }, [isAuthenticated, session.key]);

  useEffect(() => {
    if (isAuthenticated) loadCloudData();
  }, [isAuthenticated, loadCloudData]);

  // Synchronize local storage accessory images to the cloud database
  useEffect(() => {
    if (!isAuthenticated || !session.key || accessories.length === 0) return;
    
    const syncLocalImagesToCloud = async () => {
      let needsSync = false;
      const updatedAccessories = accessories.map(acc => {
        try {
          const savedStr = localStorage.getItem('alumetric_custom_accessory_images');
          if (savedStr) {
            const localImages = JSON.parse(savedStr);
            if (localImages[acc.id] && acc.imageUrl !== localImages[acc.id]) {
              needsSync = true;
              return { ...acc, imageUrl: localImages[acc.id] };
            }
          }
        } catch (e) {
          console.error("Error parsing local images", e);
        }
        return acc;
      });

      if (needsSync) {
        setAccessories(updatedAccessories);
        try {
          await cloud_saveAccessories(session.key, updatedAccessories);
          console.log("Successfully synchronized local accessory images to Cloud Firestore!");
        } catch (e) {
          console.error("Could not sync local images to cloud", e);
        }
      }
    };

    syncLocalImagesToCloud();
  }, [isAuthenticated, session.key, accessories]);

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
    const year = new Date().getFullYear();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const newProject: Project = {
      id: uuidv4(),
      name: `Yeni Proje ${projects.length + 1}`,
      client: t(lang, 'unknownClient'),
      date: new Date().toISOString().split('T')[0],
      status: 'Draft',
      units: [],
      isExport: false,
      projectNumber: `ALU-${year}-${randomSuffix}`,
      updatedAt: Date.now()
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
    const projWithTime: Project = { ...updatedProject, updatedAt: Date.now() };
    setProjects(prev => prev.map(p => p.id === projWithTime.id ? projWithTime : p));
    setIsSyncing(true);
    try { await cloud_saveProject(session.key, projWithTime); } catch (e) {}
    setIsSyncing(false);
  };

  const handleDeleteProject = (projectId: string) => {
    setConfirmModal({
      title: lang === 'tr' ? 'Projeyi Sil' : 'Delete Project',
      message: lang === 'tr' ? 'Bu projeyi tümüyle silmek istediğinize emin misiniz? Bu işlem geri alınamaz.' : 'Are you sure you want to delete this project completely? This action cannot be undone.',
      onConfirm: async () => {
        setProjects(prev => prev.filter(p => p.id !== projectId));
        setIsSyncing(true);
        try { await cloud_deleteProject(session.key, projectId); } catch (e) {}
        setIsSyncing(false);
        setConfirmModal(null);
      }
    });
  };

  const handleSaveUnit = async (unit: Unit) => {
    if (!activeProjectId) return;
    let targetProjectToSave: Project | null = null;

    setProjects(prevProjects => {
      const targetProject = prevProjects.find(p => p.id === activeProjectId);
      if (!targetProject) return prevProjects;

      const unitExists = targetProject.units.some(u => u.id === unit.id);
      const updatedUnits = unitExists ? targetProject.units.map(u => u.id === unit.id ? unit : u) : [...targetProject.units, unit];
      const updatedProject: Project = { ...targetProject, units: updatedUnits, updatedAt: Date.now() };
      targetProjectToSave = updatedProject;
      return prevProjects.map(p => p.id === activeProjectId ? updatedProject : p);
    });

    setView('PROJECT_VIEW');
    if (targetProjectToSave) {
      setIsSyncing(true);
      try { await cloud_saveProject(session.key, targetProjectToSave); } catch (e) {}
      setIsSyncing(false);
    }
  };

  const handleDeleteUnit = (unitId: string) => {
    if (!activeProjectId) return;
    setConfirmModal({
      title: lang === 'tr' ? 'Pozu Sil' : 'Delete Position',
      message: lang === 'tr' ? 'Bu pozisyonu silmek istediğinize emin misiniz?' : 'Are you sure you want to delete this position?',
      onConfirm: async () => {
        let targetProjectToSave: Project | null = null;
        setProjects(prevProjects => {
          const targetProject = prevProjects.find(p => p.id === activeProjectId);
          if (!targetProject) return prevProjects;

          const updatedProject: Project = { ...targetProject, units: targetProject.units.filter(u => u.id !== unitId), updatedAt: Date.now() };
          targetProjectToSave = updatedProject;
          return prevProjects.map(p => p.id === activeProjectId ? updatedProject : p);
        });

        if (targetProjectToSave) {
          setIsSyncing(true);
          try { await cloud_saveProject(session.key, targetProjectToSave); } catch (e) {}
          setIsSyncing(false);
        }
        setConfirmModal(null);
      }
    });
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

  const handleSetSystems = async (updatedSystems: ProfileSystem[]) => {
    setSystems(updatedSystems);
    setIsSyncing(true);
    try { await cloud_saveSystems(session.key, updatedSystems); } catch (e) {}
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

  const handleSetAccessories = async (updatedAccs: Accessory[]) => {
    setAccessories(updatedAccs);
    setIsSyncing(true);
    try { await cloud_saveAccessories(session.key, updatedAccs); } catch (e) {}
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

  const handleDeleteSystem = async (id: string) => {
    const updated = systems.filter(s => s.id !== id);
    setSystems(updated);
    setIsSyncing(true);
    try { await cloud_saveSystems(session.key, updated); } catch (e) {}
    setIsSyncing(false);
  };

  const handleDeleteAccessory = async (id: string) => {
    const updated = accessories.filter(a => a.id !== id);
    setAccessories(updated);
    setIsSyncing(true);
    try { await cloud_saveAccessories(session.key, updated); } catch (e) {}
    setIsSyncing(false);
  };

  const handleAddCustomer = async (cust: Customer) => {
    const updated = [...customers, cust];
    setCustomers(updated);
    setIsSyncing(true);
    try { await cloud_saveCustomers(session.key, updated); } catch (e) {}
    setIsSyncing(false);
  };

  const handleUpdateCustomer = async (updatedCust: Customer) => {
    const updated = customers.map(c => c.id === updatedCust.id ? updatedCust : c);
    setCustomers(updated);
    setIsSyncing(true);
    try { await cloud_saveCustomers(session.key, updated); } catch (e) {}
    setIsSyncing(false);
  };

  const handleDeleteCustomer = (id: string) => {
    const cust = customers.find(c => c.id === id);
    const name = cust ? cust.name : '';
    setConfirmModal({
      title: lang === 'tr' ? 'Müşteriyi Sil' : 'Delete Customer',
      message: lang === 'tr' ? `${name} isimli müşteriyi silmek istediğinizden emin misiniz?` : `Are you sure you want to delete customer ${name}?`,
      onConfirm: async () => {
        const updated = customers.filter(c => c.id !== id);
        setCustomers(updated);
        setIsSyncing(true);
        try { await cloud_saveCustomers(session.key, updated); } catch (e) {}
        setIsSyncing(false);
        setConfirmModal(null);
      }
    });
  };

  const handleExportData = () => {
    const data: AppData = { projects, systems, accessories, machines, customers };
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
        if (data.customers) setCustomers(data.customers);

        // Buluta kaydet
        if (data.systems) await cloud_saveSystems(session.key, data.systems);
        if (data.accessories) await cloud_saveAccessories(session.key, data.accessories);
        if (data.machines) await cloud_saveMachines(session.key, data.machines);
        if (data.customers) await cloud_saveCustomers(session.key, data.customers);
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

  if (loadingPortal) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center">
          <Loader2 className="text-indigo-500 animate-spin mb-4" size={48} />
          <h2 className="text-white text-xl font-bold">Teklif Detayları Yükleniyor</h2>
          <p className="text-slate-400 mt-2">Canlı bağlantı üzerinden güncel veriler çekiliyor...</p>
      </div>
    );
  }

  if (portalBidData) {
    return (
      <ClientPortal 
        licenseKey={portalBidData.licenseKey}
        projectId={portalBidData.projectId}
        project={portalBidData.project}
        systems={portalBidData.systems}
        accessories={portalBidData.accessories}
        lang={lang}
        onBackToApp={isAuthenticated ? () => {
          // Clear query param and go back
          window.history.pushState({}, '', window.location.origin);
          setPortalBidData(null);
        } : undefined}
      />
    );
  }

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
      return <Login lang={lang} onLogin={handleLogin} theme={theme} />;
  }

  const activeProject = projects.find(p => p.id === activeProjectId);

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans selection:bg-blue-600 selection:text-white transition-colors duration-200">
      
      {permissionError && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] w-full max-w-2xl px-4 animate-in fade-in slide-in-from-top-4">
              <div className="bg-red-600/90 backdrop-blur-md border border-red-400/50 rounded-2xl p-6 shadow-2xl flex items-start gap-5">
                  <div className="bg-white/20 p-3 rounded-full text-white shrink-0">
                      <ShieldAlert size={24} />
                  </div>
                  <div className="flex-1">
                      <h3 className="font-bold text-white text-lg leading-tight">
                        {lang === 'tr' ? 'Veritabanı Erişim Hatası' : 'Database Access Error'}
                      </h3>
                      <p className="text-red-100 text-sm mt-1 leading-relaxed">
                        {lang === 'tr' 
                          ? 'Firebase Firestore kurallarınız buluta veri yazılmasını veya okunmasını engelliyor.' 
                          : 'Your Firebase Firestore rules are preventing cloud read/write operations.'}
                      </p>
                      <button onClick={() => setPermissionError(false)} className="mt-4 bg-white text-red-600 px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-red-50 transition-colors">
                        {lang === 'tr' ? 'Anladım' : 'Dismiss'}
                      </button>
                  </div>
              </div>
          </div>
      )}

      <div className="fixed bottom-4 right-4 z-[60] flex items-center gap-2 px-3 py-1.5 bg-slate-800/80 backdrop-blur border border-white/5 rounded-full text-[10px] font-bold uppercase tracking-widest pointer-events-none transition-all">
          {isSyncing ? (
            <><Loader2 size={12} className="text-blue-400 animate-spin" /><span className="text-blue-400">{lang === 'tr' ? 'Buluta Yazılıyor...' : 'Syncing to Cloud...'}</span></>
          ) : permissionError ? (
            <><AlertTriangle size={12} className="text-red-400" /><span className="text-red-400">{lang === 'tr' ? 'Erişim Yetkisi Yok' : 'Access Restricted'}</span></>
          ) : (
            <><Cloud size={12} className="text-emerald-400" /><span className="text-emerald-400">{lang === 'tr' ? 'Bulut ile Senkronize' : 'Synced with Cloud'}</span></>
          )}
      </div>

      {view === 'DASHBOARD' && (
        <Dashboard 
          projects={projects}
          systems={systems}
          accessories={accessories}
          customers={customers}
          onAddCustomer={handleAddCustomer}
          onUpdateCustomer={handleUpdateCustomer}
          onDeleteCustomer={handleDeleteCustomer}
          lang={lang}
          setLang={setLang}
          onCreateProject={handleCreateProject}
          onSelectProject={(id) => { setActiveProjectId(id); setView('PROJECT_VIEW'); }}
          onUpdateProject={handleUpdateProject}
          onDeleteProject={handleDeleteProject}
          onOpenSettings={() => setView('SETTINGS')}
          onOpenGlassAnalysis={() => setView('GLASS_ANALYSIS')}
          forcedName={companyName} 
          theme={theme}
          onToggleTheme={toggleTheme}
        />
      )}
      
      {view === 'GLASS_ANALYSIS' && (
        <GlassAnalysis 
          lang={lang}
          onBack={() => setView('DASHBOARD')}
          theme={theme}
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
          onSetSystems={handleSetSystems}
          onDeleteSystem={handleDeleteSystem}
          onAddAccessory={handleAddAccessory}
          onUpdateAccessory={handleUpdateAccessory}
          onSetAccessories={handleSetAccessories}
          onDeleteAccessory={handleDeleteAccessory}
          onAddMachine={handleAddMachine}
          onUpdateMachine={handleUpdateMachine}
          onDeleteMachine={handleDeleteMachine}
          onBack={() => setView('DASHBOARD')}
          onExportData={handleExportData} 
          onImportData={handleImportData} 
          theme={theme}
          onToggleTheme={toggleTheme}
        />
      )}
      
      {view === 'PROJECT_VIEW' && activeProject && (
        <ProjectView 
          project={activeProject}
          systems={systems}
          accessories={accessories}
          machines={machines}
          customers={customers}
          lang={lang}
          licenseKey={session.key}
          onBack={() => setView('DASHBOARD')}
          onUpdateProject={handleUpdateProject}
          onAddUnit={() => { setActiveUnit(undefined); setView('EDITOR'); }}
          onEditUnit={(unit) => { setActiveUnit(unit); setView('EDITOR'); }}
          onDeleteUnit={handleDeleteUnit}
          theme={theme}
          onToggleTheme={toggleTheme}
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
                theme={theme}
                onToggleTheme={toggleTheme}
            />
        </div>
      )}

      {confirmModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800/80 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start gap-4 mb-4">
              <div className="bg-rose-500/10 p-2.5 rounded-full text-rose-500 shrink-0 border border-rose-500/10">
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white leading-tight">
                  {confirmModal.title}
                </h3>
                <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                  {confirmModal.message}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-slate-800/60 pt-4 mt-2">
              <button
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl text-xs font-bold transition-all"
              >
                {lang === 'tr' ? 'Vazgeç' : 'Cancel'}
              </button>
              <button
                onClick={() => {
                  confirmModal.onConfirm();
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-rose-600/10"
              >
                {lang === 'tr' ? 'Evet, Sil' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
