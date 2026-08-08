
import React, { useState, useMemo } from 'react';
import { Project, Language, ProfileSystem, Accessory, Customer } from '../types';
import { Plus, Settings, User, Search, MoreVertical, Calendar, X, Save, Edit2, Sparkles, Trash2, Cpu, FileCheck, FileText, LayoutGrid, TrendingUp, DollarSign, Package, Users, UserX, UserCheck, Phone, Mail, Ban, AlertOctagon, MapPin, Sun, Moon, Printer, ArrowLeft, Calculator } from 'lucide-react';
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
  onOpenGlassAnalysis?: () => void;
  forcedName?: string;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
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
  onOpenGlassAnalysis,
  forcedName,
  theme,
  onToggleTheme
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
  const [showCustomerReport, setShowCustomerReport] = useState(false);
  const [selectedCustomerDetail, setSelectedCustomerDetail] = useState<Customer | null>(null);
  const [reportCustomerFilterId, setReportCustomerFilterId] = useState<string>('ALL');
  
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
    let approvedValue = 0;
    let draftCount = 0;
    let draftValue = 0;
    let completedCount = 0;
    let completedValue = 0;

    let totalUnitsCount = 0;
    let approvedUnitsCount = 0;
    let totalAreaM2 = 0;
    let approvedAreaM2 = 0;
    
    clientProjects.forEach(p => {
      const report = calculateProjectCost(p, systems, accessories);
      const val = report.grandTotal || 0;
      totalValue += val;

      const pUnits = (p.units || []).reduce((sum, u) => sum + (u.quantity || 1), 0);
      const pArea = (p.units || []).reduce((sum, u) => sum + (((u.width * u.height) / 1000000) * (u.quantity || 1)), 0);

      totalUnitsCount += pUnits;
      totalAreaM2 += pArea;

      if (p.status === 'Production' || p.status === 'Completed') {
        approvedCount++;
        approvedValue += val;
        approvedUnitsCount += pUnits;
        approvedAreaM2 += pArea;
      }
      if (p.status === 'Draft') {
        draftCount++;
        draftValue += val;
      }
      if (p.status === 'Completed') {
        completedCount++;
        completedValue += val;
      }
    });
    
    const conversionRate = totalCount > 0 ? Math.round((approvedCount / totalCount) * 100) : 0;
    
    return {
      totalCount,
      totalValue,
      approvedCount,
      approvedValue,
      draftCount,
      draftValue,
      completedCount,
      completedValue,
      conversionRate,
      totalUnitsCount,
      approvedUnitsCount,
      totalAreaM2,
      approvedAreaM2
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

  const getCustomerProjects = (customer: Customer) => {
    const nameLower = customer.name.trim().toLowerCase();
    const compLower = customer.company ? customer.company.trim().toLowerCase() : '';
    
    return projects.filter(p => {
      const pClient = p.client.trim().toLowerCase();
      return pClient === nameLower || (compLower && pClient === compLower);
    });
  };

  if (showCustomerReport) {
    const reportCustomers = reportCustomerFilterId === 'ALL'
      ? customers
      : customers.filter(c => c.id === reportCustomerFilterId);

    const activeCustomers = reportCustomers.filter(c => c.status === 'active');
    
    // Calculate stats for filtered customers
    let grandTotalProjects = 0;
    let grandTotalValue = 0;
    let grandApprovedProjects = 0;
    
    reportCustomers.forEach(customer => {
      const { totalCount, totalValue, approvedCount } = getCustomerStats(customer);
      grandTotalProjects += totalCount;
      grandTotalValue += totalValue;
      grandApprovedProjects += approvedCount;
    });

    const averageConversionRate = grandTotalProjects > 0 ? Math.round((grandApprovedProjects / grandTotalProjects) * 100) : 0;
    const selectedFilterCustomer = customers.find(c => c.id === reportCustomerFilterId);

    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-6 sm:p-8 font-sans print:bg-white print:text-black print:p-0">
        <div className="max-w-6xl mx-auto space-y-8 print:max-w-none print:space-y-6">
          {/* Header Controls */}
          <div className="flex flex-col sm:flex-row justify-between items-center bg-slate-900/60 backdrop-blur border border-white/5 rounded-2xl p-6 shadow-xl gap-4 print:hidden">
            <button 
              onClick={() => setShowCustomerReport(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold text-slate-300 flex items-center gap-2 transition-all border border-white/5"
            >
              <ArrowLeft size={14} />
              {lang === 'tr' ? 'Kontrol Paneline Dön' : 'Back to Dashboard'}
            </button>

            {/* Customer Filter Selector */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-white/10">
                <Users size={14} className="text-blue-400 shrink-0" />
                <span className="text-xs font-bold text-slate-300">{lang === 'tr' ? 'Rapor Kapsamı:' : 'Report Scope:'}</span>
                <select
                  value={reportCustomerFilterId}
                  onChange={(e) => setReportCustomerFilterId(e.target.value)}
                  className="bg-slate-950 text-white font-bold text-xs rounded-lg px-2.5 py-1 outline-none border border-slate-700 focus:border-blue-500 cursor-pointer"
                >
                  <option value="ALL">{lang === 'tr' ? 'Tüm Müşteriler (Genel Liste)' : 'All Customers (Global Summary)'}</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name} {c.company ? `(${c.company})` : ''}</option>
                  ))}
                </select>
              </div>

              <button 
                onClick={() => window.print()}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/10"
              >
                <Printer size={14} />
                {lang === 'tr' ? 'PDF / Rapor Yazdır' : 'Print PDF Report'}
              </button>
            </div>
          </div>

          {/* Printable Report Document Card */}
          <div className="bg-slate-900/40 border border-white/5 p-6 sm:p-10 rounded-[2rem] shadow-2xl print:bg-white print:border-none print:p-0 print:shadow-none">
            {/* Enterprise Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-white/10 pb-8 mb-8 print:border-slate-300 print:pb-6 print:mb-6">
              <div className="flex items-center gap-3">
                <Logo className="w-10 h-10" theme={theme} />
                <div>
                  <h1 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight print:text-black">
                    {selectedFilterCustomer 
                      ? (lang === 'tr' ? `MÜŞTERİ ÖZEL TEKLİF & SİPARİŞ RAPORU (${selectedFilterCustomer.name.toUpperCase()})` : `CUSTOMER SPECIAL BID & ORDER REPORT (${selectedFilterCustomer.name.toUpperCase()})`)
                      : (lang === 'tr' ? 'MÜŞTERİ KAYITLARI & TEKLİF RAPORU' : 'CUSTOMER DATABASE & BID REPORT')
                    }
                  </h1>
                  <p className="text-slate-400 text-xs font-medium mt-1 print:text-slate-600">
                    Vizyon Pergola Suite • {new Date().toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US')}
                  </p>
                </div>
              </div>
              <div className="text-right mt-4 md:mt-0 font-mono text-xs text-slate-500 print:text-slate-700">
                {selectedFilterCustomer ? (
                  <>
                    <div className="font-bold text-slate-200 print:text-slate-900 text-sm">{selectedFilterCustomer.name}</div>
                    {selectedFilterCustomer.company && <div className="text-blue-400 print:text-blue-900 font-bold">{selectedFilterCustomer.company}</div>}
                    <div className="text-slate-400 print:text-slate-600">{lang === 'tr' ? 'Hazırlayan: ' : 'Issued By: '}{displayName}</div>
                  </>
                ) : (
                  <>
                    <div>{lang === 'tr' ? 'Firma: ' : 'Company: '} {displayName}</div>
                    <div>{lang === 'tr' ? 'Sistem: ' : 'System: '} VIZYON Pergola</div>
                  </>
                )}
              </div>
            </div>

            {/* Global Summary KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 print:gap-2 print:mb-6">
              <div className="bg-slate-950/40 border border-white/5 p-4 rounded-xl print:bg-slate-50 print:border-slate-200">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1 print:text-slate-500">
                  {selectedFilterCustomer ? (lang === 'tr' ? 'SEÇİLİ MÜŞTERİ' : 'SELECTED CUSTOMER') : (lang === 'tr' ? 'TOPLAM MÜŞTERİ' : 'TOTAL CUSTOMERS')}
                </span>
                <span className="text-lg font-bold text-white print:text-slate-950 block truncate">
                  {selectedFilterCustomer ? selectedFilterCustomer.name : `${customers.length} (${activeCustomers.length} ${lang === 'tr' ? 'Aktif' : 'Active'})`}
                </span>
              </div>
              <div className="bg-slate-950/40 border border-white/5 p-4 rounded-xl print:bg-slate-50 print:border-slate-200">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1 print:text-slate-500">
                  {lang === 'tr' ? 'VERİLEN TEKLİFLER' : 'ISSUED PROPOSALS'}
                </span>
                <span className="text-xl font-bold text-blue-400 print:text-blue-700 block font-mono">
                  {grandTotalProjects} {lang === 'tr' ? 'Teklif' : 'Bids'}
                </span>
              </div>
              <div className="bg-slate-950/40 border border-white/5 p-4 rounded-xl print:bg-slate-50 print:border-slate-200">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1 print:text-slate-500">
                  {lang === 'tr' ? 'SİPARİŞ DÖNÜŞÜMÜ' : 'CONVERSION RATE'}
                </span>
                <span className="text-xl font-bold text-emerald-400 print:text-emerald-700 block font-mono">
                  %{averageConversionRate} <span className="text-xs font-normal text-slate-500 font-sans">({grandApprovedProjects} {lang === 'tr' ? 'Sipariş' : 'Order'})</span>
                </span>
              </div>
              <div className="bg-slate-950/40 border border-white/5 p-4 rounded-xl print:bg-slate-50 print:border-slate-200">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1 print:text-slate-500">
                  {lang === 'tr' ? 'TEKLİF PORTFÖYÜ' : 'PIPELINE VALUE'}
                </span>
                <span className="text-xl font-bold text-orange-400 print:text-orange-700 font-mono block">
                  ${grandTotalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Customer Records Listing */}
            <div className="space-y-6">
              <h2 className="text-sm font-black text-indigo-400 uppercase tracking-widest border-b border-white/5 pb-2 mb-4 print:text-indigo-800 print:border-slate-300">
                {selectedFilterCustomer 
                  ? (lang === 'tr' ? `${selectedFilterCustomer.name.toUpperCase()} TEKLİF VE SİPARİŞ GEÇMİŞİ` : `${selectedFilterCustomer.name.toUpperCase()} QUOTATION & ORDER HISTORY`)
                  : (lang === 'tr' ? 'MÜŞTERİ BAZLI TEKLİF GEÇMİŞİ' : 'CUSTOMER DETAILED QUOTATION LOG')
                }
              </h2>

              {reportCustomers.length === 0 ? (
                <div className="text-center py-12 text-slate-500 border border-dashed border-white/5 rounded-2xl">
                  {lang === 'tr' ? 'Henüz müşteri kaydı bulunmamaktadır.' : 'No customer records available.'}
                </div>
              ) : (
                <div className="divide-y divide-white/5 print:divide-slate-200 space-y-6">
                  {reportCustomers.map((customer, idx) => {
                    const cStats = getCustomerStats(customer);
                    const cProjects = getCustomerProjects(customer);
                    
                    return (
                      <div key={customer.id} className={`pt-6 ${idx === 0 ? 'pt-0' : ''} avoid-break`}>
                        {/* Customer Meta Row */}
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-950/20 p-4 rounded-xl border border-white/5 mb-4 print:bg-slate-50 print:border-slate-200">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-extrabold text-white text-base print:text-slate-950">{customer.name}</h3>
                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border ${
                                customer.status === 'active' 
                                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                                  : 'bg-rose-500/10 border-rose-500/20 text-rose-500'
                              }`}>
                                {customer.status === 'active' ? (lang === 'tr' ? 'Aktif' : 'Active') : (lang === 'tr' ? 'Engelli' : 'Blocked')}
                              </span>
                            </div>
                            {customer.company && (
                              <p className="text-blue-400 text-xs font-bold uppercase tracking-wider print:text-blue-800">{customer.company}</p>
                            )}
                            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-slate-400 font-medium print:text-slate-600">
                              {customer.phone && <span>Tel: {customer.phone}</span>}
                              {customer.email && <span>E-mail: {customer.email}</span>}
                              {customer.address && <span className="line-clamp-1">Adres: {customer.address}</span>}
                            </div>
                          </div>

                          {/* Customer mini stats KPI */}
                          <div className="text-start md:text-right md:border-l border-white/10 md:pl-4 print:border-slate-300">
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block print:text-slate-500">
                              {lang === 'tr' ? 'MÜŞTERİ ÖZET RAPORU' : 'CUSTOMER SUMMARY REPORT'}
                            </span>
                            <span className="text-sm font-extrabold text-white print:text-slate-950 font-mono block">
                              {cStats.totalCount} {lang === 'tr' ? 'Teklif' : 'Proposals'} (${cStats.totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })})
                            </span>
                            <div className="text-[10px] font-bold mt-0.5 space-x-2">
                              <span className="text-emerald-400 print:text-emerald-700">
                                {lang === 'tr' ? 'Sipariş' : 'Approved'}: {cStats.approvedCount} (${cStats.approvedValue.toLocaleString(undefined, { maximumFractionDigits: 0 })})
                              </span>
                              <span className="text-slate-400 print:text-slate-600">
                                | %{cStats.conversionRate} {lang === 'tr' ? 'Oran' : 'Rate'}
                              </span>
                            </div>
                            <div className="text-[10px] text-blue-400 print:text-blue-800 font-semibold mt-0.5">
                              {cStats.totalUnitsCount} {lang === 'tr' ? 'Poz' : 'Units'} / {cStats.totalAreaM2.toFixed(1)} m²
                            </div>
                          </div>
                        </div>

                        {/* Customer Projects details */}
                        <div className="pl-4 border-l-2 border-slate-800 pr-2 mb-4 print:border-slate-300 overflow-x-auto">
                          {cProjects.length === 0 ? (
                            <div className="text-slate-500 text-xs py-2 italic font-normal">
                              {lang === 'tr' ? 'Bu müşteriye ait henüz bir teklif kaydı oluşturulmamıştır.' : 'No estimations issued for this customer yet.'}
                            </div>
                          ) : (
                            <table className="w-full text-xs text-left min-w-[500px]">
                              <thead>
                                <tr className="text-slate-500 font-black uppercase tracking-wider border-b border-white/5 pb-2 print:text-slate-500 print:border-slate-200">
                                  <th className="py-2 pr-4">{lang === 'tr' ? 'Proje No / Ref' : 'Project Ref'}</th>
                                  <th className="py-2 pr-4">{lang === 'tr' ? 'Proje Adı' : 'Project Name'}</th>
                                  <th className="py-2 pr-4">{lang === 'tr' ? 'Tarih' : 'Date'}</th>
                                  <th className="py-2 pr-4 text-center">{lang === 'tr' ? 'Poz' : 'Units'}</th>
                                  <th className="py-2 pr-4 text-center">{lang === 'tr' ? 'Metraj (m²)' : 'Area (m²)'}</th>
                                  <th className="py-2 pr-4 text-right">{lang === 'tr' ? 'Teklif Bedeli' : 'Est. Amount'}</th>
                                  <th className="py-2 text-right">{lang === 'tr' ? 'Durum' : 'Status'}</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-white/5 print:divide-slate-200">
                                {cProjects.map(proj => {
                                  const costReport = calculateProjectCost(proj, systems, accessories);
                                  const pUnitsCount = (proj.units || []).reduce((sum, u) => sum + (u.quantity || 1), 0);
                                  const pAreaM2 = (proj.units || []).reduce((sum, u) => sum + (((u.width * u.height) / 1000000) * (u.quantity || 1)), 0);

                                  return (
                                    <tr key={proj.id} className="text-slate-300 hover:bg-white/5 print:text-slate-850">
                                      <td className="py-2.5 font-mono text-blue-400 font-bold print:text-blue-800 pr-4">
                                        {proj.projectNumber || `ALU-${new Date(proj.date).getFullYear() || 2026}-${proj.id.slice(0, 4).toUpperCase()}`}
                                      </td>
                                      <td className="py-2.5 font-bold pr-4">{proj.name}</td>
                                      <td className="py-2.5 text-slate-400 print:text-slate-600 pr-4">{proj.date}</td>
                                      <td className="py-2.5 text-center font-bold pr-4">{pUnitsCount}</td>
                                      <td className="py-2.5 text-center font-mono text-slate-400 print:text-slate-700 pr-4">{pAreaM2.toFixed(1)} m²</td>
                                      <td className="py-2.5 text-right font-mono font-bold pr-4 text-emerald-400 print:text-emerald-700">
                                        ${costReport.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </td>
                                      <td className="py-2.5 text-right">
                                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-tight border ${
                                          proj.status === 'Draft' ? 'bg-yellow-500/10 border-yellow-500/10 text-yellow-500 print:border-yellow-200' :
                                          proj.status === 'Production' ? 'bg-emerald-500/10 border-emerald-500/10 text-emerald-400 print:border-emerald-200' :
                                          'bg-slate-500/10 border-slate-500/10 text-slate-400 print:border-slate-200'
                                        }`}>
                                          {getStatusLabel(proj.status)}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Printable signatures footer */}
            <div className="hidden print:flex justify-between items-center pt-24 mt-12 border-t border-slate-300 text-xs">
              <div className="text-center w-48">
                <div className="font-bold border-b border-slate-400 pb-16 mb-2">Hazırlayan / Issued By</div>
                <div className="text-[10px] text-slate-500 uppercase">{displayName} Yetkilisi</div>
              </div>
              <div className="text-center w-48">
                <div className="font-bold border-b border-slate-400 pb-16 mb-2">Belge Onayı / Verification</div>
                <div className="text-[10px] text-slate-500 uppercase">ALUMETRIC Engineering Suite</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProject) {
      onUpdateProject(editingProject);
      setEditingProject(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Main Dashboard UI (Hidden during print when selectedCustomerDetail report modal is active) */}
      <div className={`flex-1 flex flex-col ${selectedCustomerDetail ? 'print:hidden' : ''}`}>
        <div className="border-b border-white/5 bg-slate-900/40 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-3 flex justify-between items-center">
            <div className="flex items-center gap-3">
                <Logo className="w-8 h-8" theme={theme} />
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
                    <button 
                      onClick={onToggleTheme} 
                      className="p-1.5 text-slate-400 hover:text-white transition-colors border border-slate-800 rounded flex items-center justify-center p-2"
                      title={theme === 'light' ? (lang === 'tr' ? 'Karanlık Tema' : 'Dark Theme') : (lang === 'tr' ? 'Aydınlık Tema' : 'Light Theme')}
                    >
                      {theme === 'light' ? <Moon size={16} className="text-slate-500 hover:text-indigo-500" /> : <Sun size={16} className="text-amber-400" />}
                    </button>
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
                    {lang === 'tr' ? 'ADET' : 'QTY'}
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
            <button
              onClick={onOpenGlassAnalysis}
              className="pb-3 px-4 font-bold text-sm tracking-wide transition-all relative flex items-center gap-2 text-slate-400 hover:text-slate-200"
            >
              <Calculator size={16} className="text-indigo-400" />
              {lang === 'tr' ? 'Cam Analizi' : 'Glass Analysis'}
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
              <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                <button 
                  onClick={() => setShowCustomerReport(true)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/5 font-bold px-5 py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg"
                >
                  <Printer size={18} />
                  {lang === 'tr' ? 'Müşteri Raporu Yazdır' : 'Print Customer Report'}
                </button>
                <button 
                  onClick={() => { setEditingCustomer({ id: uuidv4(), name: '', company: '', phone: '', email: '', status: 'active', notes: '' }); setIsAddingCustomer(true); }}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-5 py-3 rounded-xl flex items-center justify-center gap-2 transition-all shrink-0 shadow-lg shadow-blue-500/10"
                >
                  <Plus size={18} />
                  {lang === 'tr' ? 'Yeni Müşteri' : 'Add Customer'}
                </button>
              </div>
            )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activeTab === 'projects' ? (
            <>
              {filteredProjects.map((project) => (
                <div key={project.id} onClick={() => onSelectProject(project.id)} className="group bg-slate-900/40 border border-white/5 hover:border-blue-500/30 rounded-2xl p-6 cursor-pointer transition-all hover:-translate-y-1 relative">
                  <div className="flex justify-between items-start mb-6">
                      <div className="flex gap-2 items-center">
                        <div className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest border ${
                            project.status === 'Draft' ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500' : 
                            project.status === 'Production' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' :
                            'bg-slate-500/10 border-slate-500/20 text-slate-400'
                        }`}>
                          {getStatusLabel(project.status)}
                        </div>
                        <div className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest border bg-blue-500/10 border-blue-500/20 text-blue-400 font-mono">
                          {project.projectNumber || `ALU-${new Date(project.date).getFullYear() || 2026}-${project.id.slice(0, 4).toUpperCase()}`}
                        </div>
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
                      <div className="flex items-center gap-2 px-2 py-1 bg-slate-800 rounded"><Logo className="w-4 h-4" showText={false} theme={theme} /><span className="text-slate-300 font-mono">{project.units.length} {t(lang, 'positions')}</span></div>
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
                const cProjects = getCustomerProjects(customer);
                return (
                  <div 
                    key={customer.id} 
                    onClick={() => setSelectedCustomerDetail(customer)}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-500/50 dark:hover:border-blue-500/50 shadow-sm hover:shadow-md rounded-2xl p-6 transition-all relative flex flex-col justify-between min-h-[225px] cursor-pointer group hover:-translate-y-0.5 text-slate-900 dark:text-white"
                  >
                    <div>
                      <div className="flex justify-between items-start mb-4">
                        <div className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border flex items-center gap-1 select-none ${
                            customer.status === 'active' 
                              ? 'bg-emerald-100 border-emerald-300 text-emerald-800 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400' 
                              : 'bg-rose-100 border-rose-300 text-rose-800 dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-500 font-extrabold'
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
                            className="text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors p-1"
                          >
                            <MoreVertical size={18} />
                          </button>
                          {showCustomerMenuId === customer.id && (
                            <div className="absolute right-0 top-8 w-44 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-30 py-1 overflow-hidden">
                              <button 
                                onClick={(e) => { e.stopPropagation(); setEditingCustomer(customer); setIsAddingCustomer(false); setShowCustomerMenuId(null); }}
                                className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                              >
                                <Edit2 size={14} /> {lang === 'tr' ? 'Düzenle' : 'Edit'}
                              </button>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (onUpdateCustomer) {
                                    let reason: string | null = null;
                                    try {
                                      reason = prompt(lang === 'tr' ? 'Engelleme sebebi / Açıklama giriniz:' : 'Enter reason for blocking / Notes:');
                                    } catch (err) {
                                      reason = lang === 'tr' ? 'Fazla teklif alıp sipariş vermiyor.' : 'Takes too many quotes without ordering.';
                                    }
                                    onUpdateCustomer({
                                      ...customer,
                                      status: customer.status === 'active' ? 'blocked' : 'active',
                                      notes: customer.status === 'active' 
                                        ? (reason || (lang === 'tr' ? 'Fazla teklif alıp sipariş vermiyor.' : 'Takes too many quotes without ordering.'))
                                        : undefined
                                    });
                                  }
                                  setShowCustomerMenuId(null);
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-amber-700 dark:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                              >
                                <Ban size={14} /> {customer.status === 'active' ? (lang === 'tr' ? 'Teklifleri Engelle' : 'Block Quotes') : (lang === 'tr' ? 'Engeli Kaldır' : 'Unblock')}
                              </button>
                              {onDeleteCustomer && (
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteCustomer(customer.id);
                                    setShowCustomerMenuId(null);
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:text-rose-700 dark:hover:text-rose-300 flex items-center gap-2 border-t border-slate-100 dark:border-slate-700/50"
                                >
                                  <Trash2 size={14} /> {lang === 'tr' ? 'Sil' : 'Delete'}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <h3 className="text-xl font-black text-slate-900 dark:text-white mb-0.5 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{customer.name}</h3>
                      {customer.company && (
                        <p className="text-blue-700 dark:text-blue-400 text-xs font-extrabold uppercase tracking-wider mb-3 leading-none">{customer.company}</p>
                      )}

                      <div className="space-y-1.5 mt-4 text-xs text-slate-600 dark:text-slate-300 font-medium">
                        {customer.phone && (
                          <div className="flex items-center gap-2">
                            <Phone size={12} className="text-slate-400 shrink-0" /> 
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{customer.phone}</span>
                          </div>
                        )}
                        {customer.email && (
                          <div className="flex items-center gap-2">
                            <Mail size={12} className="text-slate-400 shrink-0" /> 
                            <span className="break-all font-semibold text-slate-800 dark:text-slate-200">{customer.email}</span>
                          </div>
                        )}
                        {customer.address && (
                          <div className="flex items-start gap-2 pt-0.5">
                            <MapPin size={12} className="text-slate-400 shrink-0 mt-0.5" /> 
                            <span className="line-clamp-2 text-[11px] leading-tight text-slate-600 dark:text-slate-300 font-normal">{customer.address}</span>
                          </div>
                        )}
                      </div>

                      {customer.notes && customer.status === 'blocked' && (
                        <div className="mt-4 p-3 bg-rose-50 border border-rose-200 dark:bg-rose-500/5 dark:border-rose-500/10 rounded-xl text-rose-800 dark:text-rose-300 text-xs flex items-start gap-2.5 leading-relaxed">
                          <AlertOctagon size={14} className="shrink-0 text-rose-600 dark:text-rose-500 mt-0.5" />
                          <div className="flex-1">
                            <span className="font-extrabold block text-[10px] tracking-wider uppercase mb-0.5 text-rose-700 dark:text-rose-500">
                              {lang === 'tr' ? 'ENGELLEME GEREKÇESİ' : 'BLOCK REASON'}
                            </span>
                            <span className="text-slate-800 dark:text-slate-300 font-medium">{customer.notes}</span>
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
                            className="w-full py-2 px-3 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/20 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5"
                          >
                            <UserCheck size={14} />
                            {lang === 'tr' ? 'Müşteri Engelini Kaldır' : 'Unblock Customer'}
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="mt-5 pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-3 text-xs">
                      <div className="flex flex-col gap-2 w-full">
                        <div className="flex justify-between items-center text-[10px] text-slate-700 dark:text-slate-300 font-extrabold uppercase tracking-wide">
                          <span>{lang === 'tr' ? 'TEKLİF VE SİPARİŞ RAPORU' : 'PROPOSAL & ORDER REPORT'}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-black ${
                            cStats.conversionRate > 40 
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-400' 
                              : cStats.conversionRate > 0 
                                ? 'bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-500/20 dark:text-amber-400' 
                                : 'bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-400'
                          }`}>
                            {lang === 'tr' ? 'Sipariş Oranı' : 'Conv Rate'}: %{cStats.conversionRate}
                          </span>
                        </div>

                        {/* 4-cell Mini Report Grid */}
                        <div className="grid grid-cols-2 gap-2 mt-1 bg-slate-50 dark:bg-slate-950/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                          <div>
                            <span className="text-slate-600 dark:text-slate-400 block text-[9px] font-extrabold uppercase">{lang === 'tr' ? 'Verilen Teklif' : 'Total Bids'}</span>
                            <div className="flex flex-col mt-0.5">
                              <span className="text-slate-900 dark:text-white text-xs font-black">{cStats.totalCount} {lang === 'tr' ? 'Teklif' : 'Bids'}</span>
                              <span className="text-[10px] font-mono text-slate-800 dark:text-slate-300 font-bold">${cStats.totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                            </div>
                          </div>

                          <div>
                            <span className="text-emerald-800 dark:text-emerald-400 block text-[9px] font-extrabold uppercase">{lang === 'tr' ? 'Siparişe Dönüşen' : 'In Production'}</span>
                            <div className="flex flex-col mt-0.5">
                              <span className="text-emerald-900 dark:text-emerald-400 text-xs font-black">{cStats.approvedCount} {lang === 'tr' ? 'Sipariş' : 'Orders'}</span>
                              <span className="text-[10px] font-mono text-emerald-800 dark:text-emerald-400 font-extrabold">${cStats.approvedValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                            </div>
                          </div>

                          <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                            <span className="text-amber-800 dark:text-amber-400 block text-[9px] font-extrabold uppercase">{lang === 'tr' ? 'Taslak / Bekleyen' : 'Draft / Pending'}</span>
                            <div className="flex flex-col mt-0.5">
                              <span className="text-amber-900 dark:text-amber-400 text-xs font-bold">{cStats.draftCount} {lang === 'tr' ? 'Taslak' : 'Draft'}</span>
                              <span className="text-[10px] font-mono text-amber-800 dark:text-amber-400 font-bold">${cStats.draftValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                            </div>
                          </div>

                          <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                            <span className="text-blue-800 dark:text-blue-400 block text-[9px] font-extrabold uppercase">{lang === 'tr' ? 'Poz & Metraj' : 'Units & Area'}</span>
                            <div className="flex flex-col mt-0.5">
                              <span className="text-blue-900 dark:text-blue-400 text-xs font-bold">{cStats.totalUnitsCount} {lang === 'tr' ? 'Poz' : 'Units'}</span>
                              <span className="text-[10px] font-mono text-slate-800 dark:text-slate-300 font-bold">({cStats.totalAreaM2.toFixed(1)} m²)</span>
                            </div>
                          </div>
                        </div>

                        {/* Visual conversion progress bar */}
                        {cStats.totalCount > 0 && (
                          <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden flex mt-1">
                            <div 
                              className="bg-emerald-500 h-full transition-all duration-300" 
                              style={{ width: `${(cStats.approvedCount / cStats.totalCount) * 100}%` }}
                              title={lang === 'tr' ? `Sipariş: ${cStats.approvedCount}` : `Approved: ${cStats.approvedCount}`}
                            />
                            <div 
                              className="bg-amber-500 h-full transition-all duration-300" 
                              style={{ width: `${(cStats.draftCount / cStats.totalCount) * 100}%` }}
                              title={lang === 'tr' ? `Taslak: ${cStats.draftCount}` : `Draft: ${cStats.draftCount}`}
                            />
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCustomerDetail(customer);
                        }}
                        className="w-full py-2.5 px-3 bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white dark:bg-blue-600/20 dark:text-blue-400 dark:hover:bg-blue-600 dark:hover:text-white border border-blue-200 dark:border-blue-500/20 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 group-hover:bg-blue-600 group-hover:text-white shadow-sm"
                      >
                        <FileText size={14} />
                        {lang === 'tr' ? `Detaylı Müşteri Raporu ve Teklifler (${cProjects.length})` : `Full Customer Report & Quotes (${cProjects.length})`}
                      </button>
                    </div>
                  </div>
                );
              })}
              <button 
                onClick={() => { setEditingCustomer({ id: uuidv4(), name: '', company: '', phone: '', email: '', status: 'active', notes: '' }); setIsAddingCustomer(true); }} 
                className="border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-blue-500/40 rounded-2xl p-6 flex flex-col items-center justify-center text-slate-500 hover:text-blue-600 transition-all group min-h-[225px] bg-slate-50/50 dark:bg-slate-900/20"
              >
                  <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 group-hover:bg-blue-100 dark:group-hover:bg-blue-500/20 group-hover:text-blue-600 text-slate-600 flex items-center justify-center mb-4 transition-colors"><Plus size={24} /></div>
                  <span className="font-bold text-sm tracking-wide">{lang === 'tr' ? 'Yeni Müşteri Ekle' : 'Add New Customer'}</span>
              </button>
            </>
          )}
        </div>
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
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">{lang === 'tr' ? 'Proje Numarası' : 'Project Number'}</label>
                <input 
                  value={editingProject.projectNumber || ''}
                  onChange={e => setEditingProject({...editingProject, projectNumber: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-sm outline-none focus:border-blue-500/50 font-mono"
                  placeholder="ALU-2026-1001"
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

      {/* Customer Detailed Quotations Modal */}
      {selectedCustomerDetail && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto print:p-0 print:static print:bg-white print:block print:overflow-visible" onClick={() => setSelectedCustomerDetail(null)}>
          <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden my-8 animate-in zoom-in-95 duration-200 print:bg-white print:border-none print:shadow-none print:my-0 print:w-full print:max-w-none print:rounded-none print:text-black" onClick={e => e.stopPropagation()}>
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-50 dark:bg-slate-800/50 gap-4 print:bg-white print:border-slate-300 print:py-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black text-lg print:border-slate-300 print:text-blue-900">
                  {selectedCustomerDetail.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-extrabold text-slate-900 dark:text-white print:text-slate-950">{selectedCustomerDetail.name}</h2>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${
                      selectedCustomerDetail.status === 'active'
                        ? 'bg-emerald-100 border-emerald-300 text-emerald-800 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400 print:bg-emerald-50 print:border-emerald-300 print:text-emerald-800'
                        : 'bg-rose-100 border-rose-300 text-rose-800 dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-500 print:bg-rose-50 print:border-rose-300 print:text-rose-800'
                    }`}>
                      {selectedCustomerDetail.status === 'active' ? (lang === 'tr' ? 'Aktif' : 'Active') : (lang === 'tr' ? 'Engelli' : 'Blocked')}
                    </span>
                  </div>
                  {selectedCustomerDetail.company && (
                    <p className="text-blue-600 dark:text-blue-400 text-xs font-bold uppercase tracking-wider print:text-blue-900">{selectedCustomerDetail.company}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end print:hidden">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-lg shadow-emerald-500/20"
                  title={lang === 'tr' ? 'Raporu Yazdır / PDF İndir' : 'Print / Save PDF'}
                >
                  <Printer size={14} />
                  {lang === 'tr' ? 'PDF / Rapor Yazdır' : 'Print PDF Report'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const custToEdit = selectedCustomerDetail;
                    setSelectedCustomerDetail(null);
                    setEditingCustomer(custToEdit);
                    setIsAddingCustomer(false);
                  }}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all"
                >
                  <Edit2 size={14} />
                  {lang === 'tr' ? 'Müşteriyi Düzenle' : 'Edit Customer'}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCustomerDetail(null)}
                  className="text-slate-500 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto print:max-h-none print:overflow-visible print:p-0 print:space-y-4">
              
              {/* Printable Enterprise Header (Only visible on print) */}
              <div className="hidden print:flex justify-between items-start border-b-2 border-slate-300 pb-4 mb-4">
                <div className="flex items-center gap-3">
                  <Logo className="w-10 h-10" theme="light" />
                  <div>
                    <h1 className="text-xl font-black text-slate-950 uppercase tracking-tight">
                      {lang === 'tr' ? 'MÜŞTERİ ÖZEL RAPORU VE TEKLİF GEÇMİŞİ' : 'CUSTOMER SPECIAL REPORT & QUOTATION SUMMARY'}
                    </h1>
                    <p className="text-slate-600 text-xs font-semibold mt-0.5">
                      Vizyon Pergola Suite • {new Date().toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US')}
                    </p>
                  </div>
                </div>
                <div className="text-right text-xs text-slate-700 font-mono">
                  <div className="font-bold text-slate-950 text-sm">{selectedCustomerDetail.name}</div>
                  {selectedCustomerDetail.company && <div className="text-blue-900 font-bold">{selectedCustomerDetail.company}</div>}
                  <div className="mt-1 text-slate-500">{lang === 'tr' ? 'Hazırlayan Firma: ' : 'Company: '} {displayName}</div>
                </div>
              </div>

              {/* Customer Contact & Meta Bar */}
              <div className="bg-slate-100 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-white/5 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs print:bg-slate-50 print:border-slate-300 print:text-slate-900">
                <div>
                  <span className="text-slate-600 dark:text-slate-400 block text-[10px] font-bold uppercase tracking-wider mb-1 print:text-slate-600">{lang === 'tr' ? 'İLETİŞİM BİLGİLERİ' : 'CONTACT INFO'}</span>
                  {selectedCustomerDetail.phone && <div className="text-slate-900 dark:text-slate-200 font-medium print:text-slate-900 flex items-center gap-1.5 mb-1"><Phone size={12} className="text-slate-500 shrink-0 print:text-slate-700" /> {selectedCustomerDetail.phone}</div>}
                  {selectedCustomerDetail.email && <div className="text-slate-900 dark:text-slate-200 font-medium print:text-slate-900 flex items-center gap-1.5"><Mail size={12} className="text-slate-500 shrink-0 print:text-slate-700" /> <span className="break-all">{selectedCustomerDetail.email}</span></div>}
                  {!selectedCustomerDetail.phone && !selectedCustomerDetail.email && <span className="text-slate-500 italic">{lang === 'tr' ? 'İletişim bilgisi yok' : 'No contact info'}</span>}
                </div>
                <div>
                  <span className="text-slate-600 dark:text-slate-400 block text-[10px] font-bold uppercase tracking-wider mb-1 print:text-slate-600">{lang === 'tr' ? 'ADRES' : 'ADDRESS'}</span>
                  {selectedCustomerDetail.address ? (
                    <p className="text-slate-900 dark:text-slate-200 font-medium print:text-slate-900 leading-snug flex items-start gap-1.5"><MapPin size={12} className="text-slate-500 shrink-0 mt-0.5 print:text-slate-700" /> {selectedCustomerDetail.address}</p>
                  ) : (
                    <span className="text-slate-500 italic">{lang === 'tr' ? 'Adres girilmemiş' : 'No address'}</span>
                  )}
                </div>
              </div>

              {/* Executive Report KPIs for Customer */}
              {(() => {
                const cStats = getCustomerStats(selectedCustomerDetail);
                return (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <h3 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-widest flex items-center gap-2 print:text-slate-900">
                        <TrendingUp size={14} className="text-emerald-600 dark:text-emerald-400 print:text-emerald-700" />
                        {lang === 'tr' ? 'MÜŞTERİ TEKLİF VE SİPARİŞ RAPORU' : 'CUSTOMER BIDS & ORDER PERFORMANCE'}
                      </h3>
                      <span className="text-[11px] font-extrabold text-emerald-800 bg-emerald-100 dark:bg-emerald-500/20 dark:text-emerald-300 px-2.5 py-1 rounded-lg border border-emerald-300 dark:border-emerald-500/30 print:bg-emerald-50 print:border-emerald-300 print:text-emerald-800">
                        {lang === 'tr' ? 'Sipariş Oranı' : 'Conversion'}: %{cStats.conversionRate}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 print:grid-cols-4">
                      {/* KPI 1: Verilen Teklifler */}
                      <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-xl border border-blue-200 dark:border-blue-800/40 relative overflow-hidden shadow-sm print:bg-slate-50 print:border-slate-300">
                        <span className="text-[10px] font-extrabold text-blue-900 dark:text-blue-300 uppercase tracking-wider block mb-1 print:text-slate-600">
                          {lang === 'tr' ? 'VERİLEN TEKLİFLER' : 'ISSUED PROPOSALS'}
                        </span>
                        <div className="text-lg font-black text-slate-950 dark:text-white font-mono print:text-slate-950">
                          ${cStats.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-1 flex justify-between print:text-slate-700">
                          <span>{cStats.totalCount} {lang === 'tr' ? 'Teklif Projesi' : 'Proposals'}</span>
                          <span className="text-slate-600 dark:text-slate-400 print:text-slate-600">{cStats.totalAreaM2.toFixed(1)} m²</span>
                        </div>
                        <div className="absolute top-0 right-0 w-1.5 h-full bg-blue-500 print:hidden"></div>
                      </div>

                      {/* KPI 2: Siparişe Dönüşenler */}
                      <div className="bg-emerald-50 dark:bg-emerald-950/30 p-4 rounded-xl border border-emerald-200 dark:border-emerald-800/40 relative overflow-hidden shadow-sm print:bg-emerald-50 print:border-emerald-300">
                        <span className="text-[10px] font-extrabold text-emerald-900 dark:text-emerald-300 uppercase tracking-wider block mb-1 print:text-emerald-800">
                          {lang === 'tr' ? 'SİPARİŞE DÖNÜŞEN' : 'CONVERTED ORDERS'}
                        </span>
                        <div className="text-lg font-black text-emerald-950 dark:text-emerald-300 font-mono print:text-emerald-900">
                          ${cStats.approvedValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-xs font-bold text-emerald-800 dark:text-emerald-300 mt-1 flex justify-between print:text-emerald-800">
                          <span>{cStats.approvedCount} {lang === 'tr' ? 'Onaylı Sipariş' : 'Orders'}</span>
                          <span className="font-mono">% {cStats.conversionRate}</span>
                        </div>
                        <div className="absolute top-0 right-0 w-1.5 h-full bg-emerald-500 print:hidden"></div>
                      </div>

                      {/* KPI 3: Taslak / Bekleyen */}
                      <div className="bg-amber-50 dark:bg-amber-950/30 p-4 rounded-xl border border-amber-200 dark:border-amber-800/40 relative overflow-hidden shadow-sm print:bg-amber-50 print:border-amber-300">
                        <span className="text-[10px] font-extrabold text-amber-900 dark:text-amber-300 uppercase tracking-wider block mb-1 print:text-amber-800">
                          {lang === 'tr' ? 'BEKLEYEN / TASLAK' : 'DRAFT / PENDING'}
                        </span>
                        <div className="text-lg font-black text-amber-950 dark:text-amber-300 font-mono print:text-amber-900">
                          ${cStats.draftValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-xs font-bold text-amber-800 dark:text-amber-300 mt-1 print:text-amber-800">
                          {cStats.draftCount} {lang === 'tr' ? 'Bekleyen Teklif' : 'Drafts'}
                        </div>
                        <div className="absolute top-0 right-0 w-1.5 h-full bg-amber-500 print:hidden"></div>
                      </div>

                      {/* KPI 4: Poz & Metraj Hacmi */}
                      <div className="bg-indigo-50 dark:bg-indigo-950/30 p-4 rounded-xl border border-indigo-200 dark:border-indigo-800/40 relative overflow-hidden shadow-sm print:bg-slate-50 print:border-slate-300">
                        <span className="text-[10px] font-extrabold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider block mb-1 print:text-blue-900">
                          {lang === 'tr' ? 'İMALAT & METRAJ HACMİ' : 'UNITS & SURFACE'}
                        </span>
                        <div className="text-lg font-black text-indigo-950 dark:text-white font-mono print:text-slate-950">
                          {cStats.totalUnitsCount} <span className="text-xs font-normal text-slate-600 dark:text-slate-400 print:text-slate-600">{lang === 'tr' ? 'Poz (Doğrama)' : 'Units'}</span>
                        </div>
                        <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-1 flex justify-between print:text-slate-700">
                          <span>{lang === 'tr' ? 'Toplam Metraj:' : 'Total Surface:'}</span>
                          <span className="text-indigo-900 dark:text-blue-300 font-mono print:text-blue-900">{cStats.totalAreaM2.toFixed(1)} m²</span>
                        </div>
                        <div className="absolute top-0 right-0 w-1.5 h-full bg-indigo-500 print:hidden"></div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Blocked note if any */}
              {selectedCustomerDetail.status === 'blocked' && selectedCustomerDetail.notes && (
                <div className="p-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-xl text-rose-900 dark:text-rose-300 text-xs flex items-start gap-2.5 print:bg-rose-50 print:border-rose-300 print:text-rose-900">
                  <AlertOctagon size={16} className="text-rose-600 dark:text-rose-500 shrink-0 mt-0.5 print:text-rose-700" />
                  <div>
                    <span className="font-extrabold text-rose-700 dark:text-rose-400 block text-[10px] uppercase tracking-wider print:text-rose-800">{lang === 'tr' ? 'ENGELLEME GEREKÇESİ' : 'BLOCK REASON'}</span>
                    <p className="mt-0.5 font-medium">{selectedCustomerDetail.notes}</p>
                  </div>
                </div>
              )}

              {/* Quotes / Proposals List Header */}
              <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3 print:border-slate-300">
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2 print:text-slate-950">
                    <FileText size={16} className="text-blue-600 dark:text-blue-400 print:text-blue-800" />
                    {lang === 'tr' ? 'Müşteriye Verilen Tüm Teklifler ve Projeler' : 'All Quotes & Issued Proposals'}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 print:text-slate-600">
                    {lang === 'tr' ? 'Teklif detaylarına erişmek ve düzenlemek için ilgili teklife tıklayabilirsiniz.' : 'Click on any proposal to view or edit details directly.'}
                  </p>
                </div>
                
                <button
                  onClick={() => {
                    setSelectedCustomerDetail(null);
                    onCreateProject();
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-sm print:hidden"
                >
                  <Plus size={14} />
                  {lang === 'tr' ? 'Yeni Teklif Oluştur' : 'Create Proposal'}
                </button>
              </div>

              {/* Table of Proposals */}
              {(() => {
                const custProjects = getCustomerProjects(selectedCustomerDetail);
                if (custProjects.length === 0) {
                  return (
                    <div className="text-center py-12 bg-slate-50 dark:bg-slate-950/40 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 text-slate-600 dark:text-slate-400 space-y-3 print:bg-slate-50 print:border-slate-300">
                      <FileText size={32} className="mx-auto text-slate-400 dark:text-slate-600 print:text-slate-400" />
                      <p className="text-sm font-medium print:text-slate-700">
                        {lang === 'tr' ? 'Bu müşteriye ait henüz bir teklif veya proje kaydı bulunmamaktadır.' : 'No proposals found for this customer.'}
                      </p>
                      <button
                        onClick={() => {
                          setSelectedCustomerDetail(null);
                          onCreateProject();
                        }}
                        className="px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-blue-700 dark:text-blue-400 rounded-xl font-bold text-xs inline-flex items-center gap-1.5 transition-all border border-slate-200 dark:border-slate-700 shadow-sm print:hidden"
                      >
                        <Plus size={14} />
                        {lang === 'tr' ? 'Bu Müşteriye İlk Teklifi Oluştur' : 'Create First Proposal'}
                      </button>
                    </div>
                  );
                }

                return (
                  <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-950/50 print:border-slate-300 print:bg-white print:overflow-visible shadow-sm">
                    <table className="w-full text-xs text-left print:text-slate-950">
                      <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 uppercase font-black text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700 print:bg-slate-100 print:text-slate-900 print:border-slate-300">
                        <tr>
                          <th className="p-3">{lang === 'tr' ? 'Proje No / Ref' : 'Ref No'}</th>
                          <th className="p-3">{lang === 'tr' ? 'Proje Adı' : 'Project Name'}</th>
                          <th className="p-3">{lang === 'tr' ? 'Tarih' : 'Date'}</th>
                          <th className="p-3 text-center">{lang === 'tr' ? 'Poz Sayısı' : 'Positions'}</th>
                          <th className="p-3 text-center">{lang === 'tr' ? 'Metraj (m²)' : 'Area (m²)'}</th>
                          <th className="p-3 text-right">{lang === 'tr' ? 'Teklif Tutarı' : 'Est. Amount'}</th>
                          <th className="p-3 text-center">{lang === 'tr' ? 'Durum' : 'Status'}</th>
                          <th className="p-3 text-right print:hidden">{lang === 'tr' ? 'İşlem' : 'Action'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80 print:divide-slate-200">
                        {custProjects.map((proj) => {
                          const cost = calculateProjectCost(proj, systems, accessories);
                          const pUnitsCount = (proj.units || []).reduce((sum, u) => sum + (u.quantity || 1), 0);
                          const pAreaM2 = (proj.units || []).reduce((sum, u) => sum + (((u.width * u.height) / 1000000) * (u.quantity || 1)), 0);

                          return (
                            <tr key={proj.id} className="bg-white dark:bg-slate-900/40 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors group print:hover:bg-transparent">
                              <td className="p-3 font-mono font-bold text-blue-700 dark:text-blue-400 print:text-blue-900">
                                {proj.projectNumber || `ALU-${new Date(proj.date).getFullYear() || 2026}-${proj.id.slice(0, 4).toUpperCase()}`}
                              </td>
                              <td className="p-3 font-extrabold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-300 print:text-slate-950">
                                {proj.name}
                              </td>
                              <td className="p-3 text-slate-600 dark:text-slate-300 font-medium print:text-slate-700">
                                {proj.date}
                              </td>
                              <td className="p-3 text-center font-bold text-slate-800 dark:text-slate-200 print:text-slate-950">
                                {pUnitsCount} {lang === 'tr' ? 'Poz' : 'Units'}
                              </td>
                              <td className="p-3 text-center font-mono font-bold text-slate-700 dark:text-slate-300 print:text-slate-950">
                                {pAreaM2.toFixed(1)} m²
                              </td>
                              <td className="p-3 text-right font-mono font-black text-emerald-700 dark:text-emerald-400 print:text-emerald-800 text-sm">
                                ${cost.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="p-3 text-center">
                                <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-tight border ${
                                  proj.status === 'Draft' ? 'bg-amber-100 border-amber-300 text-amber-900 dark:bg-yellow-500/10 dark:border-yellow-500/20 dark:text-yellow-500 print:bg-yellow-50 print:border-yellow-300 print:text-yellow-800' :
                                  proj.status === 'Production' ? 'bg-emerald-100 border-emerald-300 text-emerald-900 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400 print:bg-emerald-50 print:border-emerald-300 print:text-emerald-800' :
                                  'bg-slate-100 border-slate-300 text-slate-800 dark:bg-slate-500/10 dark:border-slate-500/20 dark:text-slate-400 print:bg-slate-100 print:border-slate-300 print:text-slate-800'
                                }`}>
                                  {getStatusLabel(proj.status)}
                                </span>
                              </td>
                              <td className="p-3 text-right print:hidden">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedCustomerDetail(null);
                                    onSelectProject(proj.id);
                                  }}
                                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs transition-all inline-flex items-center gap-1.5 shadow-sm shadow-blue-500/20"
                                >
                                  <FileCheck size={14} />
                                  {lang === 'tr' ? 'Teklifi Aç' : 'Open Quote'}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-100 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-slate-600 dark:text-slate-400 print:hidden">
              <span className="font-medium">{lang === 'tr' ? 'Alumetric Müşteri & Teklif Yönetim Modülü' : 'Alumetric Client & Proposal Engine'}</span>
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-lg shadow-emerald-500/20"
                >
                  <Printer size={14} />
                  {lang === 'tr' ? 'PDF / Rapor Yazdır' : 'Print PDF Report'}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCustomerDetail(null)}
                  className="px-5 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-300 rounded-xl font-bold transition-all"
                >
                  {lang === 'tr' ? 'Kapat' : 'Close'}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
      
      <div className="border-t border-white/5 py-8 mt-12 text-center text-sm text-slate-600">
          <p>&copy; {new Date().getFullYear()} Vizyon Pergola Suite.</p>
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
