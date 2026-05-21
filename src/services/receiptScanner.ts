import { GoogleGenAI, Type } from "@google/genai";

export async function scanReceipt(base64Image: string, mimeType: string) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Gemini API Key is missing");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: {
      parts: [
        {
          inlineData: {
            data: base64Image,
            mimeType: mimeType,
          },
        },
        {
          text: "Extract all items, their quantities, and total prices from this food receipt. If a quantity is missing, assume it is 1. Extract exactly as shown.",
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
            quantity: {
              type: Type.NUMBER,
              description: "The quantity of this item.",
            },
            price: {
              type: Type.NUMBER,
              description: "The total price for this quantity of the item.",
            },
          },
          required: ["name", "quantity", "price"],
        },
      },
      temperature: 0.1,
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

  const result = JSON.parse(text) as { name: string; quantity?: number; price: number }[];
  return result;
}
