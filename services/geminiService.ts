
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
      Analyze this technical drawing/architectural plan (image or PDF). Extract all window and door units.
      For each unit identified, provide:
      - name: (e.g., W-01, D-02)
      - width: (in mm, only number)
      - height: (in mm, only number)
      - type: (fixed, turn-left, turn-right, tilt, tilt-turn-left, tilt-turn-right, or sliding)

      Return ONLY a JSON array of objects. Example: [{"name": "W-01", "width": 1200, "height": 1500, "type": "tilt-turn-left"}]
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
