import React, { useMemo, useState, useEffect } from 'react';
import { ShadingItem, Language, Project } from '../types';
import { Scissors, FileText, Package, Cpu, Layers, Download, LayoutGrid, Tag, Info, Percent, Wrench, CheckCircle, Settings, RefreshCw, Save, Edit2, DollarSign, TrendingUp } from 'lucide-react';

interface ShadingBOMAndOptProps {
  shadingItems: ShadingItem[];
  project?: Project;
  onUpdateProject?: (project: Project) => void;
  lang: Language;
  theme: 'light' | 'dark';
  currencySymbol: string;
}

export interface ShadingMaterial {
  category: 'profile' | 'fabric' | 'motor' | 'accessory';
  nameTr: string;
  nameEn: string;
  code: string;
  quantity: number;
  unit: 'pce' | 'meter' | 'sqm';
  dimensions?: string;
  lengths?: number[]; // list of cutting lengths in mm (per-unit single lengths)
}

export interface ShadingConfig {
  motorBrand: string;
  fabricBrand: string;
  barLength: number;
  sawKerf: number;
  codeOverrides: Record<string, string>;
  nameOverridesTr: Record<string, string>;
  nameOverridesEn: Record<string, string>;
  enableBomPricing?: boolean;
  markupPercentage?: number;
  materialCosts?: Record<string, number>;
  pricingMethod?: 'piece' | 'weight';
  aluminiumKgPrice?: number;
  profileWeights?: Record<string, number>;
}

export const DEFAULT_PROFILE_WEIGHTS: Record<string, number> = {
  'PRG-RAIL-200': 6.2, // 6.2 kg/m
  'PRG-BEAM-220': 7.5, // 7.5 kg/m
  'PRG-POST-100': 4.8, // 4.8 kg/m
  'PRG-GUT-150': 3.5,  // 3.5 kg/m
  'PRG-LVR-180': 2.8,  // 2.8 kg/m
  
  'RRF-RAIL-200': 6.5,
  'RRF-BEAM-220': 7.8,
  'RRF-POST-100': 5.0,
  'RRF-GUT-150': 3.8,
  'RRF-LVR-180': 3.0,
  
  'ZIP-GUIDE-45': 1.1, // 1.1 kg/m
  'ZIP-BOX-120': 2.4,  // 2.4 kg/m
  'ZIP-BAR-50': 1.5,   // 1.5 kg/m
  'ZIP-TUBE-70': 1.8,  // 1.8 kg/m
  
  'AWN-TUBE-40': 2.2,
  'AWN-FRONT-80': 1.6,
  'AWN-ROUT-70': 1.5,
  
  'GUI-TRACK-150': 3.8,
  'GUI-BOX-180': 4.5,
  'GUI-SASH-H': 1.4,
  'GUI-SASH-V': 1.2,
  
  'BAL-RAIL-120': 2.8,
  'BAL-SIDE-80': 1.4,
  'BAL-SASH-B': 1.3,
  'BAL-SASH-V': 0.9,
};

export const DEFAULT_CONFIG: ShadingConfig = {
  motorBrand: 'Somfy',
  fabricBrand: 'Serge Ferrari Soltis',
  barLength: 6000,
  sawKerf: 5,
  codeOverrides: {},
  nameOverridesTr: {},
  nameOverridesEn: {},
  enableBomPricing: false,
  markupPercentage: 35,
  pricingMethod: 'piece',
  aluminiumKgPrice: 5.5,
  profileWeights: { ...DEFAULT_PROFILE_WEIGHTS },
  materialCosts: {
    'PRG-RAIL-200': 45,
    'PRG-BEAM-220': 55,
    'PRG-POST-100': 35,
    'PRG-GUT-150': 30,
    'PRG-LVR-180': 25,
    'MOT-PRG-DRV': 450,
    'ACC-LED-W': 8,
    'ACC-PRG-KIT': 90,
    'ZIP-GUIDE-45': 20,
    'ZIP-BOX-120': 45,
    'ZIP-BAR-50': 15,
    'ZIP-TUBE-70': 18,
    'FAB-FER-SOL': 15,
    'MOT-SOM-ZIP': 220,
    'ACC-ZIP-KIT': 5,
    'AWN-TUBE-40': 18,
    'AWN-FRONT-80': 22,
    'AWN-ROUT-70': 16,
    'FAB-ACR-AWN': 12,
    'MOT-SOM-AWN': 180,
    'ACC-AWN-ARM': 65,
    'ACC-AWN-BRK': 15,
    'GUI-TRACK-150': 45,
    'GUI-BOX-180': 60,
    'GUI-SASH-H': 15,
    'GUI-SASH-V': 12,
    'MOT-AG-GUI': 480,
    'ACC-GUI-GLS': 85,
    'ACC-GUI-SEAL': 30,
    'BAL-RAIL-120': 30,
    'BAL-SIDE-80': 18,
    'BAL-SASH-B': 10,
    'BAL-SASH-V': 8,
    'ACC-BAL-GLS': 55,
    'ACC-BAL-ACC': 40,
    // Add variations for other types
    'RRF-RAIL-200': 48,
    'RRF-BEAM-220': 58,
    'RRF-POST-100': 38,
    'RRF-GUT-150': 32,
    'RRF-LVR-180': 28,
    'MOT-RRF-DRV': 480,
    'ACC-RRF-KIT': 95,
  }
};

const PREDEFINED_MOTORS = ["Somfy", "Becker", "Cherubini", "Albert Genau", "Mosel", "Nice"];
const PREDEFINED_FABRICS = ["Serge Ferrari Soltis", "Sauleda Acrylic", "Dickson Constant", "Recasens", "Mehler Texnologies", "Sattler"];

