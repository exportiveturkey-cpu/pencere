import express from "express";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
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
    app.get('*all', (req, res) => {
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
  const ai = apiKey ? new GoogleGenAI({ 
    apiKey,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
  }) : null;

  // API Routes for Gemini AI Features
  app.get("/api/tcmb-rates", async (req, res) => {
    // 1. Try TCMB first
    try {
      console.log("Fetching rates from TCMB...");
      const rawTcmbResponse = await fetch("https://www.tcmb.gov.tr/kurlar/today.xml", {
        headers: {
          'Accept': 'application/xml, text/xml',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
        }
      });
      
      if (rawTcmbResponse.ok) {
        const xml = await rawTcmbResponse.text();
        const getRate = (code: string) => {
          const regex = new RegExp(`<Currency[^>]*?(?:CurrencyCode|Kod)="${code}"[^>]*?>([\\s\\S]*?)<\\/Currency>`, 'i');
          const match = xml.match(regex);
          if (match) {
            const forexBuyingMatch = match[1].match(/<ForexBuying>([\d.]+)<\/ForexBuying>/i);
            if (forexBuyingMatch) {
              return parseFloat(forexBuyingMatch[1]);
            }
          }
          return null;
        };

        const usd = getRate("USD");
        const eur = getRate("EUR");
        const gbp = getRate("GBP");

        if (usd && eur && gbp) {
          return res.json({
            source: "tcmb",
            rates: { USD: usd, EUR: eur, GBP: gbp }
          });
        }
      }
      console.warn("TCMB fetch returned non-ok status or could not be parsed.");
    } catch (err: any) {
      console.warn("TCMB fetch failed:", err?.message || err);
    }

    // 2. Try ExchangeRate-API V4 (Very rapid and reliable, free, high limit)
    try {
      console.log("Falling back to ExchangeRate-API...");
      const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
      if (response.ok) {
        const data = await response.json();
        if (data && data.rates && data.rates.TRY) {
          const tryRate = data.rates.TRY;
          const usdRate = tryRate;
          const eurRate = tryRate / (data.rates.EUR || 0.92);
          const gbpRate = tryRate / (data.rates.GBP || 0.79);
          return res.json({
            source: "exchangerate-api",
            rates: {
              USD: parseFloat(usdRate.toFixed(4)),
              EUR: parseFloat(eurRate.toFixed(4)),
              GBP: parseFloat(gbpRate.toFixed(4))
            }
          });
        }
      }
    } catch (err: any) {
      console.warn("ExchangeRate-API failed:", err?.message || err);
    }

    // 3. Try Fawaz Ahmed's CDN Currency API (Served by jsDelivr, extremely reliable, mirrors of central bank data)
    try {
      console.log("Falling back to jsDelivr Currency API CDN...");
      const response = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json');
      if (response.ok) {
        const data = await response.json();
        if (data && data.usd && data.usd.try) {
          const tryRate = data.usd.try;
          const usdRate = tryRate;
          const eurRate = tryRate / (data.usd.eur || 0.92);
          const gbpRate = tryRate / (data.usd.gbp || 0.79);
          return res.json({
            source: "currency-api-cdn",
            rates: {
              USD: parseFloat(usdRate.toFixed(4)),
              EUR: parseFloat(eurRate.toFixed(4)),
              GBP: parseFloat(gbpRate.toFixed(4))
            }
          });
        }
      }
    } catch (err: any) {
      console.warn("jsDelivr CDN Currency API failed:", err?.message || err);
    }

    // 4. Try Mirror Currency API CDN
    try {
      console.log("Falling back to Mirror Currency API CDN...");
      const response = await fetch('https://latest.currency-api.pages.dev/v1/currencies/usd.json');
      if (response.ok) {
        const data = await response.json();
        if (data && data.usd && data.usd.try) {
          const tryRate = data.usd.try;
          const usdRate = tryRate;
          const eurRate = tryRate / (data.usd.eur || 0.92);
          const gbpRate = tryRate / (data.usd.gbp || 0.79);
          return res.json({
            source: "currency-api-mirror",
            rates: {
              USD: parseFloat(usdRate.toFixed(4)),
              EUR: parseFloat(eurRate.toFixed(4)),
              GBP: parseFloat(gbpRate.toFixed(4))
            }
          });
        }
      }
    } catch (err: any) {
      console.warn("Mirror Currency API CDN failed:", err?.message || err);
    }

    // 5. Try Open Exchange Rates (Fallback)
    try {
      console.log("Falling back to Open ER API...");
      const response = await fetch('https://open.er-api.com/v6/latest/USD');
      if (response.ok) {
        const data = await response.json();
        if (data && data.rates && data.rates.TRY) {
          const tryRate = data.rates.TRY;
          const usdRate = tryRate;
          const eurRate = tryRate / (data.rates.EUR || 0.92);
          const gbpRate = tryRate / (data.rates.GBP || 0.79);
          return res.json({
            source: "global",
            rates: {
              USD: parseFloat(usdRate.toFixed(4)),
              EUR: parseFloat(eurRate.toFixed(4)),
              GBP: parseFloat(gbpRate.toFixed(4))
            }
          });
        }
      }
    } catch (err: any) {
      console.warn("Open ER API failed:", err?.message || err);
    }

    res.status(500).json({ error: "Failed to retrieve rates from TCMB and fallback networks." });
  });

  app.post("/api/ai/analyze-structure", async (req, res) => {
    if (!ai) return res.status(500).json({ error: "Gemini API key not configured" });
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

  app.post("/api/ai/analyze-drawing", async (req, res) => {
    if (!ai) return res.status(500).json({ error: "Gemini API key not configured" });
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

  app.post("/api/ai/generate-pitch", async (req, res) => {
    if (!ai) return res.status(500).json({ error: "Gemini API key not configured" });
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

  // Setup Vite middleware or static serving
  await setupVite(app);

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
