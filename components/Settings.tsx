import React, { useState } from 'react';
import { ProfileSystem, Language } from '../types';
import { ArrowLeft, Plus, Settings as SettingsIcon, Check, Edit2, X, Save } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { t } from '../translations';

interface SettingsProps {
  systems: ProfileSystem[];
  lang: Language;
  onAddSystem: (system: ProfileSystem) => void;
  onUpdateSystem: (system: ProfileSystem) => void;
  onBack: () => void;
}

const Settings: React.FC<SettingsProps> = ({ systems, lang, onAddSystem, onUpdateSystem, onBack }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formState, setFormState] = useState<Partial<ProfileSystem>>({
    name: '',
    frameWidth: 65,
    uValue: 1.5,
    pricePerMeter: 0
  });
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const resetForm = () => {
    setFormState({ name: '', frameWidth: 65, uValue: 1.5, pricePerMeter: 0 });
    setEditingId(null);
  };

  const handleEditClick = (sys: ProfileSystem) => {
    setEditingId(sys.id);
    setFormState({ ...sys });
  };

  const handleSave = () => {
    if (!formState.name || !formState.frameWidth) {
        setSuccessMsg(t(lang, 'fillAllFields'));
        setTimeout(() => setSuccessMsg(null), 2000);
        return;
    }
    
    if (editingId) {
        // Update existing
        const updatedSystem: ProfileSystem = {
            id: editingId,
            name: formState.name || '',
            frameWidth: Number(formState.frameWidth),
            uValue: Number(formState.uValue),
            pricePerMeter: Number(formState.pricePerMeter)
        };
        onUpdateSystem(updatedSystem);
        setSuccessMsg(t(lang, 'systemUpdated'));
    } else {
        // Add new
        const system: ProfileSystem = {
            id: uuidv4(),
            name: formState.name || '',
            frameWidth: Number(formState.frameWidth),
            uValue: Number(formState.uValue),
            pricePerMeter: Number(formState.pricePerMeter)
        };
        onAddSystem(system);
        setSuccessMsg(t(lang, 'systemAdded'));
    }
    
    resetForm();
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <SettingsIcon className="text-blue-500" />
            {t(lang, 'sysConfig')}
          </h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Add/Edit System Form */}
          <div className="md:col-span-1">
            <div className={`p-6 rounded-xl border sticky top-8 transition-colors ${editingId ? 'bg-blue-900/20 border-blue-500/50' : 'bg-slate-800 border-slate-700'}`}>
              <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-white">
                      {editingId ? t(lang, 'edit') : t(lang, 'addSystem')}
                  </h2>
                  {editingId && (
                      <button onClick={resetForm} className="text-xs text-slate-400 hover:text-white flex items-center gap-1">
                          <X size={12} /> {t(lang, 'cancel')}
                      </button>
                  )}
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">{t(lang, 'sysName')}</label>
                  <input 
                    type="text" 
                    value={formState.name}
                    onChange={e => setFormState({...formState, name: e.target.value})}
                    placeholder="e.g., ThermoMax 90"
                    className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">{t(lang, 'frameWidth')}</label>
                  <input 
                    type="number" 
                    value={formState.frameWidth}
                    onChange={e => setFormState({...formState, frameWidth: Number(e.target.value)})}
                    className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">{t(lang, 'uValue')} (W/m²K)</label>
                  <input 
                    type="number" 
                    step="0.1"
                    value={formState.uValue}
                    onChange={e => setFormState({...formState, uValue: Number(e.target.value)})}
                    className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">{t(lang, 'price')}</label>
                  <input 
                    type="number" 
                    value={formState.pricePerMeter}
                    onChange={e => setFormState({...formState, pricePerMeter: Number(e.target.value)})}
                    className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm focus:border-blue-500 outline-none"
                  />
                </div>
                
                {successMsg && (
                    <div className="bg-emerald-900/30 text-emerald-400 text-xs p-2 rounded border border-emerald-900/50 flex items-center gap-2">
                        <Check size={12} /> {successMsg}
                    </div>
                )}

                <button 
                  onClick={handleSave}
                  disabled={!formState.name}
                  className={`w-full text-white py-2 rounded font-medium flex items-center justify-center gap-2 mt-2 transition-all ${
                      editingId ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-blue-600 hover:bg-blue-500'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {editingId ? <Save size={18} /> : <Plus size={18} />} 
                  {editingId ? t(lang, 'update') : t(lang, 'addSystem')}
                </button>
              </div>
            </div>
          </div>

          {/* List Existing Systems */}
          <div className="md:col-span-2 space-y-4">
            <h2 className="text-xl font-semibold mb-4 text-white">{t(lang, 'activeSystems')}</h2>
            {systems.map((sys) => (
              <div 
                key={sys.id} 
                className={`p-4 rounded-lg border flex items-center justify-between group transition-colors ${
                    editingId === sys.id ? 'bg-blue-900/10 border-blue-500' : 'bg-slate-800 border-slate-700 hover:border-slate-500'
                }`}
              >
                <div>
                  <h3 className="font-bold text-lg text-white">{sys.name}</h3>
                  <div className="flex gap-4 text-sm text-slate-400 mt-1">
                    <span>{t(lang, 'width')}: <span className="text-slate-200">{sys.frameWidth}</span></span>
                    <span>{t(lang, 'uValue')}: <span className="text-slate-200">{sys.uValue}</span></span>
                    <span>{t(lang, 'price')}: <span className="text-emerald-400">{sys.pricePerMeter}</span></span>
                  </div>
                </div>
                <div className="flex items-center">
                  <button 
                    onClick={() => handleEditClick(sys)}
                    className="p-2 rounded-full bg-slate-700 text-slate-300 hover:bg-blue-600 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                    title={t(lang, 'edit')}
                  >
                     <Edit2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;