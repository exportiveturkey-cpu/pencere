import React, { useState } from 'react';
import { Unit, WindowNode, ProfileSystem, Language, Accessory } from '../types';
import Visualizer from './Visualizer';
import { GLASS_TYPES, INITIAL_ROOT_NODE } from '../constants';
import { v4 as uuidv4 } from 'uuid';
import { ArrowLeft, Save, SplitSquareHorizontal, SplitSquareVertical, Trash2, Wand2, CheckCircle2, ArrowUp, Ruler, Undo } from 'lucide-react';
import { analyzeStructure } from '../services/geminiService';
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
  const defaultSystemId = systems.length > 0 ? systems[0].id : '';
  
  const [name, setName] = useState(initialUnit?.name || t(lang, 'newPosition'));
  const [width, setWidth] = useState(initialUnit?.width || 1200);
  const [height, setHeight] = useState(initialUnit?.height || 1500);
  const [systemId, setSystemId] = useState(initialUnit?.system || defaultSystemId);
  const [glassId, setGlassId] = useState(initialUnit?.glassType || GLASS_TYPES[1].id);
  const [glassThickness, setGlassThickness] = useState(initialUnit?.glassThickness || 24);
  const [quantity, setQuantity] = useState(initialUnit?.quantity || 1);
  const [rootNode, setRootNode] = useState<WindowNode>(initialUnit?.rootNode || { ...INITIAL_ROOT_NODE, id: uuidv4() });
  
  // Undo History
  const [history, setHistory] = useState<WindowNode[]>([]);

  // Accessory Selection State
  const [selectedHandleId, setSelectedHandleId] = useState<string>(initialUnit?.selectedHandle || '');
  const [selectedGasketId, setSelectedGasketId] = useState<string>(initialUnit?.selectedGasket || '');
  const [selectedHingeId, setSelectedHingeId] = useState<string>(initialUnit?.selectedHinge || '');

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const currentSystem = systems.find(s => s.id === systemId) || systems[0];

  // Filter accessories by type
  const handles = accessories.filter(a => a.type === 'handle');
  const gaskets = accessories.filter(a => a.type === 'gasket');
  const hinges = accessories.filter(a => a.type === 'hinge');

  // History Helper
  const addToHistory = () => {
    // Deep copy current rootNode
    const snapshot = JSON.parse(JSON.stringify(rootNode));
    setHistory(prev => [...prev, snapshot]);
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const previousState = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));
    setRootNode(previousState);
    // Optionally clear selection if the node no longer exists, but keeping it usually works if id persists
  };

  const updateNode = (id: string, updateFn: (node: WindowNode) => WindowNode) => {
    const traverse = (node: WindowNode): WindowNode => {
      if (node.id === id) {
        return updateFn(node);
      }
      if (node.children) {
        return { ...node, children: node.children.map(traverse) };
      }
      return node;
    };
    setRootNode(prev => traverse(prev));
  };

  const findNode = (id: string, node: WindowNode): WindowNode | null => {
    if (node.id === id) return node;
    if (node.children) {
      for (const child of node.children) {
        const found = findNode(id, child);
        if (found) return found;
      }
    }
    return null;
  };
  
  // Helper to find parent ID
  const findParentId = (targetId: string, node: WindowNode, parentId: string | null = null): string | null => {
      if (node.id === targetId) return parentId;
      if (node.children) {
          for (const child of node.children) {
              const found = findParentId(targetId, child, node.id);
              if (found) return found;
          }
      }
      return null;
  };

  // Helper to get node context (dimensions)
  const getNodeContext = (targetId: string, node: WindowNode, w: number, h: number): { width: number, height: number } | null => {
      if (node.id === targetId) return { width: w, height: h };
      
      if (node.children && node.children.length === 2 && node.splitRatio) {
          const frameW = currentSystem.frameWidth;
          const isVert = node.direction === 'vertical';
          
          const availableSpace = isVert ? w - frameW : h - frameW;
          const s1 = availableSpace * node.splitRatio[0];
          const s2 = availableSpace * node.splitRatio[1];
          
          const r1 = getNodeContext(targetId, node.children[0], isVert ? s1 : w, isVert ? h : s1);
          if (r1) return r1;
          
          const r2 = getNodeContext(targetId, node.children[1], isVert ? s2 : w, isVert ? h : s2);
          if (r2) return r2;
      }
      return null;
  };

  const handleSplit = (direction: 'vertical' | 'horizontal') => {
    if (!selectedNodeId) return;
    addToHistory();
    updateNode(selectedNodeId, (node) => ({
      id: node.id, 
      type: 'container',
      direction,
      splitRatio: [0.5, 0.5],
      children: [
        { id: uuidv4(), type: 'glass', openingType: 'fixed' },
        { id: uuidv4(), type: 'glass', openingType: 'fixed' }
      ]
    }));
    setSelectedNodeId(null);
  };

  const handleUpdateProp = (key: keyof WindowNode, value: any) => {
    if (!selectedNodeId) return;
    addToHistory();
    updateNode(selectedNodeId, (node) => ({ ...node, [key]: value }));
  };
  
  const handleRatioChange = (newSize: number, index: number) => {
      if (!selectedNodeId || !selectedNode || selectedNode.type !== 'container') return;
      
      const ctx = getNodeContext(selectedNodeId, rootNode, width, height);
      if (!ctx) return;
      
      const frameW = currentSystem.frameWidth;
      const isVert = selectedNode.direction === 'vertical';
      const totalAvailable = (isVert ? ctx.width : ctx.height) - frameW;
      
      if (totalAvailable <= 0) return;
      
      const ratio = Math.min(Math.max(newSize / totalAvailable, 0.1), 0.9);
      
      const newRatios = [...(selectedNode.splitRatio || [0.5, 0.5])];
      
      addToHistory();

      if (index === 0) {
          newRatios[0] = ratio;
          newRatios[1] = 1 - ratio;
      } else {
          newRatios[1] = ratio;
          newRatios[0] = 1 - ratio;
      }
      
      updateNode(selectedNodeId, (node) => ({ ...node, splitRatio: newRatios }));
  };

  const handleDelete = () => {
    if(confirm(t(lang, 'resetConfirm'))) {
        addToHistory();
        setRootNode({ ...INITIAL_ROOT_NODE, id: uuidv4() });
        setSelectedNodeId(null);
    }
  };
  
  const handleSelectParent = () => {
      if (!selectedNodeId) return;
      const pid = findParentId(selectedNodeId, rootNode);
      if (pid) setSelectedNodeId(pid);
  };
  
  const runAiCheck = async () => {
    if (!currentSystem) return;
    setIsAnalyzing(true);
    setAiAnalysis(null);

    // Resolve accessory names for AI context
    const handleName = accessories.find(a => a.id === selectedHandleId)?.name;
    const hingeName = accessories.find(a => a.id === selectedHingeId)?.name;

    const mockUnit: Unit = { 
        id: 'temp', name, width, height, system: currentSystem.name, 
        glassType: GLASS_TYPES.find(g => g.id === glassId)?.name || '', 
        glassThickness,
        color: '', rootNode, quantity,
        selectedHandle: handleName,
        selectedHinge: hingeName
    };
    const result = await analyzeStructure(mockUnit, currentSystem, lang);
    setAiAnalysis(result);
    setIsAnalyzing(false);
  };

  const handleSave = () => {
    const unit: Unit = {
      id: initialUnit?.id || uuidv4(),
      name,
      width,
      height,
      system: systemId,
      color: 'Anthracite Grey',
      glassType: glassId,
      glassThickness,
      rootNode,
      quantity: Math.max(1, quantity),
      selectedHandle: selectedHandleId,
      selectedGasket: selectedGasketId,
      selectedHinge: selectedHingeId
    };
    onSave(unit);
  };

  const selectedNode = selectedNodeId ? findNode(selectedNodeId, rootNode) : null;
  const parentId = selectedNodeId ? findParentId(selectedNodeId, rootNode) : null;
  
  // Calculate context for container split sizes
  let containerSizes = { s1: 0, s2: 0, total: 0 };
  if (selectedNode && selectedNode.type === 'container') {
      const ctx = getNodeContext(selectedNode.id, rootNode, width, height);
      if (ctx) {
          const frameW = currentSystem.frameWidth;
          const isVert = selectedNode.direction === 'vertical';
          const avail = (isVert ? ctx.width : ctx.height) - frameW;
          containerSizes = {
              total: avail,
              s1: avail * (selectedNode.splitRatio?.[0] || 0.5),
              s2: avail * (selectedNode.splitRatio?.[1] || 0.5)
          };
      }
  }

  if (!currentSystem) return <div>{t(lang, 'loading')}</div>;

  const openingTypes = [
    'fixed', 
    'turn-left', 
    'turn-right', 
    'tilt', 
    'tilt-turn-left', 
    'tilt-turn-right', 
    'sliding'
  ] as const;

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-200">
      {/* Toolbar */}
      <div className="h-14 border-b border-slate-700 flex items-center justify-between px-4 bg-slate-800">
        <div className="flex items-center space-x-4">
            <button onClick={onCancel} className="p-2 hover:bg-slate-700 rounded-full transition-colors">
                <ArrowLeft size={20} />
            </button>
            <h2 className="font-semibold text-lg">{t(lang, 'unitEditor')}</h2>
            <input 
                value={name} 
                onChange={e => setName(e.target.value)} 
                className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm focus:border-blue-500 outline-none w-64"
            />
        </div>
        <div className="flex space-x-2">
            {history.length > 0 && (
                <button 
                    onClick={handleUndo}
                    className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm font-medium transition-colors text-slate-200 mr-2"
                    title={t(lang, 'undo')}
                >
                    <Undo size={16} /> 
                    <span className="hidden sm:inline">{t(lang, 'undo')}</span>
                </button>
            )}
            <button 
                onClick={runAiCheck}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded text-sm font-medium transition-colors"
                disabled={isAnalyzing}
            >
               {isAnalyzing ? <span className="animate-spin">⌛</span> : <Wand2 size={16} />}
               {t(lang, 'aiCheck')}
            </button>
            <button 
                onClick={handleSave}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium transition-colors"
            >
                <Save size={16} /> {t(lang, 'saveUnit')}
            </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Global Config */}
        <div className="w-80 bg-slate-800 border-r border-slate-700 p-4 flex flex-col gap-6 overflow-y-auto">
            
            <section>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">{t(lang, 'dimensions')}</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs mb-1 text-slate-400">{t(lang, 'width')}</label>
                        <input 
                            type="number" 
                            value={width} 
                            onChange={(e) => setWidth(Number(e.target.value))}
                            className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-xs mb-1 text-slate-400">{t(lang, 'height')}</label>
                        <input 
                            type="number" 
                            value={height} 
                            onChange={(e) => setHeight(Number(e.target.value))}
                            className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm"
                        />
                    </div>
                </div>
                <div className="mt-4">
                    <label className="block text-xs mb-1 text-slate-400">{t(lang, 'quantity')}</label>
                    <input 
                        type="number" 
                        min="1"
                        value={quantity} 
                        onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm"
                    />
                </div>
            </section>

            <section>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">{t(lang, 'systemGlass')}</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs mb-1 text-slate-400">{t(lang, 'profileSystem')}</label>
                        <select 
                            value={systemId}
                            onChange={(e) => setSystemId(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm"
                        >
                            {systems.map(s => (
                                <option key={s.id} value={s.id}>{s.name} ({s.frameWidth}mm)</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs mb-1 text-slate-400">{t(lang, 'glazing')}</label>
                        <select 
                            value={glassId}
                            onChange={(e) => setGlassId(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm"
                        >
                            {GLASS_TYPES.map(g => (
                                <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs mb-1 text-slate-400">{t(lang, 'glassThickness')}</label>
                        <input 
                            type="number" 
                            value={glassThickness} 
                            onChange={(e) => setGlassThickness(Number(e.target.value))}
                            className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm"
                        />
                    </div>
                </div>
            </section>

            <section className="border-t border-slate-700 pt-6">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">{t(lang, 'selectAccessories')}</h3>
                <div className="space-y-4">
                     {/* Handles */}
                     <div>
                        <label className="block text-xs mb-1 text-slate-400">{t(lang, 'handle')}</label>
                        <select 
                            value={selectedHandleId}
                            onChange={(e) => setSelectedHandleId(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm"
                        >
                            <option value="">-- {t(lang, 'selectAccessories')} --</option>
                            {handles.map(h => (
                                <option key={h.id} value={h.id}>{h.name} (${h.price})</option>
                            ))}
                        </select>
                    </div>
                    
                    {/* Hinges */}
                     <div>
                        <label className="block text-xs mb-1 text-slate-400">{t(lang, 'hinge')}</label>
                        <select 
                            value={selectedHingeId}
                            onChange={(e) => setSelectedHingeId(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm"
                        >
                            <option value="">-- {t(lang, 'selectAccessories')} --</option>
                            {hinges.map(h => (
                                <option key={h.id} value={h.id}>{h.name} (${h.price})</option>
                            ))}
                        </select>
                    </div>

                    {/* Gaskets */}
                    <div>
                        <label className="block text-xs mb-1 text-slate-400">{t(lang, 'gasket')}</label>
                        <select 
                            value={selectedGasketId}
                            onChange={(e) => setSelectedGasketId(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm"
                        >
                             <option value="">-- {t(lang, 'selectAccessories')} --</option>
                            {gaskets.map(g => (
                                <option key={g.id} value={g.id}>{g.name} (${g.price}/{t(lang, 'unitMeter')})</option>
                            ))}
                        </select>
                    </div>
                </div>
            </section>

            {selectedNode && (
                <section className="bg-slate-700/50 p-4 rounded-lg border border-slate-600 animate-in fade-in slide-in-from-left-4 mt-6">
                    <div className="flex justify-between items-start mb-3">
                         <h3 className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-2">
                            {selectedNode.type === 'container' ? t(lang, 'containerInfo') : t(lang, 'selectedPane')}
                         </h3>
                         {parentId && (
                             <button onClick={handleSelectParent} className="text-[10px] bg-slate-600 hover:bg-slate-500 text-white px-2 py-1 rounded flex items-center gap-1 transition-colors">
                                 <ArrowUp size={10} /> {t(lang, 'selectParent')}
                             </button>
                         )}
                    </div>
                    
                    {/* Leaf Actions (Split/Type) */}
                    {selectedNode.type !== 'container' && (
                        <div className="space-y-3">
                            <label className="block text-xs text-slate-400">{t(lang, 'actions')}</label>
                            <div className="grid grid-cols-2 gap-2">
                                <button 
                                    onClick={() => handleSplit('horizontal')}
                                    className="flex flex-col items-center justify-center p-3 bg-slate-800 hover:bg-slate-600 rounded border border-slate-600 transition-all"
                                >
                                    <SplitSquareVertical size={20} className="mb-1" />
                                    <span className="text-[10px]">{t(lang, 'splitVert')}</span>
                                </button>
                                <button 
                                    onClick={() => handleSplit('vertical')}
                                    className="flex flex-col items-center justify-center p-3 bg-slate-800 hover:bg-slate-600 rounded border border-slate-600 transition-all"
                                >
                                    <SplitSquareHorizontal size={20} className="mb-1" />
                                    <span className="text-[10px]">{t(lang, 'splitHorz')}</span>
                                </button>
                            </div>
                            
                            <div className="pt-2 border-t border-slate-600">
                                 <label className="block text-xs mb-2 text-slate-400">{t(lang, 'openingType')}</label>
                                 <div className="grid grid-cols-2 gap-2">
                                    {openingTypes.map(type => (
                                        <button
                                            key={type}
                                            onClick={() => handleUpdateProp('openingType', type)}
                                            className={`text-xs px-2 py-1.5 rounded border capitalize ${
                                                selectedNode.openingType === type 
                                                ? 'bg-blue-600 border-blue-500 text-white' 
                                                : 'bg-slate-900 border-slate-600 text-slate-400 hover:border-slate-500'
                                            }`}
                                        >
                                            {t(lang, type === 'tilt-turn-left' ? 'tiltTurnLeft' : type === 'tilt-turn-right' ? 'tiltTurnRight' : type === 'turn-left' ? 'turnLeft' : type === 'turn-right' ? 'turnRight' : type as any)}
                                        </button>
                                    ))}
                                 </div>
                            </div>
                        </div>
                    )}

                    {/* Container Actions (Resizing) */}
                    {selectedNode.type === 'container' && (
                        <div className="space-y-4">
                             <div className="flex items-center gap-2 text-slate-300 text-sm border-b border-slate-600 pb-2">
                                 <Ruler size={16} />
                                 <span className="font-semibold">{t(lang, 'splitSizes')}</span>
                             </div>
                             <div className="space-y-3">
                                 <div>
                                     <label className="block text-xs mb-1 text-slate-400">{t(lang, 'pane1')}</label>
                                     <input 
                                        type="number"
                                        value={Math.round(containerSizes.s1)}
                                        onChange={(e) => handleRatioChange(Number(e.target.value), 0)}
                                        className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm font-mono"
                                     />
                                 </div>
                                 <div>
                                     <label className="block text-xs mb-1 text-slate-400">{t(lang, 'pane2')}</label>
                                     <input 
                                        type="number"
                                        value={Math.round(containerSizes.s2)}
                                        onChange={(e) => handleRatioChange(Number(e.target.value), 1)}
                                        className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm font-mono"
                                     />
                                 </div>
                                 <p className="text-[10px] text-slate-500 italic text-center mt-2">
                                     Total Avail: {Math.round(containerSizes.total)}mm
                                 </p>
                             </div>
                        </div>
                    )}

                    {selectedNodeId === rootNode.id && (
                        <div className="pt-4 mt-4 border-t border-slate-600">
                            <button 
                                onClick={handleDelete}
                                className="w-full flex items-center justify-center gap-2 p-2 text-red-400 hover:bg-red-900/20 border border-transparent hover:border-red-900 rounded transition-colors text-xs"
                            >
                                <Trash2 size={14} /> {t(lang, 'resetUnit')}
                            </button>
                        </div>
                    )}
                </section>
            )}

            {!selectedNode && (
                <div className="p-4 mt-6 rounded border border-dashed border-slate-700 text-center text-slate-500 text-sm">
                    {t(lang, 'selectPaneInfo')}
                </div>
            )}
        </div>

        {/* Center: Workspace */}
        <div className="flex-1 bg-slate-950 relative overflow-auto flex items-center justify-center p-10">
            {/* Grid Background */}
            <div className="absolute inset-0 opacity-10 pointer-events-none" 
                 style={{ 
                     backgroundImage: 'radial-gradient(#64748b 1px, transparent 1px)', 
                     backgroundSize: '20px 20px' 
                 }} 
            />
            
            <div className="relative shadow-2xl shadow-black">
                {/* Measurements Outside */}
                <div className="absolute -top-8 left-0 w-full text-center text-xs text-slate-400 font-mono border-b border-slate-700 pb-1">
                    {width} mm
                </div>
                <div className="absolute -left-10 top-0 h-full flex items-center text-xs text-slate-400 font-mono border-r border-slate-700 pr-1 writing-mode-vertical">
                    <span className="transform -rotate-90">{height} mm</span>
                </div>

                {/* The SVG Visualizer */}
                <svg width={width/2} height={height/2} viewBox={`0 0 ${width} ${height}`} className="bg-white/5 backdrop-blur-sm">
                    <Visualizer 
                        node={rootNode} 
                        width={width} 
                        height={height} 
                        system={currentSystem}
                        selectedNodeId={selectedNodeId}
                        onSelectNode={setSelectedNodeId}
                    />
                </svg>
            </div>
        </div>
        
        {/* Right: AI Panel */}
        {aiAnalysis && (
            <div className="w-80 bg-slate-900 border-l border-slate-700 p-4 overflow-y-auto animate-in slide-in-from-right">
                <div className="flex items-center gap-2 mb-4 text-emerald-400">
                    <CheckCircle2 size={20} />
                    <h3 className="font-bold">{t(lang, 'aiResult')}</h3>
                </div>
                <div className="prose prose-invert prose-sm text-slate-300">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed font-light">{aiAnalysis}</p>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default Editor;