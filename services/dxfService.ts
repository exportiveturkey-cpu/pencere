
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
  
  const drawRect = (x: number, y: number, w: number, h: number, layer: string) => {
    // Polylines are efficient for rects
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
       
       // Draw Mullion Profile (Rectangle)
       const mx = isVert ? x + s1 : x;
       const my = isVert ? y : y + s1;
       const mw = isVert ? frameW : w;
       const mh = isVert ? h : frameW;
       
       dxf += drawRect(mx, my, mw, mh, 'FRAME');

       traverse(node.children[0], x, y, isVert ? s1 : w, isVert ? h : s1);
       traverse(node.children[1], isVert ? x + s1 + frameW : x, isVert ? y : y + s1 + frameW, isVert ? s2 : w, isVert ? h : s2);

    } else {
       // Leaf Node
       if (node.type === 'void') {
         // Draw diagonal crossing lines on OPENING layer to indicate void / wall opening
         dxf += `0\nLINE\n8\nOPENING\n10\n${x}\n20\n${-y}\n11\n${x+w}\n21\n${-(y+h)}\n`;
         dxf += `0\nLINE\n8\nOPENING\n10\n${x+w}\n20\n${-y}\n11\n${x}\n21\n${-(y+h)}\n`;
         dxf += drawText(x + w/2, y + h/2, 'BOSLUK (VOID)', 25, 'OPENING');
         return;
       }
       const isOpening = node.openingType && node.openingType !== 'fixed';
       const sashProfileW = 55;
       
       // Calculate Daylight Opening (Hole) inside the allocated space
       const daylightX = x + frameW;
       const daylightY = y + frameW;
       const daylightW = Math.max(0, w - 2*frameW);
       const daylightH = Math.max(0, h - 2*frameW);

       // Note: For triangles/arches, the "Rect" logic here draws essentially the bounding box
       // content. In a real CAD software, we would need to clip this geometry against the parent shape.
       // However, for this output, drawing the rectangular sash inside the conceptual box 
       // is often "good enough" for schematic representation if the outer frame is drawn correctly.
       
       if (isOpening) {
          // OPENING SASH
          const sashOuterX = daylightX - config.sashOverlap;
          const sashOuterY = daylightY - config.sashOverlap;
          const sashOuterW = daylightW + (2 * config.sashOverlap);
          const sashOuterH = daylightH + (2 * config.sashOverlap);
          
          dxf += drawRect(sashOuterX, sashOuterY, sashOuterW, sashOuterH, 'SASH');

          // Glass
          const glassX = sashOuterX + sashProfileW + config.glassClearance;
          const glassY = sashOuterY + sashProfileW + config.glassClearance;
          const glassW = sashOuterW - (2 * (sashProfileW + config.glassClearance));
          const glassH = sashOuterH - (2 * (sashProfileW + config.glassClearance));

          dxf += drawRect(glassX, glassY, glassW, glassH, 'GLASS');
          
       } else {
          // FIXED GLASS
          const glassX = daylightX + config.glassClearance;
          const glassY = daylightY + config.glassClearance;
          const glassW = daylightW - (2 * config.glassClearance);
          const glassH = daylightH - (2 * config.glassClearance);

          dxf += drawRect(glassX, glassY, glassW, glassH, 'GLASS');
       }
    }
  };

  // 1. Draw Global Outer Frame (With Actual Geometry)
  const fw = system.frameWidth;
  
  if (unit.shape === 'triangle') {
      const h = unit.height;
      const w = unit.width;
      
      // Outer Triangle
      const x1 = 0; const y1 = h;
      const x2 = w / 2; const y2 = 0;
      const x3 = w; const y3 = h;
      
      dxf += `0\nLWPOLYLINE\n8\nFRAME\n90\n3\n70\n1\n` + 
           `10\n${x1}\n20\n${-y1}\n` +
           `10\n${x2}\n20\n${-y2}\n` +
           `10\n${x3}\n20\n${-y3}\n`;

      // Inner Triangle (Frame Thickness)
      // Approximate offset logic matching Visualizer
      const halfW = w / 2;
      const sideLen = Math.sqrt(halfW*halfW + h*h);
      const topOffsetY = fw * (sideLen / halfW);
      
      const ix1 = fw; const iy1 = h - fw;
      const ix2 = w / 2; const iy2 = topOffsetY;
      const ix3 = w - fw; const iy3 = h - fw;
      
      dxf += `0\nLWPOLYLINE\n8\nFRAME\n90\n3\n70\n1\n` + 
           `10\n${ix1}\n20\n${-iy1}\n` +
           `10\n${ix2}\n20\n${-iy2}\n` +
           `10\n${ix3}\n20\n${-iy3}\n`;

  } else if (unit.shape === 'arch') {
      const h = unit.height;
      const w = unit.width;
      const archH = unit.archHeight || w/2;
      const legH = h - archH;
      
      const bulge = (Math.abs(archH - w/2) < 1) ? 1 : 0.414;
      
      // Outer Arch
      dxf += `0\nLWPOLYLINE\n8\nFRAME\n90\n4\n70\n1\n` + 
           `10\n0\n20\n${-h}\n` + 
           `10\n0\n20\n${-(h - legH)}\n` + 
           `42\n${bulge}\n` + 
           `10\n${w}\n20\n${-(h - legH)}\n` + 
           `10\n${w}\n20\n${-h}\n`;
           
      // Inner Arch
      const innerLegH = legH - fw;
      // Bulge roughly stays same for semicircle parallel offset
      
      dxf += `0\nLWPOLYLINE\n8\nFRAME\n90\n4\n70\n1\n` + 
           `10\n${fw}\n20\n${-(h-fw)}\n` + 
           `10\n${fw}\n20\n${-(h - innerLegH - fw)}\n` + 
           `42\n${bulge}\n` + 
           `10\n${w-fw}\n20\n${-(h - innerLegH - fw)}\n` + 
           `10\n${w-fw}\n20\n${-(h-fw)}\n`;

  } else {
      // Standard Rect
      dxf += drawRect(0, 0, unit.width, unit.height, 'FRAME');
      dxf += drawRect(fw, fw, unit.width - 2*fw, unit.height - 2*fw, 'FRAME');
  }

  // 2. Start Recursion (Note: Children will be drawn as Rects overlapping the frame boundary in DXF for complex shapes)
  // Ideally we would clip them in CAD logic, but simply drawing them inside the Bounding Box is standard for simple generators.
  traverse(unit.rootNode, 0, 0, unit.width, unit.height);

  // 3. Dimensions
  const dimTextH = Math.min(unit.width, unit.height) / 25;
  dxf += drawText(unit.width / 2, -100, `${unit.width} mm`, dimTextH, 'DIM'); 
  dxf += drawText(-100, unit.height / 2, `${unit.height} mm`, dimTextH, 'DIM'); 

  // Label
  dxf += drawText(unit.width / 2, unit.height + 150, `${unit.name} - ${system.name}`, dimTextH, 'DIM');

  dxf += `0\nENDSEC\n0\nEOF\n`;
  return dxf;
};
