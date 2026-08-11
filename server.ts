import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const configuredPort = Number.parseInt(process.env.PORT ?? "", 10);
const PORT = Number.isInteger(configuredPort) && configuredPort > 0 && configuredPort <= 65535
  ? configuredPort
  : 3000;
const CONTENT_SECURITY_POLICY = "default-src 'self'; script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com https://pagead2.googlesyndication.com https://*.googlesyndication.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co https://generativelanguage.googleapis.com; frame-src https://*.googlesyndication.com https://googleads.g.doubleclick.net; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests";

let aiClient: GoogleGenAI | null = null;
function getAiClient() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      aiClient = new GoogleGenAI({ apiKey });
    }
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  app.disable("x-powered-by");
  app.use((_req, res, next) => {
    res.set({
      "Content-Security-Policy": CONTENT_SECURITY_POLICY,
      "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
    });
    next();
  });
  app.use(express.json({ limit: "32kb" }));

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", service: "Soma Web Novel API" });
  });

  // AI Story Companion Endpoint
  app.post("/api/gemini/story-assistant", async (req, res) => {
    try {
      const body = req.body as Record<string, unknown> | null;
      if (!body || typeof body.prompt !== "string") {
        return res.status(400).json({ error: "A text prompt is required." });
      }

      const prompt = body.prompt.trim();
      if (!prompt || prompt.length > 4000) {
        return res.status(400).json({ error: "Prompt must contain between 1 and 4000 characters." });
      }

      const bookTitle = typeof body.bookTitle === "string" ? body.bookTitle.slice(0, 300) : "Unknown";
      const chapterTitle = typeof body.chapterTitle === "string" ? body.chapterTitle.slice(0, 300) : "General";
      const textContent = typeof body.textContent === "string" ? body.textContent.slice(0, 1500) : "N/A";
      const language = body.language === "sw" ? "sw" : "en";

      const ai = getAiClient();
      if (!ai) {
        return res.status(503).json({
          error: "Gemini API key is not configured in environment variables."
        });
      }

      const systemInstruction = `You are Soma Assistant, an intelligent, culturally insightful reading companion for Soma - East Africa's leading web novel platform.
You excel at summarizing chapters, explaining cultural references (such as East African locations, Kiswahili proverbs, Nairobi culture, Swahili trade history), answering plot questions, and offering literary insights in either English or Kiswahili as requested.
Always maintain a helpful, warm, and engaging tone.`;

      const formattedPrompt = `
Book Title: ${bookTitle || "Unknown"}
Chapter: ${chapterTitle || "General"}
User Language Preference: ${language === "sw" ? "Kiswahili" : "English"}

Chapter Excerpt Context:
"${textContent}"

User Question/Request:
${prompt}
`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: formattedPrompt,
        config: {
          systemInstruction,
          temperature: 0.7,
        },
      });

      return res.json({ result: response.text });
    } catch (error: unknown) {
      console.error("Error calling Gemini API:", error);
      return res.status(500).json({ error: "Failed to process AI request." });
    }
  });

  // Static serving for compiled assets & public files
  const distPath = path.join(process.cwd(), "dist");
  app.use(express.static(path.join(process.cwd(), "public")));

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Soma Server] Running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
