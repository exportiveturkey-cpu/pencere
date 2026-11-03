
import { Unit, ProfileSystem, WindowNode, GlassType, UnitShape, Accessory, ProfileBarConfig } from '../types';
import { GLASS_TYPES, PROFILE_SYSTEMS, KURTOGLU_70T_CATALOG, KURTOGLU_51LS_CATALOG } from '../constants';

export interface OptimizedBar {
  barLength: number;
  cuts: number[]; 
  remaining: number;
}

export interface SystemOptimization {
  systemId: string;
  systemName: string;
  profileLabel: string;
  profileCode: string;
  totalBars: number;
  barLength: number; 
  totalEfficiency: number; 
  totalWaste: number; 
  bars: OptimizedBar[];
  totalCutCount: number;
  isCustomLength?: boolean;
  isMixedLength?: boolean;
  barLengthsBreakdown?: Record<number, number>; // e.g. { 6000: 8, 7000: 3 }
}

export interface CutItem {
  length: number;
  label: string; 
  profileCode?: string;
  quantity: number;
  systemName: string;
  weight?: number;
}

export interface GlassOrderItem {
  width: number;
  height: number;
  type: string;
  quantity: number;
  area: number;
  weight: number;
  unitName: string;
  shape: UnitShape;
}

export interface AccessorySummaryItem {
  id: string;
  name: string;
  type: string;
  quantity: number;
  unit: 'pce' | 'meter';
}

const SAW_BLADE_THICKNESS = 5; 

// Helper to find system with fallback
const findSystem = (systemId: string, systems: ProfileSystem[]): ProfileSystem | undefined => {
  let system = systems.find(s => s.id === systemId);
  if (system) return system;
  system = systems.find(s => s.name.toLowerCase().includes(systemId.toLowerCase()));
  if (system) return system;
  return systems[0];
};

