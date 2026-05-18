
import { Unit, ProfileSystem, WindowNode, MachineConfig } from '../types';

export interface CNCCut {
  pos: string;
  profileName: string;
  profileCode: string;
  length: number;
  leftAngle: number;
  rightAngle: number;
  label: string;
  qty: number;
}

/**
 * Extracts raw manufacturing data for CNC output
 */
const getCNCCutsForUnit = (unit: Unit, system: ProfileSystem, posIndex: number): CNCCut[] => {
  const cuts: CNCCut[] = [];
  const config = system.correctionConfig || { sashOverlap: 8, glassClearance: 5, mullionCorrection: 0, frameCornerWelding: 0 };
  const frameWidth = system.frameWidth;

  const addCut = (len: number, label: string, lAngle = 45, rAngle = 45, qty = 1) => {
    cuts.push({
      pos: `POS-${posIndex + 1}`,
      profileName: system.name,
      profileCode: system.cncCode || system.id,
      length: Math.round(len),
      leftAngle: lAngle,
      rightAngle: rAngle,
      label,
      qty
    });
  };

  // 1. Frame
  const frameW = unit.width + (2 * config.frameCornerWelding);
  const frameH = unit.height + (2 * config.frameCornerWelding);
  addCut(frameW, 'Frame Width', 45, 45, 2);
  addCut(frameH, 'Frame Height', 45, 45, 2);

  // 2. Traversal
  const traverse = (node: WindowNode, w: number, h: number) => {
    if (node.type === 'container' && node.children?.length === 2 && node.splitRatio) {
      const isVert = node.direction === 'vertical';
      const rawLength = isVert ? h : w;
      const mullionCutLen = (rawLength - (2 * frameWidth)) + config.mullionCorrection;
      
      addCut(mullionCutLen, isVert ? 'Mullion (Vertical)' : 'Transom (Horizontal)', 90, 90, 1);

      const avail = isVert ? w - frameWidth : h - frameWidth;
      const s1 = avail * node.splitRatio[0];
      const s2 = avail * node.splitRatio[1];

      traverse(node.children[0], isVert ? s1 : w, isVert ? h : s1);
      traverse(node.children[1], isVert ? s2 : w, isVert ? h : s2);
    } else if (node.openingType && node.openingType !== 'fixed') {
      const daylightW = w - (2 * frameWidth);
      const daylightH = h - (2 * frameWidth);
      const sashW = (daylightW + (2 * config.sashOverlap)) + (2 * config.frameCornerWelding);
      const sashH = (daylightH + (2 * config.sashOverlap)) + (2 * config.frameCornerWelding);
      
      addCut(sashW, 'Sash Width', 45, 45, 2);
      addCut(sashH, 'Sash Height', 45, 45, 2);
    }
  };

  traverse(unit.rootNode, unit.width, unit.height);
  return cuts;
};

/**
 * Generates a CNC CSV Job file for machine import
 */
export const generateCNCCSV = (units: Unit[], systems: ProfileSystem[], machine: MachineConfig): string => {
  // Add UTF-8 BOM and sep=; for Excel compatibility with special characters and regional settings
  let csv = "\ufeffsep=;\nJob;Position;Profile;ID;Length;LeftAngle;RightAngle;Label;Quantity\n";
  
  units.forEach((unit, idx) => {
    // Robust system lookup
    let system = systems.find(s => s.id === unit.system);
    if (!system) {
      system = systems.find(s => s.name.toLowerCase().includes(unit.system.toLowerCase()));
    }
    if (!system) {
      system = systems[0];
    }
    
    if (!system) return;
    
    const unitCuts = getCNCCutsForUnit(unit, system, idx);
    const unitQty = unit.quantity || 1;
    
    unitCuts.forEach(cut => {
      // Escape semicolons in labels just in case
      const safeLabel = cut.label.replace(/;/g, ',');
      const safeProfileName = cut.profileName.replace(/;/g, ',');
      
      csv += `CNC-PROD;${cut.pos};${safeProfileName};${cut.profileCode};${cut.length};${cut.leftAngle};${cut.rightAngle};${safeLabel};${cut.qty * unitQty}\n`;
    });
  });
  
  return csv;
};

/**
 * Mock NC Output (Simplified Elumatec Format)
 */
export const generateNCData = (units: Unit[], systems: ProfileSystem[], machine: MachineConfig): string => {
  let nc = `[PROGRAM]\nNAME=ALUMETRIC_CNC_JOB\nMACHINE=${machine.brand}\nDATE=${new Date().toISOString()}\n\n`;
  
  units.forEach((unit, idx) => {
    const system = systems.find(s => s.id === unit.system);
    if (!system) return;
    
    nc += `[POSITION_${idx+1}]\n`;
    nc += `NAME=${unit.name}\n`;
    nc += `SYSTEM=${system.cncCode || system.name}\n`;
    
    const cuts = getCNCCutsForUnit(unit, system, idx);
    cuts.forEach((cut, cIdx) => {
      nc += `CUT_${cIdx+1}=L:${cut.length}|A1:${cut.leftAngle}|A2:${cut.rightAngle}|Q:${cut.qty * (unit.quantity || 1)}\n`;
    });
    nc += `\n`;
  });
  
  return nc;
};
