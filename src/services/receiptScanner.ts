import { GoogleGenAI, Type } from "@google/genai";

export async function scanReceipt(base64Image: string, mimeType: string) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
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

  const result = JSON.parse(response.text.trim()) as { name: string; price: number }[];
  return result;
}