const extractCuts = (unit: Unit, system: ProfileSystem): { length: number, label: string, code?: string, weightPerMeter?: number }[] => {
  const cuts: { length: number, label: string, code?: string, weightPerMeter?: number }[] = [];
  const config = system.correctionConfig || { sashOverlap: 8, glassClearance: 5, mullionCorrection: 0, frameCornerWelding: 0 };
  
  // Custom weights/codes support
  let frameCode = system.profileCodes?.frame;
  let frameWeight = system.profileWeights?.frame || 0;
  let sashCode = system.profileCodes?.sash;
  let sashWeight = system.profileWeights?.sash || 0;
  let mullionCode = system.profileCodes?.mullion;
  let mullionWeight = system.profileWeights?.mullion || 0;

  const catalogToUse = system.id === 'kurt-70t-th' 
    ? KURTOGLU_70T_CATALOG 
    : (system.id === 'kurt-51ls' ? KURTOGLU_51LS_CATALOG : null);

  if (catalogToUse) {
    if (unit.selectedFrameProfile) {
      const match = catalogToUse.find(c => c.code === unit.selectedFrameProfile);
      if (match) {
        frameCode = match.code;
        frameWeight = match.weight;
      }
    }
    if (unit.selectedSashProfile) {
      const match = catalogToUse.find(c => c.code === unit.selectedSashProfile);
      if (match) {
        sashCode = match.code;
        sashWeight = match.weight;
      }
    }
    if (unit.selectedMullionProfile) {
      const match = catalogToUse.find(c => c.code === unit.selectedMullionProfile);
      if (match) {
        mullionCode = match.code;
        mullionWeight = match.weight;
      }
    }
  }

  const frameWidth = system.frameWidth;

  const isSliding = system.name.toLowerCase().includes('sürme') || system.name.toLowerCase().includes('sliding');
  
  const frameW = unit.width + (2 * config.frameCornerWelding);
  const frameH = unit.height + (2 * config.frameCornerWelding);

  // Kasa Kesimleri
  cuts.push({ length: frameW, label: isSliding ? 'Kasa Alt/Üst Ray' : 'Frame Profile', code: frameCode, weightPerMeter: frameWeight });
  cuts.push({ length: frameW, label: isSliding ? 'Kasa Alt/Üst Ray' : 'Frame Profile', code: frameCode, weightPerMeter: frameWeight });
  cuts.push({ length: frameH, label: isSliding ? 'Kasa Yan Dikme' : 'Frame Profile', code: frameCode, weightPerMeter: frameWeight });
  cuts.push({ length: frameH, label: isSliding ? 'Kasa Yan Dikme' : 'Frame Profile', code: frameCode, weightPerMeter: frameWeight });

  const traverse = (node: WindowNode, w: number, h: number) => {
    if (node.type === 'container' && node.children?.length === 2 && node.splitRatio) {
      const isVert = node.direction === 'vertical';
      const rawLength = isVert ? h : w;
      const mullionCutLen = (rawLength - (2 * frameWidth)) + config.mullionCorrection;
      if (mullionCutLen > 0) {
          cuts.push({ 
            length: Math.round(mullionCutLen), 
            label: isVert ? 'Mullion (Vertical)' : 'Transom (Horizontal)', 
            code: mullionCode, 
            weightPerMeter: mullionWeight 
          });
      }
      const avail = isVert ? w - frameWidth : h - frameWidth;
      const s1 = avail * node.splitRatio[0];
      const s2 = avail * node.splitRatio[1];
      traverse(node.children[0], isVert ? s1 : w, isVert ? h : s1);
      traverse(node.children[1], isVert ? s2 : w, isVert ? h : s2);
    } else {
      if (node.type === 'void') return; // Exclude void openings from sash/bead cuts
      const isOpening = node.openingType && node.openingType !== 'fixed';
      const daylightW = w - (2 * frameWidth);
      const daylightH = h - (2 * frameWidth);
      
      let beadW = daylightW;
      let beadH = daylightH;

      if (isOpening) {
        // Kanat Kesimleri
        const sashCutW = (daylightW + (2 * config.sashOverlap)) + (2 * config.frameCornerWelding);
        const sashCutH = (daylightH + (2 * config.sashOverlap)) + (2 * config.frameCornerWelding);
        if (sashCutW > 0 && sashCutH > 0) {
            cuts.push({ length: Math.round(sashCutW), label: 'Sash Profile', code: sashCode, weightPerMeter: sashWeight });
            cuts.push({ length: Math.round(sashCutW), label: 'Sash Profile', code: sashCode, weightPerMeter: sashWeight });
            cuts.push({ length: Math.round(sashCutH), label: 'Sash Profile', code: sashCode, weightPerMeter: sashWeight });
            cuts.push({ length: Math.round(sashCutH), label: 'Sash Profile', code: sashCode, weightPerMeter: sashWeight });
        }
        const sashProfileWidth = 55;
        beadW = sashCutW - (2 * sashProfileWidth);
        beadH = sashCutH - (2 * sashProfileWidth);
      }

      // Cam Çıtası Kesimleri
      if (beadW > 0 && beadH > 0 && !isSliding) {
          const beadWeight = system.profileWeights?.glazingBead || 0;
          cuts.push({ length: Math.round(beadW), label: 'Glazing Bead', code: system.profileCodes?.glazingBead, weightPerMeter: beadWeight });
          cuts.push({ length: Math.round(beadW), label: 'Glazing Bead', code: system.profileCodes?.glazingBead, weightPerMeter: beadWeight });
          cuts.push({ length: Math.round(beadH), label: 'Glazing Bead', code: system.profileCodes?.glazingBead, weightPerMeter: beadWeight });
          cuts.push({ length: Math.round(beadH), label: 'Glazing Bead', code: system.profileCodes?.glazingBead, weightPerMeter: beadWeight });
      }
    }
  };
  traverse(unit.rootNode, unit.width, unit.height);
  return cuts;
};

