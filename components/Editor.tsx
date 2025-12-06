import React, { useState } from 'react';
import { Unit, WindowNode, ProfileSystem, Language } from '../types';
import Visualizer from './Visualizer';
import { GLASS_TYPES, INITIAL_ROOT_NODE } from '../constants';
import { v4 as uuidv4 } from 'uuid';
import { ArrowLeft, Save, SplitSquareHorizontal, SplitSquareVertical, Trash2, Wand2, CheckCircle2 } from 'lucide-react';
import { analyzeStructure } from '../services/geminiService';
import { t } from '../translations';

interface EditorProps {
  unit?: Unit;
  systems: ProfileSystem[];
  lang: Language;
  onSave: (unit: Unit) => void;
  onCancel: () => void;
}

const Editor: React.FC<EditorProps> = ({ unit: initialUnit, systems, lang, onSave, onCancel }) => {
  const defaultSystemId = systems.length > 0 ? systems[0].id : '';
  
  const [name, setName] = useState(initialUnit?.name || t(lang, 'newPosition'));
  const [width, setWidth] = useState(initialUnit?.width || 1200);
  const [height, setHeight] = useState(initialUnit?.height || 1500);
  const [systemId, setSystemId] = useState(initialUnit?.system || defaultSystemId);
  const [glassId, setGlassId] = useState(initialUnit?.glassType || GLASS_TYPES[1].id);
  const [glassThickness, setGlassThickness] = useState(initialUnit?.glassThickness || 24);
  const [quantity, setQuantity] = useState(initialUnit?.quantity || 1);
  const [rootNode, setRootNode] = useState<WindowNode>(initialUnit?.rootNode || { ...INITIAL_ROOT_NODE, id: uuidv4() });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const currentSystem = systems.find(s => s.id === systemId) || systems[0];

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

  const handleSplit = (direction: 'vertical' | 'horizontal') => {
    if (!selectedNodeId) return;
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
    updateNode(selectedNodeId, (node) => ({ ...node, [key]: value }));
  };

  const handleDelete = () => {
    if(confirm(t(lang, 'resetConfirm'))) {
        setRootNode({ ...INITIAL_ROOT_NODE, id: uuidv4() });
        setSelectedNodeId(null);
    }
  };
  
  const runAiCheck = async () => {
    if (!currentSystem) return;
    setIsAnalyzing(true);
    setAiAnalysis(null);
    const mockUnit: Unit = { 
        id: 'temp', name, width, height, system: currentSystem.name, 
        glassType: GLASS_TYPES.find(g => g.id === glassId)?.name || '', 
        glassThickness,
        color: '', rootNode, quantity 
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
      quantity: Math.max(1, quantity)
    };
    onSave(unit);
  };

  const selectedNode = selectedNodeId ? findNode(selectedNodeId, rootNode) : null;

  if (!currentSystem) return <div>{t(lang, 'loading')}</div>;

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

            {selectedNode && selectedNode.type !== 'container' && (
                <section className="bg-slate-700/50 p-4 rounded-lg border border-slate-600 animate-in fade-in slide-in-from-left-4">
                    <h3 className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-3 flex items-center justify-between">
                        <span>{t(lang, 'selectedPane')}</span>
                        <span className="text-[10px] bg-blue-900/50 px-2 py-0.5 rounded text-blue-300">ID: {selectedNode.id.slice(0,4)}</span>
                    </h3>
                    
                    <div className="space-y-3">
                        <label className="block text-xs text-slate-400">{t(lang, 'actions')}</label>
                        <div className="grid grid-cols-2 gap-2">
                            <button 
                                onClick={() => handleSplit('vertical')}
                                className="flex flex-col items-center justify-center p-3 bg-slate-800 hover:bg-slate-600 rounded border border-slate-600 transition-all"
                            >
                                <SplitSquareVertical size={20} className="mb-1" />
                                <span className="text-[10px]">{t(lang, 'splitVert')}</span>
                            </button>
                            <button 
                                onClick={() => handleSplit('horizontal')}
                                className="flex flex-col items-center justify-center p-3 bg-slate-800 hover:bg-slate-600 rounded border border-slate-600 transition-all"
                            >
                                <SplitSquareHorizontal size={20} className="mb-1" />
                                <span className="text-[10px]">{t(lang, 'splitHorz')}</span>
                            </button>
                        </div>
                        
                        <div className="pt-2 border-t border-slate-600">
                             <label className="block text-xs mb-2 text-slate-400">{t(lang, 'openingType')}</label>
                             <div className="grid grid-cols-2 gap-2">
                                {['fixed', 'turn', 'tilt-turn', 'sliding'].map(type => (
                                    <button
                                        key={type}
                                        onClick={() => handleUpdateProp('openingType', type)}
                                        className={`text-xs px-2 py-1.5 rounded border capitalize ${
                                            selectedNode.openingType === type 
                                            ? 'bg-blue-600 border-blue-500 text-white' 
                                            : 'bg-slate-900 border-slate-600 text-slate-400 hover:border-slate-500'
                                        }`}
                                    >
                                        {type}
                                    </button>
                                ))}
                             </div>
                        </div>

                        <div className="pt-4">
                            <button 
                                onClick={handleDelete}
                                className="w-full flex items-center justify-center gap-2 p-2 text-red-400 hover:bg-red-900/20 border border-transparent hover:border-red-900 rounded transition-colors text-xs"
                            >
                                <Trash2 size={14} /> {t(lang, 'resetUnit')}
                            </button>
                        </div>
                    </div>
                </section>
            )}

            {!selectedNode && (
                <div className="p-4 rounded border border-dashed border-slate-700 text-center text-slate-500 text-sm">
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