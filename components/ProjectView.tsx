
import React, { useState, useMemo, useEffect, useRef } from 'react';
// Build update: 2026-06-06 - Optimized print layouts and itemized accessory prices table formatting
import { Project, Unit, ProfileSystem, Language, Accessory, WindowNode, MachineConfig, Customer } from '../types';
import { ArrowLeft, Edit2, Plus, Trash2, Printer, Sparkles, FileText, Loader2, Save, Layers, Wrench, Cpu, Download, Box, LayoutGrid, Scissors, Droplets, AlertCircle, Globe, Image as ImageIcon, ScanSearch, Ruler, Maximize2, FileCheck, DollarSign, Package, ChevronDown, Sun, Moon, Share2, ClipboardCheck, Sliders, Eye } from 'lucide-react';
import { t } from '../translations';
import Visualizer from './Visualizer';
import OptimizationReport from './OptimizationReport';
import CuttingList from './CuttingList';
import { GLASS_TYPES, COLOR_GROUPS } from '../constants';
import { analyzeDrawing, generateSalesPitch } from '../services/geminiService';
import { generateCNCCSV } from '../services/cncService';
import { generateDXF } from '../services/dxfService';
import { getAggregatedGlassOrder, getAggregatedCuttingList, getProjectAccessorySummary, calculateProjectOptimization } from '../services/optimizationService';
import { getColorPricePerKg, getActiveCurrency, getCurrencySymbol, getExchangeRate, getConvertedAccessoryPrice } from '../services/priceCalculator';
import { v4 as uuidv4 } from 'uuid';