export const calculateProjectOptimization = (
  units: Unit[], 
  systems: ProfileSystem[],
  customBarLengthMm?: number,
  profileBarLengths?: Record<string, number | ProfileBarConfig>
): SystemOptimization[] => {
  const result: SystemOptimization[] = [];
  const cutsByProfile: Record<string, { system: ProfileSystem, label: string, code: string, lengths: number[] }> = {};

  if (!units || units.length === 0) return [];

  units.forEach(u => {
    const system = findSystem(u.system, systems);
    if (!system) return;
    
    const unitCuts = extractCuts(u, system);
    unitCuts.forEach(cut => {
        const key = `${system.id}-${cut.code || cut.label}`;
        if (!cutsByProfile[key]) {
            cutsByProfile[key] = { 
                system, 
                label: cut.label, 
                code: cut.code || '-', 
                lengths: [] 
            };
        }
        const qty = u.quantity || 1;
        for (let i = 0; i < qty; i++) {
            cutsByProfile[key].lengths.push(cut.length);
        }
    });
  });

  for (const key in cutsByProfile) {
    const profileData = cutsByProfile[key];
    const defaultBarLengthMm = (profileData.system.profileLength || 6.0) * 1000;
    const baseProjectLengthMm = (customBarLengthMm && customBarLengthMm >= 1000 && customBarLengthMm <= 15000)
      ? customBarLengthMm
      : defaultBarLengthMm;

    // Check profile-specific bar length override
    const rawSetting = 
      (profileBarLengths?.[key]) ||
      (profileData.code && profileBarLengths?.[profileData.code]) ||
      (profileData.label.toLowerCase().includes('frame') ? profileBarLengths?.['frame'] : undefined) ||
      (profileData.label.toLowerCase().includes('sash') ? profileBarLengths?.['sash'] : undefined) ||
      (profileData.label.toLowerCase().includes('mullion') || profileData.label.toLowerCase().includes('transom') ? profileBarLengths?.['mullion'] : undefined) ||
      (profileData.label.toLowerCase().includes('bead') ? profileBarLengths?.['bead'] : undefined);

    let configMode: 'single' | 'mixed' | 'manual' = 'single';
    let barLengthMm = baseProjectLengthMm;
    let mixedLengths: number[] | undefined = undefined;
    let manualSplits: { lengthMm: number; count: number }[] | undefined = undefined;

    if (typeof rawSetting === 'number') {
      if (rawSetting >= 1000 && rawSetting <= 15000) {
        barLengthMm = rawSetting;
      }
      configMode = 'single';
    } else if (rawSetting && typeof rawSetting === 'object') {
      configMode = rawSetting.mode || 'single';
      if (rawSetting.lengthMm && rawSetting.lengthMm >= 1000) barLengthMm = rawSetting.lengthMm;
      if (rawSetting.mixedLengths && rawSetting.mixedLengths.length > 0) mixedLengths = rawSetting.mixedLengths;
      if (rawSetting.manualSplits && rawSetting.manualSplits.length > 0) manualSplits = rawSetting.manualSplits;
    }

    const optimizedBars = optimizeCutsAdvanced(profileData.lengths, {
      mode: configMode,
      baseLength: barLengthMm,
      mixedLengths,
      manualSplits
    });

    const breakdown: Record<number, number> = {};
    optimizedBars.forEach(b => {
      breakdown[b.barLength] = (breakdown[b.barLength] || 0) + 1;
    });

    const totalUsedLength = optimizedBars.reduce((acc, bar) => acc + (bar.barLength - bar.remaining), 0);
    const totalCapacity = optimizedBars.reduce((acc, bar) => acc + bar.barLength, 0);
    const efficiency = totalCapacity > 0 ? (totalUsedLength / totalCapacity) * 100 : 0;
    const isMixed = Object.keys(breakdown).length > 1;
    const isCustom = !isMixed && barLengthMm !== 6000;

    result.push({
      systemId: profileData.system.id,
      systemName: profileData.system.name,
      profileLabel: profileData.label,
      profileCode: profileData.code,
      barLength: barLengthMm,
      totalBars: optimizedBars.length,
      bars: optimizedBars,
      totalEfficiency: efficiency,
      totalWaste: 100 - efficiency,
      totalCutCount: profileData.lengths.length,
      isCustomLength: isCustom,
      isMixedLength: isMixed,
      barLengthsBreakdown: breakdown
    });
  }
  return result;
};