// Generates individual items for a single ShadingItem using a custom config
export const getShadingItemBOM = (item: ShadingItem, config: ShadingConfig): ShadingMaterial[] => {
  const materials: ShadingMaterial[] = [];
  const w = item.width;
  const h = item.height;
  const d = item.depth || 0;
  const qty = item.quantity || 1;
  const type = item.productType;

  // Helper to apply override mappings
  const applyOverrides = (mat: ShadingMaterial): ShadingMaterial => {
    const originalCode = mat.code;
    const customCode = config.codeOverrides[originalCode];
    const customNameTr = config.nameOverridesTr[originalCode];
    const customNameEn = config.nameOverridesEn[originalCode];

    return {
      ...mat,
      code: customCode && customCode.trim() !== '' ? customCode : originalCode,
      nameTr: customNameTr && customNameTr.trim() !== '' ? customNameTr : mat.nameTr,
      nameEn: customNameEn && customNameEn.trim() !== '' ? customNameEn : mat.nameEn,
    };
  };

  if (type === 'bioclimatic-pergola' || type === 'rolling-roof') {
    const isPergola = type === 'bioclimatic-pergola';
    const prefix = isPergola ? 'PRG' : 'RRF';
    const labelPrefix = isPergola ? 'Pergola' : 'Rolling Roof';

    // Profiles (with cutting lengths)
    materials.push(applyOverrides({
      category: 'profile',
      nameTr: `${labelPrefix} Yan Kasa Ray Profili`,
      nameEn: `${labelPrefix} Side Guide Rail Profile`,
      code: `${prefix}-RAIL-200`,
      quantity: 2 * qty,
      unit: 'pce',
      dimensions: `${d} mm`,
      lengths: Array(2).fill(d)
    }));

    materials.push(applyOverrides({
      category: 'profile',
      nameTr: `${labelPrefix} Ön/Arka Kiriş Profili`,
      nameEn: `${labelPrefix} Front/Rear Beam Profile`,
      code: `${prefix}-BEAM-220`,
      quantity: 2 * qty,
      unit: 'pce',
      dimensions: `${w} mm`,
      lengths: Array(2).fill(w)
    }));

    materials.push(applyOverrides({
      category: 'profile',
      nameTr: `${labelPrefix} Taşıyıcı Direk Kolon Profili`,
      nameEn: `${labelPrefix} Structural Post Pillar Profile`,
      code: `${prefix}-POST-100`,
      quantity: 4 * qty,
      unit: 'pce',
      dimensions: `${h} mm`,
      lengths: Array(4).fill(h)
    }));

    materials.push(applyOverrides({
      category: 'profile',
      nameTr: `${labelPrefix} Drenaj Oluk Profili`,
      nameEn: `${labelPrefix} Water Gutter Profile`,
      code: `${prefix}-GUT-150`,
      quantity: 2 * qty,
      unit: 'pce',
      dimensions: `${w} mm`,
      lengths: Array(2).fill(w)
    }));

    // Louvers
    const louverSpacing = isPergola ? 250 : 280;
    const louverCountPerUnit = Math.ceil(d / louverSpacing) || 12;
    const louverLength = w - 80;
    materials.push(applyOverrides({
      category: 'profile',
      nameTr: isPergola ? 'Bioklimatik Panel Döndürülebilir Lamel' : 'Rolling Roof Açılır Panel Lamel',
      nameEn: isPergola ? 'Bioclimatic Louver Rotating Blade' : 'Rolling Roof Folding Panel Louver',
      code: `${prefix}-LVR-180`,
      quantity: louverCountPerUnit * qty,
      unit: 'pce',
      dimensions: `${louverLength} mm`,
      lengths: Array(louverCountPerUnit).fill(louverLength)
    }));

    // Motors
    materials.push(applyOverrides({
      category: 'motor',
      nameTr: `${config.motorBrand} RTS Bioklimatik Pivot Motor Seti`,
      nameEn: `${config.motorBrand} RTS Bioclimatic Pivot Motor Set`,
      code: `MOT-${prefix}-DRV`,
      quantity: 1 * qty,
      unit: 'pce'
    }));

    // Accessories
    const ledMeters = Math.round((2 * w + 2 * d) / 1000);
    materials.push(applyOverrides({
      category: 'accessory',
      nameTr: 'Samsung Entegre Silikonlu LED Aydınlatma Şeridi',
      nameEn: 'Samsung Integrated Silicon LED Lighting Strip',
      code: 'ACC-LED-W',
      quantity: ledMeters * qty,
      unit: 'meter',
      dimensions: `${ledMeters} m/unit`
    }));

    materials.push(applyOverrides({
      category: 'accessory',
      nameTr: `${labelPrefix} Paslanmaz Çelik Vida ve Mekanik Bağlantı Seti`,
      nameEn: `${labelPrefix} Stainless Steel Bolts & Hardware Connection Kit`,
      code: `ACC-${prefix}-KIT`,
      quantity: 1 * qty,
      unit: 'pce'
    }));

  } else if (type === 'zip-blind') {
    // Profiles
    materials.push(applyOverrides({
      category: 'profile',
      nameTr: 'Zip Perde Rüzgar Dayanımlı Yan Ray Profili',
      nameEn: 'Zip Screen Side Guide Channel Profile',
      code: 'ZIP-GUIDE-45',
      quantity: 2 * qty,
      unit: 'pce',
      dimensions: `${h} mm`,
      lengths: Array(2).fill(h)
    }));

    materials.push(applyOverrides({
      category: 'profile',
      nameTr: 'Zip Perde Üst Alüminyum Koruma Kutusu',
      nameEn: 'Zip Screen Head Box Aluminum Cover',
      code: 'ZIP-BOX-120',
      quantity: 1 * qty,
      unit: 'pce',
      dimensions: `${w} mm`,
      lengths: [w]
    }));

    materials.push(applyOverrides({
      category: 'profile',
      nameTr: 'Zip Alt Baza Ağırlık Profili',
      nameEn: 'Zip Bottom Weighted Terminal Bar',
      code: 'ZIP-BAR-50',
      quantity: 1 * qty,
      unit: 'pce',
      dimensions: `${w} mm`,
      lengths: [w]
    }));

    materials.push(applyOverrides({
      category: 'profile',
      nameTr: 'Alüminyum Kumaş Sarım Borusu (Tüp)',
      nameEn: 'Aluminum Fabric Roller Tube',
      code: 'ZIP-TUBE-70',
      quantity: 1 * qty,
      unit: 'pce',
      dimensions: `${w - 30} mm`,
      lengths: [w - 30]
    }));

    // Fabric
    const fabricSqm = Math.round(((w * (h + 200)) / 1000000) * 100) / 100;
    materials.push(applyOverrides({
      category: 'fabric',
      nameTr: `${config.fabricBrand} High-Tex Rüzgar Dayanımlı Fermuarlı Kumaş`,
      nameEn: `${config.fabricBrand} High-Tex Wind-Resistant Zipper Fabric`,
      code: 'FAB-FER-SOL',
      quantity: fabricSqm * qty,
      unit: 'sqm',
      dimensions: `${w}x${h + 200} mm`
    }));

    // Motor
    materials.push(applyOverrides({
      category: 'motor',
      nameTr: `${config.motorBrand} Engel Algılamalı Akıllı Zip Motoru`,
      nameEn: `${config.motorBrand} Obstacle Detection Smart Zip Motor`,
      code: 'MOT-SOM-ZIP',
      quantity: 1 * qty,
      unit: 'pce'
    }));

    // Accessories
    const sideZipperMeters = Math.ceil((2 * h) / 1000);
    materials.push(applyOverrides({
      category: 'accessory',
      nameTr: 'Rüzgar Dirençli Kenar Fermuar ve Plastik Kılavuz Kanallar',
      nameEn: 'Windproof Side Zipper & Inner PVC Guide Set',
      code: 'ACC-ZIP-KIT',
      quantity: sideZipperMeters * qty,
      unit: 'meter',
      dimensions: `${sideZipperMeters} m/unit`
    }));

  } else if (type === 'awning') {
    // Profiles
    materials.push(applyOverrides({
      category: 'profile',
      nameTr: 'Mafsallı Tente Kare Montaj Çelik Borusu',
      nameEn: 'Folding Awning Square Mounting Steel Bar',
      code: 'AWN-TUBE-40',
      quantity: 1 * qty,
      unit: 'pce',
      dimensions: `${w} mm`,
      lengths: [w]
    }));

    materials.push(applyOverrides({
      category: 'profile',
      nameTr: 'Tente Ön Alüminyum Saçak Profil Barı',
      nameEn: 'Awning Front Alum Profile Header',
      code: 'AWN-FRONT-80',
      quantity: 1 * qty,
      unit: 'pce',
      dimensions: `${w} mm`,
      lengths: [w]
    }));

    materials.push(applyOverrides({
      category: 'profile',
      nameTr: 'Alüminyum Sarım Borusu (Kanalcıklı)',
      nameEn: 'Awning Grooved Roller Winding Tube',
      code: 'AWN-ROUT-70',
      quantity: 1 * qty,
      unit: 'pce',
      dimensions: `${w - 40} mm`,
      lengths: [w - 40]
    }));

    // Fabric
    const fabricSqm = Math.round(((w * (h + 300)) / 1000000) * 100) / 100;
    materials.push(applyOverrides({
      category: 'fabric',
      nameTr: `${config.fabricBrand} UV Korumalı Su İtici Akrilik Tente Kumaşı`,
      nameEn: `${config.fabricBrand} UV Protected Water Repellent Acrylic Awning Fabric`,
      code: 'FAB-ACR-AWN',
      quantity: fabricSqm * qty,
      unit: 'sqm',
      dimensions: `${w}x${h + 300} mm`
    }));

    // Motor
    materials.push(applyOverrides({
      category: 'motor',
      nameTr: `${config.motorBrand} Manuel Acil Redüktörlü Tente Motor Seti`,
      nameEn: `${config.motorBrand} Manual Override Emergency Awning Motor Kit`,
      code: 'MOT-SOM-AWN',
      quantity: 1 * qty,
      unit: 'pce'
    }));

    // Accessories
    materials.push(applyOverrides({
      category: 'accessory',
      nameTr: 'Alüminyum Yaylı Mafsallı Tente Kolu',
      nameEn: 'Aluminum Heavy Duty Spring Loaded Folding Arm',
      code: 'ACC-AWN-ARM',
      quantity: 2 * qty,
      unit: 'pce'
    }));

    materials.push(applyOverrides({
      category: 'accessory',
      nameTr: 'Duvar / Tavan Ağır Hizmet Tente Kurulum Braket Seti',
      nameEn: 'Wall / Ceiling Heavy Duty Installation Bracket Set',
      code: 'ACC-AWN-BRK',
      quantity: 1 * qty,
      unit: 'pce'
    }));

  } else if (type === 'guillotine') {
    // Profiles
    materials.push(applyOverrides({
      category: 'profile',
      nameTr: 'Giyotin Sistem Dikey Taşıyıcı Yan Ray Profili',
      nameEn: 'Guillotine Vertical Carrier Side Guide Track',
      code: 'GUI-TRACK-150',
      quantity: 2 * qty,
      unit: 'pce',
      dimensions: `${h} mm`,
      lengths: Array(2).fill(h)
    }));

    materials.push(applyOverrides({
      category: 'profile',
      nameTr: 'Giyotin Sistem Üst Motor Kutusu Profili',
      nameEn: 'Guillotine System Top Box Engine Hood',
      code: 'GUI-BOX-180',
      quantity: 1 * qty,
      unit: 'pce',
      dimensions: `${w} mm`,
      lengths: [w]
    }));

    materials.push(applyOverrides({
      category: 'profile',
      nameTr: 'Giyotin Cam Panel Alt/Üst Yatay Baza Profili',
      nameEn: 'Guillotine Glass Panel Top/Bottom Horizontal Sash Profile',
      code: 'GUI-SASH-H',
      quantity: 6 * qty,
      unit: 'pce',
      dimensions: `${w - 70} mm`,
      lengths: Array(6).fill(w - 70)
    }));

    const vLength = Math.round(h / 3);
    materials.push(applyOverrides({
      category: 'profile',
      nameTr: 'Giyotin Cam Panel Yan Dikey Dikme Profili',
      nameEn: 'Guillotine Glass Panel Side Vertical Sash Profile',
      code: 'GUI-SASH-V',
      quantity: 6 * qty,
      unit: 'pce',
      dimensions: `${vLength} mm`,
      lengths: Array(6).fill(vLength)
    }));

    // Motor
    materials.push(applyOverrides({
      category: 'motor',
      nameTr: `${config.motorBrand} Giyotin Cam Zincirli/Kayışlı Ağır Hizmet Motor Seti`,
      nameEn: `${config.motorBrand} Guillotine Heavy Duty Chain/Belt Driven Motor Set`,
      code: 'MOT-AG-GUI',
      quantity: 1 * qty,
      unit: 'pce'
    }));

    // Accessories
    materials.push(applyOverrides({
      category: 'accessory',
      nameTr: 'Temperli Çift Katmanlı Isıcam Sinerji Cam Paketi (3 Panel)',
      nameEn: 'Tempered Double Glazed Energy Saving Glass Pack (3 Panels)',
      code: 'ACC-GUI-GLS',
      quantity: 3 * qty,
      unit: 'pce',
      dimensions: `${w - 90}x${Math.round(h / 3 - 40)} mm`
    }));

    materials.push(applyOverrides({
      category: 'accessory',
      nameTr: 'Giyotin Fitil, Toz Fırçası, Rüzgarlık ve Köşe Tapaları Kiti',
      nameEn: 'Guillotine Pile Weatherstripping, Dust Brush & End Caps Gasket Kit',
      code: 'ACC-GUI-SEAL',
      quantity: 1 * qty,
      unit: 'pce'
    }));

  } else if (type === 'glass-balcony') {
    // Profiles
    materials.push(applyOverrides({
      category: 'profile',
      nameTr: 'Sürgülü Cam Balkon Alt & Üst Taşıyıcı Ray Profili',
      nameEn: 'Sliding Glass Balcony Top & Bottom Track Profile',
      code: 'BAL-RAIL-120',
      quantity: 2 * qty,
      unit: 'pce',
      dimensions: `${w} mm`,
      lengths: Array(2).fill(w)
    }));

    materials.push(applyOverrides({
      category: 'profile',
      nameTr: 'Sürgülü Cam Balkon Yan Kasa Bitiş Profili',
      nameEn: 'Sliding Glass Balcony Side Jamb Finish Profile',
      code: 'BAL-SIDE-80',
      quantity: 2 * qty,
      unit: 'pce',
      dimensions: `${h} mm`,
      lengths: Array(2).fill(h)
    }));

    const panelCount = Math.ceil(w / 750) || 4;
    const panelW = Math.round(w / panelCount);
    materials.push(applyOverrides({
      category: 'profile',
      nameTr: 'Cam Panel Alt/Üst Yatay Alüminyum Baza Profili',
      nameEn: 'Glass Panel Bottom/Top Horizontal Base Clamping Profile',
      code: 'BAL-SASH-B',
      quantity: panelCount * 2 * qty,
      unit: 'pce',
      dimensions: `${panelW} mm`,
      lengths: Array(panelCount * 2).fill(panelW)
    }));

    const sashH = h - 110;
    materials.push(applyOverrides({
      category: 'profile',
      nameTr: 'Cam Panel Kenar Dikey Kenet/Dikme Profil Seti',
      nameEn: 'Glass Panel Edge Vertical Lock/Jamb Interlocking Profile',
      code: 'BAL-SASH-V',
      quantity: panelCount * 2 * qty,
      unit: 'pce',
      dimensions: `${sashH} mm`,
      lengths: Array(panelCount * 2).fill(sashH)
    }));

    // Accessories
    materials.push(applyOverrides({
      category: 'accessory',
      nameTr: 'Temperli Isıcam Çift Katmanlı Balkon Cam Ünitesi',
      nameEn: 'Tempered Double Glazed Balcony Glass Pane',
      code: 'ACC-BAL-GLS',
      quantity: panelCount * qty,
      unit: 'pce',
      dimensions: `${panelW - 20}x${h - 120} mm`
    }));

    materials.push(applyOverrides({
      category: 'accessory',
      nameTr: 'Paslanmaz Rulmanlı Çiftli Tekerlek, Kilit, Çekme Kolu ve Mıknatıslı Mıknatıs Conta Kiti',
      nameEn: 'Stainless Dual Ball-Bearing Wheels, Heavy Duty Lock, Pull Handle & Magnetic Gasket Kit',
      code: 'ACC-BAL-ACC',
      quantity: 1 * qty,
      unit: 'pce'
    }));
  }

  return materials;
};

