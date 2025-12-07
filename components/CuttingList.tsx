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
    <div className="mt-8 mb-8">
      <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
        <Scissors size={20} className="text-orange-500" />
        {t(lang, 'cuttingList')}
      </h2>

      <div className="space-y-8">
        {Object.keys(aggregatedList).map((systemName) => (
          <div key={systemName} className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm avoid-break">
             <div className="bg-slate-50 dark:bg-slate-900/50 p-3 border-b border-slate-200 dark:border-slate-700">
                <h3 className="font-bold text-md text-slate-800 dark:text-white">{systemName}</h3>
             </div>
             
             <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                        <th className="px-6 py-3">{t(lang, 'profileType')}</th>
                        <th className="px-6 py-3 text-right">{t(lang, 'length')}</th>
                        <th className="px-6 py-3 text-right">{t(lang, 'quantity')}</th>
                        <th className="px-6 py-3 text-right">{t(lang, 'totalLength')}</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {aggregatedList[systemName].map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                            <td className="px-6 py-3 font-medium text-slate-700 dark:text-slate-200">
                                {t(lang, item.label as any) || item.label}
                            </td>
                            <td className="px-6 py-3 text-right font-mono text-slate-600 dark:text-slate-300">
                                {item.length} mm
                            </td>
                            <td className="px-6 py-3 text-right font-bold text-blue-600 dark:text-blue-400">
                                {item.quantity}
                            </td>
                             <td className="px-6 py-3 text-right font-mono text-slate-500">
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