
import React, { useState, useMemo } from 'react';
import { Project, Language, ProfileSystem, Accessory, Customer } from '../types';
import { Plus, Settings, User, Search, MoreVertical, Calendar, X, Save, Edit2, Sparkles, Trash2, Cpu, FileCheck, FileText, LayoutGrid, TrendingUp, DollarSign, Package, Users, UserX, UserCheck, Phone, Mail, Ban, AlertOctagon, MapPin } from 'lucide-react';
import { t } from '../translations';
import Logo from './Logo';
import { getSessionInfo } from '../services/authService';
import { calculateProjectCost } from '../services/priceCalculator';
import { v4 as uuidv4 } from 'uuid';

interface DashboardProps {
  projects: Project[];
  systems: ProfileSystem[];
  accessories: Accessory[];
  customers?: Customer[];
  onAddCustomer?: (cust: Customer) => void;
  onUpdateCustomer?: (cust: Customer) => void;
  onDeleteCustomer?: (id: string) => void;
  lang: Language;
  setLang: (lang: Language) => void;
  onCreateProject: () => void;
  onSelectProject: (id: string) => void;
  onUpdateProject: (project: Project) => void;
  onDeleteProject: (id: string) => void;
  onOpenSettings: () => void;
  forcedName?: string;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  projects, 
  systems,
  accessories,
  customers = [],
  onAddCustomer,
  onUpdateCustomer,
  onDeleteCustomer,
  lang, 
  setLang, 
  onCreateProject, 
  onSelectProject, 
  onUpdateProject,
  onDeleteProject,
  onOpenSettings, 
  forcedName 
}) => {
  const [activeTab, setActiveTab] = useState<'projects' | 'customers'>('projects');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [showMenuId, setShowMenuId] = useState<string | null>(null);
  const [chartMode, setChartMode] = useState<'value' | 'count'>('value');
  
  // Customer states
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [showCustomerMenuId, setShowCustomerMenuId] = useState<string | null>(null);
  const [blockError, setBlockError] = useState<string | null>(null);
  
  const toggleLang = () => setLang(lang === 'en' ? 'tr' : 'en');
  const session = getSessionInfo();
  const displayName = forcedName || session.companyName;

  const stats = useMemo(() => {
    let totalCount = projects.length;
    let totalValue = 0;
    
    let draftCount = 0;
    let draftValue = 0;
    
    let productionCount = 0;
    let productionValue = 0;
    
    let completedCount = 0;
    let completedValue = 0;
    
    projects.forEach(project => {
      const costReport = calculateProjectCost(project, systems || [], accessories || []);
      const val = costReport.grandTotal;
      totalValue += val;
      
      const st = project.status || 'Draft';
      if (st === 'Draft') {
        draftCount++;
        draftValue += val;
      } else if (st === 'Production') {
        productionCount++;
        productionValue += val;
      } else if (st === 'Completed') {
        completedCount++;
        completedValue += val;
      }
    });
    
    const approvedCount = productionCount + completedCount;
    const approvedValue = productionValue + completedValue;
    
    const conversionRateQty = totalCount > 0 ? Math.round((approvedCount / totalCount) * 100) : 0;
    const conversionRateVal = totalValue > 0 ? Math.round((approvedValue / totalValue) * 100) : 0;
    
    return {
      totalCount,
      totalValue,
      draftCount,
      draftValue,
      productionCount,
      productionValue,
      completedCount,
      completedValue,
      approvedCount,
      approvedValue,
      conversionRateQty,
      conversionRateVal
    };
  }, [projects, systems, accessories]);

  const chartData = useMemo(() => {
    const total = chartMode === 'value' ? stats.totalValue : stats.totalCount;
    const draft = chartMode === 'value' ? stats.draftValue : stats.draftCount;
    const prod = chartMode === 'value' ? stats.productionValue : stats.productionCount;
    const comp = chartMode === 'value' ? stats.completedValue : stats.completedCount;

    if (total === 0) return { draftPct: 0, prodPct: 0, compPct: 0, totalStr: '0', draft, prod, comp };

    const draftPct = draft / total;
    const prodPct = prod / total;
    const compPct = comp / total;

    const totalStr = chartMode === 'value' 
      ? `$${total.toLocaleString(undefined, { maximumFractionDigits: 0 })}` 
      : `${total} ${lang === 'tr' ? 'Proje' : 'Projects'}`;

    return { draftPct, prodPct, compPct, totalStr, draft, prod, comp };
  }, [stats, chartMode, lang]);

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.client.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredCustomers = useMemo(() => {
    return customers.filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (c.company && c.company.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (c.phone && c.phone.includes(searchTerm)) ||
      (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [customers, searchTerm]);

  const getCustomerStats = (customer: Customer) => {
    const nameLower = customer.name.trim().toLowerCase();
    const compLower = customer.company ? customer.company.trim().toLowerCase() : '';
    
    const clientProjects = projects.filter(p => {
      const pClient = p.client.trim().toLowerCase();
      return pClient === nameLower || (compLower && pClient === compLower);
    });
    
    const totalCount = clientProjects.length;
    let totalValue = 0;
    let approvedCount = 0;
    
    clientProjects.forEach(p => {
      const report = calculateProjectCost(p, systems, accessories);
      totalValue += report.grandTotal;
      if (p.status === 'Production' || p.status === 'Completed') {
        approvedCount++;
      }
    });
    
    const conversionRate = totalCount > 0 ? Math.round((approvedCount / totalCount) * 100) : 0;
    
    return {
      totalCount,
      totalValue,
      approvedCount,
      conversionRate
    };
  };

  const getStatusLabel = (status: Project['status']) => {
    switch(status) {
      case 'Draft': return t(lang, 'statusDraft');
      case 'Production': return t(lang, 'statusProd');
      case 'Completed': return t(lang, 'statusComp');
      default: return status;
    }
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProject) {
      onUpdateProject(editingProject);
      setEditingProject(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <div className="border-b border-white/5 bg-slate-900/40 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-3 flex justify-between items-center">
            <div className="flex items-center gap-3">
                <Logo className="w-8 h-8" />
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full animate-pulse-slow">
                    <Sparkles size={10} className="text-emerald-500" />
                    <span className="text-[9px] font-black text-emerald-500 tracking-tighter uppercase">{t(lang, 'version')} {t(lang, 'softwareUpdated')}</span>
                </div>
            </div>
            
            <div className="flex items-center gap-6">
                <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-slate-800/50 rounded-full border border-white/5 text-xs">
                    <User size={14} className="text-blue-400" />
                    <span className="text-slate-300 font-medium">{displayName}</span>
                    <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded text-[10px] uppercase font-bold tracking-tighter">
                      {session.plan}
                    </span>
                </div>
                
                <div className="flex items-center gap-4">
                    <button onClick={onOpenSettings} className="p-2 text-slate-400 hover:text-white transition-colors">
                        <Settings size={20} />
                    </button>
                    <button onClick={toggleLang} className="text-xs font-bold text-slate-500 hover:text-blue-400 transition-colors border border-slate-800 px-2 py-1 rounded">
                        {lang.toUpperCase()}
                    </button>
                </div>
            </div>
        </div>
      </div>

      <div className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div>
                <h1 className="text-4xl font-extrabold text-white tracking-tight mb-2">{t(lang, 'projects')}</h1>
                <p className="text-slate-400 max-w-md">{t(lang, 'manageEstimations')}</p>
            </div>
            <button onClick={onCreateProject} className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-xl flex items-center justify-center gap-3 font-bold transition-all shadow-2xl shadow-blue-900/20 hover:-translate-y-0.5">
                <Plus size={22} strokeWidth={3} /> {t(lang, 'newProject')}
            </button>
        </div>

        {/* Main Analytics Hub - Bento style */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          {/* Left panel (2 cols): Summary cards & Conversion rate */}
          <div className="lg:col-span-2 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Card 1: Total Projects Value */}
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 flex items-start gap-4 shadow-lg hover:border-slate-700/50 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0 border border-blue-500/10">
                  <LayoutGrid size={20} />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider block mb-1">
                    {lang === 'tr' ? 'TOPLAM PORTFÖY' : 'TOTAL PORTFOLIO'}
                  </span>
                  <span className="text-2xl font-black text-white block tracking-tight">
                    ${stats.totalValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </span>
                  <span className="text-slate-400 text-xs font-semibold mt-1 block">
                    {lang === 'tr' ? `${stats.totalCount} Etkin Proje` : `${stats.totalCount} Active Projects`}
                  </span>
                </div>
              </div>

              {/* Card 2: Draft / Quotes */}
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 flex items-start gap-4 shadow-lg hover:border-slate-700/50 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0 border border-amber-500/10">
                  <FileText size={20} />
                </div>
                <div>
                  <span className="text-[10px] text-amber-500/70 font-extrabold uppercase tracking-wider block mb-1">
                    {lang === 'tr' ? 'TASLAK & TEKLİFLER' : 'DRAFTS & QUOTES'}
                  </span>
                  <span className="text-2xl font-black text-white block tracking-tight">
                    ${stats.draftValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </span>
                  <span className="text-slate-400 text-xs font-semibold mt-1 block">
                    {lang === 'tr' ? `${stats.draftCount} Açık Teklif` : `${stats.draftCount} Open Quotes`}
                  </span>
                </div>
              </div>

              {/* Card 3: In Production */}
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 flex items-start gap-4 shadow-lg hover:border-slate-700/50 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 shrink-0 border border-indigo-500/10">
                  <Cpu size={20} />
                </div>
                <div>
                  <span className="text-[10px] text-indigo-400 font-extrabold uppercase tracking-wider block mb-1">
                    {lang === 'tr' ? 'AKTİF ÜRETİMDE' : 'IN PRODUCTION'}
                  </span>
                  <span className="text-2xl font-black text-white block tracking-tight">
                    ${stats.productionValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </span>
                  <span className="text-slate-400 text-xs font-semibold mt-1 block">
                    {lang === 'tr' ? `${stats.productionCount} Fabrikada` : `${stats.productionCount} at Factory`}
                  </span>
                </div>
              </div>

              {/* Card 4: Completed */}
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 flex items-start gap-4 shadow-lg hover:border-slate-700/50 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0 border border-emerald-500/10">
                  <FileCheck size={20} />
                </div>
                <div>
                  <span className="text-[10px] text-emerald-400 font-extrabold uppercase tracking-wider block mb-1">
                    {lang === 'tr' ? 'TAMAMLANANLAR' : 'COMPLETED'}
                  </span>
                  <span className="text-2xl font-black text-white block tracking-tight">
                    ${stats.completedValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </span>
                  <span className="text-slate-400 text-xs font-semibold mt-1 block">
                    {lang === 'tr' ? `${stats.completedCount} Arşivlenen` : `${stats.completedCount} Archived`}
                  </span>
                </div>
              </div>
            </div>

            {/* Conversion & Approval Analytics Progress Strip */}
            {stats.totalCount > 0 && (
              <div className="bg-slate-900/30 border border-slate-800/60 rounded-3xl p-6 shadow-inner flex flex-col md:flex-row items-center justify-between gap-8">
                <div className="flex flex-col max-w-xs shrink-0">
                  <span className="text-xs font-extrabold text-blue-400 tracking-wider uppercase mb-1 flex items-center gap-1.5">
                    <TrendingUp size={14} />
                    {lang === 'tr' ? 'ONAY VE DÖNÜŞÜM ANALİZİ' : 'CONVERSION & APPROVAL ANALYSIS'}
                  </span>
                  <p className="text-[11px] text-slate-400 leading-relaxed font-semibold">
                    {lang === 'tr' 
                      ? 'Taslak halindeki tekliflerin onaylanıp aktif üretime geçme veya tamamlanma performansını ölçümler.' 
                      : 'Displays the proportion of draft estimations successfully approved and moved into active manufacturing.'}
                  </p>
                </div>

                <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Adet dönüşüm barı */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-400 text-[11px]">{lang === 'tr' ? 'Onay Oranı (Adet Bazlı)' : 'Approval Rate (Count)'}</span>
                      <span className="text-emerald-400">%{stats.conversionRateQty}</span>
                    </div>
                    <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800 p-[1px]">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 rounded-full transition-all duration-500" 
                        style={{ width: `${stats.conversionRateQty}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-slate-500 font-semibold flex justify-between">
                      <span>{lang === 'tr' ? `${stats.approvedCount} Onaylı` : `${stats.approvedCount} Approved`}</span>
                      <span>{lang === 'tr' ? `${stats.totalCount} Toplam` : `${stats.totalCount} Total`}</span>
                    </div>
                  </div>

                  {/* Tutar dönüşüm barı */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-400 text-[11px]">{lang === 'tr' ? 'Ciro Onay Oranı (Bütçe Bazlı)' : 'Approval Rate (Value)'}</span>
                      <span className="text-emerald-400">%{stats.conversionRateVal}</span>
                    </div>
                    <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800 p-[1px]">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 rounded-full transition-all duration-500" 
                        style={{ width: `${stats.conversionRateVal}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-slate-500 font-semibold flex justify-between">
                      <span>${stats.approvedValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} {lang === 'tr' ? 'Onaylı' : 'Approved'}</span>
                      <span>${stats.totalValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} {lang === 'tr' ? 'Toplam' : 'Total'}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right panel (1 col): Beautiful charts widget */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800/80">
                <span className="text-[11px] font-black text-slate-400 tracking-widest uppercase">
                  {lang === 'tr' ? 'STATÜ DAĞILIMI' : 'STATUS DISTRIBUTION'}
                </span>
                
                <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 gap-1">
                  <button
                    onClick={() => setChartMode('value')}
                    className={`px-2.5 py-1 rounded-lg text-[9px] font-extrabold transition-all duration-200 ${chartMode === 'value' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                  >
                    $
                  </button>
                  <button
                    onClick={() => setChartMode('count')}
                    className={`px-2.5 py-1 rounded-lg text-[9px] font-extrabold transition-all duration-200 ${chartMode === 'count' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                  >
                    QTY
                  </button>
                </div>
              </div>

              {stats.totalCount === 0 ? (
                <div className="h-44 flex flex-col items-center justify-center text-center">
                  <Package className="text-slate-700 mb-2" size={32} />
                  <span className="text-xs text-slate-500 font-semibold">{lang === 'tr' ? 'Veri bulunmuyor' : 'No statistics available yet'}</span>
                </div>
              ) : (
                <div className="relative w-40 h-40 mx-auto mt-4 flex items-center justify-center">
                  <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                    {/* Background Track */}
                    <circle cx="50" cy="50" r="36" fill="transparent" stroke="#0b0f19" strokeWidth="11" />
                    
                    {/* Draft Segment */}
                    {chartData.draftPct > 0 && (
                      <circle
                        cx="50" cy="50" r="36" fill="transparent"
                        stroke="#f59e0b" strokeWidth="11"
                        strokeDasharray={`${226.2 * chartData.draftPct} ${226.2 * (1 - chartData.draftPct)}`}
                        strokeDashoffset={0}
                        className="transition-all duration-700"
                        strokeLinecap="round"
                      />
                    )}
                    
                    {/* Production Segment */}
                    {chartData.prodPct > 0 && (
                      <circle
                        cx="50" cy="50" r="36" fill="transparent"
                        stroke="#6366f1" strokeWidth="11"
                        strokeDasharray={`${226.2 * chartData.prodPct} ${226.2 * (1 - chartData.prodPct)}`}
                        strokeDashoffset={-(226.2 * chartData.draftPct)}
                        className="transition-all duration-700"
                        strokeLinecap="round"
                      />
                    )}

                    {/* Completed Segment */}
                    {chartData.compPct > 0 && (
                      <circle
                        cx="50" cy="50" r="36" fill="transparent"
                        stroke="#10b981" strokeWidth="11"
                        strokeDasharray={`${226.2 * chartData.compPct} ${226.2 * (1 - chartData.compPct)}`}
                        strokeDashoffset={-(226.2 * (chartData.draftPct + chartData.prodPct))}
                        className="transition-all duration-700"
                        strokeLinecap="round"
                      />
                    )}
                  </svg>
                  
                  {/* Center Labels */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 select-none">
                    <span className="text-[9px] text-slate-500 font-extrabold uppercase tracking-widest leading-none">
                      {chartMode === 'value' ? (lang === 'tr' ? 'TOPLAM BÜTÇE' : 'TOTAL VALUE') : (lang === 'tr' ? 'TOPLAM PROJE' : 'TOTAL PROJECT')}
                    </span>
                    <span className="text-sm font-black text-white shrink-0 tracking-tighter mt-1 break-all max-w-[110px]">
                      {chartData.totalStr}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {stats.totalCount > 0 && (
              <div className="space-y-4 pt-4 mt-4 border-t border-slate-800/60">
                {/* Draft Status Details */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 font-bold text-slate-400">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                      {t(lang, 'statusDraft')}
                    </div>
                    <span className="text-white font-extrabold">
                      {chartMode === 'value' 
                        ? `$${chartData.draft.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                        : `${chartData.draft} ${lang === 'tr' ? 'Proje' : 'Proj'}`
                      }
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden p-[1px]">
                    <div className="h-full bg-amber-500 rounded-full transition-all duration-700" style={{ width: `${chartData.draftPct * 100}%` }} />
                  </div>
                </div>

                {/* Production Status Details */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 font-bold text-slate-400">
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0" />
                      {t(lang, 'statusProd')}
                    </div>
                    <span className="text-white font-extrabold">
                      {chartMode === 'value' 
                        ? `$${chartData.prod.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                        : `${chartData.prod} ${lang === 'tr' ? 'Proje' : 'Proj'}`
                      }
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden p-[1px]">
                    <div className="h-full bg-indigo-500 rounded-full transition-all duration-700" style={{ width: `${chartData.prodPct * 100}%` }} />
                  </div>
                </div>

                {/* Completed Status Details */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 font-bold text-slate-400">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                      {t(lang, 'statusComp')}
                    </div>
                    <span className="text-white font-extrabold">
                      {chartMode === 'value' 
                        ? `$${chartData.comp.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                        : `${chartData.comp} ${lang === 'tr' ? 'Proje' : 'Proj'}`
                      }
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden p-[1px]">
                    <div className="h-full bg-emerald-500 rounded-full transition-all duration-700" style={{ width: `${chartData.compPct * 100}%` }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Segmented Switcher Tabs */}
        <div className="flex gap-4 border-b border-white/5 pb-1 mb-8">
            <button
              onClick={() => { setActiveTab('projects'); setSearchTerm(''); }}
              className={`pb-3 px-4 font-bold text-sm tracking-wide transition-all relative ${
                activeTab === 'projects' ? 'text-blue-500' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {lang === 'tr' ? 'Projeler ve Teklifler' : 'Projects & Quotes'}
              {activeTab === 'projects' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />
              )}
            </button>
            <button
              onClick={() => { setActiveTab('customers'); setSearchTerm(''); }}
              className={`pb-3 px-4 font-bold text-sm tracking-wide transition-all relative flex items-center gap-2 ${
                activeTab === 'customers' ? 'text-blue-500' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users size={16} />
              {lang === 'tr' ? 'Müşteri Kayıtları' : 'Customer Database'}
              {activeTab === 'customers' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />
              )}
            </button>
        </div>

        <div className="mb-8 flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input 
                  type="text" 
                  placeholder={
                    activeTab === 'projects' 
                      ? t(lang, 'searchPlaceholder')
                      : (lang === 'tr' ? 'Müşteri adı, firma veya iletişim bilgisi ara...' : 'Search customer name, company, or contacts...')
                  } 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                  className="w-full bg-slate-900 border border-white/5 rounded-xl py-3 pl-12 pr-4 text-white outline-none focus:border-blue-500/30 transition-all" 
                />
            </div>
            {activeTab === 'customers' && (
              <button 
                onClick={() => { setEditingCustomer({ id: uuidv4(), name: '', company: '', phone: '', email: '', status: 'active', notes: '' }); setIsAddingCustomer(true); }}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-3 rounded-xl flex items-center justify-center gap-2 transition-all shrink-0 shadow-lg shadow-blue-500/10"
              >
                <Plus size={18} />
                {lang === 'tr' ? 'Yeni Müşteri' : 'Add Customer'}
              </button>
            )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activeTab === 'projects' ? (
            <>
              {filteredProjects.map((project) => (
                <div key={project.id} onClick={() => onSelectProject(project.id)} className="group bg-slate-900/40 border border-white/5 hover:border-blue-500/30 rounded-2xl p-6 cursor-pointer transition-all hover:-translate-y-1 relative">
                  <div className="flex justify-between items-start mb-6">
                      <div className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest border ${
                          project.status === 'Draft' ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500' : 
                          project.status === 'Production' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' :
                          'bg-slate-500/10 border-slate-500/20 text-slate-400'
                      }`}>
                        {getStatusLabel(project.status)}
                      </div>
                      <div className="relative">
                        <button 
                          onClick={(e) => { e.stopPropagation(); setShowMenuId(showMenuId === project.id ? null : project.id); }} 
                          className="text-slate-600 hover:text-white transition-colors p-1"
                        >
                          <MoreVertical size={18} />
                        </button>
                        {showMenuId === project.id && (
                          <div className="absolute right-0 top-8 w-40 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-30 py-1 overflow-hidden">
                            <button 
                              onClick={(e) => { e.stopPropagation(); setEditingProject(project); setShowMenuId(null); }}
                              className="w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 flex items-center gap-2"
                            >
                              <Edit2 size={14} /> {t(lang, 'edit')}
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); onDeleteProject(project.id); setShowMenuId(null); }}
                              className="w-full text-left px-4 py-2 text-sm text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 flex items-center gap-2 border-t border-slate-700/50"
                            >
                              <Trash2 size={14} /> {lang === 'tr' ? 'Sil' : 'Delete'}
                            </button>
                          </div>
                        )}
                      </div>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-1 group-hover:text-blue-400 transition-colors">{project.name}</h3>
                  <p className="text-slate-500 text-sm mb-6 flex items-center gap-2">
                    <User size={14} /> 
                    {project.client}
                    {customers.find(c => c.status === 'blocked' && (c.name.trim().toLowerCase() === project.client.trim().toLowerCase() || (c.company && c.company.trim().toLowerCase() === project.client.trim().toLowerCase()))) && (
                      <span className="ml-2 inline-flex items-center gap-1 text-[9px] bg-red-500/10 border border-red-500/20 text-red-500 px-1.5 py-0.5 rounded font-black tracking-tight self-center">
                        <Ban size={8} /> {lang === 'tr' ? 'ENGELLİ MÜŞTERİ' : 'BLOCKED'}
                      </span>
                    )}
                  </p>
                  <div className="flex items-center justify-between text-xs text-slate-500 border-t border-white/5 pt-4">
                      <div className="flex items-center gap-2"><Calendar size={14} /><span>{project.date}</span></div>
                      <div className="flex items-center gap-2 px-2 py-1 bg-slate-800 rounded"><Logo className="w-4 h-4" showText={false} /><span className="text-slate-300 font-mono">{project.units.length} {t(lang, 'positions')}</span></div>
                  </div>
                </div>
              ))}
              <button onClick={onCreateProject} className="border-2 border-dashed border-white/5 rounded-2xl p-6 flex flex-col items-center justify-center text-slate-600 hover:text-blue-400 hover:border-blue-500/20 transition-all group min-h-[220px]">
                  <div className="w-12 h-12 rounded-full bg-slate-900 group-hover:bg-blue-500/10 flex items-center justify-center mb-4 transition-colors"><Plus size={24} /></div>
                  <span className="font-bold text-sm tracking-wide">{t(lang, 'createProject')}</span>
              </button>
            </>
          ) : (
            <>
              {filteredCustomers.map((customer) => {
                const cStats = getCustomerStats(customer);
                return (
                  <div key={customer.id} className="bg-slate-900/40 border border-white/5 hover:border-slate-850 rounded-2xl p-6 transition-all relative flex flex-col justify-between min-h-[225px]">
                    <div>
                      <div className="flex justify-between items-start mb-4">
                        <div className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border flex items-center gap-1 select-none ${
                            customer.status === 'active' 
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                              : 'bg-rose-500/10 border-rose-500/20 text-rose-500 font-extrabold'
                        }`}>
                          {customer.status === 'active' ? (
                            <><UserCheck size={12} /> {lang === 'tr' ? 'Aktif' : 'Active'}</>
                          ) : (
                            <><UserX size={12} /> {lang === 'tr' ? 'Teklif Engelli' : 'Blocked'}</>
                          )}
                        </div>
                        
                        <div className="relative">
                          <button 
                            onClick={(e) => { e.stopPropagation(); setShowCustomerMenuId(showCustomerMenuId === customer.id ? null : customer.id); }} 
                            className="text-slate-600 hover:text-white transition-colors p-1"
                          >
                            <MoreVertical size={18} />
                          </button>
                          {showCustomerMenuId === customer.id && (
                            <div className="absolute right-0 top-8 w-44 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-30 py-1 overflow-hidden">
                              <button 
                                onClick={() => { setEditingCustomer(customer); setIsAddingCustomer(false); setShowCustomerMenuId(null); }}
                                className="w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 flex items-center gap-2"
                              >
                                <Edit2 size={14} /> {lang === 'tr' ? 'Düzenle' : 'Edit'}
                              </button>
                              <button 
                                onClick={() => {
                                  if (onUpdateCustomer) {
                                    onUpdateCustomer({
                                      ...customer,
                                      status: customer.status === 'active' ? 'blocked' : 'active',
                                      notes: customer.status === 'active' 
                                        ? prompt(lang === 'tr' ? 'Engelleme sebebi / Açıklama giriniz:' : 'Enter reason for blocking / Notes:') || 'Fazla teklif alıp sipariş vermiyor.'
                                        : undefined
                                    });
                                  }
                                  setShowCustomerMenuId(null);
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-amber-400 hover:bg-slate-700 flex items-center gap-2"
                              >
                                <Ban size={14} /> {customer.status === 'active' ? (lang === 'tr' ? 'Teklifleri Engelle' : 'Block Quotes') : (lang === 'tr' ? 'Engeli Kaldır' : 'Unblock')}
                              </button>
                              {onDeleteCustomer && (
                                <button 
                                  onClick={() => {
                                    if (window.confirm(lang === 'tr' ? `${customer.name} isimli müşteriyi silmek istediğinizden emin misiniz?` : `Are you sure you want to delete customer ${customer.name}?`)) {
                                      onDeleteCustomer(customer.id);
                                    }
                                    setShowCustomerMenuId(null);
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 flex items-center gap-2 border-t border-slate-700/50"
                                >
                                  <Trash2 size={14} /> {lang === 'tr' ? 'Sil' : 'Delete'}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <h3 className="text-xl font-bold text-white mb-0.5">{customer.name}</h3>
                      {customer.company && (
                        <p className="text-blue-400 text-xs font-semibold uppercase tracking-wider mb-3 leading-none">{customer.company}</p>
                      )}

                      <div className="space-y-1.5 mt-4 text-xs text-slate-400 font-medium">
                        {customer.phone && (
                          <div className="flex items-center gap-2">
                            <Phone size={12} className="text-slate-500 shrink-0" /> 
                            <span>{customer.phone}</span>
                          </div>
                        )}
                        {customer.email && (
                          <div className="flex items-center gap-2">
                            <Mail size={12} className="text-slate-500 shrink-0" /> 
                            <span className="break-all">{customer.email}</span>
                          </div>
                        )}
                        {customer.address && (
                          <div className="flex items-start gap-2 pt-0.5">
                            <MapPin size={12} className="text-slate-500 shrink-0 mt-0.5" /> 
                            <span className="line-clamp-2 text-[11px] leading-tight text-slate-400 font-normal">{customer.address}</span>
                          </div>
                        )}
                      </div>

                      {customer.notes && customer.status === 'blocked' && (
                        <div className="mt-4 p-3 bg-rose-500/5 border border-rose-500/10 rounded-xl text-rose-400/95 text-xs flex items-start gap-2.5 leading-relaxed">
                          <AlertOctagon size={14} className="shrink-0 text-rose-500 mt-0.5" />
                          <div className="flex-1">
                            <span className="font-bold block text-[10px] tracking-wider uppercase mb-0.5 text-rose-500">
                              {lang === 'tr' ? 'ENGELLEME GEREKÇESİ' : 'BLOCK REASON'}
                            </span>
                            <span className="text-slate-300 font-medium">{customer.notes}</span>
                          </div>
                        </div>
                      )}

                      {customer.status === 'blocked' && (
                        <div className="mt-3">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onUpdateCustomer) {
                                onUpdateCustomer({
                                  ...customer,
                                  status: 'active',
                                  notes: undefined
                                });
                              }
                            }}
                            className="w-full py-2 px-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5"
                          >
                            <UserCheck size={14} />
                            {lang === 'tr' ? 'Müşteri Engelini Kaldır' : 'Unblock Customer'}
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="mt-5 pt-3 border-t border-white/5 flex items-center justify-between gap-2 text-xs">
                      <div className="flex flex-col gap-2 w-full">
                        <div className="flex justify-between items-center text-[10px] text-slate-500 font-extrabold uppercase tracking-wide">
                          <span>{lang === 'tr' ? 'TEKLİF DURUMU' : 'QUOTE STATUS'}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-black ${
                            cStats.conversionRate > 40 
                              ? 'bg-emerald-500/20 text-emerald-400' 
                              : cStats.conversionRate > 0 
                                ? 'bg-amber-500/20 text-amber-400' 
                                : 'bg-slate-800 text-slate-400'
                          }`}>
                            {lang === 'tr' ? 'Dönüşüm' : 'Conv'}: %{cStats.conversionRate}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-slate-400 font-semibold text-[11px] leading-tight mt-1 bg-slate-950/40 p-2.5 rounded-xl border border-white/5">
                          <div>
                            <span className="text-slate-500 block text-[9px] font-bold">{lang === 'tr' ? 'Toplam Teklif' : 'Total Proposals'}</span>
                            <span className="text-white text-xs block mt-0.5 font-bold">{cStats.totalCount} {lang === 'tr' ? 'Adet' : 'Qty'}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[9px] font-bold">{lang === 'tr' ? 'Sipariş/Onay' : 'Approved/Orders'}</span>
                            <span className="text-emerald-400 text-xs block mt-0.5 font-bold">{cStats.approvedCount} {lang === 'tr' ? 'Adet' : 'Qty'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <button 
                onClick={() => { setEditingCustomer({ id: uuidv4(), name: '', company: '', phone: '', email: '', status: 'active', notes: '' }); setIsAddingCustomer(true); }} 
                className="border-2 border-dashed border-white/5 rounded-2xl p-6 flex flex-col items-center justify-center text-slate-600 hover:text-blue-400 hover:border-blue-500/20 transition-all group min-h-[225px]"
              >
                  <div className="w-12 h-12 rounded-full bg-slate-900 group-hover:bg-blue-500/10 flex items-center justify-center mb-4 transition-colors"><Plus size={24} /></div>
                  <span className="font-bold text-sm tracking-wide">{lang === 'tr' ? 'Yeni Müşteri Ekle' : 'Add New Customer'}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Edit Project Modal */}
      {editingProject && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setEditingProject(null)}>
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Edit2 size={18} className="text-blue-500" />
                {t(lang, 'editProjectInfo')}
              </h2>
              <button onClick={() => setEditingProject(null)} className="text-slate-500 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">{t(lang, 'projectName')}</label>
                <input 
                  autoFocus
                  required
                  value={editingProject.name}
                  onChange={e => setEditingProject({...editingProject, name: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-sm outline-none focus:border-blue-500/50"
                  placeholder={t(lang, 'projectNamePlaceholder')}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">{t(lang, 'clientName')}</label>
                <input 
                  required
                  value={editingProject.client}
                  onChange={e => setEditingProject({...editingProject, client: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-sm outline-none focus:border-blue-500/50"
                  placeholder="Müşteri adı giriniz..."
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">{t(lang, 'projectDate')}</label>
                <input 
                  type="date"
                  required
                  value={editingProject.date}
                  onChange={e => setEditingProject({...editingProject, date: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-sm outline-none focus:border-blue-500/50 mb-3"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">{lang === 'tr' ? 'Proje Durumu' : 'Project Status'}</label>
                <select
                  value={editingProject.status || 'Draft'}
                  onChange={e => setEditingProject({...editingProject, status: e.target.value as any})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-sm outline-none focus:border-blue-500/50 cursor-pointer"
                >
                  <option value="Draft">{t(lang, 'statusDraft')}</option>
                  <option value="Production">{t(lang, 'statusProd')}</option>
                  <option value="Completed">{t(lang, 'statusComp')}</option>
                </select>
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setEditingProject(null)} className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition-all">
                  {t(lang, 'cancel')}
                </button>
                <button type="submit" className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2">
                  <Save size={18} /> {t(lang, 'saveChanges')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create / Edit Customer Modal */}
      {editingCustomer && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setEditingCustomer(null)}>
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <User size={18} className="text-blue-500" />
                {isAddingCustomer 
                  ? (lang === 'tr' ? 'Yeni Müşteri Ekle' : 'Add New Customer')
                  : (lang === 'tr' ? 'Müşteri Bilgilerini Düzenle' : 'Edit Customer Info')
                }
              </h2>
              <button onClick={() => setEditingCustomer(null)} className="text-slate-500 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              if (isAddingCustomer) {
                if (onAddCustomer) onAddCustomer(editingCustomer);
              } else {
                if (onUpdateCustomer) onUpdateCustomer(editingCustomer);
              }
              setEditingCustomer(null);
            }} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">{lang === 'tr' ? 'Müşteri Adı (Yetkili)' : 'Customer Name'}</label>
                <input 
                  autoFocus
                  required
                  value={editingCustomer.name}
                  onChange={e => setEditingCustomer({...editingCustomer, name: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-sm outline-none focus:border-blue-500/50"
                  placeholder="Ahmet Yılmaz"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">{lang === 'tr' ? 'Firma Adı' : 'Company Name'}</label>
                <input 
                  value={editingCustomer.company || ''}
                  onChange={e => setEditingCustomer({...editingCustomer, company: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-sm outline-none focus:border-blue-500/50"
                  placeholder="Kurt Yapı A.Ş."
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">{lang === 'tr' ? 'Telefon' : 'Phone Number'}</label>
                <input 
                  type="tel"
                  value={editingCustomer.phone || ''}
                  onChange={e => setEditingCustomer({...editingCustomer, phone: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-sm outline-none focus:border-blue-500/50"
                  placeholder="0555 123 4567"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">{lang === 'tr' ? 'E-posta' : 'Email Address'}</label>
                <input 
                  type="email"
                  value={editingCustomer.email || ''}
                  onChange={e => setEditingCustomer({...editingCustomer, email: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-sm outline-none focus:border-blue-500/50"
                  placeholder="ahmet@kurtyapi.com"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">{lang === 'tr' ? 'Müşteri Adresi' : 'Customer Address'}</label>
                <textarea 
                  value={editingCustomer.address || ''}
                  onChange={e => setEditingCustomer({...editingCustomer, address: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-sm outline-none focus:border-blue-500/50 min-h-[70px] resize-none"
                  placeholder={lang === 'tr' ? 'Örn: Merkez Mah. İstiklal Cad. No:12, Şişli / İstanbul' : 'E.g., 456 Broadway Ave, Floor 2, New York, NY'}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">{lang === 'tr' ? 'Müşteri Durumu' : 'Customer Status'}</label>
                <select
                  value={editingCustomer.status}
                  onChange={e => {
                    const nextStatus = e.target.value as 'active' | 'blocked';
                    setEditingCustomer({
                      ...editingCustomer, 
                      status: nextStatus,
                      notes: nextStatus === 'active' ? undefined : editingCustomer.notes
                    });
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-sm outline-none focus:border-blue-500/50 cursor-pointer"
                >
                  <option value="active">{lang === 'tr' ? 'Aktif (Teklif Alabilir)' : 'Active (Quotes Enabled)'}</option>
                  <option value="blocked">{lang === 'tr' ? 'Engelli - Kara Liste (Teklif Alamaz)' : 'Blocked - Blacklisted (Quotes Disabled)'}</option>
                </select>
              </div>

              {editingCustomer.status === 'blocked' && (
                <div>
                  <label className="block text-xs font-bold text-rose-400 uppercase tracking-widest mb-1.5">{lang === 'tr' ? 'Engelleme Gerekçesi / Özel Not' : 'Block Reason / Custom Notes'}</label>
                  <textarea 
                    value={editingCustomer.notes || ''}
                    onChange={e => setEditingCustomer({...editingCustomer, notes: e.target.value})}
                    className="w-full bg-slate-950 border border-rose-500/20 text-rose-300 rounded-xl p-3 text-sm outline-none focus:border-rose-500/50 min-h-[80px]"
                    placeholder={lang === 'tr' ? 'Örn: Sürekli teklif istiyor ama hiç siparişe dönüşmedi.' : 'E.g., Keeps requesting quotes but has never finalized an order.'}
                    required
                  />
                </div>
              )}

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setEditingCustomer(null)} className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition-all">
                  {t(lang, 'cancel')}
                </button>
                <button type="submit" className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2">
                  <Save size={18} /> {lang === 'tr' ? 'Kaydet' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      <div className="border-t border-white/5 py-8 mt-12 text-center text-sm text-slate-600">
          <p>&copy; {new Date().getFullYear()} Alumetric Suite.</p>
      </div>

      <style>{`
        @keyframes pulse-slow {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.8; transform: scale(0.98); }
        }
        .animate-pulse-slow {
            animation: pulse-slow 3s infinite ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default Dashboard;
