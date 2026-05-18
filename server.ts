import express from "express";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Vite middleware for development (conditionally loaded)
async function setupVite(app: express.Express) {
  if (process.env.NODE_ENV !== "production") {
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
      console.log("Vite middleware loaded");
    } catch (e) {
      console.warn("Vite not found, skipping middleware (this is expected in production)");
    }
  } else {
    // Serve static files in production
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Use JSON body parser with a higher limit for images/PDFs
  app.use(express.json({ limit: '50mb' }));

  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  const genAI = apiKey ? new GoogleGenAI(apiKey) : null;

  // API Routes for Gemini AI Features
  app.post("/api/ai/analyze-structure", async (req, res) => {
    if (!genAI) return res.status(500).json({ error: "Gemini API key not configured" });
    try {
      const { prompt } = req.body;
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent(prompt);
      res.json({ text: result.response.text() });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/ai/analyze-drawing", async (req, res) => {
    if (!genAI) return res.status(500).json({ error: "Gemini API key not configured" });
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

  app.post("/api/ai/generate-pitch", async (req, res) => {
    if (!genAI) return res.status(500).json({ error: "Gemini API key not configured" });
    try {
      const { prompt } = req.body;
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent(prompt);
      res.json({ text: result.response.text() });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Setup Vite middleware or static serving
  await setupVite(app);

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
