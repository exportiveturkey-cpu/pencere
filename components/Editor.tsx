
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Unit, WindowNode, ProfileSystem, Language, Accessory, SplitDirection, UnitShape } from '../types';
import Visualizer from './Visualizer';
import ThreeDPreview from './ThreeDPreview';
import CrossSection from './CrossSection';
import { INITIAL_ROOT_NODE, GLASS_TYPES, COLOR_GROUPS } from '../constants';
import { v4 as uuidv4 } from 'uuid';
import { ArrowLeft, Save, SplitSquareHorizontal, SplitSquareVertical, Trash2, Layout, Settings2, Ruler, MousePointer2, Undo2, ChevronUp, Wrench, Box, Square, Triangle, Circle, BoxSelect, Monitor, ZoomIn, ZoomOut, Maximize, Layers } from 'lucide-react';
import { t } from '../translations';
import { extractGlassPanes } from '../services/optimizationService';

interface EditorProps {
  unit?: Unit;
  systems: ProfileSystem[];
  accessories?: Accessory[];
  lang: Language;
  onSave: (unit: Unit) => void;
  onCancel: () => void;
}

const Editor: React.FC<EditorProps> = ({ unit: initialUnit, systems, accessories = [], lang, onSave, onCancel }) => {
  const [name, setName] = useState(initialUnit?.name || t(lang, 'newPosition'));
  const [width, setWidth] = useState(initialUnit?.width || 1200);
  const [height, setHeight] = useState(initialUnit?.height || 1500);
  const [quantity, setQuantity] = useState(initialUnit?.quantity || 1);
  const [shape, setShape] = useState<UnitShape>(initialUnit?.shape || 'rect');
  const [archHeight, setArchHeight] = useState(initialUnit?.archHeight || 400);
  const [systemId, setSystemId] = useState(initialUnit?.system || systems[0].id);
  const [color, setColor] = useState(initialUnit?.color || 'group1');
  const [glassTypeId, setGlassTypeId] = useState(initialUnit?.glassType || GLASS_TYPES[0].id);
  const [rootNode, setRootNode] = useState<WindowNode>(initialUnit?.rootNode || { ...INITIAL_ROOT_NODE, id: uuidv4() });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hasThreshold, setHasThreshold] = useState<boolean>(initialUnit?.hasThreshold || false);
  const [includeGlass, setIncludeGlass] = useState<boolean>(initialUnit?.includeGlass !== false);
  const [customGlassPriceInput, setCustomGlassPriceInput] = useState<string>(
    initialUnit?.customGlassPrice !== undefined ? initialUnit.customGlassPrice.toString() : ''
  );
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');
  const [showSection, setShowSection] = useState(false);
  
  const [visualScale, setVisualScale] = useState(0.20);
  const [history, setHistory] = useState<WindowNode[]>([]);
  const [inputVal1, setInputVal1] = useState<string>('');
  const [inputVal2, setInputVal2] = useState<string>('');

  const [selectedHandle, setSelectedHandle] = useState(initialUnit?.selectedHandle || '');
  const [selectedHinge, setSelectedHinge] = useState(initialUnit?.selectedHinge || '');
  const [selectedGasket, setSelectedGasket] = useState(initialUnit?.selectedGasket || '');
  const [selectedLock, setSelectedLock] = useState(initialUnit?.selectedLock || '');
  const [selectedCorner, setSelectedCorner] = useState(initialUnit?.selectedCorner || '');
  const [selectedAutomation, setSelectedAutomation] = useState(initialUnit?.selectedAutomation || '');
  const [selectedKickplate, setSelectedKickplate] = useState(initialUnit?.selectedKickplate || '');
  const [selectedDoorCloser, setSelectedDoorCloser] = useState(initialUnit?.selectedDoorCloser || '');
  const [selectedLockStriker, setSelectedLockStriker] = useState(initialUnit?.selectedLockStriker || '');
  const [selectedOther, setSelectedOther] = useState(initialUnit?.selectedOther || '');

  useEffect(() => {
    const maxDim = Math.max(width, height);
    if (maxDim > 3000) setVisualScale(0.12);
    else if (maxDim > 2000) setVisualScale(0.18);
  }, []);

  useEffect(() => {
    const system = systems.find(s => s.id === systemId);
    if (!system) return;

    const validateNodes = (node: WindowNode): WindowNode => {
      let updated = { ...node };
      if (node.children) {
        updated.children = node.children.map(validateNodes);
      }
      return updated;
    };
    
    setRootNode(prev => validateNodes(prev));

    const checkAcc = (id: string) => {
      if (!id) return '';
      const acc = accessories.find(a => a.id === id);
      if (acc && acc.compatibility && acc.compatibility !== 'both' && acc.compatibility !== system.type) {
        return '';
      }
      return id;
    };

    setSelectedHandle(prev => checkAcc(prev));
    setSelectedHinge(prev => checkAcc(prev));
    setSelectedGasket(prev => checkAcc(prev));
    setSelectedLock(prev => checkAcc(prev));
    setSelectedCorner(prev => checkAcc(prev));
    setSelectedAutomation(prev => checkAcc(prev));
    setSelectedKickplate(prev => checkAcc(prev));
    setSelectedDoorCloser(prev => checkAcc(prev));
    setSelectedLockStriker(prev => checkAcc(prev));
    setSelectedOther(prev => checkAcc(prev));
  }, [systemId, systems, accessories]);

  const selectedSystem = systems.find(s => s.id === systemId) || systems[0];

  // Dynamically calculate unit glass weight!
  const currentUnitDummy: Unit = useMemo(() => ({
    id: initialUnit?.id || 'temp-unit',
    name,
    width: Number(width) || 0,
    height: Number(height) || 0,
    system: systemId,
    color,
    glassType: glassTypeId,
    glassThickness: 24,
    rootNode,
    quantity: 1,
    shape,
    archHeight,
    hasThreshold,
  }), [initialUnit?.id, name, width, height, systemId, color, glassTypeId, rootNode, shape, archHeight, hasThreshold]);

  // Try to calculate weights and recommended accessories
  const { totalGlassWeight, recommendedHinge, recommendedRoller } = useMemo(() => {
    let totalGlassWeight = 0;
    try {
      const glassPanesList = extractGlassPanes(currentUnitDummy, selectedSystem);
      totalGlassWeight = glassPanesList.reduce((acc, p) => acc + (p.weight || 0), 0);
    } catch (err) {
      console.error("Error calculating glass panes:", err);
    }

    // Recommended Hinge
    let recommendedHinge: Accessory | null = null;
    if (selectedSystem.type === 'hinged') {
      const compatibleHinges = accessories.filter(a => a.type === 'hinge' && (a.compatibility === 'both' || a.compatibility === 'hinged' || !a.compatibility));
      if (compatibleHinges.length > 0) {
        const sorted = [...compatibleHinges].sort((a, b) => (a.maxWeightKg || 999) - (b.maxWeightKg || 999));
        const found = sorted.find(h => (h.maxWeightKg || 999) >= totalGlassWeight);
        recommendedHinge = found || sorted[sorted.length - 1]; // highest as fallback
      }
    }

    // Recommended Roller
    let recommendedRoller: Accessory | null = null;
    if (selectedSystem.type === 'sliding') {
      const compatibleRollers = accessories.filter(a => a.type === 'other' && (a.compatibility === 'both' || a.compatibility === 'sliding' || !a.compatibility));
      if (compatibleRollers.length > 0) {
        const sorted = [...compatibleRollers].sort((a, b) => (a.maxWeightKg || 999) - (b.maxWeightKg || 999));
        const found = sorted.find(h => (h.maxWeightKg || 999) >= totalGlassWeight);
        recommendedRoller = found || sorted[sorted.length - 1]; // highest as fallback
      }
    }

    return { totalGlassWeight, recommendedHinge, recommendedRoller };
  }, [currentUnitDummy, selectedSystem, accessories]);

  // Auto-select hinges/rollers on weight changes
  useEffect(() => {
    if (selectedSystem.type === 'hinged' && recommendedHinge) {
      setSelectedHinge(recommendedHinge.id);
    } else if (selectedSystem.type === 'sliding' && recommendedRoller) {
      setSelectedOther(recommendedRoller.id);
    }
  }, [totalGlassWeight, selectedSystem.type, recommendedHinge?.id, recommendedRoller?.id]);

  const handleUpdateRootNode = useCallback((newNode: WindowNode) => {
    setHistory(prev => [...prev, rootNode]);
    setRootNode(newNode);
  }, [rootNode]);

  const handleUndo = () => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));
    setRootNode(previous);
    setSelectedNodeId(null);
  };

  const findAndUpdateNode = (node: WindowNode, targetId: string, updateFn: (node: WindowNode) => WindowNode): WindowNode => {
    if (node.id === targetId) return updateFn(node);
    if (node.children) {
      return { ...node, children: node.children.map(child => findAndUpdateNode(child, targetId, updateFn)) };
    }
    return node;
  };

  const handleSplit = (direction: SplitDirection) => {
    if (!selectedNodeId) return;
    handleUpdateRootNode(findAndUpdateNode(rootNode, selectedNodeId, (node) => ({
      ...node,
      type: 'container',
      direction,
      splitRatio: [0.5, 0.5],
      openingType: 'fixed',
      children: [
        { id: uuidv4(), type: 'glass', openingType: 'fixed' },
        { id: uuidv4(), type: 'glass', openingType: 'fixed' }
      ]
    })));
    setSelectedNodeId(null);
  };

  const handleSetOpening = (type: string) => {
    if (!selectedNodeId) return;
    handleUpdateRootNode(findAndUpdateNode(rootNode, selectedNodeId, (node) => ({
      ...node,
      type: 'glass',
      openingType: type as any
    })));
  };

  const handleUpdateSplitRatio = (ratio0: number) => {
    if (!selectedNodeId) return;
    const ratio1 = 1 - ratio0;
    handleUpdateRootNode(findAndUpdateNode(rootNode, selectedNodeId, (node) => ({
      ...node,
      splitRatio: [ratio0, ratio1]
    })));
  };

  const findNode = (node: WindowNode, id: string): WindowNode | null => {
    if (node.id === id) return node;
    if (node.children) {
      for (const child of node.children) {
        const found = findNode(child, id);
        if (found) return found;
      }
    }
    return null;
  };

  const findParentId = (node: WindowNode, targetId: string): string | null => {
    if (!node.children) return null;
    if (node.children.some(c => c.id === targetId)) return node.id;
    for (const child of node.children) {
      const found = findParentId(child, targetId);
      if (found) return found;
    }
    return null;
  };

  const selectedNode = selectedNodeId ? findNode(rootNode, selectedNodeId) : null;
  const parentId = selectedNodeId ? findParentId(rootNode, selectedNodeId) : null;

  const handleSave = () => {
    const glassObj = GLASS_TYPES.find(g => g.id === glassTypeId) || GLASS_TYPES[0];
    const customPriceNum = customGlassPriceInput.trim() !== '' ? Number(customGlassPriceInput) : undefined;
    onSave({
      id: initialUnit?.id || uuidv4(),
      name, width, height, system: systemId,
      color, glassType: glassTypeId, glassThickness: glassObj.thickness,
      rootNode, quantity: Math.max(1, quantity), shape, archHeight,
      hasThreshold,
      includeGlass,
      customGlassPrice: customPriceNum,
      selectedHandle, selectedHinge, selectedGasket, selectedLock, 
      selectedCorner, selectedAutomation, selectedKickplate, 
      selectedDoorCloser, selectedLockStriker, selectedOther
    });
  };

  const AccessorySelect = ({ label, type, value, onChange }: { label: string, type: Accessory['type'], value: string, onChange: (val: string) => void }) => {
    const filtered = accessories.filter(a => 
      a.type === type && 
      (a.compatibility === 'both' || a.compatibility === selectedSystem.type || !a.compatibility)
    );
    return (
      <div className="space-y-1">
        <label className="text-[10px] font-bold text-slate-500 uppercase block ml-1">{label}</label>
        <div className="relative">
          <select 
            value={value} 
            onChange={e => onChange(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white outline-none focus:border-blue-500/50 appearance-none"
          >
            <option value="">{t(lang, 'selectAccessories')}</option>
            {filtered.map(acc => {
              const isHingeType = acc.type === 'hinge';
              const isRollerType = acc.type === 'other' && selectedSystem.type === 'sliding';
              
              let suffix = '';
              let isInsufficient = false;
              
              if ((isHingeType || isRollerType) && acc.maxWeightKg) {
                if (acc.maxWeightKg < totalGlassWeight) {
                  isInsufficient = true;
                  suffix = lang === 'tr' 
                    ? ` - ⚠️ KAPASİTE Yetersiz (Max: ${acc.maxWeightKg} kg)` 
                    : ` - ⚠️ CAPACITY Insufficient (Max: ${acc.maxWeightKg} kg)`;
                } else {
                  const isRec = isHingeType 
                    ? recommendedHinge?.id === acc.id 
                    : recommendedRoller?.id === acc.id;
                  if (isRec) {
                    suffix = lang === 'tr' ? ' - [⭐ ÖNERİLEN]' : ' - [⭐ RECOMMENDED]';
                  }
                }
              }
              const displayText = `${acc.name} (${acc.price} USD)${suffix}`;
              return (
                <option key={acc.id} value={acc.id} className={isInsufficient ? 'text-red-500 font-bold bg-red-950/20' : ''}>
                  {displayText}
                </option>
              );
            })}
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-600">
             <ChevronUp size={12} className="rotate-180" />
          </div>
        </div>
      </div>
    );
  };

  const isVerticalSplit = selectedNode?.direction === 'vertical';
  const totalDim = isVerticalSplit ? width : height;
  const size1 = selectedNode ? (selectedNode.splitRatio?.[0] || 0.5) * totalDim : 0;
  const size2 = selectedNode ? (selectedNode.splitRatio?.[1] || 0.5) * totalDim : 0;

  const formatSize = (num: number) => {
    const rounded = Number(num.toFixed(2));
    if (lang === 'tr') {
      return rounded.toString().replace('.', ',');
    }
    return rounded.toString();
  };

  useEffect(() => {
    if (selectedNode?.type === 'container') {
      const parsed1 = parseFloat(inputVal1.replace(',', '.'));
      const parsed2 = parseFloat(inputVal2.replace(',', '.'));
      
      const diff1 = Math.abs((isNaN(parsed1) ? 0 : parsed1) - size1);
      const diff2 = Math.abs((isNaN(parsed2) ? 0 : parsed2) - size2);
      
      if (isNaN(parsed1) || diff1 > 0.02) {
        setInputVal1(formatSize(size1));
      }
      if (isNaN(parsed2) || diff2 > 0.02) {
        setInputVal2(formatSize(size2));
      }
    }
  }, [selectedNodeId, size1, size2, selectedNode?.type]);

  const handleUpdateSplitSize = (index: number, val: number) => {
    if (!selectedNodeId || !selectedNode) return;
    const isVertical = selectedNode.direction === 'vertical';
    const totalDimVal = isVertical ? width : height;
    if (totalDimVal <= 0) return;

    const clampedVal = Math.max(10, Math.min(totalDimVal - 10, val));
    let ratio0 = 0.5;
    if (index === 0) {
      ratio0 = clampedVal / totalDimVal;
    } else {
      ratio0 = 1 - (clampedVal / totalDimVal);
    }
    handleUpdateSplitRatio(ratio0);
  };
  const currentUnitFor3D: Unit = {
    id: 'temp',
    name, width, height, system: systemId,
    color, glassType: glassTypeId, glassThickness: 24,
    rootNode, quantity, shape, archHeight, hasThreshold, includeGlass,
    customGlassPrice: customGlassPriceInput.trim() !== '' ? Number(customGlassPriceInput) : undefined
  };

  // Check if any part is openable for section view
  const hasOpeningPart = (node: WindowNode): boolean => {
    if (node.openingType && node.openingType !== 'fixed') return true;
    if (node.children) return node.children.some(hasOpeningPart);
    return false;
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-200">
      <div className="h-16 border-b border-white/5 flex items-center justify-between px-6 bg-slate-900/50 backdrop-blur-xl z-20">
        <div className="flex items-center gap-6">
            <button onClick={onCancel} className="p-2 hover:bg-slate-800 rounded-full transition-colors"><ArrowLeft size={20} /></button>
            <div className="flex flex-col">
              <input value={name} onChange={e => setName(e.target.value)} className="bg-transparent border-none text-lg font-bold focus:ring-0 outline-none text-white p-0 h-6" />
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{t(lang, 'unitEditor')}</span>
            </div>
        </div>
        <div className="flex gap-3">
            <div className="flex bg-slate-800 p-1 rounded-xl border border-white/5 mr-4">
              <button onClick={() => setViewMode('2d')} className={`px-4 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center gap-2 ${viewMode === '2d' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
                <Monitor size={14} /> 2D VIEW
              </button>
              <button onClick={() => setViewMode('3d')} className={`px-4 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center gap-2 ${viewMode === '3d' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
                <BoxSelect size={14} /> 3D PREVIEW
              </button>
            </div>
            <button onClick={handleUndo} disabled={history.length === 0} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 rounded-xl font-bold flex items-center gap-2 transition-all border border-white/5">
              <Undo2 size={18} /> {t(lang, 'undo')}
            </button>
            <button onClick={handleSave} className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-blue-900/20">
              <Save size={18} /> {t(lang, 'saveUnit')}
            </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-80 border-r border-white/5 bg-slate-900/40 p-5 overflow-y-auto space-y-8 custom-scrollbar">
            <section>
                <div className="flex items-center gap-2 mb-4">
                  <Ruler size={14} className="text-blue-500" />
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t(lang, 'dimensions')} & {t(lang, 'quantity')}</h3>
                </div>
                <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-950 p-2.5 rounded-xl border border-white/5">
                            <label className="block text-[9px] text-slate-500 mb-0.5 uppercase">{t(lang, 'width')}</label>
                            <input type="number" value={width} onChange={e => setWidth(Number(e.target.value))} className="bg-transparent text-white font-mono font-bold w-full outline-none text-sm" />
                        </div>
                        <div className="bg-slate-950 p-2.5 rounded-xl border border-white/5">
                            <label className="block text-[9px] text-slate-500 mb-0.5 uppercase">{t(lang, 'height')}</label>
                            <input type="number" value={height} onChange={e => setHeight(Number(e.target.value))} className="bg-transparent text-white font-mono font-bold w-full outline-none text-sm" />
                        </div>
                    </div>
                    <div className="bg-slate-950 p-2.5 rounded-xl border border-white/5">
                        <label className="block text-[9px] text-slate-500 mb-0.5 uppercase">{t(lang, 'quantity')}</label>
                        <div className="flex items-center gap-2">
                           <input type="number" min="1" value={quantity} onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))} className="bg-transparent text-blue-400 font-mono font-bold w-full outline-none text-sm" />
                           <span className="text-[10px] text-slate-600 font-bold uppercase">{t(lang, 'unitPce')}</span>
                        </div>
                    </div>
                    <div className="space-y-3 pt-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase block ml-1">{t(lang, 'shape')}</label>
                        <div className="grid grid-cols-3 gap-2">
                          <button onClick={() => setShape('rect')} className={`flex flex-col items-center p-2 rounded-xl border transition-all ${shape === 'rect' ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-slate-950 border-white/5 text-slate-500'}`}>
                            <Square size={16} className="mb-1" /><span className="text-[8px] font-bold uppercase">{t(lang, 'rect')}</span>
                          </button>
                          <button onClick={() => setShape('triangle')} className={`flex flex-col items-center p-2 rounded-xl border transition-all ${shape === 'triangle' ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-slate-950 border-white/5 text-slate-500'}`}>
                            <Triangle size={16} className="mb-1" /><span className="text-[8px] font-bold uppercase">{t(lang, 'triangle')}</span>
                          </button>
                          <button onClick={() => setShape('arch')} className={`flex flex-col items-center p-2 rounded-xl border transition-all ${shape === 'arch' ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-slate-950 border-white/5 text-slate-500'}`}>
                            <Circle size={16} className="mb-1" /><span className="text-[8px] font-bold uppercase">{t(lang, 'arch')}</span>
                          </button>
                        </div>
                    </div>
                    {shape === 'arch' && (
                      <div className="bg-slate-950 p-2.5 rounded-xl border border-white/5 animate-in fade-in slide-in-from-top-1">
                          <label className="block text-[9px] text-slate-500 mb-0.5 uppercase">{t(lang, 'archHeight')}</label>
                          <input type="number" value={archHeight} onChange={e => setArchHeight(Number(e.target.value))} className="bg-transparent text-white font-mono font-bold w-full outline-none text-sm" />
                      </div>
                    )}
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase block ml-1">{lang === 'tr' ? 'Profil Renk Grubu' : 'Profile Color Group'}</label>
                        <select value={color} onChange={e => setColor(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white outline-none appearance-none">
                          {COLOR_GROUPS.map(c => (
                            <option key={c.id} value={c.id}>
                              {lang === 'tr' ? c.nameTr : c.nameEn}
                            </option>
                          ))}
                        </select>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase block ml-1">{t(lang, 'glassType')}</label>
                        <select value={glassTypeId} onChange={e => setGlassTypeId(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white outline-none appearance-none">
                          {GLASS_TYPES.map(g => <option key={g.id} value={g.id}>{g.name} ({g.thickness}mm)</option>)}
                        </select>
                    </div>

                    {/* Dynamic Glass Price and Inclusion Options */}
                    <div className="p-3 bg-slate-950/70 border border-white/5 rounded-xl space-y-3 transition-colors">
                      <label className="flex items-center gap-2.5 cursor-pointer select-none">
                        <input 
                          type="checkbox" 
                          checked={includeGlass} 
                          onChange={e => setIncludeGlass(e.target.checked)} 
                          className="rounded border-slate-800 bg-slate-950 text-blue-650 focus:ring-0 w-4 h-4 outline-none cursor-pointer"
                        />
                        <div className="flex flex-col">
                          <span className="font-bold text-xs text-slate-100">
                            {lang === 'tr' ? 'Cam Dahil' : 'Include Glass'}
                          </span>
                          <span className="text-[9px] text-slate-500 font-medium leading-tight">
                            {lang === 'tr' ? 'Cam fiyatını maliyet ve fiyat teklifine dahil eder' : 'Includes glass pricing in cost and quotation calculations'}
                          </span>
                        </div>
                      </label>

                      {includeGlass && (
                        <div className="pt-2 border-t border-white/5 space-y-1.5 animate-in fade-in slide-in-from-top-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase block">
                            {lang === 'tr' ? 'Özel Cam m² Fiyatı (TL)' : 'Custom Glass Price per m² ($)'} 
                            <span className="text-[9px] text-blue-400 normal-case ml-1 font-medium">
                              ({lang === 'tr' ? 'Boş ise katalog fiyatı' : 'Leave empty for default catalog'})
                            </span>
                          </label>
                          <input 
                            type="number" 
                            value={customGlassPriceInput} 
                            placeholder={(() => {
                              const selectedGlassObj = GLASS_TYPES.find(g => g.id === glassTypeId);
                              return selectedGlassObj ? `${selectedGlassObj.pricePerSqm} TL` : '65';
                            })()}
                            onChange={e => setCustomGlassPriceInput(e.target.value)} 
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white outline-none focus:border-blue-500/50"
                            min="0"
                            step="0.01"
                          />
                        </div>
                      )}
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase block ml-1">{t(lang, 'profileSystem')}</label>
                        <div className="flex gap-2">
                            <select value={systemId} onChange={e => setSystemId(e.target.value)} className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white outline-none appearance-none">
                            {systems.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                            <button 
                                onClick={() => setShowSection(true)}
                                className="p-2.5 bg-slate-800 hover:bg-blue-600/20 border border-white/5 rounded-xl text-blue-400 transition-all"
                                title={t(lang, 'sectionDetail')}
                             >
                                <Layers size={16} />
                            </button>
                        </div>
                    </div>
                    
                    <div className="pt-1.5">
                        <label className="flex items-center gap-2.5 cursor-pointer bg-slate-950 hover:bg-slate-900 border border-white/5 rounded-xl p-3 text-xs text-white select-none transition-all">
                            <input 
                              type="checkbox" 
                              checked={hasThreshold} 
                              onChange={e => setHasThreshold(e.target.checked)} 
                              className="rounded border-slate-800 bg-slate-950 text-blue-650 focus:ring-0 w-4 h-4 outline-none cursor-pointer"
                            />
                            <div className="flex flex-col">
                              <span className="font-bold">{lang === 'tr' ? 'Alüminyum Eşik' : 'Aluminum Threshold'}</span>
                              <span className="text-[10px] text-slate-500 font-medium leading-tight">
                                {lang === 'tr' ? 'Kasa yerine alt kısma mini eşik profili uygulanır' : 'Low profile bottom threshold instead of standard frame'}
                              </span>
                            </div>
                        </label>
                    </div>
                </div>
            </section>
            <section className="pt-6 border-t border-white/5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Settings2 size={14} className="text-blue-500" />
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t(lang, 'selectedPane')}</h3>
                  </div>
                  {parentId && <button onClick={() => setSelectedNodeId(parentId)} className="p-1.5 hover:bg-slate-800 rounded-lg text-blue-400 transition-colors" title={t(lang, 'selectParent')}><ChevronUp size={14} /></button>}
                </div>
                {!selectedNodeId ? (
                  <div className="bg-blue-500/5 border border-blue-500/10 p-4 rounded-xl text-center">
                    <MousePointer2 className="mx-auto mb-2 text-blue-500/40" size={20} />
                    <p className="text-[10px] text-slate-500 italic">{t(lang, 'selectPaneInfo')}</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {selectedNode?.type === 'container' ? (
                      <div className="space-y-4 bg-slate-900/50 p-4 rounded-xl border border-white/5">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Layout size={12} className="text-blue-400" />
                            <span className="text-[10px] font-bold uppercase text-slate-400">{t(lang, 'splitSizes')}</span>
                          </div>
                          <span className="text-[9px] text-slate-500 font-extrabold font-mono uppercase bg-slate-950 px-2 py-0.5 rounded border border-white/5">
                            {selectedNode.direction === 'vertical' ? (lang === 'tr' ? 'Dikey Bölme' : 'Vertical Split') : (lang === 'tr' ? 'Yatay Bölme' : 'Horizontal Split')}
                          </span>
                        </div>
                        
                        {/* Manual Input Fields side by side */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-slate-950 p-2.5 rounded-xl border border-white/5">
                            <label className="block text-[9px] font-bold text-slate-500 mb-1 uppercase">
                              {selectedNode.direction === 'vertical'
                                ? (lang === 'tr' ? 'Sol Bölme (Y1)' : 'Left Width (W1)')
                                : (lang === 'tr' ? 'Üst Bölme (H1)' : 'Top Height (H1)')}
                            </label>
                            <div className="flex items-center gap-1.5 font-mono">
                              <input 
                                type="text" 
                                value={inputVal1} 
                                onChange={e => {
                                  const rawVal = e.target.value.replace(/[^\d.,]/g, '');
                                  setInputVal1(rawVal);
                                  const normalized = rawVal.replace(',', '.');
                                  const num = parseFloat(normalized);
                                  if (!isNaN(num) && num > 0) {
                                    handleUpdateSplitSize(0, num);
                                  }
                                }} 
                                className="bg-transparent text-white font-bold w-full outline-none text-xs focus:text-blue-400" 
                              />
                              <span className="text-[9px] text-slate-600 font-semibold uppercase">MM</span>
                            </div>
                          </div>
                          <div className="bg-slate-950 p-2.5 rounded-xl border border-white/5">
                            <label className="block text-[9px] font-bold text-slate-500 mb-1 uppercase">
                              {selectedNode.direction === 'vertical'
                                ? (lang === 'tr' ? 'Sağ Bölme (Y2)' : 'Right Width (W2)')
                                : (lang === 'tr' ? 'Alt Bölme (H2)' : 'Bottom Height (H2)')}
                            </label>
                            <div className="flex items-center gap-1.5 font-mono">
                              <input 
                                type="text" 
                                value={inputVal2} 
                                onChange={e => {
                                  const rawVal = e.target.value.replace(/[^\d.,]/g, '');
                                  setInputVal2(rawVal);
                                  const normalized = rawVal.replace(',', '.');
                                  const num = parseFloat(normalized);
                                  if (!isNaN(num) && num > 0) {
                                    handleUpdateSplitSize(1, num);
                                  }
                                }} 
                                className="bg-transparent text-white font-bold w-full outline-none text-xs focus:text-blue-400" 
                              />
                              <span className="text-[9px] text-slate-600 font-semibold uppercase">MM</span>
                            </div>
                          </div>
                        </div>

                        {/* Visual Range Slider for sliding control */}
                        <div className="space-y-2 pt-2 border-t border-white/5">
                          <div className="flex items-center justify-between text-[9px] font-semibold text-slate-500">
                            <span>{lang === 'tr' ? 'Sürgü ile ayarla' : 'Adjust with slider'}</span>
                            <span className="text-blue-400 font-mono">%{Math.round((selectedNode.splitRatio?.[0] || 0.5) * 100)}</span>
                          </div>
                          <input 
                            type="range" 
                            min="0.05" 
max="0.95" 
                            step="0.01" 
                            value={selectedNode.splitRatio?.[0] || 0.5} 
                            onChange={e => handleUpdateSplitRatio(Number(e.target.value))} 
                            className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500" 
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => handleSplit('vertical')} className="flex flex-col items-center justify-center p-3 bg-slate-800 hover:bg-slate-700 rounded-xl transition-all border border-white/5 group">
                          <SplitSquareHorizontal size={18} className="mb-1 text-slate-400 group-hover:text-blue-400" /><span className="text-[9px] font-bold uppercase tracking-tighter">{t(lang, 'splitVert')}</span>
                        </button>
                        <button onClick={() => handleSplit('horizontal')} className="flex flex-col items-center justify-center p-3 bg-slate-800 hover:bg-slate-700 rounded-xl transition-all border border-white/5 group">
                          <SplitSquareVertical size={18} className="mb-1 text-slate-400 group-hover:text-blue-400" /><span className="text-[9px] font-bold uppercase tracking-tighter">{t(lang, 'splitHorz')}</span>
                        </button>
                      </div>
                    )}
                    {selectedNode?.type !== 'container' && (
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">{t(lang, 'openingType')}</label>
                        <select value={selectedNode?.openingType || 'fixed'} onChange={e => handleSetOpening(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white outline-none appearance-none">
                          <option value="fixed">{t(lang, 'fixed')}</option>
                          <option value="turn-left">{t(lang, 'turnLeft')}</option>
                          <option value="turn-right">{t(lang, 'turnRight')}</option>
                          <option value="tilt">{t(lang, 'tilt')}</option>
                          <option value="tilt-turn-left">{t(lang, 'tiltTurnLeft')}</option>
                          <option value="tilt-turn-right">{t(lang, 'tiltTurnRight')}</option>
                          <option value="sliding">{t(lang, 'sliding')}</option>
                        </select>
                      </div>
                    )}
                    <button onClick={() => { setRootNode({ ...INITIAL_ROOT_NODE, id: uuidv4() }); setSelectedNodeId(null); }} className="w-full flex items-center justify-center gap-2 p-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl transition-all border border-red-500/20">
                      <Trash2 size={14} /><span className="text-[10px] font-bold uppercase tracking-wider">{t(lang, 'resetUnit')}</span>
                    </button>
                  </div>
                )}
            </section>
            <section className="pt-6 border-t border-white/5 pb-10">
                {/* Real-time Dynamic Glass Weight Info Card */}
                <div className="mb-6 bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{lang === 'tr' ? 'Hesaplanan Cam Ağırlığı' : 'Calculated Glass Weight'}</span>
                    </div>
                    <span className="text-lg font-black font-mono text-emerald-400">{totalGlassWeight.toFixed(2)} <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">KG</span></span>
                  </div>

                  <div className="bg-slate-900/60 p-2.5 rounded-xl border border-white/5 space-y-1.5 text-[10px]">
                    <div className="flex justify-between items-center text-slate-400 font-medium">
                      <span>{lang === 'tr' ? 'Etkin Cam Kalınlığı:' : 'Active Glass Thickness:'}</span>
                      <span className="font-bold text-slate-200">{GLASS_TYPES.find(g => g.id === glassTypeId)?.thickness || 4} mm</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-400 font-medium">
                      <span>{lang === 'tr' ? 'Sistem Tipi:' : 'System Type:'}</span>
                      <span className="font-bold uppercase text-slate-200 tracking-wider text-[9px]">{selectedSystem.type === 'hinged' ? (lang === 'tr' ? 'Menteşeli / Devrilmeli' : 'Hinged / Tilt') : (lang === 'tr' ? 'Sürme' : 'Sliding')}</span>
                    </div>
                    {selectedSystem.type === 'hinged' && recommendedHinge && (
                      <div className="flex justify-between items-start text-slate-400 pt-1.5 border-t border-white/5">
                        <span className="mt-0.5">{lang === 'tr' ? 'Önerilen Menteşe:' : 'Recommended Hinge:'}</span>
                        <span className="font-extrabold text-blue-400 text-right max-w-[150px] leading-tight block">{recommendedHinge.name}</span>
                      </div>
                    )}
                    {selectedSystem.type === 'sliding' && recommendedRoller && (
                      <div className="flex justify-between items-start text-slate-400 pt-1.5 border-t border-white/5">
                        <span className="mt-0.5">{lang === 'tr' ? 'Önerilen Tekerlek:' : 'Recommended Roller:'}</span>
                        <span className="font-extrabold text-blue-400 text-right max-w-[150px] leading-tight block">{recommendedRoller.name}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-4">
                  <Wrench size={14} className="text-blue-500" />
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t(lang, 'accessories')}</h3>
                </div>
                <div className="space-y-4">
                    <AccessorySelect label={t(lang, 'handle')} type="handle" value={selectedHandle} onChange={setSelectedHandle} />
                    {selectedSystem.type === 'sliding' ? (
                      <AccessorySelect label={lang === 'tr' ? 'Sürme Makaraları / Tekerlek' : 'Sliding Rollers / Wheels'} type="other" value={selectedOther} onChange={setSelectedOther} />
                    ) : (
                      <AccessorySelect label={t(lang, 'hinge')} type="hinge" value={selectedHinge} onChange={setSelectedHinge} />
                    )}
                    <AccessorySelect label={t(lang, 'gasket')} type="gasket" value={selectedGasket} onChange={setSelectedGasket} />
                    <AccessorySelect label={t(lang, 'lock')} type="lock" value={selectedLock} onChange={setSelectedLock} />
                    <AccessorySelect label={t(lang, 'corner')} type="corner" value={selectedCorner} onChange={setSelectedCorner} />
                    <AccessorySelect label={t(lang, 'automation')} type="automation" value={selectedAutomation} onChange={setSelectedAutomation} />
                    <AccessorySelect label={t(lang, 'kickplate')} type="kickplate" value={selectedKickplate} onChange={setSelectedKickplate} />
                </div>
            </section>
        </div>

        <div className={`flex-1 ${viewMode === '3d' ? 'bg-slate-100' : 'bg-slate-900'} relative flex items-center justify-center p-8 overflow-auto`} onClick={() => setSelectedNodeId(null)}>
             
             {/* Common Floating Zoom Controls */}
             <div className="absolute bottom-6 right-6 flex flex-col bg-slate-800 border border-white/10 rounded-2xl shadow-2xl p-2 z-40 gap-1" onClick={e => e.stopPropagation()}>
                <button onClick={() => setVisualScale(Math.min(0.5, visualScale + 0.05))} className="p-2.5 hover:bg-slate-700 rounded-xl text-slate-300 transition-colors" title="Zoom In"><ZoomIn size={18} /></button>
                <button onClick={() => setVisualScale(Math.max(0.05, visualScale - 0.05))} className="p-2.5 hover:bg-slate-700 rounded-xl text-slate-300 transition-colors" title="Zoom Out"><ZoomOut size={18} /></button>
                <div className="h-px bg-white/5 mx-2 my-1" />
                <button onClick={() => setVisualScale(0.15)} className="p-2.5 hover:bg-slate-700 rounded-xl text-slate-300 transition-colors" title="Fit to Screen"><Maximize size={18} /></button>
                <div className="text-[9px] font-black text-blue-400 text-center mt-1 uppercase tracking-tighter">%{Math.round(visualScale * 500)}</div>
             </div>

             {viewMode === '2d' ? (
               <div className="relative w-full h-full flex items-center justify-center min-h-[500px]">
                  <div className="absolute inset-0 bg-slate-100 opacity-[0.2] pointer-events-none" 
                        style={{ backgroundImage: 'linear-gradient(#94a3b8 1px, transparent 1px), linear-gradient(90deg, #94a3b8 1px, transparent 1px)', backgroundSize: '50px 50px' }} 
                  />
                  
                  <div className="relative p-12 flex items-center justify-center group transition-all duration-300" style={{ transform: `scale(${visualScale * 5})`, transformOrigin: 'center center' }}>
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-8 bg-white px-4 py-1.5 rounded-full text-[10px] font-mono text-slate-800 shadow-md flex items-center gap-2 font-black border border-slate-200 opacity-80 group-hover:opacity-100 transition-opacity">
                      <Box size={10} className="text-blue-500" /> {width} mm
                    </div>
                    <div className="absolute left-0 top-1/2 -translate-x-16 -translate-y-1/2 rotate-90 bg-white px-4 py-1.5 rounded-full text-[10px] font-mono text-slate-800 shadow-md flex items-center gap-2 font-black border border-slate-200 opacity-80 group-hover:opacity-100 transition-opacity">
                      <Box size={10} className="text-blue-500" /> {height} mm
                    </div>

                    <svg 
                      width={width * 0.2} 
                      height={height * 0.2} 
                      viewBox={`0 0 ${width} ${height}`} 
                      className="drop-shadow-2xl overflow-visible transition-transform duration-300"
                    >
                        <Visualizer 
                            node={rootNode} width={width} height={height} 
                            system={selectedSystem}
                            selectedNodeId={selectedNodeId} onSelectNode={setSelectedNodeId}
                            shape={shape} archHeight={archHeight}
                            theme="light"
                            hasThreshold={hasThreshold}
                            lang={lang}
                        />
                    </svg>
                  </div>
               </div>
             ) : (
               <ThreeDPreview 
                  unit={currentUnitFor3D} 
                  system={selectedSystem} 
                  scale={visualScale}
               />
             )}
        </div>
      </div>

      {showSection && (
        <CrossSection 
          system={selectedSystem} 
          glassThickness={24} 
          isOpenable={hasOpeningPart(rootNode)} 
          lang={lang} 
          onClose={() => setShowSection(false)} 
        />
      )}
    </div>
  );
};

export default Editor;
