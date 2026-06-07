
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
