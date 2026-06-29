
import { ProfileSystem, GlassType, Project, Accessory, CatalogProfileItem } from './types';

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
  { id: 'sig-h1', name: 'Siegenia Globe Alüminyum Pencere Kolu (Sürme & Kasa)', type: 'handle', unit: 'pce', price: 18.5, compatibility: 'both' },
  { id: 'sig-h2', name: 'Siegenia Titan AF Kilitlenebilir Kol (Güvenlikli, Tilt&Turn)', type: 'handle', unit: 'pce', price: 28.0, compatibility: 'hinged' },
  { id: 'sig-h3', name: 'Siegenia HS Portal Kaldırmalı-Sürme Kolu (Lift-Slide)', type: 'handle', unit: 'pce', price: 95.0, compatibility: 'sliding' },
  { id: 'sig-sh1', name: 'Siegenia Gömme Sürme Tutamak (Flush)', type: 'handle', unit: 'pce', price: 16.0, compatibility: 'sliding' },
  { id: 'sig-g1', name: 'EPDM Dış Cam Fitili (Orijinal Siegenia/Kurtoğlu)', type: 'gasket', unit: 'meter', price: 1.6, compatibility: 'both' },
  { id: 'sig-g2', name: 'EPDM İç Cam Fitili (Orijinal Siegenia/Kurtoğlu)', type: 'gasket', unit: 'meter', price: 1.9, compatibility: 'both' },
  { id: 'sig-hi2', name: 'Siegenia Favorit Standart Kanat Menteşesi (80kg)', type: 'hinge', unit: 'pce', price: 9.5, maxWeightKg: 80, compatibility: 'hinged' },
  { id: 'sig-hi1', name: 'Siegenia Titan AF Ağır İş Menteşesi (130kg)', type: 'hinge', unit: 'pce', price: 16.5, maxWeightKg: 130, compatibility: 'hinged' },
  { id: 'sig-hi3', name: 'Siegenia Titan Axxent 24+ Gizli Kanat Menteşesi (150kg)', type: 'hinge', unit: 'pce', price: 42.0, maxWeightKg: 150, compatibility: 'hinged' },
  { id: 'sig-sr1', name: 'Siegenia Eco Slide Sürme Makaraları (100kg)', type: 'other', unit: 'pce', price: 14.5, maxWeightKg: 100, compatibility: 'sliding' },
  { id: 'sig-sr2', name: 'Siegenia HS Portal Tandem Sürme Tekerleği (150kg)', type: 'other', unit: 'pce', price: 38.0, maxWeightKg: 150, compatibility: 'sliding' },
  { id: 'sig-sr3', name: 'Siegenia HS Portal Ağır Ray Makara Seti (300kg)', type: 'other', unit: 'pce', price: 74.0, maxWeightKg: 300, compatibility: 'sliding' },
  { id: 'sig-sr4', name: 'Siegenia HS Portal Tandem Ağır Sürme Arabası (400kg)', type: 'other', unit: 'pce', price: 125.0, maxWeightKg: 400, compatibility: 'sliding' },
  { id: 'sig-l1', name: 'Siegenia Titan AF Çift Açılım Kilit Takımı (3 Noktalı)', type: 'lock', unit: 'pce', price: 54.0, compatibility: 'hinged' },
  { id: 'sig-c1', name: 'Kurtoğlu Köşe Birleştirme Takozu (Orijinal Alüminyum)', type: 'corner', unit: 'pce', price: 3.5, compatibility: 'both' }
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
    units: [],
    projectNumber: 'ALU-2024-1001'
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

