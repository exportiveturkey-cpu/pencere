
export type Language = 'en' | 'tr';

export interface Project {
  id: string;
  name: string;
  client: string;
  date: string;
  status: 'Draft' | 'Production' | 'Completed';
  units: Unit[];
}

export interface Accessory {
  id: string;
  name: string; // Brand/Model e.g., "Roto Swing Secustik"
  type: 'handle' | 'gasket' | 'hinge' | 'lock' | 'corner' | 'automation' | 'kickplate' | 'doorCloser' | 'lockStriker' | 'other';
  unit: 'pce' | 'meter'; // Piece or Meter
  price: number;
  maxWeightKg?: number; // Load capacity for hinges
}

export interface Unit {
  id: string;
  name: string;
  width: number; // mm
  height: number; // mm
  system: string; // e.g., 'EcoLine 50', 'ThermoPro 75'
  color: string; // Legacy string, kept for compatibility
  glassType: string;
  glassThickness: number;
  rootNode: WindowNode;
  quantity: number;
  selectedHandle?: string; // ID of selected handle accessory
  selectedGasket?: string; // ID of selected gasket accessory
  selectedHinge?: string; // ID of selected hinge accessory
  selectedCorner?: string; // ID of selected corner cleat accessory
  selectedLockStriker?: string; // ID of selected lock striker
  selectedDoorCloser?: string; // ID of selected door closer
  selectedKickplate?: string; // ID of selected kickplate
}

export type NodeType = 'container' | 'glass' | 'sash' | 'panel';
export type SplitDirection = 'vertical' | 'horizontal';

export interface WindowNode {
  id: string;
  type: NodeType;
  direction?: SplitDirection; // Only for containers
  children?: WindowNode[]; // Only for containers
  splitRatio?: number[]; // Percentage of split for children (e.g., [0.5, 0.5])
  
  // Leaf properties
  // Updated Opening Types
  openingType?: 'fixed' | 'turn-left' | 'turn-right' | 'tilt' | 'tilt-turn-left' | 'tilt-turn-right' | 'sliding';
  handlePosition?: 'left' | 'right' | 'bottom'; 
}

// NEW: Advanced Cutting Rules
export interface CuttingCorrectionConfig {
  sashOverlap: number; // "Bini Payı": How much sash overlaps frame (e.g., 6mm)
  glassClearance: number; // "Cam Boşluğu": Gap between frame/sash and glass (e.g., 5mm)
  mullionCorrection: number; // "Orta Kayıt Bağlantı": Adjustment for mechanical joints (e.g., 0 or -1mm)
  frameCornerWelding: number; // "Kaynak Payı": Added length for welding (usually 0 for Aluminium crimping, 6mm for PVC)
}

export interface ProfileSystem {
  id: string;
  name: string;
  uValue: number; // Thermal insulation
  frameWidth: number; // mm
  pricePerMeter: number;
  profileLength: number; // meters per bar
  correctionConfig: CuttingCorrectionConfig; // NEW Field
  defaultCornerCleat?: string; // ID of default corner accessory
}

export interface GlassType {
  id: string;
  name: string;
  uValue: number;
  thickness: number;
  pricePerSqm: number;
}

// Backup Data Structure
export interface AppData {
  projects: Project[];
  systems: ProfileSystem[];
  accessories: Accessory[];
  version: string;
  date: string;
}