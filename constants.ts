
import { ProfileSystem, GlassType, Project, Accessory } from './types';

export const PROFILE_SYSTEMS: ProfileSystem[] = [
  // --- KURTOĞLU ALÜMİNYUM ---
  { 
    id: 'kurt-51ls', 
    name: 'Kurtoğlu 51LS (Thermal Sliding)', 
    type: 'sliding',
    uValue: 2.2, frameWidth: 51, frameDepth: 120, sashDepth: 45, thermalBreakWidth: 18, wallThickness: 1.8,
    pricePerMeter: 120, profileLength: 6.0,
    correctionConfig: { sashOverlap: 30, glassClearance: 5, mullionCorrection: 0, frameCornerWelding: 0 },
    profileCodes: { frame: '51LS-101', sash: '51LS-201', mullion: '51LS-301', glazingBead: '51LS-401' },
    profileWeights: { frame: 2.350, sash: 1.750, mullion: 1.950, glazingBead: 0.280 }
  },
  { 
    id: 'kurt-70t-th', 
    name: 'Kurtoğlu 70T-TH (Thermal Hinged)', 
    type: 'hinged',
    uValue: 1.6, frameWidth: 70, frameDepth: 70, sashDepth: 80, thermalBreakWidth: 24, wallThickness: 2.0,
    pricePerMeter: 105, profileLength: 6.0,
    correctionConfig: { sashOverlap: 8, glassClearance: 5, mullionCorrection: 0, frameCornerWelding: 0 },
    profileCodes: { frame: '70T-101', sash: '70T-201', mullion: '70T-301', glazingBead: '70T-401' },
    profileWeights: { frame: 1.550, sash: 1.850, mullion: 1.650, glazingBead: 0.290 }
  }
];

export const MOCK_ACCESSORIES: Accessory[] = [
  { id: 'h1', name: 'Standard Handle (White)', type: 'handle', unit: 'pce', price: 12.0, compatibility: 'hinged' },
  { id: 'h2', name: 'Security Handle (Keyed)', type: 'handle', unit: 'pce', price: 25.0, compatibility: 'hinged' },
  { id: 'sh1', name: 'Sliding Sash Handle (Flush)', type: 'handle', unit: 'pce', price: 18.0, compatibility: 'sliding' },
  { id: 'sr1', name: 'Sliding Roller (Double-Wheeled)', type: 'other', unit: 'pce', price: 8.5, compatibility: 'sliding' },
  { id: 'g1', name: 'EPDM Outer Gasket', type: 'gasket', unit: 'meter', price: 1.5, compatibility: 'both' },
  { id: 'g2', name: 'EPDM Inner Gasket', type: 'gasket', unit: 'meter', price: 1.8, compatibility: 'both' },
  { id: 'hi1', name: 'Heavy Duty Hinge (120kg)', type: 'hinge', unit: 'pce', price: 14.0, maxWeightKg: 120, compatibility: 'hinged' },
  { id: 'l1', name: 'Multi-Point Lock (3-Way)', type: 'lock', unit: 'pce', price: 45.0, compatibility: 'hinged' },
  { id: 'c1', name: 'Aluminum Corner Cleat', type: 'corner', unit: 'pce', price: 3.5, compatibility: 'both' },
];

export const GLASS_TYPES: GlassType[] = [
  // --- SINGLE GLAZING (TEK CAMLAR) ---
  { id: 'single4', name: '4mm Float Cam (Single)', uValue: 5.8, thickness: 4, pricePerSqm: 30 },
  { id: 'single6', name: '6mm Float Cam (Single)', uValue: 5.7, thickness: 6, pricePerSqm: 40 },
  { id: 'single8', name: '8mm Temperli Cam (Single)', uValue: 5.6, thickness: 8, pricePerSqm: 50 },
  { id: 'single10', name: '10mm Temperli Cam (Single)', uValue: 5.5, thickness: 10, pricePerSqm: 65 },
  { id: 'lam44', name: '4+4 Lamine Emniyet Camı (8.8mm)', uValue: 5.6, thickness: 8, pricePerSqm: 55 },
  { id: 'lam55', name: '5+5 Lamine Emniyet Camı (10.10mm)', uValue: 5.5, thickness: 10, pricePerSqm: 65 },
  { id: 'lam66', name: '6+6 Lamine Emniyet Camı (12.12mm)', uValue: 5.4, thickness: 12, pricePerSqm: 75 },

  // --- DOUBLE GLAZING (ÇİFT CAMLAR) ---
  { id: 'double20', name: '4+12+4 Isıcam Sinerji (20mm)', uValue: 1.3, thickness: 20, pricePerSqm: 60 },
  { id: 'double24', name: '4+16+4 Isıcam Konfor (24mm)', uValue: 1.1, thickness: 24, pricePerSqm: 65 },
  { id: 'double24_6', name: '6+12+6 Isıcam Sinerji (24mm)', uValue: 1.2, thickness: 24, pricePerSqm: 75 },
  { id: 'double26_lam', name: '6+16+4 Lamine Çift Cam (26mm)', uValue: 1.2, thickness: 26, pricePerSqm: 85 },
  { id: 'double28', name: '4+20+4 Isıcam Konfor (28mm)', uValue: 1.1, thickness: 28, pricePerSqm: 70 },
  { id: 'double28_lam', name: '6+16+6 Lamine Çift Cam (28mm)', uValue: 1.1, thickness: 28, pricePerSqm: 95 },
  { id: 'double30', name: '4+22+4 Ekstra Geniş (30mm)', uValue: 1.1, thickness: 30, pricePerSqm: 75 },
  { id: 'double32', name: '4+24+4 Ekstra Geniş (32mm)', uValue: 1.0, thickness: 32, pricePerSqm: 80 },

  // --- TRIPLE GLAZING (ÜÇLÜ CAMLAR) ---
  { id: 'triple36', name: '4+12+4+12+4 Isıcam Üçlü K (36mm)', uValue: 0.7, thickness: 36, pricePerSqm: 110 },
  { id: 'triple40', name: '4+14+4+14+4 Isıcam Üçlü K (40mm)', uValue: 0.65, thickness: 40, pricePerSqm: 120 },
  { id: 'triple44', name: '4+16+4+16+4 Isıcam Üçlü K (44mm)', uValue: 0.6, thickness: 44, pricePerSqm: 130 },
  { id: 'triple44_heavy', name: '6+14+4+14+6 Akustik Üçlü (44mm)', uValue: 0.6, thickness: 44, pricePerSqm: 150 },
  { id: 'triple48', name: '4+18+4+18+4 Isıcam Üçlü K (48mm)', uValue: 0.55, thickness: 48, pricePerSqm: 140 },
];

