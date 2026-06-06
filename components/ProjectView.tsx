
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Project, Unit, ProfileSystem, Language, Accessory, WindowNode, MachineConfig } from '../types';
import { ArrowLeft, Edit2, Plus, Trash2, Printer, Sparkles, FileText, Loader2, Save, Layers, Wrench, Cpu, Download, Box, LayoutGrid, Scissors, Droplets, AlertCircle, Globe, Image as ImageIcon, ScanSearch, Ruler, Maximize2, FileCheck, DollarSign, Package, ChevronDown } from 'lucide-react';
import { t } from '../translations';
import Visualizer from './Visualizer';
import OptimizationReport from './OptimizationReport';
import CuttingList from './CuttingList';
import { GLASS_TYPES } from '../constants';
import { analyzeDrawing, generateSalesPitch } from '../services/geminiService';
import { generateCNCCSV } from '../services/cncService';
import { generateDXF } from '../services/dxfService';
import { getAggregatedGlassOrder, getAggregatedCuttingList, getProjectAccessorySummary, calculateProjectOptimization } from '../services/optimizationService';
import { v4 as uuidv4 } from 'uuid';

interface ProjectViewProps {
  project: Project;
  systems: ProfileSystem[];
  accessories?: Accessory[];
  lang: Language;
  onBack: () => void;
  onUpdateProject: (project: Project) => void;
  onAddUnit: () => void;
  onEditUnit: (unit: Unit) => void;
  onDeleteUnit: (unitId: string) => void;
  machines?: MachineConfig[];
}

const compressImageIfNeeded = (file: File): Promise<{ base64: string; type: string }> => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        resolve({
          base64: e.target?.result as string,
          type: file.type
        });
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 1600;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({ base64: e.target?.result as string, type: file.type });
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        // Compress as jpeg with 0.8 quality to keep payload small
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.82);
        resolve({
          base64: compressedBase64,
          type: 'image/jpeg'
        });
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
};