export const KURTOGLU_70T_CATALOG: CatalogProfileItem[] = [
  // Frame Profiles (Kasa)
  { code: '70T-102-18', weight: 1.627, type: 'frame', nameTr: 'Kasa Profili (Eko)', nameEn: 'Frame Profile (Eco)' },
  { code: '70TH-102-18', weight: 1.637, type: 'frame', nameTr: 'Kasa Profili (Yalıtımlı)', nameEn: 'Thermal Frame Profile' },
  { code: '70T-103-18', weight: 1.821, type: 'frame', nameTr: 'Hemyüz Kasa Profili', nameEn: 'Flush Frame Profile' },
  { code: '70TH-103-18', weight: 1.837, type: 'frame', nameTr: 'Hemyüz Kasa Profili (Yalıtımlı)', nameEn: 'Thermal Flush Frame Profile' },
  { code: '70T-112-18', weight: 1.765, type: 'frame', nameTr: 'Dışa Açılır Kasa Profili', nameEn: 'Outward Opening Frame Profile' },
  { code: '70TH-112-18', weight: 1.775, type: 'frame', nameTr: 'Dışa Açılır Kasa (Yalıtımlı)', nameEn: 'Thermal Outward Opening Frame' },
  { code: '70T-122-18', weight: 1.852, type: 'frame', nameTr: 'Sıva Üstü Kasa Profili', nameEn: 'Wall Joint Frame Profile' },
  { code: '70TH-122-18', weight: 1.862, type: 'frame', nameTr: 'Sıva Üstü Kasa (Yalıtımlı)', nameEn: 'Thermal Wall Joint Frame' },
  { code: '70T-141-18', weight: 2.009, type: 'frame', nameTr: 'Dar Kasa Profili', nameEn: 'Narrow Frame Profile' },
  { code: '70TH-141-18', weight: 2.012, type: 'frame', nameTr: 'Dar Kasa Profili (Yalıtımlı)', nameEn: 'Thermal Narrow Frame Profile' },
  { code: '70T-109-18', weight: 3.336, type: 'frame', nameTr: 'Geniş Kasa Profili', nameEn: 'Wide Frame Profile' },
  { code: '70TH-109-18', weight: 3.396, type: 'frame', nameTr: 'Geniş Kasa Profili (Yalıtımlı)', nameEn: 'Thermal Wide Frame Profile' },

  // Sash Profiles (Kanat)
  { code: '70T-201-18', weight: 1.616, type: 'sash', nameTr: 'Pencere Kanat Profili (Eko)', nameEn: 'Window Sash Profile (Eco)' },
  { code: '70TH-201-18', weight: 1.621, type: 'sash', nameTr: 'Pencere Kanat (Yalıtımlı)', nameEn: 'Thermal Window Sash' },
  { code: '70T-202-18', weight: 1.857, type: 'sash', nameTr: 'Dışa Açılır Kanat Profili', nameEn: 'Outward Opening Sash Profile' },
  { code: '70TH-202-18', weight: 1.870, type: 'sash', nameTr: 'Dışa Açılır Kanat (Yalıtımlı)', nameEn: 'Thermal Outward Opening Sash' },
  { code: '70T-211-18', weight: 1.601, type: 'sash', nameTr: 'İçeri Açılır Kanat Profili', nameEn: 'Inward Opening Sash Profile' },
  { code: '70TH-211-18', weight: 1.606, type: 'sash', nameTr: 'İçeri Açılır Kanat (Yalıtımlı)', nameEn: 'Thermal Inward Opening Sash' },
  { code: '70T-212-18', weight: 1.842, type: 'sash', nameTr: 'Gizli Kanat Profili', nameEn: 'Hidden Sash Profile' },
  { code: '70TH-212-18', weight: 1.855, type: 'sash', nameTr: 'Gizli Kanat (Yalıtımlı)', nameEn: 'Thermal Hidden Sash' },
  { code: '70T-216-18', weight: 2.270, type: 'sash', nameTr: 'Kapı Kanat Profili', nameEn: 'Door Sash Profile' },
  { code: '70TH-216-18', weight: 2.297, type: 'sash', nameTr: 'Kapı Kanat (Yalıtımlı)', nameEn: 'Thermal Door Sash' },
  { code: '70T-217-18', weight: 2.217, type: 'sash', nameTr: 'Dışa Açılır Kapı Kanat', nameEn: 'Outward Opening Door Sash' },
  { code: '70TH-217-18', weight: 2.244, type: 'sash', nameTr: 'Dışa Açılır Kapı (Yalıtımlı)', nameEn: 'Thermal Outward Opening Door' },

  // Mullion Profiles (Orta Kayıt)
  { code: '70T-301-18', weight: 1.492, type: 'mullion', nameTr: 'Orta Kayıt Profili (Dar)', nameEn: 'Narrow Mullion/Transom' },
  { code: '70TH-301-18', weight: 1.495, type: 'mullion', nameTr: 'Orta Kayıt Dar (Yalıtımlı)', nameEn: 'Thermal Narrow Mullion' },
  { code: '70T-302-18', weight: 1.746, type: 'mullion', nameTr: 'Geniş Orta Kayıt Profili', nameEn: 'Wide Mullion Profile' },
  { code: '70TH-302-18', weight: 1.756, type: 'mullion', nameTr: 'Geniş Orta Kayıt (Yalıtımlı)', nameEn: 'Thermal Wide Mullion' },
  { code: '70T-312-18', weight: 1.880, type: 'mullion', nameTr: 'Dar Orta Kayıt Profili', nameEn: 'Narrow Mullion Profile' },
  { code: '70TH-312-18', weight: 1.890, type: 'mullion', nameTr: 'Dar Orta Kayıt (Yalıtımlı)', nameEn: 'Thermal Narrow Mullion' },
  { code: '70T-303-18', weight: 1.940, type: 'mullion', nameTr: 'Dekoratif Orta Kayıt Profili', nameEn: 'Decorative Mullion Profile' },
  { code: '70TH-303-18', weight: 1.956, type: 'mullion', nameTr: 'Dekoratif Orta Kayıt (Yalıtımlı)', nameEn: 'Thermal Dec. Mullion' },
  { code: '70T-322-18', weight: 2.628, type: 'mullion', nameTr: 'Geniş Eta Orta Kayıt Profili', nameEn: 'Wide Eta Mullion Profile' },
  { code: '70TH-322-18', weight: 2.638, type: 'mullion', nameTr: 'Geniş Eta Orta Kayıt (Yalıtımlı)', nameEn: 'Thermal Wide Eta Mullion' },
  { code: '70T-362-18', weight: 1.838, type: 'mullion', nameTr: 'Ağır Tip Orta Kayıt Profili', nameEn: 'Heavy Mullion Profile' },
  { code: '70TH-362-18', weight: 1.848, type: 'mullion', nameTr: 'Ağır Tip Orta Kayıt (Yalıtımlı)', nameEn: 'Thermal Heavy Mullion' }
];

