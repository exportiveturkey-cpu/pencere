import React, { useState, useMemo } from 'react';
import { Language } from '../types';
import { t } from '../translations';
import { 
  Sparkles, Layers, Flame, Sun, Volume2, Printer, Info, ArrowLeft, 
  CheckCircle2, Calculator, Gauge, Dumbbell, ShieldCheck, Zap
} from 'lucide-react';
import Logo from './Logo';

interface GlassAnalysisProps {
  lang: Language;
  onBack: () => void;
  theme: 'light' | 'dark';
}

type GlazingType = 'single' | 'double' | 'triple';

interface GlassLayer {
  thickness: number; // in mm
  type: 'float' | 'lowE' | 'solarControl' | 'tinted' | 'laminated' | 'acoustic';
}

interface SpacerLayer {
  width: number; // in mm
  gas: 'air' | 'argon';
}

// Pre-configured packages
interface PresetCombination {
  nameTr: string;
  nameEn: string;
  glazingType: GlazingType;
  glassLayers: GlassLayer[];
  spacers: SpacerLayer[];
  descTr: string;
  descEn: string;
}

export const GlassAnalysis: React.FC<GlassAnalysisProps> = ({ lang, onBack, theme }) => {
  const [glazingType, setGlazingType] = useState<GlazingType>('double');
  
  // Layer configurations
  const [glassLayers, setGlassLayers] = useState<GlassLayer[]>([
    { thickness: 4, type: 'solarControl' }, // Outer Layer
    { thickness: 4, type: 'float' },        // Middle Layer (used if triple)
    { thickness: 4, type: 'lowE' },         // Inner Layer
  ]);

  const [spacers, setSpacers] = useState<SpacerLayer[]>([
    { width: 16, gas: 'argon' },            // Spacer 1 (outer-middle or outer-inner)
    { width: 16, gas: 'argon' },            // Spacer 2 (middle-inner)
  ]);

  const glassTypes = useMemo(() => [
    { value: 'float', labelTr: 'Düz Cam (Float)', labelEn: 'Clear Float Glass', color: 'bg-sky-100 border-sky-300', tint: '#e0f2fe' },
    { value: 'lowE', labelTr: 'Solar Low-E (Isıcam K / Sinerji)', labelEn: 'Low-E (Sinerji)', color: 'bg-emerald-100/85 border-emerald-300', tint: '#d1fae5' },
    { value: 'solarControl', labelTr: 'Sinerji Konfor (Isıcam K)', labelEn: 'Solar Control Low-E (Konfor)', color: 'bg-teal-100 border-teal-300', tint: '#ccfbf1' },
    { value: 'tinted', labelTr: 'Renkli Cam (Füme/Bronz)', labelEn: 'Tinted Body Glass', color: 'bg-slate-300 border-slate-400', tint: '#94a3b8' },
    { value: 'laminated', labelTr: 'Lamine Emniyet Camı', labelEn: 'Laminated Safety Glass', color: 'bg-blue-100 border-blue-300', tint: '#dbeafe' },
    { value: 'acoustic', labelTr: 'Akustik Lamine (Gürültü Kontrol)', labelEn: 'Acoustic Laminated (Noise)', color: 'bg-indigo-100 border-indigo-300', tint: '#e0e7ff' },
  ], []);

  const thicknesses = [3, 4, 5, 6, 8, 10, 12];
  const spacerWidths = [6, 9, 12, 14, 15, 16, 18, 20];

  // Helper translations for within the component
  const dict = useMemo(() => ({
    tr: {
      title: 'Cam Performans Analiz Modülü',
      subtitle: 'Alumetric GlassTool™ standardında cam kombinasyonları oluşturun ve performans değerlerini anlık hesaplayın.',
      glassType: 'Cam Tipi',
      thickness: 'Kalınlık',
      spacerWidth: 'Ara Boşluk',
      gasType: 'Gaz Dolgusu',
      glazingCategory: 'Cam Kombinasyonu',
      single: 'Tek Cam',
      double: 'Çift Cam (Isıcam)',
      triple: 'Üçlü Cam',
      outerPane: 'Dış Cam Katmanı (1. Katman)',
      midPane: 'Orta Cam Katmanı (2. Katman)',
      innerPane: 'İç Cam Katmanı',
      spacer1: 'Ara Boşluk 1',
      spacer2: 'Ara Boşluk 2',
      presets: 'Hazır Kombinasyon Paketleri',
      metrics: 'Mühendislik Performans Analizi',
      ugValue: 'Ug Değeri (Isı Geçirgenliği)',
      ugDesc: 'W/m²K cinsinden ısı kaybını gösterir. Düşük olması mükemmel yalıtım anlamına gelir.',
      ltValue: 'Işık Geçirgenliği (LT)',
      ltDesc: 'Doğal gün ışığının içeri girme oranıdır. Yüksek olması odanın daha aydınlık olmasını sağlar.',
      gValue: 'Güneş Faktörü (g-değeri)',
      gDesc: 'Güneş ısısının içeri girme oranı. Yazın serin kalmak için düşük g-değeri istenir.',
      scValue: 'Gölgeme Katsayısı (SC)',
      scDesc: 'Güneş enerjisi geçirgenliğinin 0.87 oranına bölünmüş halidir.',
      rwValue: 'Akustik Yalıtım (Rw)',
      rwDesc: 'dB (Desibel) gürültü azaltma miktarı. Gürültülü caddeler için >38dB önerilir.',
      totThickness: 'Toplam Kombinasyon Kalınlığı',
      weight: 'Cam Birim Ağırlığı',
      combination: 'Kombinasyon Detayları',
      visualizer: 'Güneş Işınları & Enerji Simülasyonu',
      exterior: 'DIŞ ORTAM',
      interior: 'İÇ ORTAM',
      argon: 'Argon %90',
      air: 'Kuru Hava',
      back: 'Geri Dön',
      print: 'Performans Raporu Yazdır',
      perfect: 'Mükemmel',
      good: 'İyi',
      standard: 'Standart',
      poor: 'Yetersiz',
      heatRay: 'Güneş Isısı (Kızılötesi)',
      lightRay: 'Doğal Gün Işığı',
      noiseWave: 'Dış Gürültü Dalgası',
      trappedHeat: 'Hapsedilen Isı',
      soundDampened: 'Sönümlenen Ses'
    },
    en: {
      title: 'Glass Performance Analysis Module',
      subtitle: 'Build glass combinations in Alumetric GlassTool™ standard and calculate performance values instantly.',
      glassType: 'Glass Type',
      thickness: 'Thickness',
      spacerWidth: 'Cavity Spacer',
      gasType: 'Gas Filling',
      glazingCategory: 'Glazing Type',
      single: 'Single Glazing',
      double: 'Double Glazing',
      triple: 'Triple Glazing',
      outerPane: 'Outer Pane (Layer 1)',
      midPane: 'Middle Pane (Layer 2)',
      innerPane: 'Inner Pane',
      spacer1: 'Spacer 1',
      spacer2: 'Spacer 2',
      presets: 'Pre-configured Glass Packages',
      metrics: 'Engineering Performance Analysis',
      ugValue: 'Ug-Value (Thermal Transmittance)',
      ugDesc: 'Indicates heat loss in W/m²K. Lower values mean excellent thermal retention.',
      ltValue: 'Light Transmission (LT)',
      ltDesc: 'The ratio of natural daylight entering inside. Higher means brighter rooms.',
      gValue: 'Solar Factor (g-value)',
      gDesc: 'Solar heat gain ratio. Lower value is preferred for summer solar protection.',
      scValue: 'Shading Coefficient (SC)',
      scDesc: 'Total solar energy transmittance divided by 0.87.',
      rwValue: 'Acoustic Insulation (Rw)',
      rwDesc: 'Decibel (dB) noise reduction. Highly recommended >38dB for loud streets.',
      totThickness: 'Total Glazing Thickness',
      weight: 'Glazing Unit Weight',
      combination: 'Combination Details',
      visualizer: 'Solar Rays & Acoustic Simulation',
      exterior: 'EXTERIOR',
      interior: 'INTERIOR',
      argon: 'Argon 90%',
      air: 'Dry Air',
      back: 'Back',
      print: 'Print Performance Report',
      perfect: 'Excellent',
      good: 'Good',
      standard: 'Standard',
      poor: 'Poor',
      heatRay: 'Solar Heat (Infrared)',
      lightRay: 'Natural Daylight',
      noiseWave: 'Ambient Noise Wave',
      trappedHeat: 'Reflected / Blocked Heat',
      soundDampened: 'Dampened Noise'
    }
  }), []);

  const tLocal = (key: keyof typeof dict['tr']) => {
    return dict[lang === 'tr' ? 'tr' : 'en'][key];
  };

  const presets: PresetCombination[] = useMemo(() => [
    {
      nameTr: 'Maksimum Isı Koruma (Üçlü Pasif Ev)',
      nameEn: 'Maximum Heat Guard (Triple Passive House)',
      glazingType: 'triple',
      glassLayers: [
        { thickness: 4, type: 'solarControl' },
        { thickness: 4, type: 'float' },
        { thickness: 4, type: 'lowE' }
      ],
      spacers: [
        { width: 16, gas: 'argon' },
        { width: 16, gas: 'argon' }
      ],
      descTr: 'Kuzey cepheler ve aşırı soğuk iklimler için 3 katmanlı, çift Argon gazlı şampiyon paket.',
      descEn: 'Triple pane, double Argon-filled champion package for cold climates and northern facades.'
    },
    {
      nameTr: 'Güneş Kalkanı & Konfor (Isıcam K Solar)',
      nameEn: 'Solar Shield & Sun Guard (Isıcam K Comfort)',
      glazingType: 'double',
      glassLayers: [
        { thickness: 6, type: 'solarControl' },
        { thickness: 4, type: 'lowE' }
      ],
      spacers: [
        { width: 16, gas: 'argon' },
        { width: 16, gas: 'air' }
      ],
      descTr: 'Akdeniz ve Ege gibi yazları sıcak geçen bölgelerde klimadan tasarruf ettiren akıllı kombinasyon.',
      descEn: 'Smart combination saving cooling energy in hot regions like Mediterranean.'
    },
    {
      nameTr: 'Maksimum Sessizlik & Güvenlik',
      nameEn: 'Acoustic Silence & Security Pro',
      glazingType: 'double',
      glassLayers: [
        { thickness: 6, type: 'acoustic' },
        { thickness: 4, type: 'lowE' }
      ],
      spacers: [
        { width: 16, gas: 'argon' },
        { width: 16, gas: 'air' }
      ],
      descTr: 'Otoyol kenarı, havalimanı yakınları ve hırsızlık koruması için Akustik Lamine entegreli ultra sessiz paket.',
      descEn: 'Ultra quiet package integrated with Acoustic Laminated for high noise areas and burglary protection.'
    },
    {
      nameTr: 'Standart Isıcam (Klasik Isı Yalıtım)',
      nameEn: 'Standard Eco Double Glazing (4+16+4)',
      glazingType: 'double',
      glassLayers: [
        { thickness: 4, type: 'float' },
        { thickness: 4, type: 'float' }
      ],
      spacers: [
        { width: 16, gas: 'air' },
        { width: 16, gas: 'air' }
      ],
      descTr: 'En ekonomik çözüm. Temel yalıtım ihtiyaçlarını karşılayan standart çift cam.',
      descEn: 'Most economical solution. Standard double glazing satisfying basic insulation demands.'
    }
  ], []);

  const handleApplyPreset = (p: PresetCombination) => {
    setGlazingType(p.glazingType);
    setGlassLayers([...p.glassLayers]);
    setSpacers([...p.spacers]);
  };

  const handleUpdateGlass = (idx: number, field: keyof GlassLayer, value: any) => {
    const updated = [...glassLayers];
    updated[idx] = { ...updated[idx], [field]: value };
    setGlassLayers(updated);
  };

  const handleUpdateSpacer = (idx: number, field: keyof SpacerLayer, value: any) => {
    const updated = [...spacers];
    updated[idx] = { ...updated[idx], [field]: value };
    setSpacers(updated);
  };

  // Live performance calculator engine
  const calcResults = useMemo(() => {
    let ug = 5.8;
    let lt = 90;
    let gVal = 82;
    let rw = 29;

    const layersToCalc = glazingType === 'single' ? [glassLayers[0]] : 
                         glazingType === 'double' ? [glassLayers[0], glassLayers[2]] : 
                         [glassLayers[0], glassLayers[1], glassLayers[2]];

    const spacersToCalc = glazingType === 'single' ? [] : 
                          glazingType === 'double' ? [spacers[0]] : 
                          [spacers[0], spacers[1]];

    // 1. Calculate combined glass thicknesses and weights
    const totalGlassThickness = layersToCalc.reduce((acc, l) => acc + l.thickness, 0);
    const totalSpacerThickness = spacersToCalc.reduce((acc, s) => acc + s.width, 0);
    const totalThickness = totalGlassThickness + totalSpacerThickness;
    const unitWeight = totalGlassThickness * 2.5; // Formula: 2.5kg per mm of glass per m²

    // 2. Base metrics depending on glazing configuration
    if (glazingType === 'single') {
      const g = glassLayers[0];
      if (g.type === 'float') { ug = 5.8; lt = 90; gVal = 82; rw = 29 + (g.thickness > 6 ? 2 : 0); }
      else if (g.type === 'lowE') { ug = 3.6; lt = 80; gVal = 62; rw = 29; }
      else if (g.type === 'solarControl') { ug = 3.6; lt = 70; gVal = 44; rw = 29; }
      else if (g.type === 'tinted') { ug = 5.8; lt = 55; gVal = 48; rw = 29; }
      else if (g.type === 'laminated') { ug = 5.7; lt = 88; gVal = 77; rw = 32; }
      else if (g.type === 'acoustic') { ug = 5.7; lt = 88; gVal = 77; rw = 35; }
    } 
    else if (glazingType === 'double') {
      // Base Double (float 4 + 16 air + float 4)
      ug = 2.7; lt = 81; gVal = 75; rw = 31;

      const outer = glassLayers[0];
      const inner = glassLayers[2];
      const sp = spacers[0];

      // Spacer thickness penalty/bonus
      if (sp.width <= 9) ug += 0.3;
      else if (sp.width <= 12) ug += 0.1;
      else if (sp.width >= 18) ug += 0.1;

      // Gas bonus
      if (sp.gas === 'argon') ug -= 0.25;

      // Coating factors
      const hasLowE = outer.type === 'lowE' || inner.type === 'lowE';
      const hasSolar = outer.type === 'solarControl' || inner.type === 'solarControl';

      if (hasLowE && hasSolar) {
        ug -= 1.6; // double coatings are amazing
        lt = 54;
        gVal = 35;
      } else if (hasSolar) {
        ug -= 1.3;
        lt = 60;
        gVal = 41;
      } else if (hasLowE) {
        ug -= 1.4;
        lt = 72;
        gVal = 56;
      }

      // Tint factor
      if (outer.type === 'tinted' || inner.type === 'tinted') {
        lt *= 0.65;
        gVal *= 0.60;
      }

      // Acoustic & Safety ratings
      let baseRw = 31;
      if (outer.thickness !== inner.thickness) baseRw += 2; // Asymmetric Glass bonus
      if (outer.type === 'laminated' || inner.type === 'laminated') baseRw += 3;
      if (outer.type === 'acoustic' || inner.type === 'acoustic') baseRw += 7;
      if (totalGlassThickness >= 12) baseRw += 1;
      rw = baseRw;
    } 
    else { // Triple Glazing
      // Base Triple Float
      ug = 1.8; lt = 73; gVal = 68; rw = 32;

      const outer = glassLayers[0];
      const mid = glassLayers[1];
      const inner = glassLayers[2];
      const sp1 = spacers[0];
      const sp2 = spacers[1];

      // Spacer width penalties
      if (sp1.width < 12 || sp2.width < 12) ug += 0.2;

      // Gas bonuses
      if (sp1.gas === 'argon') ug -= 0.15;
      if (sp2.gas === 'argon') ug -= 0.15;

      // Coating counts
      let coatingCount = 0;
      [outer, mid, inner].forEach(g => {
        if (g.type === 'lowE' || g.type === 'solarControl') coatingCount++;
      });

      if (coatingCount === 1) {
        ug -= 0.7;
        lt = 62;
        gVal = 50;
      } else if (coatingCount >= 2) {
        ug -= 1.1;
        lt = 51;
        gVal = 37;
      }

      // Tint factor
      if (outer.type === 'tinted') {
        lt *= 0.6;
        gVal *= 0.55;
      }

      // Acoustic Rw calculation
      let baseRw = 32;
      const hasAcoustic = [outer, mid, inner].some(g => g.type === 'acoustic');
      const hasLami = [outer, mid, inner].some(g => g.type === 'laminated');
      
      if (hasAcoustic) baseRw += 7;
      else if (hasLami) baseRw += 3;

      if (outer.thickness !== inner.thickness) baseRw += 1;
      rw = baseRw;
    }

    // Floor metrics at physical limits
    ug = Math.max(0.5, Math.round(ug * 10) / 10);
    lt = Math.max(15, Math.min(92, Math.round(lt)));
    gVal = Math.max(10, Math.min(85, Math.round(gVal)));
    rw = Math.min(50, Math.round(rw));
    const sc = Math.round((gVal / 87) * 100) / 100;

    return {
      ug,
      lt,
      gVal,
      sc,
      rw,
      totalThickness,
      unitWeight
    };
  }, [glazingType, glassLayers, spacers]);

  // Performance index score (Excellent, Good, Standard)
  const thermalRating = calcResults.ug <= 1.1 ? tLocal('perfect') : calcResults.ug <= 1.5 ? tLocal('good') : calcResults.ug <= 2.8 ? tLocal('standard') : tLocal('poor');
  const acousticRating = calcResults.rw >= 38 ? tLocal('perfect') : calcResults.rw >= 34 ? tLocal('good') : calcResults.rw >= 31 ? tLocal('standard') : tLocal('poor');
  const solarRating = calcResults.gVal <= 42 ? tLocal('perfect') : calcResults.gVal <= 58 ? tLocal('good') : calcResults.gVal <= 75 ? tLocal('standard') : tLocal('poor');

  return (
    <div className="bg-slate-950 min-h-screen text-slate-100 p-6 sm:p-8 font-sans print:bg-white print:text-black print:p-0">
      <div className="max-w-7xl mx-auto space-y-8 print:space-y-6">
        
        {/* Header Control Panel (Hidden in Print) */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-900/60 backdrop-blur border border-white/5 rounded-3xl p-6 shadow-xl gap-6 print:hidden">
          <div className="space-y-1">
            <button 
              onClick={onBack}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-[11px] font-black text-slate-300 flex items-center gap-2 transition-all border border-white/5 mb-3"
            >
              <ArrowLeft size={12} strokeWidth={3} />
              {tLocal('back')}
            </button>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-blue-400">
                <Calculator size={24} />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                  {tLocal('title')}
                  <span className="text-[10px] bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full uppercase tracking-widest font-black">PRO v1.2</span>
                </h1>
                <p className="text-slate-400 text-xs font-semibold mt-0.5">
                  {tLocal('subtitle')}
                </p>
              </div>
            </div>
          </div>
          
          <button 
            onClick={() => window.print()}
            className="w-full sm:w-auto px-6 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-2.5 transition-all shadow-xl shadow-blue-600/15 hover:-translate-y-0.5"
          >
            <Printer size={15} strokeWidth={2.5} />
            {tLocal('print')}
          </button>
        </div>

        {/* Printable Cover Header (Only visible on print) */}
        <div className="hidden print:flex justify-between items-center border-b border-slate-300 pb-6 mb-8">
          <div className="flex items-center gap-4">
            <Logo className="w-12 h-12" theme={theme} />
            <div>
              <h1 className="text-xl font-black text-black uppercase tracking-tight">
                {lang === 'tr' ? 'CAM PERFORMANS DEĞERLENDİRME RAPORU' : 'GLAZING PERFORMANCE COMPLIANCE REPORT'}
              </h1>
              <p className="text-slate-600 text-[10px] font-bold tracking-wider uppercase mt-1">
                ALUMETRIC Engineering Suite • Alumetric GlassTool™ Standard
              </p>
            </div>
          </div>
          <div className="text-right font-mono text-xs text-slate-700">
            <div>{lang === 'tr' ? 'Tarih: ' : 'Date: '} {new Date().toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US')}</div>
            <div>Ref No: GL-2026-{Math.floor(1000 + Math.random() * 9000)}</div>
          </div>
        </div>

        {/* Central Workspace Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column (5 Cols) - Interactive Controls (Hidden in Print) */}
          <div className="lg:col-span-5 space-y-6 print:hidden">
            
            {/* Category selection */}
            <div className="bg-slate-900/40 border border-white/5 rounded-3xl p-6 shadow-xl space-y-4">
              <label className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest block">
                {tLocal('glazingCategory')}
              </label>
              <div className="grid grid-cols-3 gap-2 bg-slate-950 p-1 rounded-2xl border border-white/5">
                {(['single', 'double', 'triple'] as GlazingType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setGlazingType(t)}
                    className={`py-2.5 px-3 rounded-xl text-xs font-black transition-all duration-300 ${
                      glazingType === t 
                        ? 'bg-blue-600 text-white shadow-lg' 
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {tLocal(t)}
                  </button>
                ))}
              </div>
            </div>

            {/* Glass Layers Editor */}
            <div className="bg-slate-900/40 border border-white/5 rounded-3xl p-6 shadow-xl space-y-6">
              <h2 className="text-sm font-black text-white uppercase tracking-widest border-b border-white/5 pb-2 flex items-center gap-2">
                <Layers size={16} className="text-indigo-400" />
                {tLocal('combination')}
              </h2>

              {/* Layer 1 (Outer Glass) */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-black text-indigo-400 uppercase tracking-wider">{tLocal('outerPane')}</span>
                  <span className="text-[10px] text-slate-500 font-bold">POS #1 (EXT)</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <select
                      value={glassLayers[0].type}
                      onChange={(e) => handleUpdateGlass(0, 'type', e.target.value)}
                      className="w-full bg-slate-950 border border-white/5 rounded-xl px-3 py-2 text-xs font-semibold focus:border-blue-500 text-slate-200"
                    >
                      {glassTypes.map(gt => (
                        <option key={gt.value} value={gt.value}>
                          {lang === 'tr' ? gt.labelTr : gt.labelEn}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <select
                      value={glassLayers[0].thickness}
                      onChange={(e) => handleUpdateGlass(0, 'thickness', parseInt(e.target.value))}
                      className="w-full bg-slate-950 border border-white/5 rounded-xl px-3 py-2 text-xs font-bold text-center text-slate-200"
                    >
                      {thicknesses.map(th => (
                        <option key={th} value={th}>{th} mm</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Spacer 1 (Between outer and middle/inner) */}
              {glazingType !== 'single' && (
                <div className="bg-slate-950/60 p-4 rounded-2xl border border-white/5 space-y-3">
                  <div className="flex justify-between items-center text-[11px] font-black text-slate-400 uppercase tracking-wider">
                    <span>{tLocal('spacer1')}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] text-slate-500 font-bold uppercase block mb-1">{tLocal('spacerWidth')}</label>
                      <select
                        value={spacers[0].width}
                        onChange={(e) => handleUpdateSpacer(0, 'width', parseInt(e.target.value))}
                        className="w-full bg-slate-900 border border-white/5 rounded-xl px-3 py-2 text-xs font-bold text-slate-200"
                      >
                        {spacerWidths.map(sw => (
                          <option key={sw} value={sw}>{sw} mm</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] text-slate-500 font-bold uppercase block mb-1">{tLocal('gasType')}</label>
                      <select
                        value={spacers[0].gas}
                        onChange={(e) => handleUpdateSpacer(0, 'gas', e.target.value)}
                        className="w-full bg-slate-900 border border-white/5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-200"
                      >
                        <option value="air">{tLocal('air')}</option>
                        <option value="argon">{tLocal('argon')}</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Layer 2 (Middle Glass, if triple) */}
              {glazingType === 'triple' && (
                <div className="space-y-3 border-t border-white/5 pt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-black text-indigo-400 uppercase tracking-wider">{tLocal('midPane')}</span>
                    <span className="text-[10px] text-slate-500 font-bold">POS #2 (MID)</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <select
                        value={glassLayers[1].type}
                        onChange={(e) => handleUpdateGlass(1, 'type', e.target.value)}
                        className="w-full bg-slate-950 border border-white/5 rounded-xl px-3 py-2 text-xs font-semibold focus:border-blue-500 text-slate-200"
                      >
                        {glassTypes.map(gt => (
                          <option key={gt.value} value={gt.value}>
                            {lang === 'tr' ? gt.labelTr : gt.labelEn}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <select
                        value={glassLayers[1].thickness}
                        onChange={(e) => handleUpdateGlass(1, 'thickness', parseInt(e.target.value))}
                        className="w-full bg-slate-950 border border-white/5 rounded-xl px-3 py-2 text-xs font-bold text-center text-slate-200"
                      >
                        {thicknesses.map(th => (
                          <option key={th} value={th}>{th} mm</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Spacer 2 (Between middle and inner, if triple) */}
              {glazingType === 'triple' && (
                <div className="bg-slate-950/60 p-4 rounded-2xl border border-white/5 space-y-3">
                  <div className="flex justify-between items-center text-[11px] font-black text-slate-400 uppercase tracking-wider">
                    <span>{tLocal('spacer2')}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] text-slate-500 font-bold uppercase block mb-1">{tLocal('spacerWidth')}</label>
                      <select
                        value={spacers[1].width}
                        onChange={(e) => handleUpdateSpacer(1, 'width', parseInt(e.target.value))}
                        className="w-full bg-slate-900 border border-white/5 rounded-xl px-3 py-2 text-xs font-bold text-slate-200"
                      >
                        {spacerWidths.map(sw => (
                          <option key={sw} value={sw}>{sw} mm</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] text-slate-500 font-bold uppercase block mb-1">{tLocal('gasType')}</label>
                      <select
                        value={spacers[1].gas}
                        onChange={(e) => handleUpdateSpacer(1, 'gas', e.target.value)}
                        className="w-full bg-slate-900 border border-white/5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-200"
                      >
                        <option value="air">{tLocal('air')}</option>
                        <option value="argon">{tLocal('argon')}</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Layer 3 (Inner Glass) */}
              {glazingType !== 'single' && (
                <div className="space-y-3 border-t border-white/5 pt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-black text-indigo-400 uppercase tracking-wider">{tLocal('innerPane')}</span>
                    <span className="text-[10px] text-slate-500 font-bold">POS #3 (INT)</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <select
                        value={glassLayers[2].type}
                        onChange={(e) => handleUpdateGlass(2, 'type', e.target.value)}
                        className="w-full bg-slate-950 border border-white/5 rounded-xl px-3 py-2 text-xs font-semibold focus:border-blue-500 text-slate-200"
                      >
                        {glassTypes.map(gt => (
                          <option key={gt.value} value={gt.value}>
                            {lang === 'tr' ? gt.labelTr : gt.labelEn}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <select
                        value={glassLayers[2].thickness}
                        onChange={(e) => handleUpdateGlass(2, 'thickness', parseInt(e.target.value))}
                        className="w-full bg-slate-950 border border-white/5 rounded-xl px-3 py-2 text-xs font-bold text-center text-slate-200"
                      >
                        {thicknesses.map(th => (
                          <option key={th} value={th}>{th} mm</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Popular Combination Packages (Bento-style) */}
            <div className="bg-slate-900/40 border border-white/5 rounded-3xl p-6 shadow-xl space-y-4">
              <h3 className="text-xs font-extrabold text-blue-400 tracking-wider uppercase flex items-center gap-1.5">
                <Sparkles size={14} />
                {tLocal('presets')}
              </h3>
              <div className="space-y-3">
                {presets.map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleApplyPreset(p)}
                    className="w-full text-left bg-slate-950/60 hover:bg-slate-900 border border-white/5 hover:border-slate-800 p-4 rounded-2xl transition-all flex items-start gap-3.5 group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/10 mt-0.5 group-hover:scale-105 transition-all">
                      <Zap size={15} />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-white text-xs group-hover:text-blue-400 transition-colors">
                        {lang === 'tr' ? p.nameTr : p.nameEn}
                      </h4>
                      <p className="text-[10px] text-slate-400 mt-1 leading-relaxed font-semibold">
                        {lang === 'tr' ? p.descTr : p.descEn}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* Right Column (7 Cols) - Scientific Analysis View & Live Simulation */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Live Ray Simulation (SVG Visualizer) */}
            <div className="bg-slate-900/40 border border-white/5 rounded-3xl p-6 shadow-xl space-y-4 print:bg-slate-50 print:border-slate-200 print:text-black">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-extrabold text-indigo-400 print:text-indigo-800 tracking-wider uppercase flex items-center gap-1.5">
                  <Sun size={14} />
                  {tLocal('visualizer')}
                </h3>
                <span className="text-[10px] bg-slate-950 print:bg-slate-200 font-bold px-2 py-0.5 rounded-full text-slate-400 print:text-slate-700">
                  {tLocal('combination')}: {calcResults.totalThickness} mm
                </span>
              </div>

              {/* The Interactive Cross Section representation */}
              <div className="w-full bg-slate-950 print:bg-white rounded-2xl border border-white/5 print:border-slate-200 p-4 flex items-center justify-center min-h-[180px] print:min-h-[140px]">
                <svg viewBox="0 0 240 120" className="w-full max-w-lg h-full select-none">
                  {/* Outer boundaries for background */}
                  <rect width="240" height="120" fill="none" />

                  {/* Grid effect inside simulation for engineering feel */}
                  <defs>
                    <pattern id="ray-grid" width="10" height="10" patternUnits="userSpaceOnUse">
                      <circle cx="2" cy="2" r="0.5" fill="#1e293b" opacity="0.3" />
                    </pattern>
                  </defs>
                  <rect width="240" height="120" fill="url(#ray-grid)" opacity="0.5" />

                  {/* Environment text */}
                  <text x="15" y="15" fill="#475569" className="print:fill-slate-500" fontSize="7" fontWeight="bold" letterSpacing="0.5">{tLocal('exterior')}</text>
                  <text x="225" y="15" fill="#475569" className="print:fill-slate-500" fontSize="7" fontWeight="bold" letterSpacing="0.5" textAnchor="end">{tLocal('interior')}</text>

                  {/* Outer Glass layer block */}
                  <g>
                    <rect x="75" y="25" width="15" height="70" fill={glassTypes.find(gt => gt.value === glassLayers[0].type)?.tint || '#bae6fd'} rx="1" opacity="0.85" stroke="#475569" strokeWidth="0.75" />
                    <text x="82.5" y="60" fill="#0f172a" fontSize="6.5" fontWeight="black" textAnchor="middle" transform="rotate(-90 82.5 60)">
                      {glassLayers[0].thickness}mm
                    </text>
                  </g>

                  {/* Spacer 1 / Cavity */}
                  {glazingType !== 'single' && (
                    <g>
                      <rect x="90" y="27" width="30" height="66" fill="none" stroke="#64748b" strokeWidth="0.5" strokeDasharray="2,2" />
                      <circle cx="105" cy="40" r="1.5" fill="#38bdf8" opacity="0.7" />
                      <circle cx="110" cy="70" r="1.5" fill="#38bdf8" opacity="0.7" />
                      <circle cx="100" cy="85" r="1.5" fill="#38bdf8" opacity="0.7" />
                      <text x="105" y="61" fill="#475569" className="print:fill-slate-500" fontSize="6" fontWeight="bold" textAnchor="middle">
                        {spacers[0].gas === 'argon' ? 'Ar 16mm' : 'Air 16mm'}
                      </text>
                    </g>
                  )}

                  {/* Middle Glass Layer (Triple glazing only) */}
                  {glazingType === 'triple' && (
                    <g>
                      <rect x="120" y="25" width="15" height="70" fill={glassTypes.find(gt => gt.value === glassLayers[1].type)?.tint || '#bae6fd'} rx="1" opacity="0.85" stroke="#475569" strokeWidth="0.75" />
                      <text x="127.5" y="60" fill="#0f172a" fontSize="6.5" fontWeight="black" textAnchor="middle" transform="rotate(-90 127.5 60)">
                        {glassLayers[1].thickness}mm
                      </text>
                    </g>
                  )}

                  {/* Spacer 2 / Cavity 2 (Triple glazing only) */}
                  {glazingType === 'triple' && (
                    <g>
                      <rect x="135" y="27" width="30" height="66" fill="none" stroke="#64748b" strokeWidth="0.5" strokeDasharray="2,2" />
                      <circle cx="150" cy="45" r="1.5" fill="#38bdf8" opacity="0.7" />
                      <circle cx="145" cy="75" r="1.5" fill="#38bdf8" opacity="0.7" />
                      <text x="150" y="61" fill="#475569" className="print:fill-slate-500" fontSize="6" fontWeight="bold" textAnchor="middle">
                        {spacers[1].gas === 'argon' ? 'Ar 16mm' : 'Air 16mm'}
                      </text>
                    </g>
                  )}

                  {/* Inner Glass Layer (Double or Triple) */}
                  {glazingType !== 'single' && (
                    <g>
                      <rect x={glazingType === 'triple' ? "165" : "120"} y="25" width="15" height="70" fill={glassTypes.find(gt => gt.value === glassLayers[2].type)?.tint || '#bae6fd'} rx="1" opacity="0.85" stroke="#475569" strokeWidth="0.75" />
                      <text x={glazingType === 'triple' ? "172.5" : "127.5"} y="60" fill="#0f172a" fontSize="6.5" fontWeight="black" textAnchor="middle" transform="rotate(-90 (glazingType === 'triple' ? 172.5 : 127.5) 60)">
                        {glassLayers[2].thickness}mm
                      </text>
                    </g>
                  )}

                  {/* --- RAY SIMULATIONS --- */}

                  {/* Ray 1: Solar Heat Infrared (Red) */}
                  <g className="heat-ray">
                    {/* Incoming */}
                    <path d="M 10 35 L 75 35" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
                    {/* Reflected Heat (High reflection if Solar Control or low-E) */}
                    {calcResults.gVal < 50 ? (
                      <path d="M 75 35 L 25 20" stroke="#ef4444" strokeWidth="2" strokeDasharray="3,2" strokeLinecap="round" />
                    ) : (
                      <path d="M 75 35 L 45 25" stroke="#ef4444" strokeWidth="1" strokeDasharray="3,2" strokeLinecap="round" />
                    )}
                    
                    {/* Transmitted Heat (Warped and smaller width) */}
                    <path d="M 75 35 L 120 40 L 220 45" stroke="#ef4444" strokeWidth={calcResults.gVal < 50 ? "0.5" : "1.2"} opacity="0.7" strokeLinecap="round" />
                    
                    <text x="35" y="44" fill="#ef4444" fontSize="5" fontWeight="black">{tLocal('heatRay')}</text>
                  </g>

                  {/* Ray 2: Natural Light (Yellow/Orange) */}
                  <g className="light-ray">
                    {/* Incoming */}
                    <path d="M 10 55 L 75 55" stroke="#eab308" strokeWidth="1.8" strokeLinecap="round" />
                    {/* Reflected light */}
                    <path d="M 75 55 L 35 48" stroke="#eab308" strokeWidth="0.6" strokeDasharray="2,2" strokeLinecap="round" />
                    {/* Transmitted Light */}
                    <path d="M 75 55 L 120 57 L 220 60" stroke="#eab308" strokeWidth={calcResults.lt > 70 ? "1.6" : calcResults.lt > 50 ? "1.1" : "0.7"} opacity="0.9" strokeLinecap="round" />
                    
                    <text x="35" y="63" fill="#eab308" fontSize="5" fontWeight="black">{tLocal('lightRay')}</text>
                  </g>

                  {/* Ray 3: Sound Wave dampening (Indigo/Purple) */}
                  <g className="noise-ray">
                    {/* Ambient loud noise waves */}
                    <path d="M 10 80 Q 20 75 30 80 T 50 80 T 75 80" fill="none" stroke="#6366f1" strokeWidth="1.5" />
                    {/* Dampened inside spacer */}
                    {glazingType !== 'single' ? (
                      <path d="M 75 80 Q 90 78 105 80 T 120 80" fill="none" stroke="#6366f1" strokeWidth="0.8" opacity="0.6" />
                    ) : null}
                    {/* Highly dampened exiting inside room */}
                    <path d="M 120 80 Q 145 79 170 80 T 220 80" fill="none" stroke="#6366f1" strokeWidth={calcResults.rw > 37 ? "0.2" : "0.6"} opacity="0.4" />
                    
                    <text x="35" y="88" fill="#818cf8" fontSize="5" fontWeight="black">{tLocal('noiseWave')}</text>
                    {calcResults.rw >= 37 && (
                      <text x="210" y="88" fill="#10b981" fontSize="5.5" fontWeight="black" textAnchor="end">✓ {tLocal('soundDampened')}</text>
                    )}
                  </g>

                  {/* Coating symbols (Little shining zaps showing where Low-E layer sits) */}
                  {glassLayers[0].type === 'solarControl' && (
                    <g transform="translate(80, 28) scale(0.6)">
                      <circle cx="0" cy="0" r="4" fill="#eab308" opacity="0.8" />
                      <text x="0" y="2" fill="#000" fontSize="6" fontWeight="bold" textAnchor="middle">*</text>
                    </g>
                  )}
                  {glassLayers[2].type === 'lowE' && glazingType !== 'single' && (
                    <g transform="translate(130, 85) scale(0.6)">
                      <circle cx="0" cy="0" r="4" fill="#10b981" opacity="0.8" />
                      <text x="0" y="2" fill="#000" fontSize="6" fontWeight="bold" textAnchor="middle">*</text>
                    </g>
                  )}
                </svg>
              </div>
            </div>

            {/* Performance KPI Engineering Metrics Dashboard */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6 print:bg-white print:border-slate-200 print:shadow-none print:p-2">
              <h2 className="text-sm font-black text-white print:text-slate-950 uppercase tracking-widest border-b border-slate-800/60 print:border-slate-200 pb-3 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Gauge size={16} className="text-blue-400" />
                  {tLocal('metrics')}
                </span>
                <span className="font-mono text-xs text-slate-500 print:text-slate-700">ISO 9050 / EN 673</span>
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* 1. Ug Value Metric Card */}
                <div className="bg-slate-950/60 print:bg-slate-50 border border-white/5 print:border-slate-200 p-5 rounded-2xl flex items-start gap-4 shadow-lg">
                  <div className={`p-3 rounded-xl shrink-0 border ${
                    calcResults.ug <= 1.1 
                      ? 'bg-emerald-500/10 border-emerald-500/10 text-emerald-400' 
                      : calcResults.ug <= 1.5 
                      ? 'bg-blue-500/10 border-blue-500/10 text-blue-400' 
                      : 'bg-amber-500/10 border-amber-500/10 text-amber-500'
                  }`}>
                    <Flame size={20} />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider block">
                        {tLocal('ugValue')}
                      </span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-black tracking-widest ${
                        calcResults.ug <= 1.1 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-blue-500/10 text-blue-400'
                      }`}>{thermalRating}</span>
                    </div>
                    <span className="text-3xl font-black text-white print:text-black block font-mono">
                      {calcResults.ug} <span className="text-xs font-bold text-slate-500">W/m²K</span>
                    </span>
                    <p className="text-[10px] text-slate-400 print:text-slate-600 leading-relaxed font-semibold">
                      {tLocal('ugDesc')}
                    </p>
                  </div>
                </div>

                {/* 2. Light Transmission LT Card */}
                <div className="bg-slate-950/60 print:bg-slate-50 border border-white/5 print:border-slate-200 p-5 rounded-2xl flex items-start gap-4 shadow-lg">
                  <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/10 text-yellow-400 shrink-0">
                    <Sun size={20} />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider block">
                        {tLocal('ltValue')}
                      </span>
                      <span className="text-[9px] bg-yellow-500/10 text-yellow-500 px-1.5 py-0.5 rounded uppercase font-black tracking-widest">
                        {calcResults.lt >= 70 ? tLocal('good') : tLocal('standard')}
                      </span>
                    </div>
                    <span className="text-3xl font-black text-white print:text-black block font-mono">
                      %{calcResults.lt}
                    </span>
                    <p className="text-[10px] text-slate-400 print:text-slate-600 leading-relaxed font-semibold">
                      {tLocal('ltDesc')}
                    </p>
                  </div>
                </div>

                {/* 3. Solar Factor g-value Card */}
                <div className="bg-slate-950/60 print:bg-slate-50 border border-white/5 print:border-slate-200 p-5 rounded-2xl flex items-start gap-4 shadow-lg">
                  <div className={`p-3 rounded-xl shrink-0 border ${
                    calcResults.gVal <= 42 
                      ? 'bg-emerald-500/10 border-emerald-500/10 text-emerald-400' 
                      : 'bg-blue-500/10 border-blue-500/10 text-blue-400'
                  }`}>
                    <Sun size={20} className="animate-spin-slow text-orange-400" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider block">
                        {tLocal('gValue')}
                      </span>
                      <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded uppercase font-black tracking-widest">
                        {solarRating}
                      </span>
                    </div>
                    <span className="text-3xl font-black text-white print:text-black block font-mono">
                      %{calcResults.gVal}
                    </span>
                    <p className="text-[10px] text-slate-400 print:text-slate-600 leading-relaxed font-semibold">
                      {tLocal('gDesc')}
                    </p>
                  </div>
                </div>

                {/* 4. Acoustic Insulation Rw Card */}
                <div className="bg-slate-950/60 print:bg-slate-50 border border-white/5 print:border-slate-200 p-5 rounded-2xl flex items-start gap-4 shadow-lg">
                  <div className={`p-3 rounded-xl shrink-0 border ${
                    calcResults.rw >= 38 
                      ? 'bg-indigo-500/10 border-indigo-500/10 text-indigo-400' 
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}>
                    <Volume2 size={20} />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider block">
                        {tLocal('rwValue')}
                      </span>
                      <span className="text-[9px] bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded uppercase font-black tracking-widest">
                        {acousticRating}
                      </span>
                    </div>
                    <span className="text-3xl font-black text-white print:text-black block font-mono">
                      {calcResults.rw} <span className="text-xs font-bold text-slate-500">dB</span>
                    </span>
                    <p className="text-[10px] text-slate-400 print:text-slate-600 leading-relaxed font-semibold">
                      {tLocal('rwDesc')}
                    </p>
                  </div>
                </div>

              </div>

              {/* Physical Dimension KPI bar */}
              <div className="grid grid-cols-2 gap-4 bg-slate-950/40 print:bg-slate-50 p-4 rounded-2xl border border-white/5 print:border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-900 border border-white/5 text-slate-400 rounded-xl">
                    <Layers size={16} />
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 font-bold block uppercase">{tLocal('totThickness')}</span>
                    <span className="text-sm font-black text-white print:text-black font-mono">{calcResults.totalThickness} mm</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-900 border border-white/5 text-slate-400 rounded-xl">
                    <Dumbbell size={16} />
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 font-bold block uppercase">{tLocal('weight')}</span>
                    <span className="text-sm font-black text-white print:text-black font-mono">{calcResults.unitWeight} kg/m²</span>
                  </div>
                </div>
              </div>

              {/* Engineering Standard Validation footer */}
              <div className="flex items-center gap-2 border-t border-slate-800/60 print:border-slate-200 pt-4 text-[10px] text-slate-500 font-bold">
                <ShieldCheck size={14} className="text-emerald-400" />
                <span>{lang === 'tr' ? 'Hesaplamalar EN 410 ve EN 673 standartlarına uygun Şişecam veri tabloları tabanlıdır.' : 'Calculations comply with EN 410 and EN 673 standard reference tables.'}</span>
              </div>
            </div>

          </div>

        </div>

        {/* Printable Signature Area at Bottom */}
        <div className="hidden print:flex justify-between items-center pt-20 border-t border-slate-300 text-xs">
          <div className="text-center w-48">
            <div className="font-bold border-b border-slate-400 pb-16 mb-2">Kontrol Eden / Checked By</div>
            <div className="text-[10px] text-slate-500 uppercase">Cephe Mühendisi (Facade Engineer)</div>
          </div>
          <div className="text-center w-48">
            <div className="font-bold border-b border-slate-400 pb-16 mb-2">Belge Onayı / Approver</div>
            <div className="text-[10px] text-slate-500 uppercase">ALUMETRIC Engineering Suite</div>
          </div>
        </div>

      </div>
    </div>
  );
};
