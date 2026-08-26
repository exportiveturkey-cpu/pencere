
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
// Build update: 2026-06-06 - Optimized print layouts and itemized accessory prices table formatting
import { Project, Unit, ProfileSystem, Language, Accessory, WindowNode, MachineConfig, Customer, ShadingItem } from '../types';
import { ArrowLeft, Edit2, Plus, Trash2, Printer, Sparkles, FileText, Loader2, Save, Layers, Wrench, Cpu, Download, Box, LayoutGrid, Scissors, Droplets, AlertCircle, Globe, Image as ImageIcon, ScanSearch, Ruler, Maximize2, FileCheck, DollarSign, Package, ChevronDown, Sun, Moon, Share2, ClipboardCheck, Sliders, Eye, Upload, Trash, Wand2, Brain, Palette, MessageSquare, Move, ExternalLink, CheckCircle2, PlusCircle, RefreshCw, Copy } from 'lucide-react';
import { t } from '../translations';
import Visualizer, { getViewBoxWithDimensions } from './Visualizer';
import OptimizationReport from './OptimizationReport';
import CuttingList from './CuttingList';
import { ShadingBOMAndOpt, calculateShadingItemPrice, DEFAULT_CONFIG } from './ShadingBOMAndOpt';
import { GLASS_TYPES, COLOR_GROUPS, PROFILE_SYSTEMS } from '../constants';
import { analyzeDrawing, generateSalesPitch, analyzeShadingImage, ShadingAnalysisResult } from '../services/geminiService';
import { generateCNCCSV } from '../services/cncService';
import { generateDXF } from '../services/dxfService';
import { getAggregatedGlassOrder, getAggregatedCuttingList, getProjectAccessorySummary, calculateProjectOptimization } from '../services/optimizationService';
import { getColorPricePerKg, getActiveCurrency, getCurrencySymbol, getExchangeRate, getConvertedAccessoryPrice, getUnitSashLaborCounts } from '../services/priceCalculator';
import { v4 as uuidv4 } from 'uuid';
import { cloud_saveProductTypes, cloud_getProductTypes } from '../services/authService';
import { PlanKesitSVG, BoyKesitSVG } from './LogikalSections';

const sortQuadrilateralPoints = (pts: any) => pts;
const getPerspectiveTransform = (src: any, dst: any) => "matrix(1, 0, 0, 1, 0, 0)";

export const getSystemForUnit = (unit: { system?: string; selectedFrameProfile?: string }, systems: ProfileSystem[]): ProfileSystem => {
  if (!systems || systems.length === 0) {
    return PROFILE_SYSTEMS[0];
  }
  const uSys = (unit.system || '').trim();
  if (uSys) {
    const sysLower = uSys.toLowerCase();
    // 1. Exact ID
    let found = systems.find(s => s.id === uSys) || systems.find(s => s.id.toLowerCase() === sysLower);
    if (found) return found;

    // 2. Exact Name
    found = systems.find(s => s.name === uSys) || systems.find(s => s.name.toLowerCase() === sysLower);
    if (found) return found;
  }

  // 3. Infer from selectedFrameProfile
  if (unit.selectedFrameProfile) {
    const code = unit.selectedFrameProfile.toUpperCase();
    if (code.startsWith('70T')) {
      const found70T = systems.find(s => s.id === 'kurt-70t-th' || s.id.includes('70t') || s.name.toUpperCase().includes('70T'));
      if (found70T) return found70T;
    }
    if (code.startsWith('51LS') || code.startsWith('51LM') || code.startsWith('58T')) {
      const found51LS = systems.find(s => s.id === 'kurt-51ls' || s.id.includes('51ls') || s.name.toUpperCase().includes('51LS'));
      if (found51LS) return found51LS;
    }
  }

  // 4. Substring / Keyword match
  if (uSys) {
    const sysLower = uSys.toLowerCase();
    const found = systems.find(s => s.name.toLowerCase().includes(sysLower) || sysLower.includes(s.name.toLowerCase()) ||
                          s.id.toLowerCase().includes(sysLower) || sysLower.includes(s.id.toLowerCase()));
    if (found) return found;
  }

  return systems[0] || PROFILE_SYSTEMS[0];
};

const hasOpenablePanes = (node: WindowNode | undefined): boolean => {
  if (!node) return false;
  if (node.type === 'sash' || (node.openingType && node.openingType !== 'fixed')) return true;
  if (node.children) {
    return node.children.some(child => hasOpenablePanes(child));
  }
  return false;
};

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

const getCustomProfileImage = (code: string, customImages: Record<string, string>) => {
  if (!code || !customImages) return '';
  
  // 1. Direct match
  if (customImages[code]) return customImages[code];

  const clean = (s: string) => s.trim().toLowerCase().replace(/-00$/, '').replace(/[^a-z0-9]/g, '').replace(/70th/, '70t');
  const target = clean(code);

  // 2. Exact match with normalized keys
  for (const [key, val] of Object.entries(customImages)) {
    if (clean(key) === target) {
      return val;
    }
  }

  // 3. Prefix/suffix fuzzy match
  for (const [key, val] of Object.entries(customImages)) {
    const kClean = clean(key);
    if (kClean && target && (kClean.startsWith(target) || target.startsWith(kClean))) {
      return val;
    }
  }

  return '';
};

const ProfileThumbnail: React.FC<{ profileLabel: string; profileCode: string; customImages: Record<string, string> }> = ({ profileLabel, profileCode, customImages }) => {
  const [imageFailed, setImageFailed] = useState(false);
  const customSrc = getCustomProfileImage(profileCode, customImages);
  const src = customSrc || `/profiles/${profileCode}.png`;
  
  if (!imageFailed && src) {
    return (
      <img
        src={src}
        alt={profileCode}
        onError={() => setImageFailed(true)}
        className="w-full h-full object-contain bg-white rounded p-0.5 select-none"
        referrerPolicy="no-referrer"
      />
    );
  }

  const label = (profileLabel || '').toLowerCase();
  
  if (label.includes('kasa') || label.includes('frame') || label.includes('ray') || label.includes('dikme')) {
    return (
      <svg viewBox="0 0 40 40" className="w-10 h-10 text-blue-600 shrink-0" fill="none" stroke="currentColor">
        <path d="M 6 6 L 34 6 L 34 34 L 14 34 L 14 26 L 6 26 Z" stroke="#2563eb" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M 10 10 L 30 10 L 30 20 L 14 20 M 18 26 L 30 26 L 30 30 L 18 30 Z" stroke="#64748b" strokeWidth="0.8" strokeLinejoin="round" opacity="0.8" />
        <rect x="14" y="21" width="16" height="4" fill="#334155" stroke="#475569" strokeWidth="0.5" />
        <path d="M 6 12 L 8 12 L 8 15 L 6 15" stroke="#2563eb" strokeWidth="1" />
        <line x1="6" y1="38" x2="34" y2="38" stroke="#cbd5e1" strokeWidth="0.5" strokeDasharray="1,1" />
      </svg>
    );
  }
  
  if (label.includes('kanat') || label.includes('sash')) {
    return (
      <svg viewBox="0 0 40 40" className="w-10 h-10 text-indigo-600 shrink-0" fill="none" stroke="currentColor">
        <path d="M 12 6 L 28 6 L 28 16 L 34 16 L 34 34 L 18 34 L 18 24 L 12 24 Z" stroke="#4f46e5" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M 16 10 L 24 10 L 24 20 L 18 20 M 22 24 L 30 24 L 30 30 L 22 30 Z" stroke="#64748b" strokeWidth="0.8" strokeLinejoin="round" opacity="0.8" />
        <rect x="18" y="21" width="12" height="3" fill="#334155" stroke="#475569" strokeWidth="0.5" />
        <line x1="12" y1="12" x2="28" y2="12" stroke="#818cf8" strokeWidth="1" strokeDasharray="2,1" />
      </svg>
    );
  }
  
  if (label.includes('orta') || label.includes('mullion') || label.includes('transom') || label.includes('kayıt')) {
    return (
      <svg viewBox="0 0 40 40" className="w-10 h-10 text-emerald-600 shrink-0" fill="none" stroke="currentColor">
        <path d="M 6 12 L 14 12 L 14 6 L 26 6 L 26 12 L 34 12 L 34 22 L 26 22 L 26 34 L 14 34 L 14 22 L 6 22 Z" stroke="#059669" strokeWidth="1.5" strokeLinejoin="round" />
        <rect x="16" y="9" width="8" height="22" stroke="#64748b" strokeWidth="0.8" strokeLinejoin="round" opacity="0.8" />
        <rect x="14" y="15" width="2" height="4" fill="#334155" stroke="#475569" strokeWidth="0.5" />
        <rect x="24" y="15" width="2" height="4" fill="#334155" stroke="#475569" strokeWidth="0.5" />
      </svg>
    );
  }
  
  if (label.includes('çıta') || label.includes('bead') || label.includes('glazing')) {
    return (
      <svg viewBox="0 0 40 40" className="w-10 h-10 text-teal-600 shrink-0" fill="none" stroke="currentColor">
        <path d="M 12 10 L 26 10 A 4 4 0 0 1 30 14 L 30 26 A 2 2 0 0 1 28 28 L 14 28 C 12 28 12 26 12 26 L 12 18 L 16 18 L 16 14 L 12 14 Z" stroke="#0d9488" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M 12 24 L 10 24 L 10 22" stroke="#0d9488" strokeWidth="1" />
        <line x1="15" y1="13" x2="27" y2="25" stroke="#94a3b8" strokeWidth="0.5" opacity="0.4" />
        <line x1="18" y1="13" x2="27" y2="22" stroke="#94a3b8" strokeWidth="0.5" opacity="0.4" />
      </svg>
    );
  }
  
  return (
    <svg viewBox="0 0 40 40" className="w-10 h-10 text-slate-500 shrink-0" fill="none" stroke="currentColor">
      <rect x="8" y="8" width="24" height="24" rx="2" stroke="#475569" strokeWidth="1.5" />
      <rect x="12" y="12" width="16" height="16" rx="1" stroke="#64748b" strokeWidth="0.8" opacity="0.8" />
      <line x1="8" y1="8" x2="12" y2="12" stroke="#94a3b8" strokeWidth="0.5" opacity="0.5" />
      <line x1="32" y1="8" x2="28" y2="12" stroke="#94a3b8" strokeWidth="0.5" opacity="0.5" />
      <line x1="8" y1="32" x2="12" y2="28" stroke="#94a3b8" strokeWidth="0.5" opacity="0.5" />
      <line x1="32" y1="32" x2="28" y2="28" stroke="#94a3b8" strokeWidth="0.5" opacity="0.5" />
    </svg>
  );
};

const getCustomAccessoryImage = (id: string, name: string, customImages: Record<string, string>) => {
  if (!customImages) return '';
  if (id && customImages[id]) return customImages[id];
  if (name && customImages[name]) return customImages[name];
  
  // Try case-insensitive and clean matches for ID or Name
  const clean = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const targetId = id ? clean(id) : '';
  const targetName = name ? clean(name) : '';
  
  for (const [key, val] of Object.entries(customImages)) {
    const kClean = clean(key);
    if (targetId && kClean === targetId) return val;
    if (targetName && kClean === targetName) return val;
  }
  
  // Try containing match
  for (const [key, val] of Object.entries(customImages)) {
    const kClean = clean(key);
    if (kClean && ((targetId && (kClean.includes(targetId) || targetId.includes(kClean))) || 
                   (targetName && (kClean.includes(targetName) || targetName.includes(kClean))))) {
      return val;
    }
  }
  
  return '';
};

const AccessoryThumbnail: React.FC<{ accessoryName: string; accessoryType: string; accessoryId: string; customImages: Record<string, string> }> = ({ accessoryName, accessoryType, accessoryId, customImages }) => {
  const [imageFailed, setImageFailed] = useState(false);
  const src = getCustomAccessoryImage(accessoryId, accessoryName, customImages);
  
  if (!imageFailed && src) {
    return (
      <img
        src={src}
        alt={accessoryName}
        onError={() => setImageFailed(true)}
        className="w-full h-full object-contain bg-white rounded p-0.5 select-none"
        referrerPolicy="no-referrer"
      />
    );
  }

  const name = (accessoryName || '').toLowerCase();
  const type = (accessoryType || '').toLowerCase();
  
  if (name.includes('fitil') || name.includes('gasket') || name.includes('epdm') || name.includes('seal') || type.includes('gasket') || type.includes('fitil')) {
    return (
      <svg viewBox="0 0 40 40" className="w-10 h-10 text-slate-850 shrink-0" fill="none" stroke="currentColor">
        <path d="M 12 12 Q 10 20 18 24 Q 28 20 26 12 Q 22 14 19 12 Q 16 14 12 12 Z" fill="#1e293b" stroke="#0f172a" strokeWidth="1" />
        <path d="M 19 24 L 16 32 L 22 32 Z" fill="#334155" stroke="#0f172a" strokeWidth="1" strokeLinejoin="round" />
        <line x1="15" y1="16" x2="23" y2="16" stroke="#64748b" strokeWidth="0.8" />
      </svg>
    );
  }
  
  if (name.includes('vida') || name.includes('screw') || name.includes('bolt') || name.includes('dübel') || type.includes('screw') || type.includes('vida')) {
    return (
      <svg viewBox="0 0 40 40" className="w-10 h-10 text-zinc-600 shrink-0" fill="none" stroke="currentColor">
        <path d="M 10 10 L 30 10 L 24 16 L 24 30 L 20 34 L 16 30 L 16 16 Z" fill="#94a3b8" stroke="#475569" strokeWidth="1" strokeLinejoin="round" />
        <path d="M 17 10 L 23 10 M 20 7 L 20 13" stroke="#334155" strokeWidth="1.5" />
        <line x1="16" y1="18" x2="24" y2="21" stroke="#334155" strokeWidth="1.2" />
        <line x1="16" y1="22" x2="24" y2="25" stroke="#334155" strokeWidth="1.2" />
        <line x1="16" y1="26" x2="24" y2="29" stroke="#334155" strokeWidth="1.2" />
      </svg>
    );
  }
  
  if (name.includes('köşe') || name.includes('corner') || name.includes('bracket') || name.includes('takoz') || name.includes('cleat') || type.includes('corner') || type.includes('takoz')) {
    return (
      <svg viewBox="0 0 40 40" className="w-10 h-10 text-amber-600 shrink-0" fill="none" stroke="currentColor">
        <path d="M 8 12 L 22 12 L 22 32 L 8 32 Z" fill="#cbd5e1" stroke="#475569" strokeWidth="1" />
        <path d="M 22 12 L 32 18 L 32 32 L 22 32 Z" fill="#94a3b8" stroke="#475569" strokeWidth="1" />
        <circle cx="15" cy="18" r="2.5" fill="#475569" stroke="#1e293b" strokeWidth="0.5" />
        <circle cx="15" cy="26" r="2.5" fill="#475569" stroke="#1e293b" strokeWidth="0.5" />
        <circle cx="27" cy="24" r="2.0" fill="#475569" stroke="#1e293b" strokeWidth="0.5" />
      </svg>
    );
  }
  
  if (name.includes('teker') || name.includes('roller') || name.includes('wheel') || type.includes('roller') || type.includes('teker')) {
    return (
      <svg viewBox="0 0 40 40" className="w-10 h-10 text-sky-600 shrink-0" fill="none" stroke="currentColor">
        <rect x="6" y="10" width="28" height="16" rx="2" fill="#e2e8f0" stroke="#475569" strokeWidth="1" />
        <circle cx="13" cy="26" r="6" fill="#64748b" stroke="#334155" strokeWidth="1" />
        <circle cx="13" cy="26" r="2" fill="#f1f5f9" />
        <circle cx="27" cy="26" r="6" fill="#64748b" stroke="#334155" strokeWidth="1" />
        <circle cx="27" cy="26" r="2" fill="#f1f5f9" />
        <line x1="20" y1="10" x2="20" y2="15" stroke="#475569" strokeWidth="1.5" />
      </svg>
    );
  }
  
  if (name.includes('kol') || name.includes('handle') || name.includes('kilit') || name.includes('lock') || type.includes('handle') || type.includes('kol')) {
    return (
      <svg viewBox="0 0 40 40" className="w-10 h-10 text-orange-600 shrink-0" fill="none" stroke="currentColor">
        <rect x="17" y="6" width="6" height="28" rx="1.5" fill="#94a3b8" stroke="#475569" strokeWidth="1" />
        <circle cx="20" cy="26" r="1.5" fill="#1e293b" />
        <path d="M 19 26 L 21 26 L 21.5 30 L 18.5 30 Z" fill="#1e293b" />
        <path d="M 20 12 C 20 12 30 11 32 13 C 34 15 32 17 26 17 L 20 17 Z" fill="#cbd5e1" stroke="#334155" strokeWidth="1" strokeLinejoin="round" />
      </svg>
    );
  }
  
  if (name.includes('tapa') || name.includes('cap') || name.includes('tahliye') || name.includes('drain') || type.includes('cap') || type.includes('tapa')) {
    return (
      <svg viewBox="0 0 40 40" className="w-10 h-10 text-violet-600 shrink-0" fill="none" stroke="currentColor">
        <rect x="10" y="12" width="20" height="14" rx="3" fill="#334155" stroke="#1e293b" strokeWidth="1" />
        <line x1="14" y1="19" x2="26" y2="19" stroke="#64748b" strokeWidth="1" />
        <path d="M 14 12 L 14 8 L 17 8 L 17 12" stroke="#475569" strokeWidth="1" />
        <path d="M 23 12 L 23 8 L 26 8 L 26 12" stroke="#475569" strokeWidth="1" />
      </svg>
    );
  }
  
  return (
    <svg viewBox="0 0 40 40" className="w-10 h-10 text-slate-400 shrink-0" fill="none" stroke="currentColor">
      <path d="M 20 8 L 32 14 L 20 20 L 8 14 Z" fill="#e2e8f0" stroke="#475569" strokeWidth="1" />
      <path d="M 8 14 L 20 20 L 20 32 L 8 26 Z" fill="#cbd5e1" stroke="#475569" strokeWidth="1" />
      <path d="M 20 20 L 32 14 L 32 26 L 20 32 Z" fill="#94a3b8" stroke="#475569" strokeWidth="1" />
      <path d="M 14 11 L 26 17 L 26 29 L 20 32 L 20 20 L 14 17 Z" fill="#2563eb" fillOpacity="0.15" stroke="#2563eb" strokeWidth="0.5" />
    </svg>
  );
};

