
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
  projectNumber?: string;
  discountPercentage?: number;
  clientApprovalStatus?: 'Pending' | 'Approved' | 'ChangesRequested';
  clientApprovalNotes?: string;
  clientSignatureName?: string;
  clientSignatureDate?: string;
  clientSignatureData?: string;
  shadingItems?: ShadingItem[];
}

export interface Accessory {
  id: string;
  name: string;
  type: 'handle' | 'gasket' | 'hinge' | 'lock' | 'corner' | 'automation' | 'kickplate' | 'doorCloser' | 'lockStriker' | 'other';
  unit: 'pce' | 'meter';
  price: number;
  maxWeightKg?: number;
  compatibility?: 'sliding' | 'hinged' | 'both';
  imageUrl?: string;
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
  typology?: string;
  selectedFrameProfile?: string;
  selectedSashProfile?: string;
  selectedMullionProfile?: string;
  selectedFrameProfileImage?: string;
  selectedSashProfileImage?: string;
  selectedMullionProfileImage?: string;
  customProfileImages?: Record<string, string>;
  viewPerspective?: 'interior' | 'exterior';
  planSectionUrl?: string;
  crossSectionUrl?: string;
  planSectionProfileCode?: string;
  crossSectionProfileCode?: string;
}

export type NodeType = 'container' | 'glass' | 'sash' | 'panel' | 'void';
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
  materialType?: 'aluminum' | 'pvc';
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
  tiltTurnLaborPrice?: number;        // ALÜMİNYUM ÇİFT AÇILIM PENCERE KANAT AKSESUAR MONTAJ BEDELİ (TL / Adet)
  tiltTurnLaborPriceUsd?: number;     // ALÜMİNYUM ÇİFT AÇILIM PENCERE KANAT AKSESUAR MONTAJ BEDELİ (USD / Adet)
  hbsbLaborPrice?: number;            // ALÜMİNYUM HBSB SÜRME AKSESUAR MONTAJ BEDELİ (HER KANAT İÇİN) (TL / Adet)
  hbsbLaborPriceUsd?: number;         // ALÜMİNYUM HBSB SÜRME AKSESUAR MONTAJ BEDELİ (HER KANAT İÇİN) (USD / Adet)
  supportedTypologies?: string[];
  planSectionUrl?: string;
  crossSectionUrl?: string;
  planSectionProfileCode?: string;
  crossSectionProfileCode?: string;
  framePlanSectionUrl?: string;
  frameCrossSectionUrl?: string;
  framePlanSectionProfileCode?: string;
  frameCrossSectionProfileCode?: string;
  sashPlanSectionUrl?: string;
  sashCrossSectionUrl?: string;
  sashPlanSectionProfileCode?: string;
  sashCrossSectionProfileCode?: string;
  mullionPlanSectionUrl?: string;
  mullionCrossSectionUrl?: string;
  mullionPlanSectionProfileCode?: string;
  mullionCrossSectionProfileCode?: string;
  profileDrawings?: ProfileDrawing[];
}

export interface ProfileDrawing {
  id: string;
  code: string;
  type: 'frame' | 'sash' | 'mullion' | 'general' | 'other';
  planSectionUrl?: string;
  crossSectionUrl?: string;
  description?: string;
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

export interface CatalogProfileItem {
  code: string;
  weight: number;
  type: 'frame' | 'sash' | 'mullion';
  nameTr: string;
  nameEn: string;
}

export interface ShadingItem {
  id: string;
  productType: string;
  name: string;
  modelStyle?: string;
  width: number;       // in mm
  height: number;      // in mm (or drop/projection/height)
  depth?: number;      // in mm (projection depth for structures)
  frontHeight?: number; // in mm
  backHeight?: number;  // in mm
  quantity: number;
  unitPrice: number;    // set directly or based on m²
  color: string;
  notes?: string;
  bgImageUrl?: string; // photo of house
  imageUrl?: string;   // custom product/render image url from ShadeVision
  planSectionUrl?: string; // Plan Section Image url
  crossSectionUrl?: string; // Vertical/Cross Section Image url
  planSectionProfileCode?: string;
  crossSectionProfileCode?: string;
  overlayX?: number;   // X placement percentage of drawing on user image
  overlayY?: number;   // Y placement percentage on user image
  overlayScale?: number; // scale percent of drawing overlay (e.g. 1.0 = 100%)
  overlayRotate?: number; // rotation in degrees
  louverAngle?: number;
  ledOn?: boolean;
  extension?: number;
}
