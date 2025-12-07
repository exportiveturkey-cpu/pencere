import { GoogleGenAI } from "@google/genai";
import { Unit, ProfileSystem, Language, WindowNode } from '../types';

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key not found");
  return new GoogleGenAI({ apiKey });
};

const describeNode = (node: WindowNode): string => {
  if (node.type === 'container' && node.children) {
    const childrenDesc = node.children.map(describeNode).join(', ');
    return `Split ${node.direction} (Ratios: ${node.splitRatio?.join(':')}) containing [${childrenDesc}]`;
  }
  return `Leaf panel (Opening: ${node.openingType || 'fixed'})`;
};

export const analyzeStructure = async (unit: Unit, system: ProfileSystem, lang: Language): Promise<string> => {
  try {
    const ai = getAiClient();
    
    const structureDescription = describeNode(unit.rootNode);
    const areaM2 = (unit.width * unit.height / 1000000).toFixed(2);
    
    const prompt = `
      As a senior façade engineer and aluminium joinery expert, perform a detailed structural and functional analysis of this window/door unit.

      --- TECHNICAL SPECIFICATIONS ---
      Dimensions: ${unit.width}mm Width x ${unit.height}mm Height (Total Area: ${areaM2} m²)
      Quantity: ${unit.quantity} units
      
      Profile System: ${system.name}
      - Frame Depth/Width: ${system.frameWidth}mm
      - Thermal Insulation (Uf): ${system.uValue} W/m²K
      
      Glazing:
      - Type: ${unit.glassType}
      - Thickness: ${unit.glassThickness}mm
      
      Configuration Structure:
      ${structureDescription}
      
      Accessories Selected:
      - Handle: ${unit.selectedHandle || 'Standard'}
      - Hinges: ${unit.selectedHinge || 'Standard'}
      
      --- ANALYSIS TASKS ---
      1. **Static & Structural Integrity**: 
         - Evaluate if the ${system.frameWidth}mm profile is structurally sufficient for these dimensions under standard wind loads.
         - Check height-to-width ratios for opening sashes. Are they within safe limits (usually max 1:2 or 2:1)?
      
      2. **Glazing Safety Check**:
         - Verify if ${unit.glassThickness}mm glass thickness is adequate for the pane sizes involved.
         - Recommend safety glass (tempered/laminated) if appropriate (e.g. large areas or floor-level).

      3. **Functional Feasibility**:
         - assess if the operating sashes are too heavy or large for standard hardware.
         - Identify potential operation clashes in the recursive split configuration.

      4. **Engineering Recommendations**:
         - Suggest specific reinforcement (Ix values in cm⁴) if the statics appear weak.
         - Suggest heavy-duty hinges or additional locking points if needed.

      --- OUTPUT FORMAT ---
      Provide the response in ${lang === 'tr' ? 'TURKISH' : 'ENGLISH'}.
      Use professional engineering terminology.
      Format with clear **Bold Headings** and bullet points.
      Do not output generic marketing text; focus on engineering validation.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "Analysis failed.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return lang === 'tr' ? "YZ Analizi yapılamadı." : "AI Analysis unavailable.";
  }
};

export const generateSalesPitch = async (project: {name: string, client: string}, units: Unit[], lang: Language): Promise<string> => {
  try {
    const ai = getAiClient();
    const unitSummaries = units.map(u => `${u.width}x${u.height}mm ${u.system}`).join(', ');
    
    const prompt = `
      Write a professional cover letter/intro for a quotation for aluminium windows.
      Client: ${project.client}
      Project: ${project.name}
      Units Included: ${units.length} units (${unitSummaries})
      
      Tone: Professional, assuring high quality, energy efficiency, and modern design.
      Highlight the durability of aluminium and the thermal properties.
      
      IMPORTANT: Provide the response in ${lang === 'tr' ? 'TURKISH' : 'ENGLISH'}.
      Output format: Plain text suitable for an email or PDF header.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "Description generation failed.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return lang === 'tr' ? "Açıklama oluşturulamadı." : "AI Description unavailable.";
  }
};