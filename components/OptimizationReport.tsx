
import React, { useMemo } from 'react';
import { Unit, ProfileSystem, Language } from '../types';
import { calculateProjectOptimization } from '../services/optimizationService';
import { t } from '../translations';
import { LayoutGrid, Tag } from 'lucide-react';

interface OptimizationReportProps {
  units: Unit[];
  systems: ProfileSystem[];
  lang: Language;
}

const OptimizationReport: React.FC<OptimizationReportProps> = ({ units, systems, lang }) => {
  const optimization = useMemo(() => calculateProjectOptimization(units, systems), [units, systems]);

  if (units.length === 0) return null;

  return (
    <div className="mt-8 mb-8">
      <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2 print:text-black">
        <LayoutGrid size={22} className="text-blue-400" />
        {t(lang, 'materialOptimization')}
      </h2>

      <div className="grid grid-cols-1 gap-8">
        {optimization.map((opt, mainIdx) => (
          <div key={`${opt.systemId}-${opt.profileCode}-${mainIdx}`} className="bg-slate-800 border border-slate-700 rounded-3xl overflow-hidden shadow-2xl avoid-break print:bg-white print:border-slate-200">
            
            {/* Header with Profile Info */}
            <div className="bg-slate-900/90 p-6 border-b border-slate-700 flex flex-wrap justify-between items-center gap-4 print:bg-slate-50 print:border-slate-200">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-400">
                    <Tag size={24} />
                </div>
                <div>
                    <h3 className="font-black text-lg text-white print:text-black uppercase tracking-tight">
                        {t(lang, opt.profileLabel as any) || opt.profileLabel}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs bg-slate-950 px-2 py-0.5 rounded font-mono text-emerald-400 border border-white/5">{opt.profileCode}</span>
                        <span className="text-xs text-slate-400 font-bold">• {opt.systemName}</span>
                    </div>
                </div>
              </div>
              
              <div className="flex gap-6 sm:gap-10">
                 <div className="text-center">
                    <div className="text-[10px] text-white uppercase font-black tracking-widest mb-1 opacity-60 print:text-slate-500">{t(lang, 'totalBars')}</div>
                    <div className="text-2xl font-black text-blue-300 flex items-baseline justify-center gap-1 print:text-blue-600">
                        {opt.totalBars} <span className="text-xs font-bold text-slate-400 print:text-slate-500">{t(lang, 'bars')}</span>
                    </div>
                 </div>
                 <div className="text-center">
                    <div className="text-[10px] text-white uppercase font-black tracking-widest mb-1 opacity-60 print:text-slate-500">{t(lang, 'efficiency')}</div>
                    <div className="text-2xl font-black text-emerald-400 print:text-emerald-600">
                        {opt.totalEfficiency.toFixed(1)}%
                    </div>
                 </div>
                 <div className="text-center">
                    <div className="text-[10px] text-white uppercase font-black tracking-widest mb-1 opacity-60 print:text-slate-500">{t(lang, 'waste')}</div>
                    <div className="text-2xl font-black text-red-400 print:text-red-600">
                        {opt.totalWaste.toFixed(1)}%
                    </div>
                 </div>
              </div>
            </div>

            {/* Bars Visualization / List */}
            <div className="p-8 space-y-6">
               <div className="text-xs text-white mb-2 flex justify-between font-bold print:text-slate-800 border-b border-white/5 pb-4">
                  <span className="uppercase tracking-widest flex items-center gap-2">
                      <LayoutGrid size={14} className="text-blue-400" />
                      {t(lang, 'optimizationReport')} ({opt.totalCutCount} {t(lang, 'totalCuts').toLowerCase()})
                  </span>
                  <span className="opacity-60 italic font-medium">Bar Length: {(opt.barLength / 1000).toFixed(1)}m | 5mm Blade Kerf</span>
               </div>
               
               {opt.bars.map((bar, idx) => (
                 <div key={idx} className="flex items-center gap-6 text-xs group">
                    <div className="w-24 shrink-0">
                        <div className="font-mono text-white font-black uppercase tracking-tighter text-sm print:text-slate-900">
                            {t(lang, opt.profileLabel as any).split(' ')[0]} #{idx + 1}
                        </div>
                    </div>
                    
                    {/* Visual Bar Representation */}
                    <div className="flex-1 h-10 bg-slate-950 rounded-xl relative overflow-hidden flex border border-slate-700 shadow-2xl print:bg-slate-100 print:border-slate-300">
                        {bar.cuts.map((cut, cIdx) => {
                            const percent = (cut / opt.barLength) * 100;
                            return (
                                <div 
                                    key={cIdx}
                                    style={{ width: `${percent}%` }}
                                    className="h-full bg-blue-600 border-r border-white/20 hover:bg-blue-500 transition-all flex items-center justify-center text-[11px] text-white font-black overflow-hidden whitespace-nowrap shadow-inner"
                                    title={`${cut}mm`}
                                >
                                    {cut}
                                </div>
                            );
                        })}
                        {/* Remaining Waste */}
                        <div className="flex-1 bg-stripes-red opacity-30"></div>
                    </div>
                    
                    <div className="w-32 text-right font-mono text-white shrink-0 font-black text-sm print:text-slate-900 group-hover:text-blue-400 transition-colors">
                        {bar.remaining > 0 ? `Rem: ${bar.remaining}mm` : 'FULL'}
                    </div>
                 </div>
               ))}
            </div>
          </div>
        ))}
      </div>
      
      <style>{`
        .bg-stripes-red {
            background-image: linear-gradient(45deg, #fca5a5 25%, transparent 25%, transparent 50%, #fca5a5 50%, #fca5a5 75%, transparent 75%, transparent);
            background-size: 10px 10px;
        }
      `}</style>
    </div>
  );
};

export default OptimizationReport;