const optimizeCutsAdvanced = (
  lengths: number[], 
  config: {
    mode: 'single' | 'mixed' | 'manual';
    baseLength: number;
    mixedLengths?: number[];
    manualSplits?: { lengthMm: number; count: number }[];
  }
): OptimizedBar[] => {
  const sortedCuts = [...lengths].sort((a, b) => b - a);
  const bars: OptimizedBar[] = [];

  // Manual splits mode: Pre-seed specific bar counts and lengths
  if (config.mode === 'manual' && config.manualSplits && config.manualSplits.length > 0) {
    config.manualSplits.forEach(split => {
      const bLen = split.lengthMm || config.baseLength;
      for (let i = 0; i < (split.count || 0); i++) {
        bars.push({
          barLength: bLen,
          cuts: [],
          remaining: bLen
        });
      }
    });

    for (const cut of sortedCuts) {
      const cutWithKerf = cut + SAW_BLADE_THICKNESS;
      let bestBarIndex = -1;
      let minRemaining = Number.MAX_VALUE;

      for (let i = 0; i < bars.length; i++) {
        if (bars[i].remaining >= cutWithKerf) {
          const remainingAfter = bars[i].remaining - cutWithKerf;
          if (remainingAfter < minRemaining) {
            minRemaining = remainingAfter;
            bestBarIndex = i;
          }
        }
      }

      if (bestBarIndex !== -1) {
        bars[bestBarIndex].cuts.push(cut);
        bars[bestBarIndex].remaining -= cutWithKerf;
      } else {
        // Pre-allocated bars are full, add fallback bar with baseLength
        bars.push({
          barLength: config.baseLength,
          cuts: [cut],
          remaining: config.baseLength - cutWithKerf
        });
      }
    }

    return bars.filter(b => b.cuts.length > 0);
  }

  // Automatic multi-stock optimization mode
  const allowedStockLengths = (config.mode === 'mixed' && config.mixedLengths && config.mixedLengths.length > 0)
    ? [...config.mixedLengths].sort((a, b) => a - b)
    : [config.baseLength];

  for (let cIdx = 0; cIdx < sortedCuts.length; cIdx++) {
    const cut = sortedCuts[cIdx];
    const cutWithKerf = cut + SAW_BLADE_THICKNESS;
    let bestBarIndex = -1;
    let minRemaining = Number.MAX_VALUE;

    // 1. Try to place cut in an existing open bar
    for (let i = 0; i < bars.length; i++) {
      if (bars[i].remaining >= cutWithKerf) {
        const remainingAfter = bars[i].remaining - cutWithKerf;
        if (remainingAfter < minRemaining) {
          minRemaining = remainingAfter;
          bestBarIndex = i;
        }
      }
    }

    if (bestBarIndex !== -1) {
      bars[bestBarIndex].cuts.push(cut);
      bars[bestBarIndex].remaining -= cutWithKerf;
    } else {
      // 2. Open a new bar: select which stock length maximizes utilization
      let bestStockLength = allowedStockLengths[0];
      let bestWasteRatio = Number.MAX_VALUE;
      const remainingCuts = sortedCuts.slice(cIdx + 1);

      for (const stockLen of allowedStockLengths) {
        if (stockLen < cutWithKerf) continue;

        let rem = stockLen - cutWithKerf;
        for (const nextCut of remainingCuts) {
          const nextWithKerf = nextCut + SAW_BLADE_THICKNESS;
          if (rem >= nextWithKerf) {
            rem -= nextWithKerf;
          }
        }

        const wasteRatio = rem / stockLen;
        // Favor shorter stock unless longer stock yields noticeably better efficiency
        if (wasteRatio < bestWasteRatio - 0.03) {
          bestWasteRatio = wasteRatio;
          bestStockLength = stockLen;
        }
      }

      bars.push({
        barLength: bestStockLength,
        cuts: [cut],
        remaining: bestStockLength - cutWithKerf
      });
    }
  }

  return bars;
};

export const getAggregatedCuttingList = (units: Unit[], systems: ProfileSystem[]): Record<string, CutItem[]> => {
    const listBySystem: Record<string, CutItem[]> = {};
    if (!units || units.length === 0) return {};

    units.forEach(u => {
        const system = findSystem(u.system, systems);
        if (!system) return;
        const rawCuts = extractCuts(u, system);
        if (!listBySystem[system.name]) listBySystem[system.name] = [];
        
        const unitQty = u.quantity || 1;
        rawCuts.forEach(cut => {
            const existing = listBySystem[system.name].find(item => 
              Math.abs(item.length - cut.length) < 1 && 
              item.label === cut.label && 
              item.profileCode === cut.code
            );
            if (existing) {
              existing.quantity += unitQty;
            } else {
              listBySystem[system.name].push({ 
                length: Math.round(cut.length), 
                label: cut.label, 
                profileCode: cut.code,
                quantity: unitQty, 
                systemName: system.name,
                weight: cut.weightPerMeter ? (cut.length / 1000) * cut.weightPerMeter : 0
              });
            }
        });
    });
    return listBySystem;
};