const ProjectView: React.FC<ProjectViewProps> = ({ project, systems, accessories = [], customers = [], lang, onBack, onUpdateProject, onAddUnit, onEditUnit, onDeleteUnit, machines = [], theme, onToggleTheme, licenseKey }) => {
  const [activeTab, setActiveTab] = useState<'details' | 'shading' | 'production' | 'cnc' | 'quote'>('details');
  const [copiedLink, setCopiedLink] = useState(false);

  const [customProfileImages, setCustomProfileImages] = useState<Record<string, string>>({});
  const [customAccessoryImages, setCustomAccessoryImages] = useState<Record<string, string>>({});

  const mergedProfileImages = useMemo(() => {
    const merged = { ...customProfileImages };
    if (project?.units) {
      project.units.forEach(unit => {
        if (unit.customProfileImages) {
          Object.assign(merged, unit.customProfileImages);
        }
      });
    }
    return merged;
  }, [customProfileImages, project?.units]);

  useEffect(() => {
    try {
      const savedProfiles = localStorage.getItem('alumetric_custom_profile_images');
      if (savedProfiles) {
        setCustomProfileImages(JSON.parse(savedProfiles));
      }
    } catch (e) {
      console.warn('Error loading custom profile images', e);
    }
    
    try {
      const savedAccessories = localStorage.getItem('alumetric_custom_accessory_images');
      if (savedAccessories) {
        setCustomAccessoryImages(JSON.parse(savedAccessories));
      }
    } catch (e) {
      console.warn('Error loading custom accessory images', e);
    }
  }, []);

  // Merge loaded cloud accessory images into customAccessoryImages state
  useEffect(() => {
    if (!accessories || accessories.length === 0) return;
    setCustomAccessoryImages(prev => {
      let updated = false;
      const nextImages = { ...prev };
      
      accessories.forEach(acc => {
        if (acc.imageUrl && nextImages[acc.id] !== acc.imageUrl) {
          nextImages[acc.id] = acc.imageUrl;
          updated = true;
        }
      });
      
      if (updated) {
        try {
          localStorage.setItem('alumetric_custom_accessory_images', JSON.stringify(nextImages));
        } catch (e) {
          console.warn('Error saving loaded accessory images to localStorage', e);
        }
        return nextImages;
      }
      return prev;
    });
  }, [accessories]);

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

  const shadingConfig = useMemo(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('alumetric_shading_config');
      if (saved) {
        try {
          return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
        } catch (e) {
          return DEFAULT_CONFIG;
        }
      }
    }
    return DEFAULT_CONFIG;
  }, [activeTab]);

  // --- Alumetric Shading AI Visualizer States ---
  const [globalToast, setGlobalToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null);
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    setGlobalToast({ message, type });
  }, []);

  useEffect(() => {
    if (globalToast) {
      const timer = setTimeout(() => {
        setGlobalToast(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [globalToast]);

  const [isDetectingPerspective, setIsDetectingPerspective] = useState(false);

  const handleAutoDraw = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    
    if (!shadingBgImage) {
      showToast(lang === 'tr' ? "Lütfen önce bir cephe görseli yükleyin." : "Please upload a facade image first.", "warning");
      return;
    }

    setIsDetectingPerspective(true);
    setIsAnalyzingShading(true);
    showToast(lang === 'tr' ? "Yapay zekâ cepheyi analiz ediyor ve 3D perspektifi hesaplıyor..." : "AI is analyzing the facade and calculating the 3D perspective...", "info");

    try {
      const res = await analyzeShadingImage(
        shadingBgImage, 
        'image/jpeg', 
        lang, 
        undefined, // no custom user polygon points drawn yet
        selectedShadingProduct, 
        selectedShadingColor, 
        selectedShadingNotes
      );
      
      if (res.suggestedPolygonPoints && res.suggestedPolygonPoints.length >= 4) {
        setPolygonPoints(res.suggestedPolygonPoints);
        setBasePerspectivePoints(res.suggestedPolygonPoints);
        setManualScaleX(1.0);
        setManualScaleY(1.0);
        setManualRotate(0);
        setManualShiftX(0);
        setManualShiftY(0);
        setIsDrawingCompleted(true);
        setAiShadingReport(res);
        showToast(lang === 'tr' ? "Yapay zekâ 3D perspektifi otomatik algıladı ve ürünü yerleştirdi!" : "AI auto-detected 3D perspective and placed the product!", "success");
      } else {
        // Fallback to high-quality default perspective if Gemini couldn't return points
        const defaultPts = [
          { x: 30, y: 45 },
          { x: 70, y: 45 },
          { x: 75, y: 80 },
          { x: 25, y: 80 }
        ];
        setPolygonPoints(defaultPts);
        setBasePerspectivePoints(defaultPts);
        setManualScaleX(1.0);
        setManualScaleY(1.0);
        setManualRotate(0);
        setManualShiftX(0);
        setManualShiftY(0);
        setIsDrawingCompleted(true);
        showToast(lang === 'tr' ? "Örnek montaj alanı otomatik yerleştirildi!" : "Sample installation area automatically placed!", 'success');
      }
    } catch (err: any) {
      console.error("AI perspective detection failed, falling back to manual preset:", err);
      const defaultPts = [
        { x: 30, y: 45 },
        { x: 70, y: 45 },
        { x: 75, y: 80 },
        { x: 25, y: 80 }
      ];
      setPolygonPoints(defaultPts);
      setBasePerspectivePoints(defaultPts);
      setManualScaleX(1.0);
      setManualScaleY(1.0);
      setManualRotate(0);
      setManualShiftX(0);
      setManualShiftY(0);
      setIsDrawingCompleted(true);
      showToast(lang === 'tr' ? "Bağlantı hatası, örnek montaj alanı yerleştirildi." : "Connection failed, sample area placed.", 'success');
    } finally {
      setIsDetectingPerspective(false);
      setIsAnalyzingShading(false);
    }
  };

  const [selectedShadingItemId, setSelectedShadingItemId] = useState<string | null>(null);
  const [shadingSubTab, setShadingSubTab] = useState<'designer' | 'bom_opt'>('designer');
  const [shadingBgImage, setShadingBgImage] = useState<string>(() => {
    const firstWithBg = project.shadingItems?.find(x => x.bgImageUrl)?.bgImageUrl;
    return firstWithBg || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=1200';
  });
  const [isAnalyzingShading, setIsAnalyzingShading] = useState(false);
  const [aiShadingReport, setAiShadingReport] = useState<ShadingAnalysisResult | null>(null);
  const [showAiReportModal, setShowAiReportModal] = useState(false);

  // --- VizyonPergola AI Polygon Drawing & State Integration ---
  const [polygonPoints, setPolygonPoints] = useState<{ x: number; y: number }[]>(() => {
    const firstWithBg = project.shadingItems?.find(x => x.bgImageUrl)?.bgImageUrl;
    if (firstWithBg) return [];
    return [
      { x: 38, y: 48 },
      { x: 80, y: 51 },
      { x: 86, y: 88 },
      { x: 36, y: 82 }
    ];
  });
  const [isDrawingCompleted, setIsDrawingCompleted] = useState<boolean>(() => {
    const firstWithBg = project.shadingItems?.find(x => x.bgImageUrl)?.bgImageUrl;
    return !firstWithBg;
  });
  const [selectedShadingProduct, setSelectedShadingProduct] = useState<string>('bioclimatic-pergola');
  const [selectedShadingColor, setSelectedShadingColor] = useState<string>('RAL 7016 Antrasit Gri');
  const [selectedShadingNotes, setSelectedShadingNotes] = useState<string>('');
  const [shadingLouverAngle, setShadingLouverAngle] = useState<number>(45);
  const [shadingLedOn, setShadingLedOn] = useState<boolean>(true);
  const [shadingExtension, setShadingExtension] = useState<number>(80);
  const [shadingColumnHeight, setShadingColumnHeight] = useState<number>(120);
  const [visualizedImage, setVisualizedImage] = useState<string | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  const boundingBox = useMemo(() => {
    if (polygonPoints.length === 0) {
      return { x: 0, y: 0, w: 0, h: 0 };
    }
    const xs = polygonPoints.map(p => p.x);
    const ys = polygonPoints.map(p => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return {
      x: minX,
      y: minY,
      w: maxX - minX,
      h: maxY - minY
    };
  }, [polygonPoints]);

  // --- Additional states for PergolaViz AI layout style ---
  const [shadingCanvasMode, setShadingCanvasMode] = useState<'design' | 'comparison'>('design');

  // --- ShadeVision External Integration Bridge States ---
  const [shadeVisionUrl, setShadeVisionUrl] = useState('https://shadevision-g-lgelendirme-tasar-mc-s-953554361433.europe-west2.run.app');
  const [shadeVisionQuoteId, setShadeVisionQuoteId] = useState('SV-2026-8941');
  const [isSyncingShadeVision, setIsSyncingShadeVision] = useState(false);
  const [shadeVisionPasteData, setShadeVisionPasteData] = useState('');

  // --- VizyonPergola Manual Placement & Size Adjustments with Perspective Preservation ---
  const [shadingPlacementMode, setShadingPlacementMode] = useState<'draw' | 'manual'>('draw');
  const [basePerspectivePoints, setBasePerspectivePoints] = useState<{ x: number; y: number }[]>(() => {
    const firstWithBg = project.shadingItems?.find(x => x.bgImageUrl)?.bgImageUrl;
    if (firstWithBg) return [];
    return [
      { x: 38, y: 48 },
      { x: 80, y: 51 },
      { x: 86, y: 88 },
      { x: 36, y: 82 }
    ];
  });
  const [manualScaleX, setManualScaleX] = useState<number>(1.0); // 0.1 to 2.0 scaling
  const [manualScaleY, setManualScaleY] = useState<number>(1.0); // 0.1 to 2.0 scaling
  const [manualRotate, setManualRotate] = useState<number>(0);   // -45 to 45 rotation
  const [manualShiftX, setManualShiftX] = useState<number>(0);   // -50 to 50 translation
  const [manualShiftY, setManualShiftY] = useState<number>(0);   // -50 to 50 translation
  const [draggingNodeIndex, setDraggingNodeIndex] = useState<number | null>(null);
  const [isDraggingManualCenter, setIsDraggingManualCenter] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number; points: { x: number; y: number }[] }>({ x: 0, y: 0, points: [] });

  const updatePerspectivePoints = (
    sX: number,
    sY: number,
    rot: number,
    shX: number,
    shY: number,
    basePts = basePerspectivePoints
  ) => {
    if (!basePts || basePts.length < 3) return;
    
    // Compute geometric center of the base perspective coordinates
    const sumX = basePts.reduce((sum, p) => sum + p.x, 0);
    const sumY = basePts.reduce((sum, p) => sum + p.y, 0);
    const cx = sumX / basePts.length;
    const cy = sumY / basePts.length;
    
    const rad = (rot * Math.PI) / 180;
    const cosVal = Math.cos(rad);
    const sinVal = Math.sin(rad);
    
    const newPoints = basePts.map(p => {
      // 1. Center the point relative to cx, cy
      let dx = p.x - cx;
      let dy = p.y - cy;
      
      // 2. Apply scaling
      dx *= sX;
      dy *= sY;
      
      // 3. Apply 2D rotation on the perspective plane
      const rx = dx * cosVal - dy * sinVal;
      const ry = dx * sinVal + dy * cosVal;
      
      // 4. Shift back and apply translations, clamped within image boundaries (0-100)
      return {
        x: Math.max(0, Math.min(100, Math.round((cx + rx + shX) * 10) / 10)),
        y: Math.max(0, Math.min(100, Math.round((cy + ry + shY) * 10) / 10))
      };
    });
    
    setPolygonPoints(newPoints);
    setIsDrawingCompleted(true);
  };

  const handleSetPlacementMode = (mode: 'draw' | 'manual') => {
    setShadingPlacementMode(mode);
    if (mode === 'manual') {
      if (polygonPoints.length < 3) {
        const defaultPts = [
          { x: 30, y: 40 },
          { x: 70, y: 40 },
          { x: 75, y: 75 },
          { x: 25, y: 75 }
        ];
        setPolygonPoints(defaultPts);
        setBasePerspectivePoints(defaultPts);
        setIsDrawingCompleted(true);
      } else {
        setBasePerspectivePoints(polygonPoints);
      }
      setManualScaleX(1.0);
      setManualScaleY(1.0);
      setManualRotate(0);
      setManualShiftX(0);
      setManualShiftY(0);
    } else {
      setPolygonPoints([]);
      setBasePerspectivePoints([]);
      setIsDrawingCompleted(false);
      setVisualizedImage(null);
    }
  };
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isSliding, setIsSliding] = useState(false);
  const sliderContainerRef = useRef<HTMLDivElement>(null);
  const shadingCanvasRef = useRef<HTMLDivElement>(null);
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 640, height: 480 });
  
  useEffect(() => {
    if (activeTab === 'shading') {
      const updateDimensions = () => {
        if (shadingCanvasRef.current) {
          setCanvasDimensions({
            width: shadingCanvasRef.current.clientWidth || 640,
            height: shadingCanvasRef.current.clientHeight || 480
          });
        }
      };
      updateDimensions();
      window.addEventListener('resize', updateDimensions);
      const timer = setTimeout(updateDimensions, 500);
      return () => {
        window.removeEventListener('resize', updateDimensions);
        clearTimeout(timer);
      };
    }
  }, [activeTab, shadingBgImage, isDrawingCompleted]);

  const [isDraggingItem, setIsDraggingItem] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0, itemX: 50, itemY: 50 });

  useEffect(() => {
    if (activeTab === 'shading') {
      const items = project.shadingItems || [];
      if (items.length > 0) {
        if (!selectedShadingItemId || !items.some(x => x.id === selectedShadingItemId)) {
          setSelectedShadingItemId(items[0].id);
        }
      } else {
        const newId = `shading-default-${Date.now()}`;
        const defaultItem: ShadingItem = {
          id: newId,
          productType: 'bioclimatic-pergola',
          name: lang === 'tr' ? 'Standart Bioklimatik Pergole' : 'Standard Bioclimatic Pergola',
          modelStyle: lang === 'tr' ? 'Standart Bioklimatik' : 'Standard Bioclimatic',
          width: 4000,
          height: 2500,
          depth: 3000,
          frontHeight: 2500,
          backHeight: 2500,
          quantity: 1,
          unitPrice: 4500,
          color: 'RAL 7016 Antrasit Gri',
          notes: '',
          overlayX: 50,
          overlayY: 60,
          overlayScale: 100,
          overlayRotate: 0,
        };
        onUpdateProject({
          ...project,
          shadingItems: [defaultItem]
        });
        setSelectedShadingItemId(newId);
      }
    }
  }, [activeTab]);

  // --- ShadeVision HTML5 postMessage Listener for Real-time Data Sync ---
  const [lastMessageReceived, setLastMessageReceived] = useState<any>(null);

  useEffect(() => {
    const handlePostMessage = (event: MessageEvent) => {
      // Check for ShadeVision origins (including staging or custom runs)
      const isTrustedOrigin = 
        event.origin.includes('shadevision') || 
        event.origin.includes('run.app') || 
        event.origin.includes('localhost') || 
        event.origin.includes('127.0.0.1');

      if (isTrustedOrigin && event.data && typeof event.data === 'object') {
        const { type, payload } = event.data;
        if (type === 'ALUMETRIC_ADD_SHADING' || type === 'ADD_SHADING_ITEM' || type === 'sv_add_to_quote') {
          if (payload) {
            const newItem: ShadingItem = {
              id: `sv-msg-${Date.now()}`,
              productType: payload.productType || 'bioclimatic-pergola',
              name: payload.name || (lang === 'tr' ? 'ShadeVision Entegre Sistem' : 'ShadeVision Integrated System'),
              width: Number(payload.width) || 4000,
              height: Number(payload.height) || 2500,
              depth: Number(payload.depth) || 3000,
              quantity: Number(payload.quantity) || 1,
              unitPrice: Number(payload.unitPrice) || 4500,
              color: payload.color || 'RAL 7016 Antrasit Gri',
              notes: payload.notes || (lang === 'tr' ? 'ShadeVision 3D Tasarımcıdan anlık veri köprüsüyle aktarıldı.' : 'Transferred via ShadeVision live data bridge.'),
              imageUrl: payload.imageUrl || payload.productImageUrl || payload.image || payload.img || payload.picture || payload.photo || '',
              overlayX: 50,
              overlayY: 50,
              overlayScale: 100,
              overlayRotate: 0
            };
            
            // Add the item to Alumetric quote list
            const currentItems = project.shadingItems || [];
            onUpdateProject({
              ...project,
              shadingItems: [...currentItems, newItem]
            });
            
            setLastMessageReceived(newItem);
            showToast(
              lang === 'tr' 
                ? `Anlık Entegrasyon: "${newItem.name}" başarıyla teklife eklendi!` 
                : `Live Sync: "${newItem.name}" successfully added to Alumetric quotation!`, 
              'success'
            );
          }
        }
      }
    };

    window.addEventListener('message', handlePostMessage);
    return () => window.removeEventListener('message', handlePostMessage);
  }, [lang, project, onUpdateProject]);

  // --- AI Smart Mount Perspective States & Functions ---

  const triggerAiSmartMount = (item: ShadingItem, pctX: number, pctY: number) => {
    // Instant Perspective simulation calculations
    // 1. Scale relative to height (Y coordinate): higher up (smaller Y) means further back -> smaller scale.
    const calculatedScale = Math.min(160, Math.max(30, Math.round(45 + (pctY * 1.05))));
    
    // 2. Camera lens rotation distortion (vanishing point skewing)
    let calculatedRotate = 0;
    if (pctX < 40) {
      // Left side -> tilt clockwise
      calculatedRotate = Math.round((40 - pctX) * 0.18);
    } else if (pctX > 60) {
      // Right side -> tilt counter-clockwise
      calculatedRotate = Math.round((60 - pctX) * 0.18);
    }
    
    // Update item with new perspective coords instantly with zero artificial delay
    handleUpdateShadingItem({
      ...item,
      overlayX: pctX,
      overlayY: pctY,
      overlayScale: calculatedScale,
      overlayRotate: calculatedRotate
    });
  };

  const triggerPresetZoneMount = (zone: 'left' | 'center' | 'right' | 'balcony' | 'canopy') => {
    const activeItem = (project.shadingItems || []).find(x => x.id === selectedShadingItemId);
    if (!activeItem) return;

    let targetX = 50;
    let targetY = 50;
    switch (zone) {
      case 'left':
        targetX = 25;
        targetY = 60;
        break;
      case 'center':
        targetX = 50;
        targetY = 75;
        break;
      case 'right':
        targetX = 75;
        targetY = 65;
        break;
      case 'balcony':
        targetX = 52;
        targetY = 38;
        break;
      case 'canopy':
        targetX = 32;
        targetY = 82;
        break;
    }
    triggerAiSmartMount(activeItem, targetX, targetY);
  };

  const handleShadingDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(true);
  };

  const handleShadingDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
  };

  const handleShadingDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);

    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      fileToDataURI(file).then(uri => {
        setShadingBgImage(uri);
        setPolygonPoints([]);
        setBasePerspectivePoints([]);
        setIsDrawingCompleted(false);
        setVisualizedImage(null);
        setManualScaleX(1.0);
        setManualScaleY(1.0);
        setManualRotate(0);
        setManualShiftX(0);
        setManualShiftY(0);
        showToast(
          lang === 'tr' 
            ? "Ev fotoğrafınız başarıyla yüklendi! Sistem yerleşimini ayarlayabilirsiniz." 
            : "Your house photo has been successfully loaded! You can now adjust the system layout.", 
          "success"
        );
      });
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // If we clicked directly on the image or the container or SVG drawing helpers
    const tagName = (e.target as HTMLElement).tagName.toLowerCase();
    if (
      e.target === e.currentTarget || 
      tagName === 'img' || 
      tagName === 'svg' || 
      tagName === 'polyline' || 
      tagName === 'polygon' || 
      tagName === 'circle' || 
      (e.target as HTMLElement).classList.contains('image-overlay-bg')
    ) {
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      const pctX = Math.round((clickX / rect.width) * 1000) / 10;
      const pctY = Math.round((clickY / rect.height) * 1000) / 10;
      
      if (shadingPlacementMode === 'manual') {
        // In manual placement mode, clicking on the canvas instantly relocates and aligns the center of the shading system to the clicked point!
        let basePts = basePerspectivePoints;
        if (!basePts || basePts.length < 3) {
          basePts = [
            { x: 30, y: 40 },
            { x: 70, y: 40 },
            { x: 75, y: 75 },
            { x: 25, y: 75 }
          ];
          setBasePerspectivePoints(basePts);
        }
        
        // Compute center of base points
        const sumX = basePts.reduce((sum, p) => sum + p.x, 0);
        const sumY = basePts.reduce((sum, p) => sum + p.y, 0);
        const cx = sumX / basePts.length;
        const cy = sumY / basePts.length;
        
        // Calculate the translation shift needed to make the center equal to the clicked (pctX, pctY)
        const shX = Math.round((pctX - cx) * 10) / 10;
        const shY = Math.round((pctY - cy) * 10) / 10;
        
        setManualShiftX(shX);
        setManualShiftY(shY);
        updatePerspectivePoints(manualScaleX, manualScaleY, manualRotate, shX, shY, basePts);
        showToast(
          lang === 'tr' 
            ? "Sistem tıkladığınız noktaya hizalandı ve yerleştirildi!" 
            : "System aligned and placed at the clicked point!", 
          "success"
        );
        return;
      }

      if (isDrawingCompleted) {
        // If drawing was completed, let's prevent accidental resets. They can use the "Reset Design" button.
        return;
      }

      // Check if clicking near the first point to close the loop
      if (polygonPoints.length >= 3) {
        const startPoint = polygonPoints[0];
        const dist = Math.sqrt(Math.pow(pctX - startPoint.x, 2) + Math.pow(pctY - startPoint.y, 2));
        if (dist < 4) { // within 4% distance
          setIsDrawingCompleted(true);
          setBasePerspectivePoints(polygonPoints);
          return;
        }
      }

      setPolygonPoints(prev => [...prev, { x: pctX, y: pctY }]);
    }
  };
  
  // Local form for adding/editing a shading system item
  const [showAddShadingModal, setShowAddShadingModal] = useState(false);
  const [shadingFormProduct, setShadingFormProduct] = useState<string>('bioclimatic-pergola');
  const [productTypes, setProductTypes] = useState<{ id: string; nameTr: string; nameEn: string; imageUrl?: string }[]>(() => {
    const defaults = [
      { id: 'bioclimatic-pergola', nameTr: 'Bioklimatik Pergole', nameEn: 'Bioclimatic Pergola', imageUrl: 'https://images.unsplash.com/photo-1615874959474-d609969a20ed?w=600&auto=format&fit=crop' },
      { id: 'rolling-roof', nameTr: 'Rolling Roof / Açılır Tavan', nameEn: 'Rolling Roof System', imageUrl: 'https://images.unsplash.com/photo-1615874959474-d609969a20ed?w=600&auto=format&fit=crop' },
      { id: 'zip-blind', nameTr: 'Zip Perde / Stor', nameEn: 'Zip Blind / Screen', imageUrl: 'https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=600&auto=format&fit=crop' },
      { id: 'awning', nameTr: 'Mafsallı / Kasetli Tente', nameEn: 'Retractable Awning System', imageUrl: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=600&auto=format&fit=crop' },
      { id: 'guillotine', nameTr: 'Giyotin Cam Sistemi', nameEn: 'Motorized Guillotine Glass', imageUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&auto=format&fit=crop' },
      { id: 'glass-balcony', nameTr: 'Katlanır / Sürme Cam Balkon', nameEn: 'Sliding / Folding Glass Balcony', imageUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&auto=format&fit=crop' },
      { id: 'retractable-glass', nameTr: 'Hareketli Cam Tavan', nameEn: 'Retractable Glass Roof', imageUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&auto=format&fit=crop' }
    ];
    try {
      const storedDefaultImages = localStorage.getItem('alumetric_default_product_type_images');
      if (storedDefaultImages) {
        const parsedDefaults = JSON.parse(storedDefaultImages);
        defaults.forEach(d => {
          if (parsedDefaults[d.id] !== undefined) {
            d.imageUrl = parsedDefaults[d.id];
          }
        });
      }

      const stored = localStorage.getItem('alumetric_custom_product_types');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const merged = [...defaults];
          parsed.forEach((custom: any) => {
            if (custom && custom.id && !merged.some(d => d.id === custom.id)) {
              merged.push(custom);
            }
          });
          return merged;
        }
      }
    } catch (e) {
      console.error("Error loading custom product types", e);
    }
    return defaults;
  });

  useEffect(() => {
    if (!licenseKey) return;
    
    const loadCloudProductTypes = async () => {
      try {
        const storedCloud = await cloud_getProductTypes(licenseKey);
        if (storedCloud) {
          const { customProductTypes, defaultProductTypeImages } = storedCloud;
          
          setProductTypes(prev => {
            const defaults = [
              { id: 'bioclimatic-pergola', nameTr: 'Bioklimatik Pergole', nameEn: 'Bioclimatic Pergola', imageUrl: 'https://images.unsplash.com/photo-1615874959474-d609969a20ed?w=600&auto=format&fit=crop' },
              { id: 'rolling-roof', nameTr: 'Rolling Roof / Açılır Tavan', nameEn: 'Rolling Roof System', imageUrl: 'https://images.unsplash.com/photo-1615874959474-d609969a20ed?w=600&auto=format&fit=crop' },
              { id: 'zip-blind', nameTr: 'Zip Perde / Stor', nameEn: 'Zip Blind / Screen', imageUrl: 'https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=600&auto=format&fit=crop' },
              { id: 'awning', nameTr: 'Mafsallı / Kasetli Tente', nameEn: 'Retractable Awning System', imageUrl: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=600&auto=format&fit=crop' },
              { id: 'guillotine', nameTr: 'Giyotin Cam Sistemi', nameEn: 'Motorized Guillotine Glass', imageUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&auto=format&fit=crop' },
              { id: 'glass-balcony', nameTr: 'Katlanır / Sürme Cam Balkon', nameEn: 'Sliding / Folding Glass Balcony', imageUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&auto=format&fit=crop' },
              { id: 'retractable-glass', nameTr: 'Hareketli Cam Tavan', nameEn: 'Retractable Glass Roof', imageUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&auto=format&fit=crop' }
            ];
            
            if (defaultProductTypeImages) {
              defaults.forEach(d => {
                if (defaultProductTypeImages[d.id] !== undefined) {
                  d.imageUrl = defaultProductTypeImages[d.id];
                }
              });
            }
            
            const merged = [...defaults];
            if (Array.isArray(customProductTypes)) {
              customProductTypes.forEach((custom: any) => {
                if (custom && custom.id && !merged.some(d => d.id === custom.id)) {
                  merged.push(custom);
                }
              });
            }
            
            setShadingFormImageUrl(currentUrl => {
              if (!currentUrl) {
                const found = merged.find(t => t.id === shadingFormProduct);
                return found?.imageUrl || '';
              }
              return currentUrl;
            });
            
            return merged;
          });
        }
      } catch (err) {
        console.error("Error loading cloud product types:", err);
      }
    };
    
    loadCloudProductTypes();
  }, [licenseKey]);

  const handleUpdateProductTypeImage = (productTypeId: string, newImageUrl: string) => {
    setProductTypes(prev => {
      const updated = prev.map(pt => pt.id === productTypeId ? { ...pt, imageUrl: newImageUrl } : pt);
      try {
        const customOnly = updated.filter(t => t.id.startsWith('custom-'));
        localStorage.setItem('alumetric_custom_product_types', JSON.stringify(customOnly));
        
        const defaultCustomImages: Record<string, string> = {};
        updated.forEach(pt => {
          if (!pt.id.startsWith('custom-')) {
            defaultCustomImages[pt.id] = pt.imageUrl || '';
          }
        });
        localStorage.setItem('alumetric_default_product_type_images', JSON.stringify(defaultCustomImages));

        if (licenseKey) {
          cloud_saveProductTypes(licenseKey, customOnly, defaultCustomImages).catch(console.error);
        }
      } catch (e) {
        console.error("Error saving customized product type images", e);
      }
      return updated;
    });
  };

  const handleAddCustomProductType = (nameTr: string, nameEn: string, imageUrl?: string) => {
    if (!nameTr.trim()) return '';
    const cleanId = nameTr.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-');
    
    const id = `custom-${cleanId || Date.now()}`;
    const newType = { id, nameTr: nameTr.trim(), nameEn: (nameEn || nameTr).trim(), imageUrl: (imageUrl || '').trim() };
    
    setProductTypes(prev => {
      const updated = [...prev, newType];
      try {
        const customOnly = updated.filter(t => t.id.startsWith('custom-'));
        localStorage.setItem('alumetric_custom_product_types', JSON.stringify(customOnly));

        const defaultCustomImages: Record<string, string> = {};
        updated.forEach(pt => {
          if (!pt.id.startsWith('custom-')) {
            defaultCustomImages[pt.id] = pt.imageUrl || '';
          }
        });

        if (licenseKey) {
          cloud_saveProductTypes(licenseKey, customOnly, defaultCustomImages).catch(console.error);
        }
      } catch (e) {
        console.error(e);
      }
      return updated;
    });

    setShadingFormProduct(id);
    setShadingFormName(nameTr.trim());
    if (imageUrl) {
      setShadingFormImageUrl(imageUrl.trim());
    }
    return id;
  };

  const [shadingFormName, setShadingFormName] = useState(() => lang === 'tr' ? 'Premium Bioklimatik Pergole' : 'Premium Bioclimatic Pergola');
  const [shadingFormWidth, setShadingFormWidth] = useState(4000);
  const [shadingFormHeight, setShadingFormHeight] = useState(2500);
  const [shadingFormDepth, setShadingFormDepth] = useState(3000);
  const [shadingFormFrontHeight, setShadingFormFrontHeight] = useState(2500);
  const [shadingFormBackHeight, setShadingFormBackHeight] = useState(2500);
  const [shadingFormQty, setShadingFormQty] = useState(1);
  const [shadingFormPrice, setShadingFormPrice] = useState(4500);
  const [shadingFormColor, setShadingFormColor] = useState(() => lang === 'tr' ? 'RAL 7016 Antrasit Gri' : 'RAL 7016 Anthracite Grey');
  const [shadingFormNotes, setShadingFormNotes] = useState('');

  // Sync form defaults when active language changes
  useEffect(() => {
    const found = productTypes.find(t => t.id === shadingFormProduct);
    if (found) {
      setShadingFormName(lang === 'tr' ? found.nameTr : found.nameEn);
    }
    setShadingFormColor(lang === 'tr' ? 'RAL 7016 Antrasit Gri' : 'RAL 7016 Anthracite Grey');
  }, [lang]);
  const [shadingFormImageUrl, setShadingFormImageUrl] = useState(() => {
    const found = productTypes.find(t => t.id === 'bioclimatic-pergola');
    return found ? (found.imageUrl || '') : '';
  });
  const [shadingFormPlanSectionUrl, setShadingFormPlanSectionUrl] = useState('');
  const [shadingFormCrossSectionUrl, setShadingFormCrossSectionUrl] = useState('');
  const [shadingFormPlanSectionProfileCode, setShadingFormPlanSectionProfileCode] = useState('');
  const [shadingFormCrossSectionProfileCode, setShadingFormCrossSectionProfileCode] = useState('');
  const [editingShadingItem, setEditingShadingItem] = useState<ShadingItem | null>(null);

  const handleAddShadingItem = (newItem: ShadingItem) => {
    const currentItems = project.shadingItems || [];
    const updatedItems = [...currentItems, newItem];
    onUpdateProject({
      ...project,
      shadingItems: updatedItems
    });
  };

  const handleUpdateShadingItem = (updatedItem: ShadingItem) => {
    const currentItems = project.shadingItems || [];
    const updatedItems = currentItems.map(item => item.id === updatedItem.id ? updatedItem : item);
    onUpdateProject({
      ...project,
      shadingItems: updatedItems
    });
  };

  const handleDeleteShadingItem = (itemId: string) => {
    const currentItems = project.shadingItems || [];
    const updatedItems = currentItems.filter(item => item.id !== itemId);
    if (selectedShadingItemId === itemId) {
      setSelectedShadingItemId(null);
    }
    onUpdateProject({
      ...project,
      shadingItems: updatedItems
    });
  };

  const handleSyncShadeVision = () => {
    setIsSyncingShadeVision(true);
    showToast(
      lang === 'tr' 
        ? 'ShadeVision Bulut Entegratörüne Bağlanılıyor...' 
        : 'Connecting to ShadeVision Cloud API Bridge...', 
      'info'
    );

    setTimeout(() => {
      try {
        let importedItems: ShadingItem[] = [];

        if (shadeVisionPasteData.trim()) {
          // Parse lines from ShadeVision copy-paste
          const lines = shadeVisionPasteData.split('\n');
          lines.forEach((line, idx) => {
            if (!line.trim()) return;
            const lower = line.toLowerCase();
            
            // Detect numbers inside line
            const numbers = line.match(/\d+/g);
            let w = 4000;
            let h = 2500;
            let d = 3000;
            let qty = 1;
            let price = 4500;

            if (numbers && numbers.length >= 2) {
              w = parseInt(numbers[0]) || 4000;
              h = parseInt(numbers[1]) || 2500;
              if (numbers[2]) d = parseInt(numbers[2]) || 3000;
              if (numbers[3]) qty = parseInt(numbers[3]) || 1;
              if (numbers[4]) price = parseInt(numbers[4]) || 4500;
            }

            let productType: any = 'bioclimatic-pergola';
            let name = 'ShadeVision System';

            if (lower.includes('rolling') || lower.includes('roof')) {
              productType = 'rolling-roof';
              name = lang === 'tr' ? 'Alüminyum Rolling Roof' : 'Aluminum Rolling Roof';
            } else if (lower.includes('zip') || lower.includes('perde') || lower.includes('screen') || lower.includes('blind')) {
              productType = 'zip-blind';
              name = lang === 'tr' ? 'Antrasit Rüzgar Dayanıklı Zip Perde' : 'Wind-Resistant Zip Blind';
              d = 0;
            } else if (lower.includes('tente') || lower.includes('awning')) {
              productType = 'awning';
              name = lang === 'tr' ? 'Mafsallı Tente' : 'Folding Awning';
            } else if (lower.includes('giyotin') || lower.includes('guillotine')) {
              productType = 'guillotine';
              name = lang === 'tr' ? 'Giyotin Motorlu Isıcam Cephe' : 'Motorized Guillotine Glass';
              d = 0;
            } else if (lower.includes('balkon') || lower.includes('balcony') || lower.includes('cam')) {
              productType = 'glass-balcony';
              name = lang === 'tr' ? 'Isıcamlı Sürgülü Cam Balkon' : 'Insulated Glass Balcony';
              d = 0;
            } else {
              productType = 'bioclimatic-pergola';
              name = lang === 'tr' ? 'Premium Bioklimatik Pergole' : 'Premium Bioclimatic Pergola';
            }

            // Extract any image URL from the copied line
            const urlRegex = /(https?:\/\/[^\s]+)/gi;
            const urls = line.match(urlRegex);
            let pastedImageUrl = '';
            if (urls && urls.length > 0) {
              const imgUrl = urls.find(u => /\.(jpg|jpeg|png|gif|webp|svg)/i.test(u) || u.includes('image') || u.includes('photo') || u.includes('img') || u.includes('drive') || u.includes('storage'));
              pastedImageUrl = imgUrl || urls[0];
            }

            importedItems.push({
              id: `sv-import-${Date.now()}-${idx}`,
              productType,
              name: `${name} (ShadeVision)`,
              width: w,
              height: h,
              depth: d,
              quantity: qty,
              unitPrice: price,
              color: 'RAL 7016 Antrasit Gri',
              notes: 'ShadeVision 3D Tasarımcıdan otomatik aktarıldı.',
              imageUrl: pastedImageUrl,
              overlayX: 50,
              overlayY: 50,
              overlayScale: 100,
              overlayRotate: 0
            });
          });

          if (importedItems.length === 0) {
            throw new Error(
              lang === 'tr'
                ? "Metinden ürün pozu bulunamadı. Lütfen kopyalanan satırlarda pergola, tente, zip veya cam ifadesinin bulunduğundan emin olun."
                : "No valid product entries detected in the text. Make sure names contain words like pergola, awning, zip, or glass."
            );
          }
        } else {
          // Fetch default mock proposal designed in ShadeVision
          importedItems = [
            {
              id: `sv-api-1-${Date.now()}`,
              productType: 'bioclimatic-pergola',
              name: lang === 'tr' ? 'ShadeVision Premium Bioklimatik Pergole' : 'ShadeVision Premium Bioclimatic Pergola',
              width: 5500,
              height: 2800,
              depth: 3500,
              quantity: 1,
              unitPrice: 4850,
              color: 'RAL 7500 Kömür Gri',
              notes: 'Uzaktan kumandalı Somfy motor, entegre Samsung LED aydınlatmalı gölgelendirme.',
              overlayX: 50,
              overlayY: 50,
              overlayScale: 100,
              overlayRotate: 0
            },
            {
              id: `sv-api-2-${Date.now()}`,
              productType: 'zip-blind',
              name: lang === 'tr' ? 'ShadeVision Somfy Motorlu Zip Perde' : 'ShadeVision Somfy Motorized Zip Blind',
              width: 3500,
              height: 2500,
              depth: 0,
              quantity: 2,
              unitPrice: 820,
              color: 'RAL 7016 Antrasit',
              notes: 'Serge Ferrari Soltis rüzgar dirençli kumaş.',
              overlayX: 50,
              overlayY: 50,
              overlayScale: 100,
              overlayRotate: 0
            }
          ];
        }

        const currentItems = project.shadingItems || [];
        const mergedItems = [...currentItems, ...importedItems];

        onUpdateProject({
          ...project,
          shadingItems: mergedItems
        });

        showToast(
          lang === 'tr'
            ? `Eşitleme Başarılı! ShadeVision'dan (${shadeVisionQuoteId}) ${importedItems.length} adet gölgelendirme tasarımı Alumetric teklif sepetine aktarıldı!`
            : `Sync Successful! Imported ${importedItems.length} shading proposals from ShadeVision (${shadeVisionQuoteId}) into Alumetric.`,
          'success'
        );
        setShadeVisionPasteData('');
      } catch (err: any) {
        showToast(err.message || "Entegrasyon eşitleme hatası.", "error");
      } finally {
        setIsSyncingShadeVision(false);
      }
    }, 1200);
  };

  const handleSaveShadingItem = () => {
    if (editingShadingItem) {
      const updated: ShadingItem = {
        ...editingShadingItem,
        productType: shadingFormProduct,
        name: shadingFormName,
        width: shadingFormWidth,
        height: shadingFormHeight,
        depth: shadingFormDepth,
        frontHeight: shadingFormFrontHeight,
        backHeight: shadingFormBackHeight,
        quantity: shadingFormQty,
        unitPrice: shadingFormPrice,
        color: shadingFormColor,
        notes: shadingFormNotes,
        imageUrl: shadingFormImageUrl,
        planSectionUrl: shadingFormPlanSectionUrl,
        crossSectionUrl: shadingFormCrossSectionUrl,
        planSectionProfileCode: shadingFormPlanSectionProfileCode,
        crossSectionProfileCode: shadingFormCrossSectionProfileCode,
      };
      handleUpdateShadingItem(updated);
    } else {
      const newId = `shading-${Date.now()}`;
      const created: ShadingItem = {
        id: newId,
        productType: shadingFormProduct,
        name: shadingFormName,
        width: shadingFormWidth,
        height: shadingFormHeight,
        depth: shadingFormDepth,
        frontHeight: shadingFormFrontHeight,
        backHeight: shadingFormBackHeight,
        quantity: shadingFormQty,
        unitPrice: shadingFormPrice,
        color: shadingFormColor,
        notes: shadingFormNotes,
        imageUrl: shadingFormImageUrl,
        planSectionUrl: shadingFormPlanSectionUrl,
        crossSectionUrl: shadingFormCrossSectionUrl,
        planSectionProfileCode: shadingFormPlanSectionProfileCode,
        crossSectionProfileCode: shadingFormCrossSectionProfileCode,
        overlayX: 50,
        overlayY: 50,
        overlayScale: 100,
        overlayRotate: 0,
      };
      handleAddShadingItem(created);
      setSelectedShadingItemId(newId);
    }
    setShowAddShadingModal(false);
    setEditingShadingItem(null);
  };

  const handleAnalyzeShading = async () => {
    if (!shadingBgImage) {
      showToast(lang === 'tr' ? "Lütfen önce bir cephe görseli yükleyin." : "Please upload a facade image first.", "warning");
      return;
    }
    
    // Auto-complete the drawing if not completed but has >= 3 points
    if (polygonPoints.length >= 3 && !isDrawingCompleted) {
      setIsDrawingCompleted(true);
      setBasePerspectivePoints(polygonPoints);
    }

    setIsAnalyzingShading(true);
    try {
      const res = await analyzeShadingImage(
        shadingBgImage, 
        'image/jpeg', 
        lang, 
        polygonPoints.length >= 3 ? polygonPoints : undefined, 
        selectedShadingProduct, 
        selectedShadingColor, 
        selectedShadingNotes
      );
      setAiShadingReport(res);
      
      // Auto-load AI-suggested 3D perspective corners
      if (res.suggestedPolygonPoints && res.suggestedPolygonPoints.length >= 4) {
        setPolygonPoints(res.suggestedPolygonPoints);
        setBasePerspectivePoints(res.suggestedPolygonPoints);
        setManualScaleX(1.0);
        setManualScaleY(1.0);
        setManualRotate(0);
        setManualShiftX(0);
        setManualShiftY(0);
        setIsDrawingCompleted(true);
        showToast(lang === 'tr' ? "Yapay zekâ 3D perspektifi otomatik algıladı ve ürünü yerleştirdi!" : "AI auto-detected 3D perspective and placed the product!", "info");
      }
      
      setVisualizedImage('active');
      setShadingCanvasMode('comparison');
      setShowAiReportModal(true);
      showToast(lang === 'tr' ? "Yapay zekâ görselleştirmesi ve tasarımı başarıyla oluşturuldu!" : "AI visualization and design successfully generated!", "success");
    } catch (err: any) {
      showToast(lang === 'tr' ? "Analiz sırasında hata oluştu: " + err.message : "Error during analysis: " + err.message, "error");
    } finally {
      setIsAnalyzingShading(false);
    }
  };

  // Convert uploaded image file into lightweight base64 string
  const fileToDataURI = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  };

  const getShadingProductSrcPoints = (productType: string) => {
    switch (productType) {
      case 'bioclimatic-pergola':
      case 'rolling-roof':
        return [
          { x: 16, y: 42 },   // Top-Left of the gutter/roof
          { x: 184, y: 42 },  // Top-Right of the gutter/roof
          { x: 184, y: 124 }, // Bottom-Right (lowest point of front-right foot)
          { x: 16, y: 124 }   // Bottom-Left (lowest point of front-left foot)
        ];
      case 'zip-blind':
        return [
          { x: 21, y: 14 },   // Top-Left of the cassette headbox
          { x: 179, y: 14 },  // Top-Right of the cassette headbox
          { x: 179, y: 135 }, // Bottom-Right of the guide channel
          { x: 21, y: 135 }   // Bottom-Left of the guide channel
        ];
      case 'awning':
        return [
          { x: 19, y: 14 },   // Top-Left of steel bar / valance
          { x: 181, y: 14 },  // Top-Right of steel bar / valance
          { x: 181, y: 62 },  // Bottom-Right of the valance
          { x: 19, y: 62 }    // Bottom-Left of the valance
        ];
      case 'guillotine':
        return [
          { x: 25, y: 15 },   // Top-Left of the heavy frame
          { x: 175, y: 15 },  // Top-Right of the heavy frame
          { x: 175, y: 131 }, // Bottom-Right of the frame
          { x: 25, y: 131 }   // Bottom-Left of the frame
        ];
      case 'glass-balcony':
        return [
          { x: 14, y: 16 },   // Top-Left of upper track
          { x: 186, y: 16 },  // Top-Right of upper track
          { x: 186, y: 124 }, // Bottom-Right of lower track
          { x: 14, y: 124 }   // Bottom-Left of lower track
        ];
      default:
        return [
          { x: 0, y: 0 },
          { x: 200, y: 0 },
          { x: 200, y: 150 },
          { x: 0, y: 150 }
        ];
    }
  };

  // Render clean vector illustrations for the shading systems
  const renderRealisticShadingSVG = (item: ShadingItem) => {
    if (item.imageUrl) {
      return (
        <svg viewBox="0 0 200 150" className="w-full h-full drop-shadow-2xl select-none" xmlns="http://www.w3.org/2005/svg">
          <g>
            <rect width="200" height="150" fill="#0f172a" rx="8" />
            <image
              href={item.imageUrl}
              width="200"
              height="150"
              preserveAspectRatio="xMidYMid slice"
            />
          </g>
        </svg>
      );
    }
    return deadCodeDUMMY(item);
  };

  const deadCodeDUMMY = (item: ShadingItem) => {
    const text = item.color.toLowerCase();
    
    // 1. Dynamic architectural metallic palette calculation based on actual customer choice
    let baseColor = '#334155'; // slate slate-700 default
    let highlightColor = '#64748b'; // slate-500
    let shadowColor = '#0f172a'; // slate-900
    
    if (text.includes('gri') || text.includes('grey') || text.includes('7016') || text.includes('antrasit')) {
      baseColor = '#374151'; // gray-700
      highlightColor = '#6b7280'; // gray-500
      shadowColor = '#111827'; // gray-900
    } else if (text.includes('beyaz') || text.includes('white') || text.includes('9010')) {
      baseColor = '#e2e8f0'; // slate-200
      highlightColor = '#f8fafc'; // slate-50
      shadowColor = '#94a3b8'; // slate-400
    } else if (text.includes('krem') || text.includes('cream') || text.includes('1013') || text.includes('bej') || text.includes('beige')) {
      baseColor = '#eab308'; // warm cream
      baseColor = '#f3ebd4'; 
      highlightColor = '#fffdf5'; 
      shadowColor = '#a89d7c'; 
    } else if (text.includes('bronz') || text.includes('bronze') || text.includes('kahve') || text.includes('brown') || text.includes('8014')) {
      baseColor = '#5c2c16';
      highlightColor = '#854222';
      shadowColor = '#2d1307';
    } else if (text.includes('wood') || text.includes('ahşap') || text.includes('meşe') || text.includes('oak')) {
      baseColor = '#78350f'; // amber-900
      highlightColor = '#d97706'; // amber-600
      shadowColor = '#451a03'; // amber-950
    }

    const uniqueId = item.id.replace(/[^a-zA-Z0-9-]/g, '');

    return (
      <svg viewBox="0 0 200 150" className="w-full h-full drop-shadow-2xl select-none" xmlns="http://www.w3.org/2005/svg">
        <defs>
          {/* Metallic cylindrical lighting gradient for heavy structural pillars */}
          <linearGradient id={`pillarGrad-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={shadowColor} />
            <stop offset="25%" stopColor={highlightColor} />
            <stop offset="60%" stopColor={baseColor} />
            <stop offset="85%" stopColor={baseColor} />
            <stop offset="100%" stopColor={shadowColor} />
          </linearGradient>

          {/* Horizontal top beam metallic profile gradient */}
          <linearGradient id={`beamGrad-${uniqueId}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={highlightColor} />
            <stop offset="20%" stopColor={baseColor} />
            <stop offset="70%" stopColor={baseColor} />
            <stop offset="100%" stopColor={shadowColor} />
          </linearGradient>

          {/* Slat/Louver metallic bevel shading */}
          <linearGradient id={`slatGrad-${uniqueId}`} x1="0%" y1="0%" x2="30%" y2="100%">
            <stop offset="0%" stopColor={highlightColor} stopOpacity="1" />
            <stop offset="40%" stopColor={baseColor} />
            <stop offset="100%" stopColor={shadowColor} />
          </linearGradient>

          {/* Realistic 3D wooden floor deck perspective gradient */}
          <linearGradient id={`woodPlankGrad-${uniqueId}`} x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#291507" />
            <stop offset="40%" stopColor="#54301a" />
            <stop offset="100%" stopColor="#7c4a27" />
          </linearGradient>

          {/* Glass pane glossy reflection glare */}
          <linearGradient id={`glassReflection-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.6" />
            <stop offset="25%" stopColor="#ffffff" stopOpacity="0.15" />
            <stop offset="26%" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="60%" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="80%" stopColor="#ffffff" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.0" />
          </linearGradient>

          {/* Sky background for real exterior feel */}
          <linearGradient id={`skyGrad-${uniqueId}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0284c7" /> {/* sky-600 */}
            <stop offset="40%" stopColor="#38bdf8" /> {/* sky-400 */}
            <stop offset="100%" stopColor="#bae6fd" /> {/* sky-200 */}
          </linearGradient>

          {/* Cozy sunset beach panorama background specifically for glass balconies */}
          <linearGradient id={`sunsetGrad-${uniqueId}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fdba74" /> {/* orange-300 */}
            <stop offset="50%" stopColor="#f43f5e" /> {/* rose-500 */}
            <stop offset="100%" stopColor="#881337" /> {/* rose-950 */}
          </linearGradient>

          {/* High-fidelity micro-mesh screen fabric pattern for zip blinds */}
          <pattern id={`zipMeshPattern-${uniqueId}`} width="4" height="4" patternUnits="userSpaceOnUse">
            <rect width="4" height="4" fill={baseColor} />
            <path d="M 0 2 L 4 2 M 2 0 L 2 4" stroke="#ffffff" strokeWidth="0.5" strokeOpacity="0.2" />
            <circle cx="2" cy="2" r="1" fill={shadowColor} fillOpacity="0.4" />
          </pattern>

          {/* Soft cloud pattern */}
          <radialGradient id={`cloudGlow-${uniqueId}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* ==================== 1. BIOCLIMATIC PERGOLA / ROLLING ROOF ==================== */}
        {(item.productType === 'bioclimatic-pergola' || item.productType === 'rolling-roof') && (
          <g>
            {/* SKY BACKDROP WITH CLOUDS */}
            <rect x="10" y="10" width="180" height="110" rx="6" fill={`url(#skyGrad-${uniqueId})`} />
            <circle cx="140" cy="35" r="25" fill={`url(#cloudGlow-${uniqueId})`} />
            <circle cx="60" cy="50" r="35" fill={`url(#cloudGlow-${uniqueId})`} />
            
            {/* MODERN FAÇADE BACKGROUND WALL DETAILS */}
            <path d="M10,65 L80,50 L80,120 L10,120 Z" fill="#cbd5e1" fillOpacity="0.4" /> {/* Stone cladding section */}
            <line x1="80" y1="50" x2="80" y2="120" stroke="#94a3b8" strokeWidth="0.5" />

            {/* REALISTIC 3D WOODEN PATIO DECK FLOOR WITH LINEAR PERSPECTIVE PLANKS */}
            <polygon points="10,110 190,110 190,140 10,140" fill={`url(#woodPlankGrad-${uniqueId})`} />
            <g opacity="0.3">
              <line x1="10" y1="110" x2="10" y2="140" stroke="#1e1b4b" strokeWidth="1.5" />
              <line x1="40" y1="110" x2="30" y2="140" stroke="#1e1b4b" strokeWidth="1.2" />
              <line x1="70" y1="110" x2="65" y2="140" stroke="#1e1b4b" strokeWidth="1.2" />
              <line x1="100" y1="110" x2="100" y2="140" stroke="#1e1b4b" strokeWidth="1.2" />
              <line x1="130" y1="110" x2="135" y2="140" stroke="#1e1b4b" strokeWidth="1.2" />
              <line x1="160" y1="110" x2="170" y2="140" stroke="#1e1b4b" strokeWidth="1.2" />
              <line x1="190" y1="110" x2="190" y2="140" stroke="#1e1b4b" strokeWidth="1.5" />
            </g>
            {/* Horizontal wood grain separator lines */}
            <line x1="10" y1="120" x2="190" y2="120" stroke="#291507" strokeWidth="0.5" opacity="0.5" />
            <line x1="10" y1="130" x2="190" y2="130" stroke="#291507" strokeWidth="0.5" opacity="0.5" />

            {/* INTEGRATED SLIDING GLASS DOOR SYSTEM CAST IN REAR */}
            <g opacity="0.5">
              <rect x="42" y="44" width="116" height="66" fill="#bae6fd" fillOpacity="0.2" stroke="#64748b" strokeWidth="0.5" />
              <line x1="100" y1="44" x2="100" y2="110" stroke="#64748b" strokeWidth="1" />
              <line x1="71" y1="44" x2="71" y2="110" stroke="#64748b" strokeWidth="0.5" />
              <line x1="129" y1="44" x2="129" y2="110" stroke="#64748b" strokeWidth="0.5" />
              {/* Glass Glare */}
              <polygon points="45,45 80,45 60,109 45,109" fill="#ffffff" fillOpacity="0.15" />
              <polygon points="105,45 140,45 120,109 105,109" fill="#ffffff" fillOpacity="0.15" />
            </g>

            {/* REALISTIC CAST COLUMN SHADOWS ON WOODEN DECK */}
            <ellipse cx="28" cy="118" rx="8" ry="3" fill="#000000" fillOpacity="0.5" filter="blur(1px)" />
            <ellipse cx="172" cy="118" rx="8" ry="3" fill="#000000" fillOpacity="0.5" filter="blur(1px)" />
            <ellipse cx="45" cy="111" rx="5" ry="2" fill="#000000" fillOpacity="0.4" filter="blur(1px)" />
            <ellipse cx="155" cy="111" rx="5" ry="2" fill="#000000" fillOpacity="0.4" filter="blur(1px)" />

            {/* REAR COLUMNS (DARKER, SHORTER FOR 3D PERSPECTIVE) */}
            <rect x="42" y="44" width="6" height="67" fill={`url(#pillarGrad-${uniqueId})`} fillOpacity="0.8" />
            <rect x="152" y="44" width="6" height="67" fill={`url(#pillarGrad-${uniqueId})`} fillOpacity="0.8" />

            {/* FRONT MAIN COLUMNS (THICK, DETAILED METALLIC WITH BASE BOLTSPLATES) */}
            <g>
              {/* Left Column */}
              <rect x="24" y="54" width="8" height="64" fill={`url(#pillarGrad-${uniqueId})`} />
              {/* Bevel Highlights */}
              <line x1="25" y1="54" x2="25" y2="118" stroke="#ffffff" strokeWidth="0.5" strokeOpacity="0.3" />
              {/* Pillar base mounting plate (Anchor) */}
              <path d="M20,116 L36,116 L34,120 L22,120 Z" fill={shadowColor} />
              <circle cx="23" cy="118" r="0.75" fill="#94a3b8" />
              <circle cx="33" cy="118" r="0.75" fill="#94a3b8" />

              {/* Right Column */}
              <rect x="168" y="54" width="8" height="64" fill={`url(#pillarGrad-${uniqueId})`} />
              <line x1="169" y1="54" x2="169" y2="118" stroke="#ffffff" strokeWidth="0.5" strokeOpacity="0.3" />
              {/* Pillar base mounting plate */}
              <path d="M164,116 L180,116 L178,120 L166,120 Z" fill={shadowColor} />
              <circle cx="167" cy="118" r="0.75" fill="#94a3b8" />
              <circle cx="177" cy="118" r="0.75" fill="#94a3b8" />
            </g>

            {/* SLANTED PERSPECTIVE LOUVERS ARRAY (3D AERODYNAMIC PROFILE SLATS) */}
            <polygon points="18,44 182,44 154,18 46,18" fill={shadowColor} fillOpacity="0.9" />
            <g>
              {[
                { p1: "44,19", p2: "156,19", p3: "152,22", p4: "40,22", d: "0.95" },
                { p1: "40,22", p2: "160,22", p3: "154,25", p4: "34,25", d: "0.95" },
                { p1: "34,25", p2: "166,25", p3: "156,28", p4: "28,28", d: "0.95" },
                { p1: "28,28", p2: "172,28", p3: "158,32", p4: "20,32", d: "0.95" },
                { p1: "20,32", p2: "180,32", p3: "162,36", p4: "14,36", d: "0.95" },
                { p1: "14,36", p2: "186,36", p3: "168,40", p4: "10,40", d: "0.95" },
                { p1: "10,40", p2: "190,40", p3: "182,44", p4: "18,44", d: "1.0" }
              ].map((slat, sIdx) => (
                <g key={sIdx}>
                  <polygon 
                    points={`${slat.p1} ${slat.p2} ${slat.p3} ${slat.p4}`} 
                    fill={`url(#slatGrad-${uniqueId})`} 
                    stroke={shadowColor} 
                    strokeWidth="0.5" 
                  />
                  {/* Aluminum slat edge highlight shine */}
                  <polygon 
                    points={`${slat.p1} ${slat.p2} ${slat.p2}`} 
                    stroke="#ffffff" 
                    strokeWidth="0.5" 
                    strokeOpacity="0.25" 
                  />
                </g>
              ))}
            </g>

            {/* HEAVY PERIMETER GUTTER BEAM WITH CHAMFERS & DRAIN OUTLETS */}
            <polygon points="16,42 184,42 174,56 26,56" fill={`url(#beamGrad-${uniqueId})`} />
            {/* Top rim glossy line */}
            <polygon points="16,42 184,42 182,44 18,44" fill="#ffffff" fillOpacity="0.4" />
            {/* Corner connection welding joints caps */}
            <rect x="16" y="42" width="10" height="14" fill={shadowColor} fillOpacity="0.3" />
            <rect x="174" y="42" width="10" height="14" fill={shadowColor} fillOpacity="0.3" />

            {/* INTEGRATED LED STRIP SPOTLIGHTS SHINING WARM RADIANT CONES */}
            <g>
              {/* Linear LED profile */}
              <line x1="26" y1="50" x2="174" y2="50" stroke="#fef08a" strokeWidth="2.5" strokeOpacity="1" />
              <line x1="26" y1="50" x2="174" y2="50" stroke="#eab308" strokeWidth="6" strokeOpacity="0.4" />
              
              {/* Conical yellow spotlights throwing down */}
              <polygon points="50,51 20,110 80,110" fill="url(#ledGlow-gradient)" fillOpacity="0.15" opacity="0.6" className="animate-pulse" />
              <polygon points="100,51 70,110 130,110" fill="url(#ledGlow-gradient)" fillOpacity="0.15" opacity="0.6" className="animate-pulse" />
              <polygon points="150,51 120,110 180,110" fill="url(#ledGlow-gradient)" fillOpacity="0.15" opacity="0.6" className="animate-pulse" />

              {/* Glowing LED points */}
              {[45, 75, 100, 125, 155].map((cx) => (
                <g key={cx}>
                  <circle cx={cx} cy="50" r="2.5" fill="#ffffff" />
                  <circle cx={cx} cy="50" r="6" fill="#fef08a" fillOpacity="0.5" />
                </g>
              ))}
            </g>

            {/* CENTRAL BRAND EMBOSSED LABEL PLATE */}
            <rect x="52" y="74" width="96" height="18" rx="4" fill="#0f172a" fillOpacity="0.9" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
            <text x="100" y="86" fill="#ffffff" fontWeight="black" fontSize="7" textAnchor="middle" fontFamily="sans-serif" letterSpacing="1">
              {item.name.toUpperCase().substring(0, 18)}
            </text>
          </g>
        )}

        {/* ==================== 2. ZIP BLIND / FACADE SUN SHADE ==================== */}
        {item.productType === 'zip-blind' && (
          <g>
            {/* BACKGROUND HOUSE WALL WITH MODERN WINDOW OPENING */}
            <rect x="10" y="10" width="180" height="130" rx="6" fill="#e2e8f0" /> {/* wall */}
            
            {/* Garden Landscape Silhouette viewable through window */}
            <g>
              <rect x="25" y="24" width="150" height="110" fill="#bae6fd" /> {/* sky backdrop inside */}
              {/* Mountain Silhouette */}
              <path d="M25,110 L50,85 L85,115 L120,75 L160,115 L175,100 L175,134 L25,134 Z" fill="#0284c7" fillOpacity="0.25" />
              {/* Tree Silhouettes */}
              <circle cx="45" cy="115" r="12" fill="#047857" fillOpacity="0.3" />
              <circle cx="155" cy="110" r="14" fill="#047857" fillOpacity="0.3" />
            </g>

            {/* CASSETTE HEADBOX (CYLINDRICAL 3D CASING WITH METAL HIGHLIGHTS) */}
            <g>
              {/* Heavy-duty headbox shadow */}
              <rect x="21" y="22" width="158" height="2" fill="#000000" fillOpacity="0.25" />
              {/* Cassette casing */}
              <rect x="21" y="14" width="158" height="20" rx="4" fill={`url(#beamGrad-${uniqueId})`} />
              <line x1="21" y1="15" x2="179" y2="15" stroke="#ffffff" strokeWidth="0.75" strokeOpacity="0.5" />
              <line x1="21" y1="33" x2="179" y2="33" stroke="#000000" strokeWidth="0.75" strokeOpacity="0.3" />
              {/* Endcaps with mounting screw details */}
              <rect x="21" y="14" width="5" height="20" fill={shadowColor} />
              <rect x="174" y="14" width="5" height="20" fill={shadowColor} />
              <circle cx="23.5" cy="24" r="1" fill="#ffffff" fillOpacity="0.6" />
              <circle cx="176.5" cy="24" r="1" fill="#ffffff" fillOpacity="0.6" />
            </g>

            {/* SIDE CHANNELS (GUIDES WITH SPECIAL ZIP LOCK INLAY CHAMBERS) */}
            <g>
              {/* Left track */}
              <rect x="24" y="34" width="7" height="100" fill={`url(#pillarGrad-${uniqueId})`} />
              <line x1="31" y1="34" x2="31" y2="134" stroke="#000000" strokeWidth="0.75" strokeOpacity="0.5" />
              {/* Right track */}
              <rect x="169" y="34" width="7" height="100" fill={`url(#pillarGrad-${uniqueId})`} />
              <line x1="169" y1="34" x2="169" y2="134" stroke="#000000" strokeWidth="0.75" strokeOpacity="0.5" />
            </g>

            {/* SEMI-TRANSLUCENT SCREEN MICRO-MESH WEAVE BLOCK */}
            <rect x="31" y="34" width="138" height="92" fill={`url(#zipMeshPattern-${uniqueId})`} fillOpacity="0.85" />
            {/* Woven fabric gloss fold sheen overlay */}
            <rect x="31" y="34" width="138" height="92" fill={`url(#glassReflection-${uniqueId})`} fillOpacity="0.15" />

            {/* High-fidelity horizontal thermal joint welding bars */}
            <line x1="31" y1="62" x2="169" y2="62" stroke="rgba(0,0,0,0.2)" strokeWidth="1.5" />
            <line x1="31" y1="90" x2="169" y2="90" stroke="rgba(0,0,0,0.2)" strokeWidth="1.5" />
            <line x1="31" y1="114" x2="169" y2="114" stroke="rgba(0,0,0,0.2)" strokeWidth="1.5" />

            {/* HEAVYWEIGHT BOTTOM RAIL BAR WITH SEALS & ENDPLUGS */}
            <g>
              <rect x="29" y="125" width="142" height="9" rx="1.5" fill={`url(#beamGrad-${uniqueId})`} />
              {/* Aluminum bar beveled bottom cap */}
              <rect x="30" y="134" width="140" height="2" fill="#111827" /> {/* black rubber gasket bottom */}
              <line x1="30" y1="126" x2="170" y2="126" stroke="#ffffff" strokeWidth="0.5" strokeOpacity="0.4" />
              {/* Slide guide end runners */}
              <rect x="29" y="125" width="2" height="9" fill={shadowColor} />
              <rect x="169" y="125" width="2" height="9" fill={shadowColor} />
            </g>

            {/* TEXT BADGE */}
            <rect x="52" y="64" width="96" height="18" rx="4" fill="#0f172a" fillOpacity="0.9" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
            <text x="100" y="76" fill="#ffffff" fontWeight="black" fontSize="7" textAnchor="middle" fontFamily="sans-serif" letterSpacing="0.8">
              {item.name.toUpperCase().substring(0, 18)}
            </text>
          </g>
        )}

        {/* ==================== 3. RETRACTABLE FOLDING ARM AWNING ==================== */}
        {item.productType === 'awning' && (
          <g>
            {/* WALL FACADE BACKGROUND SYSTEM */}
            <rect x="10" y="10" width="180" height="130" rx="6" fill="#f1f5f9" /> {/* Clean stucco wall */}
            {/* Draw delicate horizontal brick lines to give depth */}
            <g stroke="#e2e8f0" strokeWidth="0.5" opacity="0.8">
              <line x1="10" y1="25" x2="190" y2="25" />
              <line x1="10" y1="45" x2="190" y2="45" />
              <line x1="10" y1="65" x2="190" y2="65" />
              <line x1="10" y1="85" x2="190" y2="85" />
              <line x1="10" y1="105" x2="190" y2="105" />
              <line x1="10" y1="125" x2="190" y2="125" />
            </g>

            {/* HEAVY CAST DROP SHADOW OF THE EXTENDED AWNING ON THE WALL */}
            <polygon points="26,45 174,45 186,110 14,110" fill="#0f172a" fillOpacity="0.25" filter="blur(3px)" />

            {/* HEAVY WALL BRACKET MOUNTING BEAM */}
            <rect x="30" y="14" width="140" height="8" rx="2" fill={`url(#pillarGrad-${uniqueId})`} />
            <circle cx="34" cy="18" r="1.2" fill="#94a3b8" />
            <circle cx="166" cy="18" r="1.2" fill="#94a3b8" />

            {/* STAINLESS STEEL RETRACTABLE MECHANICAL FOLDING SCISSOR ARMS */}
            {/* Left articulating dual elbow mechanical arm */}
            <g>
              <line x1="52" y1="22" x2="44" y2="62" stroke={shadowColor} strokeWidth="6" strokeLinecap="round" />
              <line x1="52" y1="22" x2="44" y2="62" stroke={`url(#pillarGrad-${uniqueId})`} strokeWidth="4" strokeLinecap="round" />
              {/* Connecting arm hinge forearm */}
              <line x1="44" y1="62" x2="30" y2="58" stroke={`url(#pillarGrad-${uniqueId})`} strokeWidth="3.5" strokeLinecap="round" />
              {/* Stainless joint pivot pins details */}
              <circle cx="44" cy="62" r="2.5" fill="#e2e8f0" stroke="#000000" strokeWidth="0.5" />
              <circle cx="44" cy="62" r="1" fill="#475569" />
              <circle cx="52" cy="22" r="2" fill="#e2e8f0" />
            </g>

            {/* Right articulating mechanical arm */}
            <g>
              <line x1="148" y1="22" x2="156" y2="62" stroke={shadowColor} strokeWidth="6" strokeLinecap="round" />
              <line x1="148" y1="22" x2="156" y2="62" stroke={`url(#pillarGrad-${uniqueId})`} strokeWidth="4" strokeLinecap="round" />
              {/* Forearm */}
              <line x1="156" y1="62" x2="170" y2="58" stroke={`url(#pillarGrad-${uniqueId})`} strokeWidth="3.5" strokeLinecap="round" />
              {/* Joint details */}
              <circle cx="156" cy="62" r="2.5" fill="#e2e8f0" stroke="#000000" strokeWidth="0.5" />
              <circle cx="156" cy="62" r="1" fill="#475569" />
              <circle cx="148" cy="22" r="2" fill="#e2e8f0" />
            </g>

            {/* MULTI-SECTION TEXTURED POLYESTER FABRIC canopy */}
            <g>
              {[
                { p: "32,18 54,18 48,56 20,56", c: "#dc2626", d: "#ef4444" },
                { p: "54,18 76,18 74,56 48,56", c: "#f8fafc", d: "#ffffff" },
                { p: "76,18 98,18 100,56 74,56", c: "#dc2626", d: "#ef4444" },
                { p: "98,18 120,18 124,56 100,56", c: "#f8fafc", d: "#ffffff" },
                { p: "120,18 142,18 148,56 124,56", c: "#dc2626", d: "#ef4444" },
                { p: "142,18 164,18 172,56 148,56", c: "#f8fafc", d: "#ffffff" },
                { p: "164,18 178,18 190,56 172,56", c: "#dc2626", d: "#ef4444" }
              ].map((stripe, sIdx) => (
                <g key={sIdx}>
                  <polygon points={stripe.p} fill={stripe.c} />
                  {/* Fine linear shading on fabric */}
                  <polygon points={stripe.p} fill={`url(#glassReflection-${uniqueId})`} fillOpacity="0.1" />
                </g>
              ))}
            </g>
            {/* Drapery fold shadow overlays */}
            <polygon points="32,18 178,18 190,56 20,56" fill={`url(#glassReflection-${uniqueId})`} fillOpacity="0.15" />
            <polygon points="32,18 178,18 190,56 20,56" fill={`url(#pillarGrad-${uniqueId})`} fillOpacity="0.15" />

            {/* WAITING CONTURED WAVY VALANCE WITH WHITE PIPING AND STITCHING */}
            <path d="M20,56 C28,61 36,56 44,56 C52,61 60,56 68,56 C76,61 84,56 92,56 C100,61 108,56 116,56 C124,61 132,56 140,56 C148,61 156,56 164,56 C172,61 180,56 190,56 L190,62 L20,62 Z" fill="#991b1b" />
            <path d="M20,56 C28,61 36,56 44,56 C52,61 60,56 68,56 C76,61 84,56 92,56 C100,61 108,56 116,56 C124,61 132,56 140,56 C148,61 156,56 164,56 C172,61 180,56 190,56" fill="none" stroke="#fee2e2" strokeWidth="1" />

            {/* BRAND BADGE */}
            <rect x="52" y="80" width="96" height="18" rx="4" fill="#0f172a" fillOpacity="0.9" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
            <text x="100" y="92" fill="#ffffff" fontWeight="black" fontSize="7" textAnchor="middle" fontFamily="sans-serif" letterSpacing="0.8">
              {item.name.toUpperCase().substring(0, 18)}
            </text>
          </g>
        )}

        {/* ==================== 4. MOTORIZED GUILLOTINE GLASS WINDOW ==================== */}
        {item.productType === 'guillotine' && (
          <g>
            {/* DEEP INTERIOR ROOM WALL VIEWING OUT TO MAJESTIC SUNSET LANDSCAPE */}
            <rect x="10" y="10" width="180" height="130" rx="6" fill="#cbd5e1" />
            <rect x="20" y="18" width="160" height="114" rx="4" fill={`url(#skyGrad-${uniqueId})`} />
            
            {/* Mountain Skyline backdrop inside window frames */}
            <path d="M20,110 L60,80 L100,105 L150,70 L180,105 L180,132 L20,132 Z" fill="#0369a1" fillOpacity="0.3" />

            {/* THREE-PANE HEAVY ANODIZED ALUMINUM GUILLOTINE FRAME */}
            <rect x="25" y="15" width="150" height="116" rx="4" fill="none" stroke={`url(#pillarGrad-${uniqueId})`} strokeWidth="5.5" />
            <rect x="25" y="15" width="150" height="116" rx="4" fill="none" stroke={shadowColor} strokeWidth="1" />

            {/* Partition cross members / horizontal steel frames */}
            <rect x="27.5" y="17.5" width="145" height="4" fill={`url(#beamGrad-${uniqueId})`} />

            {/* TOP GLASS PANE (SLIDING INNER ELEMENT WITH GLOSS GLARE EFFECTS) */}
            <g>
              <rect x="30.5" y="21.5" width="139" height="31" fill="#bae6fd" fillOpacity="0.25" rx="1.5" />
              <rect x="30.5" y="21.5" width="139" height="31" fill={`url(#glassReflection-${uniqueId})`} fillOpacity="0.4" rx="1.5" />
              {/* Glass chamfer edge shines */}
              <rect x="30.5" y="21.5" width="139" height="31" fill="none" stroke={baseColor} strokeWidth="2" />
            </g>

            {/* MIDDLE GLASS PANE (MID-WAY TRANSITIONING MOTORIZED GLASS FRAME) */}
            <rect x="27.5" y="52.5" width="145" height="4" fill={`url(#beamGrad-${uniqueId})`} />
            <g>
              <rect x="30.5" y="56.5" width="139" height="31" fill="#bae6fd" fillOpacity="0.2" rx="1.5" />
              <rect x="30.5" y="56.5" width="139" height="31" fill={`url(#glassReflection-${uniqueId})`} fillOpacity="0.35" rx="1.5" />
              <rect x="30.5" y="56.5" width="139" height="31" fill="none" stroke={baseColor} strokeWidth="2" />
            </g>

            {/* FIXED BOTTOM COUNTER-BALANCED GLASS BARRIERS */}
            <rect x="27.5" y="87.5" width="145" height="4" fill={`url(#beamGrad-${uniqueId})`} />
            <g>
              <rect x="30.5" y="91.5" width="139" height="31" fill="#bae6fd" fillOpacity="0.15" rx="1.5" />
              <rect x="30.5" y="91.5" width="139" height="31" fill={`url(#glassReflection-${uniqueId})`} fillOpacity="0.25" rx="1.5" />
              <rect x="30.5" y="91.5" width="139" height="31" fill="none" stroke={baseColor} strokeWidth="2" />
            </g>

            {/* REVEALING EXPOSED TRANSMISSION SIDE GUIDE CHAINS & GEAR COVERS */}
            <g opacity="0.8">
              <path d="M164,30 L164,110" stroke="#f59e0b" strokeWidth="1" strokeDasharray="3,3" />
              <path d="M164,28 L161,33 L167,33 Z" fill="#f59e0b" />
              <path d="M164,114 L161,109 L167,109 Z" fill="#f59e0b" />
            </g>

            {/* BRAND INSCRIPTION */}
            <rect x="52" y="62" width="96" height="18" rx="4" fill="#0f172a" fillOpacity="0.9" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
            <text x="100" y="74" fill="#ffffff" fontWeight="black" fontSize="7" textAnchor="middle" fontFamily="sans-serif" letterSpacing="0.8">
              {item.name.toUpperCase().substring(0, 18)}
            </text>
          </g>
        )}

        {/* ==================== 5. FOLDING GLASS BALCONY GLAZING ==================== */}
        {item.productType === 'glass-balcony' && (
          <g>
            {/* SUNSET BAY PANORAMIC OCEAN BACKGROUND VIEWABLE THROUGH LUXURY BALCONY */}
            <rect x="10" y="10" width="180" height="130" rx="6" fill={`url(#sunsetGrad-${uniqueId})`} />
            
            {/* Sea horizon line and sunset waves */}
            <line x1="10" y1="90" x2="190" y2="90" stroke="#fb7185" strokeWidth="1" opacity="0.6" />
            <path d="M10,91 C30,89 50,92 70,91 C90,89 110,92 130,91 C150,89 170,92 190,91" fill="none" stroke="#f43f5e" strokeWidth="0.5" opacity="0.4" />

            {/* HEAVY ANODIZED ALUMINUM TOP & BOTTOM RAILS GUIDE PROFILE */}
            <rect x="14" y="16" width="172" height="10" rx="2" fill={`url(#beamGrad-${uniqueId})`} />
            <line x1="14" y1="26" x2="186" y2="26" stroke="#000000" strokeWidth="1" />

            <rect x="14" y="114" width="172" height="10" rx="2" fill={`url(#beamGrad-${uniqueId})`} />
            <line x1="14" y1="114" x2="186" y2="114" stroke="#ffffff" strokeWidth="0.75" strokeOpacity="0.3" />

            {/* BRUSHED STAINLESS STEEL MIDDLE SAFETY BALUSTRADE / HANDRAIL */}
            <g opacity="0.7">
              <line x1="14" y1="75" x2="186" y2="75" stroke="#94a3b8" strokeWidth="3" />
              <line x1="14" y1="74" x2="186" y2="74" stroke="#ffffff" strokeWidth="0.75" />
              {/* Handrail wall fixtures */}
              <rect x="14" y="72" width="2" height="7" fill={shadowColor} />
              <rect x="184" y="72" width="2" height="7" fill={shadowColor} />
            </g>

            {/* FIVE FRAMELESS TEMPERED GLASS PANELS WITH TRANSPARENT GLARE SHINES */}
            {[
              { x: 18, open: false },
              { x: 51, open: false },
              { x: 84, open: false },
              { x: 117, open: false },
              // We make the last panel 150 partially open/swung in perspective 3D to show off structural versatility
              { x: 150, open: true }
            ].map((pane, pIdx) => {
              if (pane.open) {
                // Swung partially open - styled with slanted 3D polygons to look extremely realistic!
                return (
                  <g key={pIdx}>
                    {/* Perspective Swung Open Glass Panel */}
                    <polygon points="150,26 166,28 166,112 150,114" fill="#38bdf8" fillOpacity="0.3" />
                    <polygon points="150,26 166,28 166,112 150,114" fill={`url(#glassReflection-${uniqueId})`} fillOpacity="0.4" />
                    <polygon points="150,26 166,28 166,112 150,114" fill="none" stroke="#ffffff" strokeWidth="1.5" strokeOpacity="0.8" />
                    
                    {/* Hinge system */}
                    <rect x="148" y="21" width="4" height="6" fill="#cbd5e1" />
                    <rect x="148" y="113" width="4" height="6" fill="#cbd5e1" />
                    <line x1="150" y1="26" x2="150" y2="114" stroke="#f59e0b" strokeWidth="1" strokeDasharray="2,2" />
                  </g>
                );
              }

              return (
                <g key={pIdx}>
                  {/* Frameless glass body */}
                  <rect x={pane.x} y={26} width="32" height="88" fill="#38bdf8" fillOpacity="0.18" />
                  {/* Gloss reflection shine */}
                  <rect x={pane.x} y={26} width="32" height="88" fill={`url(#glassReflection-${uniqueId})`} fillOpacity="0.3" />
                  {/* Delicate glass edge polishing highlight */}
                  <rect x={pane.x} y={26} width="32" height="88" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.75" />
                  
                  {/* Upper and lower carrier stainless rollers guide shoes */}
                  <rect x={pane.x + 13} y={21} width="6" height="5" rx="1" fill={shadowColor} />
                  <rect x={pane.x + 13} y={114} width="6" height="5" rx="1" fill={shadowColor} />
                  <circle cx={pane.x + 16} cy="23.5" r="0.75" fill="#ffffff" />
                  <circle cx={pane.x + 16} cy="116.5" r="0.75" fill="#ffffff" />
                </g>
              );
            })}

            {/* TRANSLUCENT VERTICAL SILICONE GASKETS BETWEEN GLASS ELEMENTS */}
            <line x1="50" y1="26" x2="50" y2="114" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" />
            <line x1="83" y1="26" x2="83" y2="114" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" />
            <line x1="116" y1="26" x2="116" y2="114" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" />
            <line x1="149" y1="26" x2="149" y2="114" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" />

            {/* STAINLESS STEEL CYLINDRICAL DOOR LOCK KNOB WITH CHAINS RING */}
            <g>
              <circle cx="24" cy="70" r="4" fill={`url(#pillarGrad-${uniqueId})`} stroke="#ffffff" strokeWidth="0.5" />
              <circle cx="24" cy="70" r="1.5" fill={shadowColor} />
              <line x1="24" y1="70" x2="28" y2="76" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
            </g>

            {/* TEXT LABEL BADGE */}
            <rect x="52" y="60" width="96" height="18" rx="4" fill="#0f172a" fillOpacity="0.9" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
            <text x="100" y="72" fill="#ffffff" fontWeight="black" fontSize="7" textAnchor="middle" fontFamily="sans-serif" letterSpacing="0.8">
              {item.name.toUpperCase().substring(0, 18)}
            </text>
          </g>
        )}
      </svg>
    );
  };

  // SVG Canvas overlay drag and drop precision controller
  const dragRef = React.useRef({ isDragging: false, startX: 0, startY: 0, xPct: 50, yPct: 50 });

  const handleSVGMouseDown = (e: React.MouseEvent, item: ShadingItem) => {
    e.preventDefault();
    dragRef.current = {
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
      xPct: item.overlayX !== undefined ? item.overlayX : 50,
      yPct: item.overlayY !== undefined ? item.overlayY : 50
    };

    const handleMouseMove = (mvEvt: MouseEvent) => {
      if (!dragRef.current.isDragging) return;
      const deltaX = mvEvt.clientX - dragRef.current.startX;
      const deltaY = mvEvt.clientY - dragRef.current.startY;

      // Map drag pixel boundaries dynamically into responsive viewport percentages
      const dragPctX = Math.min(100, Math.max(0, dragRef.current.xPct + (deltaX / 7.2)));
      const dragPctY = Math.min(100, Math.max(0, dragRef.current.yPct + (deltaY / 4.8)));

      handleUpdateShadingItem({
        ...item,
        overlayX: Math.round(dragPctX),
        overlayY: Math.round(dragPctY)
      });
    };

    const handleMouseUp = () => {
      dragRef.current.isDragging = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };
  
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

  // Auto-detect and populate bulk options from selected positions when they share the same state
  useEffect(() => {
    if (!showBulkEditModal || bulkCheckedUnitIds.length === 0) return;

    const selectedUnits = project.units.filter(u => bulkCheckedUnitIds.includes(u.id));
    if (selectedUnits.length === 0) return;

    // 1. Infer glass inclusion (Default is true if not explicitly false)
    const firstInclude = selectedUnits[0].includeGlass !== false;
    const allSameInclude = selectedUnits.every(u => (u.includeGlass !== false) === firstInclude);
    if (allSameInclude) {
      setBulkIncludeGlass(firstInclude ? 'yes' : 'no');
    } else {
      setBulkIncludeGlass('keep');
    }

    // 2. Infer threshold
    const firstThreshold = selectedUnits[0].hasThreshold === true;
    const allSameThreshold = selectedUnits.every(u => (u.hasThreshold === true) === firstThreshold);
    if (allSameThreshold) {
      setBulkHasThreshold(firstThreshold ? 'yes' : 'no');
    } else {
      setBulkHasThreshold('keep');
    }

    // 3. Infer glass type
    const firstGlassType = selectedUnits[0].glassType || '';
    const allSameGlassType = selectedUnits.every(u => (u.glassType || '') === firstGlassType);
    if (allSameGlassType) {
      setBulkGlassType(firstGlassType);
    } else {
      setBulkGlassType('');
    }

    // 4. Infer system
    const firstSystem = selectedUnits[0].system || '';
    const allSameSystem = selectedUnits.every(u => (u.system || '') === firstSystem);
    if (allSameSystem) {
      setBulkSystemId(firstSystem);
    } else {
      setBulkSystemId('');
    }

    // 5. Infer color
    const firstColor = selectedUnits[0].color || '';
    const allSameColor = selectedUnits.every(u => (u.color || '') === firstColor);
    if (allSameColor) {
      setBulkColor(firstColor);
    } else {
      setBulkColor('');
    }

    const firstSpecificColor = selectedUnits[0].specificColor || '';
    const allSameSpecificColor = selectedUnits.every(u => (u.specificColor || '') === firstSpecificColor);
    if (allSameSpecificColor) {
      setBulkSpecificColor(firstSpecificColor);
    } else {
      setBulkSpecificColor('');
    }
  }, [showBulkEditModal, bulkCheckedUnitIds, project.units]);

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
    isSplit?: boolean;
    splitDirection?: 'horizontal' | 'vertical';
    panes?: { name?: string; openingType: string; dimension?: number }[];
    rootNode?: WindowNode;
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

  const [showMaterialList, setShowMaterialList] = useState<boolean>(() => {
    return localStorage.getItem('alucraft_show_material_list') !== 'false';
  });

  const [companyLogo, setCompanyLogo] = useState<string | null>(() => {
    return localStorage.getItem('alucraft_company_logo') || null;
  });

  const handleToggleCostDetails = (checked: boolean) => {
    setShowCostDetails(checked);
    localStorage.setItem('alucraft_show_cost_details', checked ? 'true' : 'false');
  };

  const handleToggleMaterialList = (checked: boolean) => {
    setShowMaterialList(checked);
    localStorage.setItem('alucraft_show_material_list', checked ? 'true' : 'false');
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Optional: Size limit check (e.g. 1.5MB to avoid exceeding local storage size limits)
    if (file.size > 1500000) {
      alert(lang === 'tr' ? 'Logo dosyası çok büyük (maksimum 1.5 MB olmalıdır)' : 'Logo file is too large (maximum 1.5 MB)');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setCompanyLogo(base64String);
      localStorage.setItem('alucraft_company_logo', base64String);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setCompanyLogo(null);
    localStorage.removeItem('alucraft_company_logo');
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
        const reviewItems = detectedUnits.map((d, index) => {
          const w = Number(d.width) || 1200;
          const h = Number(d.height) || 1400;
          const opType = (d.type && ['fixed', 'turn-left', 'turn-right', 'tilt', 'tilt-turn-left', 'tilt-turn-right', 'sliding'].includes(d.type)) 
            ? (d.type as any) 
            : 'fixed';

          let rootNode: WindowNode;
          const isSplit = Boolean(d.isSplit && d.panes && Array.isArray(d.panes) && d.panes.length >= 2);
          const splitDirection: 'horizontal' | 'vertical' = (d.splitDirection === 'vertical') ? 'vertical' : 'horizontal';

          if (isSplit && d.panes && d.panes.length >= 2) {
            const p1 = d.panes[0];
            const p2 = d.panes[1];
            const dim1 = Number(p1.dimension) || (splitDirection === 'vertical' ? w / 2 : h / 2);
            const dim2 = Number(p2.dimension) || (splitDirection === 'vertical' ? w / 2 : h / 2);
            const totalDim = Math.max(1, dim1 + dim2);
            const r0 = Math.max(0.05, Math.min(0.95, Math.round((dim1 / totalDim) * 1000) / 1000));
            const r1 = Math.round((1 - r0) * 1000) / 1000;

            const p1Op = (p1.openingType && ['fixed', 'turn-left', 'turn-right', 'tilt', 'tilt-turn-left', 'tilt-turn-right', 'sliding'].includes(p1.openingType))
              ? p1.openingType
              : 'fixed';
            const p2Op = (p2.openingType && ['fixed', 'turn-left', 'turn-right', 'tilt', 'tilt-turn-left', 'tilt-turn-right', 'sliding'].includes(p2.openingType))
              ? p2.openingType
              : 'turn-left';

            rootNode = {
              id: uuidv4(),
              type: 'container',
              direction: splitDirection,
              splitRatio: [r0, r1],
              children: [
                { id: uuidv4(), type: 'glass', openingType: p1Op },
                { id: uuidv4(), type: 'glass', openingType: p2Op }
              ]
            };
          } else {
            rootNode = {
              id: uuidv4(),
              type: 'glass',
              openingType: opType
            };
          }

          const hasSliding = opType === 'sliding' || (d.panes && d.panes.some((p: any) => p.openingType === 'sliding'));
          const defaultSys = hasSliding
            ? (systems.find(s => s.type === 'sliding')?.id || systems[0]?.id || 'kurt-51ls')
            : (systems.find(s => s.id === 'kurt-70t-th' || s.type === 'hinged')?.id || systems[0]?.id || 'kurt-70t-th');

          return {
            id: uuidv4(),
            name: d.name || `Poz-${index + 1}`,
            width: w,
            height: h,
            type: opType,
            system: defaultSys,
            selected: true,
            isSplit,
            splitDirection,
            panes: d.panes || [],
            rootNode
          };
        });
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
      rootNode: u.rootNode || {
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
    const system = getSystemForUnit(unit, systems);
    const dxfData = generateDXF(unit, system);
    const blob = new Blob([dxfData], { type: 'application/dxf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${unit.name}_${system.name}.dxf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDuplicateUnit = (unit: Unit) => {
    // Generate next sequential name if it ends with digits (e.g. P5 -> P6, Poz 5 -> Poz 6)
    let newName = unit.name;
    const match = unit.name.match(/^(.*?)(\d+)$/);
    if (match) {
      const prefix = match[1];
      const num = parseInt(match[2], 10);
      newName = `${prefix}${num + 1}`;
    } else {
      newName = `${unit.name} (${lang === 'tr' ? 'Kopya' : 'Copy'})`;
    }
    
    const duplicatedUnit: Unit = {
      ...JSON.parse(JSON.stringify(unit)),
      id: uuidv4(),
      name: newName,
    };
    
    const updatedProject: Project = {
      ...project,
      units: [...(project.units || []), duplicatedUnit],
      updatedAt: Date.now()
    };
    
    onUpdateProject(updatedProject);
  };

  const getUnitStats = (unit: Unit) => {
    // Robust system lookup
    const system = getSystemForUnit(unit, systems);
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

    // Calculate per-sash accessory mounting labor costs
    const sashCounts = getUnitSashLaborCounts(unit, system);

    // Tilt-Turn Accessory Mounting Labor (ALÜMİNYUM ÇİFT AÇILIM PENCERE KANAT AKSESUAR MONTAJ BEDELİ)
    const tiltTurnTry = system.tiltTurnLaborPrice !== undefined ? system.tiltTurnLaborPrice : 0;
    const tiltTurnUsd = system.tiltTurnLaborPriceUsd !== undefined ? system.tiltTurnLaborPriceUsd : 0;
    let tiltTurnRate = 0;
    if (currency === 'TRY') {
      tiltTurnRate = tiltTurnTry || (tiltTurnUsd * exchangeRate);
    } else {
      tiltTurnRate = tiltTurnUsd || (tiltTurnTry / exchangeRate);
    }
    const tiltTurnLaborCost = sashCounts.tiltTurnCount * tiltTurnRate;

    // HBSB Lift-Slide Accessory Mounting Labor (ALÜMİNYUM HBSB SÜRME AKSESUAR MONTAJ BEDELİ (HER KANAT İÇİN))
    const hbsbTry = system.hbsbLaborPrice !== undefined ? system.hbsbLaborPrice : 0;
    const hbsbUsd = system.hbsbLaborPriceUsd !== undefined ? system.hbsbLaborPriceUsd : 0;
    let hbsbRate = 0;
    if (currency === 'TRY') {
      hbsbRate = hbsbTry || (hbsbUsd * exchangeRate);
    } else {
      hbsbRate = hbsbUsd || (hbsbTry / exchangeRate);
    }
    const hbsbLaborCost = sashCounts.slidingCount * hbsbRate;

    const totalLaborCost = ((profileWeight * 1.10) * systemLaborRate) + tiltTurnLaborCost + hbsbLaborCost;
    const unitTotalCost = profileCost + glassCost + accCost + tiltTurnLaborCost + hbsbLaborCost;

    return { 
      cost: unitTotalCost, 
      weight: profileWeight, 
      selectedAccs, 
      accCost,
      laborRate: systemLaborRate,
      colorPrice,
      tiltTurnLaborCost,
      tiltTurnCount: sashCounts.tiltTurnCount,
      tiltTurnRate,
      hbsbLaborCost,
      slidingCount: sashCounts.slidingCount,
      hbsbRate,
      totalLaborCost
    };
  };

  const projectTotalStats = useMemo(() => {
    let totalWeight = 0;
    let joinerySubTotal = 0;
    project.units.forEach(u => {
      const stats = getUnitStats(u);
      totalWeight += stats.weight * (u.quantity || 1);
      joinerySubTotal += stats.cost * (u.quantity || 1);
    });

    const shadingSubTotal = (project.shadingItems || []).reduce((sum, item) => sum + (item.unitPrice * (item.quantity || 1)), 0);
    const subTotal = joinerySubTotal + shadingSubTotal;

    const discountAmount = (subTotal * (project.discountPercentage || 0)) / 100;
    const discountedSubTotal = subTotal - discountAmount;
    const vatAmount = project.isExport ? 0 : (discountedSubTotal * taxRate) / 100;
    return { 
      joinerySubTotal,
      shadingSubTotal,
      subTotal, 
      discountPercentage: project.discountPercentage || 0,
      discountAmount,
      discountedSubTotal,
      vatAmount, 
      grandTotal: discountedSubTotal + vatAmount, 
      totalWeight 
    };
  }, [project.units, project.shadingItems, project.isExport, project.discountPercentage, taxRate, systems, accessories]);

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
                    <button onClick={() => setActiveTab('shading')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'shading' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
                        {lang === 'tr' ? 'Gölgelendirme (ShadeVision)' : 'Shading (ShadeVision)'}
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
                                        {t(lang, 'complete') || (lang === 'tr' ? 'Tamamla' : 'Complete')}
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
                                                viewBox={getViewBoxWithDimensions(unit.width, unit.height)} 
                                                className="w-full h-full max-h-full max-w-full p-1"
                                                preserveAspectRatio="xMidYMid meet"
                                              >
                                                <Visualizer node={unit.rootNode} width={unit.width} height={unit.height} system={getSystemForUnit(unit, systems)} selectedNodeId={null} onSelectNode={() => {}} shape={unit.shape} archHeight={unit.archHeight} theme="light" hasThreshold={unit.hasThreshold} lang={lang} viewPerspective={unit.viewPerspective} />
                                              </svg>
                                            </div>
                                            <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2.5 backdrop-blur-[2px] print:hidden">
                                                <button onClick={() => onEditUnit(unit)} className="p-2.5 bg-blue-500 rounded-xl text-white hover:scale-110 transition-transform shadow-lg shadow-blue-500/20" title={t(lang, 'edit')}><Edit2 size={18}/></button>
                                                <button onClick={() => handleDuplicateUnit(unit)} className="p-2.5 bg-indigo-500 rounded-xl text-white hover:scale-110 transition-transform shadow-lg shadow-indigo-500/20" title={lang === 'tr' ? 'Pozu Kopyala (Çoğalt)' : 'Duplicate Position'}><Copy size={18}/></button>
                                                <button onClick={() => handleExportDXF(unit)} className="p-2.5 bg-emerald-500 rounded-xl text-white hover:scale-110 transition-transform shadow-lg shadow-emerald-500/20" title={t(lang, 'downloadDxf')}><Download size={18}/></button>
                                                <button onClick={() => onDeleteUnit(unit.id)} className="p-2.5 bg-rose-500 rounded-xl text-white hover:scale-110 transition-transform shadow-lg shadow-rose-500/20" title={t(lang, 'deleteUnit')}><Trash2 size={18}/></button>
                                            </div>
                                        </div>
                                        <div className="p-5 print:p-3">
                                            <div className="flex justify-between items-start mb-3">
                                              <div className="flex flex-col min-w-0 flex-1">
                                                <div className="flex items-center gap-2">
                                                  <h3 className="font-bold text-white text-sm truncate pr-2 print:text-black">{unit.name}</h3>
                                                  <button 
                                                    onClick={() => handleDuplicateUnit(unit)}
                                                    className="print:hidden text-[10px] font-bold text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 px-2 py-0.5 rounded border border-indigo-500/20 flex items-center gap-1 transition-colors"
                                                    title={lang === 'tr' ? 'Pozu Çoğalt' : 'Duplicate'}
                                                  >
                                                    <Copy size={10} /> {lang === 'tr' ? 'Kopyala' : 'Copy'}
                                                  </button>
                                                </div>
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
                                                  <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold uppercase tracking-tight ${unit.viewPerspective === 'exterior' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20 print:text-amber-800 print:bg-amber-50 print:border-amber-200' : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20 print:text-indigo-800 print:bg-indigo-50 print:border-indigo-200'}`}>
                                                    {unit.viewPerspective === 'exterior' ? (lang === 'tr' ? 'Görünüm: Dıştan' : 'View: Exterior') : (lang === 'tr' ? 'Görünüm: İçten' : 'View: Interior')}
                                                  </span>
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

                    {/* Shading & Pergola Systems under the same details view */}
                    {project.shadingItems && project.shadingItems.length > 0 && (
                        <div className="mt-12 space-y-6">
                            <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                                <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-2xl">
                                    <Box size={20} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-white uppercase tracking-tight">
                                        {lang === 'tr' ? 'GÖLGELENDİRME VE PERGOLE SİSTEMLERİ' : 'SHADING & PERGOLA SYSTEMS'}
                                    </h3>
                                    <p className="text-xs text-slate-400">
                                        {lang === 'tr' ? 'Projedeki akıllı bioklimatik pergola, rolling roof, zip perde ve giyotin cam pozları.' : 'Configured smart pergolas, zip blinds, and guillotine systems inside this project.'}
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 print:grid-cols-2 print:gap-4">
                                {project.shadingItems.map((item, index) => {
                                    return (
                                        <div key={item.id} className="bg-slate-800 border border-slate-700 rounded-[1.5rem] overflow-hidden group hover:border-indigo-500/50 transition-all flex flex-col shadow-sm relative avoid-break print:bg-white print:border-slate-200">
                                            <div className="flex flex-col h-full">
                                                <div className="aspect-[4/3] bg-slate-900 relative flex items-center justify-center p-4 border-b border-slate-700 overflow-hidden print:bg-white print:border-slate-200">
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <svg 
                                                            viewBox="0 0 200 150" 
                                                            className="w-full h-full max-h-full max-w-full"
                                                            preserveAspectRatio="xMidYMid meet"
                                                        >
                                                            {renderRealisticShadingSVG(item)}
                                                        </svg>
                                                    </div>
                                                    <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 backdrop-blur-[2px] print:hidden">
                                                        <button 
                                                            onClick={() => {
                                                                setEditingShadingItem(item);
                                                                setShadingFormProduct(item.productType);
                                                                setShadingFormName(item.name);
                                                                setShadingFormWidth(item.width);
                                                                setShadingFormHeight(item.height);
                                                                setShadingFormDepth(item.depth || 3000);
                                                                setShadingFormFrontHeight(item.frontHeight || item.height || 2500);
                                                                setShadingFormBackHeight(item.backHeight || item.height || 2500);
                                                                setShadingFormQty(item.quantity || 1);
                                                                setShadingFormPrice(item.unitPrice || 4500);
                                                                setShadingFormColor(item.color || 'RAL 7016 Antrasit Gri');
                                                                setShadingFormNotes(item.notes || '');
                                                                setShadingFormImageUrl(item.imageUrl || '');
                                                                setShadingFormPlanSectionUrl(item.planSectionUrl || '');
                                                                setShadingFormCrossSectionUrl(item.crossSectionUrl || '');
                                                                setShadingFormPlanSectionProfileCode(item.planSectionProfileCode || '');
                                                                setShadingFormCrossSectionProfileCode(item.crossSectionProfileCode || '');
                                                                setShowAddShadingModal(true);
                                                            }} 
                                                            className="p-3 bg-blue-500 rounded-xl text-white hover:scale-110 transition-transform shadow-lg shadow-blue-500/20" 
                                                            title={t(lang, 'edit')}
                                                        >
                                                            <Edit2 size={20}/>
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDeleteShadingItem(item.id)} 
                                                            className="p-3 bg-rose-500 rounded-xl text-white hover:scale-110 transition-transform shadow-lg shadow-rose-500/20" 
                                                            title={lang === 'tr' ? 'Sistemi Sil' : 'Delete Shading Item'}
                                                        >
                                                            <Trash2 size={20}/>
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="p-5 print:p-3">
                                                    <div className="flex justify-between items-start mb-3">
                                                        <div className="flex flex-col min-w-0 flex-1">
                                                            <h3 className="font-bold text-white text-sm truncate pr-2 print:text-black">{item.name}</h3>
                                                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                                                <span className="text-[9px] bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-500/20 font-bold uppercase tracking-tight print:text-slate-500 print:bg-slate-50 print:border-slate-200">
                                                                    {item.color}
                                                                </span>
                                                                <span className="text-[9px] bg-slate-950 text-slate-400 px-1.5 py-0.5 rounded border border-white/5 font-mono font-bold uppercase tracking-tight print:text-slate-500 print:bg-slate-50 print:border-slate-200">
                                                                    {item.quantity || 1} {lang === 'tr' ? 'ADET' : 'QTY'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <span className="text-emerald-400 font-mono font-bold text-sm print:text-emerald-700 shrink-0">
                                                            {currencySymbol}{(item.unitPrice * (item.quantity || 1)).toLocaleString()}
                                                        </span>
                                                    </div>
                                                    <div className="grid grid-cols-4 gap-1.5">
                                                        <div className="bg-slate-900/50 p-2 rounded-xl border border-white/5 print:bg-slate-50 print:border-slate-200">
                                                            <label className="block text-[8px] text-slate-500 mb-0.5 uppercase font-bold tracking-widest print:text-slate-400">{t(lang, 'width') || 'En'}</label>
                                                            <div className="text-white font-mono font-bold text-[11px] print:text-black">{item.width} mm</div>
                                                        </div>
                                                        <div className="bg-slate-900/50 p-2 rounded-xl border border-white/5 print:bg-slate-50 print:border-slate-200">
                                                            <label className="block text-[8px] text-slate-500 mb-0.5 uppercase font-bold tracking-widest print:text-slate-400">{lang === 'tr' ? 'Açılım' : 'Projection'}</label>
                                                            <div className="text-white font-mono font-bold text-[11px] print:text-black">{item.depth || 0} mm</div>
                                                        </div>
                                                        <div className="bg-slate-900/50 p-2 rounded-xl border border-white/5 print:bg-slate-50 print:border-slate-200">
                                                            <label className="block text-[8px] text-slate-500 mb-0.5 uppercase font-bold tracking-widest print:text-slate-400">{lang === 'tr' ? 'Ön Yük.' : 'Fr. Height'}</label>
                                                            <div className="text-white font-mono font-bold text-[11px] print:text-black">{item.frontHeight || item.height || 0} mm</div>
                                                        </div>
                                                        <div className="bg-slate-900/50 p-2 rounded-xl border border-white/5 print:bg-slate-50 print:border-slate-200">
                                                            <label className="block text-[8px] text-slate-500 mb-0.5 uppercase font-bold tracking-widest print:text-slate-400">{lang === 'tr' ? 'Arka Yük.' : 'Bk. Height'}</label>
                                                            <div className="text-white font-mono font-bold text-[11px] print:text-black">{item.backHeight || item.height || 0} mm</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                            })}
                        </div>
                    </div>
                )}
            </>
        )}



            {activeTab === 'quote' && (
                <div className="animate-in slide-in-from-right-4 duration-300">
                    {/* Quoting Display Controls */}
                    <div className="mb-6 p-5 bg-slate-900 border border-slate-800 rounded-[2rem] print:hidden flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-blue-500/10 text-blue-400 rounded-2xl">
                                <Sliders size={18} />
                            </div>
                            <div>
                                <div className="text-white text-xs font-black uppercase tracking-wider">
                                    {lang === 'tr' ? 'Teklif İnceleme & Baskı Seçenekleri' : 'Proposal Configuration & Print Options'}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                    {lang === 'tr' ? 'Maliyet detaylarını gizleyebilir, PDF çıktısı için şirket logonuzu yükleyebilirsiniz.' : 'Toggle cost details and upload a custom corporate logo for your print/PDF sheets.'}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 flex-wrap lg:flex-nowrap">
                            {/* Logo Uploader Widget */}
                            <div className="flex items-center gap-3 bg-slate-950 px-4 py-2 rounded-xl border border-slate-800">
                                <span className="text-xs font-bold text-slate-450">{lang === 'tr' ? 'Logo:' : 'Logo:'}</span>
                                {companyLogo ? (
                                    <div className="flex items-center gap-2">
                                        <img src={companyLogo} alt="Logo Preview" className="h-7 w-auto object-contain bg-white rounded border border-slate-700 p-0.5" />
                                        <button 
                                            type="button"
                                            onClick={handleRemoveLogo}
                                            className="text-[10px] bg-red-500/15 text-red-400 hover:bg-red-500/25 px-2 py-1 rounded-md font-bold transition"
                                        >
                                            {lang === 'tr' ? 'Sil' : 'Remove'}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="relative cursor-pointer text-xs font-bold text-blue-400 hover:text-blue-300">
                                        <input 
                                            type="file" 
                                            accept="image/*" 
                                            onChange={handleLogoUpload} 
                                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" 
                                        />
                                        <span>{lang === 'tr' ? 'Yükle' : 'Upload'}</span>
                                    </div>
                                )}
                            </div>

                            <label className="flex items-center gap-2 cursor-pointer select-none bg-slate-950 px-4 py-2.5 rounded-xl border border-slate-800 hover:border-slate-700 transition" id="quote-cost-details-toggle">
                                <input
                                    type="checkbox"
                                    checked={showCostDetails}
                                    onChange={e => handleToggleCostDetails(e.target.checked)}
                                    className="rounded border-slate-700 bg-slate-950 text-blue-500 focus:ring-0 focus:ring-offset-0 w-4 h-4 cursor-pointer"
                                />
                                <span className="text-xs font-bold text-slate-300">
                                    {lang === 'tr' ? 'Maliyet Detaylarını Göster' : 'Show Cost/Expense Details'}
                                </span>
                            </label>

                            <label className="flex items-center gap-2 cursor-pointer select-none bg-slate-950 px-4 py-2.5 rounded-xl border border-slate-800 hover:border-slate-700 transition" id="quote-material-list-toggle">
                                <input
                                    type="checkbox"
                                    checked={showMaterialList}
                                    onChange={e => handleToggleMaterialList(e.target.checked)}
                                    className="rounded border-slate-700 bg-slate-950 text-blue-500 focus:ring-0 focus:ring-offset-0 w-4 h-4 cursor-pointer"
                                />
                                <span className="text-xs font-bold text-slate-300">
                                    {lang === 'tr' ? 'Malzeme Listesini Göster' : 'Show Material List'}
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
                            <div className="flex items-start gap-5">
                                {companyLogo && (
                                    <div className="relative group/logo shrink-0">
                                        <img src={companyLogo} alt="Company Logo" className="max-h-20 max-w-[150px] object-contain rounded-lg border border-slate-250 p-1 bg-white" />
                                        <button 
                                            onClick={handleRemoveLogo} 
                                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 print:hidden shadow hover:bg-red-600 transition"
                                            title={lang === 'tr' ? 'Logoyu Sil' : 'Remove Logo'}
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                )}
                                <div>
                                    <h1 className="text-4xl font-black text-slate-900 mb-2 uppercase tracking-tight">{t(lang, 'printQuote')}</h1>
                                    <div className="text-sm font-black text-blue-600 font-mono tracking-widest uppercase mb-2">
                                        {lang === 'tr' ? 'TEKLİF NO' : 'QUOTE REF'}: {project.projectNumber || `ALU-${new Date(project.date).getFullYear() || 2026}-${project.id.slice(0, 4).toUpperCase()}`}
                                    </div>
                                    <p className="text-slate-500 font-bold uppercase tracking-widest text-xs flex items-center gap-2">
                                        <Globe size={14} className="text-blue-600" /> ALUMETRIC Engineering Suite • {project.date}
                                    </p>
                                </div>
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
                                        <th className="py-4 px-2 print:py-2 text-left text-xs font-black uppercase tracking-widest text-slate-500 w-[5%] print:w-[5%]">POS</th>
                                        <th className="py-4 px-2 print:py-2 text-left text-xs font-black uppercase tracking-widest text-slate-500 w-[40%] print:w-[42%]">{t(lang, 'technicalDrawing')}</th>
                                        <th className="py-4 px-2 print:py-2 text-left text-xs font-black uppercase tracking-widest text-slate-500 w-[28%] print:w-[28%]">{t(lang, 'details')}</th>
                                        <th className="py-4 px-2 print:py-2 text-center text-xs font-black uppercase tracking-widest text-slate-500 w-[5%] print:w-[5%]">{t(lang, 'quantity')}</th>
                                        <th className="py-4 px-2 print:py-2 text-right text-xs font-black uppercase tracking-widest text-slate-500 w-[11%] print:w-[10%]">{t(lang, 'unitPrice')}</th>
                                        <th className="py-4 px-2 print:py-2 text-right text-xs font-black uppercase tracking-widest text-slate-500 w-[11%] print:w-[10%]">{t(lang, 'totalPrice')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {project.units.map((unit, idx) => {
                                        const stats = getUnitStats(unit);
                                        const sys = getSystemForUnit(unit, systems);
                                        // Dynamic Profile Drawing Library Resolution
                                        const selectedFrameCode = unit.selectedFrameProfile;
                                        const selectedSashCode = unit.selectedSashProfile;
                                        const selectedMullionCode = unit.selectedMullionProfile;

                                        const normDraw = (c: string) => c.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/70th/, '70t');
                                         const findDrawing = (code: string | undefined) => {
                                             if (!code) return undefined;
                                             
                                             // 1. Check user uploaded custom profile images first
                                             const targetNorm = normDraw(code);
                                             const matchedKey = Object.keys(mergedProfileImages).find(k => normDraw(k) === targetNorm);
                                             if (matchedKey) {
                                                 const base64 = mergedProfileImages[matchedKey];
                                                 return {
                                                     code: code,
                                                     crossSectionUrl: base64,
                                                     planSectionUrl: base64
                                                 };
                                             }

                                             // 2. Fall back to system catalog drawings
                                             if (!sys?.profileDrawings) return undefined;
                                             const matches = sys.profileDrawings.filter(d => normDraw(d.code) === targetNorm);
                                             if (matches.length === 0) return undefined;
                                             const withUrls = matches.find(d => d.planSectionUrl || d.crossSectionUrl);
                                             return withUrls || matches[0];
                                         };
                                         const frameDraw = findDrawing(selectedFrameCode);
                                         const sashDraw = findDrawing(selectedSashCode);
                                         const mullionDraw = findDrawing(selectedMullionCode);

                                        const hasSash = hasOpenablePanes(unit.rootNode);
                                        const hasMullion = unit.rootNode && (unit.rootNode.type === 'container' || JSON.stringify(unit.rootNode).includes('"children":'));

                                        // 1. Resolve Plan Section URL & Code
                                        let planSectionUrl = '';
                                        let planSectionCode = '';
                                        if (unit.planSectionUrl) {
                                            planSectionUrl = unit.planSectionUrl;
                                            planSectionCode = unit.planSectionProfileCode || '';
                                        } else if (hasMullion && mullionDraw?.planSectionUrl) {
                                            planSectionUrl = mullionDraw.planSectionUrl;
                                            planSectionCode = mullionDraw.code;
                                        } else if (hasSash && sashDraw?.planSectionUrl) {
                                            planSectionUrl = sashDraw.planSectionUrl;
                                            planSectionCode = sashDraw.code;
                                        } else if (frameDraw?.planSectionUrl) {
                                            planSectionUrl = frameDraw.planSectionUrl;
                                            planSectionCode = frameDraw.code;
                                        } else {
                                            if (hasSash && sys?.sashPlanSectionUrl) {
                                                planSectionUrl = sys.sashPlanSectionUrl;
                                                planSectionCode = sys.sashPlanSectionProfileCode || '';
                                            } else if (hasMullion && sys?.mullionPlanSectionUrl) {
                                                planSectionUrl = sys.mullionPlanSectionUrl;
                                                planSectionCode = sys.mullionPlanSectionProfileCode || '';
                                            } else if (sys?.framePlanSectionUrl) {
                                                planSectionUrl = sys.framePlanSectionUrl;
                                                planSectionCode = sys.framePlanSectionProfileCode || '';
                                            } else {
                                                planSectionUrl = sys?.planSectionUrl || '';
                                                planSectionCode = sys?.planSectionProfileCode || '';
                                            }
                                        }

                                        // 2. Resolve Vertical Section URL & Code
                                        let verticalSectionUrl = '';
                                        let verticalSectionCode = '';
                                        if (unit.crossSectionUrl) {
                                            verticalSectionUrl = unit.crossSectionUrl;
                                            verticalSectionCode = unit.crossSectionProfileCode || '';
                                        } else if (hasMullion && mullionDraw?.crossSectionUrl) {
                                            verticalSectionUrl = mullionDraw.crossSectionUrl;
                                            verticalSectionCode = mullionDraw.code;
                                        } else if (hasSash && sashDraw?.crossSectionUrl) {
                                            verticalSectionUrl = sashDraw.crossSectionUrl;
                                            verticalSectionCode = sashDraw.code;
                                        } else if (frameDraw?.crossSectionUrl) {
                                            verticalSectionUrl = frameDraw.crossSectionUrl;
                                            verticalSectionCode = frameDraw.code;
                                        } else {
                                            if (hasSash && sys?.sashCrossSectionUrl) {
                                                verticalSectionUrl = sys.sashCrossSectionUrl;
                                                verticalSectionCode = sys.sashCrossSectionProfileCode || '';
                                            } else if (hasMullion && sys?.mullionCrossSectionUrl) {
                                                verticalSectionUrl = sys.mullionCrossSectionUrl;
                                                verticalSectionCode = sys.mullionCrossSectionProfileCode || '';
                                            } else if (sys?.frameCrossSectionUrl) {
                                                verticalSectionUrl = sys.frameCrossSectionUrl;
                                                verticalSectionCode = sys.frameCrossSectionProfileCode || '';
                                            } else {
                                                verticalSectionUrl = sys?.crossSectionUrl || '';
                                                verticalSectionCode = sys?.crossSectionProfileCode || '';
                                            }
                                        }

                                        return (
                                            <tr key={unit.id} className="border-b border-slate-100 group print:break-inside-avoid">
                                                <td className="py-6 px-2 print:py-2.5 print:px-1 align-top font-black text-slate-400 w-[5%] print:w-[5%]">#{(idx + 1).toString().padStart(2, '0')}</td>
                                                <td className="py-6 px-2 print:py-2.5 print:px-1 align-top w-[40%] print:w-[42%]">
                                                    <div className="flex flex-col gap-1.5 max-w-[320px] print:max-w-[280px]">
                                                        {/* Elevation drawing & side cross section */}
                                                        <div className="flex items-center gap-2">
                                                             {/* Elevation Front View */}
                                                             <div className="w-56 h-56 print:w-[230px] print:h-[230px] quote-elevation-box bg-white rounded-xl border border-slate-200 p-2 print:p-1.5 flex items-center justify-center shrink-0 shadow-sm overflow-hidden" style={{ minWidth: '220px', minHeight: '220px' }}>
                                                                <svg 
                                                                  viewBox={getViewBoxWithDimensions(unit.width, unit.height)} 
                                                                  className="w-full h-full max-h-full max-w-full"
                                                                  preserveAspectRatio="xMidYMid meet"
                                                                >
                                                                  <Visualizer node={unit.rootNode} width={unit.width} height={unit.height} system={sys || systems[0]} selectedNodeId={null} onSelectNode={() => {}} theme="light" shape={unit.shape} archHeight={unit.archHeight} hasThreshold={unit.hasThreshold} lang={lang} viewPerspective={unit.viewPerspective} />
                                                                </svg>
                                                             </div>

                                                             {/* Boy Kesit (Y-Y dikey kesit) */}
                                                             <div className="w-14 h-56 print:w-[48px] print:h-[230px] quote-boykesit-box bg-white rounded-xl border border-slate-200 p-1 flex flex-col items-center justify-center shrink-0 overflow-hidden relative shadow-sm" style={{ maxHeight: '230px' }}>
                                                                 {verticalSectionUrl ? (
                                                                     <img src={verticalSectionUrl} alt="Boy Kesit" className="max-w-full max-h-full object-contain m-auto" style={{ maxHeight: '200px', maxWidth: '44px', objectFit: 'contain' }} referrerPolicy="no-referrer" />
                                                                 ) : (
                                                                     <BoyKesitSVG width={unit.width} height={unit.height} system={sys} isOpenable={hasOpenablePanes(unit.rootNode)} lang={lang} />
                                                                 )}
                                                                 {verticalSectionCode && (
                                                                     <div className="text-[7px] text-slate-400 font-mono text-center truncate w-full px-0.5 mt-0.5 print:text-[6px]">
                                                                         {verticalSectionCode}
                                                                     </div>
                                                                 )}
                                                             </div>
                                                        </div>

                                                        {/* Plan Kesit (X-X yatay kesit) */}
                                                        <div className="w-full max-w-[290px] print:max-w-[280px] h-12 print:h-12 quote-plankesit-box bg-white rounded-xl border border-slate-200 p-1 flex items-center justify-center shrink-0 overflow-hidden relative shadow-sm" style={{ height: '48px', maxHeight: '48px' }}>
                                                            {planSectionUrl ? (
                                                                <img src={planSectionUrl} alt="Plan Kesit" className="max-w-full max-h-full object-contain m-auto" style={{ maxHeight: '42px', maxWidth: '270px', objectFit: 'contain' }} referrerPolicy="no-referrer" />
                                                            ) : (
                                                                <PlanKesitSVG width={unit.width} height={unit.height} system={sys} isOpenable={hasOpenablePanes(unit.rootNode)} lang={lang} />
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-6 px-2 print:py-2.5 print:px-1 align-top w-[28%] print:w-[28%]">
                                                    <div className="font-black text-slate-900 text-lg mb-1">{unit.name}</div>
                                                    <div className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-4">
                                                        {sys?.name} {sys?.materialType === 'pvc' && <span className="ml-1.5 px-1 bg-amber-500/10 text-amber-600 border border-amber-500/15 rounded text-[8px] font-extrabold tracking-normal">PVC</span>}
                                                    </div>
                                                    <div className="space-y-1 mb-4">
                                                        <div className="text-xs text-slate-500 flex justify-between w-[240px] font-medium"><span>{lang === 'tr' ? 'Profil Sistemi' : 'Profile System'}:</span> <span className="font-bold text-blue-700">{sys?.name} {sys?.materialType === 'pvc' && ' (PVC)'}</span></div><div className="text-xs text-slate-500 flex justify-between w-[240px] font-medium"><span>{t(lang, 'width')}:</span> <span className="font-bold text-slate-900">{unit.width} mm</span></div>
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
                                                              {showCostDetails && stats.tiltTurnLaborCost > 0 && (
                                                                <div className="text-xs text-slate-500 flex justify-between w-[240px] font-medium">
                                                                  <span>{lang === 'tr' ? `Çift Açılım Montajı (${stats.tiltTurnCount} Adet):` : `Tilt-Turn Labor (${stats.tiltTurnCount} Qty):`}</span>
                                                                  <span className="font-bold text-slate-900 font-mono">
                                                                    {currencySymbol}{stats.tiltTurnLaborCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                  </span>
                                                                </div>
                                                              )}
                                                              {showCostDetails && stats.hbsbLaborCost > 0 && (
                                                                <div className="text-xs text-slate-500 flex justify-between w-[240px] font-medium">
                                                                  <span>{lang === 'tr' ? `HBSB Sürme Montajı (${stats.slidingCount} Kanat):` : `HBSB Sliding Labor (${stats.slidingCount} Sash):`}</span>
                                                                  <span className="font-bold text-slate-900 font-mono">
                                                                    {currencySymbol}{stats.hbsbLaborCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                                                         <div className="text-xs text-slate-500 flex justify-between w-[240px] font-medium">
                                                           <span>{lang === 'tr' ? 'Bakış / Görünüm' : 'View Perspective'}:</span>
                                                           <span className={`font-bold ${unit.viewPerspective === 'exterior' ? 'text-amber-600' : 'text-indigo-600'}`}>
                                                             {unit.viewPerspective === 'exterior' ? (lang === 'tr' ? 'Dıştan Görünüm' : 'Exterior View') : (lang === 'tr' ? 'İçten Görünüm (Standart)' : 'Interior View (Standard)')}
                                                           </span>
                                                         </div>
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

                                    {/* Shading System Items Added to Commercial Proposal */}
                                    {(project.shadingItems || []).map((item, sIdx) => {
                                        const posIdx = project.units.length + sIdx + 1;
                                        const finalItemCost = item.unitPrice * item.quantity;
                                        
                                        // Parse Color group
                                        let hexColor = '#2d3748';
                                        if (item.color.toLowerCase().includes('gri') || item.color.toLowerCase().includes('grey') || item.color.toLowerCase().includes('7016')) {
                                            hexColor = '#2b313d';
                                        } else if (item.color.toLowerCase().includes('beyaz') || item.color.toLowerCase().includes('white') || item.color.toLowerCase().includes('9010')) {
                                            hexColor = '#e2e8f0';
                                        } else if (item.color.toLowerCase().includes('krem') || item.color.toLowerCase().includes('cream') || item.color.toLowerCase().includes('1013')) {
                                            hexColor = '#fef3c7';
                                        } else if (item.color.toLowerCase().includes('bronz') || item.color.toLowerCase().includes('bronze')) {
                                            hexColor = '#7c2d12';
                                        }

                                        const priceDetails = calculateShadingItemPrice(item, shadingConfig);
                                        const scaleFactor = priceDetails.totalCost > 0 ? (item.unitPrice / priceDetails.totalCost) : 1;

                                        return (
                                            <tr key={item.id} className="border-b border-slate-100 group print:break-inside-avoid">
                                                <td className="py-6 px-2 print:py-2.5 print:px-1 align-top font-black text-slate-400 w-[5%] print:w-[5%]">#{posIdx.toString().padStart(2, '0')}</td>
                                                <td className="py-6 px-2 print:py-2.5 print:px-1 align-top w-[40%] print:w-[42%]">
                                                    <div className="flex flex-col gap-1.5 max-w-[320px] print:max-w-[280px]">
                                                        {/* Main image & side cross section */}
                                                        <div className="flex items-center gap-2">
                                                             {/* Main Image View */}
                                                             <div className="w-56 h-56 print:w-[230px] print:h-[230px] quote-elevation-box bg-white rounded-xl border border-slate-200 p-2 print:p-1.5 flex items-center justify-center shrink-0 relative overflow-hidden shadow-sm" style={{ minWidth: '220px', minHeight: '220px' }}>
                                                                 {item.imageUrl ? (
                                                                     <img src={item.imageUrl} alt={item.name} className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
                                                                 ) : (
                                                                     <svg 
                                                                         viewBox="0 0 200 150" 
                                                                         className="w-full h-full max-h-full max-w-full"
                                                                         preserveAspectRatio="xMidYMid meet"
                                                                     >
                                                                         {renderRealisticShadingSVG(item)}
                                                                     </svg>
                                                                 )}
                                                             </div>

                                                             {/* Boy Kesiti (Vertical Cross Section) on the right */}
                                                             <div className="w-14 h-56 print:w-[48px] print:h-[230px] quote-boykesit-box bg-white rounded-xl border border-slate-200 p-1 flex flex-col items-center justify-center shrink-0 overflow-hidden relative shadow-sm" style={{ maxHeight: '230px' }}>
                                                                 {item.crossSectionUrl ? (
                                                                     <>
                                                                         <img src={item.crossSectionUrl} alt="Boy Kesit" className="max-w-full max-h-full object-contain m-auto" style={{ maxHeight: '200px', maxWidth: '44px', objectFit: 'contain' }} referrerPolicy="no-referrer" />
                                                                         {item.crossSectionProfileCode && (
                                                                             <div className="absolute bottom-0 inset-x-0 bg-indigo-600 text-[7px] font-black text-white py-0.5 text-center truncate uppercase tracking-wider leading-none">
                                                                                 {item.crossSectionProfileCode}
                                                                             </div>
                                                                         )}
                                                                     </>
                                                                 ) : (
                                                                     <div className="text-[8px] font-bold text-slate-400 uppercase text-center px-0.5 leading-none">
                                                                         {lang === 'tr' ? 'BOY KESİTİ' : 'VERT. SECTION'}
                                                                     </div>
                                                                 )}
                                                             </div>
                                                        </div>

                                                        {/* Plan Kesit (Plan Section) under the main image */}
                                                        <div className="w-full max-w-[290px] print:max-w-[280px] h-12 print:h-12 quote-plankesit-box bg-white rounded-xl border border-slate-200 p-1 flex items-center justify-center shrink-0 overflow-hidden relative shadow-sm" style={{ height: '48px', maxHeight: '48px' }}>
                                                             {item.planSectionUrl ? (
                                                                 <img src={item.planSectionUrl} alt="Plan Kesit" className="max-w-full max-h-full object-contain m-auto" style={{ maxHeight: '42px', maxWidth: '270px', objectFit: 'contain' }} referrerPolicy="no-referrer" />
                                                             ) : (
                                                                 <div className="text-[8px] font-bold text-slate-400 uppercase tracking-wider text-center">
                                                                     {lang === 'tr' ? 'PLAN KESİTİ' : 'PLAN SECTION'}
                                                                 </div>
                                                             )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-6 px-2 print:py-2.5 print:px-1 align-top w-[28%] print:w-[28%]">
                                                    <div className="font-black text-slate-900 text-lg mb-1">{item.name}</div>
                                                    <div className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-4">
                                                        {item.productType === 'bioclimatic-pergola' && (lang === 'tr' ? 'Bioklimatik Pergole Entegrasyonu' : 'Bioclimatic Pergola Shading')}
                                                        {item.productType === 'rolling-roof' && (lang === 'tr' ? 'Katlanır Rolling Tavan Entegrasyonu' : 'Rolling Roof Shading')}
                                                        {item.productType === 'zip-blind' && (lang === 'tr' ? 'Dış Cephe Zip Perde Sistemi' : 'Facade Zip Screen Sunshade')}
                                                        {item.productType === 'awning' && (lang === 'tr' ? 'Mafsallı Katlanır Tente' : 'Foldable Retractable Awning')}
                                                        {item.productType === 'guillotine' && (lang === 'tr' ? 'Somfy Motorlu Giyotin Cam Sistemi' : 'Motorized Guillotine Glass Window')}
                                                        {item.productType === 'glass-balcony' && (lang === 'tr' ? 'Eşiksiz Cam Balkon Kapatma' : 'Folding Glass Balcony Glazing')}
                                                        {item.productType === 'retractable-glass' && (lang === 'tr' ? 'Hareketli Motorlu Cam Tavan Entegrasyonu' : 'Retractable Motorized Glass Roof')}
                                                        {!['bioclimatic-pergola', 'rolling-roof', 'zip-blind', 'awning', 'guillotine', 'glass-balcony', 'retractable-glass'].includes(item.productType) && (lang === 'tr' ? 'Özel 3D Gölgelendirme Sistemi' : 'Custom 3D Shading System')}
                                                    </div>
                                                    <div className="space-y-1 mb-4">
                                                        <div className="text-xs text-slate-500 flex justify-between w-[240px] font-medium font-sans"><span>{t(lang, 'width') || 'Genişlik'}:</span> <span className="font-bold text-slate-900 font-mono">{item.width} mm</span></div>
                                                        <div className="text-xs text-slate-500 flex justify-between w-[240px] font-medium font-sans"><span>{lang === 'tr' ? 'Açılım:' : 'Projection Depth:'}</span> <span className="font-bold text-slate-900 font-mono">{item.depth || 0} mm</span></div>
                                                        <div className="text-xs text-slate-500 flex justify-between w-[240px] font-medium font-sans"><span>{lang === 'tr' ? 'Ön Yükseklik:' : 'Front Height:'}</span> <span className="font-bold text-slate-900 font-mono">{item.frontHeight || item.height} mm</span></div>
                                                        <div className="text-xs text-slate-500 flex justify-between w-[240px] font-medium font-sans"><span>{lang === 'tr' ? 'Arka Yükseklik:' : 'Back Height:'}</span> <span className="font-bold text-slate-900 font-mono">{item.backHeight || item.height} mm</span></div>
                                                        <div className="text-xs text-slate-500 flex justify-between w-[240px] font-medium font-sans"><span>{t(lang, 'area')}:</span> <span className="font-bold text-slate-900 font-mono">{((item.width * (item.depth && item.depth > 0 ? item.depth : item.height)) / 1000000).toFixed(2)} m²</span></div>
                                                        <div className="text-xs text-slate-500 flex justify-between w-[240px] font-medium font-sans"><span>{lang === 'tr' ? 'RAL Profil Boya Rengi:' : 'RAL Powder Coating Color:'}</span> <span className="font-bold text-slate-900">{item.color}</span></div>
                                                        {item.notes && <div className="text-xs text-slate-500 mt-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/50 max-w-sm italic">"{item.notes}"</div>}
                                                    </div>

                                                    {/* Shading Material Detail Breakdown with distributed markup */}
                                                    {priceDetails.materials && priceDetails.materials.length > 0 && (
                                                        <div className="mt-5 pt-4 border-t border-slate-200 max-w-lg avoid-break">
                                                            <div className="text-[10px] font-extrabold text-indigo-700 uppercase tracking-widest mb-2 flex items-center gap-1.5 print:text-indigo-900">
                                                                <Layers size={11} className="text-indigo-500 print:text-indigo-700" />
                                                                <span>{lang === 'tr' ? 'Poz Detaylı Malzeme Açılımı' : 'Position Detailed Material Breakdown'}</span>
                                                            </div>
                                                            <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden print:bg-white">
                                                                <table className="w-full text-left text-[10px] border-collapse">
                                                                    <thead>
                                                                        <tr className="bg-slate-100/80 border-b border-slate-200 font-bold text-slate-500 uppercase tracking-wider print:bg-slate-50">
                                                                            <th className="px-3 py-2 w-[45%]">{lang === 'tr' ? 'Malzeme / Sistem Bileşeni' : 'Material / Component'}</th>
                                                                            <th className="px-2 py-2 text-center w-[15%]">{lang === 'tr' ? 'Miktar' : 'Qty'}</th>
                                                                            <th className="px-2 py-2 text-right w-[20%]">{lang === 'tr' ? 'Birim' : 'Unit'}</th>
                                                                            <th className="px-3 py-2 text-right w-[20%]">{lang === 'tr' ? 'Toplam Fiyat' : 'Total Price'}</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-slate-100 text-slate-700 font-sans">
                                                                        {priceDetails.materials.map((mat, mIdx) => {
                                                                            const sellingCost = mat.cost * scaleFactor;
                                                                            const sellingTotal = mat.total * scaleFactor;
                                                                            return (
                                                                                <tr key={mIdx} className="hover:bg-slate-100/50 print:hover:bg-transparent">
                                                                                    <td className="px-3 py-2 align-middle">
                                                                                        <div className="font-bold text-slate-900 leading-tight">{mat.name}</div>
                                                                                        <div className="text-[8px] text-slate-400 font-mono mt-0.5">{mat.code}</div>
                                                                                    </td>
                                                                                    <td className="px-2 py-2 text-center font-mono font-bold text-slate-800 align-middle">
                                                                                        {(mat.qty * item.quantity).toFixed(1)}
                                                                                    </td>
                                                                                    <td className="px-2 py-2 text-right font-bold text-slate-500 uppercase tracking-wider text-[9px] align-middle">
                                                                                        {(() => {
                                                                                            const u = (mat.unit || '').toLowerCase();
                                                                                            if (lang === 'tr') {
                                                                                                if (u === 'm' || u === 'meter' || u === 'meters') return 'METRE';
                                                                                                if (u === 'pce' || u === 'pcs' || u === 'piece' || u === 'pieces' || u === 'adet') return 'ADET';
                                                                                                if (u === 'set') return 'SET';
                                                                                                return mat.unit.toUpperCase();
                                                                                            } else {
                                                                                                if (u === 'm' || u === 'meter' || u === 'meters') return 'METER';
                                                                                                if (u === 'pce' || u === 'pcs' || u === 'piece' || u === 'pieces' || u === 'adet') return 'PCS';
                                                                                                if (u === 'set') return 'SET';
                                                                                                return mat.unit.toUpperCase();
                                                                                            }
                                                                                        })()}
                                                                                    </td>
                                                                                    <td className="px-3 py-2 text-right font-mono font-extrabold text-slate-900 align-middle">
                                                                                        {currencySymbol}{(sellingTotal * item.quantity).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                                    </td>
                                                                                </tr>
                                                                            );
                                                                        })}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="py-8 px-2 print:py-3 print:px-1 align-top text-center font-black text-xl print:text-sm text-slate-800 w-[8%] print:w-[8%]">{item.quantity}</td>
                                                <td className="py-8 px-2 print:py-3 print:px-1 align-top text-right font-black text-lg print:text-xs text-slate-800 w-[11%] print:w-[11%] whitespace-nowrap">{currencySymbol}{item.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                <td className="py-8 px-2 print:py-3 print:px-1 align-top text-right font-black text-xl print:text-xs text-blue-600 w-[11%] print:w-[11%] whitespace-nowrap">{currencySymbol}{finalItemCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
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

                        {/* Material List Under Quote (No Prices) */}
                        {showMaterialList && (
                            <div className="mt-14 pt-10 border-t-2 border-slate-100 print:break-inside-avoid">
                                <div className="flex items-center gap-2 mb-6">
                                    <Package size={18} className="text-blue-600 print:text-slate-700" />
                                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-900">
                                        {lang === 'tr' ? 'MALZEME LİSTESİ' : 'MATERIAL LIST'}
                                    </h3>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Profiles List */}
                                    {optimizationSummary.length > 0 && (
                                        <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50">
                                            <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3 pb-2 border-b border-slate-200">
                                                {lang === 'tr' ? 'Alüminyum Profiller' : 'Aluminum Profiles'}
                                            </h4>
                                            <div className="space-y-2">
                                                {optimizationSummary.map((opt, idx) => {
                                                    const totalCutLengthM = opt.bars.reduce((acc, bar) => acc + bar.cuts.reduce((sum, cut) => sum + cut, 0), 0) / 1000;
                                                    return (
                                                        <div key={idx} className="flex justify-between items-center text-xs py-1.5 border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50 rounded px-1 transition-all">
                                                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                                <div className="w-10 h-10 bg-white rounded-md border border-slate-200/60 shadow-[0_1px_2px_rgba(0,0,0,0.02)] flex items-center justify-center p-1 shrink-0 select-none print:border-slate-350">
                                                                    <ProfileThumbnail profileLabel={opt.profileLabel} profileCode={opt.profileCode} customImages={mergedProfileImages} />
                                                                </div>
                                                                <div className="min-w-0 flex-1">
                                                                    <span className="font-bold text-slate-800 truncate block">
                                                                        {t(lang, opt.profileLabel as any) || opt.profileLabel}
                                                                    </span>
                                                                    <span className="text-[10px] text-slate-400 font-mono block truncate">
                                                                        {opt.profileCode} • {opt.systemName}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <div className="text-right ml-3 shrink-0">
                                                                <span className="font-mono font-black text-slate-850 block">{totalCutLengthM.toFixed(2)} m</span>
                                                                <span className="text-[10px] text-slate-400 block">{opt.totalBars} {lang === 'tr' ? 'Boy' : 'Bars'}</span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Accessories List */}
                                    {accessorySummary.length > 0 && (
                                        <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50">
                                            <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3 pb-2 border-b border-slate-200">
                                                {lang === 'tr' ? 'Aksesuar & Sarf Malzemeleri' : 'Accessories & Consumables'}
                                            </h4>
                                            <div className="space-y-2">
                                                {accessorySummary.map((acc, idx) => (
                                                    <div key={idx} className="flex justify-between items-center text-xs py-1.5 border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50 rounded px-1 transition-all">
                                                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                            <div className="w-10 h-10 bg-white rounded-md border border-slate-200/60 shadow-[0_1px_2px_rgba(0,0,0,0.02)] flex items-center justify-center p-1 shrink-0 select-none print:border-slate-350">
                                                                <AccessoryThumbnail accessoryName={acc.name} accessoryType={acc.type} accessoryId={acc.id} customImages={customAccessoryImages} />
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <span className="font-bold text-slate-800 truncate block">{acc.name}</span>
                                                                <span className="text-[10px] text-slate-400 uppercase tracking-widest block truncate">{t(lang, acc.type as any)}</span>
                                                            </div>
                                                        </div>
                                                        <div className="text-right ml-3 shrink-0">
                                                            <span className="font-mono font-black text-slate-850 block">
                                                                {acc.unit === 'pce' ? acc.quantity : acc.quantity.toFixed(1)}
                                                            </span>
                                                            <span className="text-[10px] text-slate-400 block uppercase tracking-tight">
                                                                {t(lang, acc.unit === 'pce' ? 'unitPce' : 'unitMeter')}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Glass List */}
                                    {glassOrders.length > 0 && (
                                        <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50 md:col-span-2">
                                            <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3 pb-2 border-b border-slate-200">
                                                {lang === 'tr' ? 'Cam Malzeme Listesi' : 'Glass Specifications'}
                                            </h4>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                {glassOrders.map((pane, idx) => (
                                                    <div key={idx} className="flex justify-between items-center text-xs py-1 border-b border-slate-100 last:border-b-0">
                                                        <div className="min-w-0 flex-1">
                                                            <span className="font-bold text-slate-800 truncate block">{pane.type}</span>
                                                            <span className="text-[10px] text-slate-400 font-mono uppercase">{pane.width} x {pane.height} mm</span>
                                                        </div>
                                                        <div className="text-right ml-4 flex gap-4">
                                                            <div className="text-right">
                                                                <span className="font-mono font-black text-slate-850">{pane.quantity}</span>
                                                                <span className="text-[10px] text-slate-400 block">{lang === 'tr' ? 'Adet' : 'Qty'}</span>
                                                            </div>
                                                            <div className="text-right min-w-[50px]">
                                                                <span className="font-mono font-black text-slate-850">{(pane.area * pane.quantity).toFixed(2)}</span>
                                                                <span className="text-[10px] text-slate-400 block">m²</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

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

            {activeTab === 'shading' && (
                <div className="space-y-8 animate-in fade-in duration-300 font-sans">
                    {/* Header bar */}
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2 mb-1.5">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-[10px] text-emerald-400 font-extrabold uppercase tracking-widest font-mono">
                                    {lang === 'tr' ? 'AÇIK ALAN VE GÖLGELENDİRME MOTORU AKTİF' : 'OUTDOOR LIVING & SHADING ENGINE ACTIVE'}
                                </span>
                            </div>
                            <h2 className="text-2xl font-black text-slate-100 uppercase tracking-tight flex flex-wrap items-center gap-2">
                                <span>{lang === 'tr' ? 'ALUMETRİK' : 'ALUMETRIC'}</span> 
                                <span className="text-indigo-400 font-medium font-sans">{lang === 'tr' ? 'GÖLGELENDİRME STÜDYOSU' : 'SHADING STUDIO'}</span>
                            </h2>
                            <p className="text-xs text-slate-400 mt-1 max-w-xl leading-relaxed">
                                {lang === 'tr' 
                                  ? 'Bioklimatik Pergola, Rolling Roof, Zip Perde, Giyotin Cam, Mafsallı Tente ve Cam Balkon sistemlerini parametrik olarak tasarlayın, teklif ve kesim listelerinizi anında oluşturun.' 
                                  : 'Parametrically design Bioclimatic Pergolas, Rolling Roofs, Zip Screens, Guillotine Glass, Retractable Awnings and Glass Balconies with instant quote calculation.'}
                            </p>
                        </div>

                        {/* Top Action buttons */}
                        <div className="flex flex-wrap items-center gap-3">
                            <a
                                href="https://shadevision-g-lgelendirme-tasar-mc-s-953554361433.europe-west2.run.app/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-3 rounded-xl flex items-center gap-2 font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-indigo-600/15"
                            >
                                <ExternalLink size={14} />
                                <span>{lang === 'tr' ? '3D TASARIMCIYI TAM EKRAN AÇ' : 'OPEN 3D DESIGNER FULLSCREEN'}</span>
                            </a>
                        </div>
                    </div>

                    {/* Shading Sub-Tabs */}
                    <div className="flex bg-slate-950 p-1.5 rounded-2xl border border-white/5 max-w-xl shadow-inner mb-6 print:hidden">
                        <button
                            onClick={() => setShadingSubTab('designer')}
                            className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 ${shadingSubTab === 'designer' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                            {lang === 'tr' ? '3D Tasarım & Sistem Parametreleri' : '3D Design & System Parameters'}
                        </button>
                        <button
                            onClick={() => setShadingSubTab('bom_opt')}
                            className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 ${shadingSubTab === 'bom_opt' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                            {lang === 'tr' ? 'Malzeme & Kesim Optimizasyonu' : 'Material & Cut Optimization'}
                        </button>
                    </div>

                    {shadingSubTab === 'designer' ? (
                        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
                        
                        {/* LEFT: Shading Parameters & Active Quotes List (Col: 5) */}
                        <div className="xl:col-span-5 space-y-6">
                            
                            {/* Card 1: System Configuration & Position Add Form */}
                            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
                                <h3 className="text-xs font-black uppercase tracking-wider text-slate-200 flex items-center gap-2">
                                    <PlusCircle size={15} className="text-blue-400" />
                                    <span>{lang === 'tr' ? 'GÖLGELENDİRME SİSTEMİ EKLE & PARAMETRELER' : 'ADD SHADING SYSTEM & PARAMETERS'}</span>
                                </h3>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <div className="flex justify-between items-center">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{lang === 'tr' ? 'Sistem Tipi' : 'System Type'}</label>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const nameTr = prompt(lang === 'tr' ? 'Yeni Sistem Tipi İsmi Girin (örn: Kış Bahçesi):' : 'Enter New System Type Name (e.g. Winter Garden):');
                                                    if (nameTr && nameTr.trim()) {
                                                        const nameEn = prompt(lang === 'tr' ? 'İngilizce İsmi Girin (İsteğe Bağlı):' : 'Enter English Name (Optional):') || nameTr;
                                                        const imageUrl = prompt(lang === 'tr' ? 'Ürün Tipi için Varsayılan Görsel Linki / URL (İsteğe Bağlı):' : 'Enter Default Image URL for Product Type (Optional):') || '';
                                                        handleAddCustomProductType(nameTr, nameEn, imageUrl);
                                                    }
                                                }}
                                                className="text-[9px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-0.5"
                                                title={lang === 'tr' ? 'Yeni Ürün Tipi Ekle' : 'Add New Product Type'}
                                            >
                                                <span>➕ {lang === 'tr' ? 'Yeni Ekle' : 'Add New'}</span>
                                            </button>
                                        </div>
                                        <select
                                            value={shadingFormProduct}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (val === 'ADD_NEW_PRODUCT_TYPE') {
                                                    const nameTr = prompt(lang === 'tr' ? 'Yeni Sistem Tipi İsmi Girin (örn: Kış Bahçesi):' : 'Enter New System Type Name (e.g. Winter Garden):');
                                                    if (nameTr && nameTr.trim()) {
                                                        const nameEn = prompt(lang === 'tr' ? 'İngilizce İsmi Girin (İsteğe Bağlı):' : 'Enter English Name (Optional):') || nameTr;
                                                        const imageUrl = prompt(lang === 'tr' ? 'Ürün Tipi için Varsayılan Görsel Linki / URL (İsteğe Bağlı):' : 'Enter Default Image URL for Product Type (Optional):') || '';
                                                        handleAddCustomProductType(nameTr, nameEn, imageUrl);
                                                    } else {
                                                        setShadingFormProduct(shadingFormProduct || 'bioclimatic-pergola');
                                                    }
                                                    return;
                                                }
                                                setShadingFormProduct(val);
                                                // auto-update default names and images based on type
                                                const found = productTypes.find(t => t.id === val);
                                                if (found) {
                                                    setShadingFormName(lang === 'tr' ? found.nameTr : found.nameEn);
                                                    if (found.imageUrl) {
                                                        setShadingFormImageUrl(found.imageUrl);
                                                    }
                                                }
                                            }}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 pr-8 text-slate-200 text-xs outline-none focus:border-indigo-500/50 appearance-none cursor-pointer"
                                        >
                                            {productTypes.map(pt => (
                                                <option key={pt.id} value={pt.id}>
                                                    {lang === 'tr' ? pt.nameTr : pt.nameEn}
                                                </option>
                                            ))}
                                            <option value="ADD_NEW_PRODUCT_TYPE" className="text-indigo-400 font-bold bg-slate-900">
                                                {lang === 'tr' ? '➕ Yeni Ürün Tipi Ekle...' : '➕ Add New Product Type...'}
                                            </option>
                                        </select>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{lang === 'tr' ? 'Özel Poz İsmi' : 'Position Name'}</label>
                                        <input
                                            type="text"
                                            value={shadingFormName}
                                            onChange={(e) => setShadingFormName(e.target.value)}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 text-xs outline-none focus:border-indigo-500/50"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-2">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{lang === 'tr' ? 'Genişlik (mm)' : 'Width (mm)'}</label>
                                        <input
                                            type="number"
                                            value={shadingFormWidth}
                                            onChange={(e) => setShadingFormWidth(Number(e.target.value))}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 text-xs font-mono outline-none focus:border-indigo-500/50"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{lang === 'tr' ? 'Yükseklik (mm)' : 'Height (mm)'}</label>
                                        <input
                                            type="number"
                                            value={shadingFormHeight}
                                            onChange={(e) => setShadingFormHeight(Number(e.target.value))}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 text-xs font-mono outline-none focus:border-indigo-500/50"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{lang === 'tr' ? 'Derinlik (mm)' : 'Depth (mm)'}</label>
                                        <input
                                            type="number"
                                            value={shadingFormDepth}
                                            onChange={(e) => setShadingFormDepth(Number(e.target.value))}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 text-xs font-mono outline-none focus:border-indigo-500/50"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-2">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{lang === 'tr' ? 'Adet' : 'Quantity'}</label>
                                        <input
                                            type="number"
                                            value={shadingFormQty}
                                            onChange={(e) => setShadingFormQty(Number(e.target.value))}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 text-xs font-mono outline-none focus:border-indigo-500/50"
                                        />
                                    </div>
                                    <div className="space-y-1 col-span-2">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{lang === 'tr' ? 'Birim Fiyat' : 'Unit Price'}</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                value={shadingFormPrice}
                                                onChange={(e) => setShadingFormPrice(Number(e.target.value))}
                                                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 text-xs font-mono outline-none focus:border-indigo-500/50 pr-8"
                                            />
                                            <span className="absolute right-3 top-2.5 text-xs text-slate-500 font-bold">{currencySymbol}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{lang === 'tr' ? 'Profil Rengi' : 'Profile Color'}</label>
                                        <input
                                            type="text"
                                            value={shadingFormColor}
                                            onChange={(e) => setShadingFormColor(e.target.value)}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 text-xs outline-none focus:border-indigo-500/50"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{lang === 'tr' ? 'Özel Notlar' : 'Custom Notes'}</label>
                                        <input
                                            type="text"
                                            value={shadingFormNotes}
                                            onChange={(e) => setShadingFormNotes(e.target.value)}
                                            placeholder={lang === 'tr' ? 'Motor, sensör, vb.' : 'Motor, sensor, etc.'}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 text-xs outline-none focus:border-indigo-500/50"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{lang === 'tr' ? 'Ürün Görseli (URL veya Seçim)' : 'Product Image (URL or Selection)'}</label>
                                    <input
                                        type="text"
                                        value={shadingFormImageUrl}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setShadingFormImageUrl(val);
                                            handleUpdateProductTypeImage(shadingFormProduct, val);
                                        }}
                                        placeholder={lang === 'tr' ? "VizyonPergola veya internet görsel linki yapıştırın..." : "Paste product image link..."}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 text-xs outline-none focus:border-indigo-500/50 font-mono"
                                    />
                                    
                                    <div className="flex flex-wrap gap-1.5 pt-1">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const url = 'https://images.unsplash.com/photo-1615874959474-d609969a20ed?w=600&auto=format&fit=crop';
                                                setShadingFormImageUrl(url);
                                                handleUpdateProductTypeImage(shadingFormProduct, url);
                                            }}
                                            className={`px-2 py-1 rounded text-[9px] font-bold border transition-all ${shadingFormImageUrl.includes('photo-1615874959474') ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'}`}
                                        >
                                            🏡 {lang === 'tr' ? 'Pergole' : 'Pergola'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const url = 'https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=600&auto=format&fit=crop';
                                                setShadingFormImageUrl(url);
                                                handleUpdateProductTypeImage(shadingFormProduct, url);
                                            }}
                                            className={`px-2 py-1 rounded text-[9px] font-bold border transition-all ${shadingFormImageUrl.includes('photo-1505691938895') ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'}`}
                                        >
                                            ⛅ {lang === 'tr' ? 'Zip Perde' : 'Zip'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const url = 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&auto=format&fit=crop';
                                                setShadingFormImageUrl(url);
                                                handleUpdateProductTypeImage(shadingFormProduct, url);
                                            }}
                                            className={`px-2 py-1 rounded text-[9px] font-bold border transition-all ${shadingFormImageUrl.includes('photo-1600585154340') ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'}`}
                                        >
                                            🪟 {lang === 'tr' ? 'Cam Balkon' : 'Glass'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const url = 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=600&auto=format&fit=crop';
                                                setShadingFormImageUrl(url);
                                                handleUpdateProductTypeImage(shadingFormProduct, url);
                                            }}
                                            className={`px-2 py-1 rounded text-[9px] font-bold border transition-all ${shadingFormImageUrl.includes('photo-1513694203232') ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'}`}
                                        >
                                            ⛱️ {lang === 'tr' ? 'Tente' : 'Awning'}
                                        </button>
                                        {shadingFormImageUrl && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setShadingFormImageUrl('');
                                                    handleUpdateProductTypeImage(shadingFormProduct, '');
                                                }}
                                                className="px-2 py-1 rounded text-[9px] font-bold border bg-red-950/20 border-red-900/30 text-red-400 hover:bg-red-900/40 transition-all"
                                            >
                                                ✕
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => {
                                        const newItem: ShadingItem = {
                                            id: `sv-manual-${Date.now()}`,
                                            productType: shadingFormProduct,
                                            name: shadingFormName || (lang === 'tr' ? 'Gölgelendirme Pozu' : 'Shading Item'),
                                            width: shadingFormWidth,
                                            height: shadingFormHeight,
                                            depth: shadingFormDepth,
                                            frontHeight: shadingFormFrontHeight,
                                            backHeight: shadingFormBackHeight,
                                            quantity: shadingFormQty,
                                            unitPrice: shadingFormPrice,
                                            color: shadingFormColor,
                                            notes: shadingFormNotes || (lang === 'tr' ? 'Manüel olarak eklendi.' : 'Manually entered.'),
                                            imageUrl: shadingFormImageUrl,
                                            planSectionUrl: shadingFormPlanSectionUrl,
                                            crossSectionUrl: shadingFormCrossSectionUrl,
                                            planSectionProfileCode: shadingFormPlanSectionProfileCode,
                                            crossSectionProfileCode: shadingFormCrossSectionProfileCode,
                                            overlayX: 50,
                                            overlayY: 50,
                                            overlayScale: 100,
                                            overlayRotate: 0
                                        };
                                        handleAddShadingItem(newItem);
                                        showToast(lang === 'tr' ? 'Poz teklife eklendi!' : 'Position added to quote!', 'success');
                                    }}
                                    className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
                                >
                                    <Plus size={14} strokeWidth={3} />
                                    <span>{lang === 'tr' ? 'POZU TEKLİFE EKLE' : 'ADD POSITION TO QUOTE'}</span>
                                </button>
                            </div>

                            {/* Card 3: Currently Added Shading Items */}
                            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
                                <div className="flex justify-between items-center border-b border-white/5 pb-3">
                                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-200 flex items-center gap-2">
                                        <Layers size={15} className="text-emerald-400" />
                                        <span>{lang === 'tr' ? 'AKTİF GÖLGELENDİRME TEKLİFLERİ' : 'ACTIVE SHADING OFFERS'}</span>
                                    </h3>
                                    <span className="text-[10px] bg-slate-950 border border-slate-800 px-2 py-0.5 rounded-full font-mono text-slate-400 font-bold">
                                        {(project.shadingItems || []).length} {lang === 'tr' ? 'Sistem' : 'Units'}
                                    </span>
                                </div>

                                {(project.shadingItems || []).length === 0 ? (
                                    <p className="text-xs text-slate-500 text-center py-4">
                                        {lang === 'tr' ? 'Henüz eklenmiş gölgelendirme teklifi yok.' : 'No shading systems added yet.'}
                                    </p>
                                ) : (
                                    <div className="space-y-3 max-h-[250px] overflow-y-auto pr-1">
                                        {(project.shadingItems || []).map((item) => (
                                            <div key={item.id} className="p-3 bg-slate-950 rounded-2xl border border-white/5 hover:border-slate-800 transition-all flex justify-between items-center gap-3">
                                                <div className="min-w-0">
                                                    <p className="text-xs font-bold text-slate-200 truncate">{item.name}</p>
                                                    <p className="text-[10px] text-slate-500 mt-0.5 font-mono">
                                                        {lang === 'tr' ? 'G:' : 'W:'}{item.width} {lang === 'tr' ? 'Aç:' : 'Proj:'}{item.depth || 0} {lang === 'tr' ? 'Ön Y:' : 'Fr H:'}{item.frontHeight || item.height} {lang === 'tr' ? 'Ark Y:' : 'Bk H:'}{item.backHeight || item.height} mm • {item.quantity} {lang === 'tr' ? 'Adet' : 'Qty'}
                                                    </p>
                                                    <p className="text-[10px] text-indigo-400 font-semibold truncate mt-0.5">{item.color}</p>
                                                </div>
                                                <div className="flex items-center gap-3 shrink-0">
                                                    <span className="text-emerald-400 font-mono font-bold text-xs">
                                                        {currencySymbol}{(item.unitPrice * (item.quantity || 1)).toLocaleString()}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            handleDeleteShadingItem(item.id);
                                                            showToast(lang === 'tr' ? 'Poz tekliften silindi.' : 'Position deleted from quote.', 'info');
                                                        }}
                                                        className="text-slate-500 hover:text-red-400 p-1 rounded-lg hover:bg-red-500/10 transition-all"
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* RIGHT: High-Performance ShadeVision 3D Designer Iframe Canvas (Col: 7) */}
                        <div className="xl:col-span-7 space-y-4">
                            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-2xl relative overflow-hidden flex flex-col">
                                <div className="flex justify-between items-center pb-3 border-b border-white/5 mb-3 px-2">
                                    <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                                        <h4 className="text-xs font-black text-slate-200 uppercase tracking-wider">
                                            {lang === 'tr' ? 'SHADEVISION 3D PERGOLE VE GÖLGELENDİRME PROJEKTÖRÜ' : 'SHADEVISION 3D SHADING PROJECTOR'}
                                        </h4>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => {
                                                const frame = document.getElementById('shadevision-iframe') as HTMLIFrameElement;
                                                if (frame) frame.src = frame.src;
                                                showToast(lang === 'tr' ? 'Tasarımcı ekranı yenilendi!' : 'Designer reloaded!', 'info');
                                            }}
                                            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg transition-all"
                                            title={lang === 'tr' ? 'Ekranı Yenile' : 'Refresh Iframe'}
                                        >
                                            <RefreshCw size={14} />
                                        </button>
                                        <a
                                            href="https://shadevision-g-lgelendirme-tasar-mc-s-953554361433.europe-west2.run.app/"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-indigo-400 rounded-lg transition-all"
                                            title={lang === 'tr' ? 'Dışarıda Aç' : 'Open in New Tab'}
                                        >
                                            <ExternalLink size={14} />
                                        </a>
                                    </div>
                                </div>

                                <div className="relative rounded-2xl overflow-hidden bg-slate-950 aspect-[16/10] xl:h-[820px] w-full border border-slate-800 shadow-inner group">
                                    {/* Embedded Interactive ShadeVision */}
                                    <iframe
                                        id="shadevision-iframe"
                                        src="https://shadevision-g-lgelendirme-tasar-mc-s-953554361433.europe-west2.run.app/"
                                        className="w-full h-full border-0 rounded-2xl bg-slate-950"
                                        allow="camera; microphone; geolocation; clipboard-read; clipboard-write; fullscreen"
                                        referrerPolicy="no-referrer"
                                    />
                                    
                                    {/* Sleek Floating Help Guide inside Canvas */}
                                    <div className="absolute bottom-4 left-4 right-4 bg-slate-900/95 backdrop-blur border border-white/5 p-3 rounded-xl shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none flex justify-between items-center">
                                        <span className="text-[10px] text-slate-300 font-medium">
                                            💡 {lang === 'tr' 
                                                ? '3D Stüdyoda pergola, zip perde ve cam sistemlerinizi görselleştirip sol panelden parametrik teklif detaylarını kaydedebilirsiniz.' 
                                                : 'Visualize pergolas, zip screens and glass systems in 3D and record parametric quote details from the left panel.'}
                                        </span>
                                        <span className="text-[9px] text-indigo-400 font-bold bg-indigo-500/10 px-1.5 py-0.5 rounded shrink-0">
                                            {lang === 'tr' ? '3D MODELLEME' : '3D MODELING'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                    ) : (
                        <ShadingBOMAndOpt
                            shadingItems={project.shadingItems || []}
                            project={project}
                            onUpdateProject={onUpdateProject}
                            lang={lang}
                            theme={theme}
                            currencySymbol={currencySymbol}
                        />
                    )}
                </div>
            )}

            {false && activeTab === 'shading' && (
                <div className="space-y-8 animate-in fade-in duration-300 font-sans">
                    {/* Header bar */}
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2 mb-1.5">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-[10px] text-emerald-400 font-extrabold uppercase tracking-widest font-mono">
                                    {lang === 'tr' ? 'YAPAY ZEKA VE CAD SİSTEMİ AKTİF' : 'AI COGNITIVE ENGINE ACTIVE'}
                                </span>
                            </div>
                            <h2 className="text-2xl font-black text-slate-100 uppercase tracking-tight flex flex-wrap items-center gap-2">
                                <span>VIZYONPERGOLA</span> 
                                <span className="text-indigo-400 font-medium font-sans">AI DESIGN STUDIO</span>
                            </h2>
                            <p className="text-xs text-slate-400 mt-1 max-w-xl leading-relaxed">
                                {lang === 'tr' 
                                  ? 'Bina dış cephesini gelişmiş yapay zeka ve CAD çizim araçlarıyla donatın. Cepheyi çizin, sistemi özelleştirin ve görselleştirin.' 
                                  : 'Equip any building facade with advanced AI rendering and CAD drawing tools. Outline the region, choose your profile system, and generate photorealistic visual proposals.'}
                            </p>
                        </div>

                        {/* Top Action buttons */}
                        <div className="flex flex-wrap items-center gap-3">
                            {polygonPoints.length > 0 && (
                                <button
                                    onClick={() => {
                                        setPolygonPoints([]);
                                        setIsDrawingCompleted(false);
                                        setVisualizedImage(null);
                                        setAiShadingReport(null);
                                    }}
                                    className="bg-slate-850 hover:bg-slate-800 text-slate-300 px-4 py-2.5 rounded-xl flex items-center gap-2 font-bold text-xs uppercase tracking-wider border border-white/5 transition-all"
                                >
                                    <Trash2 size={14} className="text-red-400" />
                                    <span>{lang === 'tr' ? 'ÇİZİMİ TEMİZLE' : 'RESET DESIGN'}</span>
                                </button>
                            )}
                            <button
                                onClick={() => setShadingCanvasMode(shadingCanvasMode === 'design' ? 'comparison' : 'design')}
                                className="bg-slate-850 hover:bg-slate-800 text-slate-200 px-4 py-2.5 rounded-xl flex items-center gap-2 font-bold text-xs uppercase tracking-wider border border-white/5 transition-all"
                            >
                                {shadingCanvasMode === 'design' ? <Eye size={14} className="text-indigo-400" /> : <Wrench size={14} className="text-indigo-400" />}
                                <span>{shadingCanvasMode === 'design' ? (lang === 'tr' ? 'KIYASLAMA GÖRÜNÜMÜ' : 'COMPARISON VIEW') : (lang === 'tr' ? 'CAD ÇİZİM MODU' : 'CAD DESIGN MODE')}</span>
                            </button>
                        </div>
                    </div>

                    {/* SHADEVISION CLOUD INTEGRATION BRIDGE HUB */}
                    <div className="bg-gradient-to-br from-slate-900 via-indigo-950/20 to-slate-900 border-2 border-indigo-500/25 rounded-3xl p-6 shadow-2xl relative overflow-hidden group">
                        {/* Decorative background aura */}
                        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none -mr-20 -mt-20" />
                        <div className="absolute -bottom-10 -left-10 w-60 h-60 bg-indigo-500/5 rounded-full blur-[80px] pointer-events-none" />

                        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                            
                            {/* Left panel: Info & Link */}
                            <div className="lg:col-span-6 space-y-4">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-[10px] font-extrabold uppercase tracking-widest bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2.5 py-1 rounded-full flex items-center gap-1.5 font-mono">
                                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                        {lang === 'tr' ? 'BULUT ENTEGRASYONU AKTİF' : 'CLOUD BRIDGE ONLINE'}
                                    </span>
                                    <span className="text-[10px] font-black uppercase tracking-wider bg-slate-800 text-slate-400 px-2.5 py-1 rounded-full">
                                        SHADEVISION Suite
                                    </span>
                                </div>
                                
                                <div className="space-y-1">
                                    <h3 className="text-xl font-black text-slate-100 flex items-center gap-2">
                                        <Sparkles className="text-amber-400" size={20} />
                                        <span>{lang === 'tr' ? 'ShadeVision 3D Tasarım Entegrasyonu' : 'ShadeVision 3D Design Integration'}</span>
                                    </h3>
                                    <p className="text-xs text-slate-350 leading-relaxed">
                                        {lang === 'tr'
                                          ? "Gelişmiş 3D ve perspektif gölgelendirme çizimlerinizi ShadeVision uygulaması üzerinden yapın. Alumetric, ShadeVision'dan aldığınız teklifleri anında buraya bağlayıp tek bir birleşik müşteri teklifine dönüştürür."
                                          : "Create advanced 3D & perspective shading designs inside ShadeVision. Alumetric securely connects and syncs designed systems, dimensions, and prices directly to assemble a unified customer proposal."}
                                    </p>
                                </div>

                                <div className="flex flex-wrap gap-3 pt-1">
                                    <a
                                        href="https://shadevision-g-lgelendirme-tasar-mc-s-953554361433.europe-west2.run.app"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-black text-xs uppercase tracking-wider px-6 py-3.5 rounded-xl shadow-lg shadow-indigo-500/15 border border-indigo-400/30 hover:scale-[1.02] active:scale-[0.98] transition-all"
                                    >
                                        <Globe size={16} />
                                        <span>{lang === 'tr' ? '✨ SHADEVISION TASARIMCIYI AÇ' : '✨ OPEN SHADEVISION DESIGNER'}</span>
                                    </a>
                                    
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShadeVisionPasteData(
                                                lang === 'tr'
                                                ? "Bioklimatik Pergole 6000x3500, 1 adet, 5200 €\nZip Perde 3500x2500, 3 adet, 850 €"
                                                : "Bioclimatic Pergola 6000x3500, 1 qty, 5200 EUR\nZip Screen 3500x2500, 3 qty, 850 EUR"
                                            );
                                            showToast(
                                                lang === 'tr' ? "Örnek şablon metni yapıştırıldı!" : "Sample text template pasted!", 
                                                "info"
                                            );
                                        }}
                                        className="bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xs uppercase tracking-wider px-4 py-3.5 rounded-xl border border-white/5 transition-all"
                                    >
                                        {lang === 'tr' ? 'ÖRNEK METİN' : 'SAMPLE TEXT'}
                                    </button>
                                </div>
                            </div>

                            {/* Right panel: Active sync parameters */}
                            <div className="lg:col-span-6 bg-slate-950/70 border border-indigo-500/15 rounded-2xl p-5 space-y-4">
                                <div className="flex justify-between items-center border-b border-white/5 pb-2.5">
                                    <h4 className="text-xs font-black text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                                        <Cpu size={14} className="text-indigo-400" />
                                        <span>{lang === 'tr' ? 'AKILLI VERİ EŞİTLEME KÖPRÜSÜ' : 'SMART SYNC ENGINE'}</span>
                                    </h4>
                                    <span className="text-[9px] font-mono font-bold text-slate-500">API v1.1</span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                    <div className="space-y-1">
                                        <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider font-mono block">
                                            {lang === 'tr' ? 'TEKLİF REFERANS NO' : 'QUOTE REFERENCE ID'}
                                        </label>
                                        <input
                                            type="text"
                                            value={shadeVisionQuoteId}
                                            onChange={(e) => setShadeVisionQuoteId(e.target.value)}
                                            className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 font-mono text-xs uppercase outline-none focus:border-indigo-500/50"
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider font-mono block">
                                            {lang === 'tr' ? 'TASARIM PLATFORMU URL' : 'DESIGNER ENDPOINT'}
                                        </label>
                                        <input
                                            type="text"
                                            value={shadeVisionUrl}
                                            onChange={(e) => setShadeVisionUrl(e.target.value)}
                                            className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-400 font-mono text-[10px] outline-none focus:border-indigo-500/50"
                                            disabled
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <div className="flex justify-between items-center">
                                        <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">
                                            {lang === 'tr' ? 'Teklif Metnini Kopyala-Yapıştır (Opsiyonel)' : 'Paste Quotation Copy-Text (Optional)'}
                                        </label>
                                        <span className="text-[8px] text-emerald-400 font-mono font-bold bg-emerald-500/10 px-1 py-0.5 rounded">
                                            {lang === 'tr' ? 'Akıllı Ayrıştırıcı' : 'Smart Extractor'}
                                        </span>
                                    </div>
                                    <textarea
                                        value={shadeVisionPasteData}
                                        onChange={(e) => setShadeVisionPasteData(e.target.value)}
                                        placeholder={
                                            lang === 'tr'
                                              ? "ShadeVision'dan aldığınız teklif detaylarını buraya yapıştırabilirsiniz...\nÖrn: Bioklimatik Pergole 5500x3000, 1 adet, 4800 €"
                                              : "Paste lines or summary copied from ShadeVision here...\nE.g. Bioclimatic Pergola 5500x3000, 1 qty, 4800 EUR"
                                        }
                                        className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-slate-300 placeholder-slate-600 font-mono text-[10px] h-[65px] outline-none focus:border-indigo-500/50 resize-none"
                                    />
                                </div>

                                <button
                                    type="button"
                                    disabled={isSyncingShadeVision}
                                    onClick={handleSyncShadeVision}
                                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800/50 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-all flex items-center justify-center gap-2 border border-indigo-500/20"
                                >
                                    {isSyncingShadeVision ? (
                                        <>
                                            <Loader2 size={14} className="animate-spin text-white" />
                                            <span>{lang === 'tr' ? 'VERİLER EŞİTLENİYOR...' : 'FETCHING DATA...'}</span>
                                        </>
                                    ) : (
                                        <>
                                            <ClipboardCheck size={14} className="text-emerald-400" />
                                            <span>{lang === 'tr' ? 'BAĞLAN VE TEKLİFE AKTAR' : 'SYNC & INTEGRATE TO QUOTE'}</span>
                                        </>
                                    )}
                                </button>
                            </div>

                        </div>
                    </div>

                    {/* Main Workspace split */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                        
                        {/* LEFT: Project Configuration Sidebar (Column width: 4) */}
                        <div className="lg:col-span-4 lg:order-1 space-y-6">
                            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
                                <div className="border-b border-white/5 pb-4">
                                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-200 flex items-center gap-2">
                                        <Sliders size={16} className="text-indigo-400" />
                                        <span>{lang === 'tr' ? 'PROJE YAPILANDIRMASI' : 'PROJECT CONFIGURATION'}</span>
                                    </h3>
                                    <p className="text-[11px] text-slate-400 mt-1">
                                        {lang === 'tr' ? 'Dış mekan yapınızın mimari detaylarını seçin' : 'Configure your outdoor layout options'}
                                    </p>
                                </div>

                                {/* SECTION 1: SOURCE IMAGE / BACKGROUND */}
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-mono">
                                            {lang === 'tr' ? '1. EVİMİN FOTOĞRAFI (ARKA PLAN)' : '1. MY HOUSE PHOTO (BACKGROUND)'}
                                        </label>
                                        <span className="text-[9px] font-bold text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                                            {lang === 'tr' ? 'Özel Yükleme Etkin' : 'Custom Upload Active'}
                                        </span>
                                    </div>

                                    {/* Prominent Upload / Drag Target Box */}
                                    <div 
                                        onClick={() => document.getElementById('shading-bg-file-sidebar')?.click()}
                                        className="relative rounded-2xl overflow-hidden aspect-[16/10] bg-slate-950 border-2 border-dashed border-slate-800 hover:border-indigo-500 cursor-pointer group flex flex-col items-center justify-center transition-all duration-300 shadow-lg"
                                        title={lang === 'tr' ? 'Kendi evinizin resmini değiştirmek için tıklayın' : 'Click to upload or replace your house photo'}
                                    >
                                        <img 
                                            src={shadingBgImage} 
                                            alt="Facade thumbnail" 
                                            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 opacity-50 group-hover:opacity-40 transition-all duration-300"
                                            referrerPolicy="no-referrer"
                                        />
                                        
                                        {/* Overlay controls */}
                                        <div className="relative z-10 flex flex-col items-center justify-center text-center p-4 space-y-2 pointer-events-none">
                                            <div className="w-10 h-10 rounded-full bg-slate-900/90 border border-slate-700 flex items-center justify-center text-indigo-400 shadow-xl group-hover:scale-110 group-hover:text-indigo-300 transition-all duration-300">
                                                <Upload size={18} className="animate-pulse" />
                                            </div>
                                            <div>
                                                <p className="text-white text-xs font-black uppercase tracking-wider">
                                                    {lang === 'tr' ? 'KENDİ EV FOTOĞRAFINI YÜKLE' : 'UPLOAD YOUR HOUSE PHOTO'}
                                                </p>
                                                <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                                                    {lang === 'tr' ? 'Sürükle-bırak veya dosyayı seç' : 'Drag & drop or tap to browse'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Primary Highly-Visible Glowing Button for custom upload */}
                                    <button
                                        onClick={() => document.getElementById('shading-bg-file-sidebar')?.click()}
                                        className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-extrabold text-[11px] uppercase tracking-wider shadow-lg shadow-indigo-600/15 border border-indigo-500/30 transition-all duration-200 flex items-center justify-center gap-2"
                                    >
                                        <Upload size={14} />
                                        <span>{lang === 'tr' ? 'KENDİ EV FOTOĞRAFINIZI SEÇİN' : 'SELECT YOUR OWN HOUSE PHOTO'}</span>
                                    </button>

                                    <input 
                                        type="file" 
                                        accept="image/*" 
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                fileToDataURI(file).then(uri => {
                                                    setShadingBgImage(uri);
                                                    setPolygonPoints([]);
                                                    setBasePerspectivePoints([]);
                                                    setIsDrawingCompleted(false);
                                                    setVisualizedImage(null);
                                                    setManualScaleX(1.0);
                                                    setManualScaleY(1.0);
                                                    setManualRotate(0);
                                                    setManualShiftX(0);
                                                    setManualShiftY(0);
                                                    showToast(
                                                        lang === 'tr' 
                                                            ? "Ev fotoğrafınız başarıyla yüklendi! Şimdi sistemi çatı/duvar üzerine yerleştirip görselleştirme oluşturabilirsiniz." 
                                                            : "Your house photo has been successfully loaded! Now position the system and generate visualization.", 
                                                        "success"
                                                    );
                                                });
                                            }
                                        }}
                                        id="shading-bg-file-sidebar"
                                        className="hidden" 
                                    />

                                    {/* Divider for presets */}
                                    <div className="flex items-center gap-2 my-1">
                                        <div className="h-px bg-slate-800 flex-1"></div>
                                        <span className="text-[9px] text-slate-500 uppercase tracking-widest font-mono font-black">
                                            {lang === 'tr' ? 'VEYA HAZIR ŞABLON SEÇ' : 'OR CHOOSE PRESET'}
                                        </span>
                                        <div className="h-px bg-slate-800 flex-1"></div>
                                    </div>

                                    {/* Preset Environment Thumbnails */}
                                    <div className="grid grid-cols-3 gap-2">
                                        {[
                                            { name: 'Villa', tr: 'Villa', url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=1200' },
                                            { name: 'Patio', tr: 'Veranda', url: 'https://images.unsplash.com/photo-1533090161767-e6ffed986c88?q=80&w=1200' },
                                            { name: 'Terrace', tr: 'Teras', url: 'https://images.unsplash.com/photo-1508333706533-1ab43ecb1606?q=80&w=1200' }
                                        ].map(preset => (
                                            <button
                                                key={preset.name}
                                                onClick={() => {
                                                    setShadingBgImage(preset.url);
                                                    let presetPts: { x: number; y: number }[] = [];
                                                    if (preset.name === 'Villa') {
                                                        presetPts = [
                                                            { x: 38, y: 48 },
                                                            { x: 80, y: 51 },
                                                            { x: 86, y: 88 },
                                                            { x: 36, y: 82 }
                                                        ];
                                                    } else if (preset.name === 'Patio') {
                                                        presetPts = [
                                                            { x: 22, y: 26 },
                                                            { x: 74, y: 28 },
                                                            { x: 84, y: 78 },
                                                            { x: 12, y: 74 }
                                                        ];
                                                    } else if (preset.name === 'Terrace') {
                                                        presetPts = [
                                                            { x: 28, y: 32 },
                                                            { x: 72, y: 32 },
                                                            { x: 84, y: 84 },
                                                            { x: 16, y: 84 }
                                                        ];
                                                    }
                                                    setPolygonPoints(presetPts);
                                                    setBasePerspectivePoints(presetPts);
                                                    setManualScaleX(1.0);
                                                    setManualScaleY(1.0);
                                                    setManualRotate(0);
                                                    setManualShiftX(0);
                                                    setManualShiftY(0);
                                                    setIsDrawingCompleted(presetPts.length > 0);
                                                    setVisualizedImage(null);
                                                    showToast(
                                                        lang === 'tr'
                                                            ? `${preset.tr} şablonu yüklendi!`
                                                            : `${preset.name} preset loaded!`,
                                                        "info"
                                                    );
                                                }}
                                                className={`py-1.5 px-2 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all border ${shadingBgImage === preset.url ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40' : 'bg-slate-950/60 text-slate-400 border-slate-850 hover:border-slate-750'}`}
                                            >
                                                {lang === 'tr' ? preset.tr : preset.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* SECTION 2: STRUCTURE TYPE */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-mono">
                                        {lang === 'tr' ? '2. YAPISAL SİSTEM SEÇİMİ' : '2. STRUCTURE TYPE'}
                                    </label>
                                    
                                    <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1.5 custom-scrollbar font-sans">
                                        {[
                                            { id: 'bioclimatic-pergola', titleTr: 'Bioklimatik Pergole', titleEn: 'Bioclimatic Pergola', descTr: 'Dönebilen ve katlanabilen alüminyum lüver tavan sistemi.', descEn: 'Retractable and rotatable heavy aluminum louver roofing.' },
                                            { id: 'retractable-glass', titleTr: 'Açılır Cam Tavan', titleEn: 'Retractable Glass Roof', descTr: 'Motorlu, teleskobik hareketli, şeffaf temperli cam tavan.', descEn: 'Motorized, sliding telescopic tempered glass roofing.' },
                                            { id: 'rolling-roof', titleTr: 'Rolling Roof', titleEn: 'Rolling Roof Panels', descTr: 'Katlanarak açılan teleskobik panel tavan kaplama sistemi.', descEn: 'Sliding, folding telescopic aluminum roof panels.' },
                                            { id: 'zip-blind', titleTr: 'Zip Perde', titleEn: 'Zip Screen Shade', descTr: 'Rüzgara dayanıklı yüksek yoğunluklu dikey stor gölgeleme.', descEn: 'Wind-resistant heavy micro-mesh drapes & shading.' },
                                            { id: 'awning', titleTr: 'Mafsallı Tente', titleEn: 'Premium Fabric Awning', descTr: 'Açılır kapanır akrilik kumaş gölgelendirme tentesi.', descEn: 'Folding arm acrylic fabric protection awning.' },
                                            { id: 'guillotine', titleTr: 'Giyotin Cam Sistemleri', titleEn: 'Guillotine Smart Glass', descTr: 'Dikey hareketli motorlu akıllı temperli cam paneller.', descEn: 'Motorized vertical-sliding insulated glass panels.' },
                                            { id: 'glass-balcony', titleTr: 'Katlanır Cam Balkon', titleEn: 'Panoramic Glass Balcony', descTr: 'Katlanabilir temperli panoramik dış balkon kaplama.', descEn: 'Frameless folding slider patio glass balustrades.' },
                                        ].map((prod) => (
                                            <button
                                                key={prod.id}
                                                onClick={() => {
                                                    setSelectedShadingProduct(prod.id);
                                                    setVisualizedImage(null); // Clear previous visual on change
                                                    setShadingFormProduct(prod.id as any);
                                                    if (prod.id === 'bioclimatic-pergola') {
                                                        setShadingFormName(lang === 'tr' ? 'Premium Bioklimatik Pergole' : 'Premium Bioclimatic Pergola');
                                                        setShadingFormPrice(4500);
                                                        setShadingFormDepth(3000);
                                                        setShadingFormWidth(4000);
                                                        setShadingFormHeight(2500);
                                                    } else if (prod.id === 'retractable-glass') {
                                                        setShadingFormName(lang === 'tr' ? 'Açılır Cam Tavan' : 'Retractable Glass Roof');
                                                        setShadingFormPrice(4900);
                                                        setShadingFormDepth(3000);
                                                        setShadingFormWidth(4000);
                                                        setShadingFormHeight(2500);
                                                    } else if (prod.id === 'rolling-roof') {
                                                        setShadingFormName(lang === 'tr' ? 'Alüminyum Rolling Roof' : 'Aluminum Rolling Roof');
                                                        setShadingFormPrice(4200);
                                                        setShadingFormDepth(3000);
                                                        setShadingFormWidth(4000);
                                                        setShadingFormHeight(2500);
                                                    } else if (prod.id === 'zip-blind') {
                                                        setShadingFormName(lang === 'tr' ? 'Antrasit Zip Perde' : 'Anthracite Zip Blind');
                                                        setShadingFormPrice(750);
                                                        setShadingFormDepth(0);
                                                        setShadingFormWidth(3000);
                                                        setShadingFormHeight(2500);
                                                    } else if (prod.id === 'awning') {
                                                        setShadingFormName(lang === 'tr' ? 'Mafsallı Tente' : 'Folding Awning');
                                                        setShadingFormPrice(950);
                                                        setShadingFormDepth(2500);
                                                        setShadingFormWidth(3500);
                                                        setShadingFormHeight(2000);
                                                    } else if (prod.id === 'guillotine') {
                                                        setShadingFormName(lang === 'tr' ? 'Giyotin Motorlu Cam' : 'Motorized Guillotine Glass');
                                                        setShadingFormPrice(1800);
                                                        setShadingFormDepth(0);
                                                        setShadingFormWidth(3000);
                                                        setShadingFormHeight(2400);
                                                    } else if (prod.id === 'glass-balcony') {
                                                        setShadingFormName(lang === 'tr' ? 'Katlanır Cam Balkon' : 'Folding Glass Balcony');
                                                        setShadingFormPrice(1400);
                                                        setShadingFormDepth(0);
                                                        setShadingFormWidth(4000);
                                                        setShadingFormHeight(1800);
                                                    }
                                                }}
                                                className={`w-full text-left p-3 rounded-2xl border transition-all flex flex-col gap-1 ${selectedShadingProduct === prod.id ? 'bg-indigo-600/10 border-indigo-500/50 ring-1 ring-indigo-500/30' : 'bg-slate-950/60 border-slate-850 hover:bg-slate-950 hover:border-slate-800'}`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-black text-white">{lang === 'tr' ? prod.titleTr : prod.titleEn}</span>
                                                    {selectedShadingProduct === prod.id && <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />}
                                                </div>
                                                <span className="text-[10px] text-slate-400 font-medium leading-relaxed">{lang === 'tr' ? prod.descTr : prod.descEn}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* SECTION 3: PROFILE FINISH */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-mono">
                                        {lang === 'tr' ? '3. ALÜMİNYUM PROFİL RENGİ' : '3. PROFILE FINISH'}
                                    </label>
                                    
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            { name: 'RAL 7016 Antrasit', color: '#374151', text: 'RAL 7016 Antrasit Gri' },
                                            { name: 'RAL 9010 Beyaz', color: '#f3f4f6', text: 'RAL 9010 Parlak Beyaz' },
                                            { name: 'RAL 9005 Siyah', color: '#111827', text: 'RAL 9005 Mat Siyah' },
                                            { name: 'RAL 8019 Kahve', color: '#451a03', text: 'RAL 8019 Bronz/Kahve' },
                                            { name: 'Ahşap Desenli', color: '#78350f', text: 'Ahşap Desenli Modern Meşe' },
                                        ].map((col) => (
                                            <button
                                                key={col.text}
                                                onClick={() => {
                                                    setSelectedShadingColor(col.text);
                                                }}
                                                className={`flex items-center gap-2 p-2 rounded-xl border text-left transition-all ${selectedShadingColor === col.text ? 'bg-indigo-600/10 border-indigo-500/50' : 'bg-slate-950/60 border-slate-850 hover:border-slate-800'}`}
                                            >
                                                <div className="w-4 h-4 rounded-full border border-white/20 flex-shrink-0" style={{ backgroundColor: col.color }} />
                                                <span className="text-[10px] font-bold text-white tracking-tight truncate">{col.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* SECTION 4: DESIGN NOTES */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-mono">
                                        {lang === 'tr' ? '4. ÖZEL TASARIM NOTLARI' : '4. SPECIAL REQUIREMENTS'}
                                    </label>
                                    <textarea
                                        value={selectedShadingNotes}
                                        onChange={(e) => setSelectedShadingNotes(e.target.value)}
                                        placeholder={lang === 'tr' ? 'Örn: Günışığı LED aydınlatma entegrasyonu, rüzgar sensörleri...' : 'E.g., Integrated warm white LED strip lights, wind sensor...'}
                                        className="w-full bg-slate-950 border border-slate-850 rounded-2xl p-3 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500/50 min-h-[70px] resize-none"
                                    />
                                </div>

                                {/* SECTION 4.2: MANUAL PLACEMENT & DIMENSIONS */}
                                <div className="space-y-3 bg-slate-950 border border-slate-850 rounded-2xl p-4 my-2">
                                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                                        <div className="flex items-center gap-1.5">
                                            <Move size={13} className="text-cyan-400" />
                                            <span className="text-[10px] font-black text-slate-200 uppercase tracking-widest font-mono">
                                                {lang === 'tr' ? 'MANUEL YERLEŞİM VE BOYUT' : 'MANUAL PLACEMENT & SIZES'}
                                            </span>
                                        </div>
                                        {/* Status badge */}
                                        <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md ${shadingPlacementMode === 'manual' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                                            {shadingPlacementMode === 'manual' ? (lang === 'tr' ? 'MANUEL' : 'MANUAL') : (lang === 'tr' ? 'ÇİZİM' : 'OUTLINE')}
                                        </span>
                                    </div>

                                    {/* Placement Mode Selection Switch */}
                                    <div className="grid grid-cols-2 gap-2 bg-slate-900 p-1 rounded-xl">
                                        <button
                                            type="button"
                                            onClick={() => handleSetPlacementMode('draw')}
                                            className={`py-1.5 px-2 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${shadingPlacementMode === 'draw' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
                                        >
                                            ✏️ {lang === 'tr' ? 'ALAN ÇİZİMİ' : 'DRAW OUTLINE'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleSetPlacementMode('manual')}
                                            className={`py-1.5 px-2 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${shadingPlacementMode === 'manual' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
                                        >
                                            🎛️ {lang === 'tr' ? 'SERBEST MOD' : 'FREE MODE'}
                                        </button>
                                    </div>

                                    {/* Quick helper tip */}
                                    <p className="text-[9px] text-slate-400 italic leading-snug">
                                        {lang === 'tr' 
                                            ? "İpucu: Resimdeki ürünü veya köşelerindeki mavi halkaları sürükleyerek de manuel konumlandırabilirsiniz!"
                                            : "Tip: You can also drag the product or its blue corner handles directly on the image!"}
                                    </p>

                                    {/* Sliders (Always shown if drawing is completed, or active in manual mode) */}
                                    {isDrawingCompleted && (
                                        <div className="space-y-3 pt-2 border-t border-white/5">
                                            {/* Genişlik (Ölçek X) Slider */}
                                            <div className="space-y-1">
                                                <div className="flex justify-between text-[10px] font-bold text-slate-300">
                                                    <span>{lang === 'tr' ? 'Perspektif Genişliği (Büyüklük)' : 'Perspective Width (Size)'}</span>
                                                    <span className="font-mono text-cyan-400">{Math.round(manualScaleX * 100)}%</span>
                                                </div>
                                                <input 
                                                    type="range" 
                                                    min="0.2" 
                                                    max="2.0" 
                                                    step="0.05"
                                                    value={manualScaleX}
                                                    onChange={(e) => {
                                                        const sX = parseFloat(e.target.value);
                                                        setManualScaleX(sX);
                                                        updatePerspectivePoints(sX, manualScaleY, manualRotate, manualShiftX, manualShiftY);
                                                    }}
                                                    className="w-full accent-cyan-400 bg-slate-900 h-1 rounded-lg appearance-none cursor-pointer"
                                                />
                                            </div>
 
                                            {/* Yükseklik (Ölçek Y) Slider */}
                                            <div className="space-y-1">
                                                <div className="flex justify-between text-[10px] font-bold text-slate-300">
                                                    <span>{lang === 'tr' ? 'Perspektif Yüksekliği (Uzunluk)' : 'Perspective Height (Length)'}</span>
                                                    <span className="font-mono text-cyan-400">{Math.round(manualScaleY * 100)}%</span>
                                                </div>
                                                <input 
                                                    type="range" 
                                                    min="0.2" 
                                                    max="2.0" 
                                                    step="0.05"
                                                    value={manualScaleY}
                                                    onChange={(e) => {
                                                        const sY = parseFloat(e.target.value);
                                                        setManualScaleY(sY);
                                                        updatePerspectivePoints(manualScaleX, sY, manualRotate, manualShiftX, manualShiftY);
                                                    }}
                                                    className="w-full accent-cyan-400 bg-slate-900 h-1 rounded-lg appearance-none cursor-pointer"
                                                />
                                            </div>
 
                                            {/* Açı (Rotasyon) Slider */}
                                            <div className="space-y-1">
                                                <div className="flex justify-between text-[10px] font-bold text-slate-300">
                                                    <span>{lang === 'tr' ? 'Döndürme Açısı (Açı)' : 'Rotation Angle'}</span>
                                                    <span className="font-mono text-cyan-400">{manualRotate}°</span>
                                                </div>
                                                <input 
                                                    type="range" 
                                                    min="-45" 
                                                    max="45" 
                                                    step="1"
                                                    value={manualRotate}
                                                    onChange={(e) => {
                                                        const rot = parseInt(e.target.value);
                                                        setManualRotate(rot);
                                                        updatePerspectivePoints(manualScaleX, manualScaleY, rot, manualShiftX, manualShiftY);
                                                    }}
                                                    className="w-full accent-cyan-400 bg-slate-900 h-1 rounded-lg appearance-none cursor-pointer"
                                                />
                                            </div>
 
                                            {/* X Konum Slider */}
                                            <div className="space-y-1">
                                                <div className="flex justify-between text-[10px] font-bold text-slate-300">
                                                    <span>{lang === 'tr' ? 'Yatay Konum Kaydırma (X)' : 'Horizontal Shift (X)'}</span>
                                                    <span className="font-mono text-cyan-400">{manualShiftX}%</span>
                                                </div>
                                                <input 
                                                    type="range" 
                                                    min="-50" 
                                                    max="50" 
                                                    step="1"
                                                    value={manualShiftX}
                                                    onChange={(e) => {
                                                        const shX = parseInt(e.target.value);
                                                        setManualShiftX(shX);
                                                        updatePerspectivePoints(manualScaleX, manualScaleY, manualRotate, shX, manualShiftY);
                                                    }}
                                                    className="w-full accent-cyan-400 bg-slate-900 h-1 rounded-lg appearance-none cursor-pointer"
                                                />
                                            </div>
 
                                            {/* Y Konum Slider */}
                                            <div className="space-y-1">
                                                <div className="flex justify-between text-[10px] font-bold text-slate-300">
                                                    <span>{lang === 'tr' ? 'Dikey Konum Kaydırma (Y)' : 'Vertical Shift (Y)'}</span>
                                                    <span className="font-mono text-cyan-400">{manualShiftY}%</span>
                                                </div>
                                                <input 
                                                    type="range" 
                                                    min="-50" 
                                                    max="50" 
                                                    step="1"
                                                    value={manualShiftY}
                                                    onChange={(e) => {
                                                        const shY = parseInt(e.target.value);
                                                        setManualShiftY(shY);
                                                        updatePerspectivePoints(manualScaleX, manualScaleY, manualRotate, manualShiftX, shY);
                                                    }}
                                                    className="w-full accent-cyan-400 bg-slate-900 h-1 rounded-lg appearance-none cursor-pointer"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* SECTION 4.5: INTERACTIVE Presentation CONTROLS */}
                                <div className="space-y-3 bg-indigo-950/25 border border-indigo-500/15 rounded-2xl p-4 my-2">
                                    <div className="flex items-center gap-1.5 border-b border-indigo-500/10 pb-2">
                                        <Sliders size={13} className="text-indigo-400" />
                                        <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest font-mono">
                                            {lang === 'tr' ? 'MÜŞTERİ SUNUM AYARLARI' : 'PRESENTATION CONTROLS'}
                                        </span>
                                    </div>

                                    {/* Louver Angle - Bioclimatic/Rolling */}
                                    {(selectedShadingProduct === 'bioclimatic-pergola' || selectedShadingProduct === 'rolling-roof') && (
                                        <div className="space-y-1.5">
                                            <div className="flex justify-between text-[10px] font-bold text-slate-300">
                                                <span>{lang === 'tr' ? 'Lüver Açısı' : 'Louver Angle'}</span>
                                                <span className="font-mono text-cyan-400">{shadingLouverAngle}°</span>
                                            </div>
                                            <input 
                                                type="range" 
                                                min="0" 
                                                max="90" 
                                                value={shadingLouverAngle}
                                                onChange={(e) => setShadingLouverAngle(parseInt(e.target.value))}
                                                className="w-full accent-indigo-500 bg-slate-950 h-1 rounded-lg appearance-none cursor-pointer"
                                            />
                                        </div>
                                    )}

                                    {/* LED Lighting Toggle - Pergola, Rolling, Awning, Guillotine, Glass Balcony */}
                                    {selectedShadingProduct !== 'zip-blind' && (
                                        <div className="flex items-center justify-between py-1">
                                            <span className="text-[10px] font-bold text-slate-300">
                                                {lang === 'tr' ? 'Entegre LED Spotlar' : 'Integrated LED Lights'}
                                            </span>
                                            <button
                                                onClick={() => setShadingLedOn(!shadingLedOn)}
                                                className={`px-3 py-1 rounded-lg text-[9px] font-black transition-all border ${shadingLedOn ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-slate-950/60 text-slate-500 border-slate-850'}`}
                                            >
                                                {shadingLedOn ? (lang === 'tr' ? 'AÇIK' : 'ON') : (lang === 'tr' ? 'KAPALI' : 'OFF')}
                                            </button>
                                        </div>
                                    )}

                                    {/* Extension / Height Slider - Zip Blind, Awning, Guillotine, Glass Balcony */}
                                    <div className="space-y-1.5">
                                        <div className="flex justify-between text-[10px] font-bold text-slate-300">
                                            <span>
                                                {selectedShadingProduct === 'zip-blind' ? (lang === 'tr' ? 'Zip Stor Açıklığı' : 'Zip Screen Height') :
                                                 selectedShadingProduct === 'awning' ? (lang === 'tr' ? 'Tente Açılımı' : 'Awning Extension') :
                                                 selectedShadingProduct === 'guillotine' ? (lang === 'tr' ? 'Cam Yüksekliği' : 'Guillotine Height') :
                                                 selectedShadingProduct === 'glass-balcony' ? (lang === 'tr' ? 'Katlanır Cam Açıklığı' : 'Glass Panel Folding') :
                                                 (lang === 'tr' ? 'Sistem Açıklığı' : 'System Extension')}
                                            </span>
                                            <span className="font-mono text-cyan-400">{shadingExtension}%</span>
                                        </div>
                                        <input 
                                            type="range" 
                                            min={selectedShadingProduct === 'awning' ? "20" : "0"} 
                                            max="100" 
                                            value={shadingExtension}
                                            onChange={(e) => setShadingExtension(parseInt(e.target.value))}
                                            className="w-full accent-indigo-500 bg-slate-950 h-1 rounded-lg appearance-none cursor-pointer"
                                        />
                                    </div>

                                    {/* Column Ground Extension (Post Length) */}
                                    {(selectedShadingProduct === 'bioclimatic-pergola' || selectedShadingProduct === 'rolling-roof' || selectedShadingProduct === 'retractable-glass') && (
                                        <div className="space-y-1.5 pt-1">
                                            <div className="flex justify-between text-[10px] font-bold text-slate-300">
                                                <span>{lang === 'tr' ? 'Kolon Zemin Uzantısı' : 'Column Ground Extension'}</span>
                                                <span className="font-mono text-cyan-400">{shadingColumnHeight}px</span>
                                            </div>
                                            <input 
                                                type="range" 
                                                min="40" 
                                                max="400" 
                                                value={shadingColumnHeight}
                                                onChange={(e) => setShadingColumnHeight(parseInt(e.target.value))}
                                                className="w-full accent-indigo-500 bg-slate-950 h-1 rounded-lg appearance-none cursor-pointer"
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* SECTION 4.8: QUICK PRICE & QUOTE COMPILING */}
                                <div className="space-y-3 bg-slate-950 border border-slate-850 rounded-2xl p-4 my-2">
                                    <div className="flex items-center gap-1.5 border-b border-white/5 pb-2">
                                        <FileCheck size={13} className="text-emerald-400" />
                                        <span className="text-[10px] font-black text-slate-200 uppercase tracking-widest font-mono">
                                            {lang === 'tr' ? 'MANUEL ÖLÇÜ, ADET VE FİYATLANDIRMA' : 'MANUAL PRICING & QUOTATION'}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div className="space-y-1">
                                            <label className="text-[9px] text-slate-500 uppercase font-bold">{lang === 'tr' ? 'Genişlik (mm)' : 'Width (mm)'}</label>
                                            <input 
                                                type="number" 
                                                value={shadingFormWidth} 
                                                onChange={(e) => setShadingFormWidth(parseInt(e.target.value) || 0)} 
                                                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white font-mono"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] text-slate-500 uppercase font-bold">{lang === 'tr' ? 'Genel Yükseklik (mm)' : 'General Height (mm)'}</label>
                                            <input 
                                                type="number" 
                                                value={shadingFormHeight} 
                                                onChange={(e) => {
                                                    const val = parseInt(e.target.value) || 0;
                                                    setShadingFormHeight(val);
                                                    setShadingFormFrontHeight(val);
                                                    setShadingFormBackHeight(val);
                                                }} 
                                                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white font-mono"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] text-slate-500 uppercase font-bold">{lang === 'tr' ? 'Ön Yükseklik (mm)' : 'Front Height (mm)'}</label>
                                            <input 
                                                type="number" 
                                                value={shadingFormFrontHeight} 
                                                onChange={(e) => setShadingFormFrontHeight(parseInt(e.target.value) || 0)} 
                                                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white font-mono"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] text-slate-500 uppercase font-bold">{lang === 'tr' ? 'Arka Yükseklik (mm)' : 'Back Height (mm)'}</label>
                                            <input 
                                                type="number" 
                                                value={shadingFormBackHeight} 
                                                onChange={(e) => setShadingFormBackHeight(parseInt(e.target.value) || 0)} 
                                                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white font-mono"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] text-slate-500 uppercase font-bold">{lang === 'tr' ? 'Açılım (mm)' : 'Projection (mm)'}</label>
                                            <input 
                                                type="number" 
                                                value={shadingFormDepth} 
                                                onChange={(e) => setShadingFormDepth(parseInt(e.target.value) || 0)} 
                                                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white font-mono"
                                                disabled={selectedShadingProduct === 'zip-blind' || selectedShadingProduct === 'glass-balcony' || selectedShadingProduct === 'guillotine'}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] text-slate-500 uppercase font-bold">{lang === 'tr' ? 'Adet' : 'Qty'}</label>
                                            <input 
                                                type="number" 
                                                value={shadingFormQty} 
                                                onChange={(e) => setShadingFormQty(parseInt(e.target.value) || 1)} 
                                                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white font-mono"
                                            />
                                        </div>
                                        <div className="space-y-1 col-span-2">
                                            <label className="text-[9px] text-slate-500 uppercase font-bold">{lang === 'tr' ? 'Birim Satış Fiyatı' : 'Unit Price'}</label>
                                            <div className="relative">
                                                <span className="absolute left-2.5 top-2 text-slate-500 font-bold">{currencySymbol}</span>
                                                <input 
                                                    type="number" 
                                                    value={shadingFormPrice} 
                                                    onChange={(e) => setShadingFormPrice(parseInt(e.target.value) || 0)} 
                                                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 pl-7 text-white font-mono text-emerald-400 font-bold"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const activeTitle = selectedShadingProduct === 'bioclimatic-pergola' ? (lang === 'tr' ? 'Bioklimatik Pergole' : 'Bioclimatic Pergola') :
                                                              selectedShadingProduct === 'rolling-roof' ? (lang === 'tr' ? 'Rolling Roof / Açılır Tavan' : 'Rolling Roof') :
                                                              selectedShadingProduct === 'zip-blind' ? (lang === 'tr' ? 'Zip Perde / Stor' : 'Zip Blind') :
                                                              selectedShadingProduct === 'awning' ? (lang === 'tr' ? 'Mafsallı Tente' : 'Awning System') :
                                                              selectedShadingProduct === 'guillotine' ? (lang === 'tr' ? 'Giyotin Cam Sistemi' : 'Guillotine Glass') :
                                                              selectedShadingProduct === 'glass-balcony' ? (lang === 'tr' ? 'Katlanır Cam Balkon' : 'Glass Balcony') : selectedShadingProduct;
                                            const newId = `shading-${Date.now()}`;
                                            const created: ShadingItem = {
                                                id: newId,
                                                productType: selectedShadingProduct as any,
                                                name: `${activeTitle} - ${selectedShadingColor}`,
                                                width: shadingFormWidth,
                                                height: shadingFormHeight,
                                                depth: shadingFormDepth,
                                                frontHeight: shadingFormFrontHeight,
                                                backHeight: shadingFormBackHeight,
                                                quantity: shadingFormQty,
                                                unitPrice: shadingFormPrice,
                                                color: selectedShadingColor,
                                                notes: selectedShadingNotes,
                                                overlayX: 50,
                                                overlayY: 50,
                                                overlayScale: 100,
                                                overlayRotate: 0
                                            };
                                            handleAddShadingItem(created);
                                            showToast(
                                                lang === 'tr'
                                                    ? 'Ürün başarıyla teklif sepetine eklendi!'
                                                    : 'Shading unit successfully added to project quotation!',
                                                'success'
                                            );
                                        }}
                                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 mt-1"
                                    >
                                        <Plus size={13} />
                                        <span>{lang === 'tr' ? 'TEKLİFE DOĞRUDAN EKLE' : 'ADD TO PROPOSAL DIRECTLY'}</span>
                                    </button>
                                </div>

                                {/* SECTION 5: GENERATE ACTION */}
                                <button
                                    onClick={handleAnalyzeShading}
                                    disabled={isAnalyzingShading}
                                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-wider py-4 rounded-2xl shadow-xl shadow-indigo-600/15 flex items-center justify-center gap-2.5 transition-all disabled:opacity-50"
                                >
                                    {isAnalyzingShading ? (
                                        <>
                                            <Loader2 className="animate-spin animate-infinite" size={16} />
                                            <span>{lang === 'tr' ? 'YAPAY ZEKA ENTEGRE EDİYOR...' : 'AI INTEGRATING MODULES...'}</span>
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles size={16} className="text-amber-400 animate-pulse" />
                                            <span>{lang === 'tr' ? 'GÖRSELLEŞTİRME OLUŞTUR' : 'GENERATE VISUALIZATION'}</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* RIGHT: Visual Canvas Area (Column width: 8) */}
                        <div className="lg:col-span-8 lg:order-2 space-y-6">
                            <div 
                                onDragOver={handleShadingDragOver}
                                onDragLeave={handleShadingDragLeave}
                                onDrop={handleShadingDrop}
                                className={`bg-slate-900 border rounded-3xl p-6 shadow-2xl relative overflow-hidden transition-all duration-300 ${isDraggingFile ? 'border-indigo-500 bg-slate-900/40 ring-2 ring-indigo-500/20 scale-[1.01]' : 'border-slate-800'}`}
                            >
                                {/* Gorgeous full-container Drag Overlay */}
                                {isDraggingFile && (
                                    <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md z-50 flex flex-col items-center justify-center p-8 border-4 border-dashed border-indigo-500 m-3 rounded-2xl pointer-events-none animate-in fade-in zoom-in-95 duration-200">
                                        <div className="w-16 h-16 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-4 animate-bounce">
                                            <Upload size={32} />
                                        </div>
                                        <h4 className="text-lg font-black text-white uppercase tracking-wider">
                                            {lang === 'tr' ? 'EV FOTOĞRAFINIZI BIRAKIN' : 'DROP YOUR HOUSE PHOTO'}
                                        </h4>
                                        <p className="text-sm text-slate-400 mt-2 text-center max-w-md leading-relaxed">
                                            {lang === 'tr' 
                                                ? 'Seçtiğiniz fotoğraf arka plan olarak yüklenecek ve perspektif montaj aşamasına geçilecektir.' 
                                                : 'Your selected photo will be loaded as background to configure perspective matching instantly.'}
                                        </p>
                                    </div>
                                )}
                                
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 border-b border-white/5 pb-4">
                                    <div>
                                        <h3 className="text-sm font-black uppercase tracking-wider text-slate-200">
                                            {shadingCanvasMode === 'design' 
                                                ? (lang === 'tr' ? '1. CEPHE ÜZERİNDEN ÖLÇÜ ÇİZİMİ' : '1. FAÇADE DESIGN MEASUREMENT')
                                                : (lang === 'tr' ? 'MİMARİ SUNUM (ÖNCE / SONRA)' : 'ARCHITECTURAL BEFORE / AFTER PRESENTATION')}
                                        </h3>
                                        <p className="text-[11px] text-slate-400 mt-0.5">
                                            {shadingCanvasMode === 'design' 
                                                ? (lang === 'tr' ? 'Görsel üzerine tıklayarak sistemi yerleştirmek istediğiniz alanı çevreleyen noktalar çizin.' : 'Click points directly on the building photo to outline your pergola installation region.')
                                                : (lang === 'tr' ? 'Ortadaki sürgüyü kaydırarak orijinal bina ve montajlı yapıyı kıyaslayın.' : 'Slide back and forth to preview the integrated custom pergola in perspective on your home.')}
                                        </p>
                                    </div>
                                    
                                    {/* Sub-tab view Mode Switcher */}
                                    <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-850">
                                        <button
                                            onClick={() => setShadingCanvasMode('design')}
                                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 ${shadingCanvasMode === 'design' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                                        >
                                            <Wrench size={11} />
                                            <span>{lang === 'tr' ? 'CAD ÖLÇÜ ÇİZİMİ' : 'CAD MEASURE'}</span>
                                        </button>
                                        <button
                                            onClick={() => setShadingCanvasMode('comparison')}
                                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 ${shadingCanvasMode === 'comparison' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                                        >
                                            <Eye size={11} />
                                            <span>{lang === 'tr' ? 'KIYASLAMA GÖRÜNÜMÜ' : 'BEFORE / AFTER'}</span>
                                        </button>
                                    </div>
                                </div>

                                {shadingCanvasMode === 'comparison' ? (
                                    /* BEFORE / AFTER SLIDER SHOWCASE */
                                    <div 
                                        ref={(el) => {
                                            (sliderContainerRef as any).current = el;
                                            (shadingCanvasRef as any).current = el;
                                        }}
                                        onMouseMove={(e) => {
                                            if (isSliding) {
                                                const rect = e.currentTarget.getBoundingClientRect();
                                                const x = e.clientX - rect.left;
                                                const pct = Math.min(100, Math.max(0, Math.round((x / rect.width) * 100)));
                                                setSliderPosition(pct);
                                            }
                                        }}
                                        onMouseLeave={() => setIsSliding(false)}
                                        onMouseUp={() => setIsSliding(false)}
                                        onTouchMove={(e) => {
                                            if (isSliding && e.touches[0]) {
                                                const rect = e.currentTarget.getBoundingClientRect();
                                                const x = e.touches[0].clientX - rect.left;
                                                const pct = Math.min(100, Math.max(0, Math.round((x / rect.width) * 100)));
                                                setSliderPosition(pct);
                                            }
                                        }}
                                        onTouchEnd={() => setIsSliding(false)}
                                        className="relative rounded-2xl overflow-hidden aspect-[4/3] max-h-[550px] bg-slate-950 border border-white/5 select-none cursor-ew-resize shadow-inner group"
                                    >
                                        {/* BEFORE LAYER (PLAIN ARCHITECTURE) */}
                                        <img 
                                            src={shadingBgImage} 
                                            alt="Before Installation" 
                                            className="absolute inset-0 w-full h-full object-cover select-none" 
                                            referrerPolicy="no-referrer"
                                        />
                                        <div className="absolute top-4 left-4 bg-slate-950/80 backdrop-blur-md border border-white/10 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase text-slate-300 tracking-wider z-20 font-mono">
                                            {lang === 'tr' ? 'ÖNCE (HAM CEPHE)' : 'BEFORE (ORIGINAL)'}
                                        </div>

                                        {/* AFTER LAYER (INTEGRATED CAD OVERLAY WITH PERSPECTIVE CLIPPING) */}
                                        <div 
                                            style={{
                                                position: 'absolute',
                                                inset: 0,
                                                clipPath: `polygon(${sliderPosition}% 0%, 100% 0%, 100% 100%, ${sliderPosition}% 100%)`,
                                                pointerEvents: 'none'
                                            }}
                                            className="w-full h-full"
                                        >
                                            <img 
                                                src={shadingBgImage} 
                                                alt="After Installation" 
                                                className="absolute inset-0 w-full h-full object-cover select-none" 
                                                referrerPolicy="no-referrer"
                                            />

                                            {/* Beautiful Projected CAD Item Over Drawn Region */}
                                            {isDrawingCompleted && polygonPoints.length >= 3 && (
                                                <div 
                                                    style={{
                                                        position: 'absolute',
                                                        left: 0,
                                                        top: 0,
                                                        width: '200px',
                                                        height: '150px',
                                                        transformOrigin: '0px 0px',
                                                        transform: (() => {
                                                            const src = [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 150 }, { x: 0, y: 150 }];
                                                            const pointsForWarp = [...polygonPoints];
                                                            if (pointsForWarp.length === 3) {
                                                                const p0 = pointsForWarp[0];
                                                                const p1 = pointsForWarp[1];
                                                                const p2 = pointsForWarp[2];
                                                                const p3 = {
                                                                    x: Math.max(0, Math.min(100, p2.x + (p0.x - p1.x))),
                                                                    y: Math.max(0, Math.min(100, p2.y + (p0.y - p1.y)))
                                                                };
                                                                pointsForWarp.push(p3);
                                                            }
                                                            const sortedPts = sortQuadrilateralPoints(pointsForWarp);
                                                            const dst = sortedPts.map(p => ({
                                                                x: (p.x * canvasDimensions.width) / 100,
                                                                y: (p.y * canvasDimensions.height) / 100
                                                            }));
                                                            return getPerspectiveTransform(src, dst);
                                                        })(),
                                                        zIndex: 20,
                                                    }}
                                                    className="drop-shadow-[0_15px_30px_rgba(0,0,0,0.65)]"
                                                >
                                                    {renderRealisticShadingSVG({
                                                        id: 'shading-active-visual',
                                                        productType: selectedShadingProduct as any,
                                                        name: selectedShadingProduct,
                                                        width: Math.round(boundingBox.w * 100),
                                                        height: Math.round(boundingBox.h * 100),
                                                        color: selectedShadingColor,
                                                        overlayX: 50,
                                                        overlayY: 50,
                                                        overlayScale: 100,
                                                        overlayRotate: 0,
                                                        quantity: 1,
                                                        unitPrice: 4500,
                                                    })}
                                                </div>
                                            )}
                                        </div>

                                        <div className="absolute top-4 right-4 bg-indigo-600/90 backdrop-blur-md border border-indigo-500/20 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase text-white tracking-wider z-20 font-mono">
                                            {lang === 'tr' ? 'SONRA (MONTAJLI YAPI)' : 'AFTER (INTEGRATED DESIGN)'}
                                        </div>

                                        {/* SLIDER DIVISION CONTROL BAR */}
                                        <div 
                                            style={{ left: `${sliderPosition}%` }}
                                            className="absolute top-0 bottom-0 w-0.5 bg-white shadow-2xl z-30 pointer-events-auto"
                                        >
                                            <div 
                                                onMouseDown={(e) => {
                                                    e.stopPropagation();
                                                    setIsSliding(true);
                                                }}
                                                onTouchStart={(e) => {
                                                    e.stopPropagation();
                                                    setIsSliding(true);
                                                }}
                                                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white hover:bg-slate-100 rounded-full flex items-center justify-center shadow-2xl border border-indigo-500 cursor-ew-resize transition-transform hover:scale-110 active:scale-95"
                                            >
                                                <div className="text-indigo-600 font-extrabold text-[10px] tracking-tight pointer-events-none select-none">
                                                    ◀▶
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    /* INTERACTIVE CAD DRAWING STAGE */
                                    <div 
                                        ref={shadingCanvasRef}
                                        onClick={handleCanvasClick}
                                        onMouseMove={(e) => {
                                            if (draggingNodeIndex !== null) {
                                                const rect = e.currentTarget.getBoundingClientRect();
                                                const mouseX = e.clientX - rect.left;
                                                const mouseY = e.clientY - rect.top;
                                                const pctX = Math.round((mouseX / rect.width) * 1000) / 10;
                                                const pctY = Math.round((mouseY / rect.height) * 1000) / 10;
                                                const clampedX = Math.max(0, Math.min(100, pctX));
                                                const clampedY = Math.max(0, Math.min(100, pctY));
                                                setPolygonPoints(prev => {
                                                    const updated = [...prev];
                                                    if (updated[draggingNodeIndex]) {
                                                        updated[draggingNodeIndex] = { x: clampedX, y: clampedY };
                                                    }
                                                    return updated;
                                                });
                                            } else if (isDraggingManualCenter && dragStartRef.current) {
                                                const rect = e.currentTarget.getBoundingClientRect();
                                                const mouseX = e.clientX - rect.left;
                                                const mouseY = e.clientY - rect.top;
                                                const pctX = (mouseX / rect.width) * 100;
                                                const pctY = (mouseY / rect.height) * 100;
                                                const deltaX = pctX - dragStartRef.current.x;
                                                const deltaY = pctY - dragStartRef.current.y;
                                                const newPoints = dragStartRef.current.points.map(p => {
                                                    const newX = Math.max(0, Math.min(100, Math.round((p.x + deltaX) * 10) / 10));
                                                    const newY = Math.max(0, Math.min(100, Math.round((p.y + deltaY) * 10) / 10));
                                                    return { x: newX, y: newY };
                                                });
                                                setPolygonPoints(newPoints);
                                            }
                                        }}
                                        onTouchMove={(e) => {
                                            if (draggingNodeIndex !== null && e.touches[0]) {
                                                const rect = e.currentTarget.getBoundingClientRect();
                                                const touchX = e.touches[0].clientX - rect.left;
                                                const touchY = e.touches[0].clientY - rect.top;
                                                const pctX = Math.round((touchX / rect.width) * 1000) / 10;
                                                const pctY = Math.round((touchY / rect.height) * 1000) / 10;
                                                const clampedX = Math.max(0, Math.min(100, pctX));
                                                const clampedY = Math.max(0, Math.min(100, pctY));
                                                setPolygonPoints(prev => {
                                                    const updated = [...prev];
                                                    if (updated[draggingNodeIndex]) {
                                                        updated[draggingNodeIndex] = { x: clampedX, y: clampedY };
                                                    }
                                                    return updated;
                                                });
                                            } else if (isDraggingManualCenter && dragStartRef.current && e.touches[0]) {
                                                const rect = e.currentTarget.getBoundingClientRect();
                                                const touchX = e.touches[0].clientX - rect.left;
                                                const touchY = e.touches[0].clientY - rect.top;
                                                const pctX = (touchX / rect.width) * 100;
                                                const pctY = (touchY / rect.height) * 100;
                                                const deltaX = pctX - dragStartRef.current.x;
                                                const deltaY = pctY - dragStartRef.current.y;
                                                const newPoints = dragStartRef.current.points.map(p => {
                                                    const newX = Math.max(0, Math.min(100, Math.round((p.x + deltaX) * 10) / 10));
                                                    const newY = Math.max(0, Math.min(100, Math.round((p.y + deltaY) * 10) / 10));
                                                    return { x: newX, y: newY };
                                                });
                                                setPolygonPoints(newPoints);
                                            }
                                        }}
                                        onMouseUp={() => {
                                            if (draggingNodeIndex !== null || isDraggingManualCenter) {
                                                setBasePerspectivePoints(polygonPoints);
                                                setManualScaleX(1.0);
                                                setManualScaleY(1.0);
                                                setManualRotate(0);
                                                setManualShiftX(0);
                                                setManualShiftY(0);
                                            }
                                            setDraggingNodeIndex(null);
                                            setIsDraggingManualCenter(false);
                                        }}
                                        onMouseLeave={() => {
                                            if (draggingNodeIndex !== null || isDraggingManualCenter) {
                                                setBasePerspectivePoints(polygonPoints);
                                                setManualScaleX(1.0);
                                                setManualScaleY(1.0);
                                                setManualRotate(0);
                                                setManualShiftX(0);
                                                setManualShiftY(0);
                                            }
                                            setDraggingNodeIndex(null);
                                            setIsDraggingManualCenter(false);
                                        }}
                                        onTouchEnd={() => {
                                            if (draggingNodeIndex !== null || isDraggingManualCenter) {
                                                setBasePerspectivePoints(polygonPoints);
                                                setManualScaleX(1.0);
                                                setManualScaleY(1.0);
                                                setManualRotate(0);
                                                setManualShiftX(0);
                                                setManualShiftY(0);
                                            }
                                            setDraggingNodeIndex(null);
                                            setIsDraggingManualCenter(false);
                                        }}
                                        className="relative rounded-2xl overflow-hidden aspect-[4/3] max-h-[550px] bg-slate-950 border border-white/5 cursor-crosshair group select-none"
                                    >
                                        {/* Background picture */}
                                        <img 
                                            src={shadingBgImage} 
                                            alt="Facade" 
                                            className="w-full h-full object-cover image-overlay-bg select-none" 
                                            referrerPolicy="no-referrer"
                                        />
 
                                        {/* Interactive laser scanning overlay */}
                                        {isAnalyzingShading && (
                                            <div 
                                                className="absolute inset-x-0 h-1.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_20px_#22d3ee] z-50 pointer-events-none"
                                                style={{
                                                    animation: 'scan-laser 2.5s linear infinite',
                                                    top: '0%',
                                                }}
                                            />
                                        )}
 
                                        {/* Realistic CAD Model Overlaid Real-time Inside Drawing Box */}
                                        {isDrawingCompleted && polygonPoints.length >= 3 && (
                                            <div 
                                                style={{
                                                    position: 'absolute',
                                                    left: 0,
                                                    top: 0,
                                                    width: '200px',
                                                    height: '150px',
                                                    transformOrigin: '0px 0px',
                                                    transform: (() => {
                                                        const src = [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 150 }, { x: 0, y: 150 }];
                                                        const pointsForWarp = [...polygonPoints];
                                                        if (pointsForWarp.length === 3) {
                                                            const p0 = pointsForWarp[0];
                                                            const p1 = pointsForWarp[1];
                                                            const p2 = pointsForWarp[2];
                                                            const p3 = {
                                                                x: Math.max(0, Math.min(100, p2.x + (p0.x - p1.x))),
                                                                y: Math.max(0, Math.min(100, p2.y + (p0.y - p1.y)))
                                                            };
                                                            pointsForWarp.push(p3);
                                                        }
                                                        const sortedPts = sortQuadrilateralPoints(pointsForWarp);
                                                        const dst = sortedPts.map(p => ({
                                                            x: (p.x * canvasDimensions.width) / 100,
                                                            y: (p.y * canvasDimensions.height) / 100
                                                        }));
                                                        return getPerspectiveTransform(src, dst);
                                                    })(),
                                                    pointerEvents: 'none',
                                                    zIndex: 30,
                                                }}
                                                className="opacity-95 transition-all duration-300 drop-shadow-[0_12px_24px_rgba(0,0,0,0.5)]"
                                            >
                                                {renderRealisticShadingSVG({
                                                    id: 'shading-design-preview',
                                                    productType: selectedShadingProduct as any,
                                                    name: selectedShadingProduct,
                                                    width: Math.round(boundingBox.w * 100),
                                                    height: Math.round(boundingBox.h * 100),
                                                    color: selectedShadingColor,
                                                    overlayX: 50,
                                                    overlayY: 50,
                                                    overlayScale: 100,
                                                    overlayRotate: 0,
                                                    quantity: 1,
                                                    unitPrice: 4500,
                                                })}
                                            </div>
                                        )}
 
                                        {/* SVG DRAWING LINES & NODES GRAPHICS OVERLAY */}
                                        <svg className="absolute inset-0 w-full h-full pointer-events-none z-40">
                                            {polygonPoints.length > 0 && (
                                                <g>
                                                    {/* Draw lines */}
                                                    <polyline
                                                        points={polygonPoints.map(p => `${(p.x * 1)}%,${(p.y * 1)}%`).join(' ')}
                                                        fill="none"
                                                        stroke="#22d3ee"
                                                        strokeWidth="2.5"
                                                        strokeDasharray={isDrawingCompleted ? "none" : "4,4"}
                                                        className={isDrawingCompleted ? "" : "animate-pulse"}
                                                    />
                                                    
                                                    {/* If completed, draw closed polygon */}
                                                    {isDrawingCompleted && (
                                                        <polygon
                                                            points={polygonPoints.map(p => `${p.x}%,${p.y}%`).join(' ')}
                                                            fill="rgba(34, 211, 238, 0.15)"
                                                            stroke="#22d3ee"
                                                            strokeWidth="3.5"
                                                            className="transition-all duration-300 pointer-events-auto cursor-move"
                                                            onMouseDown={(e) => {
                                                                e.stopPropagation();
                                                                e.preventDefault();
                                                                setIsDraggingManualCenter(true);
                                                                if (shadingCanvasRef.current) {
                                                                    const rect = shadingCanvasRef.current.getBoundingClientRect();
                                                                    const clickX = e.clientX - rect.left;
                                                                    const clickY = e.clientY - rect.top;
                                                                    const pctX = (clickX / rect.width) * 100;
                                                                    const pctY = (clickY / rect.height) * 100;
                                                                    dragStartRef.current = {
                                                                        x: pctX,
                                                                        y: pctY,
                                                                        points: [...polygonPoints]
                                                                    };
                                                                }
                                                            }}
                                                            onTouchStart={(e) => {
                                                                e.stopPropagation();
                                                                if (shadingCanvasRef.current && e.touches[0]) {
                                                                    const rect = shadingCanvasRef.current.getBoundingClientRect();
                                                                    const clickX = e.touches[0].clientX - rect.left;
                                                                    const clickY = e.touches[0].clientY - rect.top;
                                                                    const pctX = (clickX / rect.width) * 100;
                                                                    const pctY = (clickY / rect.height) * 100;
                                                                    dragStartRef.current = {
                                                                        x: pctX,
                                                                        y: pctY,
                                                                        points: [...polygonPoints]
                                                                    };
                                                                    setIsDraggingManualCenter(true);
                                                                }
                                                            }}
                                                        />
                                                    )}
 
                                                    {/* Draw click node circles */}
                                                    {polygonPoints.map((pt, i) => (
                                                        <g key={i}>
                                                            {i === 0 && !isDrawingCompleted && (
                                                                <circle
                                                                    cx={`${pt.x}%`}
                                                                    cy={`${pt.y}%`}
                                                                    r="12"
                                                                    fill="none"
                                                                    stroke="#eab308"
                                                                    strokeWidth="1.5"
                                                                    className="animate-ping"
                                                                />
                                                            )}
                                                            {/* Invisible large touch target for extreme ease of dragging on mobile */}
                                                            <circle
                                                                cx={`${pt.x}%`}
                                                                cy={`${pt.y}%`}
                                                                r="18"
                                                                fill="transparent"
                                                                className="pointer-events-auto cursor-grab active:cursor-grabbing"
                                                                onMouseDown={(e) => {
                                                                    e.stopPropagation();
                                                                    e.preventDefault();
                                                                    setDraggingNodeIndex(i);
                                                                }}
                                                                onTouchStart={(e) => {
                                                                    e.stopPropagation();
                                                                    setDraggingNodeIndex(i);
                                                                }}
                                                            />
                                                            <circle
                                                                cx={`${pt.x}%`}
                                                                cy={`${pt.y}%`}
                                                                r={i === 0 ? "8" : "6"}
                                                                fill={i === 0 ? "#eab308" : "#22d3ee"}
                                                                stroke="#ffffff"
                                                                strokeWidth="2"
                                                                className="pointer-events-auto cursor-grab active:cursor-grabbing hover:scale-135 transition-transform"
                                                            >
                                                                <title>{i === 0 ? (lang === 'tr' ? 'İlk nokta' : 'First point') : `Point ${i + 1}`}</title>
                                                            </circle>
                                                        </g>
                                                    ))}
                                                </g>
                                            )}
                                        </svg>

                                        {/* Visual Instructions Alert Banner */}
                                        <div className="absolute top-4 left-4 bg-slate-950/80 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-xl flex items-center gap-2 pointer-events-none z-10 animate-fade-in text-[10px] font-bold text-slate-300">
                                            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                                            <span>
                                                {polygonPoints.length === 0 
                                                    ? (lang === 'tr' ? 'ÇİZİME BAŞLA: Cephe bölgesine en az 3 kez tıklayın' : 'START OUTLINE: Click at least 3 corners on the building')
                                                    : isDrawingCompleted 
                                                    ? (lang === 'tr' ? 'ÇİZİM TAMAMLANDI: Soldan "Görselleştirme Oluştur"a tıklayın' : 'OUTLINE LOCKED: Click "Generate Visualization" on sidebar')
                                                    : (lang === 'tr' ? `Nokta ekleniyor (${polygonPoints.length}). Kapatmak için ilk sarı halkaya tıklayın.` : `Adding nodes (${polygonPoints.length}). Click the yellow halo to close loop.`)}
                                            </span>
                                        </div>

                                        {/* Floating Zoom / Grid Helper controls */}
                                        <div className="absolute bottom-4 right-4 bg-slate-950/80 backdrop-blur-md border border-white/10 p-2 rounded-xl flex items-center gap-2 z-20 pointer-events-auto">
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setPolygonPoints([]);
                                                    setIsDrawingCompleted(false);
                                                    setVisualizedImage(null);
                                                    setAiShadingReport(null);
                                                }}
                                                className="p-1.5 bg-slate-900 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                                                title={lang === 'tr' ? 'Çizimi Sıfırla' : 'Reset Outline'}
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                            <div className="w-px h-4 bg-white/10" />
                                            <button 
                                                onClick={handleAutoDraw}
                                                disabled={isDetectingPerspective}
                                                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 active:scale-95 shadow-md ${
                                                    isDetectingPerspective 
                                                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed animate-pulse' 
                                                    : 'bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white shadow-indigo-600/20 mr-1'
                                                }`}
                                                title={lang === 'tr' ? 'Yapay Zekâ ile Cepheyi Analiz Et ve Perspektifli Yerleştir' : 'Analyze Facade with AI and Place in Perspective'}
                                            >
                                                {isDetectingPerspective ? (
                                                    <>
                                                        <div className="w-3.5 h-3.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mr-1" />
                                                        <span>{lang === 'tr' ? 'PERSPEKTİF HESAPLANIYOR...' : 'COMPUTING PERSPECTIVE...'}</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Sparkles size={12} className="text-amber-300 animate-pulse" />
                                                        <span>{lang === 'tr' ? 'YAPAY ZEKÂ PERSPEKTİF' : 'AI PERSPECTIVE SNAP'}</span>
                                                    </>
                                                )}
                                            </button>
                                            <div className="w-px h-4 bg-white/10" />
                                            <span className="text-[10px] font-mono text-slate-400 px-1 select-none">ZOOM: 100%</span>
                                            <div className="w-px h-4 bg-white/10" />
                                            <div className="text-[10px] font-mono text-cyan-400 px-1 font-bold">GRID: CAD LOCK</div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Laser scanner inline animation inject keyframes style tag */}
                            <style>{`
                                @keyframes scan-laser {
                                    0% { top: 0%; opacity: 0; }
                                    10% { opacity: 1; }
                                    90% { opacity: 1; }
                                    100% { top: 100%; opacity: 0; }
                                }
                            `}</style>
                        </div>
                    </div>

                    {/* AI REPORT SPECTACULAR PRESENTATION SPECIFICATIONS BOARD */}
                    {aiShadingReport && (
                        <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-8 shadow-2xl space-y-6 animate-in slide-in-from-bottom-6">
                            <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-white/5 pb-5 gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-3 bg-indigo-600/15 rounded-2xl text-indigo-400">
                                        <Brain size={24} className="animate-pulse" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-white uppercase tracking-tight">
                                            {lang === 'tr' ? 'MİMARİ YAPILANDIRMA VE YAPAY ZEKA RAPORU' : 'AI ARCHITECTURAL SPECIFICATION REPORT'}
                                        </h3>
                                        <p className="text-xs text-slate-400 mt-0.5">
                                            {lang === 'tr' ? 'VizyonPergola akıllı analiz motorları tarafından oluşturuldu' : 'Generated by VizyonPergola design & analysis engines'}
                                        </p>
                                    </div>
                                </div>
                                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20 px-3 py-1 rounded-full uppercase tracking-wider font-mono">
                                    {lang === 'tr' ? 'Feasibilite: %98 Olumlu' : 'Feasibility: 98% Optimal'}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 font-sans">
                                {/* Left/Center Column - Feasibility & Architectural Review */}
                                <div className="lg:col-span-2 space-y-6">
                                    <div className="space-y-3">
                                        <h4 className="text-xs font-black uppercase text-indigo-400 tracking-wider flex items-center gap-1.5 font-sans">
                                            <Palette size={14} />
                                            <span>{lang === 'tr' ? 'MİMARİ VE ESTETİK DEĞERLENDİRME' : 'ARCHITECTURAL DESIGN REVIEW'}</span>
                                        </h4>
                                        <div className="bg-slate-950/45 p-5 rounded-2xl border border-white/5 text-slate-300 text-xs leading-relaxed space-y-4 font-sans">
                                            {aiShadingReport.architecturalReview ? (
                                                <div className="prose prose-invert prose-xs">
                                                    {aiShadingReport.architecturalReview.split('\n').map((line, lidx) => (
                                                        <p key={lidx}>{line}</p>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p>{lang === 'tr' ? 'Cephe uyumu, rüzgar direnci ve drenaj entegrasyonu tamamen test edildi.' : 'Facade visual matching, structural wind load guidelines and drainage configurations fully calculated.'}</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Recommendations details table */}
                                    <div className="space-y-3">
                                        <h4 className="text-xs font-black uppercase text-indigo-400 tracking-wider flex items-center gap-1.5">
                                            <Ruler size={14} />
                                            <span>{lang === 'tr' ? 'MÜHENDİSLİK DETAYLARI VE EBAT ÖNERİLERİ' : 'TECHNICAL GUIDELINES & SPECIFICATIONS'}</span>
                                        </h4>
                                        
                                        <div className="bg-slate-950/60 rounded-2xl border border-white/5 overflow-hidden">
                                            <table className="w-full text-left text-xs border-collapse">
                                                <thead>
                                                    <tr className="bg-slate-950 border-b border-white/5 text-slate-400 font-extrabold uppercase tracking-wider text-[10px]">
                                                        <th className="px-5 py-3.5">{lang === 'tr' ? 'Önerilen Sistem' : 'Product Type'}</th>
                                                        <th className="px-5 py-3.5">{lang === 'tr' ? 'Boyutlar (G x Y x D)' : 'Suggested Sizing'}</th>
                                                        <th className="px-5 py-3.5 text-right">{lang === 'tr' ? 'Renk Finisaj' : 'Finish Standard'}</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/5 text-slate-300">
                                                    {(aiShadingReport.recommendations || []).map((rec, i) => (
                                                        <tr key={i} className="hover:bg-white/5 transition-colors">
                                                            <td className="px-5 py-4">
                                                                <div className="font-bold text-white text-xs">{rec.name}</div>
                                                                <div className="text-[10px] text-indigo-400 font-mono uppercase mt-0.5">{rec.productType}</div>
                                                            </td>
                                                            <td className="px-5 py-4 font-mono font-bold text-slate-100">
                                                                {rec.suggestedWidth} x {rec.suggestedHeight} {rec.suggestedDepth ? `x ${rec.suggestedDepth}` : ''} mm
                                                            </td>
                                                            <td className="px-5 py-4 text-right">
                                                                <span className="bg-slate-950 border border-white/10 px-2 py-1 rounded text-[10px] font-mono text-emerald-400">{rec.suggestedColor}</span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    {(!aiShadingReport.recommendations || aiShadingReport.recommendations.length === 0) && (
                                                        <tr>
                                                            <td className="px-5 py-4 font-bold text-white">{lang === 'tr' ? 'Seçilen Profil Sistemi' : 'Configured Shading Product'}</td>
                                                            <td className="px-5 py-4 font-mono">
                                                                {Math.round(boundingBox.w * 100)} x {Math.round(boundingBox.h * 100)} x 3000 mm
                                                            </td>
                                                            <td className="px-5 py-4 text-right">
                                                                <span className="bg-slate-950 border border-white/10 px-2 py-1 rounded text-[10px] font-mono text-emerald-400">{selectedShadingColor}</span>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column - Sales pitch and cost estimate */}
                                <div className="space-y-6">
                                    <div className="space-y-3">
                                        <h4 className="text-xs font-black uppercase text-indigo-400 tracking-wider flex items-center gap-1.5">
                                            <MessageSquare size={14} />
                                            <span>{lang === 'tr' ? 'MÜŞTERI TEKLİF MEKTUBU' : 'CLIENT SALES PROPOSAL'}</span>
                                        </h4>
                                        
                                        <div className="bg-slate-950 p-5 rounded-3xl border border-white/10 shadow-lg relative flex flex-col justify-between h-full min-h-[220px]">
                                            <p className="text-xs text-indigo-200 leading-relaxed italic">
                                                "{aiShadingReport.salesPitch || (lang === 'tr' 
                                                    ? 'Dış mekanınıza konfor ve modernlik getirecek harika bir çözüm tasarladık.' 
                                                    : 'We have configured a luxurious outdoor extension optimized for your architectural facade.')}"
                                            </p>
                                            <div className="border-t border-white/10 pt-4 mt-4 flex items-center justify-between">
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest">{lang === 'tr' ? 'YAKLAŞIK MALİYET' : 'BUDGETARY ESTIMATE'}</span>
                                                    <span className="text-lg font-black text-emerald-400 font-mono mt-0.5">
                                                        {currencySymbol}{(((aiShadingReport.recommendations?.[0]?.estimatedSqmPrice || 350) * (boundingBox.w * boundingBox.h / 100)) || 4500).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                    </span>
                                                </div>
                                                <span className="text-[9px] bg-indigo-500/20 text-indigo-300 font-extrabold uppercase px-2 py-1 rounded font-mono border border-indigo-500/20">
                                                    {lang === 'tr' ? 'Anahtar Teslim' : 'Fully Installed'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action items */}
                                    <div className="bg-indigo-950/20 border border-indigo-500/10 p-5 rounded-3xl flex flex-col gap-3 font-sans">
                                        <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest font-mono">
                                            {lang === 'tr' ? 'TEKLİF SİSTEM KAYDI' : 'PROPOSAL COMPILATION'}
                                        </div>
                                        <button
                                            onClick={() => {
                                                // Generate a new shading system item with this custom proposal
                                                const newId = `shading-ai-${Date.now()}`;
                                                const rec = aiShadingReport.recommendations?.[0];
                                                const newItem: ShadingItem = {
                                                    id: newId,
                                                    productType: selectedShadingProduct as any,
                                                    name: rec?.name || (lang === 'tr' ? 'Özelleştirilmiş Sistem' : 'Custom Configured Unit'),
                                                    width: rec?.suggestedWidth || Math.round(boundingBox.w * 100),
                                                    height: rec?.suggestedHeight || Math.round(boundingBox.h * 100),
                                                    depth: rec?.suggestedDepth || 3000,
                                                    frontHeight: rec?.suggestedHeight || Math.round(boundingBox.h * 100),
                                                    backHeight: rec?.suggestedHeight || Math.round(boundingBox.h * 100),
                                                    quantity: 1,
                                                    unitPrice: (rec?.estimatedSqmPrice || 350) * 10, // approximate unit price
                                                    color: selectedShadingColor,
                                                    notes: selectedShadingNotes,
                                                    overlayX: boundingBox.x + boundingBox.w / 2,
                                                    overlayY: boundingBox.y + boundingBox.h / 2,
                                                    overlayScale: 100,
                                                    overlayRotate: 0,
                                                };
                                                handleAddShadingItem(newItem);
                                                alert(lang === 'tr' ? 'Tasarım teklifi projeye başarıyla eklendi!' : 'Design proposal successfully saved as project unit!');
                                            }}
                                            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-wider py-3.5 rounded-2xl border border-white/5 flex items-center justify-center gap-2 transition-all"
                                        >
                                            <FileCheck size={14} className="text-emerald-400" />
                                            <span>{lang === 'tr' ? 'TEKLİF SİSTEMİ OLARAK KAYDET' : 'SAVE AS ACTIVE UNIT'}</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
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
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-11 h-11 bg-white dark:bg-slate-900 rounded-lg border border-slate-200/60 dark:border-slate-700/60 shadow-[0_1px_2px_rgba(0,0,0,0.04)] flex items-center justify-center p-1.5 shrink-0 select-none print:border-slate-300">
                                                                    <ProfileThumbnail profileLabel={opt.profileLabel} profileCode={opt.profileCode} customImages={mergedProfileImages} />
                                                                </div>
                                                                <div>
                                                                    <div className="font-bold text-white text-base print:text-black">{t(lang, opt.profileLabel as any) || opt.profileLabel}</div>
                                                                    <div className="text-[10px] text-slate-500 font-mono mt-1 uppercase print:text-slate-400">{opt.systemName}</div>
                                                                </div>
                                                            </div>
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
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-11 h-11 bg-white dark:bg-slate-900 rounded-lg border border-slate-200/60 dark:border-slate-700/60 shadow-[0_1px_2px_rgba(0,0,0,0.04)] flex items-center justify-center p-1.5 shrink-0 select-none print:border-slate-300">
                                                                    <AccessoryThumbnail accessoryName={acc.name} accessoryType={acc.type} accessoryId={acc.id} customImages={customAccessoryImages} />
                                                                </div>
                                                                <div className="font-bold text-white text-base print:text-black">{acc.name}</div>
                                                            </div>
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

                  {/* Mini Visualizer Preview */}
                  {u.rootNode && (
                    <div className="w-14 h-14 bg-slate-950 rounded-xl border border-slate-800 p-1 flex items-center justify-center shrink-0 overflow-hidden shadow-inner">
                      <svg viewBox={getViewBoxWithDimensions(u.width, u.height)} className="w-full h-full max-h-full max-w-full">
                        <Visualizer
                          node={u.rootNode}
                          width={u.width}
                          height={u.height}
                          system={systems.find(s => s.id === u.system) || systems[0]}
                          selectedNodeId={null}
                          onSelectNode={() => {}}
                          theme="dark"
                          lang={lang}
                        />
                      </svg>
                    </div>
                  )}

                  {/* Poz Name */}
                  <div className="flex-1 min-w-[110px]">
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
                    {u.isSplit && (
                      <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono text-[9px] font-bold">
                        ⚡ {u.splitDirection === 'vertical' ? (lang === 'tr' ? 'Düşey Kayıt' : 'Mullion') : (lang === 'tr' ? 'Yatay Kayıt / Transom' : 'Transom')}
                      </span>
                    )}
                  </div>

                  {/* Width (mm) */}
                  <div className="w-full lg:w-24">
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
                  <div className="w-full lg:w-24">
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
                  <div className="flex-1 min-w-[130px]">
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

                  {/* Opening Type / Panes */}
                  <div className="flex-1 min-w-[200px]">
                    <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block mb-1">
                      ⚡ {u.isSplit ? (lang === 'tr' ? 'Bölme Açılımları' : 'Pane Openings') : (lang === 'tr' ? 'Açılım Tipi' : 'Opening Type')}
                    </span>
                    {u.isSplit && u.rootNode && u.rootNode.children && u.rootNode.children.length >= 2 ? (
                      <div className="flex flex-col gap-1.5">
                        {u.rootNode.children.map((child, childIdx) => {
                          const paneLabel = childIdx === 0 
                            ? (u.splitDirection === 'vertical' ? (lang === 'tr' ? 'Sol Göz' : 'Left') : (lang === 'tr' ? 'Üst Göz' : 'Top'))
                            : (u.splitDirection === 'vertical' ? (lang === 'tr' ? 'Sağ Göz' : 'Right') : (lang === 'tr' ? 'Alt Göz' : 'Bottom'));
                          const paneDim = u.panes && u.panes[childIdx]?.dimension ? ` (${u.panes[childIdx].dimension}mm)` : '';

                          return (
                            <div key={child.id || childIdx} className="flex items-center gap-1.5">
                              <span className="text-[10px] text-slate-400 w-16 truncate shrink-0">{paneLabel}{paneDim}:</span>
                              <select
                                value={child.openingType || 'fixed'}
                                onChange={e => {
                                  const updated = [...scannedReviewUnits];
                                  const target = { ...updated[idx] };
                                  if (target.rootNode && target.rootNode.children) {
                                    const newChildren = [...target.rootNode.children];
                                    newChildren[childIdx] = {
                                      ...newChildren[childIdx],
                                      openingType: e.target.value as any
                                    };
                                    target.rootNode = {
                                      ...target.rootNode,
                                      children: newChildren
                                    };
                                  }
                                  if (target.panes && target.panes[childIdx]) {
                                    const newPanes = [...target.panes];
                                    newPanes[childIdx] = {
                                      ...newPanes[childIdx],
                                      openingType: e.target.value
                                    };
                                    target.panes = newPanes;
                                  }
                                  updated[idx] = target;
                                  setScannedReviewUnits(updated);
                                }}
                                disabled={!u.selected}
                                className="w-full bg-slate-950 border border-indigo-500/30 font-medium rounded-lg px-2 py-1 text-[11px] text-indigo-300 outline-none focus:border-indigo-500 disabled:opacity-50 cursor-pointer"
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
                          );
                        })}
                      </div>
                    ) : (
                      <select 
                        value={u.type} 
                        onChange={e => {
                          const updated = [...scannedReviewUnits];
                          const newType = e.target.value as any;
                          updated[idx].type = newType;
                          updated[idx].rootNode = {
                            id: updated[idx].rootNode?.id || uuidv4(),
                            type: 'glass',
                            openingType: newType
                          };
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
                    )}
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
                    const sys = getSystemForUnit(unit, systems);
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

      {showAddShadingModal && (
        <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-3xl shadow-2xl relative my-8 animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="border-b border-white/5 p-6 flex justify-between items-center">
              <div>
                <h3 className="text-base font-black text-white uppercase tracking-tight flex items-center gap-2">
                  <Box className="text-indigo-400" size={18} />
                  <span>
                    {editingShadingItem 
                      ? (lang === 'tr' ? 'GÖLGELENDİRME SİSTEMİNİ DÜZENLE' : 'EDIT SHADING SYSTEM') 
                      : (lang === 'tr' ? 'YENİ GÖLGELENDİRME SİSTEMİ EKLE' : 'ADD NEW SHADING SYSTEM')}
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-1">
                  {lang === 'tr' 
                    ? 'Projenize eklemek istediğiniz gölgelendirme elemanının üretim parametrelerini girin.' 
                    : 'Configure properties and profiles for custom glass balconies, zip blinds or pergolas.'}
                </p>
              </div>
              <button 
                onClick={() => {
                  setShowAddShadingModal(false);
                  setEditingShadingItem(null);
                }}
                className="text-slate-400 hover:text-white hover:bg-white/5 w-8 h-8 rounded-full flex items-center justify-center transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto scrollbar-thin">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                 {/* Product Type */}
                 <div className="space-y-1.5">
                   <div className="flex justify-between items-center">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                       {lang === 'tr' ? 'Ürün Tipi / Kategori' : 'Product Type / Category'}
                     </label>
                     <button
                       type="button"
                       onClick={() => {
                           const nameTr = prompt(lang === 'tr' ? 'Yeni Sistem Tipi İsmi Girin (örn: Kış Bahçesi):' : 'Enter New System Type Name (e.g. Winter Garden):');
                           if (nameTr && nameTr.trim()) {
                               const nameEn = prompt(lang === 'tr' ? 'İngilizce İsmi Girin (İsteğe Bağlı):' : 'Enter English Name (Optional):') || nameTr;
                               const imageUrl = prompt(lang === 'tr' ? 'Ürün Tipi için Varsayılan Görsel Linki / URL (İsteğe Bağlı):' : 'Enter Default Image URL for Product Type (Optional):') || '';
                               handleAddCustomProductType(nameTr, nameEn, imageUrl);
                           }
                       }}
                       className="text-[9px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-0.5"
                       title={lang === 'tr' ? 'Yeni Ürün Tipi Ekle' : 'Add New Product Type'}
                     >
                       <span>➕ {lang === 'tr' ? 'Yeni Ekle' : 'Add New'}</span>
                     </button>
                   </div>
                   <select
                     value={shadingFormProduct}
                     onChange={(e: any) => {
                       const type = e.target.value;
                       if (type === 'ADD_NEW_PRODUCT_TYPE') {
                         const nameTr = prompt(lang === 'tr' ? 'Yeni Sistem Tipi İsmi Girin (örn: Kış Bahçesi):' : 'Enter New System Type Name (e.g. Winter Garden):');
                         if (nameTr && nameTr.trim()) {
                             const nameEn = prompt(lang === 'tr' ? 'İngilizce İsmi Girin (İsteğe Bağlı):' : 'Enter English Name (Optional):') || nameTr;
                             const imageUrl = prompt(lang === 'tr' ? 'Ürün Tipi için Varsayılan Görsel Linki / URL (İsteğe Bağlı):' : 'Enter Default Image URL for Product Type (Optional):') || '';
                             handleAddCustomProductType(nameTr, nameEn, imageUrl);
                         } else {
                             setShadingFormProduct(shadingFormProduct || 'bioclimatic-pergola');
                         }
                         return;
                       }
                       setShadingFormProduct(type);
                       // Set corresponding default human-readable names and images
                       const found = productTypes.find(t => t.id === type);
                       if (found) {
                         setShadingFormName(lang === 'tr' ? found.nameTr : found.nameEn);
                         if (found.imageUrl) {
                           setShadingFormImageUrl(found.imageUrl);
                         }
                       }
                     }}
                     className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-indigo-500 transition-colors"
                   >
                     {productTypes.map(pt => (
                       <option key={pt.id} value={pt.id}>
                         {lang === 'tr' ? pt.nameTr : pt.nameEn}
                       </option>
                     ))}
                     <option value="ADD_NEW_PRODUCT_TYPE" className="text-indigo-400 font-bold bg-slate-900">
                       {lang === 'tr' ? '➕ Yeni Ürün Tipi Ekle...' : '➕ Add New Product Type...'}
                     </option>
                   </select>
                 </div>

                {/* System Name */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                    {lang === 'tr' ? 'Sistem Başlığı / Açıklama' : 'System Label / Title'}
                  </label>
                  <input
                    type="text"
                    value={shadingFormName}
                    onChange={(e) => setShadingFormName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-indigo-500 transition-colors"
                    placeholder="örn: Bahçe Üstü Bioklimatik"
                  />
                </div>

                {/* Width (mm) */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                    {lang === 'tr' ? 'Genişlik (X Eni - mm)' : 'Width (X - mm)'}
                  </label>
                  <input
                    type="number"
                    value={shadingFormWidth}
                    onChange={(e) => setShadingFormWidth(parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-indigo-500 transition-colors font-mono"
                  />
                </div>

                {/* Height (Y Boyu - mm) */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                    {lang === 'tr' ? 'Genel Yükseklik (Y Boyu - mm)' : 'General Height (Y - mm)'}
                  </label>
                  <input
                    type="number"
                    value={shadingFormHeight}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      setShadingFormHeight(val);
                      setShadingFormFrontHeight(val);
                      setShadingFormBackHeight(val);
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-indigo-500 transition-colors font-mono"
                  />
                </div>

                {/* Front Height (mm) */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                    {lang === 'tr' ? 'Ön Yükseklik (mm)' : 'Front Height (mm)'}
                  </label>
                  <input
                    type="number"
                    value={shadingFormFrontHeight}
                    onChange={(e) => setShadingFormFrontHeight(parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-indigo-500 transition-colors font-mono"
                  />
                </div>

                {/* Back Height (mm) */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                    {lang === 'tr' ? 'Arka Yükseklik (mm)' : 'Back Height (mm)'}
                  </label>
                  <input
                    type="number"
                    value={shadingFormBackHeight}
                    onChange={(e) => setShadingFormBackHeight(parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-indigo-500 transition-colors font-mono"
                  />
                </div>

                {/* Projection/Depth (mm) */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                    {lang === 'tr' ? 'Açılım / Derinlik (Z - mm)' : 'Projection / Depth (Z - mm)'}
                  </label>
                  <input
                    type="number"
                    value={shadingFormDepth}
                    onChange={(e) => setShadingFormDepth(parseInt(e.target.value) || 0)}
                    disabled={shadingFormProduct === 'zip-blind' || shadingFormProduct === 'glass-balcony' || shadingFormProduct === 'guillotine'}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-indigo-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed font-mono"
                  />
                </div>

                {/* Profile Color RAL */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                    {lang === 'tr' ? 'Profil / Kumaş Rengi (RAL)' : 'Profile / Fabric Color (RAL)'}
                  </label>
                  <input
                    type="text"
                    value={shadingFormColor}
                    onChange={(e) => setShadingFormColor(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-indigo-500 transition-colors"
                    placeholder="örn: RAL 7016 Antrasit"
                  />
                </div>

                {/* Unit Price */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                    {lang === 'tr' ? 'Sistem Satış Fiyatı' : 'System Sales Price'}
                  </label>
                  <input
                    type="number"
                    value={shadingFormPrice}
                    onChange={(e) => setShadingFormPrice(parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-indigo-500 transition-colors font-mono"
                  />
                </div>

                {/* Quantity */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                    {lang === 'tr' ? 'Adet' : 'Quantity'}
                  </label>
                  <input
                    type="number"
                    value={shadingFormQty}
                    onChange={(e) => setShadingFormQty(parseInt(e.target.value) || 1)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-indigo-500 transition-colors font-mono"
                  />
                </div>
              </div>

              {/* Product Image URL */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                    {lang === 'tr' ? 'VizyonPergola Ürün Görseli (URL veya Seçim)' : 'Product Image (URL or Selection)'}
                  </label>
                  <span className="text-[8px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded uppercase">
                    {lang === 'tr' ? 'Özel Görsel' : 'Custom Render'}
                  </span>
                </div>
                <input
                  type="text"
                  value={shadingFormImageUrl}
                  onChange={(e) => {
                    const val = e.target.value;
                    setShadingFormImageUrl(val);
                    handleUpdateProductTypeImage(shadingFormProduct, val);
                  }}
                  placeholder={
                    lang === 'tr'
                      ? "VizyonPergola veya internet üzerindeki ürün resmi linkini yapıştırın..."
                      : "Paste a product image URL from VizyonPergola or anywhere on the web..."
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-indigo-500 transition-colors font-mono"
                />
                
                {/* Visual Preset selection chips */}
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      const url = 'https://images.unsplash.com/photo-1615874959474-d609969a20ed?w=600&auto=format&fit=crop';
                      setShadingFormImageUrl(url);
                      handleUpdateProductTypeImage(shadingFormProduct, url);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${shadingFormImageUrl.includes('photo-1615874959474') ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'}`}
                  >
                    🏡 {lang === 'tr' ? 'Lüks Pergole Görseli' : 'Luxury Pergola'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const url = 'https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=600&auto=format&fit=crop';
                      setShadingFormImageUrl(url);
                      handleUpdateProductTypeImage(shadingFormProduct, url);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${shadingFormImageUrl.includes('photo-1505691938895') ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'}`}
                  >
                    ⛅ {lang === 'tr' ? 'Modern Zip Perde' : 'Modern Zip Blind'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const url = 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&auto=format&fit=crop';
                      setShadingFormImageUrl(url);
                      handleUpdateProductTypeImage(shadingFormProduct, url);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${shadingFormImageUrl.includes('photo-1600585154340') ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'}`}
                  >
                    🪟 {lang === 'tr' ? 'Cam Balkon / Giyotin' : 'Glass Balcony'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const url = 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=600&auto=format&fit=crop';
                      setShadingFormImageUrl(url);
                      handleUpdateProductTypeImage(shadingFormProduct, url);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${shadingFormImageUrl.includes('photo-1513694203232') ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'}`}
                  >
                    ⛱️ {lang === 'tr' ? 'Mafsallı Klasik Tente' : 'Retractable Awning'}
                  </button>
                  {shadingFormImageUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setShadingFormImageUrl('');
                        handleUpdateProductTypeImage(shadingFormProduct, '');
                      }}
                      className="px-3 py-1.5 rounded-lg text-[10px] font-bold border bg-red-950/20 border-red-900/30 text-red-400 hover:bg-red-900/40 transition-all"
                    >
                      ✕ {lang === 'tr' ? 'Görseli Temizle' : 'Clear'}
                    </button>
                  )}
                </div>
              </div>

              {/* Catalog Sections (Plan and Vertical) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-950/50 p-4 rounded-2xl border border-white/5">
                {/* Plan Kesiti */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                    {lang === 'tr' ? 'Katalog Plan Kesiti' : 'Catalog Plan Section'}
                  </label>
                  
                  <div className="aspect-[4/1.3] bg-slate-950 rounded-xl border-2 border-dashed border-white/10 hover:border-indigo-500/50 flex flex-col items-center justify-center p-2 text-center cursor-pointer transition-all hover:bg-indigo-500/5 group text-slate-500 relative overflow-hidden min-h-[85px]">
                    {shadingFormPlanSectionUrl ? (
                      <>
                        <img src={shadingFormPlanSectionUrl} alt="Plan Kesit" className="w-full h-full object-contain p-1" />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); document.getElementById('shading-plan-file')?.click(); }}
                            className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[9px] font-bold transition-all shadow-lg"
                          >
                            {lang === 'tr' ? 'Değiştir' : 'Change'}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setShadingFormPlanSectionUrl(''); }}
                            className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white rounded-lg text-[9px] font-bold transition-all shadow-lg"
                          >
                            {lang === 'tr' ? 'Kaldır' : 'Remove'}
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center" onClick={() => document.getElementById('shading-plan-file')?.click()}>
                        <Upload size={14} className="text-slate-500 group-hover:text-indigo-400 transition-colors mb-1" />
                        <span className="text-[9px] font-bold text-slate-400">
                          {lang === 'tr' ? 'Plan Kesiti Yükle' : 'Upload Plan Section'}
                        </span>
                        <span className="text-[8px] text-slate-600">
                          {lang === 'tr' ? 'Görsel Seçin veya Sürükleyin' : 'Select or Drag Image'}
                        </span>
                      </div>
                    )}
                    <input
                      id="shading-plan-file"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          try {
                            const res = await compressImageIfNeeded(file);
                            setShadingFormPlanSectionUrl(res.base64);
                          } catch (err) {
                            console.error(err);
                          }
                        }
                      }}
                    />
                  </div>
                  
                  {/* Fallback URL input */}
                  <input
                    type="text"
                    value={shadingFormPlanSectionUrl}
                    onChange={(e) => setShadingFormPlanSectionUrl(e.target.value)}
                    placeholder={
                      lang === 'tr'
                        ? "Veya resim web linkini (URL) buraya yapıştırın..."
                        : "Or paste image web link (URL) here..."
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-[10px] text-slate-400 outline-none focus:border-indigo-500 transition-colors font-mono"
                  />
                  <input
                    type="text"
                    value={shadingFormPlanSectionProfileCode}
                    onChange={(e) => setShadingFormPlanSectionProfileCode(e.target.value)}
                    placeholder={lang === 'tr' ? "Plan Kesiti Profil Kodu (örn: P-101)" : "Plan Section Profile Code (e.g.: P-101)"}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-[10px] text-white outline-none focus:border-indigo-500 transition-colors font-mono mt-1.5"
                  />
                  <p className="text-[9px] text-slate-500 leading-tight">
                    {lang === 'tr' ? 'Teklif çıktısında resmin hemen altında gösterilir.' : 'Shown directly below the main image in quote output.'}
                  </p>
                </div>

                {/* Boy Kesiti */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                    {lang === 'tr' ? 'Katalog Boy Kesiti / Detayı' : 'Catalog Cross Section / Detail'}
                  </label>
                  
                  <div className="aspect-[4/1.3] bg-slate-950 rounded-xl border-2 border-dashed border-white/10 hover:border-indigo-500/50 flex flex-col items-center justify-center p-2 text-center cursor-pointer transition-all hover:bg-indigo-500/5 group text-slate-500 relative overflow-hidden min-h-[85px]">
                    {shadingFormCrossSectionUrl ? (
                      <>
                        <img src={shadingFormCrossSectionUrl} alt="Boy Kesit" className="w-full h-full object-contain p-1" />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); document.getElementById('shading-cross-file')?.click(); }}
                            className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[9px] font-bold transition-all shadow-lg"
                          >
                            {lang === 'tr' ? 'Değiştir' : 'Change'}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setShadingFormCrossSectionUrl(''); }}
                            className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white rounded-lg text-[9px] font-bold transition-all shadow-lg"
                          >
                            {lang === 'tr' ? 'Kaldır' : 'Remove'}
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center" onClick={() => document.getElementById('shading-cross-file')?.click()}>
                        <Upload size={14} className="text-slate-500 group-hover:text-indigo-400 transition-colors mb-1" />
                        <span className="text-[9px] font-bold text-slate-400">
                          {lang === 'tr' ? 'Boy Kesiti Yükle' : 'Upload Cross Section'}
                        </span>
                        <span className="text-[8px] text-slate-600">
                          {lang === 'tr' ? 'Görsel Seçin veya Sürükleyin' : 'Select or Drag Image'}
                        </span>
                      </div>
                    )}
                    <input
                      id="shading-cross-file"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          try {
                            const res = await compressImageIfNeeded(file);
                            setShadingFormCrossSectionUrl(res.base64);
                          } catch (err) {
                            console.error(err);
                          }
                        }
                      }}
                    />
                  </div>
                  
                  {/* Fallback URL input */}
                  <input
                    type="text"
                    value={shadingFormCrossSectionUrl}
                    onChange={(e) => setShadingFormCrossSectionUrl(e.target.value)}
                    placeholder={
                      lang === 'tr'
                        ? "Veya resim web linkini (URL) buraya yapıştırın..."
                        : "Or paste image web link (URL) here..."
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-[10px] text-slate-400 outline-none focus:border-indigo-500 transition-colors font-mono"
                  />
                  <input
                    type="text"
                    value={shadingFormCrossSectionProfileCode}
                    onChange={(e) => setShadingFormCrossSectionProfileCode(e.target.value)}
                    placeholder={lang === 'tr' ? "Boy Kesiti Profil Kodu (örn: B-201)" : "Cross Section Profile Code (e.g.: B-201)"}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-[10px] text-white outline-none focus:border-indigo-500 transition-colors font-mono mt-1.5"
                  />
                  <p className="text-[9px] text-slate-500 leading-tight">
                    {lang === 'tr' ? 'Teklif çıktısında resmin sağında gösterilir.' : 'Shown to the right of the main image in quote output.'}
                  </p>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                  {lang === 'tr' ? 'Özel İstek / Teknik Notlar' : 'Custom Specifications / Notes'}
                </label>
                <textarea
                  value={shadingFormNotes}
                  onChange={(e) => setShadingFormNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-indigo-500 transition-colors h-20 resize-none"
                  placeholder={lang === 'tr' ? 'Siparişe özel notlar buraya...' : 'Write any bespoke fabrication specifications here...'}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-white/5 p-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowAddShadingModal(false);
                  setEditingShadingItem(null);
                }}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-5 py-2.5 rounded-xl text-xs font-bold transition-all"
              >
                {lang === 'tr' ? 'Vazgeç' : 'Cancel'}
              </button>
              <button
                onClick={handleSaveShadingItem}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-indigo-500/20 transition-all"
              >
                {lang === 'tr' ? 'Sistemi Kaydet' : 'Save System'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAiReportModal && aiShadingReport && (
        <div className="fixed inset-0 z-[105] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-3xl rounded-3xl shadow-2xl relative my-8 animate-in zoom-in-95 duration-200">
            {/* Top Bar Banner with Sparkles gradient */}
            <div className="bg-gradient-to-r from-indigo-900/60 via-purple-900/40 to-slate-900 p-6 rounded-t-3xl border-b border-white/5 flex justify-between items-start">
              <div className="space-y-1">
                <span className="text-[9px] bg-gradient-to-r from-amber-400 to-indigo-400 text-transparent bg-clip-text font-black uppercase tracking-widest block">
                  ALUMETRIC CORE COGNITIVE MOTOR
                </span>
                <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                  <Sparkles className="text-amber-400 animate-pulse" size={20} />
                  <span>{lang === 'tr' ? 'Yapay Zeka Cephe Tasarım Raporu' : 'AI Architectural & Facade Report'}</span>
                </h3>
                <p className="text-[11px] text-slate-300">
                  {lang === 'tr' 
                    ? 'Yüklenen görsel yapay zeka tarafından taranarak cepheye en uyumlu gölgelendirme çözümleri hesaplandı.' 
                    : 'The uploaded architectural facade has been parsed. Below are matches calibrated for your building.'}
                </p>
              </div>
              <button 
                onClick={() => setShowAiReportModal(false)}
                className="text-slate-400 hover:text-white bg-slate-950/50 hover:bg-slate-950 w-8 h-8 rounded-full flex items-center justify-center transition-colors border border-white/5"
              >
                ✕
              </button>
            </div>

              {/* Content */}
              <div className="p-6 space-y-6 max-h-[68vh] overflow-y-auto scrollbar-thin">
                {/* 1. Architectural Review Analysis card */}
                <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5 space-y-2.5">
                  <h4 className="text-xs font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                    <Layers size={13} />
                    <span>{lang === 'tr' ? 'MİMARİ CEPHE DEĞERLENDİRMESİ' : 'ARCHITECTURAL FACADE EVALUATION'}</span>
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed font-medium">
                    {aiShadingReport.architecturalReview}
                  </p>
                </div>
  
                {/* 2. Proposed systems list with direct mounting actions! */}
                <div className="space-y-3.5">
                  <h4 className="text-xs font-black text-amber-400 uppercase tracking-widest flex items-center gap-2">
                    <Wrench size={13} />
                    <span>{lang === 'tr' ? 'ÖNERİLEN DIŞ MEKAN SİSTEMLERİ' : 'AI CUSTOM RECOMMENDED SYSTEMS'}</span>
                  </h4>
  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {aiShadingReport.recommendations.map((sys, idx) => {
                      return (
                        <div 
                          key={idx}
                          className="bg-slate-950 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between hover:border-indigo-500/40 transition-colors group"
                        >
                          <div className="space-y-2">
                            <div className="flex justify-between items-start">
                              <span className="text-[10px] font-black uppercase text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-md">
                                {sys.productType === 'bioclimatic-pergola' ? (lang === 'tr' ? 'BİOKLİMATİK' : 'BIOCLIMATIC') : sys.productType.toUpperCase()}
                              </span>
                              <span className="text-xs font-bold text-white font-mono">
                                {currencySymbol}{sys.estimatedSqmPrice.toLocaleString()}
                              </span>
                            </div>
                            <div>
                              <h5 className="text-xs font-black text-white group-hover:text-indigo-400 transition-colors uppercase tracking-tight">
                                {sys.name}
                              </h5>
                              <p className="text-[11px] text-slate-400 mt-1">
                                {lang === 'tr' ? 'Uyumlu Boyut:' : 'Fit Size:'} <b className="text-slate-300">{sys.suggestedWidth} x {sys.suggestedHeight} mm</b>
                              </p>
                              <p className="text-[10px] text-slate-500 mt-0.5">
                                {lang === 'tr' ? 'Renk:' : 'Color Spec:'} <b className="text-slate-400">{sys.suggestedColor}</b>
                              </p>
                            </div>
                            <p className="text-[11px] text-slate-400 italic leading-relaxed pt-1 border-t border-white/5">
                              {sys.explanation}
                            </p>
                          </div>
  
                          {/* Interactive direct mounting trigger */}
                          <button
                            onClick={() => {
                              // Mount recommended system onto canvas
                              const newId = `shading-${Date.now()}`;
                              const created: ShadingItem = {
                                id: newId,
                                productType: sys.productType as any,
                                name: sys.name,
                                width: sys.suggestedWidth,
                                height: sys.suggestedHeight,
                                depth: sys.productType === 'zip-blind' ? 0 : (sys.suggestedDepth || 3000),
                                frontHeight: sys.suggestedHeight,
                                backHeight: sys.suggestedHeight,
                                quantity: 1,
                                unitPrice: sys.estimatedSqmPrice,
                                color: sys.suggestedColor,
                                notes: sys.explanation,
                                overlayX: 50,
                                overlayY: 60,
                                overlayScale: 120,
                                overlayRotate: 0,
                              };
                              handleAddShadingItem(created);
                              setSelectedShadingItemId(newId);
                              setShowAiReportModal(false);
                            }}
                            className="mt-4 w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-md group-hover:scale-[1.02]"
                          >
                            <Wand2 size={11} className="animate-bounce" />
                            <span>{lang === 'tr' ? 'TEKLİFE EKLE VE MONTE ET' : 'ADD TO PROPOSAL & MOUNT'}</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
  
                {/* 3. Sales copy consultant pitch card */}
                <div className="bg-gradient-to-r from-slate-950 to-indigo-950/40 border border-slate-800 rounded-2xl p-5 space-y-2">
                  <h4 className="text-xs font-black text-purple-400 uppercase tracking-widest flex items-center gap-2">
                    <FileCheck size={13} />
                    <span>{lang === 'tr' ? 'MÜŞTERİ SATIŞ SUNUM KOPYASI' : 'CLIENT ELEVATOR & SALES PITCH'}</span>
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed italic font-medium">
                    "{aiShadingReport.salesPitch}"
                  </p>
                </div>
              </div>

            {/* Footer */}
            <div className="border-t border-white/5 p-6 flex justify-end">
              <button
                onClick={() => setShowAiReportModal(false)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-500/20"
              >
                {lang === 'tr' ? 'Anladım, Kapat' : 'Dismiss & Apply'}
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

      {/* GLOBAL NOTIFICATION TOAST (IFRAME COMPATIBLE) */}
      {globalToast && (
        <div className="fixed bottom-6 right-6 z-[200] max-w-sm w-full bg-slate-900/95 backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-2xl flex items-start gap-3 animate-in slide-in-from-bottom duration-300">
          <div className={`p-2 rounded-xl text-white ${
            globalToast.type === 'success' ? 'bg-emerald-600/30 text-emerald-400 border border-emerald-500/20' :
            globalToast.type === 'error' ? 'bg-rose-600/30 text-rose-400 border border-rose-500/20' :
            globalToast.type === 'warning' ? 'bg-amber-600/30 text-amber-400 border border-amber-500/20' :
            'bg-indigo-600/30 text-indigo-400 border border-indigo-500/20'
          }`}>
            {globalToast.type === 'success' && <FileCheck size={18} />}
            {globalToast.type === 'error' && <AlertCircle size={18} />}
            {globalToast.type === 'warning' && <AlertCircle size={18} />}
            {globalToast.type === 'info' && <Layers size={18} />}
          </div>
          <div className="flex-1 space-y-0.5 text-left">
            <h5 className="text-[10px] font-black uppercase tracking-wider text-white">
              {globalToast.type === 'success' ? (lang === 'tr' ? 'BAŞARILI' : 'SUCCESS') :
               globalToast.type === 'error' ? (lang === 'tr' ? 'HATA' : 'ERROR') :
               globalToast.type === 'warning' ? (lang === 'tr' ? 'UYARI' : 'WARNING') :
               (lang === 'tr' ? 'BİLGİ' : 'INFORMATION')}
            </h5>
            <p className="text-[11px] text-slate-300 font-medium leading-relaxed">
              {globalToast.message}
            </p>
          </div>
          <button 
            onClick={() => setGlobalToast(null)}
            className="text-slate-500 hover:text-white transition-colors text-[10px] font-bold p-1"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};

export default ProjectView;
