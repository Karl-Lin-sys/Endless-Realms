import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // In-memory request limiter / basic checks could go here

  app.post("/api/story", async (req, res) => {
    try {
      const { history, inventory, quest, action } = req.body;

      // Construct a single prompt based on the state and user action
      // Or we can pass the entire conversation.
      // Easiest is to format history as text, or send as contents array.
      const contents = history.map((msg: any) => ({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.text }],
      }));

      contents.push({
        role: "user",
        parts: [
          {
            text: `CURRENT STATE:
Inventory: ${inventory.join(", ") || "Empty"}
Current Quest: ${quest || "None"}

USER ACTION: ${action}

INSTRUCTIONS:
You are an infinite text-based choose-your-own-adventure game engine acting as the narrator. 
Based on the USER ACTION, determine what happens next. The user's choices must genuinely alter the plot.
If the user acquires or loses items, update the inventory.
If the user completes their quest or receives a new one, update the current quest.
Generate a cohesive narrative.
Also, generate an \`imagePrompt\` for the current scene. It MUST end with "Style: Retro highly detailed watercolor fantasy art, 2D RPG style background." so we can generate consistent artwork.

Respond strictly with valid JSON.`,
          },
        ],
      });

      const response = await ai.models.generateContent({
        // Instruction says to use gemini-3.1-flash-lite for tasks that should happen fast.
        // It's a text adventure engine and should feel snappy!
        model: "gemini-3.1-flash-lite",
        contents,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              story: {
                type: Type.STRING,
                description: "The next part of the story narrative.",
              },
              inventory: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "The updated list of items the player is carrying.",
              },
              quest: {
                type: Type.STRING,
                description: "The current active quest the player is on.",
              },
              imagePrompt: {
                type: Type.STRING,
                description: "A highly descriptive prompt for the current scene.",
              },
            },
            required: ["story", "inventory", "quest", "imagePrompt"],
          },
        },
      });

      const text = response.text || "{}";
      const data = JSON.parse(text);

      res.json(data);
    } catch (error) {
      console.error("Story generation error:", error);
      res.status(500).json({ error: "Failed to generate story." });
    }
  });

  app.post("/api/image", async (req, res) => {
    try {
      const { prompt, size } = req.body;
      
      // Map user choice to supported sizes
      const imageSize = ["512px", "1K", "2K", "4K"].includes(size) ? size : "1K";

      const response = await ai.models.generateContent({
        // Instruction says MUST use gemini-3-pro-image-preview
        model: "gemini-3-pro-image-preview",
        contents: {
          parts: [
            {
              text: prompt,
            },
          ],
        },
        config: {
          // @ts-ignore
          imageConfig: {
            aspectRatio: "16:9",
            imageSize: imageSize,
          },
        },
      });

      let base64Image = null;
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          base64Image = part.inlineData.data;
          break;
        }
      }

      if (!base64Image) {
        throw new Error("No image data returned from model.");
      }

      res.json({ imageBase64: base64Image });
    } catch (error) {
      console.error("Image generation error:", error);
      res.status(500).json({ error: "Failed to generate image." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
