import React, { useState, useRef, useEffect } from 'react';
import { BrandTenantId, Language } from '../types';
import { BRAND_TENANTS } from '../constants';
import { Building2, ChevronDown, Check, ShieldCheck, Copy, ExternalLink, Sparkles } from 'lucide-react';
import { SoftwareContinuityModal } from './SoftwareContinuityModal';

interface BrandTenantSelectorProps {
  currentBrand: BrandTenantId;
  onBrandChange: (brand: BrandTenantId) => void;
  lang?: Language;
}

export const BrandTenantSelector: React.FC<BrandTenantSelectorProps> = ({
  currentBrand,
  onBrandChange,
  lang = 'tr'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showEscrowModal, setShowEscrowModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeTenant = BRAND_TENANTS[currentBrand] || BRAND_TENANTS.all;

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (brandId: BrandTenantId) => {
    onBrandChange(brandId);
    setIsOpen(false);

    // Update URL query parameter seamlessly without reload
    try {
      const url = new URL(window.location.href);
      if (brandId === 'all') {
        url.searchParams.delete('brand');
      } else {
        url.searchParams.set('brand', brandId);
      }
      window.history.replaceState({}, '', url.toString());
    } catch (e) {
      // Ignore URL errors in strict iframe environments
    }
  };

  const copyBrandShareLink = (brandId: BrandTenantId) => {
    try {
      const url = new URL(window.location.href);
      if (brandId === 'all') {
        url.searchParams.delete('brand');
      } else {
        url.searchParams.set('brand', brandId);
      }
      navigator.clipboard.writeText(url.toString());
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch (e) {
      // fallback
    }
  };

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        {/* Trigger Button in Header */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-sm ${
            activeTenant.id === 'kurtoglu'
              ? 'bg-blue-950/60 text-blue-300 border-blue-500/40 hover:bg-blue-900/50'
              : activeTenant.id === 'asas'
              ? 'bg-red-950/60 text-red-300 border-red-500/40 hover:bg-red-900/50'
              : activeTenant.id === 'pimapen'
              ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40 hover:bg-emerald-900/50'
              : 'bg-slate-800/90 text-slate-200 border-slate-700 hover:bg-slate-700/80'
          }`}
          title={lang === 'tr' ? 'Marka / Bayi Kataloğunu Değiştir' : 'Switch Brand / Tenant Catalog'}
        >
          <Building2 size={14} className={activeTenant.id === 'asas' ? 'text-red-400' : 'text-blue-400'} />
          <span className="truncate max-w-[140px] sm:max-w-[180px]">
            {activeTenant.name}
          </span>
          <ChevronDown size={14} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-slate-900/95 border border-slate-700 shadow-2xl backdrop-blur-xl p-3 z-50 animate-in fade-in slide-in-from-top-2 text-white">
            <div className="px-3 py-2 border-b border-slate-800 mb-2 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {lang === 'tr' ? 'Kurumsal Marka & Bayi Modu' : 'Enterprise Multi-Tenant Mode'}
                </div>
                <div className="text-xs font-bold text-white">
                  {lang === 'tr' ? 'İzole Profil & Katalog Seçimi' : 'Isolated Brand Catalog'}
                </div>
              </div>
              <button
                onClick={() => {
                  setIsOpen(false);
                  setShowEscrowModal(true);
                }}
                className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 transition"
              >
                <ShieldCheck size={12} />
                <span>Yazılım Güvencesi</span>
              </button>
            </div>

            {/* Brand Options List */}
            <div className="space-y-1.5">
              {(Object.keys(BRAND_TENANTS) as BrandTenantId[]).map((brandKey) => {
                const tenant = BRAND_TENANTS[brandKey];
                const isSelected = tenant.id === currentBrand;

                return (
                  <div
                    key={tenant.id}
                    className={`rounded-xl p-2.5 transition-all border ${
                      isSelected
                        ? 'bg-slate-800 border-blue-500/50 shadow-md'
                        : 'bg-slate-900/40 border-slate-800/80 hover:bg-slate-800/60 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => handleSelect(tenant.id)}
                        className="flex-1 text-left flex items-center gap-2.5"
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: tenant.brandColor }}
                        />
                        <div>
                          <div className="text-xs font-bold text-white flex items-center gap-1.5">
                            {tenant.name}
                            {isSelected && (
                              <Check size={14} className="text-emerald-400" />
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {tenant.tagline}
                          </div>
                        </div>
                      </button>

                      {/* Copy specific link button */}
                      <button
                        onClick={() => copyBrandShareLink(tenant.id)}
                        title={lang === 'tr' ? 'Bu markaya özel doğrudan linki kopyala' : 'Copy direct link for this brand'}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition shrink-0 ml-2"
                      >
                        <Copy size={13} />
                      </button>
                    </div>

                    {/* Subdomain Hint */}
                    <div className="mt-1.5 pt-1.5 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-500">
                      <span className="font-mono text-slate-400">{tenant.domainHint}</span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                        {tenant.id === 'all' ? 'Tüm Seriler' : `${tenant.systemPrefixes[0]?.toUpperCase()} Serileri`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quick Share Link Confirmation Banner */}
            {copiedLink && (
              <div className="mt-2.5 p-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[11px] font-semibold text-center animate-in fade-in">
                ✓ Markaya özel doğrudan erişim linki panoya kopyalandı!
              </div>
            )}

            <div className="mt-2.5 p-2 rounded-xl bg-slate-950 border border-slate-800/80 text-[10px] text-slate-400 leading-normal">
              💡 <strong>Nasıl Çalışır?</strong> Kurtoğlu veya Asaş'a bu linki gönderdiğinizde, müşteri sadece kendi profil serilerini görür. Tek bir kod tabanı üzerinden tüm müşteriler anında güncellenir.
            </div>
          </div>
        )}
      </div>

      {/* Software Continuity & Escrow Modal */}
      <SoftwareContinuityModal
        isOpen={showEscrowModal}
        onClose={() => setShowEscrowModal(false)}
        lang={lang}
      />
    </>
  );
};
