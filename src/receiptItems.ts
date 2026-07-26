export interface ScannedReceiptItem {
  name: string;
  quantity: number;
  price: number;
}

export const MAX_SCANNED_QUANTITY = 100;

const stripMarkdownFence = (value: string) => {
  const match = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(value.trim());
  return match?.[1] ?? value.trim();
};

export function parseReceiptItems(responseText: string): ScannedReceiptItem[] {
  const parsed: unknown = JSON.parse(stripMarkdownFence(responseText));
  if (!Array.isArray(parsed)) {
    throw new Error('Receipt response must be an array.');
  }

  return parsed.map((value, index) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error(`Receipt item ${index + 1} is invalid.`);
    }

    const item = value as Record<string, unknown>;
    const quantity = item.quantity ?? 1;
    if (typeof item.name !== 'string' || item.name.trim().length === 0) {
      throw new Error(`Receipt item ${index + 1} has no name.`);
    }
    if (
      typeof quantity !== 'number'
      || !Number.isInteger(quantity)
      || quantity < 1
      || quantity > MAX_SCANNED_QUANTITY
    ) {
      throw new Error(`Receipt item ${index + 1} has an invalid quantity.`);
    }
    if (typeof item.price !== 'number' || !Number.isFinite(item.price) || item.price < 0) {
      throw new Error(`Receipt item ${index + 1} has an invalid price.`);
    }

    return {
      name: item.name.trim(),
      quantity,
      price: item.price,
    };
  });
}
