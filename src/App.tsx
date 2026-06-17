import React, { useState, useMemo, useEffect, useRef } from 'react';
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
  Minus,
  Camera,
  QrCode,
  Phone,
  ArrowLeft,
  Download
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Person, Item, BillSettings, CalculationBreakdown, Plates } from './types';
import { scanReceipt } from './services/receiptScanner';
import confetti from 'canvas-confetti';
import generatePayload from 'promptpay-qr';
import { QRCodeCanvas } from 'qrcode.react';

const PLATE_PRICES: Record<keyof Plates, number> = {
  white: 30,
  red: 40,
  silver: 60,
  gold: 80,
  black: 100
};

const INITIAL_PLATES: Plates = {
  white: 0,
  red: 0,
  silver: 0,
  gold: 0,
  black: 0
};

const vibrate = (pattern: number | number[]) => {
  // Check for Telegram WebApp HapticFeedback as fallback for iOS
  if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.HapticFeedback) {
    try {
      const HapticFeedback = (window as any).Telegram.WebApp.HapticFeedback;
      if (Array.isArray(pattern) && pattern.length > 2) {
        HapticFeedback.notificationOccurred('success');
      } else {
        HapticFeedback.impactOccurred('light');
      }
      return;
    } catch (e) {}
  }

  // Standard Web Vibration API (Not supported by Apple on iOS Safari)
  if (typeof window !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch(e) {}
  }
};

