export type Language = 'en' | 'tr';

export interface Project {
  id: string;
  name: string;
  client: string;
  date: string;
  status: 'Draft' | 'Production' | 'Completed';
  units: Unit[];
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
  openingType?: 'fixed' | 'turn' | 'tilt-turn' | 'sliding';
  handlePosition?: 'left' | 'right' | 'bottom';
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