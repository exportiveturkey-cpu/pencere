import { ProfileSystem, GlassType, Project } from './types';

export const PROFILE_SYSTEMS: ProfileSystem[] = [
  { id: 'eco50', name: 'EcoLine 50 (Cold)', uValue: 2.1, frameWidth: 50, pricePerMeter: 45, profileLength: 6.0 },
  { id: 'std65', name: 'Standard 65 (Thermal)', uValue: 1.6, frameWidth: 65, pricePerMeter: 85, profileLength: 6.0 },
  { id: 'prem75', name: 'Premium 75 (High Insulation)', uValue: 1.1, frameWidth: 75, pricePerMeter: 120, profileLength: 6.0 },
  { id: 'slide120', name: 'SlideMaster 120', uValue: 1.8, frameWidth: 120, pricePerMeter: 150, profileLength: 6.0 },
];

export const GLASS_TYPES: GlassType[] = [
  { id: 'float4', name: 'Single Glazed 4mm', uValue: 5.8, thickness: 4, pricePerSqm: 25 },
  { id: 'double24', name: 'Double Glazed 4-16-4', uValue: 1.1, thickness: 24, pricePerSqm: 65 },
  { id: 'triple36', name: 'Triple Glazed 4-12-4-12-4', uValue: 0.6, thickness: 36, pricePerSqm: 110 },
  { id: 'lam', name: 'Laminated Safety 6.4mm', uValue: 5.6, thickness: 6, pricePerSqm: 55 },
];

export const MOCK_PROJECTS: Project[] = [
  {
    id: 'p1',
    name: 'Villa Sunshine Renovation',
    client: 'John Doe',
    date: '2023-10-25',
    status: 'Draft',
    units: []
  },
  {
    id: 'p2',
    name: 'City Center Office Block',
    client: 'BuildCorp Inc.',
    date: '2023-10-20',
    status: 'Production',
    units: []
  }
];

export const INITIAL_ROOT_NODE = {
  id: 'root',
  type: 'glass' as const,
  openingType: 'fixed' as const,
};