export const getAggregatedGlassOrder = (units: Unit[], systems: ProfileSystem[]): GlassOrderItem[] => {
  const list: GlassOrderItem[] = [];
  if (!units) return [];

  units.forEach(u => {
    if (u.includeGlass === false) return; // Skip if glass is excluded
    const system = findSystem(u.system, systems);
    if (!system) return;
    const unitPanes = extractGlassPanes(u, system);
    const unitQty = u.quantity || 1;
    unitPanes.forEach(pane => {
      const existing = list.find(p => p.width === pane.width && p.height === pane.height && p.type === pane.type && p.shape === pane.shape);
      if (existing) {
        existing.quantity += unitQty;
        if (!existing.unitName.includes(u.name)) {
          existing.unitName = `${existing.unitName}, ${u.name}`;
        }
      } else {
        list.push({ ...pane, quantity: unitQty });
      }
    });
  });
  return list.sort((a, b) => (b.width * b.height) - (a.width * a.height));
};

export const extractGlassPanes = (unit: Unit, system: ProfileSystem): GlassOrderItem[] => {
  const panes: GlassOrderItem[] = [];
  const config = system.correctionConfig || { glassClearance: 5, sashOverlap: 8 };
  const frameWidth = system.frameWidth;
  const glassTypeObj = GLASS_TYPES.find(g => g.id === unit.glassType) || GLASS_TYPES[0];

  const traverse = (node: WindowNode, w: number, h: number) => {
    if (node.type === 'container' && node.children?.length === 2 && node.splitRatio) {
      const isVert = node.direction === 'vertical';
      const avail = isVert ? w - frameWidth : h - frameWidth;
      const s1 = avail * node.splitRatio[0];
      const s2 = avail * node.splitRatio[1];
      traverse(node.children[0], isVert ? s1 : w, isVert ? h : s1);
      traverse(node.children[1], isVert ? s2 : w, isVert ? h : s2);
    } else {
      if (node.type === 'void') return; // Exclude void openings from glass orders & weight
      let glassW, glassH;
      const isOpening = node.openingType && node.openingType !== 'fixed';
      
      if (isOpening) {
        const daylightW = w - (2 * frameWidth);
        const daylightH = h - (2 * frameWidth);
        const sashW = daylightW + (2 * config.sashOverlap);
        const sashH = daylightH + (2 * config.sashOverlap);
        const sashProfileWidth = 55; 
        glassW = sashW - (2 * sashProfileWidth) - (2 * config.glassClearance);
        glassH = sashH - (2 * sashProfileWidth) - (2 * config.glassClearance);
      } else {
        const daylightW = w - (2 * frameWidth);
        const daylightH = h - (2 * frameWidth);
        glassW = daylightW - (2 * config.glassClearance);
        glassH = daylightH - (2 * config.glassClearance);
      }
      
      const area = (glassW * glassH) / 1000000;
      const weight = area * glassTypeObj.thickness * 2.5;

      panes.push({
        width: Math.round(glassW),
        height: Math.round(glassH),
        type: glassTypeObj.name,
        quantity: 1,
        area: Number(area.toFixed(3)),
        weight: Number(weight.toFixed(2)),
        unitName: unit.name,
        shape: unit.shape || 'rect'
      });
    }
  };

  traverse(unit.rootNode, unit.width, unit.height);
  return panes;
};

export const getProjectAccessorySummary = (units: Unit[], accessories: Accessory[]): AccessorySummaryItem[] => {
  const summary: Record<string, AccessorySummaryItem> = {};

  units.forEach(unit => {
    const unitQty = unit.quantity || 1;
    const perimeterM = (2 * (unit.width + unit.height)) / 1000;

    const selectedIds = [
      unit.selectedHandle, unit.selectedGasket, unit.selectedHinge, 
      unit.selectedCorner, unit.selectedLock, unit.selectedAutomation,
      unit.selectedLockStriker, unit.selectedDoorCloser, unit.selectedKickplate,
      unit.selectedOther
    ].filter(Boolean) as string[];

    selectedIds.forEach(id => {
      const acc = accessories.find(a => a.id === id);
      if (!acc) return;

      if (!summary[id]) {
        summary[id] = {
          id: acc.id,
          name: acc.name,
          type: acc.type,
          quantity: 0,
          unit: acc.unit
        };
      }

      if (acc.unit === 'pce') {
        summary[id].quantity += unitQty;
      } else {
        summary[id].quantity += perimeterM * unitQty;
      }
    });
  });

  return Object.values(summary);
};
