'use client';

import { useState, useRef, useEffect } from 'react';
import {
  FileSpreadsheet,
  Download,
  ChevronDown,
  Table,
  Layers,
  Boxes,
  FileText,
  Store,
  Building2,
  Users,
  Wallet,
  Scale,
  RefreshCw,
} from 'lucide-react';
import {
  exportWorkbookToExcel,
  exportVisibleTablesFromDOM,
  ExcelSheetData,
} from '@/lib/excelExport';

const MODULE_OPTIONS = [
  { id: 'all', label: 'شيت إكسل شامل لكل النظام (11 صفحة داخل الملف)', icon: Layers },
  { id: 'current_page', label: 'تصدير جداول الصفحة المعروضة حالياً فقط', icon: Table },
  { id: 'inventory', label: 'شيت الأصناف وتشغيلات وصلاحيات المخزن', icon: Boxes },
  { id: 'invoices', label: 'شيت فواتير المبيعات والخصومات والتحصيلات', icon: FileText },
  { id: 'clients', label: 'شيت العملاء والمديونيات وكشف الحساب', icon: Store },
  { id: 'suppliers', label: 'شيت الموردين وفواتير الشراء والمدفوعات', icon: Building2 },
  { id: 'reps_vans', label: 'شيت المناديب وعهدة السيارات والتارجت', icon: Users },
  { id: 'employees', label: 'شيت الموظفين والرواتب والسلف', icon: Wallet },
  { id: 'settlements', label: 'شيت التسويات اليومية والمرتجعات', icon: Scale },
];