const ProjectView: React.FC<ProjectViewProps> = ({ project, systems, accessories = [], lang, onBack, onUpdateProject, onAddUnit, onEditUnit, onDeleteUnit, machines = [] }) => {
  const [activeTab, setActiveTab] = useState<'details' | 'production' | 'cnc' | 'quote'>('details');
  const [productionSubTab, setProductionSubTab] = useState<'cuts' | 'glass' | 'bom'>('cuts');
  const [isScanning, setIsScanning] = useState(false);
  const [isGeneratingPitch, setIsGeneratingPitch] = useState(false);
  const [selectedMachineId, setSelectedMachineId] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [tempProject, setTempProject] = useState<Project>(project);

  const taxRate = Number(localStorage.getItem('alucraft_tax')) || 20;

  useEffect(() => {
    if (machines.length > 0 && !selectedMachineId) {
      setSelectedMachineId(machines[0].id);
    }
  }, [machines, selectedMachineId]);

  const glassOrders = useMemo(() => getAggregatedGlassOrder(project.units, systems), [project.units, systems]);
  const accessorySummary = useMemo(() => getProjectAccessorySummary(project.units, accessories), [project.units, accessories]);
  const optimizationSummary = useMemo(() => calculateProjectOptimization(project.units, systems), [project.units, systems]);

  const handleUpdateInfo = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateProject(tempProject);
    setIsEditingInfo(false);
  };

  const handleQuickUpdateUnit = (unitId: string, updates: Partial<Unit>) => {
    const updatedUnits = project.units.map(u => u.id === unitId ? { ...u, ...updates } : u);
    onUpdateProject({ ...project, units: updatedUnits });
  };

  const handleGeneratePitch = async () => {
    setIsGeneratingPitch(true);
    try {
      const pitch = await generateSalesPitch(project, project.units, lang);
      if (!pitch) {
        throw new Error(lang === 'tr' ? "Teklif metni oluşturulamadı. Lütfen API anahtarınızı kontrol edin." : "Could not generate pitch. Please check your API key.");
      }
      onUpdateProject({ ...project, quoteText: pitch });
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsGeneratingPitch(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/') && file.size > 4.5 * 1024 * 1024) {
      alert(lang === 'tr'
        ? "Yüklediğiniz PDF dosyası çok büyük (Sınır: 4.5MB). Lütfen daha küçük boyutlu bir PDF yükleyin veya çizimden ekran görüntüsü (PNG/JPG) alıp yükleyin."
        : "The uploaded PDF file is too large (Limit: 4.5MB). Please upload a smaller PDF or capture a screenshot (PNG/JPG) of the drawing and upload it.");
      return;
    }

    setIsScanning(true);
    try {
      const { base64, type } = await compressImageIfNeeded(file);
      const detectedUnits = await analyzeDrawing(base64, type, lang);
      
      if (detectedUnits.length > 0) {
        const newUnits: Unit[] = detectedUnits.map(d => ({
          id: uuidv4(),
          name: d.name || 'AI Poz',
          width: Number(d.width) || 1000,
          height: Number(d.height) || 1000,
          system: systems[0].id,
          color: 'RAL 7016',
          glassType: 'double24',
          glassThickness: 24,
          quantity: 1,
          rootNode: {
            id: uuidv4(),
            type: 'glass',
            openingType: d.type || 'fixed'
          }
        }));
        
        onUpdateProject({
          ...project,
          units: [...project.units, ...newUnits]
        });
      }
    } catch (error: any) {
      alert(lang === 'tr' ? "Çizim analizi başarısız oldu: " + error.message : "Drawing analysis failed: " + error.message);
    } finally {
      setIsScanning(false);
    }
  };

  const handleExportCNC = () => {
    const machine = machines.find(m => m.id === selectedMachineId) || machines[0];
    if (!machine) {
        alert(t(lang, 'noMachinesFound'));
        return;
    }
    const csvData = generateCNCCSV(project.units, systems, machine);
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name}_CNC_${machine.name}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportDXF = (unit: Unit) => {
    let system = systems.find(s => s.id === unit.system);
    if (!system) {
      system = systems.find(s => s.name.toLowerCase().includes(unit.system.toLowerCase()));
    }
    if (!system) system = systems[0];
    
    const dxfData = generateDXF(unit, system);
    const blob = new Blob([dxfData], { type: 'application/dxf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${unit.name}_${system.name}.dxf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getUnitStats = (unit: Unit) => {
    // Robust system lookup
    let system = systems.find(s => s.id === unit.system);
    if (!system) {
      system = systems.find(s => s.name.toLowerCase().includes(unit.system.toLowerCase()));
    }
    if (!system) {
      system = systems[0];
    }
    
    if (!system) return { cost: 0, weight: 0, selectedAccs: [], accCost: 0 };
    
    const cuttingListMap = getAggregatedCuttingList([unit], [system]);
    const systemCuts = cuttingListMap[system.name] || [];
    
    let profileWeight = 0;
    let perimeterM = 0;
    systemCuts.forEach(cut => {
      const lengthM = cut.length / 1000;
      perimeterM += lengthM * cut.quantity;
      const label = cut.label.toLowerCase();
      
      const weightPerMeter = 
        label.includes('frame') || label.includes('kasa') ? (system.profileWeights?.frame || 0) :
        label.includes('sash') || label.includes('kanat') ? (system.profileWeights?.sash || 0) :
        label.includes('mullion') || label.includes('transom') || label.includes('kayıt') ? (system.profileWeights?.mullion || 0) :
        label.includes('bead') || label.includes('çıta') ? (system.profileWeights?.glazingBead || 0) : 0;
        
      profileWeight += lengthM * weightPerMeter * cut.quantity;
    });

    const glassObj = GLASS_TYPES.find(g => g.id === unit.glassType);
    const totalAreaM2 = (unit.width * unit.height) / 1000000;
    const profileCost = perimeterM * (system.pricePerMeter || 85);
    const glassCost = totalAreaM2 * (glassObj?.pricePerSqm || 65);
    
    let accCost = 0;
    const selectedAccs: any[] = [];
    const accIds = [
      unit.selectedHandle, 
      unit.selectedGasket, 
      unit.selectedHinge, 
      unit.selectedCorner, 
      unit.selectedLock, 
      unit.selectedAutomation,
      unit.selectedLockStriker,
      unit.selectedDoorCloser,
      unit.selectedKickplate,
      unit.selectedOther
    ].filter(Boolean);

    accIds.forEach(id => {
      const acc = accessories.find(a => a.id === id);
      if (acc) {
        let qty = 1;
        if (acc.unit === 'meter') qty = perimeterM;
        accCost += acc.price * qty;
        selectedAccs.push({ id: acc.id, name: acc.name, type: acc.type, price: acc.price, qty, unit: acc.unit });
      }
    });

    return { cost: profileCost + glassCost + accCost, weight: profileWeight, selectedAccs, accCost };
  };

  const projectTotalStats = useMemo(() => {
    let totalWeight = 0;
    let subTotal = 0;
    project.units.forEach(u => {
      const stats = getUnitStats(u);
      totalWeight += stats.weight * (u.quantity || 1);
      subTotal += stats.cost * (u.quantity || 1);
    });
    const vatAmount = project.isExport ? 0 : (subTotal * taxRate) / 100;
    return { subTotal, vatAmount, grandTotal: subTotal + vatAmount, totalWeight };
  }, [project.units, project.isExport, taxRate, systems, accessories]);

  return (
    <div className="flex h-full bg-slate-950 overflow-hidden">
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*,application/pdf" onChange={handleFileUpload} />
      
      <div className="flex-1 flex flex-col h-full overflow-y-auto print:overflow-visible print:bg-white print:text-black">
        <div className="h-20 border-b border-slate-700 bg-slate-800 px-6 flex items-center justify-between sticky top-0 z-30 print:hidden shadow-xl">
            <div className="flex items-center gap-4">
                <button onClick={onBack} className="p-2.5 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition-colors border border-white/5">
                    <ArrowLeft size={20} />
                </button>
                <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 group cursor-pointer" onClick={() => { setTempProject(project); setIsEditingInfo(true); }}>
                          <h1 className="text-xl font-bold text-white leading-tight">{project.name}</h1>
                          <Edit2 size={14} className="text-slate-500 opacity-60 group-hover:opacity-100 transition-opacity" />
                        </div>
                    </div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{project.client} • {project.date}</span>
                </div>
            </div>

            <div className="flex items-center gap-4">
                <div className="flex bg-slate-950 p-1 rounded-xl border border-white/5 mr-4">
                    <button onClick={() => setActiveTab('details')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'details' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
                        {t(lang, 'detailsTab')}
                    </button>
                    <button onClick={() => setActiveTab('quote')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'quote' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
                        {t(lang, 'quoteTab')}
                    </button>
                    <button onClick={() => setActiveTab('production')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'production' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
                        {t(lang, 'productionTab')}
                    </button>
                    <button onClick={() => setActiveTab('cnc')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'cnc' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
                        {t(lang, 'cncSectionTab')}
                    </button>
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => fileInputRef.current?.click()} 
                    disabled={isScanning}
                    className="bg-slate-700 hover:bg-slate-600 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 font-bold shadow-lg transition-all border border-white/5"
                  >
                    {isScanning ? <Loader2 className="animate-spin" size={18} /> : <ScanSearch size={18} />}
                    <span className="hidden md:inline">{t(lang, 'scanDrawing')}</span>
                  </button>
                  <button onClick={onAddUnit} className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 font-bold shadow-lg">
                      <Plus size={18} strokeWidth={3} /> {t(lang, 'addPosition')}
                  </button>
                </div>
            </div>
        </div>

        <div className="flex-1 p-8 space-y-12 max-w-7xl mx-auto w-full print:p-0 print:space-y-4 print:max-w-none">
            {activeTab === 'details' && (
                <>
                    <div className="bg-slate-800/50 border border-slate-700 rounded-[2rem] p-8 shadow-inner print:bg-white print:border-slate-200 print:rounded-none print:p-4 print:shadow-none">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-white print:text-black">{t(lang, 'summary')}</h2>
                            <div className="flex items-center gap-2 print:hidden">
                                <button onClick={() => {
                                    project.units.forEach(u => handleExportDXF(u));
                                }} className="flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all shadow-lg">
                                    <Download size={14} /> {t(lang, 'downloadDxf')} (All)
                                </button>
                                <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-bold transition-all shadow-lg">
                                    <Printer size={14} /> {t(lang, 'exportPdf')}
                                </button>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 print:gap-4">
                            <div className="bg-slate-900/40 p-5 rounded-2xl border border-white/5 print:bg-slate-50 print:border-slate-200">
                                <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest block mb-1 print:text-slate-400">{t(lang, 'positions')}</span>
                                <span className="text-2xl font-bold text-white print:text-slate-900">{project.units.length}</span>
                            </div>
                            <div className="bg-slate-900/40 p-5 rounded-2xl border border-white/5 print:bg-slate-50 print:border-slate-200">
                                <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest block mb-1 print:text-slate-400">{t(lang, 'totalWeight')}</span>
                                <span className="text-2xl font-bold text-orange-400 print:text-orange-600">{projectTotalStats.totalWeight.toFixed(1)} kg</span>
                            </div>
                            <div className="bg-slate-900/40 p-5 rounded-2xl border border-white/5 print:bg-slate-50 print:border-slate-200">
                                <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest block mb-1 print:text-slate-400">{t(lang, 'grandTotal')}</span>
                                <span className="text-2xl font-bold text-emerald-400 print:text-emerald-600">${projectTotalStats.grandTotal.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12 print:grid-cols-2 print:gap-4">
                        {project.units.map((unit, index) => {
                            const stats = getUnitStats(unit);
                            return (
                                <div key={unit.id} className="bg-slate-800 border border-slate-700 rounded-[1.5rem] overflow-hidden group hover:border-blue-500/50 transition-all flex flex-col shadow-sm relative avoid-break print:bg-white print:border-slate-200">
                                    <div className="flex flex-col h-full">
                                        <div className="aspect-[4/3] bg-slate-50 relative flex items-center justify-center p-6 border-b border-slate-200 overflow-hidden print:bg-white">
                                            <div className="w-full h-full flex items-center justify-center">
                                              <svg 
                                                viewBox={`0 0 ${unit.width} ${unit.height}`} 
                                                className="w-full h-full max-h-full max-w-full p-2"
                                                preserveAspectRatio="xMidYMid meet"
                                              >
                                                <Visualizer node={unit.rootNode} width={unit.width} height={unit.height} system={systems.find(s => s.id === unit.system) || systems[0]} selectedNodeId={null} onSelectNode={() => {}} shape={unit.shape} archHeight={unit.archHeight} theme="light" />
                                              </svg>
                                            </div>
                                            <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 backdrop-blur-[2px] print:hidden">
                                                <button onClick={() => onEditUnit(unit)} className="p-3 bg-blue-600 rounded-xl text-white hover:scale-110 transition-transform" title={t(lang, 'edit')}><Edit2 size={20}/></button>
                                                <button onClick={() => handleExportDXF(unit)} className="p-3 bg-emerald-600 rounded-xl text-white hover:scale-110 transition-transform" title={t(lang, 'downloadDxf')}><Download size={20}/></button>
                                                <button onClick={() => onDeleteUnit(unit.id)} className="p-3 bg-red-600 rounded-xl text-white hover:scale-110 transition-transform" title={t(lang, 'deleteUnit')}><Trash2 size={20}/></button>
                                            </div>
                                        </div>
                                        <div className="p-5 print:p-3">
                                            <div className="flex justify-between items-start mb-3">
                                              <div className="flex flex-col min-w-0 flex-1">
                                                <h3 className="font-bold text-white text-sm truncate pr-2 print:text-black">{unit.name}</h3>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                  <span className="text-[9px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20 font-bold uppercase tracking-tight print:text-slate-500 print:bg-slate-50 print:border-slate-200">
                                                      {GLASS_TYPES.find(g => g.id === unit.glassType)?.name || unit.glassType}
                                                  </span>
                                                </div>
                                              </div>
                                              <span className="text-emerald-400 font-mono font-bold text-sm print:text-emerald-700 shrink-0">
                                                  ${(stats.cost * (unit.quantity || 1)).toLocaleString()}
                                              </span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="bg-slate-900/50 p-2 rounded-xl border border-white/5 print:bg-slate-50 print:border-slate-200">
                                                    <label className="block text-[8px] text-slate-500 mb-0.5 uppercase font-bold tracking-widest print:text-slate-400">{t(lang, 'width')}</label>
                                                    <div className="text-white font-mono font-bold text-xs print:text-black">{unit.width} mm</div>
                                                </div>
                                                <div className="bg-slate-900/50 p-2 rounded-xl border border-white/5 print:bg-slate-50 print:border-slate-200">
                                                    <label className="block text-[8px] text-slate-500 mb-0.5 uppercase font-bold tracking-widest print:text-slate-400">{t(lang, 'height')}</label>
                                                    <div className="text-white font-mono font-bold text-xs print:text-black">{unit.height} mm</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {activeTab === 'quote' && (
                <div className="animate-in slide-in-from-right-4 duration-300">
                    <div className="bg-white text-black p-12 print:p-2 rounded-[2rem] print:rounded-none shadow-2xl print:shadow-none min-h-[1000px] print:min-h-0 flex flex-col border border-slate-200 print:border-none">
                        {/* Header */}
                        <div className="flex justify-between items-start border-b-2 border-slate-100 pb-10 mb-10">
                            <div>
                                <h1 className="text-4xl font-black text-slate-900 mb-2 uppercase tracking-tight">{t(lang, 'printQuote')}</h1>
                                <p className="text-slate-500 font-bold uppercase tracking-widest text-xs flex items-center gap-2">
                                    <Globe size={14} className="text-blue-600" /> ALUMETRIC Engineering Suite • {project.date}
                                </p>
                            </div>
                            <div className="text-right">
                                <div className="text-slate-400 text-[10px] font-black uppercase mb-1">{t(lang, 'clientName')}</div>
                                <div className="text-xl font-black text-slate-800">{project.client}</div>
                                <div className="text-slate-500 text-sm mt-1">{project.name}</div>
                            </div>
                        </div>

                        {/* Cover Letter */}
                        <div className="mb-12">
                            <div className="flex items-center justify-between mb-4 print:hidden">
                                <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <FileCheck size={16} className="text-blue-600" /> {t(lang, 'coverLetter')}
                                </h2>
                                <button 
                                    onClick={handleGeneratePitch}
                                    disabled={isGeneratingPitch}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-500 transition-all shadow-lg"
                                >
                                    {isGeneratingPitch ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
                                    {t(lang, 'draftGemini')}
                                </button>
                            </div>
                            <textarea 
                                value={project.quoteText || ''}
                                onChange={e => onUpdateProject({...project, quoteText: e.target.value})}
                                placeholder={t(lang, 'draftPlaceholder')}
                                className="w-full border-none focus:ring-0 p-0 text-slate-700 leading-relaxed min-h-[400px] resize-none text-base italic print:hidden"
                            />
                            <div className="hidden print:block text-slate-700 leading-relaxed text-base italic whitespace-pre-wrap">
                                {project.quoteText || ''}
                            </div>
                        </div>

                        {/* Itemized List */}
                        <div className="flex-1">
                            <table className="w-full border-collapse mb-10">
                                <thead>
                                    <tr className="border-b-2 border-slate-900 bg-slate-50">
                                        <th className="py-4 px-2 print:py-2 text-left text-xs font-black uppercase tracking-widest text-slate-500">POS</th>
                                        <th className="py-4 px-2 print:py-2 text-left text-xs font-black uppercase tracking-widest text-slate-500">{t(lang, 'technicalDrawing')}</th>
                                        <th className="py-4 px-2 print:py-2 text-left text-xs font-black uppercase tracking-widest text-slate-500">{t(lang, 'details')}</th>
                                        <th className="py-4 px-2 print:py-2 text-center text-xs font-black uppercase tracking-widest text-slate-500">{t(lang, 'quantity')}</th>
                                        <th className="py-4 px-2 print:py-2 text-right text-xs font-black uppercase tracking-widest text-slate-500">{t(lang, 'unitPrice')}</th>
                                        <th className="py-4 px-2 print:py-2 text-right text-xs font-black uppercase tracking-widest text-slate-500">{t(lang, 'totalPrice')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {project.units.map((unit, idx) => {
                                        const stats = getUnitStats(unit);
                                        const sys = systems.find(s => s.id === unit.system);

                                        return (
                                            <tr key={unit.id} className="border-b border-slate-100 group print:break-inside-avoid">
                                                <td className="py-8 px-2 print:py-3 print:px-1 align-top font-black text-slate-400">#{(idx + 1).toString().padStart(2, '0')}</td>
                                                <td className="py-8 px-2 print:py-3 print:px-1 align-top w-48 print:w-32">
                                                    <div className="w-40 h-40 print:w-28 print:h-28 bg-slate-50 rounded-xl border border-slate-200 p-2 print:p-1 flex items-center justify-center">
                                                       <svg 
                                                         viewBox={`0 0 ${unit.width} ${unit.height}`} 
                                                         className="w-full h-full max-h-full max-w-full"
                                                         preserveAspectRatio="xMidYMid meet"
                                                       >
                                                         <Visualizer node={unit.rootNode} width={unit.width} height={unit.height} system={sys || systems[0]} selectedNodeId={null} onSelectNode={() => {}} theme="light" shape={unit.shape} archHeight={unit.archHeight} />
                                                       </svg>
                                                    </div>
                                                </td>
                                                <td className="py-8 px-2 print:py-3 print:px-1 align-top">
                                                    <div className="font-black text-slate-900 text-lg mb-1">{unit.name}</div>
                                                    <div className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-4">{sys?.name}</div>
                                                    <div className="space-y-1 mb-4">
                                                        <div className="text-xs text-slate-500 flex justify-between w-48 font-medium"><span>{t(lang, 'width')}:</span> <span className="font-bold text-slate-900">{unit.width} mm</span></div>
                                                        <div className="text-xs text-slate-500 flex justify-between w-48 font-medium"><span>{t(lang, 'height')}:</span> <span className="font-bold text-slate-900">{unit.height} mm</span></div>
                                                        <div className="text-xs text-slate-500 flex justify-between w-48 font-medium"><span>{t(lang, 'area')}:</span> <span className="font-bold text-slate-900">{((unit.width * unit.height) / 1000000).toFixed(2)} m²</span></div>
                                                        <div className="text-xs text-slate-500 flex justify-between w-48 font-medium"><span>{t(lang, 'glassType')}:</span> <span className="font-bold text-slate-900">{GLASS_TYPES.find(g => g.id === unit.glassType)?.name || unit.glassType}</span></div>
                                                    </div>
                                                    
                                                    {/* Accessory Listing in Quotation */}
                                                    {stats.selectedAccs.length > 0 && (
                                                        <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 max-w-xl">
                                                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex justify-between">
                                                                <span>{t(lang, 'accessories')}</span>
                                                                <span>{t(lang, 'price')}</span>
                                                            </div>
                                                            <div className="grid grid-cols-1 gap-1.5">
                                                              {stats.selectedAccs.map((acc: any, aIdx: number) => (
                                                                <div key={aIdx} className="text-xs text-slate-600 flex items-center justify-between gap-4">
                                                                    <div className="flex items-start gap-2">
                                                                        <span className="font-bold shrink-0 min-w-[85px] text-slate-500">{t(lang, acc.type)}:</span>
                                                                        <span className="text-slate-800 font-semibold">{acc.name}</span>
                                                                    </div>
                                                                    <div className="text-slate-500 font-mono text-[11px] whitespace-nowrap text-right">
                                                                        <span>
                                                                            {acc.qty.toFixed(1)} {acc.unit === 'meter' ? t(lang, 'unitMeter') : t(lang, 'unitPce')} x ${acc.price.toLocaleString(undefined, { minimumFractionDigits: 2 })} = 
                                                                        </span>
                                                                        <span className="font-bold text-slate-900 ml-1">
                                                                            ${(acc.price * acc.qty).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                              ))}
                                                              <div className="flex justify-between border-t border-dashed border-slate-200 pt-1.5 mt-1 text-[11px] text-slate-500 font-bold">
                                                                  <span>{t(lang, 'accessoryCost')}</span>
                                                                  <span className="text-slate-900">${stats.accCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="py-8 px-2 print:py-3 print:px-1 align-top text-center font-black text-xl print:text-sm text-slate-800">{unit.quantity || 1}</td>
                                                <td className="py-8 px-2 print:py-3 print:px-1 align-top text-right font-black text-lg print:text-sm text-slate-800">${stats.cost.toLocaleString()}</td>
                                                <td className="py-8 px-2 print:py-3 print:px-1 align-top text-right font-black text-xl print:text-sm text-blue-600">${(stats.cost * (unit.quantity || 1)).toLocaleString()}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Summary */}
                        <div className="mt-12 flex flex-col md:flex-row justify-between items-end gap-10">
                            <div className="flex-1 w-full max-w-sm print:hidden">
                                <label className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl cursor-pointer hover:bg-slate-100 transition-all">
                                    <div className={`w-12 h-6 rounded-full relative transition-colors ${project.isExport ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${project.isExport ? 'left-7' : 'left-1'}`} />
                                    </div>
                                    <input 
                                      type="checkbox" 
                                      checked={project.isExport || false} 
                                      onChange={e => onUpdateProject({...project, isExport: e.target.checked})} 
                                      className="hidden" 
                                    />
                                    <div className="flex flex-col">
                                        <span className="text-xs font-black text-slate-800 uppercase tracking-widest">{t(lang, 'isExport')}</span>
                                        <span className="text-[10px] text-slate-500">{project.isExport ? t(lang, 'exportSale') : t(lang, 'domesticSale')}</span>
                                    </div>
                                </label>
                            </div>

                            <div className="w-full md:w-80 space-y-3">
                                <div className="flex justify-between items-center text-slate-500 font-bold uppercase tracking-widest text-[10px]">
                                    <span>{t(lang, 'subTotal')}</span>
                                    <span className="text-base text-slate-800 font-black">${projectTotalStats.subTotal.toLocaleString()}</span>
                                </div>
                                {!project.isExport && (
                                    <div className="flex justify-between items-center text-slate-500 font-bold uppercase tracking-widest text-[10px]">
                                        <span>VAT ({taxRate}%)</span>
                                        <span className="text-base text-slate-800 font-black">${projectTotalStats.vatAmount.toLocaleString()}</span>
                                    </div>
                                )}
                                <div className="flex justify-between items-center pt-4 border-t-2 border-slate-900">
                                    <span className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">{t(lang, 'grandTotal')}</span>
                                    <span className="text-3xl font-black text-slate-900">${projectTotalStats.grandTotal.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="mt-20 pt-10 border-t border-slate-100 flex justify-between">
                             <div className="w-48 text-center border-t border-slate-300 pt-4">
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t(lang, 'approve')}</div>
                                <div className="text-[10px] text-slate-500 font-bold mt-1">{project.client}</div>
                             </div>
                             <div className="w-48 text-center border-t border-slate-300 pt-4">
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t(lang, 'signature')} / {t(lang, 'date')}</div>
                                <div className="text-[10px] text-slate-500 font-bold mt-1">Alumetric Suite</div>
                             </div>
                        </div>
                    </div>

                    <div className="flex justify-center mt-12 print:hidden">
                        <button onClick={() => window.print()} className="flex items-center gap-3 px-10 py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-[1.5rem] font-black text-lg transition-all shadow-2xl shadow-blue-900/40">
                            <Printer size={24} strokeWidth={2.5} /> {t(lang, 'exportPdf')}
                        </button>
                    </div>
                </div>
            )}

            {activeTab === 'production' && (
                <div className="space-y-8 animate-in fade-in">
                    <div className="flex items-center justify-between print:hidden">
                        <div className="flex gap-4 p-1 bg-slate-950 rounded-2xl border border-white/5 w-fit">
                            <button onClick={() => setProductionSubTab('bom')} className={`px-6 py-2 rounded-xl text-xs font-bold transition-all ${productionSubTab === 'bom' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>{t(lang, 'materialSummary')}</button>
                            <button onClick={() => setProductionSubTab('cuts')} className={`px-6 py-2 rounded-xl text-xs font-bold transition-all ${productionSubTab === 'cuts' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>{t(lang, 'cuttingList')}</button>
                            <button onClick={() => setProductionSubTab('glass')} className={`px-6 py-2 rounded-xl text-xs font-bold transition-all ${productionSubTab === 'glass' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>{t(lang, 'glassList')}</button>
                        </div>
                        <button onClick={() => window.print()} className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg border border-white/5">
                            <Printer size={16} /> {t(lang, 'exportPdf')}
                        </button>
                    </div>
                    
                    {productionSubTab === 'bom' && (
                        <div className="space-y-8 animate-in slide-in-from-bottom-4">
                            {/* Aluminum BOM */}
                            <div className="bg-slate-800 rounded-[2rem] border border-slate-700 overflow-hidden shadow-2xl print:bg-white print:border-slate-200 print:rounded-none print:shadow-none">
                                <div className="bg-slate-900/80 p-6 border-b border-slate-700 flex items-center gap-3 print:bg-slate-50 print:border-slate-200">
                                    <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-400 print:hidden">
                                        <Package size={24} />
                                    </div>
                                    <h2 className="text-xl font-bold text-white print:text-black">{t(lang, 'profilesSummary')}</h2>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left border-collapse">
                                        <thead className="text-[11px] text-white uppercase bg-slate-950 border-b border-slate-700 print:bg-slate-100 print:text-slate-700 print:border-slate-300">
                                            <tr>
                                                <th className="px-8 py-4 font-black tracking-widest">{t(lang, 'profileType')}</th>
                                                <th className="px-8 py-4 font-black tracking-widest">{t(lang, 'profileCode')}</th>
                                                <th className="px-8 py-4 text-right font-black tracking-widest">{t(lang, 'totalMeters')}</th>
                                                <th className="px-8 py-4 text-right font-black tracking-widest">{t(lang, 'totalWeight')}</th>
                                                <th className="px-8 py-4 text-center font-black tracking-widest">{t(lang, 'totalBars')} (6m)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-700 print:divide-slate-200">
                                            {optimizationSummary.map((opt, idx) => {
                                                const totalMeters = opt.bars.reduce((acc, bar) => acc + (opt.barLength / 1000), 0);
                                                // Assuming we want a sum of all lengths of this specific code across project
                                                const totalCutLengthM = opt.bars.reduce((acc, bar) => acc + bar.cuts.reduce((sum, cut) => sum + cut, 0), 0) / 1000;
                                                const sys = systems.find(s => s.id === opt.systemId);
                                                const weightPerM = opt.profileLabel.toLowerCase().includes('frame') ? sys?.profileWeights?.frame :
                                                                 opt.profileLabel.toLowerCase().includes('sash') ? sys?.profileWeights?.sash :
                                                                 opt.profileLabel.toLowerCase().includes('mullion') || opt.profileLabel.toLowerCase().includes('transom') ? sys?.profileWeights?.mullion :
                                                                 opt.profileLabel.toLowerCase().includes('bead') ? sys?.profileWeights?.glazingBead : 0;

                                                return (
                                                    <tr key={idx} className="hover:bg-slate-700/30 transition-colors">
                                                        <td className="px-8 py-5">
                                                            <div className="font-bold text-white text-base print:text-black">{t(lang, opt.profileLabel as any) || opt.profileLabel}</div>
                                                            <div className="text-[10px] text-slate-500 font-mono mt-1 uppercase print:text-slate-400">{opt.systemName}</div>
                                                        </td>
                                                        <td className="px-8 py-5">
                                                            <span className="bg-slate-950 px-2 py-1 rounded text-xs font-mono text-emerald-400 border border-white/5 print:bg-slate-50 print:text-emerald-700 print:border-slate-200">{opt.profileCode}</span>
                                                        </td>
                                                        <td className="px-8 py-5 text-right font-mono text-white font-black text-base print:text-black">
                                                            {totalCutLengthM.toFixed(2)} m
                                                        </td>
                                                        <td className="px-8 py-5 text-right font-mono text-slate-300 font-bold text-base print:text-slate-600">
                                                            {(totalCutLengthM * (weightPerM || 0)).toFixed(1)} kg
                                                        </td>
                                                        <td className="px-8 py-5 text-center">
                                                            <span className="bg-blue-500/10 text-blue-400 px-4 py-1 rounded-full font-black text-lg print:bg-blue-50 print:text-blue-700">
                                                                {opt.totalBars}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Accessory BOM */}
                            <div className="bg-slate-800 rounded-[2rem] border border-slate-700 overflow-hidden shadow-2xl print:bg-white print:border-slate-200 print:rounded-none print:shadow-none">
                                <div className="bg-slate-900/80 p-6 border-b border-slate-700 flex items-center gap-3 print:bg-slate-50 print:border-slate-200">
                                    <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-400 print:hidden">
                                        <Wrench size={24} />
                                    </div>
                                    <h2 className="text-xl font-bold text-white print:text-black">{t(lang, 'accessoriesSummary')}</h2>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left border-collapse">
                                        <thead className="text-[11px] text-white uppercase bg-slate-950 border-b border-slate-700 print:bg-slate-100 print:text-slate-700 print:border-slate-300">
                                            <tr>
                                                <th className="px-8 py-4 font-black tracking-widest">{t(lang, 'accessoryName')}</th>
                                                <th className="px-8 py-4 font-black tracking-widest">{t(lang, 'type')}</th>
                                                <th className="px-8 py-4 text-center font-black tracking-widest">{t(lang, 'totalQty')}</th>
                                                <th className="px-8 py-4 text-right font-black tracking-widest">{t(lang, 'unitPrice')}</th>
                                                <th className="px-8 py-4 text-right font-black tracking-widest">{t(lang, 'totalPrice')}</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-700 print:divide-slate-200">
                                            {accessorySummary.map((acc, idx) => {
                                                const match = accessories.find(a => a.id === acc.id);
                                                const unitPrice = match?.price || 0;
                                                const totalAccCost = unitPrice * acc.quantity;

                                                return (
                                                    <tr key={idx} className="hover:bg-slate-700/30 transition-colors">
                                                        <td className="px-8 py-5">
                                                            <div className="font-bold text-white text-base print:text-black">{acc.name}</div>
                                                        </td>
                                                        <td className="px-8 py-5">
                                                            <span className="text-xs text-slate-500 uppercase font-black tracking-widest print:text-slate-400">{t(lang, acc.type as any)}</span>
                                                        </td>
                                                        <td className="px-8 py-5 text-center">
                                                            <div className="flex flex-col items-center">
                                                                <span className="bg-emerald-500/10 text-emerald-400 px-4 py-1 rounded-full font-black text-lg print:bg-emerald-50 print:text-emerald-700">
                                                                    {acc.unit === 'pce' ? acc.quantity : acc.quantity.toFixed(1)}
                                                                </span>
                                                                <span className="text-[9px] text-slate-500 font-bold uppercase mt-1 print:text-slate-400">{t(lang, acc.unit === 'pce' ? 'unitPce' : 'unitMeter')}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-8 py-5 text-right font-mono font-bold text-slate-300 print:text-slate-700">
                                                            ${unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </td>
                                                        <td className="px-8 py-5 text-right font-mono font-black text-blue-400 print:text-blue-700">
                                                            ${totalAccCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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

                    {productionSubTab === 'cuts' && (
                        <div className="space-y-12">
                            <CuttingList units={project.units} systems={systems} lang={lang} />
                            <OptimizationReport units={project.units} systems={systems} lang={lang} />
                        </div>
                    )}

                    {productionSubTab === 'glass' && (
                        <div className="bg-slate-800 rounded-[2rem] border border-slate-700 overflow-hidden shadow-2xl animate-in slide-in-from-bottom-4 print:bg-white print:border-slate-200 print:rounded-none print:shadow-none">
                            <div className="bg-slate-900/80 p-6 border-b border-slate-700 flex justify-between items-center print:bg-slate-50 print:border-slate-200">
                                <div className="flex items-center gap-3">
                                    <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-400 print:hidden">
                                        <ImageIcon size={24} />
                                    </div>
                                    <h2 className="text-xl font-bold text-white print:text-black">{t(lang, 'glassOrder')}</h2>
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left border-collapse">
                                    <thead className="text-[11px] text-white uppercase bg-slate-950 border-b border-slate-700 print:bg-slate-100 print:text-slate-700 print:border-slate-300">
                                        <tr>
                                            <th className="px-8 py-4 font-black tracking-widest">{t(lang, 'glassType')}</th>
                                            <th className="px-8 py-4 text-right font-black tracking-widest">{t(lang, 'netSize')} (W x H)</th>
                                            <th className="px-8 py-4 text-center font-black tracking-widest">{t(lang, 'quantity')}</th>
                                            <th className="px-8 py-4 text-right font-black tracking-widest">{t(lang, 'area')} (m²)</th>
                                            <th className="px-8 py-4 text-right font-black tracking-widest">{t(lang, 'weight')} (kg)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-700 print:divide-slate-200">
                                        {glassOrders.map((pane, idx) => (
                                            <tr key={idx} className="hover:bg-slate-700/30 transition-colors">
                                                <td className="px-8 py-5">
                                                    <div className="font-bold text-white text-base print:text-black">{pane.type}</div>
                                                    <div className="text-[10px] text-slate-500 font-mono mt-1 uppercase print:text-slate-400">{pane.unitName}</div>
                                                </td>
                                                <td className="px-8 py-5 text-right font-mono text-white font-black text-base print:text-black">
                                                    {pane.width} x {pane.height}
                                                </td>
                                                <td className="px-8 py-5 text-center">
                                                    <span className="bg-blue-500/10 text-blue-400 px-4 py-1 rounded-full font-black text-lg print:bg-blue-50 print:text-blue-700">
                                                        {pane.quantity}
                                                    </span>
                                                </td>
                                                <td className="px-8 py-5 text-right font-mono text-emerald-400 font-bold text-base print:text-emerald-700">
                                                    {(pane.area * pane.quantity).toFixed(3)}
                                                </td>
                                                <td className="px-8 py-5 text-right font-mono text-slate-300 font-bold text-base print:text-slate-600">
                                                    {(pane.weight * pane.quantity).toFixed(1)} kg
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}
            
            {activeTab === 'cnc' && (
                <div className="bg-slate-800 border border-slate-700 rounded-[2rem] p-10 flex flex-col items-center text-center animate-in zoom-in-95 min-h-[400px] justify-center">
                    <Cpu size={48} className="text-emerald-500 mb-6" />
                    <h2 className="text-2xl font-bold text-white mb-2">{t(lang, 'cncIntegration')}</h2>
                    <p className="text-slate-400 max-w-md mb-8">Export job files for automated cutting centers.</p>
                    
                    {machines.length > 0 ? (
                        <div className="w-full max-w-sm space-y-6">
                            <div className="space-y-2 text-left">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t(lang, 'selectMachine')}</label>
                                <div className="relative group">
                                    <select 
                                        value={selectedMachineId}
                                        onChange={(e) => setSelectedMachineId(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl py-4 pl-5 pr-12 text-white font-bold appearance-none outline-none focus:border-emerald-500 transition-all cursor-pointer"
                                    >
                                        {machines.map(m => (
                                            <option key={m.id} value={m.id}>{m.name} ({m.brand})</option>
                                        ))}
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 group-hover:text-emerald-400 transition-colors">
                                        <ChevronDown size={20} />
                                    </div>
                                </div>
                            </div>
                            
                            <button 
                                onClick={handleExportCNC} 
                                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-5 rounded-2xl font-bold shadow-2xl shadow-emerald-900/20 flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-[0.98]"
                            >
                                <Download size={22} strokeWidth={2.5} /> {t(lang, 'cncExport')}
                            </button>
                        </div>
                    ) : (
                        <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-2xl max-w-md">
                            <AlertCircle className="text-red-500 mx-auto mb-3" size={32} />
                            <p className="text-red-400 font-bold mb-4">{t(lang, 'noMachinesFound')}</p>
                        </div>
                    )}
                </div>
            )}
        </div>
      </div>

      {isEditingInfo && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-6">Edit Project Info</h2>
            <form onSubmit={handleUpdateInfo} className="space-y-4">
              <input value={tempProject.name} onChange={e => setTempProject({...tempProject, name: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:border-blue-500 outline-none" placeholder="Project Name" />
              <input value={tempProject.client} onChange={e => setTempProject({...tempProject, client: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:border-blue-500 outline-none mt-2" placeholder="Client Name" />
              <button type="submit" className="w-full bg-blue-600 py-3 rounded-xl font-bold text-white hover:bg-blue-500 transition-colors mt-4">Save</button>
              <button type="button" onClick={() => setIsEditingInfo(false)} className="w-full py-3 rounded-xl font-bold text-slate-500 hover:text-slate-300">Cancel</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectView;
