import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Smartphone, Monitor, CheckCircle, X, Share } from 'lucide-react';
import { Language } from '../types';

interface PWAInstallButtonProps {
  lang?: Language;
  variant?: 'header' | 'compact' | 'card';
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  lang = 'tr',
  variant = 'header',
  className = ''
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [justInstalled, setJustInstalled] = useState(false);

  // If already running as an installed PWA (standalone window), display a small badge or hide
  if (isInstalled) {
    if (variant === 'card') {
      return (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
          <CheckCircle size={14} />
          <span>{lang === 'tr' ? 'Masaüstü PWA Kurulu (Çevrimdışı Aktif)' : 'Desktop PWA Installed (Offline Active)'}</span>
        </div>
      );
    }
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      const success = await install();
      if (success) {
        setJustInstalled(true);
        setTimeout(() => setJustInstalled(false), 4000);
      }
    } else if (isIOS) {
      setShowIOSGuide(true);
    } else {
      // In browsers where beforeinstallprompt hasn't fired yet, show quick guidance
      setShowIOSGuide(true);
    }
  };

  return (
    <>
      <button
        onClick={handleInstallClick}
        title={lang === 'tr' ? 'Masaüstüne / Tablete İndir (İnternetsiz Bağımsız Çalışır)' : 'Install to Desktop / Tablet (Works Offline)'}
        className={`group relative flex items-center gap-2 rounded-xl transition-all font-semibold active:scale-95 shadow-md ${
          variant === 'header'
            ? 'px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs border border-blue-400/30 shadow-blue-500/20'
            : variant === 'compact'
            ? 'p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs border border-slate-700'
            : 'px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm border border-blue-400/30'
        } ${className}`}
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-300"></span>
        </span>
        <Download size={14} className="group-hover:translate-y-0.5 transition-transform" />
        <span className="font-bold tracking-tight">
          {lang === 'tr' ? 'Masaüstüne İndir' : 'Install App'}
        </span>
      </button>

      {/* Guided Modal for iOS / Browser Manual Install */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-6 shadow-2xl text-white">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                  <Monitor size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {lang === 'tr' ? 'Alumetric’i Bilgisayara / Cihaza İndirin' : 'Install Alumetric App'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {lang === 'tr' ? 'Tarayıcı bağımsız, internetsiz çevrimdışı çalışır' : 'Works offline without internet'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs text-slate-300 leading-relaxed">
              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 space-y-2">
                <div className="font-bold text-white flex items-center gap-2">
                  <Monitor size={14} className="text-blue-400" />
                  {lang === 'tr' ? 'Masaüstü (Chrome / Edge / Brave):' : 'Desktop (Chrome / Edge):'}
                </div>
                <p className="text-[11px] text-slate-300">
                  {lang === 'tr'
                    ? 'Adres çubuğunun sağ tarafındaki (veya menüdeki) "Uygulama Olarak Yükle / Install App" simgesine tıklayın.'
                    : 'Click the "Install App" icon located in the right side of the address bar.'}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 space-y-2">
                <div className="font-bold text-white flex items-center gap-2">
                  <Share size={14} className="text-emerald-400" />
                  {lang === 'tr' ? 'iPhone / iPad (Safari):' : 'iPhone / iPad (Safari):'}
                </div>
                <p className="text-[11px] text-slate-300">
                  1. Safari alt çubuğundaki <strong>Paylaş (Share)</strong> düğmesine basın.<br />
                  2. Listeyi aşağı kaydırıp <strong>"Ana Ekrana Ekle (Add to Home Screen)"</strong> seçin.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px] flex items-start gap-2">
                <CheckCircle size={16} className="shrink-0 mt-0.5" />
                <span>
                  {lang === 'tr'
                    ? 'Yüklendiğinde masaüstünüzde bağımsız pencerede açılır; internetiniz kesilse bile tüm pozlar, camlar ve çizim motoru çalışmaya devam eder.'
                    : 'Once installed, opens in a standalone native window and works seamlessly offline.'}
                </span>
              </div>
            </div>

            <button
              onClick={() => setShowIOSGuide(false)}
              className="mt-5 w-full rounded-xl bg-blue-600 hover:bg-blue-500 py-2.5 text-xs font-bold text-white shadow-lg transition-all"
            >
              {lang === 'tr' ? 'Anladım' : 'Got it'}
            </button>
          </div>
        </div>
      )}
    </>
  );
};
