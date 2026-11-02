'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Client } from '@/types';
import {
  createClientAction,
  updateClientAction,
  deleteClientAction,
  adminRecordCollectionAction,
} from '@/lib/actions';
import { exportSingleSheetToExcel } from '@/lib/excelExport';
import {
  Building2,
  Plus,
  Search,
  MapPin,
  Phone,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
  CreditCard,
  Store,
  HandCoins,
  FileSpreadsheet,
} from 'lucide-react';

interface Props {
  clients: Client[];
}

export default function ClientsClientView({ clients }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const filteredClients = clients.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.address && c.address.toLowerCase().includes(q)) ||
      (c.phone && c.phone.includes(q))
    );
  });

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    const formData = new FormData(e.currentTarget);
    const res = await createClientAction(formData);
    setLoading(false);

    if (res.success) {
      setMsg({ type: 'success', text: res.message || 'تم إضافة المنفذ بنجاح' });
      setShowAddModal(false);
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('app:sync'));
      router.refresh();
    } else {
      setMsg({ type: 'error', text: res.error || 'حدث خطأ أثناء الإضافة' });
    }
  };

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editClient) return;

    setLoading(true);
    setMsg(null);

    const formData = new FormData(e.currentTarget);
    const res = await updateClientAction(editClient.id, formData);
    setLoading(false);

    if (res.success) {
      setMsg({ type: 'success', text: res.message || 'تم تحديث البيانات بنجاح' });
      setEditClient(null);
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('app:sync'));
      router.refresh();
    } else {
      setMsg({ type: 'error', text: res.error || 'فشل التحديث' });
    }
  };

  const handleDelete = async (client: Client) => {
    if (!confirm(`هل أنت متأكد من حذف منفذ "${client.name}"؟`)) return;

    setLoading(true);
    setMsg(null);

    const res = await deleteClientAction(client.id);
    setLoading(false);

    if (res.success) {
      setMsg({ type: 'success', text: res.message || 'تم حذف المنفذ بنجاح' });
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('app:sync'));
      router.refresh();
    } else {
      setMsg({ type: 'error', text: res.error || 'فشل الحذف' });
    }
  };

  const handleQuickCollect = async (client: Client) => {
    const input = window.prompt(
      `تحصيل نقدية من "${client.name}" (المديونية الحالية: ${client.creditBalance.toLocaleString('ar-EG')} ج.م)\nأدخل المبلغ المحصل نقداً (ج.م):`,
      client.creditBalance > 0 ? String(client.creditBalance) : ''
    );
    if (!input) return;
    const amount = parseFloat(input);
    if (isNaN(amount) || amount <= 0) {
      setMsg({ type: 'error', text: 'يرجى إدخال مبلغ تحصيل صحيح أكبر من الصفر' });
      return;
    }

    setLoading(true);
    setMsg(null);
    const fd = new FormData();
    fd.set('clientId', client.id);
    fd.set('amount', String(amount));
    fd.set('notes', `تحصيل مباشر من صفحة العملاء`);

    const res = await adminRecordCollectionAction(fd);
    setLoading(false);

    if (res.success) {
      setMsg({ type: 'success', text: res.message || 'تم تسجيل التحصيل بنجاح' });
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('app:sync'));
      router.refresh();
    } else {
      setMsg({ type: 'error', text: res.error || 'فشل تسجيل التحصيل' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالاسم أو المكان أو الهاتف..."
            className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 bg-white"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              exportSingleSheetToExcel(
                'كشف_العملاء_والمديونيات',
                'العملاء والمديونيات',
                ['كود العميل', 'اسم المنفذ / العميل', 'رقم الهاتف', 'العنوان', 'المديونية الحالية (ج.م)', 'تاريخ التسجيل'],
                filteredClients.map((c) => [
                  c.id,
                  c.name,
                  c.phone || '-',
                  c.address || '-',
                  c.creditBalance,
                  new Date(c.createdAt).toLocaleDateString('ar-EG'),
                ])
              )
            }
            className="px-3.5 py-2.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-teal-600" />
            <span>تصدير Excel للعملاء</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة منفذ / سوبرماركت جديد</span>
          </button>
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
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          )}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Outlets Grid */}
      {filteredClients.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 text-center border border-slate-200 shadow-xs space-y-3">
          <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-2xl mx-auto flex items-center justify-center">
            <Store className="w-8 h-8" />
          </div>
          <h3 className="font-bold text-slate-800 text-base">لا توجد منافذ مسجلة حالياً</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            ابدأ بإضافة أول سوبرماركت أو منفذ توزيع تنزل له البضاعة عبر الزر أعلاه
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-xs hover:bg-emerald-700 transition"
          >
            + إضافة منفذ الآن
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClients.map((client) => (
            <div
              key={client.id}
              className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs hover:border-slate-300 hover:shadow-sm transition flex flex-col justify-between"
            >
              <div>
                <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold flex-shrink-0">
                      <Store className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-slate-900 text-base break-words">{client.name}</h3>
                      <div className="text-[11px] text-slate-400 font-mono">
                        كود: {client.id.slice(-6)}
                      </div>
                    </div>
                  </div>

                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-bold shrink-0 ${
                      client.creditBalance > 0
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}
                  >
                    {client.creditBalance > 0
                      ? `مديونية: ${client.creditBalance.toLocaleString('ar-EG')} ج.م`
                      : 'حساب خالص'}
                  </span>
                </div>

                <div className="space-y-2 py-3 border-y border-slate-100 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span>
                      المكان / العنوان: <strong>{client.address || 'غير محدد'}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span>
                      الهاتف: <strong>{client.phone || 'غير مسجل'}</strong>
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-between gap-2">
                {client.creditBalance > 0 ? (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleQuickCollect(client)}
                    className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-black transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                    title="تحصيل نقدية من العميل للخزينة"
                  >
                    <HandCoins className="w-3.5 h-3.5" />
                    <span>تحصيل مديونية</span>
                  </button>
                ) : (
                  <span className="text-[11px] font-bold text-emerald-600">لا توجد مديونية</span>
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditClient(client)}
                    className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1"
                    title="تعديل"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>تعديل</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDelete(client)}
                    className="p-2 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-bold transition flex items-center gap-1"
                    title="حذف"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>حذف</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Add Outlet */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <Store className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-base">
                  إضافة منفذ أو سوبرماركت جديد
                </h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  اسم المنفذ أو السوبرماركت <span className="text-rose-500 font-bold">* (أساسي وإجباري)</span>
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="مثلاً: سوبرماركت الخير والبركة"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  المكان / العنوان أو خط السير (اختياري)
                </label>
                <input
                  type="text"
                  name="address"
                  placeholder="مثلاً: شارع فيصل الرئيسي أمام البنك الأهلي"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    رقم هاتف المنفذ (اختياري)
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    placeholder="010XXXXXXXX"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    رصيد افتتاحي (مديونية سابقة ج.م)
                  </label>
                  <input
                    type="number"
                    name="creditBalance"
                    defaultValue="0"
                    min="0"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition disabled:opacity-50"
                >
                  {loading ? 'جاري الحفظ...' : 'حفظ المنفذ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Outlet */}
      {editClient && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-900 text-base">تعديل بيانات المنفذ</h3>
              <button
                onClick={() => setEditClient(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  اسم المنفذ <span className="text-rose-500 font-bold">* (أساسي)</span>
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  defaultValue={editClient.name}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">المكان / العنوان</label>
                <input
                  type="text"
                  name="address"
                  defaultValue={editClient.address || ''}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">رقم الهاتف</label>
                <input
                  type="tel"
                  name="phone"
                  defaultValue={editClient.phone || ''}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditClient(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition disabled:opacity-50"
                >
                  {loading ? 'جاري الحفظ...' : 'تحديث البيانات'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