export const KURTOGLU_51LS_CATALOG: CatalogProfileItem[] = [
  // Frame Profiles (Kasa) - 1 ile başlayanlar
  { code: '51LS-101-00', weight: 1.805, type: 'frame', nameTr: 'Kasa Profili', nameEn: 'Frame Profile' },
  { code: '51LSM-101-00', weight: 1.904, type: 'frame', nameTr: 'Kasa Profili (Monorail)', nameEn: 'Monorail Frame Profile' },
  { code: '51LS-102-00', weight: 1.820, type: 'frame', nameTr: 'Çift Raylı Kasa Profili', nameEn: 'Double Track Frame' },
  { code: '51LS-112-00', weight: 2.023, type: 'frame', nameTr: 'Yüksek Çift Raylı Kasa', nameEn: 'Double Track Frame (High)' },
  { code: '51LS-151-00', weight: 2.322, type: 'frame', nameTr: 'Kasa Profili (Geniş)', nameEn: 'Wide Frame Profile' },
  { code: '51LS-152-00', weight: 2.338, type: 'frame', nameTr: 'Yarım Eko Çift Ray Kasa', nameEn: 'Double Track Eco Frame' },
  { code: '51LS-153-00', weight: 3.295, type: 'frame', nameTr: 'Yarım Eko Üç Ray Kasa', nameEn: 'Triple Track Eco Frame' },
  { code: '51LS-162-00', weight: 2.541, type: 'frame', nameTr: 'Çift Raylı Kasa (Sineklikli)', nameEn: 'Double Track Frame with Flyscreen' },
  { code: '51LS-163-00', weight: 3.498, type: 'frame', nameTr: 'Yarım Eko Üç Ray Kasa (Yüksek)', nameEn: 'Triple Track Eco Frame (High)' },
  { code: '51LS-103-00', weight: 2.777, type: 'frame', nameTr: 'Üç Raylı Kasa Profili', nameEn: 'Triple Track Frame' },
  { code: '51LS-113-00', weight: 2.980, type: 'frame', nameTr: 'Üç Raylı Kasa Profili (Yüksek)', nameEn: 'Triple Track Frame (High)' },
  { code: '51LS-182-00', weight: 1.962, type: 'frame', nameTr: 'Eko Çift Raylı Kasa', nameEn: 'Double Track Eco Frame' },
  { code: '51LS-192-00', weight: 2.165, type: 'frame', nameTr: 'Eko Çift Raylı Kasa (Sineklikli)', nameEn: 'Double Track Eco Frame with Flyscreen' },
  { code: '51LS-183-00', weight: 2.919, type: 'frame', nameTr: 'Eko Üç Raylı Kasa', nameEn: 'Triple Track Eco Frame' },
  { code: '51LS-193-00', weight: 3.122, type: 'frame', nameTr: 'Eko Üç Raylı Kasa (Yüksek)', nameEn: 'Triple Track Eco Frame (High)' },
  { code: '51LS-172-00', weight: 2.280, type: 'frame', nameTr: 'Özel Çift Raylı Kasa', nameEn: 'Special Double Track Frame' },
  { code: '51LS-173-00', weight: 3.152, type: 'frame', nameTr: 'Özel Üç Raylı Kasa', nameEn: 'Special Triple Track Frame' },
  { code: '51LSM-190-00', weight: 0.975, type: 'frame', nameTr: 'Kasa Adaptör Profili', nameEn: 'Frame Adapter Profile' },
  { code: '58T-153-15', weight: 1.905, type: 'frame', nameTr: '58T Serisi Kasa Profili', nameEn: '58T Series Frame Profile' },
  { code: '58T-151-15', weight: 2.148, type: 'frame', nameTr: '58T Serisi Kasa (Alternatif)', nameEn: '58T Series Frame (Alternative)' },

  // Sash Profiles (Kanat) - 2 ile başlayanlar
  { code: '51LS-201-00', weight: 1.521, type: 'sash', nameTr: 'Sürme Kanat Profili (Eko)', nameEn: 'Sliding Sash Profile (Eco)' },
  { code: '51LS-211-00', weight: 1.103, type: 'sash', nameTr: 'Dar Sürme Kanat Profili', nameEn: 'Narrow Sliding Sash' },
  { code: '51LS-212-00', weight: 2.039, type: 'sash', nameTr: 'Geniş Sürme Kanat Profili', nameEn: 'Wide Sliding Sash' },
  { code: '51LS-213-00', weight: 2.157, type: 'sash', nameTr: 'Ağır Tip Kanat Profili', nameEn: 'Heavy Duty Sliding Sash' },

  // Mullion/Transom Profiles (Orta Kayıt) - 3 ile başlayanlar
  { code: '51LS-301-00', weight: 1.409, type: 'mullion', nameTr: 'Orta Kayıt Profili', nameEn: 'Mullion Profile' },

  // Special/Accessory/Mullion supplementary profiles (listed on catalog sheet, starting with other numbers)
  { code: '51LS-561-00', weight: 1.844, type: 'sash', nameTr: 'Kanat Adaptör Profili / Kamçı', nameEn: 'Sash Adapter Profile' },
  { code: '51LSM-513-00', weight: 1.100, type: 'sash', nameTr: 'Sürme Kenet Profili', nameEn: 'Interlocking Profile' },
  { code: '51LS-541-00', weight: 1.389, type: 'mullion', nameTr: 'Eşik Profili / Damlalık', nameEn: 'Threshold Profile / Drip' },
  { code: '07-123-00', weight: 1.591, type: 'mullion', nameTr: 'Yardımcı Profil', nameEn: 'Auxiliary Profile' },
  { code: '07-124-00', weight: 0.129, type: 'mullion', nameTr: 'Mini Adaptör / Kapak', nameEn: 'Cover-Adapter Profile' }
];
