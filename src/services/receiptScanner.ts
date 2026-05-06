import { GoogleGenAI, Type } from "@google/genai";

export async function scanReceipt(base64Image: string, mimeType: string) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Gemini API Key is missing");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-2.5-pro",
    contents: {
      parts: [
        {
          inlineData: {
            data: base64Image,
            mimeType: mimeType,
          },
        },
        {
          text: "Extract all items and their prices from this food receipt. Include each item exactly as shown on the receipt.",
        },
      ],
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: {
              type: Type.STRING,
              description: "The name of the item.",
            },
            price: {
              type: Type.NUMBER,
              description: "The price of the item.",
            },
          },
          required: ["name", "price"],
        },
      },
    },
  });

  if (!response.text) {
    throw new Error("No output from model.");
  }

  let text = response.text.trim();
  // Strip markdown code block if present
  if (text.startsWith("```json")) {
    text = text.substring(7, text.length - 3).trim();
  } else if (text.startsWith("```")) {
    text = text.substring(3, text.length - 3).trim();
  }

  const result = JSON.parse(text) as { name: string; price: number }[];
  return result;
}
