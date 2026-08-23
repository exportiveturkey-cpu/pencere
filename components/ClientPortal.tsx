import React, { useState, useRef, useEffect } from 'react';
import { Project, ProfileSystem, Accessory, Language, WindowNode } from '../types';
import { t } from '../translations';
import Visualizer, { getViewBoxWithDimensions } from './Visualizer';
import { PlanKesitSVG, BoyKesitSVG } from './LogikalSections';
import { 
  Sparkles, CheckCircle2, AlertOctagon, HelpCircle, PenTool,
  Printer, ArrowLeftRight, ClipboardCheck, MessageSquare, 
  User, Calendar, Landmark, Coins, FileCheck, CircleDollarSign
} from 'lucide-react';
import { cloud_saveProject } from '../services/authService';
import { getSystemForUnit } from './ProjectView';

const hasOpenablePanes = (node: WindowNode | undefined): boolean => {
  if (!node) return false;
  if (node.type === 'sash' || (node.openingType && node.openingType !== 'fixed')) return true;
  if (node.children) {
    return node.children.some(child => hasOpenablePanes(child));
  }
  return false;
};

interface ClientPortalProps {
  licenseKey: string;
  projectId: string;
  project: Project;
  systems: ProfileSystem[];
  accessories: Accessory[];
  lang: Language;
  onBackToApp?: () => void;
}

