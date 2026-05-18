
import { ProfileSystem, GlassType, Project, Accessory } from './types';

export const PROFILE_SYSTEMS: ProfileSystem[] = [
  // --- ASAŞ RESCARA (Menteşeli) ---
  { 
    id: 'asas-rs65', 
    name: 'Asaş Rescara RS65 (Thermal)', 
    type: 'hinged',
    uValue: 1.8, frameWidth: 65, frameDepth: 65, sashDepth: 75, thermalBreakWidth: 24, wallThickness: 1.6,
    pricePerMeter: 95, profileLength: 6.0,
    correctionConfig: { sashOverlap: 8, glassClearance: 5, mullionCorrection: 0, frameCornerWelding: 0 },
    profileCodes: { frame: '65-101', sash: '65-201', mullion: '65-301', glazingBead: '65-401' },
    profileWeights: { frame: 1.485, sash: 1.720, mullion: 1.560, glazingBead: 0.285 }
  },
  { 
    id: 'asas-rs60', 
    name: 'Asaş Rescara RS60 (Thermal)', 
    type: 'hinged',
    uValue: 2.0, frameWidth: 60, frameDepth: 60, sashDepth: 70, thermalBreakWidth: 20, wallThickness: 1.4,
    pricePerMeter: 85, profileLength: 6.0,
    correctionConfig: { sashOverlap: 8, glassClearance: 5, mullionCorrection: 0, frameCornerWelding: 0 },
    profileCodes: { frame: '60-101', sash: '60-201', mullion: '60-301', glazingBead: '60-401' },
    profileWeights: { frame: 1.320, sash: 1.510, mullion: 1.420, glazingBead: 0.260 }
  },

  // --- ASAŞ RESCARA (Sürme / Sliding) ---
  { 
    id: 'asas-s50', 
    name: 'Asaş S50 (Thermal Sliding)', 
    type: 'sliding',
    uValue: 2.2, frameWidth: 50, frameDepth: 120, sashDepth: 45, thermalBreakWidth: 18, wallThickness: 1.8,
    pricePerMeter: 115, profileLength: 6.0,
    correctionConfig: { sashOverlap: 30, glassClearance: 5, mullionCorrection: 0, frameCornerWelding: 0 },
    profileCodes: { frame: 'S50-101', sash: 'S50-201', mullion: 'S50-301', glazingBead: 'S50-401' },
    profileWeights: { frame: 2.250, sash: 1.650, mullion: 1.850, glazingBead: 0.280 }
  },
  { 
    id: 'asas-s36', 
    name: 'Asaş S36 (Eco Sliding)', 
    type: 'sliding',
    uValue: 3.5, frameWidth: 36, frameDepth: 95, sashDepth: 36, wallThickness: 1.3,
    pricePerMeter: 65, profileLength: 6.0,
    correctionConfig: { sashOverlap: 25, glassClearance: 4, mullionCorrection: 0, frameCornerWelding: 0 },
    profileCodes: { frame: 'S36-101', sash: 'S36-201', mullion: 'S36-301', glazingBead: 'S36-401' },
    profileWeights: { frame: 1.450, sash: 1.150, mullion: 1.250, glazingBead: 0.220 }
  },

  // --- KURTOĞLU ---
  { 
    id: 'kurt-l60', 
    name: 'Kurtoğlu L60 (Thermal)', 
    type: 'hinged',
    uValue: 1.9, frameWidth: 60, frameDepth: 60, sashDepth: 68, thermalBreakWidth: 18, wallThickness: 1.5,
    pricePerMeter: 88, profileLength: 6.0,
    correctionConfig: { sashOverlap: 7, glassClearance: 5, mullionCorrection: 0, frameCornerWelding: 0 },
    profileCodes: { frame: 'L60-101', sash: 'L60-201', mullion: 'L60-301', glazingBead: 'L60-401' },
    profileWeights: { frame: 1.250, sash: 1.480, mullion: 1.350, glazingBead: 0.250 }
  },
  { 
    id: 'kurt-l65s', 
    name: 'Kurtoğlu L65S (Thermal Sliding)', 
    type: 'sliding',
    uValue: 2.1, frameWidth: 65, frameDepth: 115, sashDepth: 45, thermalBreakWidth: 20, wallThickness: 1.6,
    pricePerMeter: 108, profileLength: 6.0,
    correctionConfig: { sashOverlap: 32, glassClearance: 5, mullionCorrection: 0, frameCornerWelding: 0 },
    profileCodes: { frame: 'L65S-101', sash: 'L65S-201', mullion: 'L65S-301', glazingBead: 'L65S-401' },
    profileWeights: { frame: 2.120, sash: 1.580, mullion: 1.720, glazingBead: 0.270 }
  },

  // --- SARAY ---
  { 
    id: 'saray-si67', 
    name: 'Saray SI67 (Thermal)', 
    type: 'hinged',
    uValue: 1.6, frameWidth: 67, frameDepth: 67, sashDepth: 77, thermalBreakWidth: 24, wallThickness: 1.6,
    pricePerMeter: 92, profileLength: 6.0,
    correctionConfig: { sashOverlap: 8, glassClearance: 5, mullionCorrection: 0, frameCornerWelding: 0 },
    profileCodes: { frame: 'SI67-101', sash: 'SI67-201', mullion: 'SI67-301', glazingBead: 'SI67-401' },
    profileWeights: { frame: 1.410, sash: 1.650, mullion: 1.520, glazingBead: 0.275 }
  },
  { 
    id: 'saray-ss68', 
    name: 'Saray SS68 (Slide & Lift)', 
    type: 'sliding',
    uValue: 1.5, frameWidth: 68, frameDepth: 150, sashDepth: 68, thermalBreakWidth: 24, wallThickness: 2.0,
    pricePerMeter: 155, profileLength: 6.0,
    correctionConfig: { sashOverlap: 40, glassClearance: 6, mullionCorrection: 0, frameCornerWelding: 0 },
    profileCodes: { frame: 'SS68-101', sash: 'SS68-201', mullion: 'SS68-301', glazingBead: 'SS68-401' },
    profileWeights: { frame: 3.150, sash: 2.450, mullion: 2.850, glazingBead: 0.320 }
  },

  // --- ÇUHADAROĞLU ---
  { 
    id: 'cuha-st60', 
    name: 'Çuhadaroğlu ST60 (Professional)', 
    type: 'hinged',
    uValue: 1.9, frameWidth: 60, frameDepth: 60, sashDepth: 70, thermalBreakWidth: 24, wallThickness: 1.8,
    pricePerMeter: 105, profileLength: 6.0,
    correctionConfig: { sashOverlap: 8, glassClearance: 5, mullionCorrection: 0, frameCornerWelding: 0 },
    profileCodes: { frame: 'ST60-111', sash: 'ST60-211', mullion: 'ST60-311', glazingBead: 'ST60-411' },
    profileWeights: { frame: 1.550, sash: 1.820, mullion: 1.680, glazingBead: 0.290 }
  },
  { 
    id: 'cuha-sl32', 
    name: 'Çuhadaroğlu SL32 (Economic Slide)', 
    type: 'sliding',
    uValue: 3.2, frameWidth: 32, frameDepth: 85, sashDepth: 32, wallThickness: 1.4,
    pricePerMeter: 68, profileLength: 6.0,
    correctionConfig: { sashOverlap: 22, glassClearance: 4, mullionCorrection: 0, frameCornerWelding: 0 },
    profileCodes: { frame: 'SL32-101', sash: 'SL32-201', mullion: 'SL32-301', glazingBead: 'SL32-401' },
    profileWeights: { frame: 1.380, sash: 1.080, mullion: 1.150, glazingBead: 0.210 }
  },

  // --- AKPA ---
  { 
    id: 'akpa-as65', 
    name: 'Akpa AS65 (Thermal)', 
    type: 'hinged',
    uValue: 1.8, frameWidth: 65, frameDepth: 65, sashDepth: 75, thermalBreakWidth: 24, wallThickness: 1.6,
    pricePerMeter: 82, profileLength: 6.0,
    correctionConfig: { sashOverlap: 7, glassClearance: 5, mullionCorrection: 0, frameCornerWelding: 0 },
    profileCodes: { frame: 'AS65-101', sash: 'AS65-201', mullion: 'AS65-301', glazingBead: 'AS65-401' },
    profileWeights: { frame: 1.360, sash: 1.580, mullion: 1.450, glazingBead: 0.265 }
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
  { id: 'double24', name: '4+16+4 Low-E Double', uValue: 1.1, thickness: 24, pricePerSqm: 65 },
  { id: 'triple36', name: '4+12+4+12+4 Triple', uValue: 0.6, thickness: 36, pricePerSqm: 110 },
  { id: 'lam', name: '6.4mm Laminated Safety', uValue: 5.6, thickness: 6, pricePerSqm: 55 },
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