export default function App() {
  const { t, i18n } = useTranslation();
  
  const [people, setPeople] = useState<Person[]>([
    { id: '1', name: t('personDefaultName'), items: [], individualDiscount: 0, plates: { ...INITIAL_PLATES } }
  ]);
  const [settings, setSettings] = useState<BillSettings>({
    sharedDiscount: 0,
    sharedDiscountType: 'amount',
    hasServiceCharge: false,
    hasVat: false,
    isSushiroMode: false
  });
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
  const [selectedPersonForQR, setSelectedPersonForQR] = useState<string>('1');
  const [copiedQRId, setCopiedQRId] = useState<string | null>(null);
  const [focusTargetItemId, setFocusTargetItemId] = useState<string | null>(null);

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

  // Persist state to local storage
  useEffect(() => {
    const saved = localStorage.getItem('bill-splitter-state-v2');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setPeople(parsed.people);
        setSettings(parsed.settings);
      } catch (e) {
        console.error("Failed to load state", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('bill-splitter-state-v2', JSON.stringify({ people, settings }));
  }, [people, settings]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('bill-splitter-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('bill-splitter-theme', 'light');
    }
  }, [isDarkMode]);

  const addPerson = () => {
    vibrate(10);
    const newFoodItemId = crypto.randomUUID();
    const newPerson: Person = {
      id: crypto.randomUUID(),
      name: t('newMemberDefaultName', { count: people.length + 1 }),
      items: [{ id: newFoodItemId, name: '', price: 0 }],
      individualDiscount: 0,
      plates: { ...INITIAL_PLATES }
    };
    setPeople([...people, newPerson]);
    setFocusTargetItemId(newFoodItemId);
  };

  const removePerson = (id: string) => {
    if (people.length > 1) {
      vibrate([20, 50, 20]);
      setPeople(people.filter(p => p.id !== id));
    }
  };

  const updatePersonName = (id: string, name: string) => {
    setPeople(people.map(p => p.id === id ? { ...p, name } : p));
  };

  const addItem = (personId: string) => {
    vibrate(10);
    const newItemId = crypto.randomUUID();
    setPeople(people.map(p => {
      if (p.id === personId) {
        return {
          ...p,
          items: [...p.items, { id: newItemId, name: '', price: 0 }]
        };
      }
      return p;
    }));
    setFocusTargetItemId(newItemId);
  };

  const updateItem = (personId: string, itemId: string, updates: Partial<Item>) => {
    setPeople(people.map(p => {
      if (p.id === personId) {
        return {
          ...p,
          items: p.items.map(item => item.id === itemId ? { ...item, ...updates } : item)
        };
      }
      return p;
    }));
  };

  const removeItem = (personId: string, itemId: string) => {
    vibrate([20, 50, 20]);
    setPeople(people.map(p => {
      if (p.id === personId) {
        return {
          ...p,
          items: p.items.filter(item => item.id !== itemId)
        };
      }
      return p;
    }));
  };

  const updatePlateCount = (personId: string, color: keyof Plates, delta: number) => {
    vibrate(10);
    setPeople(people.map(p => {
      if (p.id === personId) {
        const plates = p.plates || { ...INITIAL_PLATES };
        return {
          ...p,
          plates: {
            ...plates,
            [color]: Math.max(0, plates[color] + delta)
          }
        };
      }
      return p;
    }));
  };

  const updateIndividualDiscount = (personId: string, discount: number) => {
    setPeople(people.map(p => p.id === personId ? { ...p, individualDiscount: discount } : p));
  };

  const breakdown = useMemo((): CalculationBreakdown => {
    let subtotal = 0;
    let totalIndividualDiscounts = 0;
    
    const peopleBases = people.map(p => {
      let itemsTotal = p.items.reduce((acc, item) => acc + (item.price || 0), 0);
      
      // Add plates total if in Sushiro mode
      if (settings.isSushiroMode && p.plates) {
        itemsTotal += (p.plates.white * PLATE_PRICES.white);
        itemsTotal += (p.plates.red * PLATE_PRICES.red);
        itemsTotal += (p.plates.silver * PLATE_PRICES.silver);
        itemsTotal += (p.plates.gold * PLATE_PRICES.gold);
        itemsTotal += (p.plates.black * PLATE_PRICES.black);
      }

      subtotal += itemsTotal;
      totalIndividualDiscounts += (p.individualDiscount || 0);
      
      const personBaseAfterIndividual = Math.max(0, itemsTotal - (p.individualDiscount || 0));
      return { personId: p.id, personBaseAfterIndividual, itemsTotal };
    });

    const totalSharedDiscountValue = settings.sharedDiscountType === 'percentage'
      ? subtotal * ((settings.sharedDiscount || 0) / 100)
      : (settings.sharedDiscount || 0);

    const sharedDiscountPerPerson = totalSharedDiscountValue / (people.length || 1);
    
    const finalBases = peopleBases.map(pb => {
      const baseAfterShared = Math.max(0, pb.personBaseAfterIndividual - sharedDiscountPerPerson);
      return { ...pb, baseAfterShared };
    });

    const totalBase = finalBases.reduce((acc, p) => acc + p.baseAfterShared, 0);
    const serviceChargeTotal = settings.hasServiceCharge ? totalBase * 0.10 : 0;
    const vatBase = totalBase + serviceChargeTotal;
    const vatTotal = settings.hasVat ? vatBase * 0.07 : 0;
    const grandTotal = vatBase + vatTotal;

    const multiplier = totalBase > 0 ? grandTotal / totalBase : 0;

    const peopleTotals = finalBases.map(fb => ({
      personId: fb.personId,
      itemsTotal: fb.itemsTotal,
      finalShare: fb.baseAfterShared * multiplier
    }));

    return {
      subtotal,
      totalIndividualDiscounts,
      sharedDiscountPerPerson,
      totalSharedDiscount: totalSharedDiscountValue,
      serviceChargeTotal,
      vatTotal,
      grandTotal,
      peopleTotals
    };
  }, [people, settings]);

  const selectedMember = useMemo(() => {
    return people.find(p => p.id === selectedPersonForQR) || people[0];
  }, [people, selectedPersonForQR]);

  const selectedMemberTotal = useMemo(() => {
    if (!selectedMember) return 0;
    return breakdown.peopleTotals.find(pt => pt.personId === selectedMember.id)?.finalShare || 0;
  }, [breakdown, selectedMember]);

  const qrPayload = useMemo(() => {
    if (!promptPayId || selectedMemberTotal <= 0) return '';
    try {
      const cleanId = promptPayId.replace(/[^0-9]/g, '');
      return generatePayload(cleanId, { amount: selectedMemberTotal });
    } catch (e) {
      console.error("Failed to generate PromptPay payload", e);
      return '';
    }
  }, [promptPayId, selectedMemberTotal]);

  const copySummary = () => {
    vibrate([10, 30, 10]);
    let text = t('copyTemplateSubtotal', { count: people.length });
    people.forEach(p => {
      const share = breakdown.peopleTotals.find(pt => pt.personId === p.id)?.finalShare || 0;
      text += `👤 ${p.name}: ฿${share.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
    });
    text += t('copyTemplateTotal', { total: breakdown.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) });

    navigator.clipboard.writeText(text);
    setShowCopied(true);
    setTimeout(() => setShowCopied(false), 2000);
  };

  const resetAll = () => {
    vibrate([30, 50, 30]);
    setPeople([{ id: '1', name: t('personDefaultName'), items: [], individualDiscount: 0, plates: { ...INITIAL_PLATES } }]);
    setSettings({ sharedDiscount: 0, sharedDiscountType: 'amount', hasServiceCharge: false, hasVat: false, isSushiroMode: false });
    setShowResetConfirm(false);
  };

  const copyQRToClipboard = (memberId: string, name: string) => {
    vibrate([10, 30, 10]);
    const canvas = document.getElementById(`qr-canvas-${memberId}`) as HTMLCanvasElement;
    if (!canvas) {
      alert("Canvas element not found");
      return;
    }
    try {
      // Modern Safari & standard-compliant way to write async content to clipboard:
      // Passing a Promise to ClipboardItem resolves the iOS Safari permission block.
      const imagePromise = new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Canvas toBlob returned null'));
          }
        }, 'image/png');
      });

      const item = new ClipboardItem({ 'image/png': imagePromise });
      
      navigator.clipboard.write([item])
        .then(() => {
          setCopiedQRId(memberId);
          setTimeout(() => setCopiedQRId(null), 2000);
        })
        .catch((err) => {
          console.error("Clipboard copy failed with Promise:", err);
          // Fallback
          fallbackCopyQR(canvas, memberId, name);
        });
    } catch (e) {
      console.error("ClipboardItem promise construction not supported:", e);
      // Fallback
      fallbackCopyQR(canvas, memberId, name);
    }
  };

  const fallbackCopyQR = (canvas: HTMLCanvasElement, memberId: string, name: string) => {
    try {
      canvas.toBlob((blob) => {
        if (!blob) {
          downloadQRImage(memberId, name);
          return;
        }
        const item = new ClipboardItem({ 'image/png': blob });
        navigator.clipboard.write([item])
          .then(() => {
            setCopiedQRId(memberId);
            setTimeout(() => setCopiedQRId(null), 2000);
          })
          .catch((err) => {
            console.error("Fallback Clipboard copy failed:", err);
            downloadQRImage(memberId, name);
          });
      }, 'image/png');
    } catch (err) {
      console.error(err);
      downloadQRImage(memberId, name);
    }
  };

  const downloadQRImage = (memberId: string, name: string) => {
    vibrate(10);
    const canvas = document.getElementById(`qr-canvas-${memberId}`) as HTMLCanvasElement;
    if (!canvas) return;
    try {
      const url = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `PromptPay-QR-${name || 'Member'}.png`;
      link.href = url;
      link.click();
    } catch (e) {
      console.error(e);
    }
  };

  const triggerSpectacularEffect = () => {
    vibrate([30, 50, 30, 50, 30, 50, 30]);
    const duration = 3 * 1000;
    const end = Date.now() + duration;

    (function frame() {
      // launch a few confetti from the left edge
      confetti({
        particleCount: 7,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#a855f7', '#6366f1', '#ec4899']
      });
      // and launch a few from the right edge
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsScanning(true);
      const reader = new FileReader();
      
      reader.onloadend = async () => {
        const base64Data = reader.result as string;
        // strip data:image/...;base64,
        const base64Image = base64Data.split(',')[1];
        
        try {
          const items = await scanReceipt(base64Image, file.type);
          if (items && items.length > 0) {
            // Remove the default person if it's empty
            const currentPeople = people.length === 1 && people[0].name === t('personDefaultName') && people[0].items.length === 0 
              ? [] 
              : people;

            const newPeople: Person[] = [];
            const splitQuantities = settings.splitScanItemsByQuantity !== false;

            items.forEach(item => {
              const qty = (item.quantity && item.quantity > 0) ? item.quantity : 1;
              const unitPrice = item.price / qty;
              
              if (splitQuantities) {
                for (let i = 0; i < qty; i++) {
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
                for (let i = 0; i < qty; i++) {
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

            // Make sure not to be in Sushiro mode
            setSettings(prev => ({ ...prev, isSushiroMode: false }));
            setPeople([...currentPeople, ...newPeople]);
            vibrate([10, 30, 20]);
          }
        } catch (err) {
          console.error(err);
          const errorMessage = err instanceof Error ? err.message : String(err);
          alert(`${t('scanFailed')}\n\nDetails: ${errorMessage}`);
          vibrate([30, 50, 30]);
        } finally {
          setIsScanning(false);
          // Reset file input
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      };

      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      alert(t('scanFailed'));
      vibrate([30, 50, 30]);
      setIsScanning(false);
    }
  };

  return (
    <div className="min-h-screen pb-40 bg-slate-50/50 w-full overflow-x-hidden">
      <header className="sticky top-0 z-30 bg-white/50 backdrop-blur-3xl saturate-[1.3] border-b border-white/40 px-6 py-5 shadow-[0_4px_30px_rgba(0,0,0,0.03)]">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { vibrate(10); setIsDarkMode(!isDarkMode); }}
              className="w-12 h-12 shrink-0 vibrant-gradient rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-200 hover:scale-105 active:scale-95 transition-all outline-none"
              title="Toggle Dark Mode"
            >
              <Receipt size={24} strokeWidth={2.5} />
            </button>
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-indigo-600 font-black mt-1">
                {settings.isSushiroMode ? `🍣 ${t('sushiroMode')}` : `🍛 ${t('smartSplitter')}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { vibrate(10); i18n.changeLanguage(i18n.language === 'th' ? 'en' : 'th'); }}
              className="w-11 h-11 flex items-center justify-center shrink-0 rounded-xl border border-slate-200 bg-white/80 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors text-sm font-black uppercase tracking-widest shadow-sm"
              title="Change Language"
            >
              {i18n.language === 'th' ? 'EN' : 'TH'}
            </button>
            <motion.button 
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => { vibrate(10); setSettings({ ...settings, isSushiroMode: !settings.isSushiroMode }); }}
              className={`w-11 h-11 flex items-center justify-center shrink-0 rounded-xl border transition-all text-xl shadow-sm ${
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
                <h3 className="font-black text-xl text-slate-900">{t('clearConfirmTitle')}</h3>
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
            <h2 className="text-xs font-black uppercase tracking-[0.2em]">{t('globalSettings')}</h2>
          </div>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-4">
            <div className="flex-[1.5] min-w-0 space-y-3">
              <div className="flex items-center justify-between ml-1">
                <label className="text-sm font-bold text-slate-600">{t('sharedDiscount')}</label>
                <div className="flex bg-slate-200/50 p-0.5 rounded-lg shrink-0">
                  <button 
                    onClick={() => { vibrate(10); setSettings({ ...settings, sharedDiscountType: 'amount' }); }}
                    className={`px-3 py-1 rounded-md text-sm font-black transition-all ${settings.sharedDiscountType === 'amount' || !settings.sharedDiscountType ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >฿</button>
                  <button 
                    onClick={() => { vibrate(10); setSettings({ ...settings, sharedDiscountType: 'percentage' }); }}
                    className={`px-3 py-1 rounded-md text-sm font-black transition-all ${settings.sharedDiscountType === 'percentage' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >%</button>
                </div>
              </div>
              <div className="relative group">
                <input 
                  type="number"
                  inputMode="decimal"
                  value={settings.sharedDiscount || ''}
                  onChange={(e) => setSettings({ ...settings, sharedDiscount: Number(e.target.value) })}
                  className="w-full glass-input rounded-[1.25rem] px-5 py-4 font-bold text-lg text-slate-900 placeholder:text-slate-500"
                  placeholder="0.00"
                />
                <span className="absolute right-5 top-1/2 -translate-y-1/2 text-indigo-500 font-black">
                  {settings.sharedDiscountType === 'percentage' ? '%' : '฿'}
                </span>
              </div>
            </div>

            <div className="flex-1 flex gap-3">
              <button 
                onClick={() => { vibrate(10); setSettings({ ...settings, hasServiceCharge: !settings.hasServiceCharge }); }}
                className={`flex-1 h-[56px] rounded-[1.25rem] border transition-all flex flex-col items-center justify-center outline-none px-2 ${
                  settings.hasServiceCharge 
                    ? 'vibrant-gradient-light border-transparent text-white shadow-[0_8px_16px_rgba(99,102,241,0.2)]' 
                    : 'glass-input text-slate-600 hover:text-slate-800'
                }`}
              >
                <span className="text-xs font-black uppercase leading-tight text-center relative z-10">SVC 10%</span>
                <div className={`w-1.5 h-1.5 rounded-full mt-1.5 transition-all relative z-10 ${settings.hasServiceCharge ? 'bg-white scale-125' : 'bg-slate-400'}`} />
              </button>
              
              <button 
                onClick={() => { vibrate(10); setSettings({ ...settings, hasVat: !settings.hasVat }); }}
                className={`flex-1 h-[56px] rounded-[1.25rem] border transition-all flex flex-col items-center justify-center outline-none px-2 ${
                  settings.hasVat 
                    ? 'vibrant-gradient-light border-transparent text-white shadow-[0_8px_16px_rgba(99,102,241,0.2)]' 
                    : 'glass-input text-slate-600 hover:text-slate-800'
                }`}
              >
                <span className="text-xs font-black uppercase leading-tight text-center relative z-10">VAT 7%</span>
                <div className={`w-1.5 h-1.5 rounded-full mt-1.5 transition-all relative z-10 ${settings.hasVat ? 'bg-white scale-125' : 'bg-slate-400'}`} />
              </button>
            </div>
          </div>
        </section>

        {/* Participants Content */}
        <div className="space-y-6">
          <div className="flex items-center justify-between px-3">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-600 flex items-center gap-2">
              <Users size={18} />
              {t('members')} ({people.length})
            </h2>
          </div>

          <AnimatePresence initial={false}>
            {people.map((person) => (
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
                        <span className="text-base font-black">{(people.indexOf(person) + 1)}</span>
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
                        className="p-3 text-slate-400 hover:text-rose-600 hover:bg-rose-100 rounded-2xl transition-all"
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
                            <motion.div 
                              key={item.id}
                              layout
                              transition={{ duration: 0.2, ease: "easeOut" }}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: 20, transition: { duration: 0.2 } }}
                              className="flex items-center gap-2 sm:gap-3 bg-white/40 backdrop-blur-md px-3 sm:px-4 py-2 sm:py-3 rounded-[1.25rem] group/item border border-white/50 focus-within:bg-white/80 transition-all shadow-[0_2px_10px_rgba(0,0,0,0.02)]"
                            >
                              <input 
                                type="text"
                                value={item.name}
                                onChange={(e) => updateItem(person.id, item.id, { name: e.target.value })}
                                className="flex-1 min-w-0 text-base bg-transparent border-none focus:ring-0 p-0 placeholder:text-slate-500 font-semibold text-slate-900"
                                placeholder={t('itemNamePlaceholder')}
                              />
                              <div className="relative group/price shrink-0">
                                <input 
                                  type="number"
                                  inputMode="decimal"
                                  value={item.price || ''}
                                  onChange={(e) => updateItem(person.id, item.id, { price: Number(e.target.value) })}
                                  className="w-20 sm:w-24 text-base font-extrabold glass-input rounded-xl px-2 sm:px-3 py-2 focus:ring-2 focus:ring-indigo-500 text-right text-slate-900 focus:scale-[1.03] transition-transform"
                                  placeholder="0"
                                  ref={(el) => {
                                    if (el && focusTargetItemId === item.id) {
                                      el.focus();
                                      setFocusTargetItemId(null);
                                    }
                                  }}
                                />
                                <span className="absolute -left-3 sm:-left-3.5 top-1/2 -translate-y-1/2 text-sm text-indigo-500 font-black">฿</span>
                              </div>
                              <button 
                                onClick={() => removeItem(person.id, item.id)}
                                className="p-1 sm:p-1.5 text-slate-500 hover:text-orange-600 transition-colors shrink-0"
                              >
                                <X size={18} />
                              </button>
                            </motion.div>
                          ))}
                        </AnimatePresence>

                        <button 
                          onClick={() => addItem(person.id)}
                          className="w-full py-4 border-2 border-dashed border-slate-300 rounded-[1.25rem] text-slate-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/50 transition-all flex items-center justify-center gap-3 group/add"
                        >
                          <Plus size={18} className="group-hover/add:scale-125 transition-transform" />
                          <span className="text-xs font-black uppercase tracking-widest">{t('addItem')}</span>
                        </button>
                      </>
                    ) : (
                      <div className="grid grid-cols-5 gap-2">
                        {/* Sushiro Plate Counters */}
                        {[
                          { color: 'white' as const, emoji: '⚪️', label: '30' },
                          { color: 'red' as const, emoji: '🔴', label: '40' },
                          { color: 'silver' as const, emoji: '🔘', label: '60' }, // Using radio group for silver
                          { color: 'gold' as const, emoji: '🟡', label: '80' },
                          { color: 'black' as const, emoji: '⚫️', label: '100' }
                        ].map((p) => (
                          <div key={p.color} className="flex flex-col items-center gap-2">
                            <span className="text-sm font-black text-slate-600">{p.label}฿</span>
                            <button 
                              onClick={() => updatePlateCount(person.id, p.color, 1)}
                              className="w-full aspect-square rounded-2xl bg-white/50 backdrop-blur-md border border-white flex items-center justify-center text-xl hover:bg-white hover:border-indigo-200 hover:shadow-sm active:scale-95 transition-all relative overflow-hidden group shadow-[0_2px_8px_rgba(0,0,0,0.02)]"
                            >
                              {p.emoji}
                              <div className="absolute top-0 right-0 p-1 opacity-0 group-hover:opacity-100">
                                <Plus size={10} className="text-indigo-500" />
                              </div>
                            </button>
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => updatePlateCount(person.id, p.color, -1)}
                                className="w-5 h-5 rounded-full bg-white/60 border border-white flex items-center justify-center text-slate-500 hover:bg-rose-50 hover:text-rose-500 hover:border-rose-100 transition-colors shadow-sm"
                              >
                                <Minus size={10} />
                              </button>
                              <span className="text-base font-black text-slate-900 w-4 text-center">{person.plates?.[p.color] || 0}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-6 border-t border-slate-50 flex items-end justify-between">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-500 uppercase tracking-widest leading-none block ml-1">{t('individualDiscount')}</label>
                      <div className="relative w-32 group/disc">
                        <input 
                          type="number"
                          inputMode="decimal"
                          value={person.individualDiscount || ''}
                          onChange={(e) => updateIndividualDiscount(person.id, Number(e.target.value))}
                          className="w-full text-base font-bold glass-input rounded-[1rem] px-4 py-2.5 placeholder:text-slate-500 text-slate-900"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black text-slate-600 uppercase tracking-widest mb-1">{t('yourTotal')}</p>
                      <p className="text-3xl font-black text-indigo-700 tabular-nums tracking-tighter">
                        ฿{breakdown.peopleTotals.find(pt => pt.personId === person.id)?.finalShare.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                  <span className="text-xs font-black uppercase tracking-[0.2em] text-center">{t('addMember')}</span>
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
                  <span className="text-xs font-black uppercase tracking-[0.2em] text-center">{isScanning ? t('scanning') : t('scanReceipt')}</span>
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
                  onClick={() => { vibrate(10); setSettings({ ...settings, splitScanItemsByQuantity: settings.splitScanItemsByQuantity === false ? true : false }); }}
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
            <h3 className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2 text-slate-300">
              <ReceiptText size={18} />
              {t('summary')}
            </h3>
            <div className="px-4 py-1.5 bg-slate-800 rounded-full text-xs font-black text-white/80 uppercase tracking-widest border border-slate-700">
              {people.length} {t('persons')}
            </div>
          </div>

          <div className="space-y-5 text-base font-semibold relative z-10">
            <div className="flex justify-between items-center text-slate-400">
              <span>{t('subtotal')}</span>
              <span className="text-white">฿{breakdown.subtotal.toLocaleString()}</span>
            </div>
            
            {(breakdown.totalIndividualDiscounts + breakdown.totalSharedDiscount) > 0 && (
              <div className="flex justify-between items-center text-slate-400">
                <span>{t('totalDiscounts')}</span>
                <span className="text-emerald-400 font-bold">- ฿{(breakdown.totalIndividualDiscounts + breakdown.totalSharedDiscount).toLocaleString()}</span>
              </div>
            )}

            {(settings.hasServiceCharge || settings.hasVat) && (
              <div className="pt-2 flex flex-col gap-3">
                {settings.hasServiceCharge && (
                  <div className="flex justify-between items-center text-slate-400">
                    <span>Service Charge (10%)</span>
                    <span className="text-indigo-200">฿{breakdown.serviceChargeTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                {settings.hasVat && (
                  <div className="flex justify-between items-center text-slate-400">
                    <span>VAT (7%)</span>
                    <span className="text-indigo-200">฿{breakdown.vatTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
              </div>
            )}

            <div className="pt-6 border-t border-white/10 space-y-4">
              <h4 className="text-xs font-black uppercase tracking-[0.2em] text-slate-300">{t('individualTotals')}</h4>
              <div className="grid grid-cols-1 gap-3">
                {people.map(p => {
                  const pt = breakdown.peopleTotals.find(total => total.personId === p.id);
                  if (!pt) return null;
                  return (
                    <div key={p.id} className="flex items-center justify-between py-1 px-1 group">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-lg bg-slate-800 flex items-center justify-center text-[9px] font-black text-slate-300 group-hover:text-indigo-400 transition-colors">
                          {p.name.charAt(0)}
                        </div>
                        <span className="text-base font-bold text-slate-200 group-hover:text-white transition-colors">{p.name}</span>
                      </div>
                      <span className="text-base font-black text-white tabular-nums">฿{pt.finalShare.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-8 border-t border-white/10 flex justify-between items-end">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">{t('netTotal')}</p>
                <div className="text-5xl font-black text-white tracking-tighter tabular-nums leading-none">
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
              <div className="px-4 py-1.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-full text-xs font-black uppercase tracking-widest border border-indigo-100 dark:border-indigo-900/50">
                {t('qrMode')}
              </div>
            </div>

            <section className="glass-card rounded-[2.5rem] p-7 space-y-4">
              <div className="space-y-1 ml-1 flex items-center gap-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest block">{t('promptPayIdLabel')}</label>
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
                <div className="py-12 text-slate-400 font-semibold text-center select-none space-y-3 w-full">
                  <ReceiptText size={48} className="mx-auto opacity-30 text-slate-600" />
                  <p className="text-sm">{t('invalidAmount')}</p>
                </div>
              ) : !promptPayId ? (
                <div className="py-12 bg-amber-50/50 border border-amber-100 rounded-3xl p-6 text-amber-600 font-semibold text-center select-none space-y-3 w-full">
                  <Phone size={48} className="mx-auto opacity-45 text-amber-500" />
                  <p className="text-sm">{t('enterPromptPayFirst')}</p>
                </div>
              ) : (
                <>
                  <div className="space-y-1">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                      {t('qrFor', { name: selectedMember?.name })}
                    </p>
                    <p className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight tabular-nums">
                      ฿{selectedMemberTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>

                  <div className="p-5 bg-white rounded-3xl shadow-md border border-slate-100 flex items-center justify-center relative group">
                    <QRCodeCanvas 
                      id={`qr-canvas-${selectedMember?.id}`}
                      value={qrPayload}
                      size={200}
                      level="M"
                      includeMargin={true}
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
                      onClick={() => downloadQRImage(selectedMember?.id, selectedMember?.name)}
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
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 pl-1">
                {t('selectPersonToPay')}
              </h3>
              <div className="grid grid-cols-1 gap-2">
                {people.map(p => {
                  const pt = breakdown.peopleTotals.find(total => total.personId === p.id);
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
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black transition-colors ${
                          isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                        }`}>
                          {p.name.charAt(0)}
                        </div>
                        <span className={`text-base font-bold ${
                          isSelected ? 'text-indigo-900 dark:text-indigo-200' : 'text-slate-700 dark:text-slate-200'
                        }`}>{p.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-base font-black tabular-nums ${
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

      <div className="text-center pb-8 pt-4">
        <button 
          onClick={triggerSpectacularEffect}
          className="text-sm font-semibold text-slate-500 hover:text-indigo-500 transition-colors cursor-pointer outline-none active:scale-95"
        >
          {t('credit')}
        </button>
      </div>

      {/* Modern Sticky Footer */}
      <footer className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 w-full max-w-sm px-4">
        <div className="glass-card rounded-[2rem] p-4 flex items-center justify-between gap-4">
          <div className="pl-2">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('netTotal')}</p>
            <p className="text-xl font-black text-slate-900 dark:text-slate-100 tabular-nums tracking-tighter">
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
                    <span className="text-[10px] font-black uppercase tracking-wider">{t('copied')}</span>
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
                    <span className="text-[10px] font-black uppercase tracking-wider">{t('share')}</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
