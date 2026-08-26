
import { Unit, ProfileSystem, Language, WindowNode } from '../types';

// Helper to describe window structure for engineering analysis
const describeNode = (node: WindowNode): string => {
  if (node.type === 'container' && node.children) {
    const childrenDesc = node.children.map(describeNode).join(', ');
    return `Split ${node.direction} (Ratios: ${node.splitRatio?.join(':')}) containing [${childrenDesc}]`;
  }
  return `Leaf panel (Opening: ${node.openingType || 'fixed'})`;
};

/**
 * Performs structural analysis using Gemini via server API.
 */
export const analyzeStructure = async (unit: Unit, system: ProfileSystem, lang: Language): Promise<string> => {
  try {
    const structureDescription = describeNode(unit.rootNode);
    
    const prompt = `
      As a senior façade engineer and aluminium joinery expert, perform a detailed structural and functional analysis.
      Dimensions: ${unit.width}mm x ${unit.height}mm
      System: ${system.name} (${system.frameWidth}mm)
      Structure: ${structureDescription}
      Glazing: ${unit.glassType} (${unit.glassThickness}mm)
      
      Provide analysis in ${lang === 'tr' ? 'TURKISH' : 'ENGLISH'}.
    `;

    const response = await fetch("/api/ai/analyze-structure", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      let errorMsg = "Server error";
      try {
        const err = await response.json();
        errorMsg = err.error || errorMsg;
      } catch (e) {
        // Not a JSON error
      }
      throw new Error(errorMsg);
    }

    const data = await response.json();
    return data.text || "No analysis provided.";
  } catch (error: any) {
    console.error("Analysis failed:", error);
    throw error;
  }
};

/**
 * Automatically detects windows/doors from a technical drawing image or PDF via server API.
 */
export const analyzeDrawing = async (base64Data: string, mimeType: string, lang: Language): Promise<any[]> => {
  try {
    const prompt = `
      Perform an expert engineering extraction on this technical plan, joinery list, elevation or hand sketch.
      Detect all window (pencere) and door (kapı) units. Follow these critical engineering rules for maximum precision:

      1. UNIT IDENTIFICATION & COMPOSITE WINDOW RECOGNITION (CRITICAL):
         - A continuous outer rectangular frame is ONE SINGLE UNIT / POZ (e.g. W-01, Poz-1, P-01).
         - IF A FRAME IS DIVIDED INTERNALLY by horizontal transoms (yatay kayıt) or vertical mullions (düşey kayıt):
           * DO NOT break it into multiple separate units/poz! It is ONE UNIT with the overall total outer width and overall total outer height.
           * Set "isSplit": true.
           * For top/bottom divisions (transom, vasistas + main sash): set "splitDirection": "horizontal". List each pane in "panes" from top to bottom with its dimension (height) and opening type.
             Example: An outer frame of 2000mm width and 1500mm height with a 500mm top fixed pane (+) and 1000mm bottom turn-left opening pane:
             { "name": "W-01", "width": 2000, "height": 1500, "type": "turn-left", "isSplit": true, "splitDirection": "horizontal", "panes": [{ "name": "Üst Sabit", "openingType": "fixed", "dimension": 500 }, { "name": "Alt Açılır", "openingType": "turn-left", "dimension": 1000 }] }
           * For left/right divisions (double sash, side fixed + opening sash): set "splitDirection": "vertical". List each pane in "panes" from left to right with its dimension (width) and opening type.
             Example: An outer frame of 2000mm width and 1400mm height with two 1000mm sashes:
             { "name": "W-01", "width": 2000, "height": 1400, "type": "turn-left", "isSplit": true, "splitDirection": "vertical", "panes": [{ "name": "Sol Kanat", "openingType": "turn-left", "dimension": 1000 }, { "name": "Sağ Kanat", "openingType": "tilt-turn-right", "dimension": 1000 }] }

      2. LOCATE LABELS / NAMES:
         - Scan for round/square tags or text labels nearby such as W-01, Poz-1, Poz-2, D-01, Door-2, K-1, P-1. If not labeled, generate Poz-01, Poz-02, etc.

      3. PRECISE DIMENSIONS (WIDTH & HEIGHT IN MM):
         - Find outer dimension lines and numbers.
         - Format is Width x Height (Genişlik x Yükseklik).
         - If segment dimensions are given (e.g. 500mm and 1000mm on the side), sum them to compute total outer height (1500mm).
         - CONVERT ALL NUMBERS TO MILLIMETERS (mm): If numbers are in centimeters (like 90, 150, 200) or meters (like 1.5, 2.0), scale to millimeters (1500, 2000).

      4. ARCHITECTURAL OPENING SYMBOLS:
         - "+" or cross or blank/empty pane -> 'fixed' (Sabit Cam).
         - Triangle with vertex on left edge / arrow pointing left -> 'turn-left'.
         - Triangle with vertex on right edge / arrow pointing right -> 'turn-right'.
         - Triangle with base at bottom and apex at top (tilt/bottom-hung transom) -> 'tilt'.
         - Combined double triangle (turn + tilt lines) -> 'tilt-turn-left' or 'tilt-turn-right'.
         - Horizontal arrows -> 'sliding' (Sürme).

      Return a clean list of extracted items matching the required JSON schema.
    `;

    const response = await fetch("/api/ai/analyze-drawing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ base64Data, mimeType, prompt }),
    });

    if (!response.ok) {
      let errorMsg = "Server error";
      try {
        const err = await response.json();
        errorMsg = err.error || errorMsg;
      } catch (e) {
        if (response.status === 413) {
          errorMsg = lang === 'tr'
            ? "Dosya boyutu çok büyük (Maksimum 4.5MB). Lütfen daha küçük bir dosya yükleyin veya PDF yerine sıkıştırılmış bir görsel yükleyin."
            : "File size too large (Vercel limit 4.5MB). Please upload a smaller file or a compressed image instead of a large PDF.";
        } else {
          errorMsg = `Server error (${response.status}): ${response.statusText}`;
        }
      }
      throw new Error(errorMsg);
    }

    const data = await response.json();
    const cleanText = data.text.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(cleanText || "[]");
    return Array.isArray(result) ? result : [];
  } catch (error: any) {
    console.error("Vision analysis failed:", error);
    throw error;
  }
};

