'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  createDirectWarehouseInvoiceAction,
  adminRecordCollectionAction,
  createBatchAction,
  createProductAndBatchAction,
  createClientAction,
  seedDemoDataAction,
} from '@/lib/actions';
import { Product, Client } from '@/types';
import {
  ShoppingCart,
  HandCoins,
  PackagePlus,
  AlertOctagon,
  Plus,
  Minus,
  CheckCircle2,
  AlertCircle,
  X,
  Boxes,
  Truck,
  Store,
  Building2,
  Scale,
  Users,
  Wallet,
  TrendingUp,
  FileText,
  Sparkles,
} from 'lucide-react';

interface ProductWithStock extends Product {
  warehouseStock: number;
  vanStock: number;
}

interface Props {
  productsWithStock: ProductWithStock[];
  clients: Client[];
  categories: string[];
  treasuryBalance: number;
  totalClientDebts: number;
  totalSupplierPayables: number;
  totalWarehouseUnits: number;
  totalVanUnits: number;
}

export default function AdminQuickOperationsCenter({
  productsWithStock,
  clients,
  categories,
  treasuryBalance,
  totalClientDebts,
  totalSupplierPayables,
  totalWarehouseUnits,
  totalVanUnits,
}: Props) {
  const router = useRouter();
  const [activeModal, setActiveModal] = useState<'pos' | 'collection' | 'stock' | null>(null);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  // 1. Direct Warehouse POS State
  const [posClientId, setPosClientId] = useState(clients[0]?.id || '');
  const [isNewPosClient, setIsNewPosClient] = useState(false);
  const [newPosClientName, setNewPosClientName] = useState('');
  const [newPosClientPhone, setNewPosClientPhone] = useState('');
  const [posCart, setPosCart] = useState<Record<string, number>>({});
  const [posPaymentType, setPosPaymentType] = useState<'cash' | 'credit'>('cash');
  const [posPaidAmount, setPosPaidAmount] = useState('');
  const [posDiscount, setPosDiscount] = useState('');
  const [posNotes, setPosNotes] = useState('');

  // 2. Quick Client Debt Collection State
  const [colClientId, setColClientId] = useState(
    clients.find((c) => c.creditBalance > 0)?.id || clients[0]?.id || ''
  );
  const [colAmount, setColAmount] = useState('');
  const [colNotes, setColNotes] = useState('');

  // 3. Quick Stock Entry State
  const [stockMode, setStockMode] = useState<'existing' | 'new'>('existing');
  const [stockProductId, setStockProductId] = useState(productsWithStock[0]?.id || '');
  const [stockQty, setStockQty] = useState('50');
  const [stockCost, setStockCost] = useState('');
  const [stockExpiryDate, setStockExpiryDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + (productsWithStock[0]?.shelfLifeDays || 7));
    return d.toISOString().slice(0, 16);
  });
  const [newProdName, setNewProdName] = useState('');
  const [newProdCategory, setNewProdCategory] = useState(categories[0] || 'ألبان');
  const [newProdPrice, setNewProdPrice] = useState('');
  const [newProdCost, setNewProdCost] = useState('');
  const [newProdUnit, setNewProdUnit] = useState('كرتونة');
  const [newProdShelfDays, setNewProdShelfDays] = useState('7');

  const applyQuickExpiryDays = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    setStockExpiryDate(d.toISOString().slice(0, 16));
  };

  const lowStockProducts = productsWithStock.filter((p) => p.warehouseStock <= 10);

  const updatePosQty = (productId: string, delta: number, maxStock: number) => {
    setPosCart((prev) => {
      const current = prev[productId] || 0;
      const next = Math.max(0, Math.min(maxStock, current + delta));
      const copy = { ...prev };
      if (next === 0) {
        delete copy[productId];
      } else {
        copy[productId] = next;
      }
      return copy;
    });
  };

  const posSubtotal = Object.entries(posCart).reduce((sum, [pid, qty]) => {
    const prod = productsWithStock.find((p) => p.id === pid);
    return sum + (prod ? prod.price * qty : 0);
  }, 0);
  const posDiscountVal = Math.max(0, Number(posDiscount) || 0);
  const posTotal = Math.max(0, posSubtotal - posDiscountVal);

  const handleIssueDirectInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const items = Object.entries(posCart)
      .filter(([, q]) => q > 0)
      .map(([productId, quantity]) => ({ productId, quantity }));

    if (items.length === 0) {
      setFeedback({ type: 'error', text: 'يرجى اختيار صنف واحد على الأقل من المخزن' });
      return;
    }

    setLoading(true);
    try {
      let targetClientId = posClientId;

      if (isNewPosClient) {
        if (!newPosClientName.trim()) {
          setFeedback({ type: 'error', text: 'يرجى كتابة اسم العميل الجديد' });
          setLoading(false);
          return;
        }
        const fd = new FormData();
        fd.set('name', newPosClientName.trim());
        fd.set('phone', newPosClientPhone.trim());
        const clientRes = await createClientAction(fd);
        if (!clientRes.success || !clientRes.client) {
          setFeedback({ type: 'error', text: clientRes.error || 'فشل إنشاء العميل الجديد' });
          setLoading(false);
          return;
        }
        targetClientId = clientRes.client.id;
      }

      if (!targetClientId) {
        setFeedback({ type: 'error', text: 'يرجى تحديد العميل' });
        setLoading(false);
        return;
      }

      const res = await createDirectWarehouseInvoiceAction({
        clientId: targetClientId,
        paymentType: posPaymentType,
        paidAmount: posPaymentType === 'cash' ? posTotal : Number(posPaidAmount) || 0,
        discount: posDiscountVal,
        notes: posNotes,
        items,
      });

      if (res.success) {
        setFeedback({ type: 'success', text: res.message || 'تم إصدار الفاتورة بنجاح!' });
        setPosCart({});
        setPosDiscount('');
        setPosPaidAmount('');
        setPosNotes('');
        setIsNewPosClient(false);
        setNewPosClientName('');
        router.refresh();
        setTimeout(() => setActiveModal(null), 1200);
      } else {
        setFeedback({ type: 'error', text: res.error || 'حدث خطأ أثناء إصدار الفاتورة' });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleQuickCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setLoading(true);
    try {
      const fd = new FormData();
      fd.set('clientId', colClientId);
      fd.set('amount', colAmount);
      fd.set('notes', colNotes);

      const res = await adminRecordCollectionAction(fd);
      if (res.success) {
        setFeedback({ type: 'success', text: res.message || 'تم تسجيل التحصيل بنجاح!' });
        setColAmount('');
        setColNotes('');
        router.refresh();
        setTimeout(() => setActiveModal(null), 1200);
      } else {
        setFeedback({ type: 'error', text: res.error || 'فشل تسجيل التحصيل' });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleQuickStockEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setLoading(true);
    try {
      const fd = new FormData();
      fd.set('quantity', stockQty);
      fd.set('productionDate', new Date().toISOString());
      if (stockExpiryDate) {
        fd.set('expiryDate', new Date(stockExpiryDate).toISOString());
      }

      if (stockMode === 'existing') {
        fd.set('productId', stockProductId);
        if (stockCost) fd.set('unitCost', stockCost);
        const res = await createBatchAction(fd);
        if (res.success) {
          setFeedback({ type: 'success', text: res.message || 'تمت إضافة الكمية للمخزن بنجاح!' });
          router.refresh();
          setTimeout(() => setActiveModal(null), 1200);
        } else {
          setFeedback({ type: 'error', text: res.error || 'فشل إضافة التشغيلة' });
        }
      } else {
        fd.set('name', newProdName);
        fd.set('category', newProdCategory);
        fd.set('price', newProdPrice);
        fd.set('cost', newProdCost);
        fd.set('unit', newProdUnit);
        fd.set('shelfLifeDays', newProdShelfDays);
        const res = await createProductAndBatchAction(fd);
        if (res.success) {
          setFeedback({ type: 'success', text: res.message || 'تم تعريف الصنف وإضافة رصيده بنجاح!' });
          setNewProdName('');
          setNewProdPrice('');
          setNewProdCost('');
          router.refresh();
          setTimeout(() => setActiveModal(null), 1200);
        } else {
          setFeedback({ type: 'error', text: res.error || 'فشل تعريف الصنف' });
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const [seedingDemo, setSeedingDemo] = useState(false);

  const handleLoadDemoData = async () => {
    setSeedingDemo(true);
    setFeedback(null);
    try {
      const res = await seedDemoDataAction();
      if (res.success) {
        setFeedback({ type: 'success', text: res.message || 'تم تحميل البيانات التجريبية بنجاح!' });
        router.refresh();
      } else {
        setFeedback({ type: 'error', text: res.error || 'فشل تحميل البيانات التجريبية' });
      }
    } finally {
      setSeedingDemo(false);
    }
  };

  const selectedColClient = clients.find((c) => c.id === colClientId);

  return (
    <div className="space-y-6">
      {/* 1. QUICK OPERATIONS HUB FOR MANAGER (مركز العمليات السريعة للمدير) */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20 shrink-0">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900">
                مركز العمليات السريعة (تنفيذ فوري بضغطة واحدة)
              </h2>
              <p className="text-xs text-slate-500">
                كل ما يحتاجه مدير المخازن والمناديب من بيع مباشر وتوريد وتحصيل وتحميل سيارات في مكان واحد مبسط
              </p>
            </div>
          </div>

          {/* 3 Primary Instant Action Modals */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setFeedback(null);
                setActiveModal('pos');
              }}
              className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md shadow-emerald-600/20 flex items-center gap-2 transition cursor-pointer"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>+ فاتورة بيع مباشر من المخزن</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setFeedback(null);
                setActiveModal('collection');
              }}
              className="px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-black shadow-md shadow-amber-500/20 flex items-center gap-2 transition cursor-pointer"
            >
              <HandCoins className="w-4 h-4" />
              <span>+ تحصيل نقدية من عميل</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setFeedback(null);
                setActiveModal('stock');
              }}
              className="px-4 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black shadow-md flex items-center gap-2 transition cursor-pointer"
            >
              <PackagePlus className="w-4 h-4 text-emerald-400" />
              <span>+ إدخال بضاعة / صنف للمخزن</span>
            </button>

            <button
              type="button"
              onClick={handleLoadDemoData}
              disabled={seedingDemo}
              title="تحميل بيانات تجريبية متكاملة لعرض النظام للعملاء"
              className="px-3.5 py-2.5 rounded-2xl bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white border border-indigo-200 text-xs font-black flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              <span>{seedingDemo ? 'جاري تحميل الديمو...' : 'تحميل بيانات تجريبية (Demo)'}</span>
            </button>
          </div>
        </div>

        {feedback && !activeModal && (
          <div
            className={`p-3.5 rounded-2xl border flex items-center gap-2 text-xs font-bold ${
              feedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{feedback.text}</span>
          </div>
        )}

        {/* Complete ERP Snapshot Cards (المخزون والسيولة والديون) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <Link
            href="/admin/inventory"
            className="p-3.5 rounded-2xl bg-slate-50 hover:bg-emerald-50/60 border border-slate-200 hover:border-emerald-300 transition group"
          >
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1">
              <span>رصيد المخزن الرئيسي</span>
              <Boxes className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition" />
            </div>
            <div className="text-xl font-black text-slate-900">
              {totalWarehouseUnits.toLocaleString('ar-EG')}{' '}
              <span className="text-[11px] font-bold text-slate-500">كرتونة</span>
            </div>
            <div className="text-[10px] text-emerald-700 font-bold mt-1">
              {productsWithStock.length} صنف مسجل
            </div>
          </Link>

          <Link
            href="/admin/dispatch"
            className="p-3.5 rounded-2xl bg-slate-50 hover:bg-blue-50/60 border border-slate-200 hover:border-blue-300 transition group"
          >
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1">
              <span>بضاعة بسيارات المناديب</span>
              <Truck className="w-4 h-4 text-blue-600 group-hover:scale-110 transition" />
            </div>
            <div className="text-xl font-black text-blue-700">
              {totalVanUnits.toLocaleString('ar-EG')}{' '}
              <span className="text-[11px] font-bold text-slate-500">كرتونة</span>
            </div>
            <div className="text-[10px] text-blue-600 font-bold mt-1">
              عهدة جارية في الميدان
            </div>
          </Link>

          <Link
            href="/admin/profit-loss"
            className="p-3.5 rounded-2xl bg-slate-50 hover:bg-teal-50/60 border border-slate-200 hover:border-teal-300 transition group"
          >
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1">
              <span>النقدية الفعلية بالخزينة</span>
              <Wallet className="w-4 h-4 text-teal-600 group-hover:scale-110 transition" />
            </div>
            <div
              className={`text-xl font-black ${
                treasuryBalance >= 0 ? 'text-teal-700' : 'text-rose-600'
              }`}
            >
              {treasuryBalance.toLocaleString('ar-EG')}{' '}
              <span className="text-[11px] font-bold text-slate-500">ج.م</span>
            </div>
            <div className="text-[10px] text-teal-700 font-bold mt-1">
              السيولة المتاحة حالياً
            </div>
          </Link>

          <Link
            href="/admin/clients"
            className="p-3.5 rounded-2xl bg-slate-50 hover:bg-amber-50/60 border border-slate-200 hover:border-amber-300 transition group"
          >
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1">
              <span>مديونيات العملاء بالسوق</span>
              <Store className="w-4 h-4 text-amber-600 group-hover:scale-110 transition" />
            </div>
            <div className="text-xl font-black text-amber-700">
              {totalClientDebts.toLocaleString('ar-EG')}{' '}
              <span className="text-[11px] font-bold text-slate-500">ج.م</span>
            </div>
            <div className="text-[10px] text-amber-700 font-bold mt-1">
              مستحقات آجلة للتحصيل
            </div>
          </Link>

          <Link
            href="/admin/suppliers"
            className="p-3.5 rounded-2xl bg-slate-50 hover:bg-purple-50/60 border border-slate-200 hover:border-purple-300 transition group col-span-2 sm:col-span-1"
          >
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1">
              <span>مستحقات الموردين</span>
              <Building2 className="w-4 h-4 text-purple-600 group-hover:scale-110 transition" />
            </div>
            <div className="text-xl font-black text-purple-700">
              {totalSupplierPayables.toLocaleString('ar-EG')}{' '}
              <span className="text-[11px] font-bold text-slate-500">ج.م</span>
            </div>
            <div className="text-[10px] text-purple-700 font-bold mt-1">
              التزامات فواتير الشراء
            </div>
          </Link>
        </div>

        {/* Low Stock / Out of Stock Alert Strip */}
        {lowStockProducts.length > 0 && (
          <div className="p-4 rounded-2xl bg-rose-50/80 border border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0">
                <AlertOctagon className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs sm:text-sm font-black text-rose-950">
                  تنبيه نواقص المخزن ({lowStockProducts.length} أصناف أوشكت على النفاد أو رصيدها صفر)
                </div>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {lowStockProducts.slice(0, 6).map((p) => (
                    <span
                      key={p.id}
                      className="px-2 py-0.5 rounded-lg bg-white border border-rose-200 text-[11px] font-bold text-rose-800"
                    >
                      {p.name}: <strong className="font-black">{p.warehouseStock}</strong> {p.unit}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setStockMode('existing');
                if (lowStockProducts[0]) setStockProductId(lowStockProducts[0].id);
                setFeedback(null);
                setActiveModal('stock');
              }}
              className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shrink-0 transition cursor-pointer self-start sm:self-auto"
            >
              + تزويد رصيد النواقص فوراً
            </button>
          </div>
        )}
      </div>

      {/* MODAL 1: DIRECT WAREHOUSE POS (فاتورة بيع مباشر من المخزن الرئيسي) */}
      {activeModal === 'pos' && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-slate-100 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">
                    إصدار فاتورة بيع مباشر من المخزن الرئيسي
                  </h3>
                  <p className="text-xs text-slate-500">
                    خصم آلي بنظام الأقدم أولاً (FIFO) من رصيد المستودع وتحديث فوري للخزينة والعميل
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {feedback && (
              <div
                className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-bold ${
                  feedback.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                {feedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{feedback.text}</span>
              </div>
            )}

            <form onSubmit={handleIssueDirectInvoice} className="space-y-4">
              {/* Client Selection or New Client */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-700">العميل / المنفذ المستلم</label>
                  <button
                    type="button"
                    onClick={() => setIsNewPosClient(!isNewPosClient)}
                    className="text-xs font-bold text-emerald-600 hover:text-emerald-700 underline"
                  >
                    {isNewPosClient ? 'اختيار من العملاء المسجلين' : '+ عميل جديد سريع'}
                  </button>
                </div>

                {isNewPosClient ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <input
                      type="text"
                      value={newPosClientName}
                      onChange={(e) => setNewPosClientName(e.target.value)}
                      placeholder="اسم العميل أو السوبرماركت *"
                      required
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm"
                    />
                    <input
                      type="text"
                      value={newPosClientPhone}
                      onChange={(e) => setNewPosClientPhone(e.target.value)}
                      placeholder="رقم الهاتف (اختياري)"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm"
                    />
                  </div>
                ) : (
                  <select
                    value={posClientId}
                    onChange={(e) => setPosClientId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-bold text-slate-800"
                  >
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.creditBalance > 0 ? `(مديونية: ${c.creditBalance.toLocaleString('ar-EG')} ج.م)` : '(خالص)'}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Products Stepper List */}
              <div>
                <label className="block text-xs font-black text-slate-700 mb-2">
                  اختر الأصناف والكميات المطلوبة من المخزن الرئيسي
                </label>
                <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-2xl">
                  {productsWithStock.map((prod) => {
                    const selectedQty = posCart[prod.id] || 0;
                    const disabled = prod.warehouseStock <= 0;
                    return (
                      <div
                        key={prod.id}
                        className={`p-3 flex items-center justify-between gap-2 ${
                          selectedQty > 0 ? 'bg-emerald-50/50' : 'bg-white'
                        }`}
                      >
                        <div>
                          <div className="text-xs sm:text-sm font-bold text-slate-900">
                            {prod.name}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            السعر: <strong className="text-emerald-700">{prod.price} ج.م</strong> • المتاح بالمخزن:{' '}
                            <strong
                              className={
                                prod.warehouseStock > 0 ? 'text-slate-800' : 'text-rose-600'
                              }
                            >
                              {prod.warehouseStock} {prod.unit}
                            </strong>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={selectedQty <= 0}
                            onClick={() => updatePosQty(prod.id, -1, prod.warehouseStock)}
                            className="w-8 h-8 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 flex items-center justify-center"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <input
                            type="number"
                            min={0}
                            max={prod.warehouseStock}
                            disabled={disabled}
                            value={selectedQty || ''}
                            placeholder="0"
                            onChange={(e) => {
                              const val = Math.max(
                                0,
                                Math.min(prod.warehouseStock, parseInt(e.target.value, 10) || 0)
                              );
                              setPosCart((prev) => {
                                const next = { ...prev };
                                if (val === 0) delete next[prod.id];
                                else next[prod.id] = val;
                                return next;
                              });
                            }}
                            className="w-14 text-center py-1 rounded-xl border border-slate-200 text-sm font-black"
                          />
                          <button
                            type="button"
                            disabled={disabled || selectedQty >= prod.warehouseStock}
                            onClick={() => updatePosQty(prod.id, 1, prod.warehouseStock)}
                            className="w-8 h-8 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 flex items-center justify-center"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Payment & Discount */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">طريقة الدفع</label>
                  <select
                    value={posPaymentType}
                    onChange={(e) => setPosPaymentType(e.target.value as 'cash' | 'credit')}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold"
                  >
                    <option value="cash">نقدي بالكامل (كاش للخزينة)</option>
                    <option value="credit">آجل / دفعة جزئية</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    خصم على الفاتورة (ج.م)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={posDiscount}
                    onChange={(e) => setPosDiscount(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                  />
                </div>

                {posPaymentType === 'credit' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      المبلغ المدفوع مقدماً (ج.م)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={posTotal}
                      value={posPaidAmount}
                      onChange={(e) => setPosPaidAmount(e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                    />
                  </div>
                )}
              </div>

              {/* Total Bar & Submit */}
              <div className="p-4 rounded-2xl bg-slate-900 text-white flex flex-col sm:flex-row items-center justify-between gap-3">
                <div>
                  <div className="text-xs text-slate-400">صافي الفاتورة النهائي</div>
                  <div className="text-2xl font-black text-emerald-400">
                    {posTotal.toLocaleString('ar-EG')} <span className="text-xs">ج.م</span>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading || posSubtotal <= 0}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-700 text-slate-950 font-black text-xs transition cursor-pointer"
                >
                  {loading ? 'جاري الإصدار...' : 'إصدار الفاتورة وخصم من المخزن'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: QUICK CLIENT COLLECTION (تحصيل نقدية مباشر من عميل) */}
      {activeModal === 'collection' && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                  <HandCoins className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">
                    تحصيل مديونية عميل للخزينة
                  </h3>
                  <p className="text-xs text-slate-500">
                    يتم خصم المبلغ فوراً من مديونية العميل وإيداعه في رصيد الخزينة
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {feedback && (
              <div
                className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-bold ${
                  feedback.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                <span>{feedback.text}</span>
              </div>
            )}

            <form onSubmit={handleQuickCollection} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اختر العميل</label>
                <select
                  value={colClientId}
                  onChange={(e) => {
                    setColClientId(e.target.value);
                    const cl = clients.find((c) => c.id === e.target.value);
                    if (cl && cl.creditBalance > 0) {
                      setColAmount(String(cl.creditBalance));
                    }
                  }}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm font-bold"
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — مديونية: {c.creditBalance.toLocaleString('ar-EG')} ج.م
                    </option>
                  ))}
                </select>
              </div>

              {selectedColClient && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between text-xs">
                  <span className="font-bold text-amber-900">المديونية الحالية على العميل:</span>
                  <span className="font-black text-amber-700 text-sm">
                    {selectedColClient.creditBalance.toLocaleString('ar-EG')} ج.م
                  </span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  المبلغ المحصل نقداً (ج.م) *
                </label>
                <input
                  type="number"
                  min={1}
                  step="any"
                  required
                  value={colAmount}
                  onChange={(e) => setColAmount(e.target.value)}
                  placeholder="أدخل المبلغ المستلم"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm font-black"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ملاحظات الإيصال (اختياري)
                </label>
                <input
                  type="text"
                  value={colNotes}
                  onChange={(e) => setColNotes(e.target.value)}
                  placeholder="مثال: دفعة نقدية بمقر الشركة"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs shadow-md transition cursor-pointer"
              >
                {loading ? 'جاري الحفظ...' : 'تأكيد استلام النقدية وخصم المديونية'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: QUICK STOCK / PRODUCT ENTRY (إدخال بضاعة سريعة للمخزن) */}
      {activeModal === 'stock' && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-slate-900 text-emerald-400 flex items-center justify-center">
                  <PackagePlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">
                    إدخال بضاعة سريعة للمخزن الرئيسي
                  </h3>
                  <p className="text-xs text-slate-500">
                    تزويد رصيد صنف حالي أو تعريف صنف جديد برصيد افتتاحي مباشر
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setStockMode('existing')}
                className={`py-2 rounded-lg text-xs font-black transition ${
                  stockMode === 'existing'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600'
                }`}
              >
                تزويد صنف موجود
              </button>
              <button
                type="button"
                onClick={() => setStockMode('new')}
                className={`py-2 rounded-lg text-xs font-black transition ${
                  stockMode === 'new' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                }`}
              >
                + تعريف صنف جديد
              </button>
            </div>

            {feedback && (
              <div
                className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-bold ${
                  feedback.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                <span>{feedback.text}</span>
              </div>
            )}

            <form onSubmit={handleQuickStockEntry} className="space-y-3">
              {stockMode === 'existing' ? (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      اختر الصنف المراد تزويد رصيده
                    </label>
                    <select
                      value={stockProductId}
                      onChange={(e) => setStockProductId(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm font-bold"
                    >
                      {productsWithStock.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} (الرصيد الحالي: {p.warehouseStock} {p.unit})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        الكمية الواردة للمخزن *
                      </label>
                      <input
                        type="number"
                        min={1}
                        required
                        value={stockQty}
                        onChange={(e) => setStockQty(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-black"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        سعر التكلفة (اختياري)
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={stockCost}
                        onChange={(e) => setStockCost(e.target.value)}
                        placeholder="نفس التكلفة الحالية"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      اسم الصنف الجديد *
                    </label>
                    <input
                      type="text"
                      required
                      value={newProdName}
                      onChange={(e) => setNewProdName(e.target.value)}
                      placeholder="مثال: حليب كامل الدسم 1 لتر"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-bold"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        سعر البيع للعميل *
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        required
                        value={newProdPrice}
                        onChange={(e) => setNewProdPrice(e.target.value)}
                        placeholder="0.00"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        سعر التكلفة علينا *
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        required
                        value={newProdCost}
                        onChange={(e) => setNewProdCost(e.target.value)}
                        placeholder="0.00"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-bold"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        الكمية الافتتاحية *
                      </label>
                      <input
                        type="number"
                        min={1}
                        required
                        value={stockQty}
                        onChange={(e) => setStockQty(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-black"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">الوحدة</label>
                      <input
                        type="text"
                        value={newProdUnit}
                        onChange={(e) => setNewProdUnit(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        الصلاحية (أيام)
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={newProdShelfDays}
                        onChange={(e) => setNewProdShelfDays(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="p-3 rounded-2xl bg-emerald-50/80 border border-emerald-200 space-y-2">
                <label className="block text-xs font-black text-emerald-950">
                  تاريخ انتهاء صلاحية الدفعة (يحدده المدير بنفسه) *
                </label>
                <input
                  type="datetime-local"
                  required
                  value={stockExpiryDate}
                  onChange={(e) => setStockExpiryDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border-2 border-emerald-400 bg-white text-xs font-mono font-bold text-emerald-950"
                />
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {[
                    { label: '+ يوم', days: 1 },
                    { label: '+ 3 أيام', days: 3 },
                    { label: '+ 7 أيام', days: 7 },
                    { label: '+ 15 يوم', days: 15 },
                    { label: '+ شهر', days: 30 },
                    { label: '+ 6 شهور', days: 180 },
                  ].map((p) => (
                    <button
                      key={p.days}
                      type="button"
                      onClick={() => applyQuickExpiryDays(p.days)}
                      className="px-2 py-0.5 rounded-lg bg-white hover:bg-emerald-600 hover:text-white text-emerald-800 border border-emerald-200 text-[10px] font-bold transition"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md transition cursor-pointer"
              >
                {loading ? 'جاري الإضافة للمخزن...' : 'حفظ وإضافة الرصيد للمخزن الرئيسي'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
