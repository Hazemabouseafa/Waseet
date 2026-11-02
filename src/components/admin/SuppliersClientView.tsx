'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Supplier, SupplierPurchase, Product } from '@/types';
import {
  createSupplierAction,
  updateSupplierAction,
  recordSupplierPaymentAction,
  createSupplierPurchaseAction,
  deleteSupplierAction,
  deleteSupplierPurchaseAction,
} from '@/lib/actions';
import ConfirmDeleteModal from '@/components/admin/ConfirmDeleteModal';
import { exportWorkbookToExcel } from '@/lib/excelExport';
import {
  Building2,
  Plus,
  Search,
  DollarSign,
  Receipt,
  Truck,
  CreditCard,
  Banknote,
  CheckCircle2,
  AlertCircle,
  X,
  Phone,
  MapPin,
  Calendar,
  Layers,
  ArrowUpRight,
  Eye,
  Boxes,
  Percent,
  Trash2,
  FileSpreadsheet,
} from 'lucide-react';

interface Props {
  suppliers: Supplier[];
  purchases: (SupplierPurchase & { supplier: Supplier })[];
  products: Product[];
}

interface NewPurchaseItemLine {
  productId: string;
  quantity: number;
  unitCost: number;
  productionDate: string;
  expiryDate: string;
}

