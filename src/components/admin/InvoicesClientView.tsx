'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Invoice, InvoiceItem, Product, Client, User } from '@/types';
import { deleteInvoiceAction } from '@/lib/actions';
import ConfirmDeleteModal from '@/components/admin/ConfirmDeleteModal';
import { exportSingleSheetToExcel } from '@/lib/excelExport';
import {
  FileText,
  Search,
  Filter,
  Percent,
  TrendingUp,
  Wallet,
  Clock,
  Building,
  User as UserIcon,
  ChevronDown,
  X,
  Printer,
  Calendar,
  Layers,
  Sparkles,
  RotateCcw,
  Trash2,
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
} from 'lucide-react';

interface ExtendedInvoice extends Invoice {
  client: Client;
  rep: User;
  itemsWithProducts: (InvoiceItem & { product: Product })[];
}

interface Props {
  invoices: ExtendedInvoice[];
  reps: User[];
  clients: Client[];
}

type InvoicePeriod = 'all' | 'today' | 'week' | 'month' | 'last_month' | 'custom';

export default function InvoicesClientView({ invoices: initialInvoices, reps, clients }: Props) {
  const router = useRouter();
  const [invoicesList, setInvoicesList] = useState<ExtendedInvoice[]>(initialInvoices || []);
  const [selectedRepId, setSelectedRepId] = useState<string>('all');
  const [selectedClientId, setSelectedClientId] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState<InvoicePeriod>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [activeModalInvoice, setActiveModalInvoice] = useState<ExtendedInvoice | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setInvoicesList(initialInvoices || []);
  }, [initialInvoices]);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setMsg(null);
    try {
      const res = await deleteInvoiceAction(deleteTarget.id);
      if (res.success) {
        setInvoicesList((prev) => prev.filter((i) => i.id !== deleteTarget.id));
        if (activeModalInvoice?.id === deleteTarget.id) {
          setActiveModalInvoice(null);
        }
        setMsg({ type: 'success', text: res.message || 'تم حذف الفاتورة بنجاح' });
      } else {
        setMsg({ type: 'error', text: res.error || 'فشل حذف الفاتورة' });
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('app:sync'));
      }
      router.refresh();
    } catch (err: any) {
      setMsg({ type: 'error', text: err?.message || 'حدث خطأ أثناء الحذف' });
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  // Date bounds helper
  const now = new Date();

  // Filtering
  const filteredInvoices = invoicesList.filter((inv) => {
    if (selectedRepId !== 'all' && inv.repId !== selectedRepId) return false;
    if (selectedClientId !== 'all' && inv.clientId !== selectedClientId) return false;

    // Time / Period Filtering (أسبوعي، شهري، اليوم، الشهر السابق، مخصص)
    if (period !== 'all' && inv.createdAt) {
      const invTime = new Date(inv.createdAt).getTime();

      if (period === 'today') {
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
        if (invTime < todayStart || invTime > todayEnd) return false;
      } else if (period === 'week') {
        // Week starts Saturday in Egyptian/Arab schedule (0=Sun, 6=Sat)
        const weekStart = new Date(now);
        const day = weekStart.getDay();
        const diff = (day + 1) % 7;
        weekStart.setDate(weekStart.getDate() - diff);
        weekStart.setHours(0, 0, 0, 0);
        if (invTime < weekStart.getTime()) return false;
      } else if (period === 'month') {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).getTime();
        if (invTime < monthStart) return false;
      } else if (period === 'last_month') {
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0).getTime();
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999).getTime();
        if (invTime < lastMonthStart || invTime > lastMonthEnd) return false;
      } else if (period === 'custom') {
        if (customStartDate) {
          const start = new Date(customStartDate + 'T00:00:00').getTime();
          if (invTime < start) return false;
        }
        if (customEndDate) {
          const end = new Date(customEndDate + 'T23:59:59.999').getTime();
          if (invTime > end) return false;
        }
      }
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      const matchNum = inv.invoiceNumber?.toLowerCase().includes(q);
      const matchClient = inv.client?.name?.toLowerCase().includes(q);
      const matchRep = inv.rep?.name?.toLowerCase().includes(q);
      return matchNum || matchClient || matchRep;
    }
    return true;
  });

  // Totals for filtered selection
  const totalSales = filteredInvoices.reduce((s, i) => s + i.totalAmount, 0);
  const totalDiscounts = filteredInvoices.reduce((s, i) => s + (i.discount || 0), 0);
  const totalPaid = filteredInvoices.reduce((s, i) => s + i.paidAmount, 0);
  const totalSubtotal = filteredInvoices.reduce((s, i) => s + (i.subtotal || i.totalAmount), 0);

  return (
    <div className="space-y-6">
      {/* 4 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0">
            <FileText className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-medium text-slate-500">إجمالي عدد الفواتير</div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 mt-1 break-words">
              {filteredInvoices.length} <span className="text-xs font-bold text-slate-500">فاتورة</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-medium text-slate-500">صافي المبيعات المطلوبة</div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 mt-1 break-words">
              {totalSales.toLocaleString('ar-EG')} <span className="text-xs font-bold text-slate-500">ج.م</span>
            </div>
          </div>
        </div>

        {/* Total Discounts Badge */}
        <div className="bg-amber-50 rounded-2xl p-5 border border-amber-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-200 text-amber-900 flex items-center justify-center flex-shrink-0">
            <Percent className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-amber-800">إجمالي الخصومات الممنوحة</div>
            <div className="text-xl sm:text-2xl font-black text-amber-900 mt-1 break-words">
              {totalDiscounts.toLocaleString('ar-EG')} <span className="text-xs font-bold text-amber-700">ج.م</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center flex-shrink-0">
            <Wallet className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-medium text-slate-500">النقدية المحصلة فعلياً</div>
            <div className="text-xl sm:text-2xl font-black text-emerald-600 mt-1 break-words">
              {totalPaid.toLocaleString('ar-EG')} <span className="text-xs font-bold text-slate-500">ج.م</span>
            </div>
          </div>
        </div>
      </div>

      {/* Time Filter Bar (أشرطة الفلترة الزمنية للفواتير: أسبوعي / شهري / اليوم / مخصص) */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center justify-between md:justify-start gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="text-xs font-black text-slate-800">تصفية الفواتير حسب الفترة:</span>
          </div>
          <button
            type="button"
            onClick={() =>
              exportSingleSheetToExcel(
                'سجل_فواتير_المبيعات',
                'فواتير المبيعات',
                [
                  'رقم الفاتورة',
                  'التاريخ',
                  'العميل',
                  'المندوب',
                  'طريقة الدفع',
                  'الإجمالي قبل الخصم',
                  'الخصم',
                  'الصافي النهائي',
                  'المدفوع نقداً',
                  'المتبقي آجل',
                  'ملاحظات',
                ],
                filteredInvoices.map((inv) => [
                  inv.invoiceNumber,
                  new Date(inv.createdAt).toLocaleDateString('ar-EG'),
                  inv.client?.name || '-',
                  inv.rep?.name || '-',
                  inv.paymentType === 'cash' ? 'نقدي' : 'آجل',
                  inv.subtotal,
                  inv.discount,
                  inv.totalAmount,
                  inv.paidAmount,
                  Math.max(0, inv.totalAmount - inv.paidAmount),
                  inv.notes || '-',
                ])
              )
            }
            className="px-3 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-teal-600" />
            <span>تصدير الفواتير المعروضة (Excel)</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none touch-pan-x">
          <button
            onClick={() => setPeriod('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap active:scale-95 ${
              period === 'all'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/70'
            }`}
          >
            جميع الفترات
          </button>
          <button
            onClick={() => setPeriod('today')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap active:scale-95 ${
              period === 'today'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/70'
            }`}
          >
            اليوم
          </button>
          <button
            onClick={() => setPeriod('week')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap active:scale-95 ${
              period === 'week'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/70'
            }`}
          >
            هذا الأسبوع
          </button>
          <button
            onClick={() => setPeriod('month')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap active:scale-95 ${
              period === 'month'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/70'
            }`}
          >
            هذا الشهر
          </button>
          <button
            onClick={() => setPeriod('last_month')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap active:scale-95 ${
              period === 'last_month'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/70'
            }`}
          >
            الشهر السابق
          </button>
          <button
            onClick={() => setPeriod('custom')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap active:scale-95 ${
              period === 'custom'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/70'
            }`}
          >
            نطاق مخصص
          </button>
        </div>
      </div>

      {period === 'custom' && (
        <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 flex flex-wrap items-center gap-3 text-xs animate-fadeIn">
          <span className="font-bold text-slate-700">تحديد الفترة من:</span>
          <input
            type="date"
            value={customStartDate}
            onChange={(e) => setCustomStartDate(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-mono bg-white"
          />
          <span className="font-bold text-slate-700">إلى:</span>
          <input
            type="date"
            value={customEndDate}
            onChange={(e) => setCustomEndDate(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-mono bg-white"
          />
          {(customStartDate || customEndDate) && (
            <button
              onClick={() => {
                setCustomStartDate('');
                setCustomEndDate('');
              }}
              className="text-xs text-rose-600 hover:underline font-bold px-2 py-1"
            >
              مسح التواريخ
            </button>
          )}
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث برقم الفاتورة أو العميل..."
            className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
          />
        </div>

        {/* Filter by Rep */}
        <div>
          <select
            value={selectedRepId}
            onChange={(e) => setSelectedRepId(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 bg-white"
          >
            <option value="all">جميع المناديب ({reps.length})</option>
            {reps.map((r) => (
              <option key={r.id} value={r.id}>
                المندوب: {r.name}
              </option>
            ))}
          </select>
        </div>

        {/* Filter by Client */}
        <div>
          <select
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 bg-white"
          >
            <option value="all">جميع المنافذ والعملاء ({clients.length})</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                المنفذ: {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {msg && (
        <div
          className={`p-4 rounded-xl text-sm flex items-center gap-2 ${
            msg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {msg.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600" />
          )}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Invoices List Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-4">
          <h2 className="text-sm font-bold text-slate-800">
            سجل الفواتير الصادرة للمناديب والخصومات المسجلة
          </h2>
          <span className="text-xs text-slate-500 font-medium">
            عرض {filteredInvoices.length} فاتورة
          </span>
        </div>

        {filteredInvoices.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-500">
            لا توجد فواتير مبيعات مطابقة لمعايير البحث حالياً.
          </div>
        ) : (
          <div className="overflow-x-auto touch-pan-x">
            <table className="w-full text-right text-sm min-w-[900px]">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 text-xs bg-slate-50/40">
                  <th className="py-3 pr-4">رقم الفاتورة</th>
                  <th className="py-3">المندوب</th>
                  <th className="py-3">المنفذ / العميل</th>
                  <th className="py-3">المجموع قبل الخصم</th>
                  <th className="py-3">الخصم / المرتجع</th>
                  <th className="py-3">الصافي المطلوب</th>
                  <th className="py-3">المدفوع / المتبقي</th>
                  <th className="py-3">طريقة الدفع</th>
                  <th className="py-3">التاريخ والوقت</th>
                  <th className="py-3 pl-4">التفاصيل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 pr-4 font-mono font-bold text-slate-900">
                      {inv.invoiceNumber}
                    </td>
                    <td className="py-3 font-semibold text-slate-800">
                      <div className="flex items-center gap-1.5">
                        <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                        <span>{inv.rep.name}</span>
                      </div>
                    </td>
                    <td className="py-3">
                      <div className="font-bold text-slate-900">{inv.client.name}</div>
                      {inv.client.address && (
                        <div className="text-[11px] text-slate-400">{inv.client.address}</div>
                      )}
                    </td>
                    <td className="py-3 font-mono text-slate-600 text-xs">
                      {(inv.subtotal || inv.totalAmount).toLocaleString('ar-EG')} ج.م
                    </td>
                    <td className="py-3">
                      <div className="flex flex-col gap-1 items-start">
                        {inv.discount && inv.discount > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-100 text-amber-900 border border-amber-300">
                            <Percent className="w-3 h-3" />
                            <span>خصم {inv.discount.toLocaleString('ar-EG')} ج.م</span>
                          </span>
                        ) : null}
                        {inv.returnsTotal && inv.returnsTotal > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200">
                            <RotateCcw className="w-3 h-3 text-rose-600" />
                            <span>مرتجع: -{inv.returnsTotal.toLocaleString('ar-EG')} ج.م</span>
                          </span>
                        ) : null}
                        {!inv.discount && !inv.returnsTotal && (
                          <span className="text-slate-400 text-xs font-mono">-</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 font-mono font-black text-slate-900 text-sm">
                      {inv.totalAmount.toLocaleString('ar-EG')} ج.م
                    </td>
                    <td className="py-3 text-xs">
                      <div className="font-bold text-emerald-700">
                        مدفوع: {inv.paidAmount.toLocaleString('ar-EG')} ج.م
                      </div>
                      {inv.totalAmount - inv.paidAmount > 0 && (
                        <div className="text-rose-600 font-bold">
                          آجل: {(inv.totalAmount - inv.paidAmount).toLocaleString('ar-EG')} ج.م
                        </div>
                      )}
                    </td>
                    <td className="py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                          inv.paymentType === 'cash'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {inv.paymentType === 'cash' ? 'نقدي' : 'آجل'}
                      </span>
                    </td>
                    <td className="py-3 text-xs">
                      <div className="font-bold text-slate-800 flex items-center gap-1 font-mono">
                        <Clock className="w-3.5 h-3.5 text-emerald-600 inline-block flex-shrink-0" />
                        <span>
                          {new Date(inv.createdAt).toLocaleTimeString('ar-EG', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true,
                          })}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
                        {new Date(inv.createdAt).toLocaleDateString('ar-EG', {
                          year: 'numeric',
                          month: 'numeric',
                          day: 'numeric',
                        })}
                      </div>
                    </td>
                    <td className="py-3 pl-4">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setActiveModalInvoice(inv)}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1"
                        >
                          <span>عرض الأصناف</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setDeleteTarget({
                              id: inv.id,
                              name: `فاتورة بيع رقم: ${inv.invoiceNumber} (العميل: ${inv.client.name})`,
                            })
                          }
                          title="حذف الفاتورة"
                          className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Full Invoice Details & Items */}
      {activeModalInvoice && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-black text-slate-900 text-base">
                  تفاصيل الفاتورة {activeModalInvoice.invoiceNumber}
                </h3>
                <div className="text-xs text-slate-500">
                  المندوب: {activeModalInvoice.rep.name} • العميل: {activeModalInvoice.client.name}
                </div>
                <div className="mt-1.5 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 font-bold text-[11px] border border-emerald-200">
                  <Clock className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                  <span>
                    التوقيت بالدقيقة: {new Date(activeModalInvoice.createdAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'numeric', day: 'numeric' })} الساعة {new Date(activeModalInvoice.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true })}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setActiveModalInvoice(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Sold Items Table */}
            {activeModalInvoice.itemsWithProducts && activeModalInvoice.itemsWithProducts.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-xs font-bold text-slate-700">الأصناف المباعة:</div>
                <div className="border border-slate-200 rounded-2xl overflow-hidden text-xs">
                  <table className="w-full text-right">
                    <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 pr-3">اسم المنتج</th>
                        <th className="py-2.5">الكمية</th>
                        <th className="py-2.5">سعر الوحدة</th>
                        <th className="py-2.5 pl-3">الإجمالي</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activeModalInvoice.itemsWithProducts.map((it) => (
                        <tr key={it.id}>
                          <td className="py-2.5 pr-3 font-bold text-slate-800">
                            {it.product.name}
                          </td>
                          <td className="py-2.5 font-mono font-bold text-slate-900">
                            {it.quantity} كرتونة
                          </td>
                          <td className="py-2.5 font-mono text-slate-600">
                            {it.unitPrice} ج.م
                          </td>
                          <td className="py-2.5 pl-3 font-mono font-bold text-slate-900">
                            {it.totalPrice} ج.م
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Returned Items Table */}
            {activeModalInvoice.returnItems && activeModalInvoice.returnItems.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-rose-800">
                  <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                  <span>المرتجعات المستلمة والمخصومة من الفاتورة:</span>
                </div>
                <div className="border border-rose-200 rounded-2xl overflow-hidden text-xs bg-rose-50/20">
                  <table className="w-full text-right">
                    <thead className="bg-rose-100/60 text-rose-800 border-b border-rose-200">
                      <tr>
                        <th className="py-2.5 pr-3">الصنف المرتجع</th>
                        <th className="py-2.5">الكمية</th>
                        <th className="py-2.5">السبب</th>
                        <th className="py-2.5">سعر الوحدة</th>
                        <th className="py-2.5 pl-3">إجمالي الخصم</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-rose-100">
                      {activeModalInvoice.returnItems.map((ret, idx) => (
                        <tr key={idx}>
                          <td className="py-2.5 pr-3 font-bold text-slate-800">
                            {ret.productName || 'صنف'}
                          </td>
                          <td className="py-2.5 font-mono font-bold text-slate-900">
                            {ret.quantity} كرتونة
                          </td>
                          <td className="py-2.5">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-white text-rose-700 border border-rose-200">
                              {ret.reason === 'expired' ? 'منتهي الصلاحية' : 'تالف'}
                            </span>
                          </td>
                          <td className="py-2.5 font-mono text-slate-600">
                            {ret.unitPrice} ج.م
                          </td>
                          <td className="py-2.5 pl-3 font-mono font-bold text-rose-700">
                            -{(ret.totalPrice || ret.quantity * ret.unitPrice).toLocaleString('ar-EG')} ج.م
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Calculations & Discount Box */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-2">
              <div className="flex justify-between text-slate-600">
                <span>المجموع الفرعي (المبيعات):</span>
                <span className="font-mono font-bold">
                  {(activeModalInvoice.subtotal ?? 0).toLocaleString('ar-EG')} ج.م
                </span>
              </div>

              {activeModalInvoice.discount > 0 && (
                <div className="flex justify-between text-amber-800 font-bold bg-amber-100/60 p-2 rounded-xl border border-amber-200">
                  <span className="flex items-center gap-1">
                    <Percent className="w-3.5 h-3.5" />
                    <span>الخصم الممنوح من المندوب:</span>
                  </span>
                  <span className="font-mono font-black text-sm">
                    - {activeModalInvoice.discount.toLocaleString('ar-EG')} ج.م
                  </span>
                </div>
              )}

              {activeModalInvoice.returnsTotal && activeModalInvoice.returnsTotal > 0 ? (
                <div className="flex justify-between text-rose-800 font-bold bg-rose-50 p-2 rounded-xl border border-rose-200">
                  <span className="flex items-center gap-1">
                    <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                    <span>خصم المرتجعات المستلمة:</span>
                  </span>
                  <span className="font-mono font-black text-sm">
                    - {activeModalInvoice.returnsTotal.toLocaleString('ar-EG')} ج.م
                  </span>
                </div>
              ) : null}

              <div className="flex justify-between text-slate-900 font-black text-base pt-1 border-t border-slate-200">
                <span>الصافي المطلوب:</span>
                <span className="text-emerald-700">
                  {activeModalInvoice.totalAmount.toLocaleString('ar-EG')} ج.م
                </span>
              </div>

              <div className="flex justify-between text-slate-700 pt-1">
                <span>المبلغ المدفوع ({activeModalInvoice.paymentType === 'cash' ? 'كاش' : 'آجل'}):</span>
                <span className="font-mono font-bold text-emerald-600">
                  {activeModalInvoice.paidAmount.toLocaleString('ar-EG')} ج.م
                </span>
              </div>

              {activeModalInvoice.totalAmount - activeModalInvoice.paidAmount > 0 && (
                <div className="flex justify-between text-rose-700 font-bold">
                  <span>المتبقي آجل على العميل:</span>
                  <span className="font-mono">
                    {(activeModalInvoice.totalAmount - activeModalInvoice.paidAmount).toLocaleString('ar-EG')} ج.م
                  </span>
                </div>
              )}

              {activeModalInvoice.notes && (
                <div className="pt-2 border-t border-slate-200 text-slate-500">
                  ملاحظات: {activeModalInvoice.notes}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => {
                  setDeleteTarget({
                    id: activeModalInvoice.id,
                    name: `فاتورة بيع رقم: ${activeModalInvoice.invoiceNumber} (العميل: ${activeModalInvoice.client.name})`,
                  });
                }}
                className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition flex items-center gap-1.5 border border-rose-200"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>حذف الفاتورة</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>طباعة</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModalInvoice(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Universal Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={deleteTarget !== null}
        itemName={deleteTarget?.name}
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          if (!isDeleting) setDeleteTarget(null);
        }}
      />
    </div>
  );
}
