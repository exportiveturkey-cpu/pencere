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
  type: 'handle' | 'gasket' | 'hinge' | 'lock' | 'corner' | 'automation' | 'other';
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
  color: string;
  glassType: string;
  glassThickness: number;
  rootNode: WindowNode;
  quantity: number;
  selectedHandle?: string; // ID of selected handle accessory
  selectedGasket?: string; // ID of selected gasket accessory
  selectedHinge?: string; // ID of selected hinge accessory
  selectedCorner?: string; // ID of selected corner cleat accessory
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
  handlePosition?: 'left' | 'right' | 'bottom'; // Kept for legacy compatibility or sliding, but mostly derived from openingType now
}

export interface ProfileSystem {
  id: string;
  name: string;
  uValue: number; // Thermal insulation
  frameWidth: number; // mm
  pricePerMeter: number;
  profileLength: number; // meters per bar
}

export interface GlassType {
  id: string;
  name: string;
  uValue: number;
  thickness: number;
  pricePerSqm: number;
}