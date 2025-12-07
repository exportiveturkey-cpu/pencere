
import React, { useState } from 'react';
import { ProfileSystem, Accessory, Language } from '../types';
import { ArrowLeft, Settings as SettingsIcon, Check, Edit2, X, Wrench, Layers, Ruler } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { t } from '../translations';
import Logo from './Logo';

interface SettingsProps {
  systems: ProfileSystem[];
  accessories?: Accessory[];
  lang: Language;
  onAddSystem: (system: ProfileSystem) => void;
  onUpdateSystem: (system: ProfileSystem) => void;
  onAddAccessory?: (acc: Accessory) => void;
  onUpdateAccessory?: (acc: Accessory) => void;
  onBack: () => void;
}

const Settings: React.FC<SettingsProps> = ({ 
    systems, 
    accessories = [], 
    lang, 
    onAddSystem, 
    onUpdateSystem, 
    onAddAccessory,
    onUpdateAccessory,
    onBack 
}) => {
  const [activeTab, setActiveTab] = useState<'systems' | 'accessories'>('systems');
  
  // System Form State
  const [editingSysId, setEditingSysId] = useState<string | null>(null);
  const [sysForm, setSysForm] = useState<Partial<ProfileSystem>>({
    name: '', 
    frameWidth: 65, 
    uValue: 1.5, 
    pricePerMeter: 0, 
    profileLength: 6.0,
    correctionConfig: {
      sashOverlap: 6,
      glassClearance: 4,
      mullionCorrection: 0,
      frameCornerWelding: 0
    }
  });

  // Accessory Form State
  const [editingAccId, setEditingAccId] = useState<string | null>(null);
  const [accForm, setAccForm] = useState<Partial<Accessory>>({
    name: '', type: 'handle', unit: 'pce', price: 0, maxWeightKg: 0
  });

  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // System Handlers
  const resetSysForm = () => {
    setSysForm({ 
        name: '', 
        frameWidth: 65, 
        uValue: 1.5, 
        pricePerMeter: 0, 
        profileLength: 6.0,
        correctionConfig: {
            sashOverlap: 6,
            glassClearance: 4,
            mullionCorrection: 0,
            frameCornerWelding: 0
        }
    });
    setEditingSysId(null);
  };

  const handleEditSys = (sys: ProfileSystem) => {
    setEditingSysId(sys.id);
    // Ensure nested object exists
    setSysForm({ 
        ...sys,
        correctionConfig: sys.correctionConfig || {
            sashOverlap: 6,
            glassClearance: 4,
            mullionCorrection: 0,
            frameCornerWelding: 0
        }
    });
  };

  const handleSaveSys = () => {
    if (!sysForm.name || !sysForm.frameWidth) return;
    
    const sysData: ProfileSystem = {
        id: editingSysId || uuidv4(),
        name: sysForm.name || '',
        frameWidth: Number(sysForm.frameWidth),
        uValue: Number(sysForm.uValue),
        pricePerMeter: Number(sysForm.pricePerMeter),
        profileLength: Number(sysForm.profileLength || 6.0),
        correctionConfig: {
            sashOverlap: Number(sysForm.correctionConfig?.sashOverlap || 0),
            glassClearance: Number(sysForm.correctionConfig?.glassClearance || 0),
            mullionCorrection: Number(sysForm.correctionConfig?.mullionCorrection || 0),
            frameCornerWelding: Number(sysForm.correctionConfig?.frameCornerWelding || 0)
        }
    };

    if (editingSysId) onUpdateSystem(sysData);
    else onAddSystem(sysData);
    
    showSuccess(editingSysId ? t(lang, 'systemUpdated') : t(lang, 'systemAdded'));
    resetSysForm();
  };

  // Accessory Handlers
  const resetAccForm = () => {
    setAccForm({ name: '', type: 'handle', unit: 'pce', price: 0, maxWeightKg: 0 });
    setEditingAccId(null);
  };

  const handleEditAcc = (acc: Accessory) => {
    setEditingAccId(acc.id);
    setAccForm({ ...acc });
  };

  const handleSaveAcc = () => {
    if (!accForm.name || !onAddAccessory || !onUpdateAccessory) return;
    
    const accData: Accessory = {
        id: editingAccId || uuidv4(),
        name: accForm.name || '',
        type: accForm.type as any,
        unit: accForm.unit as any,
        price: Number(accForm.price),
        maxWeightKg: accForm.type === 'hinge' ? Number(accForm.maxWeightKg) : undefined
    };

    if (editingAccId) onUpdateAccessory(accData);
    else onAddAccessory(accData);

    showSuccess(editingAccId ? t(lang, 'accUpdated') : t(lang, 'accAdded'));
    resetAccForm();
  };

  const showSuccess = (msg: string) => {
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(null), 3000);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
                <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
                    <ArrowLeft size={24} />
                </button>
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                    <SettingsIcon className="text-blue-500" />
                    {t(lang, 'sysConfig')}
                </h1>
            </div>
            <Logo className="w-10 h-10" showText={false} />
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-8 border-b border-slate-700 pb-1">
            <button 
                onClick={() => setActiveTab('systems')}
                className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${activeTab === 'systems' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-white'}`}
            >
                <Layers size={18} /> {t(lang, 'systems')}
            </button>
            <button 
                onClick={() => setActiveTab('accessories')}
                className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${activeTab === 'accessories' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-white'}`}
            >
                <Wrench size={18} /> {t(lang, 'accessories')}
            </button>
        </div>

        {activeTab === 'systems' ? (
             <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* System Form */}
                <div className="lg:col-span-5">
                    <div className={`p-6 rounded-xl border sticky top-8 transition-colors ${editingSysId ? 'bg-blue-900/20 border-blue-500/50' : 'bg-slate-800 border-slate-700'}`}>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-semibold text-white">{editingSysId ? t(lang, 'edit') : t(lang, 'addSystem')}</h2>
                            {editingSysId && <button onClick={resetSysForm} className="text-xs text-slate-400"><X size={12}/> {t(lang, 'cancel')}</button>}
                        </div>
                        
                        <div className="space-y-6">
                             <div className="space-y-3">
                                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-700 pb-1">Basic Info</h3>
                                
                                <div className="space-y-1">
                                    <label className="text-xs text-slate-400">{t(lang, 'sysName')}</label>
                                    <input type="text" value={sysForm.name} onChange={e => setSysForm({...sysForm, name: e.target.value})} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm" />
                                </div>
                                
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-xs text-slate-400">{t(lang, 'frameWidth')}</label>
                                        <input type="number" value={sysForm.frameWidth} onChange={e => setSysForm({...sysForm, frameWidth: Number(e.target.value)})} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs text-slate-400">{t(lang, 'uValue')}</label>
                                        <input type="number" step="0.1" value={sysForm.uValue} onChange={e => setSysForm({...sysForm, uValue: Number(e.target.value)})} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm" />
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-xs text-slate-400">{t(lang, 'price')}</label>
                                        <input type="number" value={sysForm.pricePerMeter} onChange={e => setSysForm({...sysForm, pricePerMeter: Number(e.target.value)})} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs text-slate-400">{t(lang, 'profileLength')}</label>
                                        <input type="number" step="0.1" value={sysForm.profileLength} onChange={e => setSysForm({...sysForm, profileLength: Number(e.target.value)})} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm" />
                                    </div>
                                </div>
                             </div>

                             {/* System Rules Engine UI */}
                             <div className="space-y-3 bg-slate-900/50 p-4 rounded-lg border border-slate-700/50">
                                <h3 className="text-xs font-bold text-orange-400 uppercase tracking-wider border-b border-slate-700 pb-1 flex items-center gap-2">
                                    <Ruler size={14} />
                                    {t(lang, 'cuttingRules')}
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] text-slate-400 mb-1">{t(lang, 'sashOverlap')} (+mm)</label>
                                        <input type="number" value={sysForm.correctionConfig?.sashOverlap} onChange={e => setSysForm({...sysForm, correctionConfig: { ...sysForm.correctionConfig!, sashOverlap: Number(e.target.value)}})} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-sm font-mono text-center text-blue-300" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] text-slate-400 mb-1">{t(lang, 'glassClearance')} (-mm)</label>
                                        <input type="number" value={sysForm.correctionConfig?.glassClearance} onChange={e => setSysForm({...sysForm, correctionConfig: { ...sysForm.correctionConfig!, glassClearance: Number(e.target.value)}})} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-sm font-mono text-center text-red-300" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] text-slate-400 mb-1">{t(lang, 'mullionCorrection')} (mm)</label>
                                        <input type="number" value={sysForm.correctionConfig?.mullionCorrection} onChange={e => setSysForm({...sysForm, correctionConfig: { ...sysForm.correctionConfig!, mullionCorrection: Number(e.target.value)}})} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-sm font-mono text-center" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] text-slate-400 mb-1">{t(lang, 'weldingAllowance')} (+mm)</label>
                                        <input type="number" value={sysForm.correctionConfig?.frameCornerWelding} onChange={e => setSysForm({...sysForm, correctionConfig: { ...sysForm.correctionConfig!, frameCornerWelding: Number(e.target.value)}})} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-sm font-mono text-center" />
                                    </div>
                                </div>
                             </div>
                             
                             {successMsg && <div className="text-emerald-400 text-xs flex items-center gap-2"><Check size={12} /> {successMsg}</div>}
                             <button onClick={handleSaveSys} disabled={!sysForm.name} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded mt-2 font-medium shadow-lg shadow-blue-900/20">{editingSysId ? t(lang, 'update') : t(lang, 'addSystem')}</button>
                        </div>
                    </div>
                </div>
                {/* System List */}
                <div className="lg:col-span-7 space-y-4">
                    {systems.map((sys) => (
                        <div key={sys.id} className="p-4 rounded-lg bg-slate-800 border border-slate-700 flex justify-between items-start group hover:border-blue-500 transition-colors">
                            <div>
                                <h3 className="font-bold text-lg text-white mb-1">{sys.name}</h3>
                                <div className="text-xs text-slate-400 space-y-1">
                                    <div className="flex gap-3">
                                        <span>Frame: {sys.frameWidth}mm</span>
                                        <span>Uf: {sys.uValue}</span>
                                        <span>${sys.pricePerMeter}/m</span>
                                    </div>
                                    <div className="flex gap-2 mt-2 pt-2 border-t border-slate-700 text-slate-500">
                                        <span className="bg-slate-900 px-2 py-0.5 rounded">Bini: {sys.correctionConfig?.sashOverlap || 6}mm</span>
                                        <span className="bg-slate-900 px-2 py-0.5 rounded">Cam Payı: {sys.correctionConfig?.glassClearance || 4}mm</span>
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => handleEditSys(sys)} className="p-2 rounded-full bg-slate-700 text-slate-300 hover:text-white group-hover:bg-blue-600 group-hover:text-white transition-colors"><Edit2 size={16} /></button>
                        </div>
                    ))}
                </div>
             </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Accessory Form (Kept Same) */}
                <div className="md:col-span-1">
                    <div className={`p-6 rounded-xl border sticky top-8 transition-colors ${editingAccId ? 'bg-blue-900/20 border-blue-500/50' : 'bg-slate-800 border-slate-700'}`}>
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-semibold text-white">{editingAccId ? t(lang, 'edit') : t(lang, 'addAccessory')}</h2>
                            {editingAccId && <button onClick={resetAccForm} className="text-xs text-slate-400"><X size={12}/> {t(lang, 'cancel')}</button>}
                        </div>
                        <div className="space-y-4">
                             <div className="space-y-1">
                                <label className="text-xs text-slate-400">{t(lang, 'accessoryName')}</label>
                                <input type="text" value={accForm.name} onChange={e => setAccForm({...accForm, name: e.target.value})} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm" />
                             </div>
                             <div className="space-y-1">
                                <label className="text-xs text-slate-400">{t(lang, 'type')}</label>
                                <select value={accForm.type} onChange={e => setAccForm({...accForm, type: e.target.value as any})} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm">
                                    <option value="handle">{t(lang, 'handle')}</option>
                                    <option value="gasket">{t(lang, 'gasket')}</option>
                                    <option value="hinge">{t(lang, 'hinge')}</option>
                                    <option value="lock">{t(lang, 'lock')}</option>
                                    <option value="corner">{t(lang, 'corner')}</option>
                                    <option value="automation">{t(lang, 'automation')}</option>
                                    <option value="other">{t(lang, 'other')}</option>
                                </select>
                             </div>
                             <div className="space-y-1">
                                <label className="text-xs text-slate-400">Unit</label>
                                <select value={accForm.unit} onChange={e => setAccForm({...accForm, unit: e.target.value as any})} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm">
                                    <option value="pce">{t(lang, 'unitPce')}</option>
                                    <option value="meter">{t(lang, 'unitMeter')}</option>
                                </select>
                             </div>
                             {accForm.type === 'hinge' && (
                                 <div className="space-y-1">
                                    <label className="text-xs text-slate-400">{t(lang, 'maxWeightKg')}</label>
                                    <input type="number" value={accForm.maxWeightKg || 0} onChange={e => setAccForm({...accForm, maxWeightKg: Number(e.target.value)})} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm" />
                                 </div>
                             )}
                             <div className="space-y-1">
                                <label className="text-xs text-slate-400">{t(lang, 'price')}</label>
                                <input type="number" value={accForm.price} onChange={e => setAccForm({...accForm, price: Number(e.target.value)})} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm" />
                             </div>
                             
                             {successMsg && <div className="text-emerald-400 text-xs flex items-center gap-2"><Check size={12} /> {successMsg}</div>}
                             <button onClick={handleSaveAcc} disabled={!accForm.name} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded mt-2">{editingAccId ? t(lang, 'update') : t(lang, 'addAccessory')}</button>
                        </div>
                    </div>
                </div>
                {/* Accessory List */}
                <div className="md:col-span-2 space-y-4">
                    {accessories.map((acc) => (
                        <div key={acc.id} className="p-4 rounded-lg bg-slate-800 border border-slate-700 flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-lg text-white">{acc.name}</h3>
                                <div className="flex gap-3 text-sm text-slate-400">
                                    <span className="capitalize px-2 py-0.5 rounded bg-slate-700 text-xs text-slate-300">{t(lang, acc.type as any)}</span>
                                    <span>${acc.price} / {acc.unit === 'pce' ? t(lang, 'unitPce') : t(lang, 'unitMeter')}</span>
                                    {acc.maxWeightKg && <span className="text-emerald-400">Max: {acc.maxWeightKg}kg</span>}
                                </div>
                            </div>
                            <button onClick={() => handleEditAcc(acc)} className="p-2 rounded-full bg-slate-700 text-slate-300 hover:text-white"><Edit2 size={16} /></button>
                        </div>
                    ))}
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default Settings;