export default function AdminUniversalExcelBar() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatDate = (iso?: string) => {
    if (!iso) return '-';
    try {
      return new Date(iso).toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  const handleExport = async (mode: string) => {
    setOpen(false);

    if (mode === 'current_page') {
      const ok = exportVisibleTablesFromDOM('تصدير_جداول_الصفحة');
      if (ok) return;
      // If current page has no HTML table, fallback to full system export
    }

    setLoading(true);
    try {
      const res = await fetch('/api/admin/backup', { cache: 'no-store' });
      if (!res.ok) throw new Error('فشل جلب بيانات التصدير');
      const payload = await res.json();
      const db = payload.database || {};

      const users: any[] = db.users || [];
      const products: any[] = db.products || [];
      const batches: any[] = db.batches || [];
      const repInventory: any[] = db.repInventory || [];
      const clients: any[] = db.clients || [];
      const invoices: any[] = db.invoices || [];
      const collections: any[] = db.collections || [];
      const returns: any[] = db.returns || [];
      const settlements: any[] = db.settlements || [];
      const advances: any[] = db.advances || [];
      const suppliers: any[] = db.suppliers || [];
      const supplierPurchases: any[] = db.supplierPurchases || [];
      const supplierPayments: any[] = db.supplierPayments || [];
      const employees: any[] = db.employees || [];
      const payrollPayments: any[] = db.payrollPayments || [];
      const repTargets: any[] = db.repTargets || [];

      const findProduct = (id: string) => products.find((p) => p.id === id);
      const findUser = (id: string) => users.find((u) => u.id === id);
      const findClient = (id: string) => clients.find((c) => c.id === id);
      const findSupplier = (id: string) => suppliers.find((s) => s.id === id);
      const findEmployee = (id: string) => employees.find((e) => e.id === id);

      const sheets: ExcelSheetData[] = [];

      // 1. Products & Batches
      if (mode === 'all' || mode === 'inventory') {
        sheets.push({
          sheetName: 'دليل الأصناف والأسعار',
          headers: [
            'كود الصنف',
            'اسم المنتج',
            'التصنيف',
            'سعر البيع (ج.م)',
            'سعر التكلفة (ج.م)',
            'هامش الربح للكرتونة',
            'الوحدة',
            'الصلاحية الافتراضية (يوم)',
            'الرصيد الحالي بالمخزن',
          ],
          rows: products.map((p) => {
            const stock = batches
              .filter((b) => b.productId === p.id)
              .reduce((s, b) => s + (Number(b.quantity) || 0), 0);
            return [
              p.id,
              p.name,
              p.category === 'dairy' ? 'ألبان' : p.category === 'juice' ? 'عصائر' : p.category,
              Number(p.price) || 0,
              Number(p.cost) || 0,
              (Number(p.price) || 0) - (Number(p.cost) || 0),
              p.unit,
              Number(p.shelfLifeDays) || 1,
              stock,
            ];
          }),
        });

        sheets.push({
          sheetName: 'تشغيلات وصلاحيات المخزن',
          headers: [
            'رقم التشغيلة',
            'اسم المنتج',
            'الكمية الأولية',
            'الكمية المتبقية بالمخزن',
            'سعر التكلفة',
            'تاريخ الإنتاج',
            'تاريخ انتهاء الصلاحية',
            'حالة الصلاحية',
          ],
          rows: batches.map((b) => {
            const prod = findProduct(b.productId);
            const statusAr =
              b.quantity <= 0
                ? 'نفدت الكمية'
                : b.status === 'expired'
                ? 'منتهية الصلاحية'
                : b.status === 'expiring_soon'
                ? 'تقترب من الانتهاء'
                : 'صالحة وطازجة';
            return [
              b.batchNumber,
              prod?.name || b.productId,
              Number(b.initialQuantity) || 0,
              Number(b.quantity) || 0,
              Number(b.unitCost || prod?.cost || 0),
              formatDate(b.productionDate),
              formatDate(b.expiryDate),
              statusAr,
            ];
          }),
        });
      }

      // 2. Sales Invoices & Collections
      if (mode === 'all' || mode === 'invoices') {
        sheets.push({
          sheetName: 'فواتير المبيعات',
          headers: [
            'رقم الفاتورة',
            'التاريخ',
            'العميل',
            'المندوب / المصدر',
            'نوع الدفع',
            'الإجمالي قبل الخصم',
            'الخصم',
            'صافي الفاتورة',
            'المدفوع نقداً',
            'المتبقي آجل',
            'ملاحظات',
          ],
          rows: invoices.map((inv) => {
            const cli = findClient(inv.clientId);
            const rep = findUser(inv.repId);
            const rem = Math.max(0, (Number(inv.totalAmount) || 0) - (Number(inv.paidAmount) || 0));
            return [
              inv.invoiceNumber,
              formatDate(inv.createdAt),
              cli?.name || inv.clientId,
              rep?.name || inv.repId,
              inv.paymentType === 'cash' ? 'نقدي (كاش)' : 'آجل (ذمم)',
              Number(inv.subtotal) || 0,
              Number(inv.discount) || 0,
              Number(inv.totalAmount) || 0,
              Number(inv.paidAmount) || 0,
              rem,
              inv.notes || '-',
            ];
          }),
        });

        sheets.push({
          sheetName: 'تحصيلات العملاء النقدية',
          headers: ['رقم الإيصال', 'التاريخ', 'العميل', 'المندوب المحصل', 'المبلغ المحصل (ج.م)', 'ملاحظات'],
          rows: collections.map((col) => [
            col.id,
            formatDate(col.createdAt),
            findClient(col.clientId)?.name || col.clientId,
            findUser(col.repId)?.name || col.repId,
            Number(col.amount) || 0,
            col.notes || '-',
          ]),
        });
      }

      // 3. Clients & Debts
      if (mode === 'all' || mode === 'clients') {
        sheets.push({
          sheetName: 'العملاء والمديونيات',
          headers: [
            'كود العميل',
            'اسم العميل / المنفذ',
            'رقم الهاتف',
            'العنوان / المنطقة',
            'المديونية الحالية المستحقة (ج.م)',
            'تاريخ التسجيل',
          ],
          rows: clients.map((c) => [
            c.id,
            c.name,
            c.phone || '-',
            c.address || '-',
            Number(c.creditBalance) || 0,
            formatDate(c.createdAt),
          ]),
        });
      }

      // 4. Suppliers & Purchases
      if (mode === 'all' || mode === 'suppliers') {
        sheets.push({
          sheetName: 'الموردين ومستحقاتهم',
          headers: ['كود المورد', 'اسم الشركة / المورد', 'رقم الهاتف', 'العنوان', 'إجمالي المستحق للمورد (ج.م)'],
          rows: suppliers.map((s) => [
            s.id,
            s.name,
            s.phone || '-',
            s.address || '-',
            Number(s.totalDue) || 0,
          ]),
        });

        sheets.push({
          sheetName: 'فواتير شراء الموردين',
          headers: [
            'رقم فاتورة الشراء',
            'التاريخ',
            'المورد',
            'نوع الدفع',
            'إجمالي الفاتورة',
            'المدفوع للمورد',
            'المتبقي آجل للمورد',
            'ملاحظات',
          ],
          rows: supplierPurchases.map((sp) => [
            sp.purchaseNumber,
            formatDate(sp.createdAt),
            findSupplier(sp.supplierId)?.name || sp.supplierId,
            sp.paymentType === 'cash' ? 'نقدي' : 'آجل',
            Number(sp.totalAmount) || 0,
            Number(sp.paidAmount) || 0,
            Number(sp.remainingDue) || 0,
            sp.notes || '-',
          ]),
        });

        sheets.push({
          sheetName: 'مدفوعات سداد الموردين',
          headers: ['رقم العملية', 'التاريخ', 'المورد', 'المبلغ المسدد (ج.م)', 'ملاحظات'],
          rows: supplierPayments.map((pay) => [
            pay.id,
            formatDate(pay.createdAt),
            findSupplier(pay.supplierId)?.name || pay.supplierId,
            Number(pay.amount) || 0,
            pay.notes || '-',
          ]),
        });
      }

      // 5. Reps, Van Stock & Targets
      if (mode === 'all' || mode === 'reps_vans') {
        sheets.push({
          sheetName: 'المناديب وعهدة السيارات',
          headers: ['المندوب', 'خط السير', 'اسم الصنف بالسيارة', 'الكمية الحالية بالسيارة (كرتونة)', 'آخر تحديث'],
          rows: repInventory.map((ri) => {
            const rep = findUser(ri.repId);
            const prod = findProduct(ri.productId);
            return [
              rep?.name || ri.repId,
              rep?.assignedRoute || '-',
              prod?.name || ri.productId,
              Number(ri.quantity) || 0,
              formatDate(ri.updatedAt),
            ];
          }),
        });

        sheets.push({
          sheetName: 'تارجت وأداء المناديب',
          headers: ['المندوب', 'اسم المستخدم', 'رقم الهاتف', 'خط السير', 'الشهر', 'التارجت المستهدف (ج.م)'],
          rows: users
            .filter((u) => u.role === 'rep')
            .map((rep) => {
              const trg = repTargets.find((t) => t.repId === rep.id);
              return [
                rep.name,
                rep.username,
                rep.phone || '-',
                rep.assignedRoute || '-',
                trg?.month || 'الحالي',
                Number(trg?.targetAmount) || 0,
              ];
            }),
        });
      }

      // 6. Employees, Payroll & Advances
      if (mode === 'all' || mode === 'employees') {
        sheets.push({
          sheetName: 'الموظفين والرواتب',
          headers: ['اسم الموظف', 'المسمى الوظيفي', 'رقم الهاتف', 'الراتب الأساسي الشهري (ج.م)', 'تاريخ التعيين'],
          rows: employees.map((emp) => [
            emp.name,
            emp.role,
            emp.phone || '-',
            Number(emp.baseSalary) || 0,
            formatDate(emp.createdAt),
          ]),
        });

        sheets.push({
          sheetName: 'صرف الرواتب وسلف المناديب',
          headers: ['النوع', 'الاسم', 'الشهر / السبب', 'المبلغ (ج.م)', 'الحالة', 'التاريخ'],
          rows: [
            ...payrollPayments.map((pp) => [
              'راتب موظف',
              findEmployee(pp.employeeId)?.name || pp.employeeId,
              pp.month,
              Number(pp.amount) || 0,
              'تم الصرف',
              formatDate(pp.paymentDate),
            ]),
            ...advances.map((adv) => [
              'سلفة مندوب',
              findUser(adv.repId)?.name || adv.repId,
              adv.reason,
              Number(adv.amount) || 0,
              adv.status === 'approved' ? 'معتمدة' : adv.status === 'rejected' ? 'مرفوضة' : 'قيد المراجعة',
              formatDate(adv.createdAt),
            ]),
          ],
        });
      }

      // 7. Settlements & Returns
      if (mode === 'all' || mode === 'settlements') {
        sheets.push({
          sheetName: 'تسويات وجرد نهاية اليوم',
          headers: [
            'التاريخ',
            'المندوب',
            'النقدية المتوقعة بالدفتر',
            'النقدية الفعلية المسلمة',
            'الفارق (عجز / زيادة)',
            'الحالة',
            'ملاحظات',
          ],
          rows: settlements.map((s) => [
            s.date,
            findUser(s.repId)?.name || s.repId,
            Number(s.expectedCash) || 0,
            Number(s.actualCash) || 0,
            Number(s.cashDifference) || 0,
            s.status === 'balanced' ? 'مطابق تماماً' : 'يوجد عجز/فارق',
            s.notes || '-',
          ]),
        });

        sheets.push({
          sheetName: 'المرتجعات والتوالف',
          headers: ['التاريخ', 'المندوب', 'الصنف', 'الكمية المرتجعة', 'القيمة (ج.م)', 'السبب', 'ملاحظات'],
          rows: returns.map((r) => [
            formatDate(r.createdAt),
            findUser(r.repId)?.name || r.repId,
            findProduct(r.productId)?.name || r.productId,
            Number(r.quantity) || 0,
            Number(r.amount) || 0,
            r.reason === 'expired' ? 'انتهاء صلاحية' : 'تالف نقل',
            r.notes || '-',
          ]),
        });
      }

      const fileTitle =
        mode === 'all'
          ? 'تقرير_الوسيط_الشامل_كل_الأقسام'
          : `تقرير_الوسيط_${mode}`;

      exportWorkbookToExcel(fileTitle, sheets);
    } catch (e: any) {
      alert(e.message || 'حدث خطأ أثناء تصدير شيت الإكسل');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mb-4 bg-white rounded-2xl px-4 py-2.5 border border-emerald-200/80 shadow-2xs flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
          <FileSpreadsheet className="w-4 h-4" />
        </div>
        <div>
          <span className="text-xs font-black text-slate-800 block leading-tight">
            تصدير التقارير والجداول إلى شيت إكسل (Excel Export)
          </span>
          <span className="text-[10px] text-slate-500 font-medium">
            اختر تصدير الصفحة الحالية أو شيت إكسل مجمع لأي قسم في البرنامج بضغطة واحدة
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2" ref={menuRef}>
        {/* Quick 1-Click Current Page / All Export */}
        <button
          type="button"
          onClick={() => handleExport('current_page')}
          disabled={loading}
          className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-black flex items-center gap-1.5 transition cursor-pointer"
        >
          <Table className="w-3.5 h-3.5 text-emerald-700" />
          <span>تصدير الصفحة الحالية (Excel)</span>
        </button>

        {/* Dropdown for Any Section or Full Multi-Sheet Workbook */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-sm shadow-emerald-600/20 flex items-center gap-1.5 transition cursor-pointer"
          >
            {loading ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>{loading ? 'جاري تجهيز الشيت...' : 'تصدير شيت Excel (كل الأقسام)'}</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          {open && (
            <div className="absolute left-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 py-2 z-50 space-y-0.5">
              <div className="px-3 py-1.5 text-[10px] font-black text-slate-400 border-b border-slate-100">
                اختر القسم المراد تصديره في شيت Excel (.xls):
              </div>
              {MODULE_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isMain = opt.id === 'all';
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleExport(opt.id)}
                    className={`w-full px-3.5 py-2 text-right text-xs flex items-center gap-2.5 transition cursor-pointer ${
                      isMain
                        ? 'bg-emerald-50/80 hover:bg-emerald-100 text-emerald-950 font-black border-b border-emerald-100'
                        : 'hover:bg-slate-50 text-slate-700 font-bold'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isMain ? 'text-emerald-600' : 'text-slate-400'
                      }`}
                    />
                    <span className="truncate">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
