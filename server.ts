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

  // Helper for resilient Gemini API content generation with retry & fallback
  const generateWithRetryAndFallback = async (params: {
    contents: any;
    config?: any;
  }) => {
    if (!ai) throw new Error("Gemini API key not configured");
    const modelsToTry = ["gemini-3.5-flash", "gemini-flash-latest"];
    let lastError: any = null;

    for (const model of modelsToTry) {
      let retries = 3;
      let delay = 1000;
      while (retries > 0) {
        try {
          const response = await ai.models.generateContent({
            model,
            ...params
          });
          return response;
        } catch (error: any) {
          lastError = error;
          const errorMsg = error.message || "";
          const isTransient = errorMsg.includes("503") || 
                              errorMsg.includes("UNAVAILABLE") || 
                              errorMsg.includes("Resource exhausted") ||
                              errorMsg.includes("rate limit") ||
                              error.status === 503 ||
                              error.code === 503;
          
          if (isTransient) {
            retries--;
            if (retries > 0) {
              console.warn(`Transient error calling model ${model} (remaining retries: ${retries}): ${errorMsg}. Retrying in ${delay}ms...`);
              await new Promise(resolve => setTimeout(resolve, delay));
              delay *= 2;
              continue;
            }
          }
          break;
        }
      }
    }
    throw lastError || new Error("Failed to generate content with fallback models");
  };

  // Helper to fetch with a timeout
  async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs: number = 3000): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(id);
      return response;
    } catch (error) {
      clearTimeout(id);
      throw error;
    }
  }

  // API Routes for Gemini AI Features
  app.get("/api/tcmb-rates", async (req, res) => {
    // 1. Try TCMB first (Tight 2.5s timeout as government servers can hang when blocking cloud IPs)
    try {
      console.log("Fetching rates from TCMB...");
      const rawTcmbResponse = await fetchWithTimeout("https://www.tcmb.gov.tr/kurlar/today.xml", {
        headers: {
          'Accept': 'application/xml, text/xml',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
        }
      }, 2500);
      
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
      console.warn("TCMB fetch failed or timed out:", err?.message || err);
    }

    // 2. Try ExchangeRate-API V4 (Very rapid and reliable, free, high limit)
    try {
      console.log("Falling back to ExchangeRate-API...");
      const response = await fetchWithTimeout('https://api.exchangerate-api.com/v4/latest/USD', {}, 2500);
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
      const response = await fetchWithTimeout('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json', {}, 2500);
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
      const response = await fetchWithTimeout('https://latest.currency-api.pages.dev/v1/currencies/usd.json', {}, 2500);
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
      const response = await fetchWithTimeout('https://open.er-api.com/v6/latest/USD', {}, 2500);
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
    try {
      const { prompt } = req.body;
      const response = await generateWithRetryAndFallback({
        contents: prompt
      });
      res.json({ text: response.text });
    } catch (error: any) {
      res.status(500).json({ error: error.message || error });
    }
  });

  app.post("/api/ai/analyze-drawing", async (req, res) => {
    try {
      const { base64Data, mimeType, prompt } = req.body;
      
      const imagePart = {
        inlineData: {
          mimeType: mimeType,
          data: base64Data.split(',')[1] || base64Data,
        },
      };

      const response = await generateWithRetryAndFallback({
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
      res.status(500).json({ error: error.message || error });
    }
  });

  app.post("/api/ai/generate-pitch", async (req, res) => {
    try {
      const { prompt } = req.body;
      const response = await generateWithRetryAndFallback({
        contents: prompt
      });
      res.json({ text: response.text });
    } catch (error: any) {
      res.status(500).json({ error: error.message || error });
    }
  });



  // Setup Vite middleware or static serving
  await setupVite(app);

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