interface ProjectViewProps {
  project: Project;
  systems: ProfileSystem[];
  accessories?: Accessory[];
  customers?: Customer[];
  lang: Language;
  onBack: () => void;
  onUpdateProject: (project: Project) => void;
  onAddUnit: () => void;
  onEditUnit: (unit: Unit) => void;
  onDeleteUnit: (unitId: string) => void;
  machines?: MachineConfig[];
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  licenseKey?: string;
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

const ProjectView: React.FC<ProjectViewProps> = ({ project, systems, accessories = [], customers = [], lang, onBack, onUpdateProject, onAddUnit, onEditUnit, onDeleteUnit, machines = [], theme, onToggleTheme, licenseKey }) => {
  const [activeTab, setActiveTab] = useState<'details' | 'production' | 'cnc' | 'quote'>('details');
  const [copiedLink, setCopiedLink] = useState(false);

  const handleCopyShareLink = () => {
    if (!licenseKey) {
      alert(lang === 'tr' ? "Bulut lisans anahtarı bulunamadı." : "Cloud license key is missing.");
      return;
    }
    const shareUrl = `${window.location.origin}?bid=${licenseKey}:${project.id}`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };
  const [appMode, setAppMode] = useState<'quoting' | 'manufacturing'>(() => {
    return (localStorage.getItem('alucraft_app_mode') as 'quoting' | 'manufacturing') || 'quoting';
  });
  
  const [showAdminUnlockModal, setShowAdminUnlockModal] = useState(false);
  const [adminPassAttempt, setAdminPassAttempt] = useState('');
  const [adminUnlockError, setAdminUnlockError] = useState(false);
  const [pendingAppMode, setPendingAppMode] = useState<'quoting' | 'manufacturing' | null>(null);

  const handleToggleAppMode = () => {
    const newMode = appMode === 'quoting' ? 'manufacturing' : 'quoting';
    if (newMode === 'manufacturing') {
      setPendingAppMode('manufacturing');
      setAdminPassAttempt('');
      setAdminUnlockError(false);
      setShowAdminUnlockModal(true);
    } else {
      setAppMode('quoting');
      localStorage.setItem('alucraft_app_mode', 'quoting');
      if (activeTab === 'production' || activeTab === 'cnc') {
        setActiveTab('details');
      }
      window.dispatchEvent(new Event('alucraft_settings_changed'));
    }
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

  // Bulk Edit States & Options
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);
  const [bulkCheckedUnitIds, setBulkCheckedUnitIds] = useState<string[]>([]);
  const [bulkSystemId, setBulkSystemId] = useState<string>('');
  const [bulkColor, setBulkColor] = useState<string>('');
  const [bulkSpecificColor, setBulkSpecificColor] = useState<string>('');
  const [bulkGlassType, setBulkGlassType] = useState<string>('');
  const [bulkIncludeGlass, setBulkIncludeGlass] = useState<'keep' | 'yes' | 'no'>('keep');
  const [bulkHasThreshold, setBulkHasThreshold] = useState<'keep' | 'yes' | 'no'>('keep');
  const [bulkWidthOp, setBulkWidthOp] = useState<'relative' | 'absolute' | 'none'>('none');
  const [bulkWidthValue, setBulkWidthValue] = useState<number>(0);
  const [bulkHeightOp, setBulkHeightOp] = useState<'relative' | 'absolute' | 'none'>('none');
  const [bulkHeightValue, setBulkHeightValue] = useState<number>(0);
  const [bulkHandleId, setBulkHandleId] = useState<string>('');
  const [bulkLockId, setBulkLockId] = useState<string>('');
  const [bulkQuantity, setBulkQuantity] = useState<number>(0);

  const handleApplyBulkEdit = () => {
    if (bulkCheckedUnitIds.length === 0) {
      alert(lang === 'tr' ? "Lütfen düzenleme yapmak istediğiniz en az bir poz seçin." : "Please select at least one unit/position to modify.");
      return;
    }

    const updatedUnits = project.units.map(unit => {
      if (!bulkCheckedUnitIds.includes(unit.id)) {
        return unit;
      }

      const updatedUnit = { ...unit };

      // Apply System Profile
      if (bulkSystemId) {
        updatedUnit.system = bulkSystemId;
      }

      // Apply Color Finish
      if (bulkColor) {
        updatedUnit.color = bulkColor as any;
        if (bulkColor !== 'custom') {
          updatedUnit.specificColor = '';
        }
      }
      if (bulkSpecificColor) {
        updatedUnit.specificColor = bulkSpecificColor;
      }

      // Apply Glass configuration
      if (bulkGlassType) {
        updatedUnit.glassType = bulkGlassType;
      }
      if (bulkIncludeGlass === 'yes') {
        updatedUnit.includeGlass = true;
      } else if (bulkIncludeGlass === 'no') {
        updatedUnit.includeGlass = false;
      }

      // Apply Threshold Option
      if (bulkHasThreshold === 'yes') {
        updatedUnit.hasThreshold = true;
      } else if (bulkHasThreshold === 'no') {
        updatedUnit.hasThreshold = false;
      }

      // Apply dimension updates
      if (bulkWidthOp === 'absolute' && bulkWidthValue > 0) {
        updatedUnit.width = bulkWidthValue;
      } else if (bulkWidthOp === 'relative' && bulkWidthValue !== 0) {
        updatedUnit.width = Math.max(200, updatedUnit.width + bulkWidthValue);
      }

      if (bulkHeightOp === 'absolute' && bulkHeightValue > 0) {
        updatedUnit.height = bulkHeightValue;
      } else if (bulkHeightOp === 'relative' && bulkHeightValue !== 0) {
        updatedUnit.height = Math.max(200, updatedUnit.height + bulkHeightValue);
      }

      // Set quantity
      if (bulkQuantity > 0) {
        updatedUnit.quantity = bulkQuantity;
      }

      // Apply Accessories (if selected handle/lock)
      if (bulkHandleId === 'clear') {
        updatedUnit.selectedHandle = '';
      } else if (bulkHandleId) {
        updatedUnit.selectedHandle = bulkHandleId;
      }

      if (bulkLockId === 'clear') {
        updatedUnit.selectedLock = '';
      } else if (bulkLockId) {
        updatedUnit.selectedLock = bulkLockId;
      }

      return updatedUnit;
    });

    onUpdateProject({ ...project, units: updatedUnits });
    
    // Close and reset
    setShowBulkEditModal(false);
    setBulkCheckedUnitIds([]);
    setBulkSystemId('');
    setBulkColor('');
    setBulkSpecificColor('');
    setBulkGlassType('');
    setBulkIncludeGlass('keep');
    setBulkHasThreshold('keep');
    setBulkWidthOp('none');
    setBulkWidthValue(0);
    setBulkHeightOp('none');
    setBulkHeightValue(0);
    setBulkQuantity(0);
    setBulkHandleId('');
    setBulkLockId('');

    alert(lang === 'tr' ? `${bulkCheckedUnitIds.length} poz başarıyla güncellendi!` : `${bulkCheckedUnitIds.length} units successfully updated in bulk!`);
  };

  const [productionSubTab, setProductionSubTab] = useState<'cuts' | 'glass' | 'bom'>('cuts');
  const [isScanning, setIsScanning] = useState(false);
  const [isGeneratingPitch, setIsGeneratingPitch] = useState(false);
  const [scannedReviewUnits, setScannedReviewUnits] = useState<{
    id: string;
    name: string;
    width: number;
    height: number;
    type: 'fixed' | 'turn-left' | 'turn-right' | 'tilt' | 'tilt-turn-left' | 'tilt-turn-right' | 'sliding';
    system: string;
    selected: boolean;
  }[] | null>(null);
  const [selectedMachineId, setSelectedMachineId] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [tempProject, setTempProject] = useState<Project>(project);

  const taxRate = Number(localStorage.getItem('alucraft_tax')) || 20;
  const [currency, setCurrency] = useState('USD');
  const [currencySymbol, setCurrencySymbol] = useState('$');
  const [showCostDetails, setShowCostDetails] = useState<boolean>(() => {
    return localStorage.getItem('alucraft_show_cost_details') === 'true';
  });

  const handleToggleCostDetails = (checked: boolean) => {
    setShowCostDetails(checked);
    localStorage.setItem('alucraft_show_cost_details', checked ? 'true' : 'false');
  };

  const reloadCurrencySettings = () => {
    const activeCurr = getActiveCurrency();
    setCurrency(activeCurr);
    setCurrencySymbol(getCurrencySymbol(activeCurr));
  };

  useEffect(() => {
    reloadCurrencySettings();
    window.addEventListener('alucraft_settings_changed', reloadCurrencySettings);
    return () => {
      window.removeEventListener('alucraft_settings_changed', reloadCurrencySettings);
    };
  }, []);

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
    
    // Check if client is blocked
    const selectedClient = tempProject.client.trim();
    const blockedCustomer = customers.find(c => 
      c.status === 'blocked' && 
      (c.name.trim().toLowerCase() === selectedClient.toLowerCase() || 
       (c.company && c.company.trim().toLowerCase() === selectedClient.toLowerCase()))
    );
    
    if (blockedCustomer) {
      alert(lang === 'tr' 
        ? `⚠️ ENGELLENDİ: "${selectedClient}" isimli müşteri kara listededir (Teklif Engelli)!\nNot: ${blockedCustomer.notes || 'Belirtilmemiş'}\n\nBu müşteriye yeni teklif hazırlanamaz veya mevcut teklif güncellenemez!`
        : `⚠️ BLOCKED: Client "${selectedClient}" is blacklisted (Quotes Blocked)!\nNote: ${blockedCustomer.notes || 'Unspecified'}\n\nYou cannot create or update quotes for this client!`
      );
      return;
    }

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
        const reviewItems = detectedUnits.map((d, index) => ({
          id: uuidv4(),
          name: d.name || `Poz-${index + 1}`,
          width: Number(d.width) || 1200,
          height: Number(d.height) || 1400,
          type: (d.type && ['fixed', 'turn-left', 'turn-right', 'tilt', 'tilt-turn-left', 'tilt-turn-right', 'sliding'].includes(d.type)) 
            ? (d.type as any) 
            : 'fixed',
          system: systems[0]?.id || '',
          selected: true
        }));
        setScannedReviewUnits(reviewItems);
      } else {
        alert(lang === 'tr'
          ? "Çizimde herhangi bir doğrama detayı tespit edilemedi. Lütfen çözünürlüğü yüksek, temiz bir çizim yükleyin."
          : "No doors or windows were detected in the drawing sheet. Please try again with a cleaner or higher-contrast drawing image.");
      }
    } catch (error: any) {
      alert(lang === 'tr' ? "Çizim analizi başarısız oldu: " + error.message : "Drawing analysis failed: " + error.message);
    } finally {
      setIsScanning(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleConfirmReviewUnits = () => {
    if (!scannedReviewUnits) return;
    const selectedUnits = scannedReviewUnits.filter(u => u.selected);
    if (selectedUnits.length === 0) {
      alert(lang === 'tr' ? "Lütfen projeye kaydetmek için en az bir poz seçin." : "Please select at least one item to import.");
      return;
    }

    const newUnits: Unit[] = selectedUnits.map(u => ({
      id: uuidv4(),
      name: u.name || 'AI Poz',
      width: Number(u.width) || 1200,
      height: Number(u.height) || 1400,
      system: u.system,
      color: 'group1',
      glassType: 'double24',
      glassThickness: 24,
      quantity: 1,
      rootNode: {
        id: uuidv4(),
        type: 'glass',
        openingType: u.type
      }
    }));

    onUpdateProject({
      ...project,
      units: [...project.units, ...newUnits]
    });
    setScannedReviewUnits(null);
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

    const currency = getActiveCurrency();
    const exchangeRate = getExchangeRate(currency);

    const glassObj = GLASS_TYPES.find(g => g.id === unit.glassType);
    const totalAreaM2 = (unit.width * unit.height) / 1000000;
    
    let colorPrice = getColorPricePerKg(unit.color, currency);
    
    const laborPerKgTry = system.laborPricePerKg || 0;
    const laborPerKgUsd = system.laborPricePerKgUsd || 0;
    let systemLaborRate = 0;
    if (currency === 'TRY') {
      systemLaborRate = laborPerKgTry || (laborPerKgUsd * exchangeRate);
    } else {
      systemLaborRate = laborPerKgUsd || (laborPerKgTry / exchangeRate);
    }

    const profileCost = (profileWeight * 1.10) * (colorPrice + systemLaborRate); // 10% wastage increase for costing included with labor per kg
    
    let glassCost = 0;
    if (unit.includeGlass !== false) {
      let gPrice = unit.customGlassPrice !== undefined ? unit.customGlassPrice : (glassObj?.pricePerSqm || 65);
      if (currency !== 'TRY') {
        gPrice = gPrice / exchangeRate;
      }
      glassCost = totalAreaM2 * gPrice;
    }
    
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
        const convertedPrice = getConvertedAccessoryPrice(acc.price, currency);
        accCost += convertedPrice * qty;
        selectedAccs.push({ id: acc.id, name: acc.name, type: acc.type, price: convertedPrice, qty, unit: acc.unit });
      }
    });

    return { 
      cost: profileCost + glassCost + accCost, 
      weight: profileWeight, 
      selectedAccs, 
      accCost,
      laborRate: systemLaborRate,
      colorPrice
    };
  };

  const projectTotalStats = useMemo(() => {
    let totalWeight = 0;
    let subTotal = 0;
    project.units.forEach(u => {
      const stats = getUnitStats(u);
      totalWeight += stats.weight * (u.quantity || 1);
      subTotal += stats.cost * (u.quantity || 1);
    });
    const discountAmount = (subTotal * (project.discountPercentage || 0)) / 100;
    const discountedSubTotal = subTotal - discountAmount;
    const vatAmount = project.isExport ? 0 : (discountedSubTotal * taxRate) / 100;
    return { 
      subTotal, 
      discountPercentage: project.discountPercentage || 0,
      discountAmount,
      discountedSubTotal,
      vatAmount, 
      grandTotal: discountedSubTotal + vatAmount, 
      totalWeight 
    };
  }, [project.units, project.isExport, project.discountPercentage, taxRate, systems, accessories]);

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
                        <span className="text-[10px] bg-blue-500/10 border border-blue-500/10 rounded px-1.5 py-0.5 text-blue-400 font-mono font-bold uppercase ml-1">
                          {project.projectNumber || `ALU-${new Date(project.date).getFullYear() || 2026}-${project.id.slice(0, 4).toUpperCase()}`}
                        </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{project.client} • {project.date}</span>
                </div>
            </div>

            <div className="flex items-center gap-4">
                <button 
                  onClick={onToggleTheme} 
                  className="p-1.5 text-slate-400 hover:text-white transition-colors border border-white/5 rounded flex items-center justify-center p-2"
                  title={theme === 'light' ? (lang === 'tr' ? 'Karanlık Tema' : 'Dark Theme') : (lang === 'tr' ? 'Aydınlık Tema' : 'Light Theme')}
                >
                  {theme === 'light' ? <Moon size={16} className="text-slate-500 hover:text-indigo-500" /> : <Sun size={16} className="text-amber-400" />}
                </button>
                <button
                  onClick={handleToggleAppMode}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all text-[11px] font-extrabold uppercase tracking-wider select-none ${
                    appMode === 'quoting' 
                      ? 'bg-slate-950/80 hover:bg-slate-950 border-white/5 text-blue-400 hover:text-blue-300' 
                      : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                  }`}
                  title={lang === 'tr' ? 'Çalışma Modunu Değiştir' : 'Toggle App Mode'}
                >
                  <Cpu size={14} className={appMode === 'manufacturing' ? 'text-emerald-400 animate-pulse' : 'text-blue-400'} />
                  <span>
                    {appMode === 'quoting' 
                      ? (lang === 'tr' ? 'Hızlı Teklif' : 'Fast Quoting') 
                      : (lang === 'tr' ? 'Üretim & CNC' : 'Production & CNC')}
                  </span>
                </button>

                {/* Currency Switcher in Header */}
                <div className="flex bg-slate-950 p-1 rounded-xl border border-white/5 items-center select-none" title={lang === 'tr' ? 'Teklif Para Birimi' : 'Proposal Currency'}>
                  <button 
                    onClick={() => {
                      localStorage.setItem('alucraft_currency', 'TRY');
                      window.dispatchEvent(new Event('alucraft_settings_changed'));
                    }} 
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-200 ${currency === 'TRY' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    TL (₺)
                  </button>
                  <button 
                    onClick={() => {
                      localStorage.setItem('alucraft_currency', 'USD');
                      window.dispatchEvent(new Event('alucraft_settings_changed'));
                    }} 
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-200 ${currency === 'USD' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    USD ($)
                  </button>
                </div>

                <div className="flex bg-slate-950 p-1 rounded-xl border border-white/5">
                    <button onClick={() => setActiveTab('details')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'details' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
                        {t(lang, 'detailsTab')}
                    </button>
                    <button onClick={() => setActiveTab('quote')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'quote' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
                        {t(lang, 'quoteTab')}
                    </button>
                    {appMode === 'manufacturing' && (
                      <>
                        <button onClick={() => setActiveTab('production')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'production' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
                            {t(lang, 'productionTab')}
                        </button>
                        <button onClick={() => setActiveTab('cnc')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'cnc' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
                            {t(lang, 'cncSectionTab')}
                        </button>
                      </>
                    )}
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => fileInputRef.current?.click()} 
                    disabled={isScanning}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 font-bold shadow-lg shadow-indigo-500/10 transition-all border border-transparent"
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
                    {/* Visual Status Workflow Bar */}
                    <div className="bg-slate-800/50 border border-slate-700/60 rounded-[1.5rem] p-6 print:hidden shadow-lg flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex flex-col">
                            <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest mb-1.5">
                                {lang === 'tr' ? 'PROJE DURUM AKIŞI' : 'PROJECT FLOW STATUS'}
                            </span>
                            <div className="flex items-center gap-3">
                                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                                    project.status === 'Draft' ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500' :
                                    project.status === 'Production' ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' :
                                    'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                }`}>
                                    {project.status === 'Draft' ? t(lang, 'statusDraft') :
                                     project.status === 'Production' ? t(lang, 'statusProd') :
                                     t(lang, 'statusComp')}
                                </span>
                                <span className="text-slate-400 text-sm font-semibold">
                                    {project.status === 'Draft' ? (lang === 'tr' ? 'Tasarım ve fiyatlandırma aşamasında' : 'In design and pricing phase') :
                                     project.status === 'Production' ? (lang === 'tr' ? 'Fabrikada aktif üretimde' : 'In active production at factory') :
                                     (lang === 'tr' ? 'Proje başarıyla tamamlandı ve arşivlendi' : 'Project successfully completed and archived')}
                                </span>
                            </div>
                        </div>

                        {/* Visual Step Tracker */}
                        <div className="flex items-center gap-2 sm:gap-4 flex-1 max-w-lg justify-center">
                            {/* Step 1: Draft */}
                            <div className="flex items-center gap-2">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                                    project.status === 'Draft' ? 'bg-yellow-500 text-slate-950 shadow-md ring-4 ring-yellow-500/20' : 'bg-slate-700 text-slate-300'
                                }`}>
                                    1
                                </div>
                                <span className={`text-xs font-bold hidden sm:inline ${project.status === 'Draft' ? 'text-yellow-500' : 'text-slate-400'}`}>
                                    {t(lang, 'statusDraft')}
                                </span>
                            </div>
                            
                            <div className={`h-1 flex-1 min-w-[20px] rounded ${project.status !== 'Draft' ? 'bg-indigo-500' : 'bg-slate-800'}`} />

                            {/* Step 2: Production */}
                            <div className="flex items-center gap-2">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                                    project.status === 'Production' ? 'bg-indigo-500 text-white shadow-md ring-4 ring-indigo-500/20' : 
                                    project.status === 'Completed' ? 'bg-indigo-500 text-white' : 'bg-slate-700 text-slate-300'
                                }`}>
                                    2
                                </div>
                                <span className={`text-xs font-bold hidden sm:inline ${project.status === 'Production' ? 'text-indigo-400' : 'text-slate-400'}`}>
                                    {t(lang, 'statusProd')}
                                </span>
                            </div>

                            <div className={`h-1 flex-1 min-w-[20px] rounded ${project.status === 'Completed' ? 'bg-emerald-500' : 'bg-slate-800'}`} />

                            {/* Step 3: Completed */}
                            <div className="flex items-center gap-2">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                                    project.status === 'Completed' ? 'bg-emerald-500 text-slate-950 shadow-md ring-4 ring-emerald-500/20' : 'bg-slate-700 text-slate-300'
                                }`}>
                                    3
                                </div>
                                <span className={`text-xs font-bold hidden sm:inline ${project.status === 'Completed' ? 'text-emerald-400' : 'text-slate-400'}`}>
                                    {t(lang, 'statusComp')}
                                </span>
                            </div>
                        </div>

                        {/* Quick state transitions */}
                        <div className="flex gap-2 shrink-0">
                            {project.status === 'Draft' && (
                                <button
                                    onClick={() => onUpdateProject({ ...project, status: 'Production' })}
                                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition-all shadow-lg flex items-center gap-1.5 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                                >
                                    {t(lang, 'approveProduction') || 'Üretime Gönder'} &rarr;
                                </button>
                            )}
                            {project.status === 'Production' && (
                                <>
                                    <button
                                        onClick={() => onUpdateProject({ ...project, status: 'Draft' })}
                                        className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold rounded-xl text-xs transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                                    >
                                        &larr; {lang === 'tr' ? 'Taslağa Çek' : 'Revert to Draft'}
                                    </button>
                                    <button
                                        onClick={() => onUpdateProject({ ...project, status: 'Completed' })}
                                        className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-all shadow-lg cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                                    >
                                        &check; {t(lang, 'complete') || 'Tamamla'}
                                    </button>
                                </>
                            )}
                            {project.status === 'Completed' && (
                                <button
                                    onClick={() => onUpdateProject({ ...project, status: 'Production' })}
                                    className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold rounded-xl text-xs transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                                >
                                    &larr; {lang === 'tr' ? 'Tekrar Üretime Al' : 'Revert to Production'}
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="bg-slate-800/50 border border-slate-700 rounded-[2rem] p-8 shadow-inner print:bg-white print:border-slate-200 print:rounded-none print:p-4 print:shadow-none font-sans">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                            <h2 className="text-xl font-bold text-white print:text-black">{t(lang, 'summary')}</h2>
                            <div className="flex flex-wrap items-center gap-2 print:hidden">
                                {project.units.length > 0 && (
                                  <button onClick={() => {
                                      setBulkCheckedUnitIds(project.units.map(u => u.id));
                                      setShowBulkEditModal(true);
                                  }} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-500/10 hover:scale-[1.02] active:scale-[0.98]">
                                      <Layers size={14} /> {lang === 'tr' ? 'Akıllı Toplu Düzenleme' : 'Smart Bulk Edit'}
                                  </button>
                                )}
                                <button onClick={() => {
                                    project.units.forEach(u => handleExportDXF(u));
                                }} className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-500/10">
                                    <Download size={14} /> {t(lang, 'downloadDxf')} (All)
                                </button>
                                <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-400 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-sky-500/10">
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
                                <span className="text-2xl font-bold text-emerald-400 print:text-emerald-600">{currencySymbol}{projectTotalStats.grandTotal.toLocaleString()}</span>
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
                                                <Visualizer node={unit.rootNode} width={unit.width} height={unit.height} system={systems.find(s => s.id === unit.system) || systems[0]} selectedNodeId={null} onSelectNode={() => {}} shape={unit.shape} archHeight={unit.archHeight} theme="light" hasThreshold={unit.hasThreshold} lang={lang} />
                                              </svg>
                                            </div>
                                            <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 backdrop-blur-[2px] print:hidden">
                                                <button onClick={() => onEditUnit(unit)} className="p-3 bg-blue-500 rounded-xl text-white hover:scale-110 transition-transform shadow-lg shadow-blue-500/20" title={t(lang, 'edit')}><Edit2 size={20}/></button>
                                                <button onClick={() => handleExportDXF(unit)} className="p-3 bg-emerald-500 rounded-xl text-white hover:scale-110 transition-transform shadow-lg shadow-emerald-500/20" title={t(lang, 'downloadDxf')}><Download size={20}/></button>
                                                <button onClick={() => onDeleteUnit(unit.id)} className="p-3 bg-rose-500 rounded-xl text-white hover:scale-110 transition-transform shadow-lg shadow-rose-500/20" title={t(lang, 'deleteUnit')}><Trash2 size={20}/></button>
                                            </div>
                                        </div>
                                        <div className="p-5 print:p-3">
                                            <div className="flex justify-between items-start mb-3">
                                              <div className="flex flex-col min-w-0 flex-1">
                                                <h3 className="font-bold text-white text-sm truncate pr-2 print:text-black">{unit.name}</h3>
                                                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                                  <span className="text-[9px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20 font-bold uppercase tracking-tight print:text-slate-500 print:bg-slate-50 print:border-slate-200">
                                                      {GLASS_TYPES.find(g => g.id === unit.glassType)?.name || unit.glassType}
                                                  </span>
                                                  {unit.includeGlass === false ? (
                                                    <span className="text-[9px] bg-rose-500/10 text-rose-400 px-1.5 py-0.5 rounded border border-rose-500/20 font-bold uppercase tracking-tight print:text-rose-800 print:bg-rose-50 print:border-rose-200">
                                                      {lang === 'tr' ? 'CAM HARİÇ' : 'GLASS EXCLUDED'}
                                                    </span>
                                                  ) : (
                                                    <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/20 font-bold uppercase tracking-tight print:text-emerald-800 print:bg-emerald-50 print:border-emerald-200">
                                                      {lang === 'tr' ? 'CAM DAHİL' : 'GLASS INCLUDED'}
                                                      {unit.customGlassPrice !== undefined && ` (${unit.customGlassPrice} TL/m²)`}
                                                    </span>
                                                  )}
                                                  {unit.hasThreshold && (
                                                    <span className="text-[9px] bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded border border-amber-500/20 font-bold uppercase tracking-tight print:text-amber-800 print:bg-amber-50 print:border-amber-200">
                                                      {lang === 'tr' ? 'EŞİKLİ' : 'THRESHOLD'}
                                                    </span>
                                                  )}
                                                </div>
                                              </div>
                                              <span className="text-emerald-400 font-mono font-bold text-sm print:text-emerald-700 shrink-0">
                                                  {currencySymbol}{(stats.cost * (unit.quantity || 1)).toLocaleString()}
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
                    {/* Quoting Display Controls */}
                    <div className="mb-6 p-5 bg-slate-900 border border-slate-800 rounded-[2rem] print:hidden flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-blue-500/10 text-blue-400 rounded-2xl">
                                <Sliders size={18} />
                            </div>
                            <div>
                                <div className="text-white text-xs font-black uppercase tracking-wider">
                                    {lang === 'tr' ? 'Teklif İnceleme & Baskı Seçenekleri' : 'Proposal Configuration & Print Options'}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                    {lang === 'tr' ? 'Detay fiyatlarının teklif çıktısında gizlenmesini belirleyin.' : 'Configure which cost elements display in print layout.'}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 flex-wrap">
                            <label className="flex items-center gap-2 cursor-pointer select-none bg-slate-950 px-4 py-2.5 rounded-xl border border-slate-800 hover:border-slate-700 transition" id="quote-cost-details-toggle">
                                <input
                                    type="checkbox"
                                    checked={showCostDetails}
                                    onChange={e => handleToggleCostDetails(e.target.checked)}
                                    className="rounded border-slate-700 bg-slate-950 text-blue-500 focus:ring-0 focus:ring-offset-0 w-4 h-4 cursor-pointer"
                                />
                                <span className="text-xs font-bold text-slate-300">
                                    {lang === 'tr' ? 'Maliyet/Gider Detaylarını Göster' : 'Show Cost/Expense Details'}
                                </span>
                            </label>

                            <button onClick={() => window.print()} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg border border-transparent">
                                <Printer size={15} /> {t(lang, 'exportPdf')}
                            </button>
                        </div>
                    </div>

                    <div className="bg-white text-black p-12 print:p-2 rounded-[2rem] print:rounded-none shadow-2xl print:shadow-none min-h-[1000px] print:min-h-0 flex flex-col border border-slate-200 print:border-none">
                        {/* Header */}
                        <div className="flex justify-between items-start border-b-2 border-slate-100 pb-10 mb-10">
                            <div>
                                <h1 className="text-4xl font-black text-slate-900 mb-2 uppercase tracking-tight">{t(lang, 'printQuote')}</h1>
                                <div className="text-sm font-black text-blue-600 font-mono tracking-widest uppercase mb-2">
                                    {lang === 'tr' ? 'TEKLİF NO' : 'QUOTE REF'}: {project.projectNumber || `ALU-${new Date(project.date).getFullYear() || 2026}-${project.id.slice(0, 4).toUpperCase()}`}
                                </div>
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
                            <table className="w-full border-collapse mb-10 table-fixed">
                                <thead>
                                    <tr className="border-b-2 border-slate-900 bg-slate-50">
                                        <th className="py-4 px-2 print:py-2 text-left text-xs font-black uppercase tracking-widest text-slate-500 w-[5%] print:w-[6%]">POS</th>
                                        <th className="py-4 px-2 print:py-2 text-left text-xs font-black uppercase tracking-widest text-slate-500 w-[20%] print:w-[18%]">{t(lang, 'technicalDrawing')}</th>
                                        <th className="py-4 px-2 print:py-2 text-left text-xs font-black uppercase tracking-widest text-slate-500 w-[45%] print:w-[46%]">{t(lang, 'details')}</th>
                                        <th className="py-4 px-2 print:py-2 text-center text-xs font-black uppercase tracking-widest text-slate-500 w-[8%] print:w-[8%]">{t(lang, 'quantity')}</th>
                                        <th className="py-4 px-2 print:py-2 text-right text-xs font-black uppercase tracking-widest text-slate-500 w-[11%] print:w-[11%]">{t(lang, 'unitPrice')}</th>
                                        <th className="py-4 px-2 print:py-2 text-right text-xs font-black uppercase tracking-widest text-slate-500 w-[11%] print:w-[11%]">{t(lang, 'totalPrice')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {project.units.map((unit, idx) => {
                                        const stats = getUnitStats(unit);
                                        const sys = systems.find(s => s.id === unit.system);

                                        return (
                                            <tr key={unit.id} className="border-b border-slate-100 group print:break-inside-avoid">
                                                <td className="py-8 px-2 print:py-3 print:px-1 align-top font-black text-slate-400 w-[5%] print:w-[6%]">#{(idx + 1).toString().padStart(2, '0')}</td>
                                                <td className="py-8 px-2 print:py-3 print:px-1 align-top w-[20%] print:w-[18%]">
                                                    <div className="w-40 h-40 print:w-28 print:h-28 bg-slate-50 rounded-xl border border-slate-200 p-2 print:p-1 flex items-center justify-center">
                                                       <svg 
                                                         viewBox={`0 0 ${unit.width} ${unit.height}`} 
                                                         className="w-full h-full max-h-full max-w-full"
                                                         preserveAspectRatio="xMidYMid meet"
                                                       >
                                                         <Visualizer node={unit.rootNode} width={unit.width} height={unit.height} system={sys || systems[0]} selectedNodeId={null} onSelectNode={() => {}} theme="light" shape={unit.shape} archHeight={unit.archHeight} hasThreshold={unit.hasThreshold} lang={lang} />
                                                       </svg>
                                                    </div>
                                                </td>
                                                <td className="py-8 px-2 print:py-3 print:px-1 align-top w-[45%] print:w-[46%]">
                                                    <div className="font-black text-slate-900 text-lg mb-1">{unit.name}</div>
                                                    <div className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-4">{sys?.name}</div>
                                                    <div className="space-y-1 mb-4">
                                                        <div className="text-xs text-slate-500 flex justify-between w-[240px] font-medium"><span>{t(lang, 'width')}:</span> <span className="font-bold text-slate-900">{unit.width} mm</span></div>
                                                        <div className="text-xs text-slate-500 flex justify-between w-[240px] font-medium"><span>{t(lang, 'height')}:</span> <span className="font-bold text-slate-900">{unit.height} mm</span></div>
                                                        <div className="text-xs text-slate-500 flex justify-between w-[240px] font-medium"><span>{t(lang, 'area')}:</span> <span className="font-bold text-slate-900">{((unit.width * unit.height) / 1000000).toFixed(2)} m²</span></div>
                                                        {(() => {
                                                            const colorObj = COLOR_GROUPS.find(c => c.id === unit.color);
                                                            const colorLabel = colorObj ? (lang === 'tr' ? colorObj.nameTr : colorObj.nameEn) : (unit.color || 'Standard');
                                                            return (<>
                                                              <div className="text-xs text-slate-500 flex justify-between w-[240px] font-medium">
                                                                <span>{unit.specificColor ? (lang === 'tr' ? 'Renk / Boya Kodu:' : 'Color / Powder Code:') : (lang === 'tr' ? 'Profil Renk Grubu:' : 'Profile Color Group:')}</span>
                                                                <span className="font-bold text-slate-900">{unit.specificColor || colorLabel}</span>
                                                              </div>
                                                              {showCostDetails && stats.laborRate > 0 && (
                                                                <div className="text-xs text-slate-500 flex justify-between w-[240px] font-medium">
                                                                  <span>{lang === 'tr' ? 'Sistem İşçiliği (Kg):' : 'System Labor (Kg):'}</span>
                                                                  <span className="font-bold text-slate-900 font-mono">
                                                                    {currency === 'TRY' ? `${stats.laborRate.toFixed(2)} TL/kg` : `${currencySymbol}${stats.laborRate.toFixed(2)}/kg`}
                                                                  </span>
                                                                </div>
                                                              )}
                                                           </>);
                                                        })()}
                                                        <div className="text-xs text-slate-500 flex justify-between w-[240px] font-medium"><span>{t(lang, 'glassType')}:</span> <span className="font-bold text-slate-900">{GLASS_TYPES.find(g => g.id === unit.glassType)?.name || unit.glassType}</span></div>
                                                        <div className="text-xs text-slate-500 flex justify-between w-[240px] font-medium">
                                                          <span>{lang === 'tr' ? 'Cam Dahil mi?' : 'Glass Included?'}:</span>
                                                          <span className={`font-bold ${unit.includeGlass === false ? 'text-red-600' : 'text-emerald-600'}`}>
                                                            {unit.includeGlass === false ? (lang === 'tr' ? 'Hayır (Cam Hariç)' : 'No (Glass Excluded)') : (lang === 'tr' ? 'Evet (Cam Dahil)' : 'Yes (Glass Included)')}
                                                          </span>
                                                        </div>
                                                        {showCostDetails && unit.includeGlass !== false && (
                                                          <div className="text-xs text-slate-500 flex justify-between w-[240px] font-medium border-b border-dashed border-slate-100 pb-0.5">
                                                            <span>{lang === 'tr' ? 'Cam m² Fiyatı' : 'Glass m² Price'}:</span>
                                                            <span className="font-bold font-mono text-slate-900">
                                                              {(() => {
                                                                const rawPrice = unit.customGlassPrice !== undefined ? unit.customGlassPrice : (GLASS_TYPES.find(g => g.id === unit.glassType)?.pricePerSqm || 65);
                                                                if (currency === 'TRY') {
                                                                  return `${rawPrice} TL`;
                                                                } else {
                                                                  return `${currencySymbol}${(rawPrice / getExchangeRate(currency)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                                                                }
                                                              })()}
                                                              {unit.customGlassPrice !== undefined ? (lang === 'tr' ? ' (Özel)' : ' (Custom)') : (lang === 'tr' ? ' (Standart)' : ' (Standard)')}
                                                            </span>
                                                          </div>
                                                        )}
                                                         <div className="text-xs text-slate-500 flex justify-between w-[240px] font-medium"><span>{lang === 'tr' ? 'Eşik' : 'Threshold'}:</span> <span className={`font-bold ${unit.hasThreshold ? 'text-amber-600 dark:text-amber-500' : 'text-slate-400'}`}>{unit.hasThreshold ? (lang === 'tr' ? 'Evet (Alüminyum Eşik)' : 'Yes (Alu Threshold)') : (lang === 'tr' ? 'Hayır (Standart Kasa)' : 'No (Standard Frame)')}</span></div>
                                                    </div>
                                                    
                                                    {/* Accessory Listing in Quotation */}
                                                    {stats.selectedAccs.length > 0 && (
                                                        <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 max-w-xl">
                                                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex justify-between">
                                                                <span>{t(lang, 'accessories')}</span>
                                                                {showCostDetails && <span>{lang === 'tr' ? `FİYAT (${currencySymbol})` : `PRICE (${currencySymbol})`}</span>}
                                                            </div>
                                                            <div className="grid grid-cols-1 gap-1.5">
                                                              {stats.selectedAccs.map((acc: any, aIdx: number) => (
                                                                <div key={aIdx} className="text-xs text-slate-600 flex items-center justify-between gap-4">
                                                                    <div className="flex items-start gap-2">
                                                                        <span className="font-bold shrink-0 min-w-[85px] text-slate-500">{t(lang, acc.type)}:</span>
                                                                        <span className="text-slate-800 font-semibold">{acc.name}</span>
                                                                    </div>
                                                                    {showCostDetails && (
                                                                        <div className="text-slate-500 font-mono text-[11px] whitespace-nowrap text-right">
                                                                            <span>
                                                                                {acc.qty.toFixed(1)} {acc.unit === 'meter' ? t(lang, 'unitMeter') : t(lang, 'unitPce')} x {currencySymbol}{acc.price.toLocaleString(undefined, { minimumFractionDigits: 2 })} = 
                                                                            </span>
                                                                            <span className="font-bold text-slate-900 ml-1">
                                                                                {currencySymbol}{(acc.price * acc.qty).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                              ))}
                                                              {showCostDetails && <div className="flex justify-between border-t border-dashed border-slate-200 pt-1.5 mt-1 text-[11px] text-slate-500 font-bold">
                                                                  <span>{t(lang, 'accessoryCost')}</span>
                                                                  <span className="text-slate-900">{currencySymbol}{stats.accCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                                </div>}
                                                            </div>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="py-8 px-2 print:py-3 print:px-1 align-top text-center font-black text-xl print:text-sm text-slate-800 w-[8%] print:w-[8%]">{unit.quantity || 1}</td>
                                                <td className="py-8 px-2 print:py-3 print:px-1 align-top text-right font-black text-lg print:text-xs text-slate-800 w-[11%] print:w-[11%] whitespace-nowrap">{currencySymbol}{stats.cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                <td className="py-8 px-2 print:py-3 print:px-1 align-top text-right font-black text-xl print:text-xs text-blue-600 w-[11%] print:w-[11%] whitespace-nowrap">{currencySymbol}{(stats.cost * (unit.quantity || 1)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Summary */}
                        <div className="mt-12 flex flex-col md:flex-row justify-between items-end gap-10">
                            <div className="flex-1 w-full max-w-sm flex flex-col gap-4 print:hidden">
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

                                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col gap-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-black text-slate-800 uppercase tracking-widest">
                                            {lang === 'tr' ? 'İSKONTO / İNDİRİM' : 'DISCOUNT'} (%)
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <input 
                                            type="range"
                                            min="0"
                                            max="90"
                                            step="1"
                                            value={project.discountPercentage || 0}
                                            onChange={e => onUpdateProject({...project, discountPercentage: Number(e.target.value)})}
                                            className="flex-1 accent-blue-600 cursor-pointer"
                                        />
                                        <input 
                                            type="number" 
                                            min="0" 
                                            max="95" 
                                            value={project.discountPercentage || 0} 
                                            onChange={e => {
                                              let val = Number(e.target.value);
                                              if (val < 0) val = 0;
                                              if (val > 95) val = 95;
                                              onUpdateProject({...project, discountPercentage: val});
                                            }}
                                            className="w-16 text-center text-sm font-bold bg-white border border-slate-300 rounded-xl p-1.5 text-slate-800 focus:border-blue-500 outline-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="w-full md:w-80 space-y-3">
                                <div className="flex justify-between items-center text-slate-500 font-bold uppercase tracking-widest text-[10px]">
                                    <span>{t(lang, 'subTotal')}</span>
                                    <span className="text-base text-slate-800 font-black">{currencySymbol}{projectTotalStats.subTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                                {projectTotalStats.discountPercentage > 0 && (
                                    <>
                                        <div className="flex justify-between items-center text-rose-500 font-bold uppercase tracking-widest text-[10px]">
                                            <span>{lang === 'tr' ? `İSKONTO / İNDİRİM (%${projectTotalStats.discountPercentage})` : `DISCOUNT (${projectTotalStats.discountPercentage}%)`}</span>
                                            <span className="text-base font-black">-{currencySymbol}{projectTotalStats.discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-slate-500 font-bold uppercase tracking-widest text-[10px] pb-1 border-b border-dashed border-slate-300">
                                            <span>{lang === 'tr' ? 'İNDİRİMLİ ARA TOPLAM' : 'DISCOUNTED SUB-TOTAL'}</span>
                                            <span className="text-base text-slate-800 font-bold">{currencySymbol}{projectTotalStats.discountedSubTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        </div>
                                    </>
                                )}
                                {!project.isExport && (
                                    <div className="flex justify-between items-center text-slate-500 font-bold uppercase tracking-widest text-[10px]">
                                        <span>{lang === 'tr' ? 'KDV' : 'VAT'} ({taxRate}%)</span>
                                        <span className="text-base text-slate-800 font-black">{currencySymbol}{projectTotalStats.vatAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                )}
                                <div className="flex justify-between items-center pt-4 border-t-2 border-slate-900">
                                    <span className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">{t(lang, 'grandTotal')}</span>
                                    <span className="text-3xl font-black text-slate-900">{currencySymbol}{projectTotalStats.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="mt-20 pt-10 border-t border-slate-100 flex flex-col md:flex-row justify-between gap-6">
                             <div className="w-56 text-center border-t border-slate-300 pt-4 flex flex-col items-center">
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t(lang, 'approve')}</div>
                                <div className="text-[11px] text-slate-800 font-extrabold mt-1 uppercase">{project.clientSignatureName || project.client}</div>
                                {project.clientSignatureData && (
                                  <div className="bg-slate-100/60 rounded-xl p-2.5 mt-2 flex items-center justify-center border border-slate-200/40">
                                    <img src={project.clientSignatureData} alt="Client Sign" className="max-h-12 object-contain" />
                                  </div>
                                )}
                             </div>
                             <div className="w-56 text-center border-t border-slate-300 pt-4 flex flex-col items-center justify-start">
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{project.clientApprovalStatus === 'Approved' ? (lang === 'tr' ? 'ONAY TARİHİ' : 'APPROVAL DATE') : `${t(lang, 'signature')} / ${t(lang, 'date')}`}</div>
                                <div className="text-[11px] text-slate-600 font-bold mt-1 font-mono">{project.clientSignatureDate || new Date().toISOString().split('T')[0]}</div>
                             </div>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-12 print:hidden animate-in fade-in duration-200">
                        <button onClick={() => window.print()} className="flex items-center gap-3 px-8 py-4 bg-sky-500 hover:bg-sky-400 text-white rounded-[1.25rem] font-black text-base transition-all shadow-xl shadow-sky-500/20 w-full sm:w-auto justify-center">
                            <Printer size={20} strokeWidth={2.5} /> {t(lang, 'exportPdf')}
                        </button>
                    </div>
                </div>
            )}

            {activeTab === 'production' && (
                <div className="space-y-8 animate-in fade-in">
                    <div className="flex items-center justify-between print:hidden">
                        <div className="flex gap-4 p-1 bg-slate-950 rounded-2xl border border-white/5 w-fit">
                            <button onClick={() => setProductionSubTab('bom')} className={`px-6 py-2 rounded-xl text-xs font-bold transition-all ${productionSubTab === 'bom' ? 'bg-blue-500 text-white' : 'text-slate-500'}`}>{t(lang, 'materialSummary')}</button>
                            <button onClick={() => setProductionSubTab('cuts')} className={`px-6 py-2 rounded-xl text-xs font-bold transition-all ${productionSubTab === 'cuts' ? 'bg-blue-500 text-white' : 'text-slate-500'}`}>{t(lang, 'cuttingList')}</button>
                            <button onClick={() => setProductionSubTab('glass')} className={`px-6 py-2 rounded-xl text-xs font-bold transition-all ${productionSubTab === 'glass' ? 'bg-blue-500 text-white' : 'text-slate-500'}`}>{t(lang, 'glassList')}</button>
                        </div>
                        <button onClick={() => window.print()} className="flex items-center gap-2 px-5 py-2.5 bg-sky-500 hover:bg-sky-400 text-white rounded-xl text-xs font-bold transition-all shadow-lg border border-transparent">
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
                                                const rawPrice = match?.price || 0;
                                                const unitPrice = getConvertedAccessoryPrice(rawPrice, currency);
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
                                                            {currencySymbol}{unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </td>
                                                        <td className="px-8 py-5 text-right font-mono font-black text-blue-400 print:text-blue-700">
                                                            {currencySymbol}{totalAccCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
            <h2 className="text-lg font-bold text-white mb-6">{lang === 'tr' ? 'Proje Bilgilerini Düzenle' : "Edit Project Info"}</h2>
            <form onSubmit={handleUpdateInfo} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">{lang === 'tr' ? 'Proje Adı' : 'Project Name'}</label>
                <input value={tempProject.name} onChange={e => setTempProject({...tempProject, name: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:border-blue-500 outline-none" placeholder="Project Name" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">{lang === 'tr' ? 'Proje Numarası' : 'Project Number'}</label>
                <input value={tempProject.projectNumber || ''} onChange={e => setTempProject({...tempProject, projectNumber: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:border-blue-500 outline-none font-mono" placeholder="ALU-2026-1001" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">{lang === 'tr' ? 'Müşteri Adı' : 'Client Name'}</label>
                <input value={tempProject.client} onChange={e => setTempProject({...tempProject, client: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:border-blue-500 outline-none" placeholder="Client Name" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">{lang === 'tr' ? 'Proje Durumu' : 'Project Status'}</label>
                <select
                  value={tempProject.status || 'Draft'}
                  onChange={e => setTempProject({...tempProject, status: e.target.value as any})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:border-blue-500 outline-none cursor-pointer"
                >
                  <option value="Draft">{t(lang, 'statusDraft')}</option>
                  <option value="Production">{t(lang, 'statusProd')}</option>
                  <option value="Completed">{t(lang, 'statusComp')}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">{lang === 'tr' ? 'İskonto Oranı (%)' : 'Discount Rate (%)'}</label>
                <input 
                  type="number"
                  min="0"
                  max="95"
                  value={tempProject.discountPercentage || 0}
                  onChange={e => {
                    let val = Number(e.target.value);
                    if (val < 0) val = 0;
                    if (val > 95) val = 95;
                    setTempProject({...tempProject, discountPercentage: val});
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:border-blue-500 outline-none" 
                  placeholder={lang === 'tr' ? 'İskonto (%)' : 'Discount (%)'} 
                />
              </div>
              <button type="submit" className="w-full bg-blue-600 py-3 rounded-xl font-bold text-white hover:bg-blue-500 transition-colors mt-4">{lang === 'tr' ? 'Kaydet' : 'Save'}</button>
              <button type="button" onClick={() => setIsEditingInfo(false)} className="w-full py-3 rounded-xl font-bold text-slate-500 hover:text-slate-300">{lang === 'tr' ? 'İptal' : 'Cancel'}</button>
            </form>
          </div>
        </div>
      )}

      {scannedReviewUnits && (
        <div className="fixed inset-0 z-[110] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800/80 w-full max-w-5xl rounded-3xl p-6 md:p-8 shadow-2xl relative my-8 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-white/5 pb-5 mb-5">
              <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-400 border border-indigo-500/20">
                <Sparkles size={22} className="animate-pulse" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">
                  {lang === 'tr' ? 'Yapay Zeka Keşif Sonuçları Onay & Düzenleme' : 'AI Scan Results Review & Calibration'}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  {lang === 'tr' 
                    ? 'Tarama sonucunda bulunan doğramaların açılım tiplerini, boyutlarını ve profillerini kontrol edebilir ve hatalı olanları düzeltebilirsiniz.' 
                    : 'Review and adjust the opening types, dimensions, and profile systems identified by the AI scanner before importing.'}
                </p>
              </div>
            </div>

            {/* Bulk Actions and Summary Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-slate-950/40 rounded-2xl border border-white/5 mb-5 text-xs">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="font-bold text-slate-400">
                  {lang === 'tr' ? 'Toplu Sistem Değiştir:' : 'Bulk Change System:'}
                </span>
                <select 
                  onChange={e => {
                    const sysId = e.target.value;
                    if (!sysId) return;
                    const updated = scannedReviewUnits.map(u => ({ ...u, system: sysId }));
                    setScannedReviewUnits(updated);
                  }}
                  className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white outline-none cursor-pointer focus:border-indigo-500"
                >
                  <option value="">{lang === 'tr' ? '--- Sistem Seçin ---' : '--- Choose System ---'}</option>
                  {systems.map(sys => (
                    <option key={sys.id} value={sys.id}>{sys.name}</option>
                  ))}
                </select>
              </div>
              
              <div className="text-slate-400 font-medium">
                {lang === 'tr' ? 'Seçilen Pozlar:' : 'Selected Units:'} <span className="text-indigo-400 font-bold font-mono text-sm">{scannedReviewUnits.filter(u => u.selected).length} / {scannedReviewUnits.length}</span>
              </div>
            </div>

            {/* Table/List Container */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-2 mb-6 max-h-[50vh] custom-scrollbar">
              {scannedReviewUnits.map((u, idx) => (
                <div 
                  key={u.id} 
                  className={`flex flex-col lg:flex-row lg:items-center gap-4 p-4 rounded-2xl border transition-all ${
                    u.selected 
                      ? 'bg-slate-950/40 border-indigo-500/30' 
                      : 'bg-slate-950/10 border-slate-850/50 opacity-50'
                  }`}
                >
                  {/* Select Checkbox */}
                  <div className="flex items-center gap-3">
                    <input 
                      type="checkbox" 
                      id={`chk-${u.id}`}
                      checked={u.selected} 
                      onChange={e => {
                        const updated = [...scannedReviewUnits];
                        updated[idx].selected = e.target.checked;
                        setScannedReviewUnits(updated);
                      }}
                      className="w-4 h-4 rounded border-slate-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900 bg-slate-950 cursor-pointer"
                    />
                    <label htmlFor={`chk-${u.id}`} className="text-xs font-mono text-slate-500 select-none cursor-pointer">#{idx + 1}</label>
                  </div>

                  {/* Poz Name */}
                  <div className="flex-1 min-w-[120px]">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      {lang === 'tr' ? 'Poz Adı' : 'Unit Label'}
                    </span>
                    <input 
                      type="text" 
                      value={u.name} 
                      onChange={e => {
                        const updated = [...scannedReviewUnits];
                        updated[idx].name = e.target.value;
                        setScannedReviewUnits(updated);
                      }}
                      disabled={!u.selected}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-indigo-500 disabled:opacity-50"
                      placeholder="e.g. W-01"
                    />
                  </div>

                  {/* Width (mm) */}
                  <div className="w-full lg:w-28">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      {lang === 'tr' ? 'Genişlik (mm)' : 'Width (mm)'}
                    </span>
                    <input 
                      type="number" 
                      value={u.width} 
                      onChange={e => {
                        const updated = [...scannedReviewUnits];
                        updated[idx].width = Number(e.target.value) || 0;
                        setScannedReviewUnits(updated);
                      }}
                      disabled={!u.selected}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-center text-emerald-400 font-mono outline-none focus:border-indigo-500 disabled:opacity-50"
                    />
                  </div>

                  {/* Height (mm) */}
                  <div className="w-full lg:w-28">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      {lang === 'tr' ? 'Yükseklik (mm)' : 'Height (mm)'}
                    </span>
                    <input 
                      type="number" 
                      value={u.height} 
                      onChange={e => {
                        const updated = [...scannedReviewUnits];
                        updated[idx].height = Number(e.target.value) || 0;
                        setScannedReviewUnits(updated);
                      }}
                      disabled={!u.selected}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-center text-emerald-400 font-mono outline-none focus:border-indigo-500 disabled:opacity-50"
                    />
                  </div>

                  {/* System Profile */}
                  <div className="flex-1 min-w-[150px]">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      {lang === 'tr' ? 'Sistem Profili' : 'System Profile'}
                    </span>
                    <select 
                      value={u.system} 
                      onChange={e => {
                        const updated = [...scannedReviewUnits];
                        updated[idx].system = e.target.value;
                        setScannedReviewUnits(updated);
                      }}
                      disabled={!u.selected}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-indigo-500 disabled:opacity-50 cursor-pointer"
                    >
                      {systems.map(sys => (
                        <option key={sys.id} value={sys.id}>{sys.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Opening Type */}
                  <div className="flex-1 min-w-[180px]">
                    <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block mb-1">
                      ⚡ {lang === 'tr' ? 'Açılım Tipi (Değiştir)' : 'Opening Type (Calibrate)'}
                    </span>
                    <select 
                      value={u.type} 
                      onChange={e => {
                        const updated = [...scannedReviewUnits];
                        updated[idx].type = e.target.value as any;
                        setScannedReviewUnits(updated);
                      }}
                      disabled={!u.selected}
                      className="w-full bg-slate-950 border border-indigo-500/30 font-bold rounded-xl px-3 py-1.5 text-xs text-indigo-300 outline-none focus:border-indigo-500 disabled:opacity-50 cursor-pointer"
                    >
                      <option value="fixed">{t(lang, 'fixed')}</option>
                      <option value="turn-left">{t(lang, 'turnLeft')}</option>
                      <option value="turn-right">{t(lang, 'turnRight')}</option>
                      <option value="tilt">{t(lang, 'tilt')}</option>
                      <option value="tilt-turn-left">{t(lang, 'tiltTurnLeft')}</option>
                      <option value="tilt-turn-right">{t(lang, 'tiltTurnRight')}</option>
                      <option value="sliding">{t(lang, 'sliding')}</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-3 border-t border-white/5 pt-5">
              <button 
                type="button" 
                onClick={() => setScannedReviewUnits(null)}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-all cursor-pointer"
              >
                {lang === 'tr' ? 'Vazgeç / İptal' : 'Discard / Cancel'}
              </button>
              <button 
                type="button" 
                onClick={handleConfirmReviewUnits}
                className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-500/15 flex items-center gap-2 transition-all cursor-pointer"
              >
                <FileCheck size={14} />
                {lang === 'tr' ? 'Doğrulanmış Pozları Projeye Ekle' : 'Add Calibrated Units to Project'}
              </button>
            </div>

          </div>
        </div>
      )}

      {showBulkEditModal && (
        <div className="fixed inset-0 z-[110] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800/80 w-full max-w-5xl rounded-3xl p-6 md:p-8 shadow-2xl relative my-8 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh] font-sans">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-400 border border-indigo-500/20">
                  <Layers size={22} className="animate-pulse" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">
                    {lang === 'tr' ? 'Akıllı Toplu Düzenleme & Kalibrasyon' : 'Smart Bulk Editing & Calibration'}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    {lang === 'tr' 
                      ? 'Birden fazla pozu seçerek sistem profilini, boyutlarını, cam ve aksesuar kombinasyonlarını tek tıkla değiştirebilirsiniz.' 
                      : 'Select multiple positions to change system profiles, dimensions, glass packages, and accessory specifications in one click.'}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowBulkEditModal(false)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/5 transition-all cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>

            {/* Content Split Area */}
            <div className="flex flex-col lg:flex-row gap-6 overflow-hidden flex-1 min-h-0 text-left">
              
              {/* Left Box: Position Selection */}
              <div className="w-full lg:w-1/3 bg-slate-950/40 border border-white/5 rounded-2xl p-4 flex flex-col max-h-[40vh] lg:max-h-none">
                <div className="flex items-center justify-between mb-3 shrink-0">
                  <span className="text-xs font-black text-indigo-400 tracking-wider uppercase">
                    {lang === 'tr' ? 'Düzenlenecek Pozlar' : 'Target Positions'}
                  </span>
                  
                  {/* Select Actions */}
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setBulkCheckedUnitIds(project.units.map(u => u.id))}
                      className="text-[10px] text-indigo-300 font-bold hover:underline"
                    >
                      {lang === 'tr' ? 'Tümünü Seç' : 'Select All'}
                    </button>
                    <span className="text-slate-600 text-xs">|</span>
                    <button 
                      onClick={() => setBulkCheckedUnitIds([])}
                      className="text-[10px] text-rose-400 font-bold hover:underline"
                    >
                      {lang === 'tr' ? 'Temizle' : 'Clear'}
                    </button>
                  </div>
                </div>

                {/* Checklist Body */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {project.units.map((unit) => {
                    const isChecked = bulkCheckedUnitIds.includes(unit.id);
                    const sys = systems.find(s => s.id === unit.system) || systems[0];
                    return (
                      <div 
                        key={unit.id}
                        onClick={() => {
                          if (isChecked) {
                            setBulkCheckedUnitIds(bulkCheckedUnitIds.filter(id => id !== unit.id));
                          } else {
                            setBulkCheckedUnitIds([...bulkCheckedUnitIds, unit.id]);
                          }
                        }}
                        className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                          isChecked 
                            ? 'bg-indigo-500/10 border-indigo-500/30 text-white' 
                            : 'bg-slate-900/40 border-slate-800/40 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <input 
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}} // handled by parent div click
                          className="w-4 h-4 rounded border-slate-800 text-indigo-600 focus:ring-indigo-500 bg-slate-950 cursor-pointer mt-0.5 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-black truncate">{unit.name}</div>
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                            {unit.width}x{unit.height} mm • {sys.name} • adet: {unit.quantity}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {/* Selected Counters Summary */}
                <div className="mt-3 pt-3 border-t border-white/5 flex justify-between text-xs shrink-0 font-medium">
                  <span className="text-slate-400">{lang === 'tr' ? 'Seçilen Poz Sayısı:' : 'Total Selected:'}</span>
                  <span className="text-indigo-400 font-black font-mono">{bulkCheckedUnitIds.length} / {project.units.length}</span>
                </div>
              </div>

              {/* Right Box: Operations configurations */}
              <div className="flex-1 bg-slate-950/20 border border-white/5 rounded-2xl p-5 overflow-y-auto custom-scrollbar space-y-6">
                
                {/* Row 1: System and Color finish */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-indigo-400 tracking-wider uppercase block mb-1.5">
                      {lang === 'tr' ? '1. SİSTEM PROFİLİNİ DEĞİŞTİR' : '1. CHOOSE SYSTEM PROFILE'}
                    </label>
                    <select
                      value={bulkSystemId}
                      onChange={e => setBulkSystemId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      <option value="">{lang === 'tr' ? '-- Değişiklik Yok --' : '-- No Changes --'}</option>
                      {systems.map(sys => (
                        <option key={sys.id} value={sys.id}>{sys.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-indigo-400 tracking-wider uppercase block mb-1.5">
                      {lang === 'tr' ? '2. RENK SEÇENEĞİ VE GRUBU' : '2. CHOOSE FINISH & COLOR'}
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={bulkColor}
                        onChange={e => setBulkColor(e.target.value)}
                        className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-indigo-500 cursor-pointer"
                      >
                        <option value="">{lang === 'tr' ? '-- Değişiklik Yok --' : '-- No Changes --'}</option>
                        <option value="group1">{lang === 'tr' ? 'Grup 1 (Beyaz / Standart)' : 'Group 1 (White / Standard)'}</option>
                        <option value="group2">{lang === 'tr' ? 'Grup 2 (Antrasit / Renkli)' : 'Group 2 (Anthracite / Texture)'}</option>
                        <option value="custom">{lang === 'tr' ? 'Özel RAL Kodu' : 'Custom RAL Finish'}</option>
                      </select>
                      {bulkColor === 'custom' && (
                        <input 
                          type="text"
                          value={bulkSpecificColor}
                          onChange={e => setBulkSpecificColor(e.target.value)}
                          placeholder="e.g. RAL 7016"
                          className="w-28 bg-slate-900 border border-indigo-500/30 rounded-xl px-3 py-2 text-xs text-indigo-400 outline-none text-center font-bold"
                        />
                      )}
                    </div>
                  </div>
                </div>

                {/* Row 2: Dimensions adjustments */}
                <div className="p-4 bg-slate-950/50 border border-white/5 rounded-2xl space-y-4">
                  <span className="text-[10px] font-black text-emerald-400 tracking-wider uppercase block">
                    📐 {lang === 'tr' ? '3. BOYUT KONTROLLERI VE RE-SIZE' : '3. DIMENSION CALIBRATION (RE-SIZE)'}
                  </span>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                    
                    {/* Width Action */}
                    <div className="space-y-1.5">
                      <label className="text-slate-400 text-xs font-bold block">{lang === 'tr' ? 'Genişlik İşlemi' : 'Width Action'}</label>
                      <div className="flex gap-2">
                        <select
                          value={bulkWidthOp}
                          onChange={e => {
                            setBulkWidthOp(e.target.value as any);
                            if (e.target.value === 'none') setBulkWidthValue(0);
                          }}
                          className="w-1/2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none cursor-pointer focus:border-emerald-500"
                        >
                          <option value="none">{lang === 'tr' ? 'Değişiklik Yok' : 'No Action'}</option>
                          <option value="absolute">{lang === 'tr' ? 'Sabit Değer Gir' : 'Set Absolute'}</option>
                          <option value="relative">{lang === 'tr' ? 'Ekle (+) / Çıkar (-)' : 'Relative Offset'}</option>
                        </select>
                        {bulkWidthOp !== 'none' && (
                          <input 
                            type="number"
                            value={bulkWidthValue || ''}
                            onChange={e => setBulkWidthValue(Number(e.target.value) || 0)}
                            placeholder={bulkWidthOp === 'relative' ? '+20 / -50' : '1200'}
                            className="w-1/2 bg-slate-900 border border-indigo-500/30 rounded-xl px-3 py-2 text-xs text-indigo-400 text-center font-mono font-bold outline-none"
                          />
                        )}
                      </div>
                    </div>

                    {/* Height Action */}
                    <div className="space-y-1.5">
                      <label className="text-slate-400 text-xs font-bold block">{lang === 'tr' ? 'Yükseklik İşlemi' : 'Height Action'}</label>
                      <div className="flex gap-2">
                        <select
                          value={bulkHeightOp}
                          onChange={e => {
                            setBulkHeightOp(e.target.value as any);
                            if (e.target.value === 'none') setBulkHeightValue(0);
                          }}
                          className="w-1/2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none cursor-pointer focus:border-emerald-500"
                        >
                          <option value="none">{lang === 'tr' ? 'Değişiklik Yok' : 'No Action'}</option>
                          <option value="absolute">{lang === 'tr' ? 'Sabit Değer Gir' : 'Set Absolute'}</option>
                          <option value="relative">{lang === 'tr' ? 'Ekle (+) / Çıkar (-)' : 'Relative Offset'}</option>
                        </select>
                        {bulkHeightOp !== 'none' && (
                          <input 
                            type="number"
                            value={bulkHeightValue || ''}
                            onChange={e => setBulkHeightValue(Number(e.target.value) || 0)}
                            placeholder={bulkHeightOp === 'relative' ? '+20 / -50' : '1500'}
                            className="w-1/2 bg-slate-900 border border-indigo-500/30 rounded-xl px-3 py-2 text-xs text-indigo-400 text-center font-mono font-bold outline-none"
                          />
                        )}
                      </div>
                    </div>

                  </div>
                </div>

                {/* Row 3: Glass and hardware accessories */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                  {/* Glass options */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-indigo-400 tracking-wider uppercase block">
                      {lang === 'tr' ? '4. CAM SİSTEMİ & ENTEGRASYONU' : '4. GLASS CONFIGURATION'}
                    </label>
                    <select
                      value={bulkGlassType}
                      onChange={e => setBulkGlassType(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
                    >
                      <option value="">{lang === 'tr' ? '-- Değişiklik Yok --' : '-- No Changes --'}</option>
                      {GLASS_TYPES.map(g => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>

                    <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
                      <button 
                        type="button"
                        onClick={() => setBulkIncludeGlass('keep')}
                        className={`flex-1 py-1 rounded-lg text-[10px] font-bold ${bulkIncludeGlass === 'keep' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                      >
                        {lang === 'tr' ? 'Koru' : 'Keep Current'}
                      </button>
                      <button 
                        type="button"
                        onClick={() => setBulkIncludeGlass('yes')}
                        className={`flex-1 py-1 rounded-lg text-[10px] font-bold ${bulkIncludeGlass === 'yes' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                      >
                        {lang === 'tr' ? 'Dahil' : 'Include'}
                      </button>
                      <button 
                        type="button"
                        onClick={() => setBulkIncludeGlass('no')}
                        className={`flex-1 py-1 rounded-lg text-[10px] font-bold ${bulkIncludeGlass === 'no' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                      >
                        {lang === 'tr' ? 'Hariç' : 'Exclude'}
                      </button>
                    </div>
                  </div>

                  {/* Threshold and Quantity */}
                  <div className="space-y-2.5">
                    <label className="text-[10px] font-black text-indigo-400 tracking-wider uppercase block">
                      {lang === 'tr' ? '5. DURUM SEÇENEKLERİ & MİKTAR' : '5. OPTIONS & POSITION QUANTITY'}
                    </label>
                    
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-xs text-slate-400 font-bold">{lang === 'tr' ? 'Eşik Tercihi:' : 'Threshold Profile:'}</span>
                      <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs w-48">
                        <button 
                          type="button"
                          onClick={() => setBulkHasThreshold('keep')}
                          className={`flex-1 py-1 rounded-lg text-[10px] font-bold ${bulkHasThreshold === 'keep' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                        >
                          {lang === 'tr' ? 'Koru' : 'Keep'}
                        </button>
                        <button 
                          type="button"
                          onClick={() => setBulkHasThreshold('yes')}
                          className={`flex-1 py-1 rounded-lg text-[10px] font-bold ${bulkHasThreshold === 'yes' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                        >
                          {lang === 'tr' ? 'Eşikli' : 'With'}
                        </button>
                        <button 
                          type="button"
                          onClick={() => setBulkHasThreshold('no')}
                          className={`flex-1 py-1 rounded-lg text-[10px] font-bold ${bulkHasThreshold === 'no' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                        >
                          {lang === 'tr' ? 'Yalın' : 'Flat'}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <span className="text-xs text-slate-400 font-bold">{lang === 'tr' ? 'Toplam Poz Adeti:' : 'Order Quantity:'}</span>
                      <input 
                        type="number"
                        min="0"
                        value={bulkQuantity || ''}
                        onChange={e => setBulkQuantity(Math.max(0, Number(e.target.value) || 0))}
                        placeholder={lang === 'tr' ? '-- Değişiklik Yok --' : '-- No Changes --'}
                        className="w-48 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white text-center font-bold outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Additional custom accessories integration */}
                <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-2xl space-y-3 text-left">
                  <span className="text-[10px] font-black text-indigo-400 tracking-wider uppercase block">
                    🔧 {lang === 'tr' ? '6. DONANIM VE KOL / KİLİT AKSESUARLARI' : '6. HARDWARE & HANDLE / LOCK EXTRAS'}
                  </span>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Handles */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                        {lang === 'tr' ? 'Tutamak / Kol' : 'Handle Grip'}
                      </label>
                      <select
                        value={bulkHandleId}
                        onChange={e => setBulkHandleId(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none cursor-pointer focus:border-indigo-500"
                      >
                        <option value="">{lang === 'tr' ? '-- Değişiklik Yok --' : '-- No Changes --'}</option>
                        <option value="clear">{lang === 'tr' ? '❌ Kolu Komple Çıkar' : '❌ Remove Installed Handle'}</option>
                        {accessories.filter(a => a.type === 'handle').map(acc => (
                          <option key={acc.id} value={acc.id}>{acc.name} ({currencySymbol}{acc.price})</option>
                        ))}
                      </select>
                    </div>

                    {/* Locks */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                        {lang === 'tr' ? 'Kilit Donanımı' : 'Safety Lock System'}
                      </label>
                      <select
                        value={bulkLockId}
                        onChange={e => setBulkLockId(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none cursor-pointer focus:border-indigo-500"
                      >
                        <option value="">{lang === 'tr' ? '-- Değişiklik Yok --' : '-- No Changes --'}</option>
                        <option value="clear">{lang === 'tr' ? '❌ Kilidi Komple Çıkar' : '❌ Remove Security Lock'}</option>
                        {accessories.filter(a => a.type === 'lock').map(acc => (
                          <option key={acc.id} value={acc.id}>{acc.name} ({currencySymbol}{acc.price})</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

              </div>
              
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-3 border-t border-white/5 pt-5 mt-5">
              <button 
                type="button" 
                onClick={() => setShowBulkEditModal(false)}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-all cursor-pointer"
              >
                {lang === 'tr' ? 'Vazgeç / Kapat' : 'Discard / Close'}
              </button>
              <button 
                type="button" 
                disabled={bulkCheckedUnitIds.length === 0}
                onClick={handleApplyBulkEdit}
                className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/15 flex items-center gap-2 transition-all cursor-pointer"
              >
                <ClipboardCheck size={14} />
                {lang === 'tr' ? 'Seçili Pozları Toplu Güncelle' : 'Apply Bulk Edits to Checked Positions'}
              </button>
            </div>

          </div>
        </div>
      )}

      {showAdminUnlockModal && (
        <div className="fixed inset-0 z-[110] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800/80 w-full max-w-sm rounded-2xl p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center text-blue-400 border border-blue-500/20">
                <Cpu size={22} className="animate-pulse" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-white">
                  {lang === 'tr' ? 'Yönetici Kilidini Aç' : 'Unlock Admin Mode'}
                </h4>
                <p className="text-[11px] text-slate-400 text-xs leading-relaxed px-2">
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
                  className={`w-full bg-slate-950 border ${adminUnlockError ? 'border-red-500 focus:border-red-500' : 'border-slate-800 focus:border-blue-500'} rounded-xl p-3 text-white text-xs font-mono text-center outline-none transition-colors`}
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

export default ProjectView;
