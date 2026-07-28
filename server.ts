import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

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
  app.use(express.json());

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", service: "Soma Web Novel API" });
  });

  // AI Story Companion Endpoint
  app.post("/api/gemini/story-assistant", async (req, res) => {
    try {
      const { prompt, bookTitle, chapterTitle, textContent, language = "en" } = req.body;

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
"${textContent ? textContent.slice(0, 1500) : "N/A"}"

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
    } catch (error: any) {
      console.error("Error calling Gemini API:", error);
      return res.status(500).json({ error: error.message || "Failed to process AI request" });
    }
  });

  // Vite development middleware or static production serving
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
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
