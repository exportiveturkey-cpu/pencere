
import { Unit, ProfileSystem, WindowNode } from '../types';

/**
 * Basic DXF Generator
 * Generates a minimal DXF R2010 file with standard layers.
 */
export const generateDXF = (unit: Unit, system: ProfileSystem): string => {
  let dxf = "";
  
  // Get Correction Rules or Defaults
  const config = system.correctionConfig || {
      sashOverlap: 6,
      glassClearance: 4,
      mullionCorrection: 0,
      frameCornerWelding: 0
  };
  
  // --- HEADER & TABLES ---
  dxf += `0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1024\n0\nENDSEC\n`;
  
  dxf += `0\nSECTION\n2\nTABLES\n`;
  dxf += `0\nTABLE\n2\nLAYER\n70\n5\n`;
  
  // Layer Definitions
  // Name, Flags, Color (1=Red, 2=Yellow, 3=Green, 4=Cyan, 5=Blue, 7=White/Black)
  const addLayer = (name: string, color: number) => {
      dxf += `0\nLAYER\n2\n${name}\n70\n0\n62\n${color}\n6\nCONTINUOUS\n0\n`;
  };
  
  addLayer('FRAME', 7);   // White
  addLayer('SASH', 4);    // Cyan
  addLayer('GLASS', 5);   // Blue
  addLayer('OPENING', 1); // Red
  addLayer('DIM', 2);     // Yellow
  
  dxf += `0\nENDTAB\n0\nENDSEC\n`;

  // --- ENTITIES ---
  dxf += `0\nSECTION\n2\nENTITIES\n`;

  // --- Geometry Helpers ---
  // In CAD, Y usually points UP. In web, Y points DOWN.
  // We flip Y (-y) to make it upright in CAD.
  
  const drawLine = (x1: number, y1: number, x2: number, y2: number, layer: string) => {
    return `0\nLINE\n8\n${layer}\n` +
           `10\n${x1}\n20\n${-y1}\n30\n0\n` +
           `11\n${x2}\n21\n${-y2}\n31\n0\n`;
  };

  const drawRect = (x: number, y: number, w: number, h: number, layer: string) => {
    // Polylines are efficient for rects
    // 10,20 = Start
    return `0\nLWPOLYLINE\n8\n${layer}\n90\n4\n70\n1\n` + 
           `10\n${x}\n20\n${-y}\n` +
           `10\n${x+w}\n20\n${-y}\n` +
           `10\n${x+w}\n20\n${-(y+h)}\n` +
           `10\n${x}\n20\n${-(y+h)}\n`;
  };

  const drawText = (x: number, y: number, text: string, height: number, layer: string) => {
      return `0\nTEXT\n8\n${layer}\n` +
             `10\n${x}\n20\n${-y}\n30\n0\n` +
             `40\n${height}\n1\n${text}\n` +
             `72\n4\n11\n${x}\n21\n${-y}\n31\n0\n`; // 72=4 Middle Center alignment
  };

  // --- Recursive Drawing Logic ---
  const traverse = (node: WindowNode, x: number, y: number, w: number, h: number) => {
    const frameW = system.frameWidth;
    
    if (node.type === 'container' && node.children && node.children.length === 2 && node.splitRatio) {
       const isVert = node.direction === 'vertical';
       
       const avail = isVert ? w - frameW : h - frameW;
       const s1 = avail * node.splitRatio[0];
       const s2 = avail * node.splitRatio[1];
       
       // Draw Mullion Profile
       const mx = isVert ? x + s1 : x;
       const my = isVert ? y : y + s1;
       const mw = isVert ? frameW : w;
       const mh = isVert ? h : frameW;
       
       dxf += drawRect(mx, my, mw, mh, 'FRAME');

       traverse(node.children[0], x, y, isVert ? s1 : w, isVert ? h : s1);
       traverse(node.children[1], isVert ? x + s1 + frameW : x, isVert ? y : y + s1 + frameW, isVert ? s2 : w, isVert ? h : s2);

    } else {
       // Leaf Node
       // The x,y,w,h passed here represents the Allocated "Bounding Box" for this leaf.
       // This INCLUDES the frame width if it is at the edge.
       
       const isOpening = node.openingType && node.openingType !== 'fixed';
       const sashProfileW = 55; // Sash profile width approximation
       
       // Calculate Daylight Opening (Hole) inside the allocated space
       const daylightX = x + frameW;
       const daylightY = y + frameW;
       const daylightW = Math.max(0, w - 2*frameW);
       const daylightH = Math.max(0, h - 2*frameW);

       if (isOpening) {
          // OPENING SASH
          // The Sash overlaps the frame. 
          // Sash Outer = Daylight + 2 * Overlap
          // Position relative to daylight: X - Overlap, Y - Overlap
          
          const sashOuterX = daylightX - config.sashOverlap;
          const sashOuterY = daylightY - config.sashOverlap;
          const sashOuterW = daylightW + (2 * config.sashOverlap);
          const sashOuterH = daylightH + (2 * config.sashOverlap);
          
          // 1. Sash Outer Frame (The moving part)
          dxf += drawRect(sashOuterX, sashOuterY, sashOuterW, sashOuterH, 'SASH');

          // 2. Sash Inner Frame (Glass Bead Line)
          // Inner Frame = Outer Frame - 2 * SashProfileWidth
          const sashInnerX = sashOuterX + sashProfileW;
          const sashInnerY = sashOuterY + sashProfileW;
          const sashInnerW = sashOuterW - (2 * sashProfileW);
          const sashInnerH = sashOuterH - (2 * sashProfileW);
          
          dxf += drawRect(sashInnerX, sashInnerY, sashInnerW, sashInnerH, 'SASH');
          
          // 3. Glass
          // Glass sits inside sash with clearance
          const glassX = sashInnerX + config.glassClearance;
          const glassY = sashInnerY + config.glassClearance;
          const glassW = sashInnerW - (2 * config.glassClearance);
          const glassH = sashInnerH - (2 * config.glassClearance);

          dxf += drawRect(glassX, glassY, glassW, glassH, 'GLASS');
          
          // 4. Opening Symbols (Lines)
          const midX = sashOuterX + sashOuterW/2;
          const midY = sashOuterY + sashOuterH/2;
          
          // Helper for opening lines - drawn on the sash inner frame for visibility
          const symX = sashInnerX;
          const symY = sashInnerY;
          const symW = sashInnerW;
          const symH = sashInnerH;

          const dl = (x1: number, y1: number, x2: number, y2: number) => drawLine(x1, y1, x2, y2, 'OPENING');
          
          switch (node.openingType) {
              case 'turn-left':
                  dxf += dl(symX, symY, symX + symW, midY);
                  dxf += dl(symX, symY + symH, symX + symW, midY);
                  break;
              case 'turn-right':
                  dxf += dl(symX + symW, symY, symX, midY);
                  dxf += dl(symX + symW, symY + symH, symX, midY);
                  break;
              case 'tilt':
                  dxf += dl(symX, symY + symH, midX, symY);
                  dxf += dl(symX + symW, symY + symH, midX, symY);
                  break;
              case 'tilt-turn-left':
                   // Turn
                  dxf += dl(symX, symY, symX + symW, midY);
                  dxf += dl(symX, symY + symH, symX + symW, midY);
                  // Tilt
                  dxf += dl(symX, symY + symH, midX, symY);
                  dxf += dl(symX + symW, symY + symH, midX, symY);
                  break;
              case 'tilt-turn-right':
                  dxf += dl(symX + symW, symY, symX, midY);
                  dxf += dl(symX + symW, symY + symH, symX, midY);
                  dxf += dl(symX, symY + symH, midX, symY);
                  dxf += dl(symX + symW, symY + symH, midX, symY);
                  break;
               case 'sliding':
                  // Arrow
                  const arrowY = midY;
                  dxf += dl(midX - 100, arrowY, midX + 100, arrowY);
                  dxf += dl(midX + 70, arrowY - 30, midX + 100, arrowY);
                  dxf += dl(midX + 70, arrowY + 30, midX + 100, arrowY);
                  break;
          }
       } else {
          // FIXED GLASS
          // Sits directly in frame (Allocated Space - FrameWidth)
          const glassX = daylightX + config.glassClearance;
          const glassY = daylightY + config.glassClearance;
          const glassW = daylightW - (2 * config.glassClearance);
          const glassH = daylightH - (2 * config.glassClearance);

          dxf += drawRect(glassX, glassY, glassW, glassH, 'GLASS');
       }
    }
  };

  // 1. Draw Global Outer Frame
  dxf += drawRect(0, 0, unit.width, unit.height, 'FRAME');

  // 2. Start Recursion
  traverse(unit.rootNode, 0, 0, unit.width, unit.height);

  // 3. Dimensions
  const dimTextH = Math.min(unit.width, unit.height) / 25;
  dxf += drawText(unit.width / 2, -100, `${unit.width} mm`, dimTextH, 'DIM'); // Width
  
  dxf += drawText(-100, unit.height / 2, `${unit.height} mm`, dimTextH, 'DIM'); // Height

  // Label
  dxf += drawText(unit.width / 2, unit.height + 150, `${unit.name} - ${system.name}`, dimTextH, 'DIM');

  dxf += `0\nENDSEC\n0\nEOF\n`;
  return dxf;
};
