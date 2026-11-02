'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { User, Product, InventoryBatch, RepInventory } from '@/types';
import { dispatchStockAction, returnStockFromRepAction } from '@/lib/actions';
import {
  Truck,
  ArrowDown,
  CheckCircle2,
  AlertCircle,
  Package,
  Layers,
  Clock,
  Sparkles,
  UserPlus,
  Boxes,
  RotateCcw,
} from 'lucide-react';

interface RepVanData {
  rep: User;
  stock: (RepInventory & {
    product: Product;
    batch: InventoryBatch;
    hoursRemaining: number;
  })[];
  totalUnits: number;
}

interface Props {
  reps: User[];
  batches: (InventoryBatch & { product: Product; hoursRemaining: number })[];
  repVanStocks: RepVanData[];
  initialRepId?: string;
  initialBatchId?: string;
}

export default function DispatchClientView({
  reps,
  batches,
  repVanStocks,
  initialRepId,
  initialBatchId,
}: Props) {
  const router = useRouter();

  const [selectedRepId, setSelectedRepId] = useState(initialRepId || reps[0]?.id || '');
  const [selectedBatchId, setSelectedBatchId] = useState(initialBatchId || batches[0]?.id || '');
  const [quantity, setQuantity] = useState(10);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const selectedBatch = batches.find((b) => b.id === selectedBatchId) || batches[0];
  const selectedRep = reps.find((r) => r.id === selectedRepId) || reps[0];

  const handleDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRepId || !selectedBatchId || quantity <= 0) return;

    setLoading(true);
    setStatus(null);

    const res = await dispatchStockAction(selectedRepId, selectedBatchId, quantity);
    setLoading(false);

    if (res.success) {
      setStatus({ type: 'success', message: res.message || 'تم تحويل البضاعة بنجاح' });
      router.refresh();
    } else {
      setStatus({ type: 'error', message: res.error || 'فشلت عملية التحويل' });
    }
  };

  const handleReturnToWarehouse = async (
    repId: string,
    batchId: string,
    maxQty: number,
    productName: string
  ) => {
    const input = window.prompt(
      `أدخل الكمية المراد إرجاعها للمخزن الرئيسي من "${productName}" (المتاح بالسيارة: ${maxQty}):`,
      String(maxQty)
    );
    if (!input) return;
    const qty = parseInt(input, 10);
    if (isNaN(qty) || qty <= 0 || qty > maxQty) {
      setStatus({
        type: 'error',
        message: `يرجى إدخال كمية صحيحة بين 1 و ${maxQty}`,
      });
      return;
    }

    setLoading(true);
    setStatus(null);
    const res = await returnStockFromRepAction(repId, batchId, qty);
    setLoading(false);

    if (res.success) {
      setStatus({ type: 'success', message: res.message || 'تم إرجاع البضاعة للمخزن بنجاح' });
      router.refresh();
    } else {
      setStatus({ type: 'error', message: res.error || 'فشل إرجاع البضاعة للمخزن' });
    }
  };

  const hasReps = reps && reps.length > 0;
  const hasBatches = batches && batches.length > 0;

  return (
    <div className="space-y-6">
      {/* Notice cards if reps or batches are missing */}
      {!hasReps && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <h4 className="text-sm font-bold">لا يوجد مناديب متاحين حالياً</h4>
              <p className="text-xs text-amber-700">
                يجب تسجيل مندوب مبيعات وتفعيله قبل أن تتمكن من تحويل عهدة بضاعة للسيارات.
              </p>
            </div>
          </div>
          <Link
            href="/admin/reps"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition shadow-xs w-fit"
          >
            <UserPlus className="w-4 h-4" />
            <span>إضافة وتفعيل مناديب</span>
          </Link>
        </div>
      )}

      {!hasBatches && (
        <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-blue-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Package className="w-5 h-5 text-blue-600 shrink-0" />
            <div>
              <h4 className="text-sm font-bold">المستودع الرئيسي فارغ حالياً</h4>
              <p className="text-xs text-blue-700">
                لا توجد تشغيلات بضاعة برصيد موجب بالمستودع لتحويلها. يمكنك تسجيل فواتير شراء أو تشغيلات جديدة.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/suppliers"
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition shadow-xs"
            >
              <Boxes className="w-4 h-4" />
              <span>فواتير الشراء</span>
            </Link>
            <Link
              href="/admin/inventory"
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition shadow-xs"
            >
              <span>المخزون والتشغيلات</span>
            </Link>
          </div>
        </div>
      )}

      {/* Transfer Form Card */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              نموذج تحويل بضاعة من المستودع إلى سيارة المندوب
            </h2>
            <p className="text-xs text-slate-500">
              عملية ذرية (Atomic Transaction) تُنقص الكمية من المستودع وتُضيفها للسيارة فوراً
            </p>
          </div>
        </div>

        {status && (
          <div
            className={`p-4 rounded-xl text-sm flex items-center gap-2 mb-6 ${
              status.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            {status.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span>{status.message}</span>
          </div>
        )}

        <form onSubmit={handleDispatch} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. Select Rep */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                1. اختر المندوب (سيارة التوزيع)
              </label>
              <select
                value={selectedRepId}
                disabled={!hasReps}
                onChange={(e) => setSelectedRepId(e.target.value)}
                className="w-full px-3.5 py-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 bg-white font-semibold text-slate-800 disabled:bg-slate-100 disabled:text-slate-400"
              >
                {!hasReps && <option value="">لا يوجد مناديب مسجلين</option>}
                {reps.map((rep) => (
                  <option key={rep.id} value={rep.id}>
                    {rep.name} - ({rep.assignedRoute || 'بدون خط سير'})
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Select Warehouse Batch */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                2. اختر تشغيلة المستودع (FIFO)
              </label>
              <select
                value={selectedBatchId}
                disabled={!hasBatches}
                onChange={(e) => setSelectedBatchId(e.target.value)}
                className="w-full px-3.5 py-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 bg-white text-slate-800 disabled:bg-slate-100 disabled:text-slate-400"
              >
                {!hasBatches && <option value="">لا توجد بضاعة متاحة بالمستودع</option>}
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.product?.name || 'صنف'} (تشغيلة: {b.batchNumber}) - متاح: {b.quantity} كرتونة
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Enter Quantity */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                3. الكمية المراد تحويلها (كرتونة)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max={selectedBatch?.quantity || 100}
                  required
                  disabled={!hasBatches || !hasReps}
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3.5 py-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 font-bold text-slate-900 disabled:bg-slate-100"
                />
                <button
                  type="button"
                  disabled={!selectedBatch || (selectedBatch.quantity || 0) <= 0}
                  onClick={() => setQuantity(selectedBatch?.quantity || 1)}
                  className="px-3 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold whitespace-nowrap transition disabled:opacity-40"
                >
                  الكل ({selectedBatch?.quantity || 0})
                </button>
              </div>
            </div>
          </div>

          {/* Details Preview */}
          {selectedBatch && (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block">الصنف المختار:</span>
                <strong className="text-slate-900 font-bold text-sm">
                  {selectedBatch.product?.name || 'صنف غير محدد'}
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block">المتاح بالمستودع:</span>
                <strong className="text-emerald-700 font-mono font-bold text-sm">
                  {selectedBatch.quantity} كرتونة
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block">سعر الكرتونة للبيع:</span>
                <strong className="text-slate-900 font-bold text-sm">
                  {selectedBatch.product?.price ?? 0} ج.م
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block">تاريخ الانتهاء:</span>
                <strong
                  className={`font-mono font-bold text-sm ${
                    (selectedBatch.hoursRemaining ?? 0) <= 24 ? 'text-rose-600' : 'text-slate-900'
                  }`}
                >
                  {selectedBatch.expiryDate
                    ? new Date(selectedBatch.expiryDate).toLocaleDateString('ar-EG', {
                        month: 'numeric',
                        day: 'numeric',
                      })
                    : '-'}
                  {selectedBatch.hoursRemaining !== undefined && (
                    <> (متبقي {selectedBatch.hoursRemaining} س)</>
                  )}
                </strong>
              </div>
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={loading || !selectedBatch || (selectedBatch.quantity || 0) <= 0 || !selectedRep}
              className="px-8 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white text-sm font-bold transition shadow-lg shadow-emerald-600/20 flex items-center gap-2 disabled:opacity-50"
            >
              <Truck className="w-4 h-4" />
              <span>{loading ? 'جاري التحويل...' : 'تأكيد التحويل إلى سيارة المندوب'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Current Vehicles Van Stock Overview */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-emerald-600" />
          <h2 className="text-base font-bold text-slate-900">
            حالة عهدة سيارات المناديب الحالية (Live Van Stock)
          </h2>
        </div>

        {repVanStocks.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center text-slate-400 text-sm">
            لا توجد سيارات مناديب مسجلة حالياً لعرض تفاصيل العهدة
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {repVanStocks.map(({ rep, stock, totalUnits }) => (
              <div
                key={rep.id}
                className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between pb-3 border-b border-slate-100 mb-3">
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">{rep.name}</h3>
                      <p className="text-[11px] text-slate-500">{rep.assignedRoute || 'بدون خط سير'}</p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200">
                      {totalUnits} كرتونة بالسيارة
                    </span>
                  </div>

                  {stock.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400">
                      السيارة فارغة حالياً - لم يتم تحميل بضاعة بعد
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {stock.map((item) => (
                        <div
                          key={item.id}
                          className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between gap-2 text-xs"
                        >
                          <div>
                            <div className="font-bold text-slate-800">{item.product?.name || 'صنف'}</div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              تشغيلة: {item.batch?.batchNumber || '-'}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-left">
                              <div className="font-bold font-mono text-emerald-700 text-sm">
                                {item.quantity} كرتونة
                              </div>
                              <div
                                className={`text-[10px] font-bold ${
                                  (item.hoursRemaining ?? 999) <= 16 ? 'text-rose-600' : 'text-slate-500'
                                }`}
                              >
                                متبقي {item.hoursRemaining ?? '-'} س
                              </div>
                            </div>
                            <button
                              type="button"
                              disabled={loading}
                              onClick={() =>
                                handleReturnToWarehouse(
                                  rep.id,
                                  item.batchId,
                                  item.quantity,
                                  item.product?.name || 'الصنف'
                                )
                              }
                              title="تفريغ / إرجاع الكمية للمخزن الرئيسي"
                              className="px-2.5 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-[11px] flex items-center gap-1 transition cursor-pointer shrink-0"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>إرجاع للمخزن</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-4 mt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setSelectedRepId(rep.id)}
                    className="w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition text-center"
                  >
                    تحميل بضاعة إضافية لهذه السيارة
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
