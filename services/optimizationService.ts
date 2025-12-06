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

const SAW_BLADE_THICKNESS = 5; // mm waste per cut

// Helper to extract all cut lengths from a unit
const extractCuts = (unit: Unit, system: ProfileSystem): number[] => {
  const cuts: number[] = [];
  const frameWidth = system.frameWidth;

  // 1. Outer Frame (2 Widths, 2 Heights)
  // Simplified: Assuming 45 degree miter cuts, we usually calculate outer dimension
  cuts.push(unit.width);
  cuts.push(unit.width);
  cuts.push(unit.height);
  cuts.push(unit.height);

  // 2. Recursive traversal for Mullions and Sashes
  const traverse = (node: WindowNode, w: number, h: number) => {
    if (node.type === 'container' && node.children?.length === 2 && node.splitRatio) {
      const isVert = node.direction === 'vertical';
      
      // Add Mullion Cut
      // Vertical split means a vertical mullion of height 'h'
      // Horizontal split means a horizontal transom of width 'w'
      // Note: Real logic might subtract frame widths depending on joinery type (butt vs miter)
      // For estimation, we take full length minus frame inset if applicable, 
      // but here we use inner dimension for simplicity or full dimension.
      // Let's use logic: Mullion length is the full span of the split area.
      cuts.push(isVert ? h : w);

      const avail = isVert ? w - frameWidth : h - frameWidth;
      const s1 = avail * node.splitRatio[0];
      const s2 = avail * node.splitRatio[1];

      traverse(node.children[0], isVert ? s1 : w, isVert ? h : s1);
      traverse(node.children[1], isVert ? s2 : w, isVert ? h : s2);
    } else {
      // Leaf Node - Check for Opening Sash
      if (node.openingType && node.openingType !== 'fixed') {
        // Sash Frame (2 Widths + 2 Heights)
        // Sash is usually smaller than the opening. 
        // Approx: Opening Size - (Frame Overlap or Clearance)
        // We'll treat the passed w/h as the sash outer dimension for estimation.
        cuts.push(w);
        cuts.push(w);
        cuts.push(h);
        cuts.push(h);
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
        // Warning: Cut too long for bar, but we add it effectively requiring a special bar or splice
        // For logic sake, we just add a new bar that is theoretically negative or just consume a full bar
        bars.push({
          barLength: barLengthMm,
          cuts: [cut],
          remaining: 0 // consumed fully/overflow
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

    // Collect all cuts for all units in this system (multiply by quantity)
    let allCuts: number[] = [];
    systemUnits.forEach(u => {
      const unitCuts = extractCuts(u, system);
      for (let i = 0; i < (u.quantity || 1); i++) {
        allCuts = [...allCuts, ...unitCuts];
      }
    });

    const barLengthMm = (system.profileLength || 6.0) * 1000;
    const optimizedBars = optimizeCutsForSystem(allCuts, barLengthMm);

    // Calculate stats
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
      totalCutCount: allCuts.length
    });
  }

  return result;
};