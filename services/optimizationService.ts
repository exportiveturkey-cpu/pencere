
import { Unit, ProfileSystem, WindowNode } from '../types';

export interface OptimizedBar {
  barLength: number;
  cuts: number[]; // lengths of cuts in this bar
  remaining: number;
}

export interface SystemOptimization {
  systemId: string;
  systemName: string;
  totalBars: number;
  barLength: number; // in mm
  totalEfficiency: number; // percentage
  totalWaste: number; // percentage
  bars: OptimizedBar[];
  totalCutCount: number;
}

export interface CutItem {
  length: number;
  label: string; // e.g. "Frame Width", "Sash Height"
  quantity: number;
  systemName: string;
}

const SAW_BLADE_THICKNESS = 5; // mm waste per cut

// Helper to extract all cut lengths with labels from a unit
// Now uses System Correction Rules!
const extractCuts = (unit: Unit, system: ProfileSystem): { length: number, label: string }[] => {
  const cuts: { length: number, label: string }[] = [];
  
  // Default fallbacks if config is missing (backward compatibility)
  const config = system.correctionConfig || {
      sashOverlap: 6,
      glassClearance: 4,
      mullionCorrection: 0,
      frameCornerWelding: 0
  };

  const frameWidth = system.frameWidth;

  // 1. Outer Frame (2 Widths, 2 Heights)
  // Logic: Nominal Dimension + Welding Allowance (if PVC/Welded)
  const frameW = unit.width + (2 * config.frameCornerWelding);
  const frameH = unit.height + (2 * config.frameCornerWelding);

  cuts.push({ length: frameW, label: 'Frame Width' });
  cuts.push({ length: frameW, label: 'Frame Width' });
  cuts.push({ length: frameH, label: 'Frame Height' });
  cuts.push({ length: frameH, label: 'Frame Height' });

  // 2. Recursive traversal for Mullions and Sashes
  const traverse = (node: WindowNode, w: number, h: number) => {
    // w and h here are the "Daylight Opening" allocated to this node, INCLUDING frame thickness if it's the root.
    // Actually, let's look at how visualizer passes dimensions. It passes the bounding box.
    // So for the root node, w = unit.width, h = unit.height.
    
    if (node.type === 'container' && node.children?.length === 2 && node.splitRatio) {
      const isVert = node.direction === 'vertical';
      
      // MULLION CALCULATION
      // Mullion sits *inside* the frame or container.
      // Logic: Inner Dimension + Connection Correction
      // Inner Dimension = Container Dim - (2 * FrameWidth) if it spans the whole frame.
      // NOTE: This simple recursion assumes mullion spans the entire passed width/height minus frame thickness.
      
      const mullionRawLen = isVert ? h : w;
      // We subtract 2x FrameWidth because mullion is typically mounted between the frames.
      // If this container is nested inside another mullion, this logic gets complex. 
      // Simplified: Assume Mullion connects to outer frame.
      const mullionCutLen = (mullionRawLen - (2 * frameWidth)) + config.mullionCorrection;
      
      const label = isVert ? 'Mullion (Vertical)' : 'Transom (Horizontal)';
      if (mullionCutLen > 0) {
          cuts.push({ length: mullionCutLen, label });
      }

      const avail = isVert ? w - frameWidth : h - frameWidth;
      const s1 = avail * node.splitRatio[0];
      const s2 = avail * node.splitRatio[1];

      traverse(node.children[0], isVert ? s1 : w, isVert ? h : s1);
      traverse(node.children[1], isVert ? s2 : w, isVert ? h : s2);
    } else {
      // Leaf Node - Check for Opening Sash
      if (node.openingType && node.openingType !== 'fixed') {
        // SASH CALCULATION
        // Sash Size = Hole Size + (2 * Overlap)
        // Hole Size = Node Bounding Box - (2 * FrameWidth)
        
        const holeW = w - (2 * frameWidth);
        const holeH = h - (2 * frameWidth);
        
        const sashW = holeW + (2 * config.sashOverlap) + (2 * config.frameCornerWelding);
        const sashH = holeH + (2 * config.sashOverlap) + (2 * config.frameCornerWelding);
        
        if (sashW > 0 && sashH > 0) {
            cuts.push({ length: sashW, label: 'Sash Width' });
            cuts.push({ length: sashW, label: 'Sash Width' });
            cuts.push({ length: sashH, label: 'Sash Height' });
            cuts.push({ length: sashH, label: 'Sash Height' });
        }
      }
    }
  };

  traverse(unit.rootNode, unit.width, unit.height);
  
  return cuts;
};