/**
 * Generates sales pitch using Gemini via server API.
 */
export const generateSalesPitch = async (project: {name: string, client: string}, units: Unit[], lang: Language): Promise<string> => {
  try {
    const unitSummaries = units.map(u => `${u.width}x${u.height}mm ${u.system}`).join(', ');
    
    const prompt = `
      Write a professional cover letter for an aluminium window quotation.
      Client: ${project.client}, Project: ${project.name}
      Units: ${units.length} items (${unitSummaries})
      Language: ${lang === 'tr' ? 'TURKISH' : 'ENGLISH'}
    `;

    const response = await fetch("/api/ai/generate-pitch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      let errorMsg = "Server error";
      try {
        const err = await response.json();
        errorMsg = err.error || errorMsg;
      } catch (e) {
        // Not a JSON error
      }
      throw new Error(errorMsg);
    }

    const data = await response.json();
    return data.text || "";
  } catch (error: any) {
    console.error("Pitch generation failed:", error);
    throw error;
  }
};

/**
 * Performs architectural analysis of house facade and offers shading placements using Gemini via server API.
 */
export interface ShadingRecommendation {
  productType: 'rolling-roof' | 'bioclimatic-pergola' | 'zip-blind' | 'awning' | 'guillotine' | 'glass-balcony';
  name: string;
  suggestedWidth: number;
  suggestedHeight: number;
  suggestedDepth?: number;
  suggestedColor: string;
  explanation: string;
  estimatedSqmPrice: number;
}

export interface ShadingAnalysisResult {
  architecturalReview: string;
  recommendations: ShadingRecommendation[];
  salesPitch: string;
  suggestedPolygonPoints?: { x: number, y: number }[];
}

export const analyzeShadingImage = async (
  base64Data: string, 
  mimeType: string, 
  lang: Language,
  polygonPoints?: { x: number, y: number }[],
  productType?: string,
  color?: string,
  notes?: string
): Promise<ShadingAnalysisResult> => {
  try {
    const response = await fetch("/api/ai/analyze-shading", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ base64Data, mimeType, lang, polygonPoints, productType, color, notes }),
    });

    if (!response.ok) {
      let errorMsg = "Server error";
      try {
        const err = await response.json();
        errorMsg = err.error || errorMsg;
      } catch (e) {
        if (response.status === 413) {
          errorMsg = lang === 'tr'
            ? "Dosya boyutu çok büyük (Maksimum 4.5MB). Lütfen daha küçük bir dosya yükleyin."
            : "File size too large (Vercel limit 4.5MB). Please upload a smaller file.";
        } else {
          errorMsg = `Server error (${response.status}): ${response.statusText}`;
        }
      }
      throw new Error(errorMsg);
    }

    const data = await response.json();
    const result: ShadingAnalysisResult = JSON.parse(data.text);
    return result;
  } catch (error: any) {
    console.error("Shading vision analysis failed:", error);
    throw error;
  }
};
