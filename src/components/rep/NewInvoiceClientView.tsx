'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Client, Invoice, Product } from '@/types';
import { createInvoiceAction, createClientAction } from '@/lib/actions';
import { useBranding } from '@/components/common/BrandingProvider';
import {
  UserCheck,
  Plus,
  Minus,
  CheckCircle2,
  AlertCircle,
  Share2,
  Printer,
  X,
  CreditCard,
  Banknote,
  Search,
  UserPlus,
  ArrowRight,
  Receipt,
  Tag,
  RotateCcw,
  Trash2,
} from 'lucide-react';

interface AvailableProduct {
  productId: string;
  name: string;
  category: string;
  price: number;
  unit: string;
  totalAvailable: number;
  earliestHoursRemaining: number;
}

interface ReturnEntry {
  productId: string;
  productName: string;
  quantity: number;
  amount?: number;
  totalPrice?: number;
  reason: 'expired' | 'damaged';
  unitPrice: number;
  notes?: string;
}

interface Props {
  clients: Client[];
  availableProducts: AvailableProduct[];
  allProducts: Product[];
  repName: string;
}

export default function NewInvoiceClientView({
  clients: initialClients,
  availableProducts,
  allProducts,
  repName,
}: Props) {
  const router = useRouter();
  const { branding } = useBranding();
  const [clients, setClients] = useState<Client[]>(initialClients);
  const [selectedClientId, setSelectedClientId] = useState<string>(initialClients[0]?.id || '');
  const [clientSearch, setClientSearch] = useState('');

  // Cart: Map of productId -> quantity
  const [cart, setCart] = useState<Record<string, number>>({});
  const [discount, setDiscount] = useState<string>('');
  const [paymentType, setPaymentType] = useState<'cash' | 'credit'>('cash');
  const [partialPaid, setPartialPaid] = useState<string>('');
  const [notes, setNotes] = useState('');

  // Returns in invoice state
  const [returnItems, setReturnItems] = useState<ReturnEntry[]>([]);
  const [selectedReturnProductId, setSelectedReturnProductId] = useState<string>(
    allProducts[0]?.id || ''
  );
  const [returnAmount, setReturnAmount] = useState<string>('');
  const [returnQty, setReturnQty] = useState<string>('');
  const [returnReason, setReturnReason] = useState<'expired' | 'damaged'>('damaged');
  const [returnNotes, setReturnNotes] = useState<string>('');

  // Modals & Status
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [createdInvoice, setCreatedInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const selectedClient = clients.find((c) => c.id === selectedClientId) || clients[0];

  const updateCartQty = (productId: string, delta: number, maxQty: number) => {
    const current = cart[productId] || 0;
    const next = Math.max(0, Math.min(maxQty, current + delta));
    setCart((prev) => {
      const copy = { ...prev };
      if (next === 0) {
        delete copy[productId];
      } else {
        copy[productId] = next;
      }
      return copy;
    });
  };

  const handleAddReturn = () => {
    const prod = allProducts.find((p) => p.id === selectedReturnProductId);
    if (!prod) {
      alert('يرجى تحديد الصنف المرتجع أو التالف');
      return;
    }

    const numAmount = parseFloat(returnAmount);
    const qty = parseInt(returnQty, 10);

    let finalAmount: number | undefined;
    let finalLineTotal: number;
    let finalQty = 1;

    if (!isNaN(numAmount) && numAmount > 0) {
      finalAmount = numAmount;
      finalLineTotal = numAmount;
      finalQty = !isNaN(qty) && qty > 0 ? qty : 1;
    } else if (!isNaN(qty) && qty > 0) {
      finalQty = qty;
      finalLineTotal = qty * prod.price;
    } else {
      alert('يرجى إدخال قيمة التلفيات (بالجنيه) أو الكمية');
      return;
    }

    setReturnItems((prev) => [
      ...prev,
      {
        productId: prod.id,
        productName: prod.name,
        quantity: finalQty,
        amount: finalAmount,
        totalPrice: finalLineTotal,
        reason: returnReason,
        unitPrice: prod.price,
        notes: returnNotes.trim() || undefined,
      },
    ]);

    setReturnAmount('');
    setReturnQty('');
    setReturnNotes('');
  };

  const handleRemoveReturn = (idx: number) => {
    setReturnItems((prev) => prev.filter((_, i) => i !== idx));
  };

  // Calculations
  const cartEntries = Object.entries(cart);
  const subtotal = cartEntries.reduce((sum, [pId, qty]) => {
    const prod = availableProducts.find((p) => p.productId === pId);
    return sum + (prod ? prod.price * qty : 0);
  }, 0);

  const returnsTotal = returnItems.reduce(
    (sum, item) => sum + (item.totalPrice !== undefined ? item.totalPrice : item.quantity * item.unitPrice),
    0
  );

  const numDiscount = Math.max(0, parseFloat(discount) || 0);
  const totalAmount = Math.max(0, subtotal - numDiscount - returnsTotal);
  const totalItemsCount = cartEntries.reduce((sum, [, qty]) => sum + qty, 0);
  const totalReturnsCount = returnItems.reduce((sum, item) => sum + item.quantity, 0);

  const handleCheckout = async () => {
    if (!selectedClientId) {
      setErrorMsg('يرجى اختيار العميل');
      return;
    }
    if (cartEntries.length === 0 && returnItems.length === 0) {
      setErrorMsg('يرجى إضافة صنف مباع أو صنف مرتجع على الأقل إلى الفاتورة');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const items = cartEntries.map(([productId, quantity]) => ({
      productId,
      quantity,
    }));

    const paid = paymentType === 'cash' ? totalAmount : parseFloat(partialPaid) || 0;

    const res = await createInvoiceAction({
      clientId: selectedClientId,
      paymentType,
      paidAmount: paid,
      discount: numDiscount,
      notes: notes.trim() || undefined,
      items,
      returns: returnItems.map((r) => ({
        productId: r.productId,
        quantity: r.quantity,
        amount: r.amount,
        reason: r.reason,
        unitPrice: r.unitPrice,
        notes: r.notes,
      })),
    });

    setLoading(false);

    if (res.success && res.invoice) {
      setCreatedInvoice(res.invoice);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('app:sync'));
        try {
          window.localStorage.setItem('al_waseet_sync', Date.now().toString());
        } catch {}
      }
    } else {
      setErrorMsg(res.error || 'حدث خطأ أثناء إصدار الفاتورة');
    }
  };

  const handleCreateClient = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const res = await createClientAction(formData);

    if (res.success && res.client) {
      setClients((prev) => [res.client, ...prev]);
      setSelectedClientId(res.client.id);
      setShowNewClientModal(false);
    } else {
      alert(res.error || 'فشل إضافة العميل');
    }
  };

  const shareViaWhatsApp = (inv: Invoice) => {
    const itemsText =
      inv.items.length > 0
        ? inv.items
            .map((item) => {
              const p =
                availableProducts.find((prod) => prod.productId === item.productId) ||
                allProducts.find((prod) => prod.id === item.productId);
              return `• ${p?.name || 'صنف'}: ${item.quantity} كرتونة × ${item.unitPrice} ج.م = ${item.totalPrice} ج.م`;
            })
            .join('\n')
        : '• لا توجد مبيعات جديدة';

    const returnsText =
      inv.returnItems && inv.returnItems.length > 0
        ? `\n━━━━━━━━━━━━━━━━━━\n🔄 *المرتجعات المستلمة (مخصومة)*:\n` +
          inv.returnItems
            .map(
              (ret) =>
                `• ${ret.productName || 'صنف مرتجع'}: ${ret.quantity} كرتونة (${
                  ret.reason === 'expired' ? 'منتهي الصلاحية' : 'تالف'
                }) × ${ret.unitPrice} ج.م = -${ret.totalPrice} ج.م`
            )
            .join('\n') +
          `\n📉 *إجمالي المرتجع*: -${inv.returnsTotal || 0} ج.م\n`
        : '';

    const discountLine = inv.discount && inv.discount > 0 ? `🎁 *الخصم الممنوح*: -${inv.discount} ج.م\n` : '';

    const formattedTime = new Date(inv.createdAt).toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    const formattedDate = new Date(inv.createdAt).toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    });

    const message = `🧾 *فاتورة مبيعات - ${branding.companyName}*
━━━━━━━━━━━━━━━━━━
🏢 *إدارة*: ${branding.managerName}
🔢 رقم الفاتورة: ${inv.invoiceNumber}
👤 العميل: ${selectedClient?.name || 'عميل'}
🚚 المندوب: ${repName}
📅 التاريخ والوقت: ${formattedDate} الساعة ${formattedTime}
━━━━━━━━━━━━━━━━━━
الأصناف المباعة:
${itemsText}
${returnsText}━━━━━━━━━━━━━━━━━━
💵 *المجموع الفرعي*: ${inv.subtotal || 0} ج.م
${discountLine}${inv.returnsTotal && inv.returnsTotal > 0 ? `🔄 *المرتجعات*: -${inv.returnsTotal} ج.م\n` : ''}💰 *الصافي المطلوب*: ${inv.totalAmount} ج.م
💳 *المدفوع*: ${inv.paidAmount} ج.م (${inv.paymentType === 'cash' ? 'نقدي' : 'آجل'})
${inv.totalAmount - inv.paidAmount > 0 ? `⚠️ *المتبقي آجل*: ${inv.totalAmount - inv.paidAmount} ج.م\n` : ''}
شكراً لتعاملكم معنا! 🥛🥤`;

    const phone = selectedClient?.phone?.replace(/\D/g, '') || '';
    const cleanPhone = phone.startsWith('0') ? '2' + phone : phone;
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;

    window.open(url, '_blank');
  };

  return (
    <div className="space-y-4">
      {/* Client Selection Card */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <UserCheck className="w-4 h-4 text-emerald-600" />
            <span>اختر العميل (المحل أو السوبرماركت):</span>
          </label>
          <button
            type="button"
            onClick={() => setShowNewClientModal(true)}
            className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>+ عميل جديد</span>
          </button>
        </div>

        <select
          value={selectedClientId}
          onChange={(e) => setSelectedClientId(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 bg-white"
        >
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} {c.address ? `(${c.address})` : ''} - مديونية: {c.creditBalance} ج.م
            </option>
          ))}
        </select>

        {selectedClient && (
          <div className="px-3 py-2 bg-slate-50 rounded-xl text-xs flex items-center justify-between">
            <span className="text-slate-500">الهاتف: {selectedClient.phone || 'غير مسجل'}</span>
            <span className="font-semibold text-slate-700">
              رصيد المديونية السابق:{' '}
              <strong
                className={selectedClient.creditBalance > 0 ? 'text-rose-600 font-bold' : 'text-emerald-600 font-bold'}
              >
                {selectedClient.creditBalance.toLocaleString('ar-EG')} ج.م
              </strong>
            </span>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2 text-xs">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Products Touch POS Grid */}
      <div className="space-y-2">
        <h2 className="text-xs font-bold text-slate-700 px-1">
          الأصناف المتاحة في سيارتك (انقر + للزيادة):
        </h2>

        {availableProducts.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center border border-slate-200 text-xs text-slate-500">
            لا توجد بضاعة في سيارتك حالياً للبيع.
          </div>
        ) : (
          <div className="space-y-2.5">
            {availableProducts.map((p) => {
              const qtyInCart = cart[p.productId] || 0;
              const isUrgent = p.earliestHoursRemaining <= 24;

              return (
                <div
                  key={p.productId}
                  className={`bg-white rounded-2xl p-3.5 border transition ${
                    qtyInCart > 0
                      ? 'border-emerald-500 ring-2 ring-emerald-500/10'
                      : 'border-slate-200'
                  } shadow-xs flex items-center justify-between gap-3`}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-bold text-slate-900 text-sm">{p.name}</h3>
                      {isUrgent && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                          أولوية صرف
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">
                      سعر الكرتونة:{' '}
                      <strong className="text-emerald-700 font-bold">{p.price} ج.م</strong>
                      <span className="mx-1 text-slate-300">•</span>
                      <span>متاح بالسيارة: {p.totalAvailable} كرتونة</span>
                    </div>
                  </div>

                  {/* Touch Counter Buttons */}
                  <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => updateCartQty(p.productId, -1, p.totalAvailable)}
                      disabled={qtyInCart === 0}
                      className="w-9 h-9 rounded-lg bg-white border border-slate-200 text-slate-700 disabled:opacity-30 flex items-center justify-center font-black active:scale-95 shadow-xs"
                    >
                      <Minus className="w-4 h-4" />
                    </button>

                    <span className="w-8 text-center font-black text-slate-900 font-mono text-base">
                      {qtyInCart}
                    </span>

                    <button
                      type="button"
                      onClick={() => updateCartQty(p.productId, 1, p.totalAvailable)}
                      disabled={qtyInCart >= p.totalAvailable}
                      className="w-9 h-9 rounded-lg bg-emerald-600 text-white disabled:opacity-30 flex items-center justify-center font-black active:scale-95 shadow-xs shadow-emerald-600/30"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Returns (مرتجعات العميل) Section */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
              <RotateCcw className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-800">
                تسجيل مرتجعات من العميل (تُخصم فوراً من الفاتورة)
              </h3>
              <p className="text-[10px] text-slate-500">
                استلام أصناف منتهية الصلاحية أو تالفة وخصم قيمتها من إجمالي الحساب
              </p>
            </div>
          </div>
          {returnItems.length > 0 && (
            <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
              إجمالي الخصم: {returnsTotal.toLocaleString('ar-EG')} ج.م
            </span>
          )}
        </div>

        {/* Input Row */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-1">
          {/* Select Product from allProducts */}
          <div className="sm:col-span-2">
            <label className="block text-[11px] font-bold text-slate-600 mb-1">الصنف التالف / المرتجع:</label>
            <select
              value={selectedReturnProductId}
              onChange={(e) => setSelectedReturnProductId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 bg-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
            >
              {allProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.price} ج.م / {p.unit})
                </option>
              ))}
            </select>
          </div>

          {/* Amount & Reason */}
          <div className="grid grid-cols-2 gap-2 sm:col-span-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">قيمة التلفيات (ج.م):</label>
              <input
                type="number"
                step="any"
                min="0.1"
                value={returnAmount}
                onChange={(e) => setReturnAmount(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-black text-center text-slate-900 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">السبب:</label>
              <select
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value as 'expired' | 'damaged')}
                className="w-full px-2.5 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              >
                <option value="damaged">تالف أو كسر (Damaged)</option>
                <option value="expired">منتهي الصلاحية (Expired)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Add Return Button */}
        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={handleAddReturn}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold border border-rose-200 flex items-center justify-center gap-1.5 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إضافة التلفيات إلى الفاتورة</span>
          </button>
        </div>

        {/* List of return items added */}
        {returnItems.length > 0 && (
          <div className="mt-3 space-y-1.5 pt-2 border-t border-slate-100">
            <span className="text-[11px] font-bold text-slate-700 block">
              التلفيات والمرتجعات المضافة للفاتورة:
            </span>
            <div className="space-y-1.5">
              {returnItems.map((ret, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-rose-50/70 border border-rose-200/80 text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{ret.productName}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md font-bold bg-white text-rose-700 border border-rose-200">
                        {ret.reason === 'expired' ? 'منتهي الصلاحية' : 'تالف'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {ret.amount !== undefined && ret.amount > 0 ? (
                        <>
                          قيمة التلفيات:{' '}
                          <strong className="text-rose-700 font-bold">
                            {ret.amount.toLocaleString('ar-EG')} ج.م
                          </strong>
                        </>
                      ) : (
                        <>
                          {ret.quantity} كرتونة × {ret.unitPrice} ج.م ={' '}
                          <strong className="text-rose-700 font-bold">
                            {(ret.quantity * ret.unitPrice).toLocaleString('ar-EG')} ج.م
                          </strong>
                        </>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveReturn(idx)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-100 transition"
                    title="حذف التلفيات"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Payment Options & Summary */}
      {(totalItemsCount > 0 || returnItems.length > 0) && (
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-md space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-600">طريقة الدفع:</span>
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setPaymentType('cash')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                  paymentType === 'cash'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Banknote className="w-3.5 h-3.5" />
                <span>نقدي (كاش)</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentType('credit')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                  paymentType === 'credit'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>آجل (مديونية)</span>
              </button>
            </div>
          </div>

          {paymentType === 'credit' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                المبلغ المدفوع كاش الآن (إن وجد والباقي يسجل آجل)
              </label>
              <input
                type="number"
                min="0"
                max={totalAmount}
                value={partialPaid}
                onChange={(e) => setPartialPaid(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-900"
              />
            </div>
          )}

          {/* Discount Input */}
          <div className="bg-amber-50/70 p-3 rounded-2xl border border-amber-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <Tag className="w-4 h-4 text-amber-700" />
              <div>
                <span className="text-xs font-bold text-amber-950 block">خصم خاص على الفاتورة (ج.م)</span>
                <span className="text-[10px] text-amber-700">سيظهر للمدير العام في لوحة التحكم</span>
              </div>
            </div>
            <div className="w-28">
              <input
                type="number"
                min="0"
                max={subtotal}
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl border border-amber-300 text-sm font-black text-amber-900 text-center font-mono focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white"
              />
            </div>
          </div>

          {/* Total Bar */}
          <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-600 pb-2 border-b border-emerald-200/60">
              <span>المجموع الفرعي (المبيعات):</span>
              <span className="font-bold font-mono">{subtotal.toLocaleString('ar-EG')} ج.م</span>
            </div>
            {numDiscount > 0 && (
              <div className="flex items-center justify-between text-xs text-amber-700 font-bold pb-2 border-b border-emerald-200/60">
                <span>قيمة الخصم الممنوح:</span>
                <span className="font-mono">-{numDiscount.toLocaleString('ar-EG')} ج.م</span>
              </div>
            )}
            {returnsTotal > 0 && (
              <div className="flex items-center justify-between text-xs text-rose-700 font-bold pb-2 border-b border-emerald-200/60">
                <span className="flex items-center gap-1">
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>خصم المرتجعات ({totalReturnsCount} كرتونة):</span>
                </span>
                <span className="font-mono font-bold">-{returnsTotal.toLocaleString('ar-EG')} ج.م</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-1">
              <div>
                <div className="text-xs font-bold text-emerald-800">
                  {totalItemsCount > 0 ? `المبيعات: ${totalItemsCount} كرتونة` : 'لا توجد مبيعات'}
                  {returnsTotal > 0 && ` | المرتجع: ${totalReturnsCount} كرتونة`}
                </div>
                <div className="text-xs text-emerald-600 mt-0.5">
                  {paymentType === 'cash' ? 'دفع نقدي فوري' : 'دفع آجل'}
                </div>
              </div>
              <div className="text-left">
                <div className="text-xs text-emerald-700 font-semibold mb-0.5">الصافي المطلوب:</div>
                <div className="text-2xl font-black text-emerald-900">
                  {totalAmount.toLocaleString('ar-EG')}{' '}
                  <span className="text-xs font-bold text-emerald-700">ج.م</span>
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCheckout}
            disabled={loading}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold rounded-2xl shadow-lg shadow-emerald-600/30 text-center flex items-center justify-center gap-2 text-base transition disabled:opacity-50"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Receipt className="w-5 h-5" />
                <span>إصدار الفاتورة وتأكيد البيع</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Modal: Quick Add Client */}
      {showNewClientModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-900 text-sm">إضافة عميل جديد سريعاً</h3>
              <button
                onClick={() => setShowNewClientModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateClient} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  اسم المحل أو العميل
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  رقم الهاتف (لإرسال الفواتير عبر الواتساب)
                </label>
                <input
                  type="tel"
                  name="phone"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">العنوان أو الشارع</label>
                <input
                  type="text"
                  name="address"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewClientModal(false)}
                  className="px-3 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs"
                >
                  حفظ واختيار العميل
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Invoice Created Success & WhatsApp Share / Thermal Receipt */}
      {createdInvoice && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl mx-auto flex items-center justify-center mb-2">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-black text-slate-900">تم إصدار الفاتورة بنجاح!</h3>
              <p className="text-xs text-slate-500">
                رقم الفاتورة: <strong className="font-mono text-slate-800">{createdInvoice.invoiceNumber}</strong>
              </p>
            </div>

            {/* Thermal Receipt Box */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs font-mono space-y-2">
              <div className="text-center font-bold text-slate-800 pb-2 border-b border-dashed border-slate-300">
                {branding.companyName}
                <div className="text-[10px] text-emerald-800 font-bold mt-0.5">
                  {branding.managerName}
                </div>
                <div className="text-[10px] text-slate-500 font-normal">
                  المندوب: {repName} | العميل: {selectedClient?.name}
                </div>
                <div className="text-[10px] text-slate-600 font-bold mt-1 bg-slate-200/50 py-0.5 px-2 rounded-md inline-block">
                  التوقيت: {new Date(createdInvoice.createdAt).toLocaleDateString('ar-EG')} - {new Date(createdInvoice.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true })}
                </div>
              </div>

              {createdInvoice.items && createdInvoice.items.length > 0 && (
                <div className="space-y-1 py-1 border-b border-dashed border-slate-300">
                  {createdInvoice.items.map((it) => {
                    const p = availableProducts.find((x) => x.productId === it.productId) ||
                      allProducts.find((x) => x.id === it.productId);
                    return (
                      <div key={it.id} className="flex justify-between">
                        <span>
                          {p?.name || 'صنف'} × {it.quantity}
                        </span>
                        <span>{it.totalPrice} ج.م</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Returned Items in Receipt */}
              {createdInvoice.returnItems && createdInvoice.returnItems.length > 0 && (
                <div className="space-y-1 py-1 border-b border-dashed border-slate-300 text-rose-700">
                  <div className="font-bold text-[10px] text-rose-800 flex justify-between">
                    <span>المرتجعات المستلمة:</span>
                    <span>-{createdInvoice.returnsTotal} ج.م</span>
                  </div>
                  {createdInvoice.returnItems.map((ret, i) => (
                    <div key={i} className="flex justify-between text-[10px]">
                      <span>
                        • {ret.productName || 'مرتجع'} × {ret.quantity} ({ret.reason === 'expired' ? 'منتهي' : 'تالف'})
                      </span>
                      <span>-{ret.totalPrice} ج.م</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-1 space-y-1">
                <div className="flex justify-between text-slate-600">
                  <span>المجموع الفرعي:</span>
                  <span>{createdInvoice.subtotal ?? 0} ج.م</span>
                </div>
                {createdInvoice.discount && createdInvoice.discount > 0 ? (
                  <div className="flex justify-between text-amber-600 font-bold">
                    <span>الخصم الممنوح:</span>
                    <span>-{createdInvoice.discount} ج.م</span>
                  </div>
                ) : null}
                {createdInvoice.returnsTotal && createdInvoice.returnsTotal > 0 ? (
                  <div className="flex justify-between text-rose-600 font-bold">
                    <span>خصم المرتجعات:</span>
                    <span>-{createdInvoice.returnsTotal} ج.م</span>
                  </div>
                ) : null}
                <div className="flex justify-between font-bold text-slate-900 text-sm border-t border-dashed border-slate-300 pt-1">
                  <span>الصافي المطلوب:</span>
                  <span>{createdInvoice.totalAmount} ج.م</span>
                </div>
                <div className="flex justify-between text-emerald-700">
                  <span>المدفوع ({createdInvoice.paymentType === 'cash' ? 'نقداً' : 'آجل'}):</span>
                  <span>{createdInvoice.paidAmount} ج.م</span>
                </div>
                {createdInvoice.totalAmount - createdInvoice.paidAmount > 0 && (
                  <div className="flex justify-between text-rose-600 font-bold">
                    <span>المتبقي آجل:</span>
                    <span>{createdInvoice.totalAmount - createdInvoice.paidAmount} ج.م</span>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons: WhatsApp & Print */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => shareViaWhatsApp(createdInvoice)}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold text-xs transition flex items-center justify-center gap-2 shadow-sm shadow-emerald-600/30"
              >
                <Share2 className="w-4 h-4" />
                <span>مشاركة الفاتورة عبر الواتساب (WhatsApp)</span>
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة إيصال حراري (Print Receipt)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCreatedInvoice(null);
                  setCart({});
                  router.push('/rep');
                  router.refresh();
                }}
                className="w-full py-2.5 text-slate-500 hover:text-slate-800 text-xs font-bold transition text-center"
              >
                العودة لعهدة السيارة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