export const calculateShadingItemPrice = (
  item: ShadingItem,
  config: ShadingConfig
): {
  finalPrice: number;
  totalCost: number;
  materials: { name: string; code: string; qty: number; unit: string; cost: number; total: number; isWeightBased?: boolean; weight?: number; lenMeters?: number }[];
} => {
  const singleItem = { ...item, quantity: 1 };
  const materials = getShadingItemBOM(singleItem, config);
  
  let totalCost = 0;
  const breakDown: { name: string; code: string; qty: number; unit: string; cost: number; total: number; isWeightBased?: boolean; weight?: number; lenMeters?: number }[] = [];
  
  materials.forEach(mat => {
    const code = mat.code;
    const defaultMatch = Object.entries(config.codeOverrides).find(([def, cust]) => cust === code);
    const originalCode = defaultMatch ? defaultMatch[0] : code;
    
    let unitCost = 0;
    let matTotal = 0;
    let isWeightBased = false;
    let weight = 0;
    let lenMeters = 0;

    if (config.pricingMethod === 'weight' && mat.category === 'profile') {
      isWeightBased = true;
      const defaultW = DEFAULT_PROFILE_WEIGHTS[originalCode] || DEFAULT_PROFILE_WEIGHTS[code] || 1.5;
      weight = config.profileWeights?.[code] ?? config.profileWeights?.[originalCode] ?? defaultW;
      
      if (mat.lengths && mat.lengths.length > 0) {
        const sumMm = mat.lengths.reduce((sum, l) => sum + l, 0);
        lenMeters = sumMm / 1000;
      } else if (mat.dimensions && mat.dimensions.includes('mm')) {
        const parsed = parseFloat(mat.dimensions);
        if (!isNaN(parsed)) {
          lenMeters = (parsed * mat.quantity) / 1000;
        } else {
          lenMeters = mat.quantity;
        }
      } else {
        lenMeters = mat.quantity;
      }
      
      const kgPrice = config.aluminiumKgPrice ?? 5.5;
      
      // Cost per single piece (average) = (total meters / quantity) * weight * kgPrice
      unitCost = (lenMeters / (mat.quantity || 1)) * weight * kgPrice;
      matTotal = lenMeters * weight * kgPrice;
    } else {
      unitCost = config.materialCosts?.[code] ?? config.materialCosts?.[originalCode] ?? 0;
      matTotal = mat.quantity * unitCost;
    }
    
    totalCost += matTotal;
    
    breakDown.push({
      name: mat.nameTr,
      code: mat.code,
      qty: mat.quantity,
      unit: mat.unit,
      cost: unitCost,
      total: matTotal,
      isWeightBased,
      weight,
      lenMeters
    });
  });
  
  const markup = config.markupPercentage ?? 35;
  const finalPrice = totalCost * (1 + markup / 100);
  
  return {
    finalPrice: Math.round(finalPrice),
    totalCost: Math.round(totalCost),
    materials: breakDown
  };
};

// 1D Bin-packing cutting optimization (First-Fit Decreasing)
export const optimizeShadingCuts = (lengths: number[], barLengthMm: number, sawKerfMm: number) => {
  const sortedCuts = [...lengths].sort((a, b) => b - a);
  const bars: { cuts: number[]; remaining: number }[] = [];
  
  for (const cut of sortedCuts) {
    const cutWithKerf = cut + sawKerfMm;
    let bestBarIndex = -1;
    let minRemaining = Number.MAX_VALUE;

    // Best-fit search
    for (let i = 0; i < bars.length; i++) {
      if (bars[i].remaining >= cutWithKerf) {
        const remainingAfter = bars[i].remaining - cutWithKerf;
        if (remainingAfter < minRemaining) {
          minRemaining = remainingAfter;
          bestBarIndex = i;
        }
      }
    }

    if (bestBarIndex !== -1) {
      bars[bestBarIndex].cuts.push(cut);
      bars[bestBarIndex].remaining -= cutWithKerf;
    } else {
      bars.push({
        cuts: [cut],
        remaining: barLengthMm - cutWithKerf
      });
    }
  }
  return bars;
};

