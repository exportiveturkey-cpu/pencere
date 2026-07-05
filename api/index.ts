import express from "express";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json({ limit: '50mb' }));

const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.pergola || process.env.PERGOLA;
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
  const modelsToTry = [
    "gemini-2.5-flash",
    "gemini-2.5-pro",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-1.5-pro",
    "gemini-3.5-flash"
  ];
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

// API Route: TCMB and Fallback Exchange Rates
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

// API Route: Analyze Structure
app.post("/api/ai/analyze-structure", async (req, res) => {
  try {
    const { prompt } = req.body;
    const response = await generateWithRetryAndFallback({
      contents: prompt
    });
    res.json({ text: response.text });
  } catch (error: any) {
    console.error("API error in analyze-structure:", error);
    res.status(500).json({ error: error.message || error });
  }
});

// API Route: Analyze Drawing
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
    console.error("API error in analyze-drawing:", error);
    res.status(500).json({ error: error.message || error });
  }
});

// API Route: Generate Pitch
app.post("/api/ai/generate-pitch", async (req, res) => {
  try {
    const { prompt } = req.body;
    const response = await generateWithRetryAndFallback({
      contents: prompt
    });
    res.json({ text: response.text });
  } catch (error: any) {
    console.error("API error in generate-pitch:", error);
    res.status(500).json({ error: error.message || error });
  }
});// API Route: Analyze Shading
app.post("/api/ai/analyze-shading", async (req, res) => {
  try {
    const { base64Data, mimeType, lang, polygonPoints, productType, color, notes } = req.body;

    const imagePart = {
      inlineData: {
        mimeType: mimeType || "image/jpeg",
        data: base64Data.split(',')[1] || base64Data,
      },
    };

    const prompt = `
      Perform an expert architectural and façade engineering analysis of this house facade or patio area for shading installation.
      
      User Selection Info (if any):
      - Selected shading product type: ${productType || 'Any / None selected'}
      - Selected color: ${color || 'Any / None selected'}
      - User notes/request: ${notes || 'None'}
      - Language: ${lang === 'tr' ? 'Turkish' : 'English'}
 
      Please identify the architectural style, potential obstacles (windows, doors, gutters), and recommend suitable shading systems (like rolling-roof, bioclimatic-pergola, zip-blind, awning, guillotine, glass-balcony).
      
      Generate exactly 4 coordinates in percentage (%) for "suggestedPolygonPoints" (x from 0 to 100, y from 0 to 100) representing the 4 corners (top-left, top-right, bottom-right, bottom-left) of the main suggested shading system (e.g. pergola or awning) on the facade image, respecting the depth and perspective of the walls and ground. Place them nicely where a pergola/awning would naturally fit in the center or front yard/patio.
    `;

    const response = await generateWithRetryAndFallback({
      contents: { parts: [imagePart, { text: prompt }] },
      config: {
        systemInstruction: "You are an expert outdoor shading, pergola, and awning design system intelligence. Your task is to analyze the user's facade/patio image, suggest high-end architectural shading configurations, formulate professional sales pitches, and calculate perspective corners in % coordinates where the product can overlay perfectly.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            architecturalReview: {
              type: Type.STRING,
              description: "A professional design review of the facade layout, lighting, materials, and challenges in the requested language."
            },
            recommendations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  productType: {
                    type: Type.STRING,
                    description: "Must strictly be one of: 'rolling-roof', 'bioclimatic-pergola', 'zip-blind', 'awning', 'guillotine', 'glass-balcony'"
                  },
                  name: {
                    type: Type.STRING,
                    description: "Beautiful product line title in the requested language (e.g., 'Premium Bioclimatic Pergola')"
                  },
                  suggestedWidth: {
                    type: Type.INTEGER,
                    description: "Suggested width in millimeters (e.g., 4000)"
                  },
                  suggestedHeight: {
                    type: Type.INTEGER,
                    description: "Suggested height in millimeters (e.g., 2500)"
                  },
                  suggestedDepth: {
                    type: Type.INTEGER,
                    description: "Suggested depth in millimeters (e.g., 3000)"
                  },
                  suggestedColor: {
                    type: Type.STRING,
                    description: "Perfect color recommendation based on the facade color palette (e.g., 'RAL 7016 Anthracite Gray')"
                  },
                  explanation: {
                    type: Type.STRING,
                    description: "Explanation of why this product fits perfectly in the requested language."
                  },
                  estimatedSqmPrice: {
                    type: Type.INTEGER,
                    description: "Estimated base price per square meter in currency units."
                  }
                },
                required: ["productType", "name", "suggestedWidth", "suggestedHeight", "suggestedColor", "explanation", "estimatedSqmPrice"]
              }
            },
            salesPitch: {
              type: Type.STRING,
              description: "An elegant, highly compelling sales pitch for the client in the requested language, pointing out how this transforms their outdoor space and adds property value."
            },
            suggestedPolygonPoints: {
              type: Type.ARRAY,
              description: "Four polygon coordinate points in percent (0 to 100) representing top-left, top-right, bottom-right, bottom-left corners of the proposed system on the photo perspective.",
              items: {
                type: Type.OBJECT,
                properties: {
                  x: {
                    type: Type.INTEGER,
                    description: "X coordinate in % of image width (0 to 100)"
                  },
                  y: {
                    type: Type.INTEGER,
                    description: "Y coordinate in % of image height (0 to 100)"
                  }
                },
                required: ["x", "y"]
              }
            }
          },
          required: ["architecturalReview", "recommendations", "salesPitch", "suggestedPolygonPoints"]
        }
      }
    });

    res.json({ text: response.text });
  } catch (error: any) {
    console.error("API error in analyze-shading:", error);
    res.status(500).json({ error: error.message || error });
  }
});

export default app;
