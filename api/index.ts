import express from "express";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json({ limit: '50mb' }));

const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
const genAI = apiKey ? new GoogleGenAI(apiKey) : null;

// API Route: Analyze Structure
app.post("/api/ai/analyze-structure", async (req, res) => {
  if (!genAI) return res.status(500).json({ error: "Gemini API key not configured on Vercel" });
  try {
    const { prompt } = req.body;
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    res.json({ text: result.response.text() });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// API Route: Analyze Drawing
app.post("/api/ai/analyze-drawing", async (req, res) => {
  if (!genAI) return res.status(500).json({ error: "Gemini API key not configured on Vercel" });
  try {
    const { base64Data, mimeType, prompt } = req.body;
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const imagePart = {
      inlineData: {
        mimeType: mimeType,
        data: base64Data.split(',')[1] || base64Data,
      },
    };

    const result = await model.generateContent([imagePart, prompt]);
    res.json({ text: result.response.text() });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// API Route: Generate Pitch
app.post("/api/ai/generate-pitch", async (req, res) => {
  if (!genAI) return res.status(500).json({ error: "Gemini API key not configured on Vercel" });
  try {
    const { prompt } = req.body;
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    res.json({ text: result.response.text() });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default app;
