import React from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { WifiOff, Database, ShieldCheck } from 'lucide-react';
import { Language } from '../types';

interface OfflineIndicatorProps {
  lang?: Language;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({ lang = 'tr' }) => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2.5 rounded-2xl bg-amber-600/95 text-white px-4 py-2.5 shadow-2xl backdrop-blur-md border border-amber-400/30 text-xs animate-in slide-in-from-bottom-3">
      <div className="p-1 rounded-lg bg-black/20 text-white">
        <WifiOff size={16} />
      </div>
      <div>
        <div className="font-bold flex items-center gap-1.5">
          <span>{lang === 'tr' ? 'Çevrimdışı Mod Aktif' : 'Offline Mode Active'}</span>
          <span className="h-2 w-2 rounded-full bg-emerald-300 animate-pulse" />
        </div>
        <p className="text-[11px] text-amber-100 opacity-90">
          {lang === 'tr'
            ? 'İnternet bağlantısı yok. Yerel veriler (IndexedDB) ve bağımsız CAD motoru çalışıyor.'
            : 'No internet connection. Cached data and CAD offline engine are running.'}
        </p>
      </div>
    </div>
  );
};
