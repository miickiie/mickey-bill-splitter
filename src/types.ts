export interface Item {
  id: string;
  name: string;
  price: number;
}

export interface Plates {
  white: number;
  red: number;
  silver: number;
  gold: number;
  black: number;
}

export interface Person {
  id: string;
  name: string;
  items: Item[];
  individualDiscount: number;
  plates?: Plates;
}

export interface BillSettings {
  sharedDiscount: number;
  hasServiceCharge: boolean; // 10%
  hasVat: boolean; // 7%
  isSushiroMode?: boolean;
}

export interface CalculationBreakdown {
  subtotal: number;
  totalIndividualDiscounts: number;
  sharedDiscountPerPerson: number;
  totalSharedDiscount: number;
  serviceChargeTotal: number;
  vatTotal: number;
  grandTotal: number;
  peopleTotals: {
    personId: string;
    itemsTotal: number;
    finalShare: number;
  }[];
}
