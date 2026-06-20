
export type Language = 'en' | 'tr';

export interface Project {
  id: string;
  name: string;
  client: string;
  date: string;
  status: 'Draft' | 'Production' | 'Completed';
  units: Unit[];
  quoteText?: string;
  isExport?: boolean;
  discountPercentage?: number;
  clientApprovalStatus?: 'Pending' | 'Approved' | 'ChangesRequested';
  clientApprovalNotes?: string;
  clientSignatureName?: string;
  clientSignatureDate?: string;
  clientSignatureData?: string;
}

export interface Accessory {
  id: string;
  name: string;
  type: 'handle' | 'gasket' | 'hinge' | 'lock' | 'corner' | 'automation' | 'kickplate' | 'doorCloser' | 'lockStriker' | 'other';
  unit: 'pce' | 'meter';
  price: number;
  maxWeightKg?: number;
  compatibility?: 'sliding' | 'hinged' | 'both';
}

export type UnitShape = 'rect' | 'triangle' | 'arch';

export interface Unit {
  id: string;
  name: string;
  width: number;
  height: number;
  shape?: UnitShape;
  archHeight?: number;
  system: string;
  color: string;
  specificColor?: string;
  glassType: string;
  glassThickness: number;
  rootNode: WindowNode;
  quantity: number;
  hasThreshold?: boolean;
  includeGlass?: boolean;
  customGlassPrice?: number;
  selectedHandle?: string;
  selectedGasket?: string;
  selectedHinge?: string;
  selectedCorner?: string;
  selectedLock?: string;
  selectedAutomation?: string;
  selectedLockStriker?: string;
  selectedDoorCloser?: string;
  selectedKickplate?: string;
  selectedOther?: string;
}

export type NodeType = 'container' | 'glass' | 'sash' | 'panel';
export type SplitDirection = 'vertical' | 'horizontal';

export interface WindowNode {
  id: string;
  type: NodeType;
  direction?: SplitDirection;
  children?: WindowNode[];
  splitRatio?: number[];
  openingType?: 'fixed' | 'turn-left' | 'turn-right' | 'tilt' | 'tilt-turn-left' | 'tilt-turn-right' | 'sliding';
  handlePosition?: 'left' | 'right' | 'bottom'; 
}

export interface CuttingCorrectionConfig {
  sashOverlap: number;
  glassClearance: number;
  mullionCorrection: number;
  frameCornerWelding: number;
}

export interface MachineConfig {
  id: string;
  name: string;
  brand: string;
  bladeThickness: number;
  minWaste: number;
  clampingOffset: number;
}

export interface ProfileCodes {
  frame: string;
  sash: string;
  mullion: string;
  glazingBead: string;
}

export interface ProfileWeights {
  frame: number;
  sash: number;
  mullion: number;
  glazingBead: number;
}

export interface ProfileSystem {
  id: string;
  name: string;
  type: 'sliding' | 'hinged';
  cncCode?: string; 
  uValue: number;
  frameWidth: number;
  frameDepth: number;         // New: Kasa derinliği
  sashDepth?: number;         // New: Kanat derinliği
  thermalBreakWidth?: number; // New: Isı köprüsü genişliği (Polyamid)
  wallThickness: number;      // New: Et kalınlığı
  pricePerMeter: number;
  profileLength: number;
  correctionConfig: CuttingCorrectionConfig;
  defaultCornerCleat?: string;
  profileCodes?: ProfileCodes;
  profileWeights?: ProfileWeights;
  laborPricePerKg?: number;
  laborPricePerKgUsd?: number;
}

export interface GlassType {
  id: string;
  name: string;
  uValue: number;
  thickness: number;
  pricePerSqm: number;
}

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  status: 'active' | 'blocked';
  notes?: string;
  address?: string;
}

export interface ColorGroup {
  id: string;
  nameTr: string;
  nameEn: string;
  defaultPricePerKg: number;
  descriptionTr?: string;
  descriptionEn?: string;
}

export interface AppData {
  projects: Project[];
  systems: ProfileSystem[];
  accessories: Accessory[];
  machines?: MachineConfig[];
  customers?: Customer[];
}
