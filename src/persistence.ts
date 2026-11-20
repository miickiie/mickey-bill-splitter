import type { BillSettings, Item, Person, Plates } from './types';

export const BILL_STATE_STORAGE_KEY = 'bill-splitter-state-v2';
const BILL_HISTORY_KEY_PREFIX = 'bill-splitter-history:';

export interface StoredBillState {
  people: Person[];
  sharedItems: Item[];
  settings: BillSettings;
}

export interface BillDraft extends StoredBillState {
  billId: string;
}

export interface SavedBill {
  billId: string;
  savedAt: number;
  state: StoredBillState;
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

  const individualDiscountType = value.individualDiscountType === 'percentage' ? 'percentage' : 'amount';

  return {
    id: value.id,
    name: value.name,
    items: items as Item[],
    individualDiscount: individualDiscountType === 'percentage'
      ? Math.min(individualDiscount, 100)
      : individualDiscount,
    individualDiscountType,
    ...(plates ? { plates } : {}),
  };
};

const parseSettings = (value: unknown): BillSettings | null => {
  if (!isRecord(value)) return null;

  const sharedDiscount = asNonNegativeNumber(value.sharedDiscount);
  if (sharedDiscount === null) return null;

  const sharedDiscountType = value.sharedDiscountType === 'percentage' ? 'percentage' : 'amount';
  const serviceChargeRate = asNonNegativeNumber(value.serviceChargeRate);
  const vatRate = asNonNegativeNumber(value.vatRate);

  return {
    sharedDiscount: sharedDiscountType === 'percentage'
      ? Math.min(sharedDiscount, 100)
      : sharedDiscount,
    sharedDiscountType,
    discountTiming: value.discountTiming === 'after' ? 'after' : 'before',
    hasServiceCharge: value.hasServiceCharge === true,
    serviceChargeRate: serviceChargeRate ?? 10,
    hasVat: value.hasVat === true,
    vatRate: vatRate ?? 7,
    isSushiroMode: value.isSushiroMode === true,
    splitScanItemsByQuantity: value.splitScanItemsByQuantity !== false,
  };
};

const readJson = (raw: string | null): unknown => {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const parseBillState = (value: unknown): StoredBillState | null => {
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
    !people.every(person => person !== null)
    || !sharedItems.every(item => item !== null)
    || settings === null
  ) {
    return null;
  }

  return { people, sharedItems, settings };
};

export function parseStoredBillState(rawState: string | null): StoredBillState | null {
  return parseBillState(readJson(rawState));
}

export function readBillDraft(storage: Storage): (StoredBillState & { billId?: string }) | null {
  const value = readJson(storage.getItem(BILL_STATE_STORAGE_KEY));
  if (!isRecord(value)) return null;

  const state = parseBillState(value);
  if (!state) return null;
  return typeof value.billId === 'string' && value.billId
    ? { ...state, billId: value.billId }
    : state;
}

export function saveBillDraft(storage: Storage, draft: BillDraft): void {
  storage.setItem(BILL_STATE_STORAGE_KEY, JSON.stringify(draft));
}

export function archiveBill(storage: Storage, draft: BillDraft): void {
  const { billId, ...state } = draft;
  storage.setItem(
    BILL_HISTORY_KEY_PREFIX + billId,
    JSON.stringify({ savedAt: Date.now(), state }),
  );
}

export function readBillHistory(storage: Storage): SavedBill[] {
  const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index));
  return keys.flatMap(key => {
    if (!key?.startsWith(BILL_HISTORY_KEY_PREFIX)) return [];
    const billId = key.slice(BILL_HISTORY_KEY_PREFIX.length);
    const value = readJson(storage.getItem(key));
    if (!billId || !isRecord(value) || typeof value.savedAt !== 'number') return [];
    if (!Number.isFinite(new Date(value.savedAt).getTime())) return [];

    const state = parseBillState(value.state);
    return state ? [{ billId, savedAt: value.savedAt, state }] : [];
  }).sort((first, second) => second.savedAt - first.savedAt);
}
