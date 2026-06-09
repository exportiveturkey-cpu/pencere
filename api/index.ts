import express from "express";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json({ limit: '50mb' }));

const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
const ai = apiKey ? new GoogleGenAI({ 
  apiKey,
  httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
}) : null;

// API Route: Analyze Structure
app.post("/api/ai/analyze-structure", async (req, res) => {
  if (!ai) return res.status(500).json({ error: "Gemini API key not configured on Vercel" });
  try {
    const { prompt } = req.body;
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt
    });
    res.json({ text: response.text });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// API Route: Analyze Drawing
app.post("/api/ai/analyze-drawing", async (req, res) => {
  if (!ai) return res.status(500).json({ error: "Gemini API key not configured on Vercel" });
  try {
    const { base64Data, mimeType, prompt } = req.body;
    
    const imagePart = {
      inlineData: {
        mimeType: mimeType,
        data: base64Data.split(',')[1] || base64Data,
      },
    };

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: { parts: [imagePart, { text: prompt }] },
      config: {
        systemInstruction: "You are an expert façade engineering assistant specialized in extracting high-accuracy window and door schedule data from technical drawings, joinery schedules, and architectural plan images or PDFs. Your goal is to deliver clean, precise dimensions in millimeters and identify correct opening types based on standardized drafting symbols.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: {
                type: Type.STRING,
                description: "Unique label of the item, e.g., 'W-01', 'Poz-1', 'Kapı K-2', 'Poz-3'",
              },
              width: {
                type: Type.INTEGER,
                description: "Exact width of the unit in millimeters (mm). If the drawing uses centimeters (e.g., 150) or meters (e.g., 1.5), multiply/convert to millimeters (e.g., 1500).",
              },
              height: {
                type: Type.INTEGER,
                description: "Exact height of the unit in millimeters (mm). If the drawing uses centimeters (e.g., 220) or meters (e.g., 2.2), multiply/convert to millimeters (e.g., 2200).",
              },
              type: {
                type: Type.STRING,
                description: "The opening type classification. Must strictly match one of: 'fixed', 'turn-left', 'turn-right', 'tilt', 'tilt-turn-left', 'tilt-turn-right', 'sliding'. Detect from architectural symbols.",
              }
            },
            required: ["name", "width", "height", "type"]
          }
        }
      }
    });
    res.json({ text: response.text });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// API Route: Generate Pitch
app.post("/api/ai/generate-pitch", async (req, res) => {
  if (!ai) return res.status(500).json({ error: "Gemini API key not configured on Vercel" });
  try {
    const { prompt } = req.body;
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt
    });
    res.json({ text: response.text });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default app;
