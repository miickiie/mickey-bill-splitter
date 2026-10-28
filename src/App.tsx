import { useState, useMemo, useEffect, useRef, useCallback, type ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Trash2, 
  Users, 
  Receipt, 
  Settings2, 
  UserPlus, 
  ReceiptText,
  Check,
  X,
  Share2,
  Copy,
  Camera,
  QrCode,
  Phone,
  ArrowLeft,
  Download,
  UtensilsCrossed,
  Instagram
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Person, Item, BillSettings, Plates } from './types';
import generatePayload from 'promptpay-qr';
import { QRCodeCanvas } from 'qrcode.react';
import { usePwaLifecycle } from './hooks/usePwaLifecycle';
import { calculateBill, sanitizeNonNegativeNumber } from './calculation';
import { BILL_STATE_STORAGE_KEY, parseStoredBillState } from './persistence';
import { shouldReplaceStarterPerson } from './people';
import { CalculatorKeypad } from './components/CalculatorKeypad';
import { ItemRow } from './components/ItemRow';
import { SushiroPlateSelector } from './components/SushiroPlateSelector';

let cachedConfetti: typeof import('canvas-confetti') | null = null;

const INITIAL_PLATES: Plates = {
  white: 0,
  red: 0,
  silver: 0,
  gold: 0,
  black: 0
};

const INITIAL_SETTINGS: BillSettings = {
  sharedDiscount: 0,
  sharedDiscountType: 'amount',
  discountTiming: 'before',
  hasServiceCharge: false,
  serviceChargeRate: 10,
  hasVat: false,
  vatRate: 7,
  isSushiroMode: false,
  splitScanItemsByQuantity: true,
};

const MAX_RECEIPT_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_SCANNED_UNITS = 200;

interface WindowWithTelegramHaptics extends Window {
  Telegram?: {
    WebApp?: {
      HapticFeedback?: {
        impactOccurred: (style: 'light') => void;
        notificationOccurred: (type: 'success') => void;
      };
    };
  };
}

interface ActiveKeypadState {
  id: string;
  title: string;
  initialValue: number;
  unit: '฿' | '%';
  max?: number;
  onConfirm: (val: number) => void;
}

const readFileAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.addEventListener('load', () => {
    if (typeof reader.result === 'string') {
      resolve(reader.result);
    } else {
      reject(new Error('Receipt image could not be read.'));
    }
  });
  reader.addEventListener('error', () => {
    reject(reader.error ?? new Error('Receipt image could not be read.'));
  });
  reader.readAsDataURL(file);
});

const loadInitialBillState = () => {
  if (typeof window === 'undefined') return null;

  try {
    return parseStoredBillState(localStorage.getItem(BILL_STATE_STORAGE_KEY));
  } catch (error) {
    console.error('Failed to read saved state', error);
    return null;
  }
};

const vibrate = (pattern: number | number[]) => {
  // Check for Telegram WebApp HapticFeedback as fallback for iOS
  const hapticFeedback = typeof window === 'undefined'
    ? undefined
    : (window as WindowWithTelegramHaptics).Telegram?.WebApp?.HapticFeedback;
  if (hapticFeedback) {
    try {
      if (Array.isArray(pattern) && pattern.length > 2) {
        hapticFeedback.notificationOccurred('success');
      } else {
        hapticFeedback.impactOccurred('light');
      }
      return;
    } catch {}
  }

  // Standard Web Vibration API (Not supported by Apple on iOS Safari)
  if (typeof window !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {}
  }
};

