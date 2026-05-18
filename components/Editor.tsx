
import React, { useState, useCallback, useEffect } from 'react';
import { Unit, WindowNode, ProfileSystem, Language, Accessory, SplitDirection, UnitShape } from '../types';
import Visualizer from './Visualizer';
import ThreeDPreview from './ThreeDPreview';
import CrossSection from './CrossSection';
import { INITIAL_ROOT_NODE, GLASS_TYPES } from '../constants';
import { v4 as uuidv4 } from 'uuid';
import { ArrowLeft, Save, SplitSquareHorizontal, SplitSquareVertical, Trash2, Layout, Settings2, Ruler, MousePointer2, Undo2, ChevronUp, Wrench, Box, Square, Triangle, Circle, BoxSelect, Monitor, ZoomIn, ZoomOut, Maximize, Layers } from 'lucide-react';
import { t } from '../translations';

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
  const [glassTypeId, setGlassTypeId] = useState(initialUnit?.glassType || GLASS_TYPES[0].id);
  const [rootNode, setRootNode] = useState<WindowNode>(initialUnit?.rootNode || { ...INITIAL_ROOT_NODE, id: uuidv4() });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');
  const [showSection, setShowSection] = useState(false);
  
  const [visualScale, setVisualScale] = useState(0.20);
  const [history, setHistory] = useState<WindowNode[]>([]);

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
      if (node.openingType && node.openingType !== 'fixed') {
        if (system.type === 'sliding' && node.openingType !== 'sliding') {
          updated.openingType = 'fixed';
        } else if (system.type === 'hinged' && node.openingType === 'sliding') {
          updated.openingType = 'fixed';
        }
      }
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
    onSave({
      id: initialUnit?.id || uuidv4(),
      name, width, height, system: systemId,
      color: 'RAL 7016', glassType: glassTypeId, glassThickness: glassObj.thickness,
      rootNode, quantity: Math.max(1, quantity), shape, archHeight,
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
            {filtered.map(acc => (
              <option key={acc.id} value={acc.id}>{acc.name} (${acc.price})</option>
            ))}
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-600">
             <ChevronUp size={12} className="rotate-180" />
          </div>
        </div>
      </div>
    );
  };

  const selectedSystem = systems.find(s => s.id === systemId) || systems[0];
  const currentUnitFor3D: Unit = {
    id: 'temp',
    name, width, height, system: systemId,
    color: 'RAL 7016', glassType: 'double24', glassThickness: 24,
    rootNode, quantity, shape, archHeight
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
                        <label className="text-[10px] font-bold text-slate-500 uppercase block ml-1">{t(lang, 'glassType')}</label>
                        <select value={glassTypeId} onChange={e => setGlassTypeId(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white outline-none appearance-none">
                          {GLASS_TYPES.map(g => <option key={g.id} value={g.id}>{g.name} ({g.thickness}mm)</option>)}
                        </select>
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
                        <div className="flex items-center gap-2 mb-2">
                          <Layout size={12} className="text-blue-400" />
                          <span className="text-[10px] font-bold uppercase text-slate-400">{t(lang, 'splitSizes')}</span>
                        </div>
                        <div className="space-y-3">
                          <input type="range" min="0.1" max="0.9" step="0.01" value={selectedNode.splitRatio?.[0] || 0.5} onChange={e => handleUpdateSplitRatio(Number(e.target.value))} className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                          <div className="flex justify-between font-mono text-[9px] text-blue-400">
                            <span>{Math.round((selectedNode.splitRatio?.[0] || 0.5) * (selectedNode.direction === 'vertical' ? width : height))} mm</span>
                            <span>{Math.round((selectedNode.splitRatio?.[1] || 0.5) * (selectedNode.direction === 'vertical' ? width : height))} mm</span>
                          </div>
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
                          {selectedSystem.type === 'hinged' ? (
                            <>
                              <option value="turn-left">{t(lang, 'turnLeft')}</option>
                              <option value="turn-right">{t(lang, 'turnRight')}</option>
                              <option value="tilt">{t(lang, 'tilt')}</option>
                              <option value="tilt-turn-left">{t(lang, 'tiltTurnLeft')}</option>
                              <option value="tilt-turn-right">{t(lang, 'tiltTurnRight')}</option>
                            </>
                          ) : (
                            <option value="sliding">{t(lang, 'sliding')}</option>
                          )}
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
                <div className="flex items-center gap-2 mb-4">
                  <Wrench size={14} className="text-blue-500" />
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t(lang, 'accessories')}</h3>
                </div>
                <div className="space-y-4">
                    <AccessorySelect label={t(lang, 'handle')} type="handle" value={selectedHandle} onChange={setSelectedHandle} />
                    <AccessorySelect label={t(lang, 'hinge')} type="hinge" value={selectedHinge} onChange={setSelectedHinge} />
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
