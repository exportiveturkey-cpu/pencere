import React, { useState, useRef } from 'react';
import { Language, Project, GlassToolReport } from '../types';
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
  HelpCircle,
  Upload,
  Plus,
  Trash2,
  Eye,
  Download,
  Sparkles,
  ArrowRight,
  FileCheck
} from 'lucide-react';
import Logo from './Logo';
import { createDefaultGlassToolReport } from '../services/glassToolService';

interface GlassAnalysisProps {
  lang: Language;
  onBack: () => void;
  theme: 'light' | 'dark';
  projects?: Project[];
  activeProjectId?: string;
  onUpdateProject?: (project: Project) => void;
  onSelectProject?: (projectId: string) => void;
}

export const GlassAnalysis: React.FC<GlassAnalysisProps> = ({ 
  lang, 
  onBack, 
  theme,
  projects = [],
  activeProjectId,
  onUpdateProject,
  onSelectProject
}) => {
  const isTr = lang === 'tr';
  const isDark = theme === 'dark';

  const [selectedProjectId, setSelectedProjectId] = useState<string>(() => {
    return activeProjectId || (projects[0]?.id || '');
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const currentProject = projects.find(p => p.id === selectedProjectId) || projects[0];
  const reports: GlassToolReport[] = currentProject?.glassToolReports || [];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!currentProject || !onUpdateProject) return;
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isImage = file.type.startsWith('image/');

    if (!isPdf && !isImage) {
      alert(isTr ? 'Lütfen sadece PDF veya Resim formatında Şişecam GlassTool raporu yükleyiniz.' : 'Please upload only PDF or Image GlassTool reports.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const newReport: GlassToolReport = {
        id: `glasstool-${Date.now()}`,
        name: file.name,
        fileData: dataUrl,
        fileType: isPdf ? 'pdf' : 'image',
        fileSize: file.size,
        uploadedAt: new Date().toISOString().split('T')[0],
        glassCombination: isTr 
          ? '6 mm Isıcam Konfor + 16 mm HB (%90 Argon) + 4+4.2 Lamine Cam' 
          : '6 mm Isıcam Konfor + 16 mm Cavity (90% Argon) + 4+4.2 Laminated',
        ugValue: 1.10,
        lightTransmission: 71,
        solarFactor: 43,
        soundReductionRw: 36,
        totalThicknessMm: 30.2,
        spacerGas: '16 mm HB (%90 Argon)',
        standards: 'TS EN 410 / TS EN 673 CE Uygunluk Beyanı',
        notes: isTr 
          ? 'Şişecam GlassTool uygulamasından alınan resmi performans ve statik yalıtım raporudur.' 
          : 'Official certified performance and thermal insulation report calculated via Şişecam GlassTool.',
        includeInQuotePrint: true
      };

      const updated = [...(currentProject.glassToolReports || []), newReport];
      onUpdateProject({
        ...currentProject,
        glassToolReports: updated
      });

      setToastMessage(isTr ? `"${file.name}" seçilen projeye başarıyla eklendi!` : `"${file.name}" attached to selected project!`);
      setTimeout(() => setToastMessage(null), 4000);
    };

    reader.readAsDataURL(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAddSampleReport = () => {
    if (!currentProject || !onUpdateProject) return;
    const sample = createDefaultGlassToolReport(currentProject);
    const updated = [...(currentProject.glassToolReports || []), sample];
    onUpdateProject({
      ...currentProject,
      glassToolReports: updated
    });
    setToastMessage(isTr ? 'Örnek Şişecam GlassTool raporu projeye eklendi!' : 'Sample GlassTool report attached!');
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleDeleteReport = (reportId: string) => {
    if (!currentProject || !onUpdateProject) return;
    const updated = (currentProject.glassToolReports || []).filter(r => r.id !== reportId);
    onUpdateProject({
      ...currentProject,
      glassToolReports: updated
    });
  };

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
              <span className="text-[10px] bg-teal-500/10 text-teal-400 border border-teal-500/20 px-2 py-0.5 rounded-full font-black uppercase tracking-widest">
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
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'} max-w-2xl mx-auto`}>
            {isTr 
              ? 'Şişecam resmi web hesaplayıcısından aldığınız onaylı PDF performans raporunu tekliflerinize ek belge (Annex) olarak ekleyin.' 
              : 'Calculate accredited glass performance in GlassTool and attach official PDF reports directly into your customer quotations.'}
          </p>
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

        {/* Direct Project Attachment Section */}
        {projects.length > 0 && (
          <div className={`rounded-3xl p-8 border shadow-xl transition-all duration-200 ${
            isDark ? 'bg-slate-900/60 border-teal-500/30' : 'bg-white border-teal-500/40'
          }`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-700/40">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-teal-500/10 text-teal-400 border border-teal-500/20 rounded-2xl">
                  <FileCheck size={22} />
                </div>
                <div>
                  <h3 className={`text-base font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {isTr ? 'Teklif Ekine Şişecam GlassTool™ PDF Raporu Ekle' : 'Attach GlassTool PDF Report to Proposal'}
                  </h3>
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    {isTr 
                      ? 'Raporu seçtiğiniz projenin teklifine ekleyin. Teklif çıktısında resmi ek sayfa olarak yer alır.' 
                      : 'Attach official PDF report to any proposal to include it in print and client sheets.'}
                  </p>
                </div>
              </div>

              {/* Project selector dropdown */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400">{isTr ? 'Proje:' : 'Project:'}</span>
                <select
                  value={currentProject?.id || ''}
                  onChange={e => setSelectedProjectId(e.target.value)}
                  className={`text-xs font-bold rounded-xl px-3 py-2 border outline-none ${
                    isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                >
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.client})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Toast notice */}
            {toastMessage && (
              <div className="mt-4 p-3 bg-teal-500/15 border border-teal-500/30 rounded-xl flex items-center gap-2 text-teal-300 text-xs font-bold animate-in fade-in">
                <CheckCircle2 size={16} />
                <span>{toastMessage}</span>
              </div>
            )}

            {/* Upload actions and attached report status */}
            <div className="mt-6 flex flex-col md:flex-row items-center justify-between gap-4 bg-teal-500/5 p-4 rounded-2xl border border-teal-500/10">
              <div className="flex items-center gap-3">
                <FileText size={20} className="text-teal-400" />
                <div>
                  <div className={`text-xs font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                    {currentProject?.name} &bull; {reports.length} {isTr ? 'GlassTool Raporu Ekli' : 'Report(s) Attached'}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {reports.length > 0 
                      ? (isTr ? `Son eklenen: ${reports[reports.length - 1].name}` : `Latest: ${reports[reports.length - 1].name}`)
                      : (isTr ? 'Henüz bu projeye GlassTool raporu yüklenmemiş.' : 'No GlassTool report uploaded yet.')}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,application/pdf,image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow"
                >
                  <Upload size={14} />
                  <span>{isTr ? 'PDF Raporu Yükle' : 'Upload PDF Report'}</span>
                </button>

                {reports.length === 0 && (
                  <button
                    onClick={handleAddSampleReport}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-500/30 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                  >
                    <Sparkles size={13} />
                    <span>{isTr ? 'Örnek Rapor' : 'Sample'}</span>
                  </button>
                )}

                {onSelectProject && currentProject && (
                  <button
                    onClick={() => onSelectProject(currentProject.id)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                  >
                    <span>{isTr ? 'Teklifi Aç' : 'Open Proposal'}</span>
                    <ArrowRight size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Reports list cards */}
            {reports.length > 0 && (
              <div className="mt-4 space-y-2">
                {reports.map(rep => (
                  <div 
                    key={rep.id}
                    className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs ${
                      isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText size={16} className="text-teal-400 shrink-0" />
                      <span className="font-bold truncate text-slate-200">{rep.name}</span>
                      <span className="text-[10px] text-teal-400 font-mono">Ug: {rep.ugValue || 1.1} W/m²K</span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <a
                        href={rep.fileData}
                        download={rep.name}
                        className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                        title={isTr ? 'İndir' : 'Download'}
                      >
                        <Download size={14} />
                      </a>
                      <button
                        onClick={() => handleDeleteReport(rep.id)}
                        className="p-1.5 text-rose-400 hover:text-rose-300 rounded-lg hover:bg-rose-500/10 transition"
                        title={isTr ? 'Sil' : 'Delete'}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

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
              <div className="h-8 w-8 rounded-lg bg-teal-500/10 text-teal-500 flex items-center justify-center font-bold text-xs border border-teal-500/20">
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
              <div className="h-8 w-8 rounded-lg bg-teal-500/10 text-teal-500 flex items-center justify-center font-bold text-xs border border-teal-500/20">
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
                    ? 'Uygulamada "Hesapla" butonuna basarak Ug (ısı iletkenliği), LT (ışık geçirgenliği) ve g (güneş faktörü) resmi değerlerini saniyeler içinde alın ve "Rapor Al (PDF)" ile indirin.' 
                    : 'Press compute inside GlassTool to instantly get the officially certified Ug value, Light Transmission (LT), and solar g-value and download PDF report.'}
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
              <div className="h-8 w-8 rounded-lg bg-teal-500/10 text-teal-500 flex items-center justify-center font-bold text-xs border border-teal-500/20">
                3
              </div>
              <div className="space-y-1.5">
                <h4 className={`font-bold text-xs uppercase tracking-wider ${
                  isDark ? 'text-slate-200' : 'text-slate-800'
                }`}>
                  {isTr ? 'Teklifin Ekine PDF Olarak Koyun' : 'Attach PDF to Proposal'}
                </h4>
                <p className={`text-[11px] leading-relaxed ${
                  isDark ? 'text-slate-400' : 'text-slate-600'
                }`}>
                  {isTr 
                    ? 'İndirdiğiniz resmi PDF raporunu doğrudan teklifinize yükleyin. Teklif çıktısında ve müşteri onay ekranında resmi EN 410 / EN 673 CE eki (Annex) olarak yer alır.' 
                    : 'Upload the downloaded PDF report directly into your Alumetric quotation. It will be printed as an accredited technical annex to the proposal.'}
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