export default function App() {
  const { t, i18n } = useTranslation();
  const {
    installOffer,
    requestInstall,
    dismissInstall,
    updateAvailable,
    updateInProgress,
    updateError,
    applyUpdate,
    dismissUpdate,
  } = usePwaLifecycle();
  
  const [initialBillState] = useState(loadInitialBillState);
  const [people, setPeople] = useState<Person[]>(() => (
    initialBillState?.people ?? [
      {
        id: '1',
        name: t('personDefaultName'),
        items: [],
        individualDiscount: 0,
        plates: { ...INITIAL_PLATES },
      },
    ]
  ));
  const [sharedItems, setSharedItems] = useState<Item[]>(
    () => initialBillState?.sharedItems ?? [],
  );
  const [settings, setSettings] = useState<BillSettings>(
    () => initialBillState?.settings ?? { ...INITIAL_SETTINGS },
  );
  const latestBillStateRef = useRef({ people, sharedItems, settings });
  latestBillStateRef.current = { people, sharedItems, settings };
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('bill-splitter-theme');
      if (saved) return saved === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });
  const [showCopied, setShowCopied] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [currentView, setCurrentView] = useState<'main' | 'qr'>('main');
  const [promptPayId, setPromptPayId] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('bill-splitter-promptpay-id') || '';
    }
    return '';
  });
  const [selectedPersonForQR, setSelectedPersonForQR] = useState<string>(() => initialBillState?.people?.[0]?.id ?? '1');
  const [copiedQRId, setCopiedQRId] = useState<string | null>(null);
  const [focusTargetItemId, setFocusTargetItemId] = useState<string | null>(null);
  const [expandedItemOptionsId, setExpandedItemOptionsId] = useState<string | null>(null);
  const [activeKeypad, setActiveKeypad] = useState<ActiveKeypadState | null>(null);
  // Persist promptPayId
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('bill-splitter-promptpay-id', promptPayId);
    }
  }, [promptPayId]);

  // Keep selected person for QR code valid
  useEffect(() => {
    if (people.length > 0) {
      const exists = people.some(p => p.id === selectedPersonForQR);
      if (!exists) {
        setSelectedPersonForQR(people[0].id);
      }
    }
  }, [people, selectedPersonForQR]);

  useEffect(() => {
    const saveLatestState = () => {
      try {
        localStorage.setItem(
          BILL_STATE_STORAGE_KEY,
          JSON.stringify(latestBillStateRef.current),
        );
      } catch (error) {
        console.error('Failed to save state', error);
      }
    };
    const timeoutId = window.setTimeout(() => {
      saveLatestState();
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [people, sharedItems, settings]);

  useEffect(() => {
    const flushLatestState = () => {
      try {
        localStorage.setItem(
          BILL_STATE_STORAGE_KEY,
          JSON.stringify(latestBillStateRef.current),
        );
      } catch (error) {
        console.error('Failed to flush state', error);
      }
    };
    const flushWhenHidden = () => {
      if (document.visibilityState === 'hidden') flushLatestState();
    };

    window.addEventListener('pagehide', flushLatestState);
    document.addEventListener('visibilitychange', flushWhenHidden);
    return () => {
      window.removeEventListener('pagehide', flushLatestState);
      document.removeEventListener('visibilitychange', flushWhenHidden);
    };
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('bill-splitter-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('bill-splitter-theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    const language = i18n.resolvedLanguage ?? i18n.language;
    document.documentElement.lang = language;
    try {
      localStorage.setItem('bill-splitter-language', language);
    } catch {
      // The active language still applies when storage is unavailable.
    }
  }, [i18n.language, i18n.resolvedLanguage]);

  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const copyQRTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyQRTimeoutRef.current) {
        window.clearTimeout(copyQRTimeoutRef.current);
      }
    };
  }, []);

  const addPerson = useCallback(() => {
    vibrate(10);
    const newFoodItemId = crypto.randomUUID();
    setPeople((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: t('newMemberDefaultName', { count: prev.length + 1 }),
        items: [{ id: newFoodItemId, name: '', price: 0 }],
        individualDiscount: 0,
        plates: { ...INITIAL_PLATES },
      },
    ]);
    setFocusTargetItemId(newFoodItemId);
  }, [t]);

  const removePerson = useCallback((id: string) => {
    setPeople((prev) => {
      if (prev.length <= 1) return prev;
      vibrate([20, 50, 20]);
      return prev.filter(p => p.id !== id);
    });
  }, []);

  const updatePersonName = useCallback((id: string, name: string) => {
    setPeople(prev => prev.map(p => p.id === id ? { ...p, name } : p));
  }, []);

  const addItem = useCallback((personId: string) => {
    vibrate(10);
    const newItemId = crypto.randomUUID();
    setPeople(prev => prev.map(p => {
      if (p.id === personId) {
        return {
          ...p,
          items: [...p.items, { id: newItemId, name: '', price: 0 }],
        };
      }
      return p;
    }));
    setFocusTargetItemId(newItemId);
  }, []);

  const updateItem = useCallback((personId: string, itemId: string, updates: Partial<Item>) => {
    const safeUpdates = updates.price === undefined
      ? updates
      : { ...updates, price: sanitizeNonNegativeNumber(updates.price) };
    setPeople(prev => prev.map(p => {
      if (p.id === personId) {
        return {
          ...p,
          items: p.items.map(item => item.id === itemId ? { ...item, ...safeUpdates } : item),
        };
      }
      return p;
    }));
  }, []);

  const removeItem = useCallback((personId: string, itemId: string) => {
    vibrate([20, 50, 20]);
    setPeople(prev => prev.map(p => {
      if (p.id === personId) {
        return {
          ...p,
          items: p.items.filter(item => item.id !== itemId),
        };
      }
      return p;
    }));
  }, []);

  const updatePlateCount = useCallback((personId: string, color: keyof Plates, delta: number) => {
    vibrate(10);
    setPeople(prev => prev.map(p => {
      if (p.id === personId) {
        const plates = p.plates || { ...INITIAL_PLATES };
        return {
          ...p,
          plates: {
            ...plates,
            [color]: Math.max(0, plates[color] + delta),
          },
        };
      }
      return p;
    }));
  }, []);

  const updateIndividualDiscount = useCallback((personId: string, discount: number) => {
    setPeople(prev => prev.map(p => (
      p.id === personId
        ? { ...p, individualDiscount: sanitizeNonNegativeNumber(discount) }
        : p
    )));
  }, []);

  const addSharedItem = useCallback(() => {
    vibrate(10);
    const newItemId = crypto.randomUUID();
    setSharedItems(prev => [...prev, { id: newItemId, name: '', price: 0 }]);
    setFocusTargetItemId(newItemId);
  }, []);

  const updateSharedItem = useCallback((itemId: string, updates: Partial<Item>) => {
    const safeUpdates = updates.price === undefined
      ? updates
      : { ...updates, price: sanitizeNonNegativeNumber(updates.price) };
    setSharedItems(prev => prev.map(item => (
      item.id === itemId ? { ...item, ...safeUpdates } : item
    )));
  }, []);

  const removeSharedItem = useCallback((itemId: string) => {
    vibrate([20, 50, 20]);
    setSharedItems(prev => prev.filter(item => item.id !== itemId));
  }, []);

  const openKeypad = useCallback((
    id: string,
    title: string,
    initialValue: number,
    onConfirm: (val: number) => void,
    unit: '฿' | '%' = '฿',
    max?: number,
  ) => {
    vibrate(10);
    setActiveKeypad({
      id,
      title,
      initialValue,
      unit,
      max,
      onConfirm,
    });
  }, []);

  useEffect(() => {
    if (!focusTargetItemId) return;
    const shared = sharedItems.find(i => i.id === focusTargetItemId);
    if (shared) {
      openKeypad(
        `shared-${shared.id}`,
        shared.name || t('addSharedItem'),
        shared.price || 0,
        (val) => updateSharedItem(shared.id, { price: val }),
        '฿',
      );
      setFocusTargetItemId(null);
      return;
    }
    for (const p of people) {
      const item = p.items.find(i => i.id === focusTargetItemId);
      if (item) {
        openKeypad(
          `item-${p.id}-${item.id}`,
          `${p.name} (${t('addItem')})`,
          item.price || 0,
          (val) => updateItem(p.id, item.id, { price: val }),
          '฿',
        );
        setFocusTargetItemId(null);
        return;
      }
    }
  }, [focusTargetItemId, sharedItems, people, t, openKeypad, updateSharedItem, updateItem]);

  const breakdown = useMemo(
    () => calculateBill(people, sharedItems, settings),
    [people, sharedItems, settings],
  );

  const peopleTotalsById = useMemo(
    () => new Map(breakdown.peopleTotals.map(total => [total.personId, total])),
    [breakdown.peopleTotals]
  );

  const selectedMember = useMemo(() => {
    return people.find(p => p.id === selectedPersonForQR) || people[0];
  }, [people, selectedPersonForQR]);

  const selectedMemberTotal = useMemo(() => {
    if (!selectedMember) return 0;
    return peopleTotalsById.get(selectedMember.id)?.finalShare || 0;
  }, [peopleTotalsById, selectedMember]);

  const qrPayload = useMemo(() => {
    if (currentView !== 'qr' || !promptPayId.trim() || selectedMemberTotal <= 0) return '';
    try {
      const cleanId = promptPayId.replace(/[^0-9]/g, '');
      if (cleanId.length !== 10 && cleanId.length !== 13 && cleanId.length !== 15) {
        return '';
      }
      return generatePayload(cleanId, { amount: selectedMemberTotal });
    } catch (e) {
      console.error("Failed to generate PromptPay payload", e);
      return '';
    }
  }, [currentView, promptPayId, selectedMemberTotal]);

  const copySummary = async () => {
    vibrate([10, 30, 10]);
    let text = t('copyTemplateSubtotal', { count: people.length });

    if (sharedItems.length > 0 && breakdown.sharedItemsTotal > 0) {
      text += `🍲 ${t('sharedItemsSection')}: ฿${breakdown.sharedItemsTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${t('sharedItemPerPersonLabel', { count: people.length, amount: breakdown.sharedItemPerPerson.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) })})\n\n`;
    }

    people.forEach(p => {
      const share = peopleTotalsById.get(p.id)?.finalShare ?? 0;
      text += `👤 ${p.name}: ฿${share.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
    });
    text += t('copyTemplateTotal', { total: breakdown.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) });

    const cleanPromptPay = promptPayId.trim();
    if (cleanPromptPay) {
      text += t('promptPayInSummary', { id: cleanPromptPay });
    }

    try {
      await navigator.clipboard.writeText(text);
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy summary', error);
    }
  };

  const resetAll = () => {
    vibrate([30, 50, 30]);
    setPeople([{ id: '1', name: t('personDefaultName'), items: [], individualDiscount: 0, plates: { ...INITIAL_PLATES } }]);
    setSharedItems([]);
    setSettings({ ...INITIAL_SETTINGS });
    setSelectedPersonForQR('1');
    setShowResetConfirm(false);
  };

  const downloadQRImage = useCallback((name?: string) => {
    vibrate(10);
    const canvas = qrCanvasRef.current;
    if (!canvas) return;
    try {
      const url = canvas.toDataURL('image/png');
      const safeName = (name || 'Member').replace(/[/\\?%*:|"<>]/g, '-').trim();
      const link = document.createElement('a');
      link.download = `PromptPay-QR-${safeName}.png`;
      link.href = url;
      link.click();
    } catch (e) {
      console.error('Download QR failed', e);
    }
  }, []);

  const copyQRToClipboard = useCallback(async (memberId?: string, name?: string) => {
    vibrate([10, 30, 10]);
    const canvas = qrCanvasRef.current;
    if (!canvas) return;

    if (
      typeof ClipboardItem === 'undefined'
      || typeof navigator.clipboard?.write !== 'function'
    ) {
      downloadQRImage(name);
      return;
    }

    try {
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, 'image/png');
      });
      if (!blob) {
        downloadQRImage(name);
        return;
      }

      const item = new ClipboardItem({ 'image/png': blob });
      await navigator.clipboard.write([item]);
      if (memberId) {
        if (copyQRTimeoutRef.current) window.clearTimeout(copyQRTimeoutRef.current);
        setCopiedQRId(memberId);
        copyQRTimeoutRef.current = window.setTimeout(() => setCopiedQRId(null), 2000);
      }
    } catch (err) {
      console.error('Clipboard copy failed, fallback to download:', err);
      downloadQRImage(name);
    }
  }, [downloadQRImage]);

  const triggerSpectacularEffect = async () => {
    vibrate([30, 50, 30, 50, 30, 50, 30]);
    try {
      if (!cachedConfetti) {
        const confettiModule = await import('canvas-confetti');
        cachedConfetti = (
          (confettiModule as unknown as { default?: typeof import('canvas-confetti') }).default ?? confettiModule
        ) as typeof import('canvas-confetti');
      }
    } catch (error) {
      console.error('Failed to load celebration effect', error);
      return;
    }
    const confetti = cachedConfetti;
    if (!confetti) return;
    const duration = 3 * 1000;
    const end = Date.now() + duration;

    (function frame() {
      confetti({
        particleCount: 7,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#a855f7', '#6366f1', '#ec4899']
      });
      confetti({
        particleCount: 7,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#a855f7', '#6366f1', '#ec4899']
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    }());
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    try {
      if (!file.type.startsWith('image/')) {
        throw new Error('The selected file is not an image.');
      }
      if (file.size > MAX_RECEIPT_IMAGE_BYTES) {
        throw new Error('Receipt images must be 10 MB or smaller.');
      }

      const base64Data = await readFileAsDataUrl(file);
      const dataDelimiterIndex = base64Data.indexOf(',');
      if (dataDelimiterIndex < 0) {
        throw new Error('Receipt image data is invalid.');
      }
      const base64Image = base64Data.slice(dataDelimiterIndex + 1);
      if (!base64Image) {
        throw new Error('Receipt image data is empty.');
      }

      const { scanReceipt } = await import('./services/receiptScanner');
      const items = await scanReceipt(base64Image, file.type);
      const scannedUnitCount = items.reduce((total, item) => total + item.quantity, 0);
      if (scannedUnitCount > MAX_SCANNED_UNITS) {
        throw new Error(`Receipt contains more than ${MAX_SCANNED_UNITS} units.`);
      }

      if (items.length > 0) {
        const newPeople: Person[] = [];
        const splitQuantities = settings.splitScanItemsByQuantity !== false;

        items.forEach((item) => {
          const unitPrice = item.price / item.quantity;

          if (splitQuantities) {
            for (let i = 0; i < item.quantity; i++) {
              newPeople.push({
                id: crypto.randomUUID(),
                name: item.name,
                items: [{ id: crypto.randomUUID(), name: item.name, price: unitPrice }],
                individualDiscount: 0,
                plates: { ...INITIAL_PLATES }
              });
            }
          } else {
            const personItems = [];
            for (let i = 0; i < item.quantity; i++) {
              personItems.push({ id: crypto.randomUUID(), name: item.name, price: unitPrice });
            }
            newPeople.push({
              id: crypto.randomUUID(),
              name: item.name,
              items: personItems,
              individualDiscount: 0,
              plates: { ...INITIAL_PLATES }
            });
          }
        });

        setSettings(prev => ({ ...prev, isSushiroMode: false }));
        setPeople((currentPeople) => {
          const defaultPersonNames = [
            i18n.getFixedT('en')('personDefaultName'),
            i18n.getFixedT('th')('personDefaultName'),
          ];

          return [
            ...(shouldReplaceStarterPerson(currentPeople, defaultPersonNames)
              ? []
              : currentPeople),
            ...newPeople,
          ];
        });
        vibrate([10, 30, 20]);
      }
    } catch (err) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      alert(`${t('scanFailed')}\n\nDetails: ${errorMessage}`);
      vibrate([30, 50, 30]);
    } finally {
      setIsScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen main-safe-padding-bottom bg-slate-50/50 w-full overflow-x-hidden">
      <header className="sticky top-0 z-30 bg-white/50 backdrop-blur-3xl saturate-[1.3] border-b border-white/40 px-6 header-safe-padding shadow-[0_4px_30px_rgba(0,0,0,0.03)]">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { vibrate(10); setIsDarkMode(!isDarkMode); }}
              className="w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center bg-white shadow-xl shadow-indigo-200 hover:scale-105 active:scale-95 transition-all outline-none overflow-hidden"
              aria-label={t('toggleTheme')}
              title={t('toggleTheme')}
            >
              <img
                src={`${import.meta.env.BASE_URL}favicon.svg`}
                alt=""
                aria-hidden="true"
                className="w-full h-full"
              />
            </button>
            <div>
              <p className="flex items-center gap-2 text-indigo-600 font-extrabold">
                <span className="text-2xl leading-none" aria-hidden="true">
                  {settings.isSushiroMode ? '🍣' : '🍛'}
                </span>
                <span className="text-xs uppercase tracking-wider">
                  {settings.isSushiroMode ? t('sushiroMode') : t('smartSplitter')}
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { vibrate(10); i18n.changeLanguage(i18n.language === 'th' ? 'en' : 'th'); }}
              className="w-11 h-11 flex items-center justify-center shrink-0 rounded-xl border border-slate-200 bg-white/80 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors text-xs font-bold uppercase tracking-widest shadow-sm"
              aria-label={t('changeLanguage')}
              title={t('changeLanguage')}
            >
              {i18n.language === 'th' ? 'EN' : 'TH'}
            </button>
            <motion.button 
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => { vibrate(10); setSettings(s => ({ ...s, isSushiroMode: !s.isSushiroMode })); }}
              className={`w-11 h-11 flex items-center justify-center shrink-0 rounded-xl border transition-all text-xl shadow-sm cursor-pointer ${
                settings.isSushiroMode 
                  ? 'bg-orange-50 border-orange-200 text-orange-500' 
                  : 'bg-white/80 border-slate-200 text-slate-500 hover:text-slate-700'
              }`}
              title={t('toggleSushiro')}
            >
              🍣
            </motion.button>
            <motion.button 
              whileHover={{ scale: 1.1, rotate: 5 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => { vibrate(10); setShowResetConfirm(true); }}
              className="w-11 h-11 flex items-center justify-center shrink-0 text-slate-500 hover:text-rose-600 shadow-sm transition-colors bg-white/80 rounded-xl border border-slate-200"
              title={t('clearAll')}
            >
              <Trash2 size={20} />
            </motion.button>
          </div>
        </div>
      </header>

      {/* PWA update/install banner */}
      {updateAvailable ? (
        <div className="max-w-xl mx-auto px-6 pt-4">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl flex items-center justify-between shadow-lg shadow-indigo-200"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center font-bold text-lg shrink-0">
                🔄
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider">{t('updateAvailable')}</p>
                <p className="text-sm text-indigo-100 font-medium">
                  {updateError ? t('updateFailed') : t('updateAvailableDesc')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => {
                  vibrate(10);
                  void applyUpdate();
                }}
                disabled={updateInProgress}
                className="px-3.5 py-2 bg-white text-indigo-600 rounded-xl text-xs font-bold hover:bg-indigo-50 active:scale-95 transition-all shadow-sm cursor-pointer disabled:cursor-wait disabled:opacity-70"
              >
                {updateInProgress
                  ? t('updatingApp')
                  : updateError
                    ? t('retryUpdate')
                    : t('refreshApp')}
              </button>
              <button
                type="button"
                onClick={() => {
                  vibrate(10);
                  dismissUpdate();
                }}
                disabled={updateInProgress}
                className="px-2.5 py-2 rounded-lg text-xs font-bold text-white/90 hover:text-white hover:bg-white/15 active:scale-95 transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
              >
                {t('later')}
              </button>
            </div>
          </motion.div>
        </div>
      ) : installOffer && (
        <div className="max-w-xl mx-auto px-6 pt-4">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl flex items-center justify-between shadow-lg shadow-indigo-200"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center font-bold text-lg shrink-0">
                📲
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider">{t('installApp')}</p>
                <p className="text-sm text-indigo-100 font-medium">
                  {installOffer === 'ios' ? t('installIosDesc') : t('installAppDesc')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {installOffer === 'native' && (
                <button
                  type="button"
                  onClick={() => {
                    vibrate(10);
                    void requestInstall();
                  }}
                  className="px-3.5 py-2 bg-white text-indigo-600 rounded-xl text-xs font-bold hover:bg-indigo-50 active:scale-95 transition-all shadow-sm cursor-pointer"
                >
                  {t('installApp')}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  vibrate(10);
                  dismissInstall();
                }}
                className="w-9 h-9 flex items-center justify-center rounded-lg text-white/80 hover:text-white hover:bg-white/15 active:scale-95 transition-all cursor-pointer"
                aria-label={t('dismissInstallApp')}
                title={t('dismissInstallApp')}
              >
                <X size={18} />
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      <AnimatePresence>
        {showResetConfirm && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-[2.5rem] p-8 w-full max-w-xs space-y-6 text-center shadow-2xl"
            >
              <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto">
                <Trash2 size={32} />
              </div>
              <div className="space-y-2">
                <h3 className="font-extrabold text-xl text-slate-900">{t('clearConfirmTitle')}</h3>
                <p className="text-base font-medium text-slate-500">{t('clearConfirmDesc')}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => { vibrate(10); setShowResetConfirm(false); }}
                  className="py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold text-base transition-all"
                >
                  {t('cancel')}
                </button>
                <button 
                  onClick={resetAll}
                  className="py-4 bg-rose-500 text-white rounded-2xl font-bold text-base shadow-lg shadow-rose-200 transition-all hover:bg-rose-600"
                >
                  {t('clear')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="max-w-xl mx-auto p-4 space-y-8">
        {currentView === 'main' ? (
          <>
            {/* Global Settings Section */}
        <section className="glass-card rounded-[2.5rem] p-7 space-y-6">
          <div className="flex items-center gap-2 text-indigo-600 px-1">
            <Settings2 size={18} />
            <h2 className="text-xs font-bold uppercase tracking-wider">{t('globalSettings')}</h2>
          </div>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-4">
            <div className="flex-1 min-w-0 space-y-3">
              <div className="flex items-center justify-between ml-1">
                <label className="text-sm font-bold text-slate-600">{t('sharedDiscount')}</label>
                <div className="flex bg-slate-200/50 p-0.5 rounded-lg shrink-0">
                  <button 
                    type="button"
                    onClick={() => { vibrate(10); setSettings(s => ({ ...s, sharedDiscountType: 'amount' })); }}
                    className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${settings.sharedDiscountType === 'amount' || !settings.sharedDiscountType ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >฿</button>
                  <button 
                    type="button"
                    onClick={() => {
                      vibrate(10);
                      setSettings(s => ({
                        ...s,
                        sharedDiscountType: 'percentage',
                        sharedDiscount: sanitizeNonNegativeNumber(s.sharedDiscount, 100),
                      }));
                    }}
                    className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${settings.sharedDiscountType === 'percentage' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >%</button>
                </div>
              </div>
              <div className="relative group">
                <input 
                  type="text"
                  readOnly
                  value={settings.sharedDiscount ? String(settings.sharedDiscount) : ''}
                  onClick={() => openKeypad(
                    'shared-discount',
                    t('sharedDiscount'),
                    settings.sharedDiscount || 0,
                    (val) => setSettings(s => ({ ...s, sharedDiscount: val })),
                    settings.sharedDiscountType === 'percentage' ? '%' : '฿',
                    settings.sharedDiscountType === 'percentage' ? 100 : undefined,
                  )}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openKeypad(
                        'shared-discount',
                        t('sharedDiscount'),
                        settings.sharedDiscount || 0,
                        (val) => setSettings(s => ({ ...s, sharedDiscount: val })),
                        settings.sharedDiscountType === 'percentage' ? '%' : '฿',
                        settings.sharedDiscountType === 'percentage' ? 100 : undefined,
                      );
                    }
                  }}
                  className="w-full h-11 glass-input rounded-xl px-4 font-bold text-base text-slate-900 placeholder:text-slate-500 cursor-pointer"
                  placeholder="0.00"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-indigo-500 font-extrabold pointer-events-none">
                  {settings.sharedDiscountType === 'percentage' ? '%' : '฿'}
                </span>
              </div>
            </div>

            <div className="flex-1 flex gap-2">
              {/* Service Charge */}
              <div 
                className={`flex-1 h-11 rounded-xl border transition-all flex items-center justify-between outline-none px-2.5 py-1 ${
                  settings.hasServiceCharge 
                    ? 'vibrant-gradient-light border-transparent text-white shadow-md' 
                    : 'glass-input text-slate-600 hover:text-slate-800'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    vibrate(10);
                    setSettings(s => ({ ...s, hasServiceCharge: !s.hasServiceCharge }));
                  }}
                  className="flex items-center gap-1.5 flex-1 min-w-0 text-left cursor-pointer outline-none"
                >
                  <div className={`w-2 h-2 rounded-full transition-all shrink-0 ${settings.hasServiceCharge ? 'bg-white scale-110 shadow-sm' : 'bg-slate-400'}`} />
                  <span className="text-xs font-extrabold uppercase leading-tight truncate">SVC</span>
                </button>
                <div className={`w-[1px] h-4 mx-1 ${settings.hasServiceCharge ? 'bg-white/30' : 'bg-slate-300 dark:bg-slate-700'}`} />
                <button
                  type="button"
                  onClick={() => {
                    openKeypad(
                      'svc-rate',
                      t('serviceChargeRate'),
                      settings.serviceChargeRate ?? 10,
                      (val) => setSettings(s => ({ ...s, hasServiceCharge: true, serviceChargeRate: val })),
                      '%',
                      100,
                    );
                  }}
                  className={`px-2 py-0.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-0.5 ${
                    settings.hasServiceCharge
                      ? 'bg-black/20 hover:bg-black/30 text-white'
                      : 'bg-slate-200/60 dark:bg-slate-700/60 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300'
                  }`}
                  title={t('serviceChargeRate')}
                >
                  <span>{settings.serviceChargeRate ?? 10}%</span>
                </button>
              </div>
              
              {/* VAT */}
              <div 
                className={`flex-1 h-11 rounded-xl border transition-all flex items-center justify-between outline-none px-2.5 py-1 ${
                  settings.hasVat 
                    ? 'vibrant-gradient-light border-transparent text-white shadow-md' 
                    : 'glass-input text-slate-600 hover:text-slate-800'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    vibrate(10);
                    setSettings(s => ({ ...s, hasVat: !s.hasVat }));
                  }}
                  className="flex items-center gap-1.5 flex-1 min-w-0 text-left cursor-pointer outline-none"
                >
                  <div className={`w-2 h-2 rounded-full transition-all shrink-0 ${settings.hasVat ? 'bg-white scale-110 shadow-sm' : 'bg-slate-400'}`} />
                  <span className="text-xs font-extrabold uppercase leading-tight truncate">VAT</span>
                </button>
                <div className={`w-[1px] h-4 mx-1 ${settings.hasVat ? 'bg-white/30' : 'bg-slate-300 dark:bg-slate-700'}`} />
                <button
                  type="button"
                  onClick={() => {
                    openKeypad(
                      'vat-rate',
                      t('vatRate'),
                      settings.vatRate ?? 7,
                      (val) => setSettings(s => ({ ...s, hasVat: true, vatRate: val })),
                      '%',
                      100,
                    );
                  }}
                  className={`px-2 py-0.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-0.5 ${
                    settings.hasVat
                      ? 'bg-black/20 hover:bg-black/30 text-white'
                      : 'bg-slate-200/60 dark:bg-slate-700/60 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300'
                  }`}
                  title={t('vatRate')}
                >
                  <span>{settings.vatRate ?? 7}%</span>
                </button>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200/60 space-y-2">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block ml-1">
              {t('discountTimingLabel')}
            </label>
            <div className="grid grid-cols-2 gap-2 bg-slate-200/50 p-1 rounded-2xl">
              <button
                type="button"
                onClick={() => { vibrate(10); setSettings(s => ({ ...s, discountTiming: 'before' })); }}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  settings.discountTiming !== 'after' 
                    ? 'bg-white text-indigo-600 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t('discountTimingBefore')}
              </button>
              <button
                type="button"
                onClick={() => { vibrate(10); setSettings(s => ({ ...s, discountTiming: 'after' })); }}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  settings.discountTiming === 'after' 
                    ? 'bg-white text-indigo-600 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t('discountTimingAfter')}
              </button>
            </div>
          </div>
        </section>

        {/* Shared Menu Section */}
        <section className="glass-card rounded-[2.5rem] p-7 space-y-6">
          <div className="flex items-center justify-between px-1 gap-2 flex-wrap">
            <div className="flex items-center gap-2 text-indigo-600">
              <UtensilsCrossed size={18} />
              <h2 className="text-xs font-bold uppercase tracking-wider">{t('sharedItemsSection')}</h2>
            </div>
            {breakdown.sharedItemsTotal > 0 && (
              <div className="text-right">
                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
                  ฿{breakdown.sharedItemsTotal.toLocaleString()} ({t('sharedItemPerPersonLabel', { count: people.length, amount: breakdown.sharedItemPerPerson.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) })})
                </span>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {sharedItems.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  placeholderName={t('sharedItemNamePlaceholder')}
                  onUpdate={(updates) => updateSharedItem(item.id, updates)}
                  onRemove={() => removeSharedItem(item.id)}
                  onOpenKeypad={(id, title, price) => openKeypad(
                    id,
                    title,
                    price,
                    (val) => updateSharedItem(item.id, { price: val }),
                    '฿',
                  )}
                  isExpanded={expandedItemOptionsId === item.id}
                  onToggleExpanded={() => setExpandedItemOptionsId(expandedItemOptionsId === item.id ? null : item.id)}
                  keypadId={`shared-${item.id}`}
                  keypadTitle={item.name || t('sharedItemNamePlaceholder')}
                  vibrate={vibrate}
                  isShared={true}
                />
              ))}
            </AnimatePresence>

            <button 
              onClick={addSharedItem}
              className="w-full py-3 border-2 border-dashed border-indigo-200 rounded-[1.25rem] text-indigo-600 hover:border-indigo-400 hover:bg-indigo-50/50 transition-all flex items-center justify-center gap-2 group/add cursor-pointer"
            >
              <Plus size={16} className="group-hover/add:scale-125 transition-transform" />
              <span className="text-xs font-bold uppercase tracking-widest">{t('addSharedItem')}</span>
            </button>
          </div>
        </section>

        {/* Participants Content */}
        <div className="space-y-6">
          <div className="flex items-center justify-between px-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
              <Users size={18} />
              {t('members')} ({people.length})
            </h2>
          </div>

          <AnimatePresence initial={false}>
            {people.map((person, index) => (
              <motion.div 
                key={person.id}
                layout
                transition={{ duration: 0.2, ease: "easeOut" }}
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                className="glass-card rounded-[2.5rem] group"
              >
                <div className="p-7 space-y-7">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-500 shrink-0">
                        <span className="text-base font-extrabold">{index + 1}</span>
                      </div>
                      <input 
                        type="text"
                        value={person.name}
                        onChange={(e) => updatePersonName(person.id, e.target.value)}
                        className="text-xl font-extrabold bg-transparent border-none p-0 focus:ring-0 w-full placeholder:text-slate-400 text-slate-900"
                        placeholder={t('memberNamePlaceholder')}
                      />
                    </div>
                    {people.length > 1 && (
                      <button 
                        onClick={() => removePerson(person.id)}
                        className="p-3 text-slate-400 hover:text-rose-600 hover:bg-rose-100 rounded-2xl transition-all cursor-pointer"
                      >
                        <Trash2 size={20} />
                      </button>
                    )}
                  </div>

                  <div className="space-y-4">
                    {!settings.isSushiroMode ? (
                      <>
                        <AnimatePresence initial={false}>
                          {person.items.map((item) => (
                            <ItemRow
                              key={item.id}
                              item={item}
                              placeholderName={t('itemNamePlaceholder')}
                              onUpdate={(updates) => updateItem(person.id, item.id, updates)}
                              onRemove={() => removeItem(person.id, item.id)}
                              onOpenKeypad={(id, title, price) => openKeypad(
                                id,
                                title,
                                price,
                                (val) => updateItem(person.id, item.id, { price: val }),
                                '฿',
                              )}
                              isExpanded={expandedItemOptionsId === item.id}
                              onToggleExpanded={() => setExpandedItemOptionsId(expandedItemOptionsId === item.id ? null : item.id)}
                              keypadId={`item-${person.id}-${item.id}`}
                              keypadTitle={`${person.name} - ${item.name || t('itemNamePlaceholder')}`}
                              vibrate={vibrate}
                              isShared={false}
                            />
                          ))}
                        </AnimatePresence>

                        <button 
                          onClick={() => addItem(person.id)}
                          className="w-full py-4 border-2 border-dashed border-slate-300 rounded-[1.25rem] text-slate-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/50 transition-all flex items-center justify-center gap-3 group/add cursor-pointer"
                        >
                          <Plus size={18} className="group-hover/add:scale-125 transition-transform" />
                          <span className="text-xs font-bold uppercase tracking-widest">{t('addItem')}</span>
                        </button>
                      </>
                    ) : (
                      <SushiroPlateSelector
                        plates={person.plates}
                        onUpdatePlate={(color, delta) => updatePlateCount(person.id, color, delta)}
                        vibrate={vibrate}
                      />
                    )}
                  </div>

                  <div className="pt-6 border-t border-slate-50 flex items-end justify-between">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-none block ml-1">{t('individualDiscount')}</label>
                      <div className="relative w-32 group/disc">
                        <input 
                          type="text"
                          readOnly
                          value={person.individualDiscount ? String(person.individualDiscount) : ''}
                          onClick={() => openKeypad(
                            `discount-${person.id}`,
                            `${person.name} - ${t('individualDiscount')}`,
                            person.individualDiscount || 0,
                            (val) => updateIndividualDiscount(person.id, val),
                            '฿',
                          )}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              openKeypad(
                                `discount-${person.id}`,
                                `${person.name} - ${t('individualDiscount')}`,
                                person.individualDiscount || 0,
                                (val) => updateIndividualDiscount(person.id, val),
                                '฿',
                              );
                            }
                          }}
                          className="w-full text-base font-bold glass-input rounded-[1rem] px-4 py-2.5 placeholder:text-slate-500 text-slate-900 cursor-pointer"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-1">{t('yourTotal')}</p>
                      <p className="text-3xl font-extrabold text-indigo-700 tabular-nums tracking-tighter">
                        ฿{(peopleTotalsById.get(person.id)?.finalShare ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={addPerson}
                  className="w-full py-4 rounded-[2rem] bg-indigo-50/50 border-2 border-dashed border-indigo-200 text-indigo-600 hover:bg-indigo-100 hover:border-indigo-300 hover:text-indigo-700 transition-all flex flex-col items-center justify-center gap-2 active:scale-[0.98]"
                >
                  <div className="p-2 bg-white rounded-xl shadow-sm border border-indigo-50 text-indigo-500">
                    <UserPlus size={20} strokeWidth={2.5} />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider text-center">{t('addMember')}</span>
                </button>

                <button 
                  onClick={() => { vibrate(10); fileInputRef.current?.click(); }}
                  disabled={isScanning}
                  className="w-full py-4 rounded-[2rem] bg-indigo-50/50 border-2 border-dashed border-indigo-200 text-indigo-600 hover:bg-indigo-100 hover:border-indigo-300 hover:text-indigo-700 transition-all flex flex-col items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="p-2 bg-white rounded-xl shadow-sm border border-indigo-50 text-indigo-500">
                    {isScanning ? (
                      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                        <Receipt size={20} strokeWidth={2.5} />
                      </motion.div>
                    ) : (
                      <Camera size={20} strokeWidth={2.5} />
                    )}
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider text-center">{isScanning ? t('scanning') : t('scanReceipt')}</span>
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={handleFileUpload}
                />
              </div>

              <div className="flex items-center justify-between bg-white/40 backdrop-blur-md p-4 rounded-[1.25rem] border border-white/50">
                <label className="text-sm sm:text-base font-bold text-slate-700 select-none cursor-pointer pr-4 leading-relaxed" htmlFor="splitQuantitiesToggle">
                  {t('splitQuantitiesOption')}
                </label>
                <button
                  id="splitQuantitiesToggle"
                  onClick={() => { vibrate(10); setSettings(s => ({ ...s, splitScanItemsByQuantity: s.splitScanItemsByQuantity === false })); }}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${settings.splitScanItemsByQuantity !== false ? 'bg-indigo-600' : 'bg-slate-200'}`}
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${settings.splitScanItemsByQuantity !== false ? 'translate-x-5' : 'translate-x-0'}`}
                  />
                </button>
              </div>
            </div>
        </div>

        {/* Detailed Summary Card */}
        <section className="glass-dark rounded-[3rem] p-9 text-slate-300 space-y-8">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 rounded-full -ml-32 -mb-32 blur-3xl pointer-events-none" />
          
          <div className="flex items-center justify-between relative z-10">
            <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-slate-300">
              <ReceiptText size={18} />
              {t('summary')}
            </h3>
            <div className="px-4 py-1.5 bg-slate-800 rounded-full text-xs font-bold text-white/80 uppercase tracking-widest border border-slate-700">
              {people.length} {t('persons')}
            </div>
          </div>

          <div className="space-y-5 text-base font-semibold relative z-10">
            <div className="flex justify-between items-center text-slate-400">
              <span>{t('subtotal')}</span>
              <span className="text-white">฿{breakdown.subtotal.toLocaleString()}</span>
            </div>

            {breakdown.sharedItemsTotal > 0 && (
              <div className="flex justify-between items-center text-slate-400 text-sm">
                <span className="flex items-center gap-1.5">
                  <UtensilsCrossed size={14} className="text-indigo-400" />
                  {t('sharedItemsSection')}
                </span>
                <span className="text-indigo-200">฿{breakdown.sharedItemsTotal.toLocaleString()} (฿{breakdown.sharedItemPerPerson.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/{t('persons')})</span>
              </div>
            )}
            
            {(breakdown.totalIndividualDiscounts + breakdown.totalSharedDiscount) > 0 && (
              <div className="flex justify-between items-center text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span>{t('totalDiscounts')}</span>
                  {(settings.hasServiceCharge || settings.hasVat) && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                      {t(
                        settings.discountTiming === 'after'
                          ? 'discountTimingAfter'
                          : 'discountTimingBefore',
                      )}
                    </span>
                  )}
                </span>
                <span className="text-emerald-400 font-bold">- ฿{(breakdown.totalIndividualDiscounts + breakdown.totalSharedDiscount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            )}

            {(settings.hasServiceCharge || settings.hasVat) && (
              <div className="pt-2 flex flex-col gap-3">
                {settings.hasServiceCharge && (
                  <div className="flex justify-between items-center text-slate-400">
                    <span>{t('serviceCharge')} ({settings.serviceChargeRate ?? 10}%)</span>
                    <span className="text-indigo-200">฿{breakdown.serviceChargeTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                {settings.hasVat && (
                  <div className="flex justify-between items-center text-slate-400">
                    <span>{t('vat')} ({settings.vatRate ?? 7}%)</span>
                    <span className="text-indigo-200">฿{breakdown.vatTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
              </div>
            )}

            <div className="pt-6 border-t border-white/10 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">{t('individualTotals')}</h4>
              <div className="grid grid-cols-1 gap-3">
                {people.map(p => {
                  const pt = peopleTotalsById.get(p.id);
                  if (!pt) return null;
                  return (
                    <div key={p.id} className="flex items-center justify-between py-1 px-1 group">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-lg bg-slate-800 flex items-center justify-center text-[9px] font-extrabold text-slate-300 group-hover:text-indigo-400 transition-colors">
                          {p.name.charAt(0)}
                        </div>
                        <span className="text-base font-bold text-slate-200 group-hover:text-white transition-colors">{p.name}</span>
                      </div>
                      <span className="text-base font-extrabold text-white tabular-nums">฿{pt.finalShare.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-8 border-t border-white/10 flex justify-between items-end">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">{t('netTotal')}</p>
                <div className="text-5xl font-extrabold text-white tracking-tighter tabular-nums leading-none">
                  ฿{breakdown.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              
              <div className="flex gap-2">
                <button 
                  onClick={copySummary}
                  className="p-5 vibrant-gradient text-white rounded-[1.5rem] hover:scale-105 active:scale-95 transition-all shadow-[0_10px_40px_rgba(99,102,241,0.4)] flex items-center gap-2"
                >
                  {showCopied ? (
                    <Check size={24} strokeWidth={3} />
                  ) : (
                    <Copy size={24} strokeWidth={2.5} />
                  )}
                </button>
              </div>
            </div>
          </div>
        </section>

          </>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-2">
              <button 
                onClick={() => { vibrate(10); setCurrentView('main'); }}
                className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-bold text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm rounded-xl px-4 py-2 hover:scale-[1.02] active:scale-95 transition-all outline-none"
              >
                <ArrowLeft size={16} strokeWidth={2.5} />
                <span>{t('backToCalculator')}</span>
              </button>
              <div className="px-4 py-1.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-full text-xs font-bold uppercase tracking-widest border border-indigo-100 dark:border-indigo-900/50">
                {t('qrMode')}
              </div>
            </div>

            <section className="glass-card rounded-[2.5rem] p-7 space-y-4">
              <div className="space-y-1 ml-1 flex items-center gap-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block">{t('promptPayIdLabel')}</label>
              </div>
              <div className="relative group">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                  <Phone size={20} />
                </div>
                <input 
                  type="text"
                  inputMode="numeric"
                  value={promptPayId}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9\-]/g, '');
                    setPromptPayId(val);
                  }}
                  className="w-full glass-input rounded-[1.25rem] pl-14 pr-5 py-4 font-bold text-base text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                  placeholder={t('promptPayIdPlaceholder')}
                />
              </div>
            </section>

            <section className="glass-card rounded-[2.5rem] p-8 text-center space-y-6 relative overflow-hidden flex flex-col items-center">
              {selectedMemberTotal <= 0 ? (
                <div className="w-full rounded-3xl border border-slate-200 bg-slate-100/80 p-6 py-12 text-center font-semibold text-slate-600 select-none space-y-3 dark:border-slate-600/80 dark:bg-slate-900/75 dark:text-slate-200">
                  <ReceiptText size={48} className="mx-auto text-slate-500 dark:text-slate-300" />
                  <p className="text-sm leading-relaxed">{t('invalidAmount')}</p>
                </div>
              ) : !promptPayId.trim() ? (
                <div className="w-full rounded-3xl border border-amber-200 bg-amber-50/90 p-6 py-12 text-center font-semibold text-amber-800 select-none space-y-3 dark:border-amber-700/80 dark:bg-amber-950/60 dark:text-amber-100">
                  <Phone size={48} className="mx-auto text-amber-600 dark:text-amber-300" />
                  <p className="text-sm leading-relaxed">{t('enterPromptPayFirst')}</p>
                </div>
              ) : !qrPayload ? (
                <div className="w-full rounded-3xl border border-rose-200 bg-rose-50/90 p-6 py-12 text-center font-semibold text-rose-800 select-none space-y-3 dark:border-rose-700/80 dark:bg-rose-950/60 dark:text-rose-100">
                  <Phone size={48} className="mx-auto text-rose-600 dark:text-rose-300" />
                  <p className="text-sm leading-relaxed">{t('invalidPromptPayId')}</p>
                </div>
              ) : (
                <>
                  <div className="space-y-1">
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                      {t('qrFor', { name: selectedMember?.name })}
                    </p>
                    <p className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight tabular-nums">
                      ฿{selectedMemberTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>

                  <div className="p-5 !bg-white rounded-3xl shadow-md border !border-slate-100 flex items-center justify-center relative group">
                    <QRCodeCanvas 
                      ref={qrCanvasRef}
                      value={qrPayload}
                      size={220}
                      level="M"
                      marginSize={4}
                    />
                  </div>

                  <div className="w-full grid grid-cols-2 gap-3">
                    <button
                      onClick={() => copyQRToClipboard(selectedMember?.id, selectedMember?.name)}
                      className="flex items-center justify-center gap-2 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[1.25rem] font-bold text-sm shadow-md active:scale-95 transition-all outline-none cursor-pointer"
                    >
                      {copiedQRId === selectedMember?.id ? (
                        <>
                          <Check size={18} strokeWidth={3} />
                          <span>{t('copied')}</span>
                        </>
                      ) : (
                        <>
                          <Copy size={18} strokeWidth={2.5} />
                          <span>{t('copyQRButton')}</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => downloadQRImage(selectedMember?.name)}
                      className="flex items-center justify-center gap-2 py-3.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-[1.25rem] font-bold text-sm active:scale-95 transition-all outline-none cursor-pointer border border-transparent dark:border-slate-700"
                    >
                      <Download size={18} strokeWidth={2.5} />
                      <span>{t('downloadQR')}</span>
                    </button>
                  </div>
                </>
              )}
            </section>

            <section className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 pl-1">
                {t('selectPersonToPay')}
              </h3>
              <div className="grid grid-cols-1 gap-2">
                {people.map(p => {
                  const pt = peopleTotalsById.get(p.id);
                  const amt = pt?.finalShare || 0;
                  const isSelected = p.id === selectedPersonForQR;
                  return (
                    <button
                      key={p.id}
                      onClick={() => { vibrate(10); setSelectedPersonForQR(p.id); }}
                      className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all text-left outline-none cursor-pointer ${
                        isSelected 
                          ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800/80 hover:border-indigo-300 shadow-[0_4px_12px_rgba(99,102,241,0.08)]' 
                          : 'bg-white dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-100 dark:border-slate-800/80'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold transition-colors ${
                          isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                        }`}>
                          {p.name.charAt(0)}
                        </div>
                        <span className={`text-base font-bold ${
                          isSelected ? 'text-indigo-900 dark:text-indigo-200' : 'text-slate-700 dark:text-slate-200'
                        }`}>{p.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-base font-extrabold tabular-nums ${
                          isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-900 dark:text-slate-100'
                        }`}>
                          ฿{amt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <div className={`w-2 h-2 rounded-full transition-all ${
                          isSelected ? 'bg-indigo-600 scale-125' : 'bg-transparent'
                        }`} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        )}
      </main>

      <div className="pb-8 pt-4 flex items-center justify-center gap-1 text-sm font-semibold text-slate-500">
        <button
          type="button"
          onClick={triggerSpectacularEffect}
          className="cursor-pointer outline-none hover:text-indigo-500 transition-colors active:scale-95"
        >
          {t('credit')}
        </button>
        <a
          href="https://www.instagram.com/miiickiie/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 hover:text-indigo-500 transition-colors outline-none active:scale-95"
        >
          <Instagram className="w-4 h-4" aria-hidden="true" />
          <span>Miiickiie</span>
        </a>
      </div>

      {/* Modern Sticky Footer */}
      <footer className="fixed footer-safe-bottom left-1/2 -translate-x-1/2 z-40 w-full max-w-sm px-4">
        <div className="glass-card rounded-[2rem] p-4 flex items-center justify-between gap-4">
          <div className="pl-2">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t('netTotal')}</p>
            <p className="text-xl font-extrabold text-slate-900 dark:text-slate-100 tabular-nums tracking-tighter">
              ฿{breakdown.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Toggle QR page button */}
            <button 
              onClick={() => {
                vibrate(12);
                setCurrentView(currentView === 'main' ? 'qr' : 'main');
              }}
              title={currentView === 'main' ? t('qrMode') : t('backToCalculator')}
              className={`h-14 w-14 rounded-[1.25rem] flex items-center justify-center transition-all shadow-md active:scale-95 cursor-pointer border ${
                currentView === 'qr' 
                  ? 'bg-slate-900 dark:bg-slate-800 text-white border-slate-900 dark:border-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700' 
                  : 'bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/50'
              }`}
            >
              <QrCode size={20} strokeWidth={2.5} />
            </button>

            {/* Share / Copy Summary button */}
            <button 
              onClick={copySummary}
              className="h-14 w-28 vibrant-gradient text-white rounded-[1.25rem] flex items-center justify-center gap-1.5 shadow-lg active:scale-95 transition-all overflow-hidden relative cursor-pointer"
            >
              <AnimatePresence mode="wait">
                {showCopied ? (
                  <motion.div 
                    key="copied"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -20, opacity: 0 }}
                    className="flex items-center gap-1.5"
                  >
                    <Check size={16} strokeWidth={3} />
                    <span className="text-xs font-bold uppercase tracking-wider">{t('copied')}</span>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="share"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -20, opacity: 0 }}
                    className="flex items-center gap-1.5"
                  >
                    <Share2 size={16} strokeWidth={2.5} />
                    <span className="text-xs font-bold uppercase tracking-wider">{t('share')}</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
          </div>
        </div>
      </footer>

      {/* On-Screen Calculator Keypad */}
      {activeKeypad && (
        <CalculatorKeypad
          isOpen={true}
          title={activeKeypad.title}
          initialValue={activeKeypad.initialValue}
          unit={activeKeypad.unit}
          max={activeKeypad.max}
          onConfirm={activeKeypad.onConfirm}
          onClose={() => setActiveKeypad(null)}
          vibrate={vibrate}
        />
      )}
    </div>
  );
}
