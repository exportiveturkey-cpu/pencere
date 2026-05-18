
import React, { useMemo } from 'react';
import { Unit, ProfileSystem, Language } from '../types';
import { getAggregatedCuttingList } from '../services/optimizationService';
import { t } from '../translations';
import { Scissors } from 'lucide-react';

interface CuttingListProps {
  units: Unit[];
  systems: ProfileSystem[];
  lang: Language;
}

const CuttingList: React.FC<CuttingListProps> = ({ units, systems, lang }) => {
  const aggregatedList = useMemo(() => getAggregatedCuttingList(units, systems), [units, systems]);

  if (units.length === 0) return null;

  return (
    <div className="mt-12 mb-12">
      <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2 print:text-black">
        <Scissors size={22} className="text-orange-400" />
        {t(lang, 'cuttingList')}
      </h2>

      <div className="space-y-10">
        {Object.keys(aggregatedList).map((systemName) => (
          <div key={systemName} className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-xl avoid-break print:bg-white print:border-slate-200">
             <div className="bg-slate-900/80 p-4 border-b border-slate-700 print:bg-slate-50 print:border-slate-200">
                <h3 className="font-black text-md text-white uppercase tracking-widest print:text-slate-900">{systemName}</h3>
             </div>
             
             <table className="w-full text-sm text-left border-collapse">
                <thead className="text-[11px] text-white uppercase bg-slate-950 border-b border-slate-700 print:bg-slate-100 print:text-slate-700 print:border-slate-300">
                    <tr>
                        <th className="px-8 py-4 font-black tracking-widest">{t(lang, 'profileType')}</th>
                        <th className="px-8 py-4 font-black tracking-widest">{t(lang, 'profileCode')}</th>
                        <th className="px-8 py-4 text-right font-black tracking-widest">{t(lang, 'length')}</th>
                        <th className="px-8 py-4 text-right font-black tracking-widest">{t(lang, 'quantity')}</th>
                        <th className="px-8 py-4 text-right font-black tracking-widest">{t(lang, 'totalLength')}</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-700 print:divide-slate-200">
                    {aggregatedList[systemName].map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-700/50 transition-colors">
                            <td className="px-8 py-4 font-bold text-white text-base print:text-slate-900">
                                {t(lang, item.label as any) || item.label}
                            </td>
                            <td className="px-8 py-4 font-mono text-xs text-emerald-400 font-black bg-emerald-500/10 print:bg-emerald-50 print:text-emerald-700">
                                {item.profileCode || '-'}
                            </td>
                            <td className="px-8 py-4 text-right font-mono text-white font-black text-base print:text-slate-900">
                                {item.length} mm
                            </td>
                            <td className="px-8 py-4 text-right font-black text-blue-300 text-lg print:text-blue-600">
                                {item.quantity}
                            </td>
                             <td className="px-8 py-4 text-right font-mono text-slate-300 font-bold text-base print:text-slate-600">
                                {((item.length * item.quantity) / 1000).toFixed(2)} m
                            </td>
                        </tr>
                    ))}
                </tbody>
             </table>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CuttingList;