export const MOCK_PROJECTS: Project[] = [
  {
    id: 'p1',
    name: 'Standard Unit Test',
    client: 'Sample Construction Ltd.',
    date: '2024-03-20',
    status: 'Draft',
    units: []
  }
];

export const INITIAL_ROOT_NODE = {
  id: 'root',
  type: 'glass' as const,
  openingType: 'fixed' as const,
};

export const COLOR_GROUPS = [
  {
    id: 'pres',
    nameTr: 'Pres (Ham Alüminyum)',
    nameEn: 'Mill Finish (Raw)',
    defaultPricePerKg: 160,
    descriptionTr: 'Yüzey işlemsiz ham pres döküm alüminyum profiller',
    descriptionEn: 'Untreated raw extruded aluminum profiles'
  },
  {
    id: 'group1',
    nameTr: '1. Grup Renkler (Standard Ral)',
    nameEn: '1st Group Colors (Standard Ral)',
    defaultPricePerKg: 185,
    descriptionTr: 'RAL 9016 P/M, 9010 P/M, 8014 P/M, 7016 P/M, 9005 P/M',
    descriptionEn: 'RAL 9016 G/M, 9010 G/M, 8014 G/M, 7016 G/M, 9005 G/M'
  },
  {
    id: 'group2',
    nameTr: '2. Grup Renkler (Özel Ral / Texture)',
    nameEn: '2nd Group Colors (Special Ral / Texture)',
    defaultPricePerKg: 205,
    descriptionTr: 'RAL 9001, 7031, 5002, 7040, 9003, 7039, 1013, 1015, 5005, 7035, 7042, 8016, 3020, 9006, 9002, 7016 Texture',
    descriptionEn: 'RAL 9001, 7031, 5002, 7040, 9003, 7039, 1013, 1015, 5005, 7035, 7042, 8016, 3020, 9006, 9002, 7016 Texture'
  },
  {
    id: 'mat_eloxal',
    nameTr: 'Mat Eloksallı',
    nameEn: 'Matte Anodized',
    defaultPricePerKg: 195,
    descriptionTr: 'Naturel, Bronz, Kahve eloksallı mat kartela renkleri',
    descriptionEn: 'Natural, Bronze, Brown anodized matte catalog colors'
  },
  {
    id: 'parlak_eloxal',
    nameTr: 'Parlak Eloksallı',
    nameEn: 'Polished Anodized',
    defaultPricePerKg: 215,
    descriptionTr: 'Naturel, Bronz, Kahve eloksallı parlak kartela renkleri',
    descriptionEn: 'Natural, Bronze, Brown anodized glossy catalog colors'
  },
  {
    id: 'mat_siyah_eloxal',
    nameTr: 'Mat Siyah Eloksallı',
    nameEn: 'Matte Black Anodized',
    defaultPricePerKg: 210,
    descriptionTr: 'Mat eloksallı siyah renk kaplama',
    descriptionEn: 'Matte anodized black color finish'
  },
  {
    id: 'parlak_siyah_eloxal',
    nameTr: 'Parlak Siyah Eloksallı',
    nameEn: 'Polished Black Anodized',
    defaultPricePerKg: 225,
    descriptionTr: 'Parlak eloksallı parlak siyah kimyasal kaplama',
    descriptionEn: 'Glossy anodized polished black glossy finish'
  },
  {
    id: 'wood_transfer',
    nameTr: 'Ahşap Transfer Kaplamalı',
    nameEn: 'Wood Transfer Coated',
    defaultPricePerKg: 250,
    descriptionTr: 'Ahşap desen kaplamalı dekoratif transfer profiller',
    descriptionEn: 'Decorative wood-pattern sublimation coated profiles'
  }
];
