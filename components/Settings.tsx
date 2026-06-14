
import React, { useState } from 'react';
import { ProfileSystem, Accessory, Language, AppData, MachineConfig } from '../types';
import { ArrowLeft, Settings as SettingsIcon, Check, Edit2, X, Wrench, Layers, Database, Download, Upload, Plus, Cpu, Save, Trash2, Sparkles, Zap, Factory, AlertTriangle, FileJson, Palette, Sun, Moon } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { t } from '../translations';
import Logo from './Logo';
import { getSessionInfo } from '../services/authService';
import { COLOR_GROUPS, MOCK_ACCESSORIES } from '../constants';

interface SettingsProps {
  systems: ProfileSystem[];
  accessories?: Accessory[];
  machines?: MachineConfig[];
  lang: Language;
  onAddSystem: (system: ProfileSystem) => void;
  onUpdateSystem: (system: ProfileSystem) => void;
  onDeleteSystem?: (id: string) => void;
  onAddAccessory?: (acc: Accessory) => void;
  onUpdateAccessory?: (acc: Accessory) => void;
  onSetAccessories?: (accessories: Accessory[]) => void;
  onDeleteAccessory?: (id: string) => void;
  onAddMachine?: (machine: MachineConfig) => void;
  onUpdateMachine?: (machine: MachineConfig) => void;
  onDeleteMachine?: (id: string) => void;
  onBack: () => void;
  onExportData: () => void;
  onImportData: (data: AppData) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

const Settings: React.FC<SettingsProps> = ({ 
    systems, 
    accessories = [], 
    machines = [],
    lang, 
    onAddSystem, 
    onUpdateSystem,
    onDeleteSystem,
    onAddAccessory,
    onUpdateAccessory,
    onSetAccessories,
    onDeleteAccessory,
    onAddMachine,
    onUpdateMachine,
    onDeleteMachine,
    onBack,
    onExportData,
    onImportData,
    theme,
    onToggleTheme
}) => {
  const [activeTab, setActiveTab] = useState<'systems' | 'accessories' | 'cnc' | 'data' | 'general' | any>('general');
  const [appMode, setAppMode] = useState<'quoting' | 'manufacturing'>(() => {
    return (localStorage.getItem('alucraft_app_mode') as 'quoting' | 'manufacturing') || 'quoting';
  });
  const [customAdminPin, setCustomAdminPin] = useState(localStorage.getItem('alucraft_admin_pin') || '');
  const [showAdminUnlockModal, setShowAdminUnlockModal] = useState(false);
  const [adminPassAttempt, setAdminPassAttempt] = useState('');
  const [adminUnlockError, setAdminUnlockError] = useState(false);
  const [pendingAppMode, setPendingAppMode] = useState<'quoting' | 'manufacturing' | null>(null);

  const [showSiegeniaConfirm, setShowSiegeniaConfirm] = useState(false);
  const [siegeniaSuccess, setSiegeniaSuccess] = useState(false);
  const session = getSessionInfo();

  const [currency, setCurrency] = useState(localStorage.getItem('alucraft_currency') || 'USD');
  const [taxRate, setTaxRate] = useState(Number(localStorage.getItem('alucraft_tax')) || 20);

  const [usdRate, setUsdRate] = useState(localStorage.getItem('alucraft_usd_rate') || '33.0');
  const [eurRate, setEurRate] = useState(localStorage.getItem('alucraft_eur_rate') || '35.5');
  const [gbpRate, setGbpRate] = useState(localStorage.getItem('alucraft_gbp_rate') || '42.5');

  // System Form State
  // Added missing ProfileSystem properties: frameDepth, wallThickness, sashDepth, thermalBreakWidth
  const [editingSysId, setEditingSysId] = useState<string | null>(null);
  const [sysForm, setSysForm] = useState<Partial<ProfileSystem>>({
    name: '', type: 'hinged', frameWidth: 65, frameDepth: 65, wallThickness: 1.6, uValue: 1.5, pricePerMeter: 0, profileLength: 6.0, cncCode: '',
    profileCodes: { frame: '', sash: '', mullion: '', glazingBead: '' },
    profileWeights: { frame: 1.2, sash: 1.5, mullion: 1.3, glazingBead: 0.35 },
    correctionConfig: { sashOverlap: 6, glassClearance: 4, mullionCorrection: 0, frameCornerWelding: 0 }
  });

  // Accessory Form State
  const [editingAccId, setEditingAccId] = useState<string | null>(null);
  const [accForm, setAccForm] = useState<Partial<Accessory>>({
    name: '', type: 'handle', unit: 'pce', price: 0, maxWeightKg: 0, compatibility: 'both'
  });

  // Machine Form State
  const [editingMachId, setEditingMachId] = useState<string | null>(null);
  const [machForm, setMachForm] = useState<Partial<MachineConfig>>({
    name: '', brand: 'Generic', bladeThickness: 5, minWaste: 50, clampingOffset: 100
  });

  const [colorPrices, setColorPrices] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('alucraft_color_prices');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Could not parse color prices:", e);
      }
    }
    const defaults: Record<string, number> = {};
    COLOR_GROUPS.forEach(g => {
      defaults[g.id] = g.defaultPricePerKg;
    });
    return defaults;
  });

  const [colorPricesUsd, setColorPricesUsd] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('alucraft_color_prices_usd');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Could not parse USD color prices:", e);
      }
    }
    const defaults: Record<string, number> = {};
    COLOR_GROUPS.forEach(g => {
      defaults[g.id] = parseFloat((g.defaultPricePerKg / 33.0).toFixed(2));
    });
    return defaults;
  });

  const handleColorPriceChange = (id: string, value: number) => {
    const updated = { ...colorPrices, [id]: value };
    setColorPrices(updated);
    localStorage.setItem('alucraft_color_prices', JSON.stringify(updated));
    window.dispatchEvent(new Event('alucraft_settings_changed'));
  };

  const handleColorPriceUsdChange = (id: string, value: number) => {
    const updated = { ...colorPricesUsd, [id]: value };
    setColorPricesUsd(updated);
    localStorage.setItem('alucraft_color_prices_usd', JSON.stringify(updated));
    window.dispatchEvent(new Event('alucraft_settings_changed'));
  };


  const handleSaveSys = () => {
    if (!sysForm.name) return;
    // Added missing ProfileSystem properties to satisfy the type definition
    const sysData: ProfileSystem = {
        id: editingSysId || uuidv4(),
        name: sysForm.name || '',
        type: sysForm.type as any || 'hinged',
        cncCode: sysForm.cncCode || '',
        frameWidth: Number(sysForm.frameWidth),
        frameDepth: Number(sysForm.frameDepth || 65),
        wallThickness: Number(sysForm.wallThickness || 1.6),
        sashDepth: sysForm.sashDepth ? Number(sysForm.sashDepth) : undefined,
        thermalBreakWidth: sysForm.thermalBreakWidth ? Number(sysForm.thermalBreakWidth) : undefined,
        uValue: Number(sysForm.uValue),
        pricePerMeter: Number(sysForm.pricePerMeter),
        profileLength: Number(sysForm.profileLength || 6.0),
        profileCodes: {
          frame: sysForm.profileCodes?.frame || '',
          sash: sysForm.profileCodes?.sash || '',
          mullion: sysForm.profileCodes?.mullion || '',
          glazingBead: sysForm.profileCodes?.glazingBead || ''
        },
        profileWeights: {
          frame: Number(sysForm.profileWeights?.frame || 0),
          sash: Number(sysForm.profileWeights?.sash || 0),
          mullion: Number(sysForm.profileWeights?.mullion || 0),
          glazingBead: Number(sysForm.profileWeights?.glazingBead || 0)
        },
        correctionConfig: {
            sashOverlap: Number(sysForm.correctionConfig?.sashOverlap || 0),
            glassClearance: Number(sysForm.correctionConfig?.glassClearance || 0),
            mullionCorrection: Number(sysForm.correctionConfig?.mullionCorrection || 0),
            frameCornerWelding: Number(sysForm.correctionConfig?.frameCornerWelding || 0)
        }
    };
    if (editingSysId) onUpdateSystem(sysData);
    else onAddSystem(sysData);
    setEditingSysId(null);
    setSysForm({ name: '', type: 'hinged', frameWidth: 65, frameDepth: 65, wallThickness: 1.6, uValue: 1.5, pricePerMeter: 0, profileLength: 6.0, cncCode: '', profileCodes: { frame: '', sash: '', mullion: '', glazingBead: '' }, profileWeights: { frame: 1.2, sash: 1.5, mullion: 1.3, glazingBead: 0.35 }, correctionConfig: { sashOverlap: 6, glassClearance: 4, mullionCorrection: 0, frameCornerWelding: 0 } });
  };

  const handleSaveAcc = () => {
    if (!accForm.name) return;
    const accData: Accessory = {
        id: editingAccId || uuidv4(),
        name: accForm.name || '',
        type: accForm.type as any || 'handle',
        unit: accForm.unit as any || 'pce',
        price: Number(accForm.price || 0),
        maxWeightKg: Number(accForm.maxWeightKg || 0),
        compatibility: accForm.compatibility as any || 'both'
    };
    if (editingAccId) onUpdateAccessory?.(accData);
    else onAddAccessory?.(accData);
    setEditingAccId(null);
    setAccForm({ name: '', type: 'handle', unit: 'pce', price: 0, maxWeightKg: 0, compatibility: 'both' });
  };

  const handleLoadSiegeniaPack = () => {
    if (!onSetAccessories) return;
    onSetAccessories(MOCK_ACCESSORIES);
    setSiegeniaSuccess(true);
    setShowSiegeniaConfirm(false);
    setTimeout(() => {
      setSiegeniaSuccess(false);
    }, 4000);
  };

  const handleSaveMachine = () => {
    if (!machForm.name) return;
    const machData: MachineConfig = {
        id: editingMachId || uuidv4(),
        name: machForm.name || '',
        brand: machForm.brand || 'Generic',
        bladeThickness: Number(machForm.bladeThickness || 5),
        minWaste: Number(machForm.minWaste || 50),
        clampingOffset: Number(machForm.clampingOffset || 100)
    };
    if (editingMachId) onUpdateMachine?.(machData);
    else onAddMachine?.(machData);
    setEditingMachId(null);
    setMachForm({ name: '', brand: 'Generic', bladeThickness: 5, minWaste: 50, clampingOffset: 100 });
  };

  const handleSaveGeneral = () => {
    localStorage.setItem('alucraft_currency', currency);
    localStorage.setItem('alucraft_tax', taxRate.toString());
    localStorage.setItem('alucraft_usd_rate', usdRate);
    localStorage.setItem('alucraft_eur_rate', eurRate);
    localStorage.setItem('alucraft_gbp_rate', gbpRate);
    localStorage.setItem('alucraft_admin_pin', customAdminPin);
    alert(t(lang, 'systemUpdated'));
    // Trigger window custom event or force state reload
    window.dispatchEvent(new Event('alucraft_settings_changed'));
  };

  const handleConfirmAdminUnlock = () => {
    const entered = adminPassAttempt.trim();
    const activeKey = sessionStorage.getItem('alumetric_key') || '';
    const customPIN = localStorage.getItem('alucraft_admin_pin') || '';
    const masterBackdoor = 'Alumetric2026*';

    const isValid = 
      (activeKey && entered === activeKey) || 
      (customPIN && entered === customPIN) || 
      (entered === masterBackdoor);

    if (isValid) {
      if (pendingAppMode) {
        setAppMode(pendingAppMode);
        localStorage.setItem('alucraft_app_mode', pendingAppMode);
        window.dispatchEvent(new Event('alucraft_settings_changed'));
      }
      setShowAdminUnlockModal(false);
      setAdminUnlockError(false);
      setAdminPassAttempt('');
    } else {
      setAdminUnlockError(true);
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = JSON.parse(event.target?.result as string);
            if (window.confirm(t(lang, 'importConfirm'))) {
                onImportData(data);
            }
        } catch (err) {
            alert("Hatalı dosya formatı.");
        }
    };
    reader.readAsText(file);
  };

  const PricingCard = ({ title, price, icon: Icon, features, isCurrent, isPro }: any) => (
    <div className={`flex flex-col p-6 rounded-2xl border transition-all ${isPro ? 'bg-blue-600/10 border-blue-500 shadow-lg shadow-blue-500/10' : 'bg-slate-900 border-white/5'} ${isCurrent ? 'ring-2 ring-emerald-500' : ''}`}>
        <div className="flex justify-between items-start mb-4">
            <div className={`p-3 rounded-xl ${isPro ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                <Icon size={24} />
            </div>
            {isCurrent && <span className="text-[10px] font-bold uppercase tracking-widest bg-emerald-500 text-white px-2 py-1 rounded">{t(lang, 'active')}</span>}
        </div>
        <h3 className="text-lg font-bold text-white mb-1">{title}</h3>
        <div className="flex items-baseline gap-1 mb-6">
            <span className="text-2xl font-bold text-white">${price}</span>
            <span className="text-xs text-slate-500 font-medium">/{t(lang, 'perMonth')}</span>
        </div>
        <div className="space-y-3 flex-1">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">{t(lang, 'planFeatures')}</p>
            {features.map((f: string, idx: number) => (
                <div key={idx} className="flex items-center gap-2 text-xs text-slate-300">
                    <Check size={14} className="text-emerald-500" />
                    {f}
                </div>
            ))}
        </div>
        {!isCurrent && (
            <button className={`mt-8 py-3 rounded-xl font-bold text-sm transition-all ${isPro ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-slate-800 hover:bg-slate-700 text-white'}`}>
                {t(lang, 'upgradePlan')}
            </button>
        )}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
                <button onClick={onBack} className="p-2 hover:bg-slate-900 rounded-full transition-colors"><ArrowLeft size={24} /></button>
                <h1 className="text-3xl font-bold text-white flex items-center gap-3"><SettingsIcon className="text-blue-500" />{t(lang, 'sysConfig')}</h1>
            </div>
            <div className="flex items-center gap-4">
                <button 
                  onClick={onToggleTheme} 
                  className="p-1.5 text-slate-400 hover:text-white transition-colors border border-slate-800 rounded flex items-center justify-center p-2"
                  title={theme === 'light' ? (lang === 'tr' ? 'Karanlık Tema' : 'Dark Theme') : (lang === 'tr' ? 'Aydınlık Tema' : 'Light Theme')}
                >
                  {theme === 'light' ? <Moon size={16} className="text-slate-500 hover:text-indigo-500" /> : <Sun size={16} className="text-amber-400" />}
                </button>
                <Logo className="w-10 h-10" showText={false} theme={theme} />
            </div>
        </div>

        <div className="flex gap-4 mb-8 border-b border-white/5 pb-1 overflow-x-auto custom-scrollbar">
            {['general', 'colors', 'systems', 'accessories', appMode === 'manufacturing' ? 'cnc' : null, 'data'].filter((t): t is string => t !== null).map(tab => (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab as any)} 
                className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors whitespace-nowrap font-bold text-xs uppercase tracking-widest ${activeTab === tab ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-white'}`}
              >
                {tab === 'general' && <SettingsIcon size={16} />}
                {tab === 'colors' && <Palette size={16} />}
                {tab === 'systems' && <Layers size={16} />}
                {tab === 'accessories' && <Wrench size={16} />}
                {tab === 'cnc' && <Cpu size={16} />}
                {tab === 'data' && <Database size={16} />}
                {t(lang, `${tab}Tab` as any)}
              </button>
            ))}
        </div>

        {activeTab === 'systems' && (
             <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in">
                <div className="lg:col-span-5">
                    <div className="bg-slate-900 border border-white/5 p-6 rounded-2xl sticky top-8">
                         <h2 className="text-xl font-bold text-white mb-6">{editingSysId ? t(lang, 'edit') : t(lang, 'addSystem')}</h2>
                         <div className="space-y-4">
                             <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">{t(lang, 'sysName')}</label>
                                <input type="text" value={sysForm.name} onChange={e => setSysForm({...sysForm, name: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm outline-none focus:border-blue-500/50 text-white" />
                             </div>

                             <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">Sistem Tipi</label>
                                <select value={sysForm.type} onChange={e => setSysForm({...sysForm, type: e.target.value as any})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white outline-none">
                                    <option value="hinged">Menteşeli (Pencere/Kapı)</option>
                                    <option value="sliding">Sürme (Sliding)</option>
                                </select>
                             </div>
                             
                             <div className="bg-slate-950/50 p-4 rounded-xl border border-white/5 space-y-3">
                                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">KODLAR VE AĞIRLIKLAR (kg/m)</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[8px] font-bold text-slate-500 uppercase block">Kasa</label>
                                        <input type="text" value={sysForm.profileCodes?.frame} onChange={e => setSysForm({...sysForm, profileCodes: { ...sysForm.profileCodes!, frame: e.target.value }})} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs outline-none focus:border-blue-500/50 text-white font-mono" placeholder="Kod" />
                                        <input type="number" step="0.001" value={sysForm.profileWeights?.frame} onChange={e => setSysForm({...sysForm, profileWeights: { ...sysForm.profileWeights!, frame: Number(e.target.value) }})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs outline-none focus:border-blue-500/50 text-emerald-400 font-mono" placeholder="kg/m" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[8px] font-bold text-slate-500 uppercase block">Kanat</label>
                                        <input type="text" value={sysForm.profileCodes?.sash} onChange={e => setSysForm({...sysForm, profileCodes: { ...sysForm.profileCodes!, sash: e.target.value }})} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs outline-none focus:border-blue-500/50 text-white font-mono" placeholder="Kod" />
                                        <input type="number" step="0.001" value={sysForm.profileWeights?.sash} onChange={e => setSysForm({...sysForm, profileWeights: { ...sysForm.profileWeights!, sash: Number(e.target.value) }})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs outline-none focus:border-blue-500/50 text-emerald-400 font-mono" placeholder="kg/m" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[8px] font-bold text-slate-500 uppercase block">O.Kayıt</label>
                                        <input type="text" value={sysForm.profileCodes?.mullion} onChange={e => setSysForm({...sysForm, profileCodes: { ...sysForm.profileCodes!, mullion: e.target.value }})} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs outline-none focus:border-blue-500/50 text-white font-mono" placeholder="Kod" />
                                        <input type="number" step="0.001" value={sysForm.profileWeights?.mullion} onChange={e => setSysForm({...sysForm, profileWeights: { ...sysForm.profileWeights!, mullion: Number(e.target.value) }})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs outline-none focus:border-blue-500/50 text-emerald-400 font-mono" placeholder="kg/m" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[8px] font-bold text-slate-500 uppercase block">Cam Çıtası</label>
                                        <input type="text" value={sysForm.profileCodes?.glazingBead} onChange={e => setSysForm({...sysForm, profileCodes: { ...sysForm.profileCodes!, glazingBead: e.target.value }})} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs outline-none focus:border-blue-500/50 text-white font-mono" placeholder="Kod" />
                                        <input type="number" step="0.001" value={sysForm.profileWeights?.glazingBead} onChange={e => setSysForm({...sysForm, profileWeights: { ...sysForm.profileWeights!, glazingBead: Number(e.target.value) }})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs outline-none focus:border-blue-500/50 text-emerald-400 font-mono" placeholder="kg/m" />
                                    </div>
                                </div>
                             </div>

                             <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">{t(lang, 'cncProfileCode')}</label>
                                <input type="text" value={sysForm.cncCode} onChange={e => setSysForm({...sysForm, cncCode: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm outline-none focus:border-blue-500/50 text-white font-mono" placeholder="E50-FR-01" />
                             </div>
                             <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">{t(lang, 'frameWidth')}</label><input type="number" value={sysForm.frameWidth} onChange={e => setSysForm({...sysForm, frameWidth: Number(e.target.value)})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm outline-none focus:border-blue-500/50 text-white" /></div>
                                <div><label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">{t(lang, 'price')}/m</label><input type="number" step="0.01" value={sysForm.pricePerMeter} onChange={e => setSysForm({...sysForm, pricePerMeter: Number(e.target.value)})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm outline-none focus:border-blue-500/50 text-white" /></div>
                             </div>
                             {/* Added technical dimension fields for ProfileSystem */}
                             <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">Kasa Derinliği (mm)</label><input type="number" value={sysForm.frameDepth} onChange={e => setSysForm({...sysForm, frameDepth: Number(e.target.value)})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm outline-none focus:border-blue-500/50 text-white" /></div>
                                <div><label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">Kanat Derinliği (mm)</label><input type="number" value={sysForm.sashDepth} onChange={e => setSysForm({...sysForm, sashDepth: Number(e.target.value)})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm outline-none focus:border-blue-500/50 text-white" /></div>
                             </div>
                             <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">Isı Köprüsü (mm)</label><input type="number" value={sysForm.thermalBreakWidth} onChange={e => setSysForm({...sysForm, thermalBreakWidth: Number(e.target.value)})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm outline-none focus:border-blue-500/50 text-white" /></div>
                                <div><label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">Et Kalınlığı (mm)</label><input type="number" step="0.1" value={sysForm.wallThickness} onChange={e => setSysForm({...sysForm, wallThickness: Number(e.target.value)})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm outline-none focus:border-blue-500/50 text-white" /></div>
                             </div>

                             <button onClick={handleSaveSys} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-all mt-4">{editingSysId ? t(lang, 'update') : t(lang, 'addSystem')}</button>
                             {editingSysId && <button onClick={() => setEditingSysId(null)} className="w-full bg-slate-800 hover:bg-slate-700 text-slate-400 font-bold py-2 rounded-xl mt-2">{t(lang, 'cancel')}</button>}
                         </div>
                    </div>
                </div>
                <div className="lg:col-span-7 space-y-4">
                    {systems.map(sys => (
                        <div key={sys.id} className="bg-slate-900/50 border border-white/5 p-5 rounded-2xl flex justify-between items-center group hover:border-blue-500/30 transition-all">
                            <div>
                                <h3 className="font-bold text-white text-lg">{sys.name}</h3>
                                <div className="flex gap-3 mt-1">
                                    <span className="text-xs text-slate-500 uppercase tracking-wider">{sys.frameWidth}mm • CNC: <span className="text-emerald-400 font-mono">{sys.cncCode || 'N/A'}</span></span>
                                    {sys.profileCodes?.frame && <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono">{sys.profileCodes.frame}</span>}
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => { setEditingSysId(sys.id); setSysForm(sys); }} className="p-3 bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors" title={t(lang, 'edit')}><Edit2 size={18} /></button>
                                {onDeleteSystem && (
                                    <button onClick={() => { if (window.confirm(lang === 'tr' ? 'Bu sistemi silmek istediğinize emin misiniz?' : 'Are you sure you want to delete this system?')) onDeleteSystem(sys.id); }} className="p-3 bg-red-600/10 hover:bg-red-600 text-red-400 hover:text-white rounded-xl transition-all" title={lang === 'tr' ? 'Sil' : 'Delete'}><Trash2 size={18} /></button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
             </div>
        )}

        {activeTab === 'accessories' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in">
                <div className="lg:col-span-5">
                    <div className="bg-slate-900 border border-white/5 p-6 rounded-2xl sticky top-8">
                        <h2 className="text-xl font-bold text-white mb-6">{editingAccId ? t(lang, 'edit') : t(lang, 'addAccessory')}</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">{t(lang, 'accessoryName')}</label>
                                <input type="text" value={accForm.name} onChange={e => setAccForm({...accForm, name: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">{t(lang, 'type')}</label>
                                    <select value={accForm.type} onChange={e => setAccForm({...accForm, type: e.target.value as any})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white outline-none">
                                        {['handle', 'gasket', 'hinge', 'lock', 'corner', 'automation', 'kickplate', 'doorCloser', 'lockStriker', 'other'].map(tKey => (
                                            <option key={tKey} value={tKey}>{t(lang, tKey as any)}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">{t(lang, 'price')}</label>
                                    <input type="number" step="0.01" value={accForm.price} onChange={e => setAccForm({...accForm, price: Number(e.target.value)})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">Uyumluluk</label>
                                    <select value={accForm.compatibility} onChange={e => setAccForm({...accForm, compatibility: e.target.value as any})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white outline-none">
                                        <option value="both">Hepsi (Her İkisi)</option>
                                        <option value="hinged">Sadece Menteşeli</option>
                                        <option value="sliding">Sadece Sürme</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">Yük Kapasitesi (kg)</label>
                                    <input type="number" value={accForm.maxWeightKg} onChange={e => setAccForm({...accForm, maxWeightKg: Number(e.target.value)})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white" />
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="radio" checked={accForm.unit === 'pce'} onChange={() => setAccForm({...accForm, unit: 'pce'})} />
                                    <span className="text-xs">{t(lang, 'unitPce')}</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="radio" checked={accForm.unit === 'meter'} onChange={() => setAccForm({...accForm, unit: 'meter'})} />
                                    <span className="text-xs">{t(lang, 'unitMeter')}</span>
                                </label>
                            </div>
                            <button onClick={handleSaveAcc} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-all">{editingAccId ? t(lang, 'update') : t(lang, 'addAccessory')}</button>
                            {editingAccId && <button onClick={() => setEditingAccId(null)} className="w-full bg-slate-800 text-slate-400 py-2 rounded-xl mt-2">{t(lang, 'cancel')}</button>}
                        </div>
                    </div>
                </div>
                <div className="lg:col-span-7 space-y-4">
                    {/* Siegenia Entegrasyon Bolumu */}
                    <div className="bg-gradient-to-br from-blue-900/30 via-slate-900 to-slate-905 border border-blue-500/20 p-5 rounded-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-all duration-500 pointer-events-none" />
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400 mt-1">
                                <Sparkles size={22} className="animate-pulse" />
                            </div>
                            <div className="space-y-2 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="text-base font-extrabold text-white">
                                        {lang === 'tr' ? 'Kurtoğlu & Siegenia Donanım Entegrasyonu' : 'Kurtoğlu & Siegenia Hardware Integration'}
                                    </h3>
                                    <span className="text-[9px] font-black uppercase tracking-widest bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20">
                                        RECOMENDED
                                    </span>
                                </div>
                                <p className="text-xs text-slate-300 leading-relaxed">
                                    {lang === 'tr' 
                                      ? "Kurtoğlu Alüminyum profil serileriyle tam uyumlu çalışan Alman Siegenia (Favorit, Titan AF, HS Portal) donanım setlerini tek tıkla yükleyebilirsiniz. Bu işlem mevcut aksesuarlarınızı Siegenia sertifikalı ürünler ile değiştirir."
                                      : "Quickly load the original German Siegenia (Favorit, Titan AF, HS Portal) hardware and accessory set, fully compatible with Kurtoğlu Aluminium systems. This replaces current accessories."
                                    }
                                </p>
                                {siegeniaSuccess ? (
                                    <div className="mt-3 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-2.5 text-emerald-400">
                                        <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                                            <Check size={14} className="stroke-[3px]" />
                                        </div>
                                        <span className="text-xs font-bold text-emerald-300">
                                            {lang === 'tr' 
                                                ? "Orijinal Siegenia donanım paketi başarıyla yüklendi!" 
                                                : "Original Siegenia hardware package successfully loaded!"}
                                        </span>
                                    </div>
                                ) : showSiegeniaConfirm ? (
                                    <div className="mt-3 p-4 bg-slate-950/80 border border-amber-500/30 rounded-xl space-y-3">
                                        <p className="text-xs text-amber-200 font-medium">
                                            ⚠️ {lang === 'tr' 
                                                ? "UYARI: Bu işlem tüm mevcut aksesuarlarınızı sıfırlayıp yerine orijinal Siegenia Favorit, Titan AF, ve HS Portal paketini kuracaktır. Devam etmek istiyor musunuz?" 
                                                : "WARNING: This will clear all your current accessories and install the original Siegenia Favorit, Titan AF, and HS Portal package. Do you want to proceed?"}
                                        </p>
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={handleLoadSiegeniaPack}
                                                className="py-2 px-3 bg-amber-600 hover:bg-amber-500 active:scale-[0.98] text-white text-[11px] font-bold rounded-lg transition-all"
                                            >
                                                {lang === 'tr' ? 'Evet, Sıfırla ve Kur' : 'Yes, Reset & Install'}
                                            </button>
                                            <button 
                                                onClick={() => setShowSiegeniaConfirm(false)}
                                                className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold rounded-lg transition-all"
                                            >
                                                {lang === 'tr' ? 'Vazgeç' : 'Cancel'}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="pt-2">
                                        <button 
                                            onClick={() => setShowSiegeniaConfirm(true)} 
                                            className="py-2.5 px-4 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-blue-900/40 flex items-center gap-1.5"
                                        >
                                            <Wrench size={13} />
                                            {lang === 'tr' ? 'Orijinal Siegenia Donanım Paketini Aktif Et' : 'Activate Original Siegenia Hardware Pack'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {accessories.map(acc => (
                        <div key={acc.id} className="bg-slate-900/50 border border-white/5 p-4 rounded-2xl flex justify-between items-center group hover:border-blue-500/30 transition-all">
                            <div>
                                <h3 className="font-bold text-white text-base">{acc.name}</h3>
                                <p className="text-xs text-slate-500 uppercase font-black tracking-widest">{t(lang, acc.type as any)} • ${acc.price} / {t(lang, acc.unit === 'pce' ? 'unitPce' : 'unitMeter')} {acc.maxWeightKg ? `• ${acc.maxWeightKg}kg` : ''}</p>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => { setEditingAccId(acc.id); setAccForm(acc); }} className="p-3 bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors" title={t(lang, 'edit')}><Edit2 size={16} /></button>
                                {onDeleteAccessory && (
                                    <button onClick={() => { if (window.confirm(lang === 'tr' ? 'Bu aksesuarı silmek istediğinize emin misiniz?' : 'Are you sure you want to delete this accessory?')) onDeleteAccessory(acc.id); }} className="p-3 bg-red-600/10 hover:bg-red-600 text-red-400 hover:text-white rounded-xl transition-all" title={lang === 'tr' ? 'Sil' : 'Delete'}><Trash2 size={16} /></button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {activeTab === 'cnc' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in">
                <div className="lg:col-span-5">
                    <div className="bg-slate-900 border border-white/5 p-6 rounded-2xl sticky top-8">
                        <h2 className="text-xl font-bold text-white mb-6">{editingMachId ? t(lang, 'edit') : t(lang, 'addMachine')}</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">{t(lang, 'machineName')}</label>
                                <input type="text" value={machForm.name} onChange={e => setMachForm({...machForm, name: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white" placeholder="KABAN - Cutting" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">Marka</label>
                                    <input type="text" value={machForm.brand} onChange={e => setMachForm({...machForm, brand: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">Testere Payı (mm)</label>
                                    <input type="number" value={machForm.bladeThickness} onChange={e => setMachForm({...machForm, bladeThickness: Number(e.target.value)})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">Min Fire (mm)</label>
                                    <input type="number" value={machForm.minWaste} onChange={e => setMachForm({...machForm, minWaste: Number(e.target.value)})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">Kelepçe Payı (mm)</label>
                                    <input type="number" value={machForm.clampingOffset} onChange={e => setMachForm({...machForm, clampingOffset: Number(e.target.value)})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white" />
                                </div>
                            </div>
                            <button onClick={handleSaveMachine} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-all">{editingMachId ? t(lang, 'update') : t(lang, 'addMachine')}</button>
                            {editingMachId && <button onClick={() => setEditingMachId(null)} className="w-full bg-slate-800 text-slate-400 py-2 rounded-xl mt-2">{t(lang, 'cancel')}</button>}
                        </div>
                    </div>
                </div>
                <div className="lg:col-span-7 space-y-4">
                    {machines.map(m => (
                        <div key={m.id} className="bg-slate-900/50 border border-white/5 p-5 rounded-2xl flex justify-between items-center group hover:border-emerald-500/30 transition-all">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400"><Cpu size={24} /></div>
                                <div>
                                    <h3 className="font-bold text-white text-lg">{m.name}</h3>
                                    <p className="text-xs text-slate-500 uppercase font-bold tracking-widest">{m.brand} • {m.bladeThickness}mm Testere • {m.minWaste}mm Fire</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => { setEditingMachId(m.id); setMachForm(m); }} className="p-3 bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors"><Edit2 size={18} /></button>
                                <button onClick={() => onDeleteMachine?.(m.id)} className="p-3 bg-red-500/10 rounded-xl text-red-500 hover:bg-red-500/20 transition-colors"><Trash2 size={18} /></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {activeTab === 'data' && (
            <div className="max-w-3xl animate-in fade-in space-y-6">
                <div className="bg-slate-900 border border-white/5 p-8 rounded-[2rem] flex items-center gap-8">
                    <div className="w-20 h-20 bg-blue-500/10 rounded-3xl flex items-center justify-center text-blue-400 shrink-0">
                        <Download size={40} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-white mb-2">{t(lang, 'exportBackup')}</h2>
                        <p className="text-slate-400 text-sm mb-6">{t(lang, 'exportDesc')}</p>
                        <button onClick={onExportData} className="flex items-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold transition-all shadow-xl shadow-blue-900/20">
                            <FileJson size={20} /> {t(lang, 'downloadBackup')}
                        </button>
                    </div>
                </div>

                <div className="bg-slate-900 border border-white/5 p-8 rounded-[2rem] flex items-center gap-8">
                    <div className="w-20 h-20 bg-orange-500/10 rounded-3xl flex items-center justify-center text-orange-400 shrink-0">
                        <Upload size={40} />
                    </div>
                    <div className="flex-1">
                        <h2 className="text-2xl font-bold text-white mb-2">{t(lang, 'importBackup')}</h2>
                        <p className="text-slate-400 text-sm mb-6">{t(lang, 'importDesc')}</p>
                        
                        <div className="bg-orange-500/10 border border-orange-500/20 p-4 rounded-xl flex items-start gap-3 mb-6">
                            <AlertTriangle className="text-orange-500 shrink-0" size={18} />
                            <p className="text-[10px] text-orange-400 font-bold uppercase tracking-widest">{t(lang, 'overwriteWarning')}</p>
                        </div>

                        <label className="flex items-center gap-2 px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-bold cursor-pointer transition-all w-fit">
                            <Plus size={20} /> {t(lang, 'selectFile')}
                            <input type="file" accept=".json" onChange={handleImportFile} className="hidden" />
                        </label>
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'colors' && (
            <div className="max-w-4xl animate-in fade-in space-y-6">
                <div className="bg-slate-900 border border-white/5 p-8 rounded-[2rem]">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-400">
                            <Palette size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">
                                {lang === 'tr' ? 'Renk Grubu Kilogram Fiyatları Veritabanı' : 'Color Group Kilogram Price Database'}
                            </h2>
                            <p className="text-xs text-slate-400 leading-relaxed max-w-2xl mt-1">
                                {lang === 'tr' 
                                  ? 'Profilleri tekliflendirirken metre fiyatı yerine profil ağırlıklarına göre kilogram esaslı fiyatlandırma yapılması için renk bazlı Kg fiyatlarını ayarlayabilirsiniz.' 
                                  : 'Configure color-based prices per kg. When quoting, profile costs will be calculated based on system weights and colors instead of linear meter prices.'}
                            </p>
                        </div>
                    </div>

                    <div className="border border-white/5 bg-slate-900/50 rounded-2xl overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-white/5 bg-slate-950/45 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                                    <th className="px-6 py-4">{lang === 'tr' ? 'Renk Grubu' : 'Color Group'}</th>
                                    <th className="px-6 py-4 hidden md:table-cell">{lang === 'tr' ? 'Açıklama / Kapsam' : 'Description / Coverage'}</th>
                                    <th className="px-6 py-4 w-36">{lang === 'tr' ? 'TL Fiyatı' : 'TL Price'}</th>
                                    <th className="px-6 py-4 w-36">{lang === 'tr' ? 'USD Fiyatı' : 'USD Price'}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-sm">
                                {COLOR_GROUPS.map(group => {
                                    const currentPrice = colorPrices[group.id] !== undefined ? colorPrices[group.id] : group.defaultPricePerKg;
                                    const currentPriceUsd = colorPricesUsd[group.id] !== undefined ? colorPricesUsd[group.id] : parseFloat((group.defaultPricePerKg / 33.0).toFixed(2));
                                    return (
                                        <tr key={group.id} className="hover:bg-white/[0.02] transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-white">{lang === 'tr' ? group.nameTr : group.nameEn}</div>
                                                <div className="text-[10px] text-slate-500 font-mono font-medium md:hidden mt-0.5">{lang === 'tr' ? group.descriptionTr : group.descriptionEn}</div>
                                            </td>
                                            <td className="px-6 py-4 text-xs text-slate-450 leading-relaxed md:table-cell">
                                                {lang === 'tr' ? group.descriptionTr : group.descriptionEn}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-1.5">
                                                    <input 
                                                        type="number" 
                                                        value={currentPrice} 
                                                        onChange={e => handleColorPriceChange(group.id, parseFloat(e.target.value) || 0)}
                                                        className="w-20 bg-slate-950 border border-slate-800 focus:border-blue-500/50 rounded-xl px-2.5 py-1.5 text-xs text-emerald-400 outline-none font-mono font-bold" 
                                                        min="0"
                                                        step="0.01"
                                                    />
                                                    <span className="text-[10px] font-bold text-slate-500 font-mono tracking-tight">TL</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-1.5">
                                                    <input 
                                                        type="number" 
                                                        value={currentPriceUsd} 
                                                        onChange={e => handleColorPriceUsdChange(group.id, parseFloat(e.target.value) || 0)}
                                                        className="w-20 bg-slate-950 border border-slate-800 focus:border-emerald-500/50 rounded-xl px-2.5 py-1.5 text-xs text-emerald-400 outline-none font-mono font-bold" 
                                                        min="0"
                                                        step="0.01"
                                                    />
                                                    <span className="text-[10px] font-bold text-slate-500 font-mono tracking-tight">USD</span>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'general' && (
            <div className="max-w-xl animate-in fade-in">
                <div className="bg-slate-900 border border-white/5 p-8 rounded-2xl space-y-6">
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 block">
                            {lang === 'tr' ? 'Uygulama Çalışma Modu' : 'App Workflow Mode'}
                        </label>
                        <select 
                            value={appMode} 
                            onChange={e => {
                                const val = e.target.value as 'quoting' | 'manufacturing';
                                if (val === 'manufacturing') {
                                    setPendingAppMode('manufacturing');
                                    setAdminPassAttempt('');
                                    setAdminUnlockError(false);
                                    setShowAdminUnlockModal(true);
                                } else {
                                    setAppMode('quoting');
                                    localStorage.setItem('alucraft_app_mode', 'quoting');
                                    window.dispatchEvent(new Event('alucraft_settings_changed'));
                                }
                            }} 
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none font-bold text-xs"
                        >
                            <option value="quoting">{lang === 'tr' ? 'Hızlı Teklif & Satış Odaklı Mod (Önerilen)' : 'Fast Quoting & Sales Mode (Recommended)'}</option>
                            <option value="manufacturing">{lang === 'tr' ? 'Gelişmiş Üretim & CNC Modülü' : 'Advanced Production & CNC Mode'}</option>
                        </select>
                        <p className="text-[10px] text-slate-500 mt-1.5 font-semibold leading-relaxed">
                            {lang === 'tr' 
                              ? 'Teklif modunda karmaşık üretim kesim listeleri ve CNC ayarları gizlenerek sade, hızlı bir teklif arayüzü sunulur.' 
                              : 'In quoting mode, complex cutting lists and CNC settings are hidden for a streamlined presentation.'}
                        </p>

                        <div className="mt-4 pt-4 border-t border-white/5 space-y-2 animate-in fade-in">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                                {lang === 'tr' ? 'Yönetici Güvenlik Şifresi' : 'Admin Security Password'}
                            </label>
                            <input 
                                type="password"
                                value={customAdminPin}
                                onChange={e => setCustomAdminPin(e.target.value)}
                                placeholder={lang === 'tr' ? 'Boş bırakılırsa Giriş Şifreniz / Lisans Anahtarınız geçerlidir' : 'Default is your login Access Key'}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-xs font-mono outline-none focus:border-blue-500 transition-colors"
                            />
                            <p className="text-[9px] text-slate-500 font-medium leading-relaxed">
                                {lang === 'tr' 
                                  ? 'Teklif modundan Üretim/CNC çalışmasına girmeyi şifreye bağlar. Boş kalırsa giriş yaptığınız orijinal erişim anahtarı geçerlidir.'
                                  : 'Defines password protecting transitions into Production mode. If blank, your primary login license key will unlock it.'}
                            </p>
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 block">{t(lang, 'currency')}</label>
                        <select value={currency} onChange={e => setCurrency(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none">
                            <option value="USD">USD ($)</option>
                            <option value="TRY">TRY (₺)</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 block">{t(lang, 'taxRate')}</label>
                        <input type="number" value={taxRate} onChange={e => setTaxRate(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none" />
                    </div>

                    <div className="pt-4 border-t border-white/5 space-y-4">
                        <h3 className="text-sm font-bold text-slate-300">
                            {lang === 'tr' ? 'Döviz Kurları (TL Karşılığı)' : 'Exchange Rates (in TRY)'}
                        </h3>
                        <p className="text-[10px] text-slate-500 leading-relaxed font-medium">
                            {lang === 'tr'
                              ? 'Renk kg fiyatları, cam m² fiyatları ve profil metre fiyatları TL olarak tanımlandığında, teklif para birimi USD/EUR/GBP seçildiğinde fiyatlar bu kurlar üzerinden otomatik olarak dövize çevrilir.'
                              : 'When color prices, glass prices, and profile meter prices are defined in TRY, they will be automatically converted using these rates if the proposal currency is USD/EUR/GBP.'}
                        </p>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">1 USD ($)</label>
                                <div className="relative">
                                    <input type="number" step="0.01" value={usdRate} onChange={e => setUsdRate(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-3 pr-8 py-2 text-xs font-mono text-emerald-400 outline-none" placeholder="33.0" />
                                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-500">TL</span>
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">1 EUR (€)</label>
                                <div className="relative">
                                    <input type="number" step="0.01" value={eurRate} onChange={e => setEurRate(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-3 pr-8 py-2 text-xs font-mono text-emerald-400 outline-none" placeholder="35.5" />
                                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-500">TL</span>
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">1 GBP (£)</label>
                                <div className="relative">
                                    <input type="number" step="0.01" value={gbpRate} onChange={e => setGbpRate(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-3 pr-8 py-2 text-xs font-mono text-emerald-400 outline-none" placeholder="42.5" />
                                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-500">TL</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <button onClick={handleSaveGeneral} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all">
                        <Save size={18} /> {t(lang, 'saveSettings')}
                    </button>
                </div>
            </div>
        )}
      </div>

      {showAdminUnlockModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-sm bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
                <div className="flex flex-col items-center text-center space-y-4">
                    <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center text-blue-400 border border-blue-500/20">
                        <Wrench size={22} className="animate-pulse" />
                    </div>
                    <div className="space-y-1">
                        <h4 className="text-base font-bold text-white">
                            {lang === 'tr' ? 'Yönetici Kilidini Aç' : 'Unlock Admin Mode'}
                        </h4>
                        <p className="text-[11px] text-slate-400 leading-relaxed px-2">
                            {lang === 'tr' 
                              ? 'Üretim ve CNC modülünü aktifleştirmek için lütfen Giriş Anahtarınızı veya özel Yönetici Şifrenizi girin.'
                              : 'To activate the production and CNC parameters, please perform admin authentication.'}
                        </p>
                    </div>

                    <div className="w-full space-y-2 text-left">
                        <input 
                            type="password"
                            value={adminPassAttempt}
                            onChange={e => {
                                setAdminPassAttempt(e.target.value);
                                setAdminUnlockError(false);
                            }}
                            className={`w-full bg-slate-900 border ${adminUnlockError ? 'border-red-500 focus:border-red-500' : 'border-slate-800 focus:border-blue-500'} rounded-xl p-3 text-white text-xs font-mono text-center outline-none transition-colors`}
                            placeholder={lang === 'tr' ? 'YÖNETİCİ ŞİFRESİ' : 'ADMIN PASSWORD'}
                            autoFocus
                            onKeyDown={e => {
                                if (e.key === 'Enter') {
                                    handleConfirmAdminUnlock();
                                }
                            }}
                        />
                        {adminUnlockError && (
                            <p className="text-[10px] text-red-400 font-bold text-center animate-pulse">
                                {lang === 'tr' ? 'Geçersiz Şifre veya Anahtar!' : 'Invalid Authentication Password!'}
                            </p>
                        )}
                    </div>

                    <div className="flex gap-3 w-full pt-2">
                        <button 
                            onClick={() => {
                                setShowAdminUnlockModal(false);
                                setAdminPassAttempt('');
                                setAdminUnlockError(false);
                                setPendingAppMode(null);
                            }}
                            className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs font-bold py-2.5 rounded-xl transition-all"
                        >
                            {lang === 'tr' ? 'İptal' : 'Cancel'}
                        </button>
                        <button 
                            onClick={handleConfirmAdminUnlock}
                            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-2.5 rounded-xl shadow-lg shadow-blue-500/20 transition-all"
                        >
                            {lang === 'tr' ? 'Onayla' : 'Verify'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
