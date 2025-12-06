import React, { useState } from 'react';
import { Project, Unit, ProfileSystem, Language, Accessory } from '../types';
import { ArrowLeft, Edit2, Plus, FileText, Download, Bot, Printer, Thermometer, Loader2, Package } from 'lucide-react';
import { generateSalesPitch } from '../services/geminiService';
import { t } from '../translations';
import Visualizer from './Visualizer';
import OptimizationReport from './OptimizationReport';
import { GLASS_TYPES } from '../constants';
import Logo from './Logo';

interface ProjectViewProps {
  project: Project;
  systems: ProfileSystem[];
  accessories?: Accessory[];
  lang: Language;
  onBack: () => void;
  onAddUnit: () => void;
  onEditUnit: (unit: Unit) => void;
}

const ProjectView: React.FC<ProjectViewProps> = ({ project, systems, accessories = [], lang, onBack, onAddUnit, onEditUnit }) => {
  const [quoteIntro, setQuoteIntro] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  // Advanced Calculation Logic
  const getUnitStats = (unit: Unit) => {
    const system = systems.find(s => s.id === unit.system);
    const glassObj = GLASS_TYPES.find(g => g.id === unit.glassType);
    
    // Fallbacks
    if (!system) return { cost: 0, uw: 0, glassName: unit.glassType, totalAreaM2: 0, accessoriesCost: 0, accessoryList: [] };

    const frameW = system.frameWidth;
    
    let sashCount = 0;
    
    // Recursive Area & Mullion Calc
    const analyzeNode = (node: any, w: number, h: number): { glassArea: number, frameArea: number, mullionLength: number, perimeter: number } => {
         // Count sashes
         if (node.openingType && node.openingType !== 'fixed') {
             sashCount++;
         }

         if (node.type === 'container' && node.children?.length === 2 && node.splitRatio) {
            const isVert = node.direction === 'vertical';
            const mullionLen = isVert ? h : w;
            const mullionArea = mullionLen * frameW;
            
            const avail = isVert ? w - frameW : h - frameW;
            const s1 = avail * node.splitRatio[0];
            const s2 = avail * node.splitRatio[1];
            
            const r1 = analyzeNode(node.children[0], isVert ? s1 : w, isVert ? h : s1);
            const r2 = analyzeNode(node.children[1], isVert ? s2 : w, isVert ? h : s2);
            
            return {
                glassArea: r1.glassArea + r2.glassArea,
                frameArea: r1.frameArea + r2.frameArea + mullionArea,
                mullionLength: mullionLen + r1.mullionLength + r2.mullionLength,
                perimeter: r1.perimeter + r2.perimeter // Recursive perimeter sum (roughly)
            };
         }
         
         // Leaf
         const gW = Math.max(0, w - 2 * frameW);
         const gH = Math.max(0, h - 2 * frameW);
         const gArea = gW * gH;
         const total = w * h;
         const perim = (w + h) * 2;
         return { glassArea: gArea, frameArea: total - gArea, mullionLength: 0, perimeter: perim };
    };

    const stats = analyzeNode(unit.rootNode, unit.width, unit.height);
    const totalAreaM2 = (unit.width * unit.height) / 1000000;
    const glassAreaM2 = stats.glassArea / 1000000;
    const frameAreaM2 = stats.frameArea / 1000000;
    
    // 1. Profile Cost
    const outerFrameLen = 2 * (unit.width + unit.height);
    const totalProfileM = (outerFrameLen + stats.mullionLength) / 1000;
    const profileCost = totalProfileM * system.pricePerMeter;

    // 2. Glass Cost
    const glassCost = glassAreaM2 * (glassObj?.pricePerSqm || 50);

    // 3. Accessory Cost Calculation
    let accessoryCost = 0;
    const accessoryList: { name: string, count: number, unit: string, price: number }[] = [];

    // Handles
    if (unit.selectedHandle && sashCount > 0) {
        const handle = accessories.find(a => a.id === unit.selectedHandle);
        if (handle) {
            accessoryCost += handle.price * sashCount;
            accessoryList.push({ name: handle.name, count: sashCount, unit: t(lang, 'unitPce'), price: handle.price * sashCount });
        }
    }

    // Hinges (Approx: 2 per sash < 1200mm, 3 per sash > 1200mm, simple logic: 2 per sash)
    if (unit.selectedHinge && sashCount > 0) {
        const hinge = accessories.find(a => a.id === unit.selectedHinge);
        if (hinge) {
            const hingesPerSash = unit.height > 1200 ? 3 : 2;
            const totalHinges = sashCount * hingesPerSash;
            accessoryCost += hinge.price * totalHinges;
            accessoryList.push({ name: `${hinge.name} (${hingesPerSash}/sash)`, count: totalHinges, unit: t(lang, 'unitPce'), price: hinge.price * totalHinges });
        }
    }

    // Gaskets (Total Profile Length x 2 for Inner/Outer Seal)
    if (unit.selectedGasket) {
        const gasket = accessories.find(a => a.id === unit.selectedGasket);
        if (gasket) {
            const totalGasketM = totalProfileM * 2; 
            accessoryCost += gasket.price * totalGasketM;
            accessoryList.push({ name: gasket.name, count: parseFloat(totalGasketM.toFixed(1)), unit: t(lang, 'unitMeter'), price: gasket.price * totalGasketM });
        }
    }

    const totalCost = profileCost + glassCost + accessoryCost;
    
    // Uw: Weighted Average
    const Ug = glassObj?.uValue || 2.8;
    const Uf = system.uValue;
    const uw = totalAreaM2 > 0 ? ((glassAreaM2 * Ug) + (frameAreaM2 * Uf)) / totalAreaM2 : 0;

    return {
        cost: totalCost,
        uw,
        glassName: glassObj?.name || unit.glassType,
        totalAreaM2,
        accessoriesCost: accessoryCost,
        accessoryList
    };
  };

  const calculateTotal = (units: Unit[]) => {
    return units.reduce((acc, unit) => {
      return acc + (getUnitStats(unit).cost * (unit.quantity || 1));
    }, 0);
  };

  const calculateAvgUw = (units: Unit[]) => {
    if (units.length === 0) return 0;
    const totalArea = units.reduce((acc, u) => acc + ((u.width * u.height) * u.quantity), 0);
    const totalUwArea = units.reduce((acc, u) => {
         const stats = getUnitStats(u);
         return acc + (stats.uw * (u.width * u.height) * u.quantity);
    }, 0);
    return totalArea > 0 ? totalUwArea / totalArea : 0;
  };

  const handleGeneratePitch = async () => {
    setIsGenerating(true);
    const text = await generateSalesPitch(project, project.units, lang);
    setQuoteIntro(text);
    setIsGenerating(false);
  };

  const handlePrint = () => {
    setIsPrinting(true);
    setTimeout(() => {
        window.print();
        setTimeout(() => setIsPrinting(false), 500);
    }, 100);
  };

  const projectAvgUw = calculateAvgUw(project.units);

  return (
    <>
    {/* ... (Styles kept same) ... */}
    <style>{`
      /* Screen only */
      #print-view { display: none; }
      
      @media print {
        @page {
          size: A4;
          margin: 10mm;
        }

        html, body {
          height: auto !important;
          overflow: visible !important;
          background-color: white !important;
          margin: 0 !important;
          padding: 0 !important;
        }

        #root {
          display: block !important;
          background-color: white !important;
          height: auto !important;
          min-height: 0 !important;
        }

        #root > div {
            min-height: 0 !important;
            height: auto !important;
            overflow: visible !important;
            display: block !important;
            background-color: white !important;
            color: black !important;
        }

        #screen-view {
          display: none !important;
        }
        
        .no-print {
          display: none !important;
        }

        #print-view {
          display: block !important;
          width: 100%;
          background: white;
          color: black;
          font-family: 'Inter', sans-serif;
        }

        * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            box-shadow: none !important;
        }

        .avoid-break { 
            page-break-inside: avoid; 
            break-inside: avoid;
        }
        .page-break { 
            page-break-before: always; 
        }
      }
    `}</style>

    {/* SCREEN VIEW */}
    <div id="screen-view" className="flex h-full bg-slate-900">
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="h-16 border-b border-slate-700 bg-slate-800 px-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
                <button onClick={onBack} className="p-2 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition-colors">
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-xl font-bold text-white flex items-center gap-3">
                        {project.name}
                        <span className="text-xs font-normal px-2 py-0.5 rounded bg-slate-700 text-slate-300 border border-slate-600">
                             {project.status === 'Draft' ? t(lang, 'statusDraft') : 
                             project.status === 'Production' ? t(lang, 'statusProd') : t(lang, 'statusComp')}
                        </span>
                    </h1>
                    <p className="text-xs text-slate-400">{project.client} • {project.date}</p>
                </div>
            </div>
            
            {/* Center Brand */}
            <div className="hidden md:block opacity-50 grayscale hover:grayscale-0 hover:opacity-100 transition-all">
                <Logo className="w-8 h-8" showText={false} />
            </div>

            <div className="flex items-center gap-3">
                <div className="text-right mr-4">
                    <p className="text-xs text-slate-400">{t(lang, 'totalEst')}</p>
                    <p className="text-lg font-mono font-bold text-emerald-400">${calculateTotal(project.units).toFixed(2)}</p>
                </div>
                <button 
                    onClick={onAddUnit}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded flex items-center gap-2 text-sm font-medium transition-colors"
                >
                    <Plus size={16} /> {t(lang, 'addPosition')}
                </button>
            </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-8">
            {/* Units Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-12">
                {project.units.map((unit, index) => {
                    const stats = getUnitStats(unit);
                    return (
                        <div 
                            key={unit.id}
                            className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden group hover:border-blue-500 transition-colors"
                        >
                            <div className="aspect-square bg-slate-900/50 relative flex items-center justify-center p-4 border-b border-slate-700">
                                {/* Small Preview in Grid */}
                                <div className="w-full h-full max-w-[200px] max-h-[200px] flex items-center justify-center">
                                    <svg viewBox={`0 0 ${unit.width} ${unit.height}`} className="w-full h-full">
                                        <Visualizer 
                                            node={unit.rootNode}
                                            width={unit.width}
                                            height={unit.height}
                                            system={systems.find(s => s.id === unit.system) || systems[0]}
                                            selectedNodeId={null}
                                            onSelectNode={() => {}}
                                        />
                                    </svg>
                                </div>
                                
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                    <button onClick={() => onEditUnit(unit)} className="p-2 bg-blue-600 rounded text-white hover:scale-110 transition-transform"><Edit2 size={16}/></button>
                                </div>
                                
                                <div className="absolute top-2 left-2 bg-slate-800 px-2 py-1 rounded text-xs font-mono text-slate-300 border border-slate-700">
                                    Pos {String(index + 1).padStart(3, '0')}
                                </div>
                                <div className="absolute bottom-2 right-2 bg-blue-900 px-2 py-1 rounded text-xs font-mono text-blue-200 border border-blue-700">
                                    x{unit.quantity || 1}
                                </div>
                                <div className="absolute top-2 right-2 bg-slate-800/80 px-2 py-1 rounded text-[10px] text-slate-300 border border-slate-600 flex items-center gap-1 backdrop-blur-sm">
                                    <Thermometer size={10} /> {stats.uw.toFixed(2)}
                                </div>
                            </div>
                            <div className="p-4">
                                <h3 className="font-semibold text-white mb-1">{unit.name}</h3>
                                <div className="text-xs text-slate-400 space-y-1">
                                    <p>{unit.width}mm x {unit.height}mm</p>
                                    <p>{systems.find(s => s.id === unit.system)?.name || 'Unknown System'}</p>
                                    <div className="flex justify-between items-center mt-2">
                                         <p className="font-medium text-emerald-400">${(stats.cost * (unit.quantity || 1)).toFixed(2)}</p>
                                         {stats.accessoriesCost > 0 && <span className="text-[10px] bg-slate-700 text-slate-300 px-1 rounded flex gap-1 items-center"><Package size={10}/> Acc</span>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Optimization Report (Screen) */}
            <OptimizationReport units={project.units} systems={systems} lang={lang} />

            {/* Quote Generation Section */}
            <div className="border-t border-slate-700 pt-8">
                {/* ... (Kept existing quote generation section same) ... */}
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <FileText size={20} className="text-blue-400" /> 
                    {t(lang, 'quoteGen')}
                </h2>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2">
                         <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                            <div className="flex justify-between items-center mb-4">
                                <label className="text-sm font-medium text-slate-300">{t(lang, 'coverLetter')}</label>
                                <button 
                                    onClick={handleGeneratePitch}
                                    disabled={isGenerating || project.units.length === 0}
                                    className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Bot size={14} /> 
                                    {isGenerating ? t(lang, 'drafting') : t(lang, 'draftGemini')}
                                </button>
                            </div>
                            <textarea 
                                className="w-full h-48 bg-slate-900 border border-slate-600 rounded p-4 text-sm text-slate-300 leading-relaxed focus:border-blue-500 outline-none resize-none"
                                placeholder={t(lang, 'draftPlaceholder')}
                                value={quoteIntro}
                                onChange={(e) => setQuoteIntro(e.target.value)}
                            ></textarea>
                         </div>
                    </div>
                    
                    <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 h-fit">
                        <h3 className="font-semibold text-white mb-4">{t(lang, 'summary')}</h3>
                        <div className="space-y-2 text-sm text-slate-400 mb-6">
                            <div className="flex justify-between"><span>{t(lang, 'positions')}:</span> <span className="text-slate-200">{project.units.length}</span></div>
                            <div className="flex justify-between"><span>{t(lang, 'totalArea')}:</span> <span className="text-slate-200">{(project.units.reduce((acc, u) => acc + (u.width * u.height), 0) / 1000000).toFixed(2)} m²</span></div>
                            <div className="flex justify-between"><span>{t(lang, 'avgUValue')}:</span> <span className="text-slate-200">{projectAvgUw.toFixed(2)} {t(lang, 'wMk')}</span></div>
                            <div className="flex justify-between border-t border-slate-700 pt-2 mt-2 font-bold text-white">
                                <span>{t(lang, 'total')}:</span> 
                                <span>${calculateTotal(project.units).toFixed(2)}</span>
                            </div>
                        </div>
                        <button 
                            onClick={handlePrint}
                            disabled={isPrinting}
                            className="w-full bg-slate-700 hover:bg-slate-600 text-white py-2 rounded flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-wait"
                        >
                            {isPrinting ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />} 
                            {isPrinting ? t(lang, 'preparingPdf') : t(lang, 'exportPdf')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>

    {/* PRINT VIEW */}
    <div id="print-view">
        <div className="max-w-[210mm] mx-auto py-8 text-black">
            <header className="border-b-2 border-slate-300 pb-6 mb-8 flex justify-between items-start">
                <Logo theme="light" className="w-16 h-16" />
                <div className="text-right">
                    <h2 className="text-2xl font-light text-slate-700">{t(lang, 'printQuote')}</h2>
                    <p className="text-slate-500 text-sm mt-1">{new Date().toLocaleDateString()}</p>
                </div>
            </header>

            <section className="mb-8 flex justify-between p-6 rounded bg-slate-50 border border-slate-200">
                <div>
                    <h3 className="text-xs font-bold uppercase text-slate-400 mb-1">Client</h3>
                    <p className="font-semibold text-xl text-slate-900">{project.client}</p>
                </div>
                <div className="text-right">
                    <h3 className="text-xs font-bold uppercase text-slate-400 mb-1">Project</h3>
                    <p className="font-semibold text-xl text-slate-900">{project.name}</p>
                    <p className="text-sm text-slate-600">{project.status}</p>
                </div>
            </section>

            {quoteIntro && (
                <section className="mb-10">
                    <h3 className="text-sm font-bold uppercase text-slate-400 mb-2 border-b border-slate-200 pb-1">Executive Summary</h3>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 italic">{quoteIntro}</p>
                </section>
            )}

            <div className="space-y-8">
                {project.units.map((unit, idx) => {
                    const stats = getUnitStats(unit);
                    const system = systems.find(s => s.id === unit.system);
                    
                    return (
                        <div key={unit.id} className="avoid-break border border-slate-200 rounded-lg p-6 flex flex-row gap-8 shadow-sm bg-white">
                            {/* Visual (Left) */}
                            <div className="w-1/3 flex flex-col justify-center items-center border-r border-slate-100 pr-6">
                                <div className="w-full aspect-square max-h-[250px] flex items-center justify-center mb-2 bg-slate-50 rounded p-4">
                                     <svg viewBox={`0 0 ${unit.width} ${unit.height}`} className="w-full h-full">
                                        <Visualizer 
                                            node={unit.rootNode}
                                            width={unit.width}
                                            height={unit.height}
                                            system={system || systems[0]}
                                            selectedNodeId={null}
                                            onSelectNode={() => {}}
                                        />
                                    </svg>
                                </div>
                                <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mt-2">{t(lang, 'technicalDrawing')}</p>
                            </div>

                            {/* Details (Right) */}
                            <div className="flex-1 flex flex-col justify-between">
                                <div>
                                    <div className="flex justify-between items-start mb-6 border-b border-slate-100 pb-3">
                                        <h3 className="font-bold text-xl text-slate-800">
                                            <span className="text-slate-400 mr-2 text-base font-normal">Pos {String(idx + 1).padStart(2, '0')}</span> 
                                            {unit.name}
                                        </h3>
                                        <div className="text-right">
                                            <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">{t(lang, 'totalPrice')}</div>
                                            <div className="font-bold text-xl text-slate-900">${(stats.cost * (unit.quantity || 1)).toFixed(2)}</div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-y-3 text-sm">
                                        <div>
                                            <div className="text-slate-400 text-xs uppercase">{t(lang, 'dimensions')}</div>
                                            <div className="font-semibold text-slate-700">{unit.width}mm x {unit.height}mm</div>
                                        </div>
                                        <div>
                                            <div className="text-slate-400 text-xs uppercase">{t(lang, 'area')}</div>
                                            <div className="font-semibold text-slate-700">{stats.totalAreaM2.toFixed(2)} m²</div>
                                        </div>
                                        <div>
                                            <div className="text-slate-400 text-xs uppercase">{t(lang, 'quantity')}</div>
                                            <div className="font-semibold text-slate-700">x{unit.quantity || 1}</div>
                                        </div>
                                        <div>
                                            <div className="text-slate-400 text-xs uppercase">{t(lang, 'uValue')}</div>
                                            <div className="font-semibold text-slate-700">{stats.uw.toFixed(2)} {t(lang, 'wMk')}</div>
                                        </div>
                                        <div>
                                            <div className="text-slate-400 text-xs uppercase">{t(lang, 'profileSystem')}</div>
                                            <div className="font-semibold text-slate-700">{system?.name}</div>
                                        </div>
                                        <div>
                                            <div className="text-slate-400 text-xs uppercase">{t(lang, 'glazing')}</div>
                                            <div className="font-semibold text-slate-700">{stats.glassName}</div>
                                        </div>
                                    </div>
                                    
                                    {/* Accessory Breakdown */}
                                    {stats.accessoryList.length > 0 && (
                                        <div className="mt-4 bg-slate-50 p-3 rounded border border-slate-100">
                                            <div className="text-xs font-bold text-slate-500 uppercase mb-2">{t(lang, 'accessories')}</div>
                                            {stats.accessoryList.map((acc, i) => (
                                                <div key={i} className="flex justify-between text-xs text-slate-600 mb-1">
                                                    <span>{acc.name} (x{acc.count} {acc.unit})</span>
                                                    <span>${acc.price.toFixed(2)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                </div>
                                
                                <div className="pt-4 mt-4 border-t border-dashed border-slate-200 flex justify-between text-sm text-slate-600">
                                     <span>{t(lang, 'unitPrice')}:</span>
                                     <span className="font-mono text-black font-bold">${stats.cost.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="mt-12 border-t-2 border-slate-300 pt-6 avoid-break">
               <h2 className="text-2xl font-light text-slate-700 mb-6">{t(lang, 'optimizationReport')}</h2>
               <OptimizationReport units={project.units} systems={systems} lang={lang} />
            </div>

            <div className="mt-12 border-t-2 border-slate-300 pt-6 avoid-break">
                <div className="flex justify-end items-end gap-12">
                     <div className="text-right">
                        <p className="text-sm font-bold uppercase text-slate-400 mb-1">{t(lang, 'avgUValue')}</p>
                        <p className="text-xl font-bold text-slate-700">
                            {projectAvgUw.toFixed(2)} {t(lang, 'wMk')}
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-sm font-bold uppercase text-slate-400 mb-1">{t(lang, 'totalArea')}</p>
                        <p className="text-xl font-bold text-slate-700">
                            {(project.units.reduce((acc, u) => acc + ((u.width * u.height * (u.quantity || 1))), 0) / 1000000).toFixed(2)} m²
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-sm font-bold uppercase text-slate-400 mb-1">{t(lang, 'totalPrice')}</p>
                        <p className="text-4xl font-bold text-slate-900">${calculateTotal(project.units).toFixed(2)}</p>
                    </div>
                </div>
            </div>

            <footer className="mt-16 pt-8 border-t border-slate-200 avoid-break">
                <div className="flex justify-between items-end mb-8">
                     <div className="w-1/3">
                        <div className="border-b border-black h-12 mb-2"></div>
                        <p className="text-xs uppercase font-bold text-slate-500">{t(lang, 'date')}</p>
                     </div>
                     <div className="w-1/3">
                        <div className="border-b border-black h-12 mb-2"></div>
                        <p className="text-xs uppercase font-bold text-slate-500">{t(lang, 'signature')}</p>
                     </div>
                </div>
                <div className="text-center text-xs text-slate-400">
                    <p>Generated by Alumetric - Window & Door Engineering Suite</p>
                    <p>{new Date().getFullYear()} © Alumetric Inc.</p>
                </div>
            </footer>
        </div>
    </div>
    </>
  );
};

export default ProjectView;