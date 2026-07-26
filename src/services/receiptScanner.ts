import {getAI, getGenerativeModel, GoogleAIBackend, Schema} from 'firebase/ai';

import {firebaseApp} from './firebase';

const responseSchema = Schema.array({
  items: Schema.object({
    properties: {
      name: Schema.string({
        description: 'The name of the item.',
      }),
      quantity: Schema.number({
        description: 'The quantity of this item.',
      }),
      price: Schema.number({
        description: 'The total price for this quantity of the item.',
      }),
    },
  }),
});

const ai = getAI(firebaseApp, {backend: new GoogleAIBackend()});
const receiptModel = getGenerativeModel(ai, {
  model: 'gemini-3.5-flash',
  generationConfig: {
    responseMimeType: 'application/json',
    responseSchema,
    temperature: 0.1,
  },
});

export async function scanReceipt(base64Image: string, mimeType: string) {
  const generationResult = await receiptModel.generateContent([
    {
      inlineData: {
        data: base64Image,
        mimeType,
      },
    },
    'Extract all items, their quantities, and total prices from this food receipt. If a quantity is missing, assume it is 1. Extract exactly as shown.',
  ]);

  const responseText = generationResult.response.text();

  if (!responseText) {
    throw new Error('No output from model.');
  }

  let text = responseText.trim();
  // Strip markdown code block if present
  if (text.startsWith('```json')) {
    text = text.substring(7, text.length - 3).trim();
  } else if (text.startsWith('```')) {
    text = text.substring(3, text.length - 3).trim();
  }

  const parsedResult = JSON.parse(text) as { name: string; quantity?: number; price: number }[];
  return parsedResult;
}
