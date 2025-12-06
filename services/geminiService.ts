import { GoogleGenAI } from "@google/genai";
import { Unit, ProfileSystem, Language } from '../types';

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key not found");
  return new GoogleGenAI({ apiKey });
};

export const analyzeStructure = async (unit: Unit, system: ProfileSystem, lang: Language): Promise<string> => {
  try {
    const ai = getAiClient();
    const prompt = `
      As a structural engineer for aluminium fenestration, analyze this window unit.
      
      Input Data:
      - Dimensions: ${unit.width}mm x ${unit.height}mm.
      - System: ${system.name} (Frame Width: ${system.frameWidth}mm).
      - Glass: ${unit.glassType}.
      - Configuration: Recursive splits / sash openings.
      
      Task:
      1. Calculate approximate wind load surface area.
      2. Check if the ${system.name} is generally suitable for these dimensions.
      3. Recommend reinforcement if necessary.
      4. Provide a brief technical safety summary.
      
      IMPORTANT: Provide the response in ${lang === 'tr' ? 'TURKISH' : 'ENGLISH'}.
      Keep it professional, concise, and technical.
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
