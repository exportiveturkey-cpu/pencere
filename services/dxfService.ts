import { Unit, ProfileSystem, WindowNode } from '../types';

/**
 * Basic DXF Generator
 * Generates a minimal DXF R2010 file with standard layers.
 */
export const generateDXF = (unit: Unit, system: ProfileSystem): string => {
  let dxf = "";
  
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
       const isOpening = node.openingType && node.openingType !== 'fixed';
       const sashW = 55; // Sash profile width approximation
       
       // Inner frame hole (Glass or Sash sits here)
       // The parent traversal logic essentially moves x,y to the inner edge of the mullions, 
       // but for the outer frame boundaries we need to offset by frameWidth.
       // Note: This coordinate logic is simplified for visualization.
       
       // Correction: The x,y,w,h passed here represents the "Daylight opening + Frame" space allocated.
       // We draw the "Inner Frame" lines here if not already drawn by container. 
       // But simpler approach: Visualizer draws outer frame once. 
       // We will draw sash/glass inside the passed bounding box, assuming outer frame is handled globally or by container.
       
       // Inner Daylight Coordinates (Inside the fixed frame)
       const fX = x + frameW;
       const fY = y + frameW;
       const fW = Math.max(0, w - 2*frameW);
       const fH = Math.max(0, h - 2*frameW);

       if (isOpening) {
          // 1. Sash Outer Frame
          dxf += drawRect(fX, fY, fW, fH, 'SASH');
          // 2. Sash Inner Frame (Glass Bead)
          dxf += drawRect(fX + sashW, fY + sashW, fW - 2*sashW, fH - 2*sashW, 'SASH');
          
          // 3. Glass
          dxf += drawRect(fX + sashW + 4, fY + sashW + 4, fW - 2*sashW - 8, fH - 2*sashW - 8, 'GLASS');
          
          // 4. Opening Symbols (Lines)
          const midX = fX + fW/2;
          const midY = fY + fH/2;
          
          // Helper for opening lines
          const dl = (x1: number, y1: number, x2: number, y2: number) => drawLine(x1, y1, x2, y2, 'OPENING');
          
          switch (node.openingType) {
              case 'turn-left':
                  dxf += dl(fX, fY, fX + fW, midY);
                  dxf += dl(fX, fY + fH, fX + fW, midY);
                  break;
              case 'turn-right':
                  dxf += dl(fX + fW, fY, fX, midY);
                  dxf += dl(fX + fW, fY + fH, fX, midY);
                  break;
              case 'tilt':
                  dxf += dl(fX, fY + fH, midX, fY);
                  dxf += dl(fX + fW, fY + fH, midX, fY);
                  break;
              case 'tilt-turn-left':
                   // Turn
                  dxf += dl(fX, fY, fX + fW, midY);
                  dxf += dl(fX, fY + fH, fX + fW, midY);
                  // Tilt (simple rep)
                  dxf += dl(fX, fY + fH, midX, fY);
                  dxf += dl(fX + fW, fY + fH, midX, fY);
                  break;
              case 'tilt-turn-right':
                  dxf += dl(fX + fW, fY, fX, midY);
                  dxf += dl(fX + fW, fY + fH, fX, midY);
                  dxf += dl(fX, fY + fH, midX, fY);
                  dxf += dl(fX + fW, fY + fH, midX, fY);
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
          // Fixed Glass
          dxf += drawRect(fX, fY, fW, fH, 'GLASS');
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
  
  // Height dimension rotated 90 deg is harder in basic DXF text entities without advanced group codes, 
  // so we just place it to the side for now.
  dxf += drawText(-100, unit.height / 2, `${unit.height} mm`, dimTextH, 'DIM'); // Height

  // Label
  dxf += drawText(unit.width / 2, unit.height + 150, `${unit.name} - ${system.name}`, dimTextH, 'DIM');

  dxf += `0\nENDSEC\n0\nEOF\n`;
  return dxf;
};