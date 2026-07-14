import React from 'react';
import { Language } from '../types';
import { 
  ArrowLeft, 
  ExternalLink, 
  ShieldCheck, 
  FileText, 
  CheckCircle2, 
  Layers, 
  BookmarkCheck,
  Scale,
  Zap,
  HelpCircle
} from 'lucide-react';
import Logo from './Logo';

interface GlassAnalysisProps {
  lang: Language;
  onBack: () => void;
  theme: 'light' | 'dark';
}

export const GlassAnalysis: React.FC<GlassAnalysisProps> = ({ lang, onBack, theme }) => {
  const isTr = lang === 'tr';
  const isDark = theme === 'dark';

  return (
    <div className={`min-h-screen flex flex-col font-sans selection:bg-teal-500 selection:text-white transition-colors duration-200 ${
      isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
    }`}>
      {/* Upper Navigation Header */}
      <header className={`border-b sticky top-0 z-50 transition-colors duration-200 ${
        isDark ? 'border-white/5 bg-slate-950/80 backdrop-blur-md' : 'border-slate-200 bg-white/85 backdrop-blur-md'
      }`}>
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={onBack}
              className={`p-2.5 rounded-xl transition-all border flex items-center justify-center group ${
                isDark 
                  ? 'bg-slate-900 hover:bg-slate-850 hover:text-white text-slate-400 border-white/5' 
                  : 'bg-slate-100 hover:bg-slate-200 hover:text-slate-900 text-slate-600 border-slate-200'
              }`}
            >
              <ArrowLeft size={18} className="group-hover:-translate-x-0.5 transition-transform" />
            </button>
            <div className={`h-6 w-px ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />
            <div className="flex items-center gap-3">
              <Logo className="w-8 h-8" />
              <span className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-full font-black uppercase tracking-widest">
                GLASSTOOL PORTAL
              </span>
            </div>
          </div>
          
          <button 
            onClick={onBack}
            className={`text-xs font-bold transition-colors ${
              isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {isTr ? 'Panoya Dön' : 'Back to Dashboard'}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-5xl mx-auto px-6 py-12 w-full space-y-12">
        
        {/* Hero Section */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <h1 className={`text-3xl md:text-4xl font-black tracking-tight leading-tight ${
            isDark ? 'text-white' : 'text-slate-900'
          }`}>
            {isTr ? 'Şişecam GlassTool™ Entegrasyonu' : 'Şişecam GlassTool™ Integration'}
          </h1>
        </div>

        {/* Central Hub Card */}
        <div className={`rounded-3xl p-8 md:p-10 shadow-2xl relative overflow-hidden group border transition-all duration-200 ${
          isDark 
            ? 'bg-gradient-to-b from-slate-900 to-slate-950 border-white/5' 
            : 'bg-white border-slate-200'
        }`}>
          <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
          
          <div className="relative z-10 space-y-8">
            <div className={`flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-8 border-b ${
              isDark ? 'border-white/5' : 'border-slate-100'
            }`}>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-teal-400 animate-pulse" />
                  <span className="text-[10px] text-teal-500 font-black tracking-widest uppercase">
                    {isTr ? 'Sertifikalı ve Resmi Sonuçlar' : 'Certified & Official Results'}
                  </span>
                </div>
                <h2 className={`text-xl md:text-2xl font-black tracking-tight ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}>
                  {isTr ? 'Şişecam GlassTool Hesaplayıcı' : 'Şişecam GlassTool Calculator'}
                </h2>
              </div>
              
              <a 
                href={isTr ? "https://glasstool.sisecam.com/tr/HomePage.aspx" : "https://glasstool.sisecam.com/"}
                target="_blank" 
                rel="noopener noreferrer"
                className="w-full md:w-auto px-8 py-4 bg-teal-600 hover:bg-teal-500 text-white font-black rounded-2xl text-xs flex items-center justify-center gap-3 transition-all shadow-lg shadow-teal-600/15 hover:-translate-y-0.5"
              >
                <ExternalLink size={15} strokeWidth={2.5} />
                {isTr ? 'GlassTool\'u Yeni Sekmede Aç' : 'Launch GlassTool in New Tab'}
              </a>
            </div>

            {/* Strategic Value Proposition */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Point 1 */}
              <div className={`p-6 rounded-2xl space-y-3 border transition-all duration-200 ${
                isDark ? 'bg-slate-950/50 border-white/5' : 'bg-slate-50 border-slate-200/60'
              }`}>
                <div className="h-10 w-10 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-500 flex items-center justify-center">
                  <Scale size={20} />
                </div>
                <h3 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {isTr ? 'Mühendislik Sorumluluğu' : 'Liability & Legal Safety'}
                </h3>
                <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  {isTr 
                    ? 'Camın statik ve termal yalıtım hesapları Şişecam websitesinde yapılır.' 
                    : 'Static and thermal insulation calculations of the glass are carried out on the Şişecam website.'}
                </p>
              </div>

              {/* Point 2 */}
              <div className={`p-6 rounded-2xl space-y-3 border transition-all duration-200 ${
                isDark ? 'bg-slate-950/50 border-white/5' : 'bg-slate-50 border-slate-200/60'
              }`}>
                <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 flex items-center justify-center">
                  <ShieldCheck size={20} />
                </div>
                <h3 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {isTr ? 'Akredite Sertifikasyon' : 'Accredited Performance'}
                </h3>
                <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  {isTr 
                    ? 'Şişecam GlassTool EN 410 ve EN 673 Avrupa standartlarına uygun, CE beyanlarında doğrudan kullanılabilir teknik beyannameler üretir.' 
                    : 'The tool delivers EN 410 and EN 673 European standard declarations, instantly acceptable for municipal approvals and building inspects.'}
                </p>
              </div>

              {/* Point 3 */}
              <div className={`p-6 rounded-2xl space-y-3 border transition-all duration-200 ${
                isDark ? 'bg-slate-950/50 border-white/5' : 'bg-slate-50 border-slate-200/60'
              }`}>
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center">
                  <BookmarkCheck size={20} />
                </div>
                <h3 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {isTr ? 'Güncel Cam Kataloğu' : 'Real-time Catalog'}
                </h3>
                <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  {isTr 
                    ? 'Isıcam Sinerji, Isıcam Konfor, Temperli, Lamine ve Akustik camların tüm güncel kalınlık ve kombinasyon verileri doğrudan fabrikadan alınır.' 
                    : 'Instant access to official datasets for Sinerji, Konfor, acoustic laminates, and tempered structures without stale local database approximations.'}
                </p>
              </div>

            </div>
          </div>
        </div>

        {/* Step-by-Step Instructions */}
        <div className="space-y-6">
          <div className="flex items-center gap-2.5">
            <HelpCircle size={20} className={isDark ? 'text-slate-400' : 'text-slate-500'} />
            <h2 className={`text-lg font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {isTr ? 'Alumetric ile Birlikte Nasıl Kullanılır?' : 'Workflow: How to configure with Alumetric?'}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Step 1 */}
            <div className={`rounded-2xl p-6 relative space-y-4 border transition-all duration-200 ${
              isDark ? 'bg-slate-900/40 border-white/5' : 'bg-white border-slate-200'
            }`}>
              <span className={`absolute top-4 right-4 text-3xl font-black ${
                isDark ? 'text-slate-800/40' : 'text-slate-100'
              }`}>01</span>
              <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold text-xs border border-blue-500/20">
                1
              </div>
              <div className="space-y-1.5">
                <h4 className={`font-bold text-xs uppercase tracking-wider ${
                  isDark ? 'text-slate-200' : 'text-slate-800'
                }`}>
                  {isTr ? 'Kombinasyonu Seçin' : 'Select Combination'}
                </h4>
                <p className={`text-[11px] leading-relaxed ${
                  isDark ? 'text-slate-400' : 'text-slate-600'
                }`}>
                  {isTr 
                    ? 'Şişecam GlassTool uygulamasını açarak projenize uygun cam katmanlarını (örneğin: 6mm Konfor + 16HB + 4+4 Lamine) yapılandırın.' 
                    : 'Open the GlassTool and stack your custom glasses (e.g., 6mm Konfor + 16mm Spacer with Argon + 4+4 Laminated glass).'}
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className={`rounded-2xl p-6 relative space-y-4 border transition-all duration-200 ${
              isDark ? 'bg-slate-900/40 border-white/5' : 'bg-white border-slate-200'
            }`}>
              <span className={`absolute top-4 right-4 text-3xl font-black ${
                isDark ? 'text-slate-800/40' : 'text-slate-100'
              }`}>02</span>
              <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold text-xs border border-blue-500/20">
                2
              </div>
              <div className="space-y-1.5">
                <h4 className={`font-bold text-xs uppercase tracking-wider ${
                  isDark ? 'text-slate-200' : 'text-slate-800'
                }`}>
                  {isTr ? 'Değerleri Hesaplatın' : 'Calculate values'}
                </h4>
                <p className={`text-[11px] leading-relaxed ${
                  isDark ? 'text-slate-400' : 'text-slate-600'
                }`}>
                  {isTr 
                    ? 'Uygulamada "Hesapla" butonuna basarak Ug (ısı iletkenliği), LT (ışık geçirgenliği) ve g (güneş faktörü) resmi değerlerini saniyeler içinde alın.' 
                    : 'Press compute inside GlassTool to instantly get the officially certified Ug value, Light Transmission (LT), and solar g-value.'}
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className={`rounded-2xl p-6 relative space-y-4 border transition-all duration-200 ${
              isDark ? 'bg-slate-900/40 border-white/5' : 'bg-white border-slate-200'
            }`}>
              <span className={`absolute top-4 right-4 text-3xl font-black ${
                isDark ? 'text-slate-800/40' : 'text-slate-100'
              }`}>03</span>
              <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold text-xs border border-blue-500/20">
                3
              </div>
              <div className="space-y-1.5">
                <h4 className={`font-bold text-xs uppercase tracking-wider ${
                  isDark ? 'text-slate-200' : 'text-slate-800'
                }`}>
                  {isTr ? 'Teklife Not Düşün' : 'Append to quotation'}
                </h4>
                <p className={`text-[11px] leading-relaxed ${
                  isDark ? 'text-slate-400' : 'text-slate-600'
                }`}>
                  {isTr 
                    ? 'Alınan resmi değerleri veya hesaplanan rapor PDF bağlantısını Alumetric teklifindeki "Poz Özel Notu" veya "Proje Notu" kısmına ekleyin.' 
                    : 'Copy the certified specifications or attach the calculated report link directly into your Alumetric position notes or project descriptions.'}
                </p>
              </div>
            </div>

          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className={`border-t py-6 text-center text-xs transition-colors duration-200 ${
        isDark ? 'border-white/5 bg-slate-950 text-slate-600' : 'border-slate-200 bg-white text-slate-500'
      }`}>
        <p>© {new Date().getFullYear()} Alumetric GlassTool™ Portal. All Rights Reserved.</p>
      </footer>
    </div>
  );
};
