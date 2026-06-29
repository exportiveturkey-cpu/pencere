
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
      Perform an expert engineering extraction on this technical plan, joinery list, elevation or schedule.
      Detect all window (pencere) and door (kapı) units. Follow these rules for maximum accuracy:
      1. LOCATE NAME/LABEL: Scan for round/square tags or text labels nearby such as W-01, Poz-1, Poz-2, D-01, Door-2, K-1, P-1.
      2. DETECT DIMENSIONS (WIDTH & HEIGHT):
         - Find dimension markers or numbers (e.g. "90/220", "150 x 150", "1500x1600").
         - Format is always Width x Height. Horizontal is width, vertical is height.
         - CONVERT TO MILLIMETERS (mm): If numbers are in centimeters (like 90, 150, 220) or meters (like 1.5, 2.2), scale them to millimeters (e.g., convert 150 to 1500, 220 to 2200).
      3. DETERMINE OPENING TYPE:
         - Triangle drawing corner vertices/hinges -> 'turn-left', 'turn-right', 'tilt', 'tilt-turn-left', or 'tilt-turn-right'.
         - Horizontal arrows -> 'sliding'.
         - Empty/no icons inside panel -> 'fixed'.

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
