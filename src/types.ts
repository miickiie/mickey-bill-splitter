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
  sharedDiscountType?: 'amount' | 'percentage';
  discountTiming?: 'before' | 'after';
  hasServiceCharge: boolean; // 10%
  hasVat: boolean; // 7%
  isSushiroMode?: boolean;
  splitScanItemsByQuantity?: boolean;
}

export interface CalculationBreakdown {
  subtotal: number;
  sharedItemsTotal: number;
  sharedItemPerPerson: number;
  totalIndividualDiscounts: number;
  sharedDiscountPerPerson: number;
  totalSharedDiscount: number;
  serviceChargeTotal: number;
  vatTotal: number;
  grandTotal: number;
  peopleTotals: {
    personId: string;
    itemsTotal: number;
    individualItemsTotal: number;
    sharedItemsShare: number;
    finalShare: number;
  }[];
}