export default function SuppliersClientView({
  suppliers: initialSuppliers,
  purchases: initialPurchases,
  products,
}: Props) {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers || []);
  const [purchases, setPurchases] = useState(initialPurchases || []);

  const [activeTab, setActiveTab] = useState<'suppliers' | 'purchases'>('suppliers');
  const [search, setSearch] = useState('');

  // Modals state
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [paymentSupplier, setPaymentSupplier] = useState<Supplier | null>(null);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [viewingPurchase, setViewingPurchase] = useState<(SupplierPurchase & { supplier: Supplier }) | null>(null);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Universal Delete Confirmation Modal State
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'supplier' | 'purchase';
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setMsg(null);
    try {
      if (deleteTarget.type === 'supplier') {
        const res = await deleteSupplierAction(deleteTarget.id);
        if (res.success) {
          setSuppliers((prev) => prev.filter((s) => s.id !== deleteTarget.id));
          setMsg({ type: 'success', text: res.message || 'تم حذف المورد بنجاح' });
        } else {
          setMsg({ type: 'error', text: res.error || 'فشل حذف المورد' });
        }
      } else {
        const res = await deleteSupplierPurchaseAction(deleteTarget.id);
        if (res.success) {
          setPurchases((prev) => prev.filter((p) => p.id !== deleteTarget.id));
          if (viewingPurchase?.id === deleteTarget.id) setViewingPurchase(null);
          setMsg({ type: 'success', text: res.message || 'تم حذف فاتورة الشراء بنجاح' });
        } else {
          setMsg({ type: 'error', text: res.error || 'فشل حذف فاتورة الشراء' });
        }
      }
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('app:sync'));
      router.refresh();
    } catch (err: any) {
      setMsg({ type: 'error', text: err?.message || 'حدث خطأ أثناء الحذف' });
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  // Synchronize state when server props update
  useEffect(() => {
    setSuppliers(initialSuppliers || []);
  }, [initialSuppliers]);

  useEffect(() => {
    setPurchases(initialPurchases || []);
  }, [initialPurchases]);

  // Purchase Form State
  const [purchaseSupplierId, setPurchaseSupplierId] = useState<string>(initialSuppliers[0]?.id || '');
  const [purchasePaymentType, setPurchasePaymentType] = useState<'cash' | 'credit'>('credit');
  const [purchasePaidAmount, setPurchasePaidAmount] = useState<string>('0');
  const [purchaseNotes, setPurchaseNotes] = useState<string>('');
  const defaultExpiryStr = (days = 7) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  };

  const [purchaseLines, setPurchaseLines] = useState<NewPurchaseItemLine[]>([
    {
      productId: products[0]?.id || '',
      quantity: 50,
      unitCost: products[0]?.cost || 0,
      productionDate: new Date().toISOString().split('T')[0],
      expiryDate: defaultExpiryStr(products[0]?.shelfLifeDays || 7),
    },
  ]);

  // Payment Form State
  const [payAmount, setPayAmount] = useState<string>('');
  const [payNotes, setPayNotes] = useState<string>('');

  // Calculations
  const totalSuppliersCount = suppliers.length;
  const totalPurchasesAmount = purchases.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
  const totalDueToSuppliers = suppliers.reduce((sum, s) => sum + (s.totalDue || 0), 0);
  const totalPaidToSuppliers = purchases.reduce((sum, p) => sum + (p.paidAmount || 0), 0);

  // Filtered Suppliers
  const filteredSuppliers = suppliers.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return s.name.toLowerCase().includes(q) || (s.phone && s.phone.includes(q)) || (s.address && s.address.toLowerCase().includes(q));
  });

  // Filtered Purchases
  const filteredPurchases = purchases.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return p.purchaseNumber.toLowerCase().includes(q) || (p.supplier?.name && p.supplier.name.toLowerCase().includes(q));
  });

  // Purchase Form calculations
  const calculatedPurchaseTotal = purchaseLines.reduce((sum, line) => {
    return sum + (Number(line.quantity) || 0) * (Number(line.unitCost) || 0);
  }, 0);

  const handleAddPurchaseLine = () => {
    setPurchaseLines((prev) => [
      ...prev,
      {
        productId: products[0]?.id || '',
        quantity: 20,
        unitCost: products[0]?.cost || 0,
        productionDate: new Date().toISOString().split('T')[0],
        expiryDate: defaultExpiryStr(products[0]?.shelfLifeDays || 7),
      },
    ]);
  };

  const handleRemovePurchaseLine = (index: number) => {
    setPurchaseLines((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdatePurchaseLine = (index: number, updates: Partial<NewPurchaseItemLine>) => {
    setPurchaseLines((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
  };

  // Submit Add Supplier
  const handleCreateSupplier = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    const formData = new FormData(e.currentTarget);
    const res = await createSupplierAction(formData);
    setLoading(false);

    if (res.success && res.supplier) {
      setSuppliers((prev) => [res.supplier, ...prev]);
      setShowAddSupplierModal(false);
      setMsg({ type: 'success', text: res.message || 'تمت إضافة المورد بنجاح' });
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('app:sync'));
      router.refresh();
    } else {
      setMsg({ type: 'error', text: res.error || 'حدث خطأ' });
    }
  };

  // Submit Update Supplier
  const handleUpdateSupplier = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingSupplier) return;
    setLoading(true);
    setMsg(null);

    const formData = new FormData(e.currentTarget);
    const res = await updateSupplierAction(editingSupplier.id, formData);
    setLoading(false);

    if (res.success && res.supplier) {
      setSuppliers((prev) => prev.map((s) => (s.id === res.supplier.id ? res.supplier : s)));
      setEditingSupplier(null);
      setMsg({ type: 'success', text: res.message || 'تم تحديث بيانات المورد بنجاح' });
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('app:sync'));
      router.refresh();
    } else {
      setMsg({ type: 'error', text: res.error || 'حدث خطأ' });
    }
  };

  // Submit Payment to Supplier
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentSupplier) return;

    setLoading(true);
    setMsg(null);

    const formData = new FormData();
    formData.append('supplierId', paymentSupplier.id);
    formData.append('amount', payAmount);
    formData.append('notes', payNotes);

    const res = await recordSupplierPaymentAction(formData);
    setLoading(false);

    if (res.success) {
      const numAmount = parseFloat(payAmount) || 0;
      setSuppliers((prev) =>
        prev.map((s) =>
          s.id === paymentSupplier.id
            ? { ...s, totalDue: Math.max(0, s.totalDue - numAmount) }
            : s
        )
      );
      setPaymentSupplier(null);
      setPayAmount('');
      setPayNotes('');
      setMsg({ type: 'success', text: res.message || 'تم تسجيل الدفعة بنجاح' });
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('app:sync'));
      router.refresh();
    } else {
      setMsg({ type: 'error', text: res.error || 'حدث خطأ' });
    }
  };

  // Submit Purchase Invoice
  const handleCreatePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!purchaseSupplierId) {
      alert('يرجى اختيار المورد');
      return;
    }
    if (purchaseLines.length === 0) {
      alert('يرجى إضافة صنف واحد على الأقل في الفاتورة');
      return;
    }

    setLoading(true);
    setMsg(null);

    const paid = purchasePaymentType === 'cash' ? calculatedPurchaseTotal : parseFloat(purchasePaidAmount) || 0;

    const res = await createSupplierPurchaseAction({
      supplierId: purchaseSupplierId,
      paymentType: purchasePaymentType,
      paidAmount: paid,
      notes: purchaseNotes.trim() || undefined,
      items: purchaseLines.map((line) => ({
        productId: line.productId,
        quantity: Number(line.quantity),
        unitCost: Number(line.unitCost),
        productionDate: line.productionDate || new Date().toISOString(),
        expiryDate: line.expiryDate ? new Date(line.expiryDate).toISOString() : undefined,
      })),
    });

    setLoading(false);

    if (res.success && res.purchase) {
      setShowPurchaseModal(false);
      setMsg({ type: 'success', text: res.message || 'تم تسجيل فاتورة الشراء بنجاح' });
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('app:sync'));
      router.refresh();
    } else {
      setMsg({ type: 'error', text: res.error || 'حدث خطأ أثناء تسجيل الفاتورة' });
    }
  };

  return (
    <div className="space-y-6">
      {/* 4 Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">إجمالي الموردين والشركات</div>
            <div className="text-2xl font-black text-slate-900 mt-1">
              {totalSuppliersCount} <span className="text-xs font-bold text-slate-500">مورد</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center flex-shrink-0">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">إجمالي قيمة فواتير الشراء</div>
            <div className="text-2xl font-black text-slate-900 mt-1">
              {totalPurchasesAmount.toLocaleString('ar-EG')}{' '}
              <span className="text-xs font-bold text-slate-500">ج.م</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-rose-200 bg-rose-50/40 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-200 text-rose-800 flex items-center justify-center flex-shrink-0">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-bold text-rose-800">إجمالي ديون ومستحقات الموردين</div>
            <div className="text-2xl font-black text-rose-900 mt-1">
              {totalDueToSuppliers.toLocaleString('ar-EG')}{' '}
              <span className="text-xs font-bold text-rose-700">ج.م</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
            <Banknote className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">المدفوع نقداً للموردين</div>
            <div className="text-2xl font-black text-emerald-600 mt-1">
              {totalPaidToSuppliers.toLocaleString('ar-EG')}{' '}
              <span className="text-xs font-bold text-slate-500">ج.م</span>
            </div>
          </div>
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

      {/* Action Bar & Tabs */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Tabs */}
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl overflow-x-auto scrollbar-none touch-pan-x w-full md:w-auto">
          <button
            type="button"
            onClick={() => setActiveTab('suppliers')}
            className={`px-3.5 sm:px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeTab === 'suppliers'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-4 h-4 text-emerald-600" />
            <span>قائمة الموردين وحساباتهم ({suppliers.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('purchases')}
            className={`px-3.5 sm:px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeTab === 'purchases'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Receipt className="w-4 h-4 text-blue-600" />
            <span>سجل فواتير الشراء والتوريد ({purchases.length})</span>
          </button>
        </div>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
          <button
            type="button"
            onClick={() =>
              exportWorkbookToExcel('حسابات_الموردين_وفواتير_الشراء', [
                {
                  sheetName: 'قائمة الموردين ومستحقاتهم',
                  headers: ['كود المورد', 'اسم المورد / الشركة', 'رقم الهاتف', 'العنوان', 'إجمالي المستحق للمورد (ج.م)'],
                  rows: suppliers.map((s) => [s.id, s.name, s.phone || '-', s.address || '-', s.totalDue]),
                },
                {
                  sheetName: 'فواتير الشراء والتوريد',
                  headers: [
                    'رقم فاتورة الشراء',
                    'التاريخ',
                    'المورد',
                    'طريقة الدفع',
                    'إجمالي الفاتورة',
                    'المدفوع للمورد',
                    'المتبقي آجل للمورد',
                    'ملاحظات',
                  ],
                  rows: purchases.map((p) => [
                    p.purchaseNumber,
                    new Date(p.createdAt).toLocaleDateString('ar-EG'),
                    p.supplier?.name || '-',
                    p.paymentType === 'cash' ? 'نقدي' : 'آجل',
                    p.totalAmount,
                    p.paidAmount,
                    p.remainingDue,
                    p.notes || '-',
                  ]),
                },
              ])
            }
            className="px-3.5 py-2.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-teal-600" />
            <span>تصدير Excel للموردين</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAddSupplierModal(true)}
            className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4 text-slate-600" />
            <span>+ مورد جديد</span>
          </button>

          <button
            type="button"
            onClick={() => setShowPurchaseModal(true)}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20"
          >
            <Boxes className="w-4 h-4" />
            <span>+ تسجيل فاتورة شراء للمخزن الرئيسي</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={activeTab === 'suppliers' ? 'بحث عن مورد بالاسم أو الهاتف أو العنوان...' : 'بحث برقم فاتورة الشراء أو اسم المورد...'}
            className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
          />
        </div>
      </div>

      {/* TAB 1: SUPPLIERS LIST */}
      {activeTab === 'suppliers' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-4">
            <h2 className="text-sm font-bold text-slate-800">
              دليل الموردين وأرصدة المديونيات المستحقة
            </h2>
            <span className="text-xs text-slate-500 font-medium">
              عرض {filteredSuppliers.length} مورد
            </span>
          </div>

          {filteredSuppliers.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-500">
              لا يوجد موردين مسجلين حالياً. انقر على زر "+ مورد جديد" بالأعلى للبدء.
            </div>
          ) : (
            <div className="overflow-x-auto touch-pan-x">
              <table className="w-full text-right text-sm min-w-[700px]">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 text-xs bg-slate-50/40">
                    <th className="py-3 pr-4">اسم المورد / الشركة</th>
                    <th className="py-3">الهاتف</th>
                    <th className="py-3">العنوان / المقر</th>
                    <th className="py-3">المستحق للمورد (ديون)</th>
                    <th className="py-3">تاريخ الإضافة</th>
                    <th className="py-3 pl-4 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSuppliers.map((sup) => (
                    <tr key={sup.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3.5 pr-4 font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                            {sup.name.charAt(0)}
                          </div>
                          <span>{sup.name}</span>
                        </div>
                      </td>
                      <td className="py-3 font-mono text-xs text-slate-700">
                        {sup.phone || <span className="text-slate-400">غير مسجل</span>}
                      </td>
                      <td className="py-3 text-xs text-slate-600">
                        {sup.address || <span className="text-slate-400">غير مسجل</span>}
                      </td>
                      <td className="py-3">
                        {sup.totalDue > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-300 font-mono">
                            {sup.totalDue.toLocaleString('ar-EG')} ج.م
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 font-mono">
                            خالص (0 ج.م)
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-xs text-slate-500 font-mono">
                        {new Date(sup.createdAt).toLocaleDateString('ar-EG')}
                      </td>
                      <td className="py-3 pl-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {sup.totalDue > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setPaymentSupplier(sup);
                                setPayAmount(sup.totalDue.toString());
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200 transition"
                            >
                              سداد دفعة
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setEditingSupplier(sup)}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
                          >
                            تعديل
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setDeleteTarget({
                                type: 'supplier',
                                id: sup.id,
                                name: `المورد: ${sup.name}`,
                              })
                            }
                            title="حذف المورد"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
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
      )}

      {/* TAB 2: PURCHASES LIST */}
      {activeTab === 'purchases' && (
        <div className="space-y-4">
          {/* Step 1 Workflow Banner */}
          <div className="p-4 bg-blue-50/80 border border-blue-200 rounded-2xl flex items-start gap-3">
            <Boxes className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-900 leading-relaxed">
              <strong className="block font-bold text-blue-950 mb-0.5">
                الخطوة 1: تسجيل فواتير الشراء والتوريد من الموردين
              </strong>
              عند استلام بضاعة جديدة من المورد، يتم تسجيل الفاتورة هنا لتثبيت الكميات المالية ومديونيات الموردين دون إدخالها تلقائياً للمخزن.
              لإنشاء تشغيلات المخزون الفعلي بالمستودع بنظام FIFO، توجه إلى صفحة <strong>المخزون والتشغيلات</strong> (الخطوة 2) لربط كل تشغيلة بهذه الفاتورة تلقائياً والتأكد من عدم تجاوز الكمية الواردة.
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-4">
              <h2 className="text-sm font-bold text-slate-800">
                سجل فواتير التوريد والشراء الواردة للمخزن الرئيسي
              </h2>
              <span className="text-xs text-slate-500 font-medium">
                عرض {filteredPurchases.length} فاتورة
              </span>
            </div>

            {filteredPurchases.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-500">
                لا توجد فواتير شراء مسجلة بعد.
              </div>
            ) : (
              <div className="overflow-x-auto touch-pan-x">
                <table className="w-full text-right text-sm min-w-[780px]">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 text-xs bg-slate-50/40">
                      <th className="py-3 pr-4">رقم الفاتورة</th>
                      <th className="py-3">المورد</th>
                      <th className="py-3">عدد الأصناف</th>
                      <th className="py-3">إجمالي الفاتورة</th>
                      <th className="py-3">المدفوع / المتبقي</th>
                      <th className="py-3">طريقة الدفع</th>
                      <th className="py-3">تاريخ الفاتورة</th>
                      <th className="py-3 pl-4 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPurchases.map((purchase) => (
                    <tr key={purchase.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3.5 pr-4 font-mono font-bold text-slate-900">
                        {purchase.purchaseNumber}
                      </td>
                      <td className="py-3 font-bold text-slate-800">
                        {purchase.supplier?.name || 'مورد'}
                      </td>
                      <td className="py-3 text-xs text-slate-600 font-mono">
                        {purchase.items?.length || 0} أصناف
                      </td>
                      <td className="py-3 font-mono font-black text-slate-900 text-sm">
                        {purchase.totalAmount.toLocaleString('ar-EG')} ج.م
                      </td>
                      <td className="py-3 text-xs">
                        <div className="font-bold text-emerald-700">
                          مدفوع: {purchase.paidAmount.toLocaleString('ar-EG')} ج.م
                        </div>
                        {purchase.remainingDue > 0 && (
                          <div className="text-rose-600 font-bold">
                            متبقي آجل: {purchase.remainingDue.toLocaleString('ar-EG')} ج.م
                          </div>
                        )}
                      </td>
                      <td className="py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                            purchase.paymentType === 'cash'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {purchase.paymentType === 'cash' ? 'نقدي (كاش)' : 'آجل (مديونية)'}
                        </span>
                      </td>
                      <td className="py-3 text-xs font-mono text-slate-500">
                        {new Date(purchase.createdAt).toLocaleDateString('ar-EG')}
                      </td>
                      <td className="py-3 pl-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setViewingPurchase(purchase)}
                            className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>عرض البنود</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setDeleteTarget({
                                type: 'purchase',
                                id: purchase.id,
                                name: `فاتورة الشراء رقم: ${purchase.purchaseNumber} (${purchase.supplier?.name || 'مورد'})`,
                              })
                            }
                            title="حذف فاتورة الشراء"
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
      </div>
    )}

      {/* MODAL 1: ADD NEW SUPPLIER */}
      {showAddSupplierModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-900 text-base">إضافة مورد أو شركة موردة جديدة</h3>
              <button
                type="button"
                onClick={() => setShowAddSupplierModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSupplier} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">اسم المورد / الشركة *</label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="مثال: شركة المراعي / جهينة للصناعات الغذائية"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-semibold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">رقم الهاتف أو المسؤول</label>
                <input
                  type="text"
                  name="phone"
                  placeholder="010XXXXXXXX"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">العنوان أو المقر</label>
                <input
                  type="text"
                  name="address"
                  placeholder="مثال: المنطقة الصناعية - 6 أكتوبر"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  رصيد افتتاحي مستحق للمورد (إن وجد)
                </label>
                <input
                  type="number"
                  name="initialDue"
                  defaultValue="0"
                  min="0"
                  step="any"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-mono font-bold"
                />
                <span className="text-[10px] text-slate-400">
                  المبلغ المستحق للمورد في ذمة الشركة كمديونية سابقة
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddSupplierModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                >
                  {loading ? 'جاري الحفظ...' : 'حفظ المورد'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT SUPPLIER */}
      {editingSupplier && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-900 text-base">تعديل بيانات المورد</h3>
              <button
                type="button"
                onClick={() => setEditingSupplier(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateSupplier} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">اسم المورد *</label>
                <input
                  type="text"
                  name="name"
                  defaultValue={editingSupplier.name}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-semibold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">الهاتف</label>
                <input
                  type="text"
                  name="phone"
                  defaultValue={editingSupplier.phone}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">العنوان</label>
                <input
                  type="text"
                  name="address"
                  defaultValue={editingSupplier.address}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingSupplier(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                >
                  {loading ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: RECORD SUPPLIER PAYMENT */}
      {paymentSupplier && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-900 text-base">تسجيل سداد دفعة للمورد</h3>
              <button
                type="button"
                onClick={() => setPaymentSupplier(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-3.5 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                <div className="font-bold text-slate-900">{paymentSupplier.name}</div>
                <div className="text-slate-500">
                  الرصيد المستحق حالياً:{' '}
                  <strong className="text-rose-700 font-mono font-bold">
                    {paymentSupplier.totalDue.toLocaleString('ar-EG')} ج.م
                  </strong>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">مبلغ السداد المدفوع (ج.م) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  max={paymentSupplier.totalDue}
                  step="any"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="0"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-mono font-bold text-base text-emerald-700"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">ملاحظات أو طريقة التحويل</label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder="مثال: تحويل بنكي / نقداً من الخزينة"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPaymentSupplier(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                >
                  {loading ? 'جاري التسجيل...' : 'تأكيد السداد'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: RECORD NEW PURCHASE INVOICE (MAIN WAREHOUSE INTAKE) */}
      {showPurchaseModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Boxes className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    تسجيل فاتورة شراء وتوريد للمخزن الرئيسي
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    حقن مباشر للكميات في المخزن المركزي بنظام الصلاحيات الآلي (FIFO)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPurchaseModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePurchase} className="space-y-4 text-xs">
              {/* Supplier Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">المورد / الشركة الموردة *</label>
                  <select
                    value={purchaseSupplierId}
                    onChange={(e) => setPurchaseSupplierId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 font-bold bg-white"
                  >
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} (مديونية سابقة: {s.totalDue} ج.م)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">طريقة سداد الفاتورة *</label>
                  <div className="flex items-center gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => setPurchasePaymentType('credit')}
                      className={`flex-1 py-2 rounded-xl font-bold border transition ${
                        purchasePaymentType === 'credit'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      آجل (على الحساب)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPurchasePaymentType('cash')}
                      className={`flex-1 py-2 rounded-xl font-bold border transition ${
                        purchasePaymentType === 'cash'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      كاش (مدفوع كلياً)
                    </button>
                  </div>
                </div>
              </div>

              {purchasePaymentType === 'credit' && (
                <div className="bg-blue-50/60 p-3 rounded-2xl border border-blue-200 flex items-center justify-between gap-3">
                  <div>
                    <span className="font-bold text-blue-900 block">المبلغ المدفوع كاش تحت الحساب (إن وجد):</span>
                    <span className="text-[10px] text-blue-700">الباقي يسجل تلقائياً كمديونية على الشركة لصالح المورد</span>
                  </div>
                  <div className="w-32">
                    <input
                      type="number"
                      min="0"
                      max={calculatedPurchaseTotal}
                      step="any"
                      value={purchasePaidAmount}
                      onChange={(e) => setPurchasePaidAmount(e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-1.5 rounded-xl border border-blue-300 font-mono font-bold text-center bg-white"
                    />
                  </div>
                </div>
              )}

              {/* Items Table in Purchase */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">الأصناف المشتراة والواردة للمخزن المركزي:</span>
                  <button
                    type="button"
                    onClick={handleAddPurchaseLine}
                    className="px-3 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة صنف آخر</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto p-1">
                  {purchaseLines.map((line, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-slate-50 rounded-2xl border border-slate-200 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center"
                    >
                      {/* Product select */}
                      <div className="sm:col-span-3">
                        <label className="block text-[10px] font-bold text-slate-500 mb-0.5">الصنف:</label>
                        <select
                          value={line.productId}
                          onChange={(e) => {
                            const pId = e.target.value;
                            const pr = products.find((x) => x.id === pId);
                            handleUpdatePurchaseLine(idx, {
                              productId: pId,
                              unitCost: pr?.cost || 0,
                              expiryDate: defaultExpiryStr(pr?.shelfLifeDays || 7),
                            });
                          }}
                          className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 font-bold bg-white text-xs"
                        >
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.unit})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Quantity */}
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-bold text-slate-500 mb-0.5">الكمية (كرتونة):</label>
                        <input
                          type="number"
                          min="1"
                          value={line.quantity}
                          onChange={(e) => handleUpdatePurchaseLine(idx, { quantity: parseInt(e.target.value, 10) || 0 })}
                          className="w-full px-2 py-1.5 rounded-xl border border-slate-200 font-mono font-bold text-center bg-white"
                        />
                      </div>

                      {/* Unit Cost */}
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-bold text-slate-500 mb-0.5">التكلفة (ج.م):</label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={line.unitCost}
                          onChange={(e) => handleUpdatePurchaseLine(idx, { unitCost: parseFloat(e.target.value) || 0 })}
                          className="w-full px-2 py-1.5 rounded-xl border border-slate-200 font-mono font-bold text-center bg-white"
                        />
                      </div>

                      {/* Production Date */}
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-bold text-slate-500 mb-0.5">الإنتاج:</label>
                        <input
                          type="date"
                          value={line.productionDate}
                          onChange={(e) => handleUpdatePurchaseLine(idx, { productionDate: e.target.value })}
                          className="w-full px-2 py-1 rounded-xl border border-slate-200 text-xs bg-white font-mono"
                        />
                      </div>

                      {/* Expiry Date (controlled by Manager) */}
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-black text-emerald-800 mb-0.5">الصلاحية (يدوي):</label>
                        <input
                          type="date"
                          required
                          value={line.expiryDate}
                          onChange={(e) => handleUpdatePurchaseLine(idx, { expiryDate: e.target.value })}
                          className="w-full px-2 py-1 rounded-xl border-2 border-emerald-400 text-xs bg-white font-mono font-bold text-emerald-950"
                        />
                      </div>

                      {/* Remove */}
                      <div className="sm:col-span-1 text-center pt-3">
                        {purchaseLines.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemovePurchaseLine(idx)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total Calculation Bar */}
              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-center justify-between">
                <div>
                  <div className="font-bold text-emerald-900 text-sm">إجمالي فاتورة الشراء والتوريد:</div>
                  <div className="text-[11px] text-emerald-700">
                    عدد الكراتين الموردة:{' '}
                    {purchaseLines.reduce((s, l) => s + (Number(l.quantity) || 0), 0)} كرتونة للمخزن الرئيسي
                  </div>
                </div>
                <div className="text-2xl font-black text-emerald-950 font-mono">
                  {calculatedPurchaseTotal.toLocaleString('ar-EG')} <span className="text-xs font-bold text-emerald-700">ج.م</span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">ملاحظات إضافية على الفاتورة</label>
                <input
                  type="text"
                  value={purchaseNotes}
                  onChange={(e) => setPurchaseNotes(e.target.value)}
                  placeholder="مثال: رقم إذن التسليم أو شاحنة التوريد"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPurchaseModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md shadow-emerald-600/30"
                >
                  {loading ? 'جاري الحفظ والتوريد...' : 'اعتماد الفاتورة وتوريد البضاعة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: VIEW PURCHASE INVOICE DETAILS */}
      {viewingPurchase && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  تفاصيل فاتورة الشراء ({viewingPurchase.purchaseNumber})
                </h3>
                <p className="text-xs text-slate-500">
                  المورد: <strong className="text-slate-800">{viewingPurchase.supplier?.name}</strong> |{' '}
                  {new Date(viewingPurchase.createdAt).toLocaleDateString('ar-EG')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingPurchase(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Items Table */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden text-xs">
              <table className="w-full text-right">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 pr-3">الصنف</th>
                    <th className="py-2.5">الكمية</th>
                    <th className="py-2.5">سعر التكلفة</th>
                    <th className="py-2.5">تاريخ الصلاحية</th>
                    <th className="py-2.5 pl-3">الإجمالي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {viewingPurchase.items?.map((it, i) => (
                    <tr key={i}>
                      <td className="py-2.5 pr-3 font-bold text-slate-800">
                        {it.productName || 'صنف'}
                      </td>
                      <td className="py-2.5 font-mono font-bold text-slate-900">
                        {it.quantity} كرتونة
                      </td>
                      <td className="py-2.5 font-mono text-slate-600">
                        {it.unitCost} ج.م
                      </td>
                      <td className="py-2.5 font-mono text-[11px] text-slate-500">
                        {new Date(it.expiryDate).toLocaleDateString('ar-EG')}
                      </td>
                      <td className="py-2.5 pl-3 font-mono font-bold text-slate-900">
                        {it.totalCost.toLocaleString('ar-EG')} ج.م
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Calculations Box */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-2">
              <div className="flex justify-between text-slate-600">
                <span>إجمالي الفاتورة:</span>
                <span className="font-mono font-bold">{viewingPurchase.totalAmount.toLocaleString('ar-EG')} ج.م</span>
              </div>
              <div className="flex justify-between text-emerald-700">
                <span>المدفوع نقداً:</span>
                <span className="font-mono font-bold">{viewingPurchase.paidAmount.toLocaleString('ar-EG')} ج.م</span>
              </div>
              {viewingPurchase.remainingDue > 0 && (
                <div className="flex justify-between text-rose-700 font-bold">
                  <span>المتبقي آجل على الشركة:</span>
                  <span className="font-mono">{viewingPurchase.remainingDue.toLocaleString('ar-EG')} ج.م</span>
                </div>
              )}
              {viewingPurchase.notes && (
                <div className="pt-2 border-t border-slate-200 text-slate-500">
                  ملاحظات: {viewingPurchase.notes}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => {
                  setDeleteTarget({
                    type: 'purchase',
                    id: viewingPurchase.id,
                    name: `فاتورة الشراء رقم: ${viewingPurchase.purchaseNumber} (${viewingPurchase.supplier?.name || 'مورد'})`,
                  });
                }}
                className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition flex items-center gap-1.5 border border-rose-200"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>حذف الفاتورة</span>
              </button>

              <button
                type="button"
                onClick={() => setViewingPurchase(null)}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition"
              >
                إغلاق
              </button>
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
