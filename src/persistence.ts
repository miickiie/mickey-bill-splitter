import type { BillSettings, Item, Person, Plates } from './types';

export const BILL_STATE_STORAGE_KEY = 'bill-splitter-state-v2';

export interface StoredBillState {
  people: Person[];
  sharedItems: Item[];
  settings: BillSettings;
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const asNonNegativeNumber = (value: unknown) => (
  typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, value)
    : null
);

const asNonNegativeInteger = (value: unknown) => {
  const number = asNonNegativeNumber(value);
  return number === null ? null : Math.floor(number);
};

const parseItem = (value: unknown): Item | null => {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string') {
    return null;
  }

  const price = asNonNegativeNumber(value.price);
  if (price === null) return null;

  return {
    id: value.id,
    name: value.name,
    price,
    excludeDiscount: value.excludeDiscount === true,
    excludeServiceCharge: value.excludeServiceCharge === true,
    excludeVat: value.excludeVat === true,
  };
};

const parsePlates = (value: unknown): Plates | undefined | null => {
  if (value === undefined) return undefined;
  if (!isRecord(value)) return null;

  const white = asNonNegativeInteger(value.white);
  const red = asNonNegativeInteger(value.red);
  const silver = asNonNegativeInteger(value.silver);
  const gold = asNonNegativeInteger(value.gold);
  const black = asNonNegativeInteger(value.black);

  if ([white, red, silver, gold, black].some(count => count === null)) return null;
  return {
    white: white!,
    red: red!,
    silver: silver!,
    gold: gold!,
    black: black!,
  };
};

const parsePerson = (value: unknown): Person | null => {
  if (
    !isRecord(value)
    || typeof value.id !== 'string'
    || typeof value.name !== 'string'
    || !Array.isArray(value.items)
  ) {
    return null;
  }

  const items = value.items.map(parseItem);
  const individualDiscount = asNonNegativeNumber(value.individualDiscount);
  const plates = parsePlates(value.plates);
  if (items.some(item => item === null) || individualDiscount === null || plates === null) {
    return null;
  }

  return {
    id: value.id,
    name: value.name,
    items: items as Item[],
    individualDiscount,
    ...(plates ? { plates } : {}),
  };
};

const parseSettings = (value: unknown): BillSettings | null => {
  if (!isRecord(value)) return null;

  const sharedDiscount = asNonNegativeNumber(value.sharedDiscount);
  if (sharedDiscount === null) return null;

  const sharedDiscountType = value.sharedDiscountType === 'percentage' ? 'percentage' : 'amount';

  return {
    sharedDiscount: sharedDiscountType === 'percentage'
      ? Math.min(sharedDiscount, 100)
      : sharedDiscount,
    sharedDiscountType,
    discountTiming: value.discountTiming === 'after' ? 'after' : 'before',
    hasServiceCharge: value.hasServiceCharge === true,
    hasVat: value.hasVat === true,
    isSushiroMode: value.isSushiroMode === true,
    splitScanItemsByQuantity: value.splitScanItemsByQuantity !== false,
  };
};

export function parseStoredBillState(rawState: string | null): StoredBillState | null {
  if (!rawState) return null;

  try {
    const value: unknown = JSON.parse(rawState);
    if (
      !isRecord(value)
      || !Array.isArray(value.people)
      || value.people.length === 0
      || !Array.isArray(value.sharedItems)
    ) {
      return null;
    }

    const people = value.people.map(parsePerson);
    const sharedItems = value.sharedItems.map(parseItem);
    const settings = parseSettings(value.settings);
    if (
      people.some(person => person === null)
      || sharedItems.some(item => item === null)
      || settings === null
    ) {
      return null;
    }

    return {
      people: people as Person[],
      sharedItems: sharedItems as Item[],
      settings,
    };
  } catch {
    return null;
  }
}
