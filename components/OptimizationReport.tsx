import React, { useMemo } from 'react';
import { Unit, ProfileSystem, Language } from '../types';
import { calculateProjectOptimization } from '../services/optimizationService';
import { t } from '../translations';
import { LayoutGrid } from 'lucide-react';

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
      <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
        <LayoutGrid size={20} className="text-blue-500" />
        {t(lang, 'materialOptimization')}
      </h2>

      <div className="grid grid-cols-1 gap-6">
        {optimization.map((opt) => (
          <div key={opt.systemId} className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm avoid-break">
            
            {/* Header */}
            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 border-b border-slate-200 dark:border-slate-700 flex flex-wrap justify-between items-center gap-4">
              <div>
                <h3 className="font-bold text-lg text-slate-800 dark:text-white">{opt.systemName}</h3>
                <p className="text-xs text-slate-500 flex items-center gap-1">
                   {t(lang, 'barLength')}: {(opt.barLength / 1000).toFixed(1)}m
                </p>
              </div>
              
              <div className="flex gap-4 sm:gap-8">
                 <div className="text-center">
                    <div className="text-xs text-slate-500 uppercase font-bold">{t(lang, 'totalBars')}</div>
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 flex items-baseline justify-center gap-1">
                        {opt.totalBars} <span className="text-xs font-normal text-slate-500">{t(lang, 'bars')}</span>
                    </div>
                 </div>
                 <div className="text-center">
                    <div className="text-xs text-slate-500 uppercase font-bold">{t(lang, 'efficiency')}</div>
                    <div className="text-xl font-semibold text-emerald-600 dark:text-emerald-400">
                        {opt.totalEfficiency.toFixed(1)}%
                    </div>
                 </div>
                 <div className="text-center">
                    <div className="text-xs text-slate-500 uppercase font-bold">{t(lang, 'waste')}</div>
                    <div className="text-xl font-semibold text-red-500 dark:text-red-400">
                        {opt.totalWaste.toFixed(1)}%
                    </div>
                 </div>
              </div>
            </div>

            {/* Bars Visualization / List */}
            <div className="p-4 space-y-3">
               <div className="text-xs text-slate-400 mb-2 flex justify-between">
                  <span>{t(lang, 'cuttingList')} ({opt.totalCutCount} {t(lang, 'positions').toLowerCase()})</span>
                  <span className="italic">5mm blade waste included</span>
               </div>
               
               {/* Show first 5 bars detailed, collapse rest for brevity if many */}
               {opt.bars.map((bar, idx) => (
                 <div key={idx} className="flex items-center gap-3 text-xs">
                    <div className="w-16 font-mono text-slate-500 shrink-0">Bar #{idx + 1}</div>
                    
                    {/* Visual Bar Representation */}
                    <div className="flex-1 h-6 bg-slate-200 dark:bg-slate-700 rounded-sm relative overflow-hidden flex">
                        {bar.cuts.map((cut, cIdx) => {
                            const percent = (cut / opt.barLength) * 100;
                            return (
                                <div 
                                    key={cIdx}
                                    style={{ width: `${percent}%` }}
                                    className="h-full bg-blue-500 dark:bg-blue-600 border-r border-white dark:border-slate-800 hover:bg-blue-400 transition-colors flex items-center justify-center text-[9px] text-white overflow-hidden whitespace-nowrap"
                                    title={`${cut}mm`}
                                >
                                    {cut}
                                </div>
                            );
                        })}
                        {/* Remaining Waste */}
                        <div className="flex-1 bg-stripes-red opacity-30"></div>
                    </div>
                    
                    <div className="w-24 text-right font-mono text-slate-600 dark:text-slate-400 shrink-0">
                        {bar.remaining > 0 ? `Rem: ${bar.remaining}mm` : 'Full'}
                    </div>
                 </div>
               ))}
            </div>
          </div>
        ))}
      </div>
      
      <style>{`
        .bg-stripes-red {
            background-image: linear-gradient(45deg, #ef4444 25%, transparent 25%, transparent 50%, #ef4444 50%, #ef4444 75%, transparent 75%, transparent);
            background-size: 10px 10px;
        }
      `}</style>
    </div>
  );
};

export default OptimizationReport;