export const ClientPortal: React.FC<ClientPortalProps> = ({
  licenseKey,
  projectId,
  project,
  systems,
  accessories,
  lang,
  onBackToApp
}) => {
  const [currencySymbol] = useState('$');
  const [notes, setNotes] = useState('');
  const [signatoryName, setSignatoryName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Signature canvas refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const sigContainerRef = useRef<HTMLDivElement | null>(null);

  const getOpeningTypeName = (type: string) => {
    switch (type) {
      case 'turn-left': return t(lang, 'turnLeft');
      case 'turn-right': return t(lang, 'turnRight');
      case 'tilt-turn-left': return t(lang, 'tiltTurnLeft');
      case 'tilt-turn-right': return t(lang, 'tiltTurnRight');
      case 'sliding': return t(lang, 'sliding');
      case 'tilt': return t(lang, 'tilt');
      default: return t(lang, 'fixed');
    }
  };

  // Rates and Price summary calculations
  const calculateUnitBOM = (unit: any, sys: ProfileSystem) => {
    const w = unit.width;
    const h = unit.height;
    const qty = unit.quantity || 1;

    // Approximate profiles used
    const framePerimeter = 2 * (w + h) / 1000;
    const sashPerimeter = unit.rootNode.openingType && unit.rootNode.openingType !== 'fixed' ? 2 * (w + h) / 1000 : 0;
    
    // Estimate glass square meters
    const glassSqm = (w * h) / 1000000;
    const glassPrice = unit.customGlassPrice || (unit.includeGlass !== false ? 35 : 0);
    const glassCost = glassSqm * glassPrice * qty;

    // Profile cost
    const profileCost = framePerimeter * sys.pricePerMeter * qty + sashPerimeter * sys.pricePerMeter * qty;

    // Accessories cost
    let accessoryCost = 0;
    const selectedAccs: any[] = [];
    if (unit.selectedHandle) {
      const acc = accessories.find(a => a.id === unit.selectedHandle);
      if (acc) {
        accessoryCost += acc.price * qty;
        selectedAccs.push({ name: acc.name, price: acc.price, qty, unit: 'pce', type: 'handle' });
      }
    }
    if (unit.selectedLock) {
      const acc = accessories.find(a => a.id === unit.selectedLock);
      if (acc) {
        accessoryCost += acc.price * qty;
        selectedAccs.push({ name: acc.name, price: acc.price, qty, unit: 'pce', type: 'lock' });
      }
    }

    const itemCost = profileCost + glassCost + accessoryCost;
    return {
      cost: parseFloat((itemCost).toFixed(2)),
      glassCost,
      profileCost,
      accCost: accessoryCost,
      selectedAccs
    };
  };

  const projectTotalStats = React.useMemo(() => {
    let subTotal = 0;
    const itemsStats = project.units.map(unit => {
      const sys = getSystemForUnit(unit, systems);
      const bom = calculateUnitBOM(unit, sys);
      const totalCost = bom.cost * (unit.quantity || 1);
      subTotal += totalCost;
      return { unit, bom, totalCost };
    });

    const discountPercentage = project.discountPercentage || 0;
    const discountAmount = subTotal * (discountPercentage / 100);
    const discountedSubTotal = subTotal - discountAmount;
    
    const taxRate = project.isExport ? 0 : 20;
    const vatAmount = discountedSubTotal * (taxRate / 100);
    const grandTotal = discountedSubTotal + vatAmount;

    return {
      subTotal,
      discountPercentage,
      discountAmount,
      discountedSubTotal,
      vatAmount,
      grandTotal,
      itemsStats
    };
  }, [project, systems, accessories]);

  // Setup signature drawing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = '#312e81'; // dark indigo
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Handle high DPI display for crisp signature
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
  }, [project]);

  const getCoordinates = (e: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    // Check if touch or mouse event
    if (e.touches && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }
  };

  const startDrawing = (e: any) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const coords = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    setIsDrawing(true);
  };

  const draw = (e: any) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const coords = getCoordinates(e);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const submitPreference = async (decision: 'Approved' | 'ChangesRequested') => {
    if (decision === 'Approved' && !signatoryName.trim()) {
      alert(lang === 'tr' 
        ? "Lütfen onaylayan yetkili ismini giriniz." 
        : "Please enter the signatory name to authorize.");
      return;
    }

    setSubmitting(true);
    try {
      let signatureDataUrl = '';
      if (decision === 'Approved' && canvasRef.current) {
        // Capture signature data
        signatureDataUrl = canvasRef.current.toDataURL('image/png');
      }

      const updatedProject: Project = {
        ...project,
        // Save client feedback and sign details directly inside fields of project
        clientApprovalStatus: decision,
        clientApprovalNotes: notes,
        clientSignatureName: signatoryName,
        clientSignatureDate: new Date().toLocaleString(),
        clientSignatureData: signatureDataUrl,
        // Also update standard app status safely so it highlights on representative's panel
        status: decision === 'Approved' ? 'Production' : 'Draft'
      };

      await cloud_saveProject(licenseKey, updatedProject);

      if (decision === 'Approved') {
        setSuccessMsg(lang === 'tr' 
          ? "Tebrikler! Teklif dijital imzanızla başarıyla onaylandı. Satış temsilcimiz işlem sürecini başlattı." 
          : "Congratulations! The bid has been digitally signed and approved successfully. Our production department will initiate manufacturing.");
      } else {
        setSuccessMsg(lang === 'tr'
          ? "Revizyon ve değişiklik talebiniz sisteme kaydedildi. Temsilcimiz güncel teklifle en kısa sürede dönüş yapacaktır."
          : "Your revision request has been cataloged. Our technical advisor will review your notes and update the quotation shortly.");
      }
      
      // Mutate original object locally as well
      project.clientApprovalStatus = decision;
      project.clientApprovalNotes = notes;
      project.clientSignatureName = signatoryName;
      project.clientSignatureDate = updatedProject.clientSignatureDate;
      project.clientSignatureData = signatureDataUrl;
      project.status = updatedProject.status;

    } catch (err: any) {
      console.error(err);
      alert(lang === 'tr' ? "Bağlantı hatası oluştu, lütfen tekrar deneyin." : "Connection failed, please retry.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 selection:bg-indigo-500 selection:text-white pb-16">
      
      {/* Decorative top bar */}
      <div className="h-2 bg-gradient-to-r from-violet-600 via-indigo-600 to-sky-600 w-full" />

      {/* Main container */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-10">
        
        {/* Navigation & Actions Header */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-10 pb-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-400 border border-indigo-500/20">
              <ClipboardCheck size={20} />
            </div>
            <div>
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block">
                {lang === 'tr' ? 'Etkileşimli Dijital Teklif Portalı' : 'Interactive Digital Bid Portal'}
              </span>
              <h2 className="text-xl font-extrabold text-white">Alumetric Suite Online</h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all border border-white/5"
            >
              <Printer size={14} />
              {lang === 'tr' ? 'Yazdır / PDF Sakla' : 'Print / Save PDF'}
            </button>
            {onBackToApp && (
              <button 
                onClick={onBackToApp}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-500/15"
              >
                <ArrowLeftRight size={14} />
                {lang === 'tr' ? 'Panele Geri Dön' : 'Admin Panel'}
              </button>
            )}
          </div>
        </div>

        {successMsg ? (
          <div className="bg-slate-950/40 border border-emerald-500/30 rounded-3xl p-8 text-center max-w-2xl mx-auto my-12 animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-400 border border-emerald-500/20 mx-auto mb-6">
              <CheckCircle2 size={36} className="animate-bounce" />
            </div>
            <h3 className="text-2xl font-extrabold text-white mb-4">
              {lang === 'tr' ? 'İşlem Başarıyla Tamamlandı' : 'Request Processed Successfully'}
            </h3>
            <p className="text-slate-300 text-sm leading-relaxed mb-8">
              {successMsg}
            </p>
            <div className="flex justify-center gap-4">
              <button 
                onClick={() => setSuccessMsg(null)}
                className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all border border-white/5"
              >
                {lang === 'tr' ? 'Teklifi Görüntüle' : 'Review Proposal'}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left Column - Bid details */}
            <div id="print-sheet" className="lg:col-span-2 space-y-6">
              
              {/* Proposal Corporate Top Sheet Card */}
              <div className="bg-slate-950/30 border border-white/5 rounded-3xl p-6 sm:p-8 space-y-6 print:bg-white print:border-none print:text-black">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-6 border-b border-white/5 print:border-slate-200">
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight print:text-slate-900">
                      {lang === 'tr' ? 'DİJİTAL MÜHENDİSLİK TEKLİFİ' : 'TECHNICAL ENGINEERING QUOTATION'}
                    </h1>
                    {project.projectNumber && (
                      <div className="text-sm font-black text-indigo-400 print:text-indigo-700 font-mono mt-1.5 tracking-wider">
                        {lang === 'tr' ? 'TEKLİF NO' : 'QUOTATION NO'}: {project.projectNumber}
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-slate-400 font-medium">
                      <span className="flex items-center gap-1"><Calendar size={13} /> {project.date || '---'}</span>
                      <span className="h-3 w-[1px] bg-white/10" />
                      <span className="flex items-center gap-1 font-mono text-indigo-400">ID: {project.id.slice(0, 8)}</span>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="shrink-0">
                    {project.clientApprovalStatus === 'Approved' ? (
                      <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                        <CheckCircle2 size={12} /> {lang === 'tr' ? 'Müşteri Onaylı' : 'Client Approved'}
                      </span>
                    ) : project.clientApprovalStatus === 'ChangesRequested' ? (
                      <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20">
                        <AlertOctagon size={12} /> {lang === 'tr' ? 'Revizyon İstendi' : 'Revision Requested'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold text-sky-400 bg-sky-500/10 border border-sky-500/20">
                        <HelpCircle size={12} className="animate-pulse" /> {lang === 'tr' ? 'Onay Bekliyor' : 'Awaiting Approval'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Client / Provider information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                  <div className="p-4 bg-slate-900 border border-white/5 rounded-2xl print:bg-slate-50 print:border-slate-200">
                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block mb-2">{lang === 'tr' ? 'MÜŞTERİ DETAYLARI' : 'CLIENT SPECIFICATIONS'}</span>
                    <div className="space-y-1">
                      <div className="font-extrabold text-white print:text-slate-900 text-base">{project.client}</div>
                      <div className="text-slate-400 print:text-slate-600 text-xs">{lang === 'tr' ? `Proje Sorumlusu: ${project.client}` : `Attention: ${project.client}`}</div>
                      <div className="text-slate-400 print:text-slate-600 text-xs">{lang === 'tr' ? 'Proje İsimlendirmesi' : 'Project Tag'}: <span className="font-semibold text-slate-200 print:text-slate-800">{project.name}</span></div>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-900 border border-white/5 rounded-2xl print:bg-slate-50 print:border-slate-200">
                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block mb-2">{lang === 'tr' ? 'HİZMET SAĞLAYICI' : 'PROVIDER SPECIFICATIONS'}</span>
                    <div className="space-y-1">
                      <div className="font-extrabold text-white print:text-slate-900 text-base">Alumetric Engineering Works</div>
                      <div className="text-slate-400 print:text-slate-600 text-xs">Alaşehir, İzmir Cad. PK 35430, TR</div>
                      <div className="text-slate-400 print:text-slate-600 text-xs">Email: export@alumetric.net</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Positions List */}
              <div className="space-y-6">
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <CircleDollarSign size={18} className="text-indigo-400" />
                  {lang === 'tr' ? 'Teklif Pozları ve Detayları' : 'Quotation Line Items & Specifications'}
                </h3>

                {projectTotalStats.itemsStats.length === 0 ? (
                  <div className="p-8 text-center bg-slate-950/20 border border-dashed border-white/5 rounded-3xl font-bold text-slate-500">
                    {lang === 'tr' ? 'Bu projede henüz poz bulunmamaktadır.' : 'No line positions available in this list.'}
                  </div>
                ) : (
                  projectTotalStats.itemsStats.map(({ unit, bom, totalCost }, idx) => {
                    const sys = getSystemForUnit(unit, systems);
                    return (
                      <div key={unit.id} className="bg-slate-950/30 border border-white/5 rounded-3xl overflow-hidden print:bg-white print:border-slate-200 print:text-black">
                        
                        {/* Unit Title / Price Row */}
                        <div className="p-5 bg-slate-900/50 border-b border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:bg-slate-50 print:border-slate-200">
                          <div className="flex items-center gap-3">
                            <span className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-mono text-sm font-bold flex items-center justify-center">
                              #{idx + 1}
                            </span>
                            <div>
                              <div className="font-extrabold text-white print:text-slate-900 text-base">{unit.name}</div>
                              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 print:text-slate-500">
                                {sys.name} • {unit.quantity || 1} ADET
                              </div>
                            </div>
                          </div>
                          
                          <div className="text-right">
                            <span className="text-[10px] text-slate-500 block font-bold uppercase tracking-widest">{lang === 'tr' ? 'TOPLAM TUTAR' : 'TOTAL PRICE'}</span>
                            <span className="text-lg font-black text-indigo-400 print:text-indigo-700 font-mono">
                              {currencySymbol}{totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>

                        {/* Visualizer and specifications */}
                        <div className="p-6 grid grid-cols-1 md:grid-cols-5 gap-6">
                          
                          {/* Unit visual representation */}
                          <div className="md:col-span-2 flex flex-col items-center justify-center p-4 bg-slate-950/40 border border-white/5 rounded-2xl print:bg-white print:border-none print:p-0 min-h-[220px]">
                            <div className="flex flex-col gap-3 items-center">
                              {/* Elevation drawing & side cross section */}
                              <div className="flex items-center gap-3">
                                {/* Elevation Front View */}
                                <div className="w-36 h-36 bg-slate-900/60 rounded-xl border border-white/5 print:bg-slate-50 print:border-slate-200 p-2 flex items-center justify-center shrink-0">
                                  <svg 
                                    viewBox={getViewBoxWithDimensions(unit.width, unit.height)} 
                                    className="w-full h-full max-h-full max-w-full"
                                    preserveAspectRatio="xMidYMid meet"
                                  >
                                    <Visualizer 
                                      node={unit.rootNode} 
                                      width={unit.width} 
                                      height={unit.height} 
                                      system={sys} 
                                      selectedNodeId={null} 
                                      onSelectNode={() => {}} 
                                      theme="light" 
                                      shape={unit.shape} 
                                      archHeight={unit.archHeight} 
                                      hasThreshold={unit.hasThreshold} 
                                      lang={lang} 
                                      viewPerspective={unit.viewPerspective}
                                    />
                                  </svg>
                                </div>

                                {/* Boy Kesit (Y-Y dikey kesit) */}
                                <div className="w-12 h-36 bg-slate-900/60 rounded-xl border border-white/5 print:bg-slate-50 print:border-slate-200 p-1 flex items-center justify-center shrink-0">
                                  <BoyKesitSVG width={unit.width} height={unit.height} system={sys} isOpenable={hasOpenablePanes(unit.rootNode)} lang={lang} />
                                </div>
                              </div>

                              {/* Plan Kesit (X-X yatay kesit) */}
                              <div className="w-[196px] h-12 bg-slate-900/60 rounded-xl border border-white/5 print:bg-slate-50 print:border-slate-200 p-1 flex items-center justify-center shrink-0">
                                <PlanKesitSVG width={unit.width} height={unit.height} system={sys} isOpenable={hasOpenablePanes(unit.rootNode)} lang={lang} />
                              </div>
                            </div>
                          </div>

                          {/* Specifications table */}
                          <div className="md:col-span-3 space-y-4">
                            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block pb-1 border-b border-dashed border-white/10">
                              {lang === 'tr' ? 'TEKNİK DETAYLAR' : 'TECHNICAL BLUEPRINTS'}
                            </span>
                            
                            <div className="grid grid-cols-2 gap-4 text-xs font-medium">
                              <div>
                                <span className="text-slate-500 block">{lang === 'tr' ? 'Profil Sistemi' : 'Profile System'}</span>
                                <span className="font-bold text-blue-400 print:text-blue-700 text-sm block">
                                  {sys.name}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-500 block">{lang === 'tr' ? 'Genişlik x Yükseklik' : 'Width x Height'}</span>
                                <span className="font-mono text-white print:text-slate-900 font-bold text-sm">
                                  {unit.width} mm x {unit.height} mm
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-500 block">{lang === 'tr' ? 'Açılım Tipi' : 'Opening Mechanism'}</span>
                                <span className="text-white print:text-slate-900 font-bold">
                                  {getOpeningTypeName(unit.rootNode.openingType || 'fixed')}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-500 block">{lang === 'tr' ? 'Cam Kombinasyonu' : 'Double Glazing'}</span>
                                <span className="text-white print:text-slate-900 font-bold whitespace-nowrap overflow-hidden text-ellipsis block">
                                  {unit.glassThickness}mm - {unit.glassType === 'double24' ? 'Double Glazing Planitherm' : 'Triple Climaguard'}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-500 block">{lang === 'tr' ? 'Profil Renk Grubu' : 'Color Finish'}</span>
                                <span className="text-white print:text-slate-900 font-bold capitalize">
                                  {unit.specificColor || (unit.color === 'group1' ? (lang === 'tr' ? 'Ral 9016 Beyaz' : 'Ral 9016 White') : (lang === 'tr' ? 'Ral 7016 Antrasit' : 'Ral 7016 Anthracite'))}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-500 block">{lang === 'tr' ? 'Bakış / Görünüm' : 'View Perspective'}</span>
                                <span className="text-white print:text-slate-900 font-bold">
                                  {unit.viewPerspective === 'exterior' ? (lang === 'tr' ? 'Dıştan Görünüm' : 'Exterior View') : (lang === 'tr' ? 'İçten Görünüm (Standart)' : 'Interior View (Standard)')}
                                </span>
                              </div>
                            </div>

                            {/* Accessory components list if any */}
                            {bom.selectedAccs && bom.selectedAccs.length > 0 && (
                              <div className="pt-2">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">
                                  {lang === 'tr' ? 'Donanım & Aksesuarlar' : 'Custom Options / Accessories'}
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                  {bom.selectedAccs.map((ac: any, sIdx: number) => (
                                    <span key={sIdx} className="inline-flex items-center text-[10px] font-bold bg-indigo-500/5 text-indigo-300 border border-indigo-500/10 px-2 rounded-lg py-1">
                                      {ac.name}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                          </div>

                        </div>

                      </div>
                    );
                  })
                )}
              </div>

            </div>

            {/* Right Column - Client Contract Drawer & Signature */}
            <div className="space-y-6">
              
              {/* Financial Calculation summary block */}
              <div className="bg-slate-950/30 border border-indigo-500/10 rounded-3xl p-6 space-y-4">
                <h4 className="text-xs font-black text-white uppercase tracking-[0.2em]">{lang === 'tr' ? 'MÜHENDİSLİK TEKLİF BEDELİ' : 'FINANCIAL QUOTE SUMMARY'}</h4>
                
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between items-center text-slate-400">
                    <span>{lang === 'tr' ? 'Poz Ara Toplamı' : 'Total Sub'}</span>
                    <span className="font-mono text-slate-200 font-bold">{currencySymbol}{projectTotalStats.subTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  {projectTotalStats.discountPercentage > 0 && (
                    <div className="flex justify-between items-center text-emerald-400 font-semibold">
                      <span>{lang === 'tr' ? `Uygulanan İndirim (-%${projectTotalStats.discountPercentage})` : `Discount Applied (-${projectTotalStats.discountPercentage}%)`}</span>
                      <span>-{currencySymbol}{projectTotalStats.discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  {project.isExport ? (
                    <div className="flex justify-between items-center text-emerald-400 text-[10px] font-bold border-t border-dashed border-white/5 pt-2">
                      <span>{lang === 'tr' ? 'Yurt Dışı İhracat Satışı (KDV Muaf)' : 'International Export (VAT Exempt)'}</span>
                      <span>0% VAT</span>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center text-slate-400 border-t border-dashed border-white/5 pt-2">
                      <span>{lang === 'tr' ? 'KDV Bedeli (%20)' : 'VAT Charge (20%)'}</span>
                      <span className="font-mono text-slate-200 font-bold">{currencySymbol}{projectTotalStats.vatAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center pt-3 border-t border-indigo-500/10">
                    <span className="text-sm font-black text-indigo-400">{lang === 'tr' ? 'GENEL TOPLAM' : 'GRAND TOTAL'}</span>
                    <span className="text-2xl font-black text-white font-mono">{currencySymbol}{projectTotalStats.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              {/* Signature / approval interaction module */}
              <div className="bg-slate-950/30 border border-white/5 rounded-3xl p-6 space-y-6">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <PenTool size={16} className="text-indigo-400" />
                    {lang === 'tr' ? 'Dijital İmza & Onay' : 'Digital Sign & Accept'}
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">
                    {lang === 'tr' 
                      ? "Teklifi onaylamak için isminizi girip imza alanına imzanızı sürükleyerek çiziniz." 
                      : "To accept the proposal, fill in your credentials and complete the signature track."}
                  </p>
                </div>

                {project.clientApprovalStatus === 'Approved' ? (
                  <div className="space-y-4 pt-2">
                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-center space-y-2">
                      <CheckCircle2 className="text-emerald-400 mx-auto" size={28} />
                      <div className="text-xs font-extrabold text-white uppercase tracking-wider">{lang === 'tr' ? 'TEKLİF ONAYLANDI' : 'PROPOSAL DIGITALLY SIGNED'}</div>
                      <div className="text-[10px] text-emerald-300 font-mono">{project.clientSignatureDate}</div>
                    </div>

                    <div className="text-xs space-y-2 border-t border-white/5 pt-4">
                      <div>
                        <span className="text-slate-500 block">{lang === 'tr' ? 'Onaylayan Yetkili:' : 'Signatory Representative:'}</span>
                        <span className="font-bold text-white uppercase">{project.clientSignatureName || '---'}</span>
                      </div>
                      
                      {project.clientSignatureData && (
                        <div>
                          <span className="text-slate-500 block mb-2">{lang === 'tr' ? 'Dijital İmza İzi:' : 'Digital Signature Trace:'}</span>
                          <div className="bg-white rounded-xl p-2 flex items-center justify-center max-w-[150px]">
                            <img src={project.clientSignatureData} alt="Client Signature" className="max-h-20 object-contain" />
                          </div>
                        </div>
                      )}
                      
                      {project.clientApprovalNotes && (
                        <div>
                          <span className="text-slate-500 block">{lang === 'tr' ? 'Onay Notları:' : 'Signature Remarks:'}</span>
                          <span className="text-slate-300 block bg-slate-900/60 p-2.5 rounded-lg italic">
                            "{project.clientApprovalNotes}"
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Signatory name input */}
                    <div>
                      <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block mb-1.5">
                        {lang === 'tr' ? 'YETKİLİ ADI SOYADI *' : 'REPRESENTATIVE NAME *'}
                      </label>
                      <div className="relative">
                        <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                        <input 
                          type="text" 
                          value={signatoryName}
                          onChange={e => setSignatoryName(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white outline-none focus:border-indigo-500 placeholder-slate-600"
                          placeholder="e.g. John Doe / Ahmet Yılmaz"
                        />
                      </div>
                    </div>

                    {/* Feedback note input */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">
                        {lang === 'tr' ? 'REVİZYON VEYA ONAY NOTU' : 'FEEDBACK OR DECISION REMARKS'}
                      </label>
                      <div className="relative">
                        <MessageSquare className="absolute left-3.5 top-3.5 text-slate-500" size={14} />
                        <textarea 
                          value={notes}
                          onChange={e => setNotes(e.target.value)}
                          rows={2.5}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-xs text-white outline-none focus:border-indigo-500 placeholder-slate-600 resize-none font-sans"
                          placeholder={lang === 'tr' ? 'E.g. Kol rengi antrasit olsun, teslimat İzmir adresi vb.' : 'E.g. Change delivery terms, customize handle colors, etc.'}
                        />
                      </div>
                    </div>

                    {/* Signature Canvas Drawing Area */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5 font-bold uppercase tracking-widest text-[10px]">
                        <span className="text-indigo-400">{lang === 'tr' ? 'İMZA ALANI *' : 'SIGNATURE BOX *'}</span>
                        <button type="button" onClick={clearCanvas} className="text-rose-400 text-[10px] font-black hover:text-rose-300 cursor-pointer">
                          {lang === 'tr' ? 'TEMİZLE' : 'CLEAR'}
                        </button>
                      </div>
                      
                      <div 
                        ref={sigContainerRef}
                        className="bg-slate-950/60 border border-slate-800 rounded-2xl h-36 overflow-hidden cursor-crosshair relative shadow-inner"
                      >
                        <canvas 
                          ref={canvasRef}
                          onMouseDown={startDrawing}
                          onMouseMove={draw}
                          onMouseUp={stopDrawing}
                          onMouseLeave={stopDrawing}
                          onTouchStart={startDrawing}
                          onTouchMove={draw}
                          onTouchEnd={stopDrawing}
                          className="w-full h-full block"
                        />
                        <div className="absolute bottom-2.5 right-2.5 select-none pointer-events-none text-[8px] uppercase tracking-widest font-black text-slate-550 opacity-40">
                          {lang === 'tr' ? 'Fare veya parmakla imza atın' : 'Sign by tracing with finger/mouse'}
                        </div>
                      </div>
                    </div>

                    {/* Dynamic Action submissions */}
                    <div className="pt-2 space-y-3.5">
                      <button 
                        type="button" 
                        disabled={submitting}
                        onClick={() => submitPreference('Approved')}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-extrabold text-xs py-3.5 rounded-xl shadow-lg shadow-emerald-600/10 flex items-center justify-center gap-2 transition-all cursor-pointer"
                      >
                        <FileCheck size={14} />
                        {submitting ? '...' : (lang === 'tr' ? 'KABUL ET VE DİJİTAL İMZALA' : 'APPROVE & DIGITALLY SIGN')}
                      </button>

                      <button 
                        type="button" 
                        disabled={submitting}
                        onClick={() => submitPreference('ChangesRequested')}
                        className="w-full bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
                      >
                        <AlertOctagon size={14} />
                        {submitting ? '...' : (lang === 'tr' ? 'REVİZYON TALEBİ GÖNDER' : 'REQUEST AMENDMENTS')}
                      </button>
                    </div>

                  </div>
                )}
              </div>

            </div>

          </div>
        )}

      </div>
    </div>
  );
};
