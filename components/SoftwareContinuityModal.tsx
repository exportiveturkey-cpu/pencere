import React, { useState } from 'react';
import { ShieldCheck, HardDrive, Cpu, FileCode2, Copy, Check, ExternalLink, X, HeartHandshake, Lock } from 'lucide-react';
import { Language } from '../types';

interface SoftwareContinuityModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang?: Language;
}

export const SoftwareContinuityModal: React.FC<SoftwareContinuityModalProps> = ({
  isOpen,
  onClose,
  lang = 'tr'
}) => {
  const [copiedEscrowClause, setCopiedEscrowClause] = useState(false);

  if (!isOpen) return null;

  const escrowClauseSample = `MADDE 14 - YAZILIM SÜREKLİLİĞİ VE ESCROW (KAYNAK KOD EMANETİ) GÜVENCESİ:
14.1. Alumetric lisans vereninin herhangi bir nedenle faaliyetlerini durdurması, vefatı veya sunucu erişiminin 60 (altmış) gün kesintisiz sağlanamaması durumunda;
14.2. Yazılımın en güncel derlenmiş kaynak kodları ve bağımsız kurulum paketleri, Lisans Alan firmaya (Asaş / Kurtoğlu) koşulsuz olarak teslim edilir.
14.3. Yazılım PWA (Progressive Web App) mimarisinde olup, uzak sunucuya bağımlı olmaksızın yerel donanımda ömür boyu çalışabilme garantisine sahiptir.`;

  const copyClause = () => {
    navigator.clipboard.writeText(escrowClauseSample);
    setCopiedEscrowClause(true);
    setTimeout(() => setCopiedEscrowClause(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
      <div className="w-full max-w-2xl rounded-3xl bg-slate-900 border border-slate-700 p-6 sm:p-8 shadow-2xl text-white max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <ShieldCheck size={26} />
            </div>
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                {lang === 'tr' ? 'Kurumsal Yazılım Güvencesi & Escrow Modeli' : 'Software Continuity & Escrow Model'}
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  B2B Standardı
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                {lang === 'tr'
                  ? 'Asaş ve Kurtoğlu gibi kurumsal üreticilere sunabileceğiniz süreklilik ve bağımsızlık güvencesi.'
                  : 'Enterprise continuity and independent runtime guarantee for tier-1 manufacturers.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* 4 Pillars of Continuity */}
        <div className="mt-6 space-y-4 text-xs">
          {/* Pillar 1: PWA Offline */}
          <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 flex gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
              <Cpu size={18} />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-white text-sm">
                1. Çevrimdışı Çalışma & Masaüstü Bağımsızlığı (PWA)
              </h3>
              <p className="text-slate-300 leading-relaxed text-[11px]">
                Yazılım tek bir tıkla masaüstüne yüklenir. İnternet hattı kopsa, sunucu kapansa dahi tarayıcı önbelleği (Service Worker & Cache API) sayesinde CAD çizim motoru, profil optimizasyonu ve kesim föyü üretimi bilgisayarda çalışmaya devam eder.
              </p>
            </div>
          </div>

          {/* Pillar 2: Local Data Ownership */}
          <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 flex gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
              <HardDrive size={18} />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-white text-sm">
                2. %100 Yerel Veri Mülkiyeti (IndexedDB & Export)
              </h3>
              <p className="text-slate-300 leading-relaxed text-[11px]">
                Müşterinin çizdiği tüm pozlar, fiyatlar ve teklifler müşterinin kendi tarayıcısında ve yerel diskinde saklanır. Müşteri istediği an tek tuşla tüm projelerini JSON, DXF veya PDF yedeği olarak dışa aktarabilir. Veri kaybı riski sıfırdır.
              </p>
            </div>
          </div>

          {/* Pillar 3: Multi-tenant Brand Privacy */}
          <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 flex gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <Lock size={18} />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-white text-sm">
                3. Marka İzolasyonu (Tenant Privacy)
              </h3>
              <p className="text-slate-300 leading-relaxed text-[11px]">
                Kurtoğlu bayisi giriş yaptığında yalnızca Kurtoğlu profillerini; Asaş bayisi girdiğinde yalnızca Asaş Rescara profillerini görür. Kod tabanınız tek merkezde güncellenirken müşteriler birbirlerinin ticari kataloglarını asla göremez.
              </p>
            </div>
          </div>

          {/* Pillar 4: Software Escrow Agreement */}
          <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 flex gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <HeartHandshake size={18} />
            </div>
            <div className="space-y-2 flex-1">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-white text-sm">
                  4. Sözleşmeli Yazılım Emaneti (Escrow Protokolü)
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  Kurumsal Güvence
                </span>
              </div>
              <p className="text-emerald-100/90 leading-relaxed text-[11px]">
                Büyük kurumsal müşterilerle sözleşme yaparken "Vefat veya 60 gün sunucu kesintisi halinde kodlar teslim edilir" maddesi eklenir. Bu madde müşterinin kafasındaki tüm şüpheleri kaldırır:
              </p>
              
              {/* Sample Escrow Clause Box */}
              <div className="mt-2 p-3 rounded-xl bg-slate-950/90 border border-slate-700 font-mono text-[10px] text-slate-300 space-y-2 relative">
                <pre className="whitespace-pre-wrap leading-normal font-sans text-[11px]">
                  {escrowClauseSample}
                </pre>
                <div className="pt-2 flex justify-end">
                  <button
                    onClick={copyClause}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-sans text-xs font-semibold transition"
                  >
                    {copiedEscrowClause ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    {copiedEscrowClause ? 'Madde Kopyalandı!' : 'Sözleşme Maddesini Kopyala'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-slate-800 flex justify-between items-center text-xs">
          <span className="text-slate-400">
            Alumetric Software Architecture • Enterprise Grade
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition shadow-lg"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
};