// 1D Bin Packing - Best Fit Decreasing Algorithm
const optimizeCutsForSystem = (cuts: number[], barLengthMm: number): OptimizedBar[] => {
  // Sort cuts descending
  const sortedCuts = [...cuts].sort((a, b) => b - a);
  const bars: OptimizedBar[] = [];

  for (const cut of sortedCuts) {
    const cutWithKerf = cut + SAW_BLADE_THICKNESS;
    let bestBarIndex = -1;
    let minRemaining = Number.MAX_VALUE;

    // Find best bar that fits this cut
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
      // Add to existing bar
      bars[bestBarIndex].cuts.push(cut);
      bars[bestBarIndex].remaining -= cutWithKerf;
    } else {
      // Create new bar
      if (cutWithKerf > barLengthMm) {
        bars.push({
          barLength: barLengthMm,
          cuts: [cut],
          remaining: 0 
        });
      } else {
        bars.push({
          barLength: barLengthMm,
          cuts: [cut],
          remaining: barLengthMm - cutWithKerf
        });
      }
    }
  }

  return bars;
};

export const calculateProjectOptimization = (units: Unit[], systems: ProfileSystem[]): SystemOptimization[] => {
  const result: SystemOptimization[] = [];

  // Group units by system
  const unitsBySystem: Record<string, Unit[]> = {};
  units.forEach(u => {
    if (!unitsBySystem[u.system]) unitsBySystem[u.system] = [];
    unitsBySystem[u.system].push(u);
  });

  // Process each system
  for (const systemId in unitsBySystem) {
    const systemUnits = unitsBySystem[systemId];
    const system = systems.find(s => s.id === systemId);
    if (!system) continue;

    let allCutLengths: number[] = [];
    
    systemUnits.forEach(u => {
      const unitCuts = extractCuts(u, system);
      const lengths = unitCuts.map(c => c.length);
      for (let i = 0; i < (u.quantity || 1); i++) {
        allCutLengths = [...allCutLengths, ...lengths];
      }
    });

    const barLengthMm = (system.profileLength || 6.0) * 1000;
    const optimizedBars = optimizeCutsForSystem(allCutLengths, barLengthMm);

    const totalUsedLength = optimizedBars.reduce((acc, bar) => acc + (barLengthMm - bar.remaining), 0);
    const totalCapacity = optimizedBars.length * barLengthMm;
    const efficiency = totalCapacity > 0 ? (totalUsedLength / totalCapacity) * 100 : 0;

    result.push({
      systemId: system.id,
      systemName: system.name,
      barLength: barLengthMm,
      totalBars: optimizedBars.length,
      bars: optimizedBars,
      totalEfficiency: efficiency,
      totalWaste: 100 - efficiency,
      totalCutCount: allCutLengths.length
    });
  }

  return result;
};

export const getAggregatedCuttingList = (units: Unit[], systems: ProfileSystem[]): Record<string, CutItem[]> => {
    const listBySystem: Record<string, CutItem[]> = {};

    units.forEach(u => {
        const system = systems.find(s => s.id === u.system);
        if (!system) return;

        const rawCuts = extractCuts(u, system);

        if (!listBySystem[system.name]) {
            listBySystem[system.name] = [];
        }

        for (let i = 0; i < (u.quantity || 1); i++) {
            rawCuts.forEach(cut => {
                const existing = listBySystem[system.name].find(
                    item => Math.abs(item.length - cut.length) < 0.1 && item.label === cut.label
                );

                if (existing) {
                    existing.quantity += 1;
                } else {
                    listBySystem[system.name].push({
                        length: Math.round(cut.length), 
                        label: cut.label,
                        quantity: 1,
                        systemName: system.name
                    });
                }
            });
        }
    });

    Object.keys(listBySystem).forEach(sys => {
        listBySystem[sys].sort((a, b) => b.length - a.length);
    });

    return listBySystem;
};
