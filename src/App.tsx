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
  Camera
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Person, Item, BillSettings, CalculationBreakdown, Plates } from './types';
import { scanReceipt } from './services/receiptScanner';

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
  const [showCopied, setShowCopied] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const addPerson = () => {
    const newPerson: Person = {
      id: crypto.randomUUID(),
      name: t('newMemberDefaultName', { count: people.length + 1 }),
      items: [],
      individualDiscount: 0,
      plates: { ...INITIAL_PLATES }
    };
    setPeople([...people, newPerson]);
  };

  const removePerson = (id: string) => {
    if (people.length > 1) {
      setPeople(people.filter(p => p.id !== id));
    }
  };

  const updatePersonName = (id: string, name: string) => {
    setPeople(people.map(p => p.id === id ? { ...p, name } : p));
  };

  const addItem = (personId: string) => {
    setPeople(people.map(p => {
      if (p.id === personId) {
        return {
          ...p,
          items: [...p.items, { id: crypto.randomUUID(), name: '', price: 0 }]
        };
      }
      return p;
    }));
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

  const copySummary = () => {
    let text = t('copyTemplateSubtotal');
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
    setPeople([{ id: '1', name: t('personDefaultName'), items: [], individualDiscount: 0, plates: { ...INITIAL_PLATES } }]);
    setSettings({ sharedDiscount: 0, sharedDiscountType: 'amount', hasServiceCharge: false, hasVat: false, isSushiroMode: false });
    setShowResetConfirm(false);
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

            const newPeople: Person[] = items.map(item => ({
              id: crypto.randomUUID(),
              name: item.name,
              items: [{ id: crypto.randomUUID(), name: item.name, price: item.price }],
              individualDiscount: 0,
              plates: { ...INITIAL_PLATES }
            }));

            // Make sure not to be in Sushiro mode
            setSettings(prev => ({ ...prev, isSushiroMode: false }));
            setPeople([...currentPeople, ...newPeople]);
          }
        } catch (err) {
          console.error(err);
          const errorMessage = err instanceof Error ? err.message : String(err);
          alert(`${t('scanFailed')}\n\nDetails: ${errorMessage}`);
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
      setIsScanning(false);
    }
  };

  return (
    <div className="min-h-screen pb-40 bg-slate-50/50">
      <header className="sticky top-0 z-30 bg-white/70 backdrop-blur-2xl border-b border-indigo-50 px-6 py-5 shadow-[0_4px_20px_rgba(99,102,241,0.05)]">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 vibrant-gradient rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-200">
              <Receipt size={24} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="font-extrabold text-2xl tracking-tighter text-slate-900 leading-none">{t('appTitle')}</h1>
              <p className="text-[10px] uppercase tracking-[0.25em] text-indigo-500 font-bold mt-1">
                {settings.isSushiroMode ? `🍣 ${t('sushiroMode')}` : `🍛 ${t('smartSplitter')}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => i18n.changeLanguage(i18n.language === 'th' ? 'en' : 'th')}
              className="p-3 rounded-xl border border-slate-100 bg-white text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 transition-colors text-xs font-black uppercase tracking-widest"
              title="Change Language"
            >
              {i18n.language === 'th' ? 'EN' : 'TH'}
            </button>
            <motion.button 
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setSettings({ ...settings, isSushiroMode: !settings.isSushiroMode })}
              className={`p-3 rounded-xl border transition-all text-xl ${
                settings.isSushiroMode 
                  ? 'bg-orange-50 border-orange-200 text-orange-500 shadow-sm' 
                  : 'bg-white border-slate-100 text-slate-300'
              }`}
              title={t('toggleSushiro')}
            >
              🍣
            </motion.button>
            <motion.button 
              whileHover={{ scale: 1.1, rotate: 5 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowResetConfirm(true)}
              className="p-3 text-slate-300 hover:text-rose-500 transition-colors bg-white rounded-xl border border-slate-100"
              title={t('clearAll')}
            >
              <Trash2 size={22} />
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
                <p className="text-sm font-medium text-slate-500">{t('clearConfirmDesc')}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => setShowResetConfirm(false)}
                  className="py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold text-sm transition-all"
                >
                  {t('cancel')}
                </button>
                <button 
                  onClick={resetAll}
                  className="py-4 bg-rose-500 text-white rounded-2xl font-bold text-sm shadow-lg shadow-rose-200 transition-all hover:bg-rose-600"
                >
                  {t('clear')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="max-w-xl mx-auto p-4 space-y-8">
        {/* Global Settings Section */}
        <section className="glass-card rounded-[2.5rem] p-7 space-y-6">
          <div className="flex items-center gap-2 text-indigo-500 px-1">
            <Settings2 size={18} />
            <h2 className="text-[11px] font-black uppercase tracking-[0.2em]">{t('globalSettings')}</h2>
          </div>
          
          <div className="flex flex-row items-end gap-3">
            <div className="flex-[2] min-w-0 space-y-3">
              <div className="flex items-center justify-between ml-1">
                <label className="text-xs font-bold text-slate-500">{t('sharedDiscount')}</label>
                <div className="flex bg-slate-100 p-0.5 rounded-lg shrink-0">
                  <button 
                    onClick={() => setSettings({ ...settings, sharedDiscountType: 'amount' })}
                    className={`px-3 py-1 rounded-md text-[10px] font-black transition-all ${settings.sharedDiscountType === 'amount' || !settings.sharedDiscountType ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                  >฿</button>
                  <button 
                    onClick={() => setSettings({ ...settings, sharedDiscountType: 'percentage' })}
                    className={`px-3 py-1 rounded-md text-[10px] font-black transition-all ${settings.sharedDiscountType === 'percentage' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                  >%</button>
                </div>
              </div>
              <div className="relative group">
                <input 
                  type="number"
                  inputMode="decimal"
                  value={settings.sharedDiscount || ''}
                  onChange={(e) => setSettings({ ...settings, sharedDiscount: Number(e.target.value) })}
                  className="w-full bg-slate-50 border-2 border-transparent group-focus-within:border-indigo-500/30 group-focus-within:bg-white rounded-[1.25rem] px-5 py-4 outline-none transition-all font-bold text-lg text-slate-800 placeholder:text-slate-300"
                  placeholder="0.00"
                />
                <span className="absolute right-5 top-1/2 -translate-y-1/2 text-indigo-400 font-black">
                  {settings.sharedDiscountType === 'percentage' ? '%' : '฿'}
                </span>
              </div>
            </div>

            <button 
              onClick={() => setSettings({ ...settings, hasServiceCharge: !settings.hasServiceCharge })}
              className={`flex-1 h-[62px] rounded-[1.25rem] border-2 transition-all flex flex-col items-center justify-center outline-none px-2 ${
                settings.hasServiceCharge 
                  ? 'bg-indigo-500 border-indigo-500 text-white shadow-lg shadow-indigo-100' 
                  : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'
              }`}
            >
              <span className="text-[10px] font-black uppercase leading-tight text-center">SVC 10%</span>
              <div className={`w-1.5 h-1.5 rounded-full mt-1.5 transition-all ${settings.hasServiceCharge ? 'bg-white scale-125' : 'bg-slate-200'}`} />
            </button>
            
            <button 
              onClick={() => setSettings({ ...settings, hasVat: !settings.hasVat })}
              className={`flex-1 h-[62px] rounded-[1.25rem] border-2 transition-all flex flex-col items-center justify-center outline-none px-2 ${
                settings.hasVat 
                  ? 'bg-indigo-500 border-indigo-500 text-white shadow-lg shadow-indigo-100' 
                  : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'
              }`}
            >
              <span className="text-[10px] font-black uppercase leading-tight text-center">VAT 7%</span>
              <div className={`w-1.5 h-1.5 rounded-full mt-1.5 transition-all ${settings.hasVat ? 'bg-white scale-125' : 'bg-slate-200'}`} />
            </button>
          </div>
        </section>

        {/* Participants Content */}
        <div className="space-y-6">
          <div className="flex items-center justify-between px-3">
            <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
              <Users size={18} />
              {t('members')} ({people.length})
            </h2>
          </div>

          <AnimatePresence initial={false}>
            {people.map((person) => (
              <motion.div 
                key={person.id}
                layout
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                className="bg-white rounded-[2.5rem] overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.03)] border border-slate-100/60 group"
              >
                <div className="p-7 space-y-7">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-500 shrink-0">
                        <span className="text-sm font-black">{(people.indexOf(person) + 1)}</span>
                      </div>
                      <input 
                        type="text"
                        value={person.name}
                        onChange={(e) => updatePersonName(person.id, e.target.value)}
                        className="text-xl font-extrabold bg-transparent border-none p-0 focus:ring-0 w-full placeholder:text-slate-200 text-slate-800"
                        placeholder={t('memberNamePlaceholder')}
                      />
                    </div>
                    {people.length > 1 && (
                      <button 
                        onClick={() => removePerson(person.id)}
                        className="p-3 text-slate-200 hover:text-rose-500 hover:bg-rose-50 rounded-2xl transition-all"
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
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: 20 }}
                              className="flex items-center gap-3 bg-slate-50/70 px-4 py-3 rounded-[1.25rem] group/item border-2 border-transparent focus-within:border-indigo-100 focus-within:bg-white transition-all shadow-sm"
                            >
                              <input 
                                type="text"
                                value={item.name}
                                onChange={(e) => updateItem(person.id, item.id, { name: e.target.value })}
                                className="flex-1 text-sm bg-transparent border-none focus:ring-0 p-0 placeholder:text-slate-300 font-semibold text-slate-600"
                                placeholder={t('itemNamePlaceholder')}
                              />
                              <div className="relative group/price">
                                <input 
                                  type="number"
                                  inputMode="decimal"
                                  value={item.price || ''}
                                  onChange={(e) => updateItem(person.id, item.id, { price: Number(e.target.value) })}
                                  className="w-24 text-sm font-extrabold bg-white border border-slate-100 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none text-right transition-all shadow-inner"
                                  placeholder="0"
                                />
                                <span className="absolute -left-3.5 top-1/2 -translate-y-1/2 text-[10px] text-indigo-400 font-black">฿</span>
                              </div>
                              <button 
                                onClick={() => removeItem(person.id, item.id)}
                                className="p-1.5 text-slate-300 hover:text-orange-500 transition-colors"
                              >
                                <X size={18} />
                              </button>
                            </motion.div>
                          ))}
                        </AnimatePresence>

                        <button 
                          onClick={() => addItem(person.id)}
                          className="w-full py-4 border-2 border-dashed border-slate-100 rounded-[1.25rem] text-slate-400 hover:border-indigo-400 hover:text-indigo-500 hover:bg-indigo-50/30 transition-all flex items-center justify-center gap-3 group/add"
                        >
                          <Plus size={18} className="group-hover/add:scale-125 transition-transform" />
                          <span className="text-[11px] font-black uppercase tracking-widest">{t('addItem')}</span>
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
                            <span className="text-[10px] font-black text-slate-400">{p.label}฿</span>
                            <button 
                              onClick={() => updatePlateCount(person.id, p.color, 1)}
                              className="w-full aspect-square rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-xl hover:bg-white hover:border-indigo-200 hover:shadow-sm active:scale-95 transition-all relative overflow-hidden group"
                            >
                              {p.emoji}
                              <div className="absolute top-0 right-0 p-1 opacity-0 group-hover:opacity-100">
                                <Plus size={10} className="text-indigo-400" />
                              </div>
                            </button>
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => updatePlateCount(person.id, p.color, -1)}
                                className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-colors"
                              >
                                <Minus size={10} />
                              </button>
                              <span className="text-sm font-black text-slate-800 w-4 text-center">{person.plates?.[p.color] || 0}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-6 border-t border-slate-50 flex items-end justify-between">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest leading-none block ml-1">{t('individualDiscount')}</label>
                      <div className="relative w-32 group/disc">
                        <input 
                          type="number"
                          inputMode="decimal"
                          value={person.individualDiscount || ''}
                          onChange={(e) => updateIndividualDiscount(person.id, Number(e.target.value))}
                          className="w-full text-sm font-bold bg-slate-50 border-2 border-transparent group-focus-within/disc:border-indigo-200 rounded-[1rem] px-4 py-2.5 outline-none transition-all placeholder:text-slate-200"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('yourTotal')}</p>
                      <p className="text-3xl font-black text-indigo-600 tabular-nums tracking-tighter">
                        ฿{breakdown.peopleTotals.find(pt => pt.personId === person.id)?.finalShare.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={addPerson}
              className="w-full py-4 rounded-[2rem] bg-indigo-50/30 border-2 border-dashed border-indigo-100 text-indigo-400 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-600 transition-all flex flex-col items-center justify-center gap-2 active:scale-[0.98]"
            >
              <div className="p-2 bg-white rounded-xl shadow-sm border border-indigo-50 text-indigo-500">
                <UserPlus size={20} strokeWidth={2.5} />
              </div>
              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-center">{t('addMember')}</span>
            </button>

            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isScanning}
              className="w-full py-4 rounded-[2rem] bg-indigo-50/30 border-2 border-dashed border-indigo-100 text-indigo-400 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-600 transition-all flex flex-col items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
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
              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-center">{isScanning ? t('scanning') : t('scanReceipt')}</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleFileUpload}
            />
          </div>
        </div>

        {/* Detailed Summary Card */}
        <section className="bg-slate-900 rounded-[3rem] p-9 text-slate-400 space-y-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full -mr-32 -mt-32 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 rounded-full -ml-32 -mb-32 blur-3xl" />
          
          <div className="flex items-center justify-between relative z-10">
            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] flex items-center gap-2 text-white/50">
              <ReceiptText size={18} />
              {t('summary')}
            </h3>
            <div className="px-4 py-1.5 bg-slate-800 rounded-full text-[10px] font-black text-white/80 uppercase tracking-widest border border-slate-700">
              {people.length} {t('persons')}
            </div>
          </div>

          <div className="space-y-5 text-sm font-semibold relative z-10">
            <div className="flex justify-between items-center text-slate-500">
              <span>{t('subtotal')}</span>
              <span className="text-slate-200">฿{breakdown.subtotal.toLocaleString()}</span>
            </div>
            
            {(breakdown.totalIndividualDiscounts + breakdown.totalSharedDiscount) > 0 && (
              <div className="flex justify-between items-center text-slate-500">
                <span>{t('totalDiscounts')}</span>
                <span className="text-emerald-400 font-bold">- ฿{(breakdown.totalIndividualDiscounts + breakdown.totalSharedDiscount).toLocaleString()}</span>
              </div>
            )}

            {(settings.hasServiceCharge || settings.hasVat) && (
              <div className="pt-2 flex flex-col gap-3">
                {settings.hasServiceCharge && (
                  <div className="flex justify-between items-center text-slate-500">
                    <span>Service Charge (10%)</span>
                    <span className="text-indigo-300">฿{breakdown.serviceChargeTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                {settings.hasVat && (
                  <div className="flex justify-between items-center text-slate-500">
                    <span>VAT (7%)</span>
                    <span className="text-indigo-300">฿{breakdown.vatTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
              </div>
            )}

            <div className="pt-6 border-t border-slate-800/50 space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{t('individualTotals')}</h4>
              <div className="grid grid-cols-1 gap-3">
                {people.map(p => {
                  const pt = breakdown.peopleTotals.find(total => total.personId === p.id);
                  if (!pt) return null;
                  return (
                    <div key={p.id} className="flex items-center justify-between py-1 px-1 group">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-lg bg-slate-800 flex items-center justify-center text-[9px] font-black text-slate-400 group-hover:text-indigo-400 transition-colors">
                          {p.name.charAt(0)}
                        </div>
                        <span className="text-sm font-bold text-slate-300 group-hover:text-white transition-colors">{p.name}</span>
                      </div>
                      <span className="text-sm font-black text-white tabular-nums">฿{pt.finalShare.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-8 border-t border-slate-800 flex justify-between items-end">
              <div>
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-1">{t('netTotal')}</p>
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

      </main>

      <div className="text-center pb-8 pt-4">
        <p className="text-xs font-medium text-slate-400">
          {t('credit')}
        </p>
      </div>

      {/* Modern Sticky Footer */}
      <footer className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 w-full max-w-sm px-4">
        <div className="bg-white/70 backdrop-blur-3xl border border-white rounded-[2rem] p-4 flex items-center justify-between gap-6 shadow-[0_20px_50px_rgba(0,0,0,0.15)]">
          <div className="pl-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('netTotal')}</p>
            <p className="text-2xl font-black text-slate-900 tabular-nums tracking-tighter">
              ฿{breakdown.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <button 
            onClick={copySummary}
            className="h-14 w-full max-w-[140px] vibrant-gradient text-white rounded-[1.25rem] flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all overflow-hidden relative"
          >
            <AnimatePresence mode="wait">
              {showCopied ? (
                <motion.div 
                  key="copied"
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -20, opacity: 0 }}
                  className="flex items-center gap-2"
                >
                  <Check size={18} strokeWidth={3} />
                  <span className="text-xs font-black uppercase tracking-widest">{t('copied')}</span>
                </motion.div>
              ) : (
                <motion.div 
                  key="share"
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -20, opacity: 0 }}
                  className="flex items-center gap-2"
                >
                  <Share2 size={18} strokeWidth={2.5} />
                  <span className="text-xs font-black uppercase tracking-widest">{t('share')}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </button>
        </div>
      </footer>
    </div>
  );
}