export const ShadingBOMAndOpt: React.FC<ShadingBOMAndOptProps> = ({ shadingItems, project, onUpdateProject, lang, theme, currencySymbol }) => {
  const [viewMode, setViewMode] = useState<'bom' | 'opt' | 'settings'>('bom');
  const [bomFilter, setBomFilter] = useState<'all' | 'profile' | 'fabric' | 'motor' | 'accessory'>('all');

  // Load custom configurations from local storage
  const [config, setConfig] = useState<ShadingConfig>(() => {
    const saved = localStorage.getItem('alumetric_shading_config');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { ...DEFAULT_CONFIG, ...parsed };
      } catch (e) {
        return DEFAULT_CONFIG;
      }
    }
    return DEFAULT_CONFIG;
  });

  const [localMotor, setLocalMotor] = useState(config.motorBrand);
  const [localFabric, setLocalFabric] = useState(config.fabricBrand);
  const [localBarLength, setLocalBarLength] = useState(config.barLength);
  const [localSawKerf, setLocalSawKerf] = useState(config.sawKerf);
  
  // Cost-based pricing states
  const [localEnableBomPricing, setLocalEnableBomPricing] = useState(config.enableBomPricing || false);
  const [localMarkupPercentage, setLocalMarkupPercentage] = useState(config.markupPercentage ?? 35);
  const [localPricingMethod, setLocalPricingMethod] = useState<'piece' | 'weight'>(config.pricingMethod || 'piece');
  const [localAluminiumKgPrice, setLocalAluminiumKgPrice] = useState<number>(config.aluminiumKgPrice ?? 5.5);
  const [editingCostCode, setEditingCostCode] = useState<string | null>(null);
  const [tempCostValue, setTempCostValue] = useState<string>('');
  const [editingWeightCode, setEditingWeightCode] = useState<string | null>(null);
  const [tempWeightValue, setTempWeightValue] = useState<string>('');

  // For inline mappings editing
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [tempCustomCode, setTempCustomCode] = useState('');
  const [tempCustomNameTr, setTempCustomNameTr] = useState('');
  const [tempCustomNameEn, setTempCustomNameEn] = useState('');

  // Update form values if config changes
  useEffect(() => {
    setLocalMotor(config.motorBrand);
    setLocalFabric(config.fabricBrand);
    setLocalBarLength(config.barLength);
    setLocalSawKerf(config.sawKerf);
    setLocalEnableBomPricing(config.enableBomPricing || false);
    setLocalMarkupPercentage(config.markupPercentage ?? 35);
    setLocalPricingMethod(config.pricingMethod || 'piece');
    setLocalAluminiumKgPrice(config.aluminiumKgPrice ?? 5.5);
  }, [config]);

  const saveConfig = (newCfg: ShadingConfig) => {
    setConfig(newCfg);
    localStorage.setItem('alumetric_shading_config', JSON.stringify(newCfg));
    
    // Auto-sync pricing if enabled
    if (newCfg.enableBomPricing && project && onUpdateProject) {
      const updatedItems = (project.shadingItems || []).map(item => {
        const computed = calculateShadingItemPrice(item, newCfg);
        return { ...item, unitPrice: computed.finalPrice };
      });
      onUpdateProject({
        ...project,
        shadingItems: updatedItems
      });
    }
  };

  const handleApplyBOMPricesToProposal = () => {
    if (!project || !onUpdateProject) return;
    const updatedItems = (project.shadingItems || []).map(item => {
      const computed = calculateShadingItemPrice(item, config);
      return { ...item, unitPrice: computed.finalPrice };
    });
    onUpdateProject({
      ...project,
      shadingItems: updatedItems
    });
    alert(
      lang === 'tr' 
        ? 'Malzeme listesi maliyet hesaplamaları başarıyla teklif birim fiyatlarına aktarıldı!' 
        : 'Material list cost computations successfully applied to proposal unit prices!'
    );
  };

  const handleResetSettings = () => {
    if (confirm(lang === 'tr' ? 'Tüm malzeme kodları ve marka tanımları fabrika ayarlarına sıfırlanacaktır. Emin misiniz?' : 'All material codes and brands will be reset to defaults. Are you sure?')) {
      saveConfig(DEFAULT_CONFIG);
    }
  };

  const handleSaveGlobalParams = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = {
      ...config,
      motorBrand: localMotor,
      fabricBrand: localFabric,
      barLength: Number(localBarLength) || 6000,
      sawKerf: Number(localSawKerf) || 5,
      enableBomPricing: localEnableBomPricing,
      markupPercentage: Number(localMarkupPercentage) ?? 35,
      pricingMethod: localPricingMethod,
      aluminiumKgPrice: localAluminiumKgPrice
    };
    saveConfig(updated);
    alert(lang === 'tr' ? 'Küresel marka, ebat ve fiyatlandırma parametreleri kaydedildi!' : 'Global brand, dimension and pricing settings saved successfully!');
  };

  const handleStartEditingCode = (code: string, currentCustomCode: string, currentNameTr: string, currentNameEn: string) => {
    setEditingCode(code);
    setTempCustomCode(currentCustomCode || code);
    setTempCustomNameTr(config.nameOverridesTr[code] || currentNameTr);
    setTempCustomNameEn(config.nameOverridesEn[code] || currentNameEn);
  };

  const handleSaveCodeOverride = (defaultCode: string) => {
    const updatedCodes = { ...config.codeOverrides };
    const updatedNamesTr = { ...config.nameOverridesTr };
    const updatedNamesEn = { ...config.nameOverridesEn };

    if (tempCustomCode.trim() !== '' && tempCustomCode !== defaultCode) {
      updatedCodes[defaultCode] = tempCustomCode.trim();
    } else {
      delete updatedCodes[defaultCode];
    }

    if (tempCustomNameTr.trim() !== '') {
      updatedNamesTr[defaultCode] = tempCustomNameTr.trim();
    } else {
      delete updatedNamesTr[defaultCode];
    }

    if (tempCustomNameEn.trim() !== '') {
      updatedNamesEn[defaultCode] = tempCustomNameEn.trim();
    } else {
      delete updatedNamesEn[defaultCode];
    }

    const updated = {
      ...config,
      codeOverrides: updatedCodes,
      nameOverridesTr: updatedNamesTr,
      nameOverridesEn: updatedNamesEn
    };
    saveConfig(updated);
    setEditingCode(null);
  };

  const handleStartEditingCost = (code: string, currentCost: number) => {
    setEditingCostCode(code);
    setTempCostValue(currentCost.toString());
  };

  const handleSaveCost = (defaultCode: string) => {
    const updatedCosts = { ...(config.materialCosts || {}) };
    updatedCosts[defaultCode] = parseFloat(tempCostValue) || 0;

    const updated = {
      ...config,
      materialCosts: updatedCosts
    };
    saveConfig(updated);
    setEditingCostCode(null);
  };

  const handleStartEditingWeight = (code: string, currentWeight: number) => {
    setEditingWeightCode(code);
    setTempWeightValue(currentWeight.toString());
  };

  const handleSaveWeight = (defaultCode: string) => {
    const updatedWeights = { ...(config.profileWeights || {}) };
    updatedWeights[defaultCode] = parseFloat(tempWeightValue) || 0;

    const updated = {
      ...config,
      profileWeights: updatedWeights
    };
    saveConfig(updated);
    setEditingWeightCode(null);
  };

  const dict = useMemo(() => ({
    tr: {
      bomTitle: 'Malzeme Listesi (BOM)',
      optTitle: 'Profil Kesim Planı',
      settingsTitle: 'Malzeme & Kod Ayarları',
      noItems: 'Henüz eklenmiş gölgelendirme teklifiniz bulunmamaktadır. Lütfen 3D Tasarımcı ekranından sistem tasarlayıp ekleyin.',
      filterAll: 'Tüm Malzemeler',
      filterProfile: 'Alüminyum Profiller',
      filterFabric: 'Örtü ve Kumaşlar',
      filterMotor: 'Motor ve Otomasyon',
      filterAccessory: 'Aksesuarlar & Camlar',
      systemDetails: 'Sistem Bazlı Malzemeler',
      aggregatedSummary: 'Proje Geneli Malzeme Metrajı',
      itemCode: 'Malzeme Kodu',
      itemName: 'Açıklama',
      itemQty: 'Miktar',
      itemUnit: 'Birim',
      itemDim: 'Ölçüler / Kesim',
      efficiency: 'Kullanım Oranı',
      waste: 'Fire Oranı',
      barsUsed: 'Gereken Profil (Boy)',
      totalCuts: 'Toplam Kesim Sayısı',
      barLength: 'Standart Profil Boyu',
      bladeKerf: 'Testere Kalınlığı (Fire)',
      barNo: 'Profil Boyu',
      remaining: 'Kalan Artık',
      exportCSV: 'Excel/CSV Olarak İndir',
      successMessage: 'Malzeme optimizasyon raporu başarıyla güncellendi.',
      profilAnalysis: 'Alüminyum Kesim Optimizasyon Analizi',
      globalSettingsLabel: 'Küresel Marka ve Boyut Ayarları',
      motorBrandLabel: 'Varsayılan Motor Markası',
      fabricBrandLabel: 'Varsayılan Kumaş/Tente Markası',
      stockBarLengthLabel: 'Standart Stok Profil Boyu (mm)',
      sawBladeKerfLabel: 'Testere Bıçağı Kalınlığı (mm)',
      customCodeMappings: 'Malzeme Kodları ve İsim Özelleştirme Kütüphanesi',
      customCodeDesc: 'Aşağıdaki tabloda Alumetric tarafında otomatik üretilen malzemelerin varsayılan kodlarını ve açıklamalarını kendi ERP sisteminize veya üretici kodlarınıza göre özelleştirebilirsiniz.',
      originalCode: 'Sistem Kodu',
      customCode: 'Sizin Kodunuz (SKU)',
      customNameTr: 'Özel Türkçe İsim',
      customNameEn: 'Özel İngilizce İsim',
      actions: 'İşlem',
      edit: 'Düzenle',
      save: 'Kaydet',
      cancel: 'İptal',
      resetDefaults: 'Ayarları Sıfırla'
    },
    en: {
      bomTitle: 'Material List (BOM)',
      optTitle: 'Cutting Optimization',
      settingsTitle: 'Material & Code Settings',
      noItems: 'No active shading systems found. Please design and add shading items using the 3D Designer.',
      filterAll: 'All Materials',
      filterProfile: 'Aluminum Profiles',
      filterFabric: 'Fabrics & Screens',
      filterMotor: 'Motors & Automation',
      filterAccessory: 'Accessories & Glass',
      systemDetails: 'System-Based Itemization',
      aggregatedSummary: 'Project Aggregated Bill',
      itemCode: 'Material Code',
      itemName: 'Description',
      itemQty: 'Quantity',
      itemUnit: 'Unit',
      itemDim: 'Dimensions / Cut',
      efficiency: 'Efficiency',
      waste: 'Waste',
      barsUsed: 'Required Bars (qty)',
      totalCuts: 'Total Cut Count',
      barLength: 'Stock Bar Length',
      bladeKerf: 'Saw Blade Kerf',
      barNo: 'Stock Bar',
      remaining: 'Remaining Leftover',
      exportCSV: 'Export as Excel/CSV',
      successMessage: 'Material optimization report updated successfully.',
      profilAnalysis: 'Aluminum Profile Cutting Stock Optimization',
      globalSettingsLabel: 'Global Brand and Dimensions Setup',
      motorBrandLabel: 'Default Motor Brand',
      fabricBrandLabel: 'Default Screen/Fabric Brand',
      stockBarLengthLabel: 'Stock Profile Length (mm)',
      sawBladeKerfLabel: 'Saw Blade Kerf/Thickness (mm)',
      customCodeMappings: 'Custom SKU & Description Mapping Library',
      customCodeDesc: 'Customize the default Alumetric material codes and descriptions in the table below to match your internal ERP, manufacturer part numbers, or regional naming conventions.',
      originalCode: 'System Code',
      customCode: 'Your Code (SKU)',
      customNameTr: 'Custom Name (TR)',
      customNameEn: 'Custom Name (EN)',
      actions: 'Actions',
      edit: 'Edit',
      save: 'Save',
      cancel: 'Cancel',
      resetDefaults: 'Reset to Defaults'
    }
  }), []);

  const tLocal = (key: keyof typeof dict['en']) => {
    return dict[lang === 'tr' ? 'tr' : 'en'][key];
  };

  // 1. Generate individual BOM lists using customized config
  const systemBOMs = useMemo(() => {
    return shadingItems.map(item => ({
      item,
      bom: getShadingItemBOM(item, config)
    }));
  }, [shadingItems, config]);

  // Project-wide Material Cost and Suggested Pricing calculations
  const pricingSummary = useMemo(() => {
    let totalMaterialCost = 0;
    let totalProposalPrice = 0;
    
    shadingItems.forEach(item => {
      const result = calculateShadingItemPrice(item, config);
      totalMaterialCost += result.totalCost * (item.quantity || 1);
      totalProposalPrice += (item.unitPrice || 0) * (item.quantity || 1);
    });

    const suggestedProposalPrice = totalMaterialCost * (1 + (config.markupPercentage ?? 35) / 100);
    
    return {
      totalMaterialCost,
      totalProposalPrice,
      suggestedProposalPrice
    };
  }, [shadingItems, config]);

  // 2. Aggregate BOM across all systems for summary
  const aggregatedBOM = useMemo(() => {
    const map: Record<string, ShadingMaterial & { isProfileWithLengths: boolean; originalCode: string }> = {};
    
    systemBOMs.forEach(({ bom }) => {
      bom.forEach(mat => {
        // Find original code mapping if overridden
        let originalCode = mat.code;
        // Search default list to find matching default code if current code is custom
        const defaultMatch = Object.entries(config.codeOverrides).find(([def, cust]) => cust === mat.code);
        if (defaultMatch) {
          originalCode = defaultMatch[0];
        }

        const key = mat.code;
        if (!map[key]) {
          map[key] = {
            ...mat,
            originalCode,
            lengths: mat.lengths ? [...mat.lengths] : undefined,
            isProfileWithLengths: !!mat.lengths
          };
        } else {
          map[key].quantity += mat.quantity;
          if (mat.lengths && map[key].lengths) {
            map[key].lengths = [...(map[key].lengths || []), ...(mat.lengths || [])];
          }
        }
      });
    });

    return Object.values(map);
  }, [systemBOMs, config]);

  // 3. Cutting Stock Optimization using customized length & kerf
  const optimizationResults = useMemo(() => {
    const results: {
      profileCode: string;
      nameTr: string;
      nameEn: string;
      totalCuts: number;
      bars: { cuts: number[]; remaining: number }[];
      totalBars: number;
      efficiency: number;
      waste: number;
      totalUsedLengthMm: number;
    }[] = [];

    aggregatedBOM.forEach(mat => {
      if (mat.category === 'profile' && mat.lengths && mat.lengths.length > 0) {
        const rawCuts = mat.lengths; 
        const optimizedBars = optimizeShadingCuts(rawCuts, config.barLength, config.sawKerf);
        
        const totalUsed = optimizedBars.reduce((sum, bar) => sum + (config.barLength - bar.remaining), 0);
        const totalCapacity = optimizedBars.length * config.barLength;
        const efficiency = totalCapacity > 0 ? (totalUsed / totalCapacity) * 100 : 0;

        results.push({
          profileCode: mat.code,
          nameTr: mat.nameTr,
          nameEn: mat.nameEn,
          totalCuts: rawCuts.length,
          bars: optimizedBars,
          totalBars: optimizedBars.length,
          efficiency,
          waste: 100 - efficiency,
          totalUsedLengthMm: totalUsed
        });
      }
    });

    return results;
  }, [aggregatedBOM, config.barLength, config.sawKerf]);

  if (shadingItems.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center max-w-xl mx-auto space-y-4 shadow-xl">
        <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto border border-indigo-500/10">
          <Info size={22} />
        </div>
        <h4 className="text-white font-bold text-sm uppercase tracking-wider">{lang === 'tr' ? 'Gölgelendirme Kalemleri Boş' : 'No Shading Positions'}</h4>
        <p className="text-xs text-slate-400 leading-relaxed font-semibold">
          {tLocal('noItems')}
        </p>
      </div>
    );
  }

  // Download BOM CSV
  const handleExportCSV = () => {
    let csv = '\uFEFF'; // UTF-8 BOM
    csv += `${lang === 'tr' ? 'Malzeme Kodu,Malzeme Kategorisi,Açıklama,Miktar,Birim,Ölçü' : 'Code,Category,Description,Quantity,Unit,Dimension'}\n`;
    
    aggregatedBOM.forEach(item => {
      const desc = lang === 'tr' ? item.nameTr : item.nameEn;
      csv += `"${item.code}","${item.category.toUpperCase()}","${desc}",${item.quantity},"${item.unit}","${item.dimensions || '-'}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Alumetric_Shading_BOM_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredAggregatedBOM = aggregatedBOM.filter(item => bomFilter === 'all' || item.category === bomFilter);

  // Helper to compile all distinct default material codes for setting mapping editor
  const allDefaultMaterialsInProject = (() => {
    const defaultBOM = shadingItems.flatMap(item => {
      // Create BOM using DEFAULT config to extract clean default keys
      return getShadingItemBOM(item, DEFAULT_CONFIG);
    });

    const uniqueMap: Record<string, ShadingMaterial> = {};
    defaultBOM.forEach(mat => {
      if (!uniqueMap[mat.code]) {
        uniqueMap[mat.code] = mat;
      }
    });
    return Object.values(uniqueMap);
  })();

  const isMotorCustom = !PREDEFINED_MOTORS.includes(localMotor);
  const isFabricCustom = !PREDEFINED_FABRICS.includes(localFabric);

  return (
    <div className="space-y-8 animate-in fade-in duration-300 font-sans print:bg-white print:text-black">
      
      {/* Tab Selector & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-4 print:hidden">
        <div className="flex bg-slate-950 p-1 rounded-2xl border border-white/5 shadow-inner">
          <button
            onClick={() => setViewMode('bom')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 ${viewMode === 'bom' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <FileText size={15} />
            <span>{tLocal('bomTitle')}</span>
          </button>
          <button
            onClick={() => setViewMode('opt')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 ${viewMode === 'opt' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <Scissors size={15} />
            <span>{tLocal('optTitle')}</span>
          </button>
          <button
            onClick={() => setViewMode('settings')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 ${viewMode === 'settings' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <Settings size={15} />
            <span>{tLocal('settingsTitle')}</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {viewMode === 'bom' && (
            <button
              onClick={handleExportCSV}
              className="bg-slate-900 hover:bg-slate-800 border border-white/5 hover:border-slate-850 text-slate-200 hover:text-white px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all shadow-md"
            >
              <Download size={14} />
              <span>{tLocal('exportCSV')}</span>
            </button>
          )}
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-xl flex items-center gap-1.5">
            <CheckCircle size={12} />
            <span>{tLocal('successMessage')}</span>
          </div>
        </div>
      </div>

      {/* VIEW 1: BILL OF MATERIALS */}
      {viewMode === 'bom' && (
        <div className="space-y-8">
          
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <button
              onClick={() => setBomFilter('all')}
              className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider border transition-all ${bomFilter === 'all' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-slate-900 border-white/5 text-slate-400 hover:text-slate-200'}`}
            >
              <Layers className="inline mr-1" size={13} />
              {tLocal('filterAll')}
            </button>
            <button
              onClick={() => setBomFilter('profile')}
              className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider border transition-all ${bomFilter === 'profile' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-slate-900 border-white/5 text-slate-400 hover:text-slate-200'}`}
            >
              <Package className="inline mr-1" size={13} />
              {tLocal('filterProfile')}
            </button>
            <button
              onClick={() => setBomFilter('fabric')}
              className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider border transition-all ${bomFilter === 'fabric' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-slate-900 border-white/5 text-slate-400 hover:text-slate-200'}`}
            >
              <Layers className="inline mr-1" size={13} />
              {tLocal('filterFabric')}
            </button>
            <button
              onClick={() => setBomFilter('motor')}
              className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider border transition-all ${bomFilter === 'motor' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-slate-900 border-white/5 text-slate-400 hover:text-slate-200'}`}
            >
              <Cpu className="inline mr-1" size={13} />
              {tLocal('filterMotor')}
            </button>
            <button
              onClick={() => setBomFilter('accessory')}
              className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider border transition-all ${bomFilter === 'accessory' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-slate-900 border-white/5 text-slate-400 hover:text-slate-200'}`}
            >
              <Wrench className="inline mr-1" size={13} />
              {tLocal('filterAccessory')}
            </button>
          </div>

          {/* Malzeme Maliyeti & Teklif Fiyatlandırma Yönetim Paneli */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6 print:hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-500/10 rounded-2xl text-indigo-400 shrink-0">
                  <TrendingUp size={20} />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-100 uppercase tracking-tight">
                    {lang === 'tr' ? 'Malzeme Esaslı Teklif Fiyatlandırması' : 'Material-Based Proposal Pricing'}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium">
                    {lang === 'tr' 
                      ? 'Gölgelendirme sistemlerinin birim fiyatlarını, aşağıdaki gerçek malzeme metrajı ve maliyet kütüphanesine göre hesaplayın.' 
                      : 'Calculate shading system prices based on the actual material takeoff and cost library below.'}
                  </p>
                </div>
              </div>

              {project && onUpdateProject && (
                <button
                  onClick={handleApplyBOMPricesToProposal}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-wider px-5 py-3 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/10 shrink-0 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <RefreshCw size={14} />
                  <span>{lang === 'tr' ? 'Hesaplanan Fiyatları Teklife Uygula' : 'Apply Computed Prices to Proposal'}</span>
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-6 bg-slate-950/40 p-4 rounded-2xl border border-white/5">
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">
                  {lang === 'tr' ? 'Profil Fiyatlandırma Yöntemi' : 'Profile Pricing Method'}
                </span>
                <div className="flex bg-slate-950 p-1 rounded-xl border border-white/5">
                  <button
                    onClick={() => {
                      const updated = { ...config, pricingMethod: 'piece' as const };
                      saveConfig(updated);
                      setLocalPricingMethod('piece');
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      localPricingMethod === 'piece' 
                        ? 'bg-indigo-600 text-white shadow' 
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {lang === 'tr' ? 'Parça / Adet Başı' : 'Per Piece'}
                  </button>
                  <button
                    onClick={() => {
                      const updated = { ...config, pricingMethod: 'weight' as const };
                      saveConfig(updated);
                      setLocalPricingMethod('weight');
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      localPricingMethod === 'weight' 
                        ? 'bg-indigo-600 text-white shadow' 
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {lang === 'tr' ? 'Kilo Fiyatı + Metre Ağırlığı' : 'Kg Price + Meter Weight'}
                  </button>
                </div>
              </div>

              {localPricingMethod === 'weight' && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">
                    {lang === 'tr' ? 'Alüminyum Kilo Fiyatı' : 'Aluminum Kg Price'}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="any"
                      value={localAluminiumKgPrice}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setLocalAluminiumKgPrice(val);
                        const updated = { ...config, aluminiumKgPrice: val };
                        saveConfig(updated);
                      }}
                      className="w-24 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-white focus:outline-none focus:border-indigo-500"
                    />
                    <span className="text-xs font-bold text-slate-400">{currencySymbol} / kg</span>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Card 1: Toplam Malzeme Maliyeti */}
              <div className="bg-slate-950/80 rounded-2xl p-4.5 border border-white/5 shadow-inner flex flex-col justify-between">
                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block mb-2">
                  {lang === 'tr' ? 'Toplam Malzeme Maliyeti' : 'Total Material Cost'}
                </span>
                <div>
                  <span className="text-2xl font-black text-slate-100">
                    {pricingSummary.totalMaterialCost.toLocaleString()}
                  </span>
                  <span className="text-sm font-bold text-slate-400 ml-1.5">{currencySymbol}</span>
                </div>
                <span className="text-[9px] text-slate-500 font-mono mt-2 block font-medium">
                  {lang === 'tr' ? 'Projeye ait tüm malzemelerin ham maliyeti' : 'Raw sum of all items in bill of materials'}
                </span>
              </div>

              {/* Card 2: Kar Marjı Oranı */}
              <div className="bg-slate-950/80 rounded-2xl p-4.5 border border-white/5 shadow-inner flex flex-col justify-between">
                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block mb-2">
                  {lang === 'tr' ? 'Kar Marjı Oranı (%)' : 'Markup Profit Margin (%)'}
                </span>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="200"
                    step="5"
                    value={localMarkupPercentage}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setLocalMarkupPercentage(val);
                      const updated = {
                        ...config,
                        markupPercentage: val
                      };
                      saveConfig(updated);
                    }}
                    className="w-full accent-indigo-500 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-lg font-black text-indigo-400 shrink-0 min-w-[45px] text-right">
                    %{localMarkupPercentage}
                  </span>
                </div>
                <span className="text-[9px] text-slate-500 font-mono mt-2 block font-medium">
                  {lang === 'tr' ? 'Maliyetin üzerine eklenecek kar oranı' : 'Profit rate added on top of the cost'}
                </span>
              </div>

              {/* Card 3: Önerilen Fiyat */}
              <div className="bg-slate-950/80 rounded-2xl p-4.5 border border-white/5 shadow-inner flex flex-col justify-between">
                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block mb-2">
                  {lang === 'tr' ? 'Önerilen Satış Tutarı' : 'Suggested Selling Total'}
                </span>
                <div>
                  <span className="text-2xl font-black text-indigo-400">
                    {pricingSummary.suggestedProposalPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                  <span className="text-sm font-bold text-indigo-400 ml-1.5">{currencySymbol}</span>
                </div>
                <span className="text-[9px] text-slate-500 font-mono mt-2 block font-medium">
                  {lang === 'tr' ? `Maliyet + %${localMarkupPercentage} Kar Marjı` : `Cost + ${localMarkupPercentage}% Margin`}
                </span>
              </div>

              {/* Card 4: Mevcut Teklif Durumu */}
              <div className="bg-slate-950/80 rounded-2xl p-4.5 border border-white/5 shadow-inner flex flex-col justify-between">
                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block mb-2">
                  {lang === 'tr' ? 'Mevcut Teklif Tutarı' : 'Current Proposal Price'}
                </span>
                <div>
                  <span className="text-2xl font-black text-slate-100">
                    {pricingSummary.totalProposalPrice.toLocaleString()}
                  </span>
                  <span className="text-sm font-bold text-slate-400 ml-1.5">{currencySymbol}</span>
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  {Math.abs(pricingSummary.totalProposalPrice - pricingSummary.suggestedProposalPrice) < 5 ? (
                    <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                      {lang === 'tr' ? 'Eşitlendi ✓' : 'Synced ✓'}
                    </span>
                  ) : (
                    <span className="text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                      {lang === 'tr' ? 'Fark Var ⚠' : 'Difference ⚠'}
                    </span>
                  )}
                  <span className="text-[9px] text-slate-500 font-semibold font-mono">
                    {lang === 'tr' ? 'Teklifte kayıtlı fiyat' : 'Saved in active quote'}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-2xl p-4 flex items-start gap-3">
              <span className="text-base shrink-0">💡</span>
              <p className="text-[11px] text-slate-400 font-semibold leading-relaxed">
                {lang === 'tr' 
                  ? 'Malzemelerin birim maliyetlerini (Birim Maliyet sütunu), aşağıdaki parça tablosundaki kalemlerin sağında bulunan düzenleme simgelerine tıklayarak anında güncelleyebilirsiniz. Değişiklikler anında yukarıdaki hesaplamaya yansır.' 
                  : 'You can instantly modify the unit cost of any item in the material list below by clicking its edit icon. The calculations and suggestions above will adapt instantly.'}
              </p>
            </div>
          </div>

          {/* Aggregated Project BOM */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl avoid-break print:bg-white print:border-slate-200">
            <div className="bg-slate-950 p-6 border-b border-slate-800 flex justify-between items-center print:bg-slate-50 print:border-slate-200">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-500/10 rounded-xl text-indigo-400">
                  <LayoutGrid size={18} />
                </div>
                <div>
                  <h3 className="font-black text-sm text-white print:text-black uppercase tracking-widest">{tLocal('aggregatedSummary')}</h3>
                  <p className="text-[10px] text-slate-500 mt-0.5 font-semibold uppercase tracking-wider">
                    {lang === 'tr' ? 'Tüm aktif gölgelendirme ünitelerinin parça listesi (Özel kodlar dahildir)' : 'Total itemization across all configured shading items (Includes custom SKUs)'}
                  </p>
                </div>
              </div>
            </div>

            <table className="w-full text-sm text-left border-collapse">
              <thead className="text-[10px] text-slate-400 uppercase bg-slate-950 border-b border-slate-800 print:bg-slate-100 print:text-slate-700 print:border-slate-300">
                <tr>
                  <th className="px-6 py-3.5 font-black tracking-widest">{tLocal('itemCode')}</th>
                  <th className="px-6 py-3.5 font-black tracking-widest">{tLocal('itemName')}</th>
                  <th className="px-6 py-3.5 text-right font-black tracking-widest">{tLocal('itemQty')}</th>
                  <th className="px-6 py-3.5 text-center font-black tracking-widest">{tLocal('itemUnit')}</th>
                  <th className="px-6 py-3.5 text-right font-black tracking-widest">{tLocal('itemDim')}</th>
                  <th className="px-6 py-3.5 text-right font-black tracking-widest">{lang === 'tr' ? 'Birim Maliyet' : 'Unit Cost'}</th>
                  <th className="px-6 py-3.5 text-right font-black tracking-widest">{lang === 'tr' ? 'Toplam Tutar' : 'Total Cost'}</th>
                  <th className="px-6 py-3.5 text-center font-black tracking-widest print:hidden">{tLocal('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 print:divide-slate-200">
                {filteredAggregatedBOM.map((item, idx) => {
                  let categoryColor = 'bg-slate-950 border-white/5 text-slate-400';
                  if (item.category === 'profile') categoryColor = 'bg-sky-500/10 text-sky-400 border-sky-500/10';
                  else if (item.category === 'fabric') categoryColor = 'bg-amber-500/10 text-amber-400 border-amber-500/10';
                  else if (item.category === 'motor') categoryColor = 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/10';
                  else if (item.category === 'accessory') categoryColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/10';

                  const defaultCodeOfThisItem = item.originalCode || item.code;
                  const isBeingEdited = editingCode === defaultCodeOfThisItem;
                  
                  let unitCost = 0;
                  let totalCostOfItem = 0;
                  let isWeightBased = false;
                  let weightVal = 0;
                  let lenMeters = 0;

                  if (config.pricingMethod === 'weight' && item.category === 'profile') {
                    isWeightBased = true;
                    const defaultW = DEFAULT_PROFILE_WEIGHTS[defaultCodeOfThisItem] || DEFAULT_PROFILE_WEIGHTS[item.code] || 1.5;
                    weightVal = config.profileWeights?.[item.code] ?? config.profileWeights?.[defaultCodeOfThisItem] ?? defaultW;
                    
                    if (item.lengths && item.lengths.length > 0) {
                      const sumMm = item.lengths.reduce((sum, l) => sum + l, 0);
                      lenMeters = sumMm / 1000;
                    } else if (item.dimensions && item.dimensions.includes('mm')) {
                      const parsed = parseFloat(item.dimensions);
                      if (!isNaN(parsed)) {
                        lenMeters = (parsed * item.quantity) / 1000;
                      } else {
                        lenMeters = item.quantity;
                      }
                    } else {
                      lenMeters = item.quantity;
                    }
                    
                    const kgPrice = config.aluminiumKgPrice ?? 5.5;
                    unitCost = (lenMeters / (item.quantity || 1)) * weightVal * kgPrice;
                    totalCostOfItem = lenMeters * weightVal * kgPrice;
                  } else {
                    unitCost = config.materialCosts?.[item.code] ?? config.materialCosts?.[defaultCodeOfThisItem] ?? 0;
                    totalCostOfItem = item.quantity * unitCost;
                  }

                  const isEditingCost = editingCostCode === defaultCodeOfThisItem;
                  const isEditingWeight = editingWeightCode === defaultCodeOfThisItem;

                  return (
                    <tr key={idx} className="hover:bg-slate-850/40 transition-colors">
                      <td className="px-6 py-4 font-mono text-xs font-bold">
                        {isBeingEdited ? (
                          <input
                            type="text"
                            value={tempCustomCode}
                            onChange={(e) => setTempCustomCode(e.target.value)}
                            placeholder={defaultCodeOfThisItem}
                            className="bg-slate-950 border border-indigo-500/30 text-white rounded px-2 py-1 font-mono text-xs w-full focus:outline-none focus:border-indigo-500"
                          />
                        ) : (
                          <div className="flex flex-col gap-1">
                            <span className={`px-2.5 py-1 rounded-lg border text-center ${categoryColor}`}>
                              {item.code}
                            </span>
                            {item.code !== defaultCodeOfThisItem && (
                              <span className="text-[9px] text-slate-500 font-normal italic text-center">
                                {lang === 'tr' ? 'Asıl:' : 'Orig:'} {defaultCodeOfThisItem}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {isBeingEdited ? (
                          <div className="space-y-1">
                            <input
                              type="text"
                              value={tempCustomNameTr}
                              onChange={(e) => setTempCustomNameTr(e.target.value)}
                              placeholder="Türkçe Açıklama"
                              className="bg-slate-950 border border-indigo-500/30 text-white rounded px-2 py-1 text-xs w-full focus:outline-none"
                            />
                            <input
                              type="text"
                              value={tempCustomNameEn}
                              onChange={(e) => setTempCustomNameEn(e.target.value)}
                              placeholder="English Description"
                              className="bg-slate-950 border border-indigo-500/30 text-white rounded px-2 py-1 text-xs w-full focus:outline-none"
                            />
                          </div>
                        ) : (
                          <>
                            <div className="font-bold text-slate-200 text-xs print:text-slate-900">
                              {lang === 'tr' ? item.nameTr : item.nameEn}
                            </div>
                            <div className="text-[9px] text-slate-500 uppercase font-black tracking-wider mt-0.5 font-mono flex items-center gap-2">
                              <span>{item.category}</span>
                            </div>
                          </>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right font-black text-xs text-indigo-400 print:text-indigo-700">
                        {item.quantity.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-center font-bold text-slate-400 text-xs font-mono uppercase">
                        {item.unit === 'pce' ? (lang === 'tr' ? 'adet' : 'pcs') : item.unit === 'sqm' ? 'm²' : 'm'}
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-bold text-slate-300 text-xs print:text-slate-700">
                        {item.dimensions || '-'}
                      </td>
                      {/* Birim Maliyet Column */}
                      <td className="px-6 py-4 text-right font-mono font-bold text-xs text-slate-300">
                        {isWeightBased ? (
                          isEditingWeight ? (
                            <div className="flex items-center justify-end gap-1">
                              <input
                                type="number"
                                step="any"
                                value={tempWeightValue}
                                onChange={(e) => setTempWeightValue(e.target.value)}
                                className="w-16 bg-slate-950 border border-indigo-500 rounded text-right px-1 py-0.5 text-[11px] font-bold text-white focus:outline-none"
                                autoFocus
                              />
                              <span className="text-[10px] text-slate-500">kg/m</span>
                              <button
                                onClick={() => handleSaveWeight(defaultCodeOfThisItem)}
                                className="text-emerald-400 hover:text-emerald-300 p-0.5"
                                title={lang === 'tr' ? 'Kaydet' : 'Save'}
                              >
                                <CheckCircle size={14} />
                              </button>
                              <button
                                onClick={() => setEditingWeightCode(null)}
                                className="text-rose-400 hover:text-rose-300 p-0.5"
                                title={lang === 'tr' ? 'İptal' : 'Cancel'}
                              >
                                <span className="text-xs font-black">✕</span>
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-col items-end">
                              <div className="flex items-center justify-end gap-1.5 group/weight">
                                <span className="text-slate-400 text-[10px] font-medium">{weightVal.toFixed(2)} kg/m</span>
                                <button
                                  onClick={() => handleStartEditingWeight(defaultCodeOfThisItem, weightVal)}
                                  className="opacity-0 group-hover/weight:opacity-100 text-indigo-400 hover:text-indigo-300 transition-opacity p-0.5"
                                  title={lang === 'tr' ? 'Metre Ağırlığı Düzenle' : 'Edit Unit Weight'}
                                >
                                  <Edit2 size={10} />
                                </button>
                              </div>
                              <div className="text-[11px] text-slate-300 font-bold mt-0.5">
                                {unitCost.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })} {currencySymbol}
                              </div>
                              <span className="text-[9px] text-slate-500 font-mono font-medium">
                                ({((lenMeters / (item.quantity || 1))).toFixed(2)} m × {weightVal.toFixed(2)} kg × {config.aluminiumKgPrice ?? 5.5} {currencySymbol})
                              </span>
                            </div>
                          )
                        ) : (
                          isEditingCost ? (
                            <div className="flex items-center justify-end gap-1">
                              <input
                                type="number"
                                step="any"
                                value={tempCostValue}
                                onChange={(e) => setTempCostValue(e.target.value)}
                                className="w-16 bg-slate-950 border border-indigo-500 rounded text-right px-1 py-0.5 text-[11px] font-bold text-white focus:outline-none"
                                autoFocus
                              />
                              <button
                                onClick={() => handleSaveCost(defaultCodeOfThisItem)}
                                className="text-emerald-400 hover:text-emerald-300 p-0.5"
                                title={lang === 'tr' ? 'Kaydet' : 'Save'}
                              >
                                <CheckCircle size={14} />
                              </button>
                              <button
                                onClick={() => setEditingCostCode(null)}
                                className="text-rose-400 hover:text-rose-300 p-0.5"
                                title={lang === 'tr' ? 'İptal' : 'Cancel'}
                              >
                                <span className="text-xs font-black">✕</span>
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-1.5 group/cost">
                              <span>{unitCost.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })} {currencySymbol}</span>
                              <button
                                onClick={() => handleStartEditingCost(defaultCodeOfThisItem, unitCost)}
                                className="opacity-0 group-hover/cost:opacity-100 text-indigo-400 hover:text-indigo-300 transition-opacity p-0.5"
                                title={lang === 'tr' ? 'Maliyet Düzenle' : 'Edit Cost'}
                              >
                                <Edit2 size={10} />
                              </button>
                            </div>
                          )
                        )}
                      </td>
                      {/* Toplam Tutar Column */}
                      <td className="px-6 py-4 text-right font-mono font-bold text-xs text-emerald-400">
                        {totalCostOfItem.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })} {currencySymbol}
                      </td>
                      <td className="px-6 py-4 text-center print:hidden">
                        {isBeingEdited ? (
                          <div className="flex gap-2 justify-center">
                            <button
                              onClick={() => handleSaveCodeOverride(defaultCodeOfThisItem)}
                              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] px-2.5 py-1 rounded"
                            >
                              {tLocal('save')}
                            </button>
                            <button
                              onClick={() => setEditingCode(null)}
                              className="bg-slate-800 hover:bg-slate-750 text-slate-400 font-bold text-[10px] px-2.5 py-1 rounded"
                            >
                              {tLocal('cancel')}
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleStartEditingCode(defaultCodeOfThisItem, config.codeOverrides[defaultCodeOfThisItem] || defaultCodeOfThisItem, item.nameTr, item.nameEn)}
                            className="bg-slate-800/80 hover:bg-slate-850 hover:text-white border border-white/5 text-slate-400 font-bold text-[10px] uppercase tracking-wider px-2.5 py-1.5 rounded-lg flex items-center gap-1 mx-auto transition-all"
                          >
                            <Edit2 size={10} />
                            <span>{tLocal('edit')}</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* System Based Details */}
          <div className="space-y-6">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-white/5 pb-2">
              📂 {tLocal('systemDetails')}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {systemBOMs.map(({ item, bom }, idx) => (
                <div key={idx} className="bg-slate-900/40 border border-slate-850 rounded-2xl p-5 space-y-4">
                  <div className="flex justify-between items-start border-b border-white/5 pb-2.5">
                    <div>
                      <h4 className="font-bold text-white text-xs">{item.name}</h4>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                        {item.width}x{item.height}x{item.depth} mm • {item.quantity} {lang === 'tr' ? 'Adet' : 'Qty'}
                      </p>
                    </div>
                    <span className="text-[9px] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded uppercase font-black font-mono">
                      {item.productType.replace('-', ' ')}
                    </span>
                  </div>

                  <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                    {bom.map((mat, mIdx) => (
                      <div key={mIdx} className="flex justify-between items-center text-[11px] py-1">
                        <div className="min-w-0 pr-3">
                          <p className="font-semibold text-slate-300 truncate">{lang === 'tr' ? mat.nameTr : mat.nameEn}</p>
                          <p className="text-[9px] text-slate-500 font-mono">{mat.code}</p>
                        </div>
                        <div className="text-right shrink-0 font-mono">
                          <span className="font-black text-indigo-400">{mat.quantity} </span>
                          <span className="text-[9px] text-slate-500 uppercase">{mat.unit}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Birim bazlı Maliyet & Fiyatlandırma Detayı */}
                  {(() => {
                    const priceResult = calculateShadingItemPrice(item, config);
                    const hasDifference = Math.abs((item.unitPrice || 0) - priceResult.finalPrice) >= 1;
                    return (
                      <div className="border-t border-white/5 pt-3.5 mt-2.5 space-y-2">
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-slate-400 font-medium">{lang === 'tr' ? 'Birim Malzeme Maliyeti:' : 'Unit Material Cost:'}</span>
                          <span className="font-mono font-bold text-slate-300">{priceResult.totalCost.toLocaleString()} {currencySymbol}</span>
                        </div>
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-slate-400 font-medium">
                            {lang === 'tr' ? `Maliyet + %${localMarkupPercentage} Kar Marjı:` : `Cost + ${localMarkupPercentage}% Markup:`}
                          </span>
                          <span className="font-mono font-bold text-indigo-400">{priceResult.finalPrice.toLocaleString()} {currencySymbol}</span>
                        </div>
                        <div className="flex justify-between items-center text-[11px] pt-1.5 border-t border-white/5 border-dashed">
                          <span className="text-slate-400 font-semibold">{lang === 'tr' ? 'Mevcut Teklif Birim Fiyatı:' : 'Current Offer Unit Price:'}</span>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-black text-slate-100">{item.unitPrice?.toLocaleString() || '0'} {currencySymbol}</span>
                            {hasDifference ? (
                              <button
                                onClick={() => {
                                  if (!project || !onUpdateProject) return;
                                  const updatedItems = (project.shadingItems || []).map(x => {
                                    if (x.id === item.id) {
                                      return { ...x, unitPrice: priceResult.finalPrice };
                                    }
                                    return x;
                                  });
                                  onUpdateProject({ ...project, shadingItems: updatedItems });
                                }}
                                className="bg-indigo-600 hover:bg-indigo-500 text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded transition-colors"
                                title={lang === 'tr' ? 'Fiyatı Güncelle' : 'Update Price'}
                              >
                                {lang === 'tr' ? 'Güncelle' : 'Update'}
                              </button>
                            ) : (
                              <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 px-1.5 py-0.5 rounded font-extrabold font-mono uppercase">
                                {lang === 'tr' ? 'Eşit' : 'Synced'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* VIEW 2: PROFILE CUTTING OPTIMIZATION */}
      {viewMode === 'opt' && (
        <div className="space-y-8">
          
          <div className="p-5 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl flex items-start gap-3">
            <Info className="text-indigo-400 mt-0.5 shrink-0" size={18} />
            <div className="text-xs leading-relaxed font-semibold">
              <p className="text-slate-200 font-bold uppercase tracking-wider">{tLocal('profilAnalysis')}</p>
              <p className="text-slate-400 mt-0.5">
                {lang === 'tr' 
                  ? `Sistemlerinizdeki alüminyum profillerin kesim ölçüleri birleştirilmiş ve sizin tarafınızdan tanımlanan ${config.barLength} mm ham profil boyları için ${config.sawKerf} mm testere kalınlığı hesaba katılarak bin-packing algoritması ile optimize edilmiştir.`
                  : `Aluminum profiling specifications are combined across all shading products and optimized into stock ${config.barLength} mm profiles including ${config.sawKerf} mm saw blade kerf allowance utilizing First-Fit Decreasing.`}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8">
            {optimizationResults.map((opt, mainIdx) => (
              <div key={mainIdx} className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl avoid-break print:bg-white print:border-slate-200">
                
                {/* Header Profile Summary */}
                <div className="bg-slate-950 p-6 border-b border-slate-800 flex flex-wrap justify-between items-center gap-4 print:bg-slate-50 print:border-slate-200">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-500/10 rounded-2xl text-indigo-400">
                      <Tag size={20} />
                    </div>
                    <div>
                      <h3 className="font-black text-sm text-white print:text-black uppercase tracking-wider">
                        {lang === 'tr' ? opt.nameTr : opt.nameEn}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] bg-slate-900 px-2 py-0.5 rounded font-mono text-emerald-400 border border-white/5">{opt.profileCode}</span>
                        <span className="text-[10px] text-slate-500 font-bold">• {tLocal('profilAnalysis')}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-6 sm:gap-8 text-center">
                    <div>
                      <div className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-1">{tLocal('barsUsed')}</div>
                      <div className="text-xl font-black text-indigo-400 flex items-baseline justify-center gap-1 print:text-indigo-700">
                        {opt.totalBars} <span className="text-[10px] font-bold text-slate-500">{lang === 'tr' ? 'Adet' : 'Bars'}</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-1">{tLocal('efficiency')}</div>
                      <div className="text-xl font-black text-emerald-400">
                        {opt.efficiency.toFixed(1)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-1">{tLocal('waste')}</div>
                      <div className="text-xl font-black text-rose-400">
                        {opt.waste.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bars Visualization / List */}
                <div className="p-6 space-y-5">
                  <div className="text-[10px] text-slate-400 mb-2 flex justify-between font-bold border-b border-white/5 pb-3 font-mono">
                    <span className="uppercase tracking-widest flex items-center gap-2">
                      <LayoutGrid size={12} className="text-indigo-400" />
                      {tLocal('optTitle')} ({opt.totalCuts} {lang === 'tr' ? 'Kesim' : 'Cuts'})
                    </span>
                    <span className="opacity-60 italic font-medium">Bar: {(config.barLength / 1000).toFixed(1)}m | {config.sawKerf}mm Saw Kerf</span>
                  </div>
                  
                  {opt.bars.map((bar, idx) => (
                    <div key={idx} className="flex items-center gap-4 text-xs group">
                      <div className="w-16 shrink-0 font-mono">
                        <div className="font-black text-slate-300 uppercase text-[11px]">
                          {lang === 'tr' ? 'Boy' : 'Bar'} #{idx + 1}
                        </div>
                      </div>
                      
                      {/* Visual Bar Representation */}
                      <div className="flex-1 h-9 bg-slate-950 rounded-xl relative overflow-hidden flex border border-slate-800 shadow-inner">
                        {bar.cuts.map((cut, cIdx) => {
                          const percent = (cut / config.barLength) * 100;
                          return (
                            <div 
                              key={cIdx}
                              style={{ width: `${percent}%` }}
                              className="h-full bg-indigo-600 border-r border-slate-950 hover:bg-indigo-500 transition-all flex items-center justify-center text-[10px] text-white font-black overflow-hidden whitespace-nowrap"
                              title={`${cut}mm`}
                            >
                              {cut}
                            </div>
                          );
                        })}
                        {/* Remaining Waste */}
                        <div className="flex-1 bg-stripes-red opacity-20"></div>
                      </div>
                      
                      <div className="w-28 text-right font-mono text-xs text-slate-400 shrink-0 font-bold group-hover:text-indigo-400 transition-colors">
                        {bar.remaining > 0 ? `${lang === 'tr' ? 'Artık' : 'Left'}: ${bar.remaining}mm` : '0 mm'}
                      </div>
                    </div>
                  ))}
                </div>

              </div>
            ))}
          </div>

        </div>
      )}

      {/* VIEW 3: SETTINGS EDITOR */}
      {viewMode === 'settings' && (
        <div className="space-y-8 animate-in slide-in-from-bottom duration-300">
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left Col: Global Params Form */}
            <form onSubmit={handleSaveGlobalParams} className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-xl h-fit">
              <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2 border-b border-white/5 pb-3">
                <Wrench size={14} className="text-indigo-400" />
                {tLocal('globalSettingsLabel')}
              </h3>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold font-mono">
                    {tLocal('motorBrandLabel')}
                  </label>
                  <select
                    value={isMotorCustom ? "custom" : localMotor}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "custom") {
                        setLocalMotor("");
                      } else {
                        setLocalMotor(val);
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2.5 font-bold focus:outline-none focus:border-indigo-500 transition-colors"
                  >
                    <option value="Somfy">Somfy (Fransa)</option>
                    <option value="Becker">Becker (Almanya)</option>
                    <option value="Cherubini">Cherubini (İtalya)</option>
                    <option value="Albert Genau">Albert Genau</option>
                    <option value="Mosel">Mosel (Ekonomik)</option>
                    <option value="Nice">Nice (İtalya)</option>
                    <option value="custom">✨ {lang === 'tr' ? 'Diğer (Özel Marka Girin)' : 'Other (Type Custom Brand)'}</option>
                  </select>

                  {isMotorCustom && (
                    <div className="mt-2 animate-in slide-in-from-top-1 duration-200">
                      <input
                        type="text"
                        value={localMotor}
                        onChange={(e) => setLocalMotor(e.target.value)}
                        placeholder={lang === 'tr' ? 'Motor markasını yazınız...' : 'Type motor brand...'}
                        className="w-full bg-slate-950 border border-indigo-500/30 text-white text-xs rounded-xl px-3 py-2.5 font-bold focus:outline-none focus:border-indigo-500"
                        required
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold font-mono">
                    {tLocal('fabricBrandLabel')}
                  </label>
                  <select
                    value={isFabricCustom ? "custom" : localFabric}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "custom") {
                        setLocalFabric("");
                      } else {
                        setLocalFabric(val);
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2.5 font-bold focus:outline-none focus:border-indigo-500 transition-colors"
                  >
                    <option value="Serge Ferrari Soltis">Serge Ferrari Soltis</option>
                    <option value="Sauleda Acrylic">Sauleda (İspanya)</option>
                    <option value="Dickson Constant">Dickson (Fransa)</option>
                    <option value="Recasens">Recasens (İspanya)</option>
                    <option value="Mehler Texnologies">Mehler Texnologies (Almanya)</option>
                    <option value="Sattler">Sattler (Avusturya)</option>
                    <option value="custom">✨ {lang === 'tr' ? 'Diğer (Özel Kumaş/Tente Girin)' : 'Other (Type Custom Fabric)'}</option>
                  </select>

                  {isFabricCustom && (
                    <div className="mt-2 animate-in slide-in-from-top-1 duration-200">
                      <input
                        type="text"
                        value={localFabric}
                        onChange={(e) => setLocalFabric(e.target.value)}
                        placeholder={lang === 'tr' ? 'Kumaş/Tente markasını yazınız...' : 'Type fabric brand...'}
                        className="w-full bg-slate-950 border border-indigo-500/30 text-white text-xs rounded-xl px-3 py-2.5 font-bold focus:outline-none focus:border-indigo-500"
                        required
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold font-mono">
                    {tLocal('stockBarLengthLabel')}
                  </label>
                  <input
                    type="number"
                    value={localBarLength}
                    onChange={(e) => setLocalBarLength(Number(e.target.value))}
                    min={1000}
                    max={12000}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2.5 font-mono font-bold focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold font-mono">
                    {tLocal('sawBladeKerfLabel')}
                  </label>
                  <input
                    type="number"
                    value={localSawKerf}
                    onChange={(e) => setLocalSawKerf(Number(e.target.value))}
                    min={0}
                    max={20}
                    step={0.5}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2.5 font-mono font-bold focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Costing & Pricing Settings */}
                <div className="border-t border-white/5 pt-4 mt-4 space-y-4">
                  <h4 className="text-[11px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
                    <TrendingUp size={12} />
                    {lang === 'tr' ? 'Teklif Fiyatlandırma Ayarları' : 'Offer Pricing Settings'}
                  </h4>

                  <div className="flex items-center justify-between p-3 bg-slate-950 rounded-2xl border border-white/5">
                    <div className="space-y-0.5">
                      <span className="text-[11px] font-bold text-slate-200 block">
                        {lang === 'tr' ? 'BOM Fiyatlandırmasını Etkinleştir' : 'Enable BOM Pricing'}
                      </span>
                      <span className="text-[9px] text-slate-500 block">
                        {lang === 'tr' ? 'Teklif birim fiyatlarını otomatik hesapla' : 'Auto calculate offer unit prices'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const val = !localEnableBomPricing;
                        setLocalEnableBomPricing(val);
                        const updated = {
                          ...config,
                          enableBomPricing: val
                        };
                        saveConfig(updated);
                      }}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${localEnableBomPricing ? 'bg-indigo-600' : 'bg-slate-800'}`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${localEnableBomPricing ? 'translate-x-5' : 'translate-x-0'}`}
                      />
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold font-mono flex justify-between">
                      <span>{lang === 'tr' ? 'Varsayılan Kar Marjı (%)' : 'Default Markup (%)'}</span>
                      <span className="text-indigo-400 font-black">%{localMarkupPercentage}</span>
                    </label>
                    <input
                      type="number"
                      value={localMarkupPercentage}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setLocalMarkupPercentage(val);
                        const updated = {
                          ...config,
                          markupPercentage: val
                        };
                        saveConfig(updated);
                      }}
                      min={0}
                      max={500}
                      className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2.5 font-mono font-bold focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-black uppercase tracking-wider py-3 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-indigo-600/10"
                >
                  <Save size={13} />
                  <span>{tLocal('save')}</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetSettings}
                  className="bg-slate-800 hover:bg-slate-750 text-rose-400 text-[11px] font-black uppercase tracking-wider px-3 rounded-xl flex items-center justify-center transition-all"
                  title={tLocal('resetDefaults')}
                >
                  <RefreshCw size={13} />
                </button>
              </div>
            </form>

            {/* Right Col: Custom Stock Codes Mapping Table */}
            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-xl">
              <div>
                <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2 border-b border-white/5 pb-3">
                  <Tag size={14} className="text-indigo-400" />
                  {tLocal('customCodeMappings')}
                </h3>
                <p className="text-[10px] text-slate-400 font-medium leading-relaxed mt-2.5">
                  {tLocal('customCodeDesc')}
                </p>
              </div>

              <div className="overflow-x-auto max-h-[450px] border border-slate-800 rounded-2xl bg-slate-950">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-slate-950 border-b border-slate-850 text-[10px] text-slate-400 uppercase">
                    <tr>
                      <th className="px-4 py-3 font-bold font-mono">{tLocal('originalCode')}</th>
                      <th className="px-4 py-3 font-bold">{tLocal('customCode')}</th>
                      <th className="px-4 py-3 font-bold">{tLocal('itemName')}</th>
                      <th className="px-4 py-3 text-center font-bold">{tLocal('actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {allDefaultMaterialsInProject.map((defItem, dIdx) => {
                      const isEditing = editingCode === defItem.code;
                      const hasCustomSku = !!config.codeOverrides[defItem.code];
                      const activeSku = config.codeOverrides[defItem.code] || defItem.code;
                      const activeNameTr = config.nameOverridesTr[defItem.code] || defItem.nameTr;

                      return (
                        <tr key={dIdx} className="hover:bg-slate-900/60 transition-colors">
                          <td className="px-4 py-3 font-mono font-bold text-slate-500">
                            {defItem.code}
                          </td>
                          <td className="px-4 py-3 font-mono">
                            {isEditing ? (
                              <input
                                type="text"
                                value={tempCustomCode}
                                onChange={(e) => setTempCustomCode(e.target.value)}
                                className="bg-slate-950 border border-indigo-500/30 text-white rounded px-2.5 py-1 text-xs font-mono w-full focus:outline-none"
                              />
                            ) : (
                              <span className={hasCustomSku ? "text-emerald-400 font-bold" : "text-slate-400 font-medium"}>
                                {activeSku}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-semibold">
                            {isEditing ? (
                              <div className="space-y-1">
                                <input
                                  type="text"
                                  value={tempCustomNameTr}
                                  onChange={(e) => setTempCustomNameTr(e.target.value)}
                                  className="bg-slate-950 border border-indigo-500/30 text-white rounded px-2 py-0.5 text-xs w-full focus:outline-none"
                                  placeholder="TR"
                                />
                                <input
                                  type="text"
                                  value={tempCustomNameEn}
                                  onChange={(e) => setTempCustomNameEn(e.target.value)}
                                  className="bg-slate-950 border border-indigo-500/30 text-white rounded px-2 py-0.5 text-xs w-full focus:outline-none"
                                  placeholder="EN"
                                />
                              </div>
                            ) : (
                              <div className="truncate max-w-[200px]" title={lang === 'tr' ? activeNameTr : (config.nameOverridesEn[defItem.code] || defItem.nameEn)}>
                                {lang === 'tr' ? activeNameTr : (config.nameOverridesEn[defItem.code] || defItem.nameEn)}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {isEditing ? (
                              <div className="flex gap-1 justify-center">
                                <button
                                  onClick={() => handleSaveCodeOverride(defItem.code)}
                                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[9px] px-2 py-1 rounded"
                                >
                                  {tLocal('save')}
                                </button>
                                <button
                                  onClick={() => setEditingCode(null)}
                                  className="bg-slate-800 hover:bg-slate-750 text-slate-400 font-bold text-[9px] px-2 py-1 rounded"
                                >
                                  {tLocal('cancel')}
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleStartEditingCode(defItem.code, activeSku, defItem.nameTr, defItem.nameEn)}
                                className="text-slate-400 hover:text-white font-bold text-[10px] underline hover:no-underline px-1"
                              >
                                {tLocal('edit')}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

            </div>

          </div>

        </div>
      )}

      {/* Styled Stripes styling */}
      <style>{`
        .bg-stripes-red {
          background-image: linear-gradient(45deg, #ef4444 25%, transparent 25%, transparent 50%, #ef4444 50%, #ef4444 75%, transparent 75%, transparent);
          background-size: 8px 8px;
        }
      `}</style>

    </div>
  );
};
