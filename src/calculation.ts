import type {
  BillSettings,
  CalculationBreakdown,
  Item,
  Person,
  Plates,
} from './types';

const PLATE_PRICES: Record<keyof Plates, number> = {
  white: 30,
  red: 40,
  silver: 60,
  gold: 80,
  black: 100,
};

interface EffectiveItem {
  price: number;
  noDiscount: boolean;
  noServiceCharge: boolean;
  noVat: boolean;
}

interface PersonContext {
  items: EffectiveItem[];
  discountableSubtotal: number;
  gross: number;
  serviceCharge: number;
  vat: number;
  discountCapacity: number;
}

export const sanitizeNonNegativeNumber = (value: number, maximum = Number.POSITIVE_INFINITY) => {
  if (!Number.isFinite(value)) return 0;
  return Math.min(maximum, Math.max(0, value));
};

const toEffectiveItem = (item: Item, divisor = 1): EffectiveItem => ({
  price: sanitizeNonNegativeNumber(item.price) / divisor,
  noDiscount: item.excludeDiscount === true,
  noServiceCharge: item.excludeServiceCharge === true,
  noVat: item.excludeVat === true,
});

const getPlateTotal = (person: Person) => {
  if (!person.plates) return 0;

  return (Object.keys(PLATE_PRICES) as (keyof Plates)[]).reduce(
    (total, color) => (
      total + (sanitizeNonNegativeNumber(person.plates?.[color] ?? 0) * PLATE_PRICES[color])
    ),
    0,
  );
};

const calculateGrossItem = (item: EffectiveItem, settings: BillSettings) => {
  const serviceCharge = settings.hasServiceCharge && !item.noServiceCharge
    ? item.price * 0.1
    : 0;
  const vat = settings.hasVat && !item.noVat
    ? (item.price + serviceCharge) * 0.07
    : 0;

  return {
    gross: item.price + serviceCharge + vat,
    serviceCharge,
    vat,
  };
};

export function calculateBill(
  people: Person[],
  sharedItems: Item[],
  settings: BillSettings,
): CalculationBreakdown {
  const memberCount = people.length || 1;
  const isAfterDiscount = settings.discountTiming === 'after';
  const effectiveSharedItems = sharedItems.map(item => toEffectiveItem(item, memberCount));

  const contexts: PersonContext[] = people.map((person) => {
    const plateTotal = settings.isSushiroMode ? getPlateTotal(person) : 0;
    const items = [
      ...person.items.map(item => toEffectiveItem(item)),
      ...(plateTotal > 0
        ? [{
            price: plateTotal,
            noDiscount: false,
            noServiceCharge: false,
            noVat: false,
          }]
        : []),
      ...effectiveSharedItems,
    ];

    let discountableSubtotal = 0;
    let gross = 0;
    let nonDiscountableGross = 0;
    let serviceCharge = 0;
    let vat = 0;

    items.forEach((item) => {
      if (!item.noDiscount) discountableSubtotal += item.price;

      const grossItem = calculateGrossItem(item, settings);
      gross += grossItem.gross;
      serviceCharge += grossItem.serviceCharge;
      vat += grossItem.vat;
      if (item.noDiscount) nonDiscountableGross += grossItem.gross;
    });

    return {
      items,
      discountableSubtotal,
      gross,
      serviceCharge,
      vat,
      discountCapacity: isAfterDiscount
        ? gross - nonDiscountableGross
        : discountableSubtotal,
    };
  });

  const subtotal = contexts.reduce(
    (total, context) => total + context.items.reduce((sum, item) => sum + item.price, 0),
    0,
  );
  const globalDiscountableSubtotal = contexts.reduce(
    (total, context) => total + context.discountableSubtotal,
    0,
  );

  const appliedIndividualDiscounts = contexts.map((context, index) => (
    Math.min(
      sanitizeNonNegativeNumber(people[index]?.individualDiscount ?? 0),
      context.discountCapacity,
    )
  ));
  const remainingDiscountCapacities = contexts.map(
    (context, index) => context.discountCapacity - appliedIndividualDiscounts[index],
  );
  const totalRemainingDiscountCapacity = remainingDiscountCapacities.reduce(
    (total, capacity) => total + capacity,
    0,
  );

  const sharedDiscountInput = sanitizeNonNegativeNumber(settings.sharedDiscount);
  const requestedSharedDiscount = settings.sharedDiscountType === 'percentage'
    ? globalDiscountableSubtotal * (Math.min(sharedDiscountInput, 100) / 100)
    : sharedDiscountInput;
  const totalSharedDiscount = Math.min(
    requestedSharedDiscount,
    totalRemainingDiscountCapacity,
  );
  const sharedDiscounts = remainingDiscountCapacities.map(capacity => (
    totalRemainingDiscountCapacity > 0
      ? totalSharedDiscount * (capacity / totalRemainingDiscountCapacity)
      : 0
  ));

  let serviceChargeTotal = 0;
  let vatTotal = 0;
  let grandTotal = 0;

  const peopleTotals = contexts.map((context, index) => {
    const appliedDiscount = appliedIndividualDiscounts[index] + sharedDiscounts[index];
    let finalShare = 0;

    if (isAfterDiscount) {
      finalShare = context.gross - appliedDiscount;
      serviceChargeTotal += context.serviceCharge;
      vatTotal += context.vat;
    } else {
      const discountRatio = context.discountableSubtotal > 0
        ? (context.discountableSubtotal - appliedDiscount) / context.discountableSubtotal
        : 1;

      context.items.forEach((item) => {
        const discountedItem: EffectiveItem = {
          ...item,
          price: item.noDiscount ? item.price : item.price * discountRatio,
        };
        const grossItem = calculateGrossItem(discountedItem, settings);
        finalShare += grossItem.gross;
        serviceChargeTotal += grossItem.serviceCharge;
        vatTotal += grossItem.vat;
      });
    }

    grandTotal += finalShare;
    return {
      personId: people[index].id,
      finalShare,
    };
  });

  const sharedItemsTotal = sharedItems.reduce(
    (total, item) => total + sanitizeNonNegativeNumber(item.price),
    0,
  );

  return {
    subtotal,
    sharedItemsTotal,
    sharedItemPerPerson: sharedItemsTotal / memberCount,
    totalIndividualDiscounts: appliedIndividualDiscounts.reduce(
      (total, discount) => total + discount,
      0,
    ),
    totalSharedDiscount,
    serviceChargeTotal,
    vatTotal,
    grandTotal,
    peopleTotals,
  };
}
