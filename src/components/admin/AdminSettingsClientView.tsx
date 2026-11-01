'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { wipeDatabaseAction } from '@/lib/actions';
import { useBranding } from '@/components/common/BrandingProvider';
import {
  Settings,
  Database,
  Download,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Boxes,
  FileText,
  Truck,
  Users,
  Store,
  Wallet,
  Sparkles,
  RefreshCw,
  X,
  FileCode,
  Palette,
  Building,
  Receipt,
  Globe,
} from 'lucide-react';

interface DatabaseStats {
  users: number;
  categories: number;
  products: number;
  batches: number;
  repInventory: number;
  clients: number;
  invoices: number;
  returns: number;
  collections: number;
  settlements: number;
  advances: number;
  suppliers: number;
  supplierPurchases: number;
  supplierPayments: number;
  employees: number;
  payrollPayments: number;
  repTargets: number;
}

interface Props {
  initialStats: DatabaseStats;
  adminName: string;
}

export default function AdminSettingsClientView({ initialStats, adminName }: Props) {
  const router = useRouter();
  const { branding, updateBranding, resetBranding } = useBranding();

  // White-Label Branding Form State
  const [brandForm, setBrandForm] = useState({
    companyName: branding.companyName,
    appName: branding.appName,
    managerName: branding.managerName,
    tagline: branding.tagline,
    currency: branding.currency,
    phone: branding.phone,
    address: branding.address,
    taxNumber: branding.taxNumber,
    commercialRegister: branding.commercialRegister,
    receiptFooter: branding.receiptFooter,
  });

  const [isSavingBrand, setIsSavingBrand] = useState(false);
  const [brandSavedMsg, setBrandSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    setBrandForm({
      companyName: branding.companyName,
      appName: branding.appName,
      managerName: branding.managerName,
      tagline: branding.tagline,
      currency: branding.currency,
      phone: branding.phone,
      address: branding.address,
      taxNumber: branding.taxNumber,
      commercialRegister: branding.commercialRegister,
      receiptFooter: branding.receiptFooter,
    });
  }, [branding]);

  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingBrand(true);
    setBrandSavedMsg(null);

    const ok = await updateBranding(brandForm);
    setIsSavingBrand(false);

    if (ok) {
      setBrandSavedMsg('تم حفظ وتطبيق هوية النظام بنجاح! تم تحديث كافة الشاشات والفواتير فورياً.');
      setTimeout(() => setBrandSavedMsg(null), 5000);
      router.refresh();
    } else {
      alert('فشل حفظ الهوية التجارية. تأكد من اتصال السيرفر.');
    }
  };

  const handleResetBranding = async () => {
    if (!confirm('هل أنت متأكد من استعادة هوية "الوسيط" الافتراضية؟')) return;
    setIsSavingBrand(true);
    const ok = await resetBranding();
    setIsSavingBrand(false);
    if (ok) {
      setBrandSavedMsg('تمت استعادة هوية الوسيط الافتراضية بنجاح.');
      setTimeout(() => setBrandSavedMsg(null), 5000);
      router.refresh();
    }
  };

  const [stats, setStats] = useState<DatabaseStats>(initialStats);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Wipe Modal State
  const [showWipeModal, setShowWipeModal] = useState(false);
  const [wipeMode, setWipeMode] = useState<'transactions_only' | 'all'>('transactions_only');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isWiping, setIsWiping] = useState(false);
  const [wipeError, setWipeError] = useState<string | null>(null);
  const [wipeSuccess, setWipeSuccess] = useState<string | null>(null);

  const totalRecordsCount = Object.values(stats).reduce((a, b) => a + b, 0);

  const handleDownloadBackup = async () => {
    setIsDownloading(true);
    setDownloadSuccess(false);
    try {
      // Trigger download via API endpoint
      const res = await fetch('/api/admin/backup');
      if (!res.ok) {
        throw new Error('فشل استخراج ملف النسخة الاحتياطية');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateFormatted = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      a.download = `al_waseet_backup_${dateFormatted}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 5000);
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء تنزيل النسخة الاحتياطية');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleExecuteWipe = async (e: React.FormEvent) => {
    e.preventDefault();
    setWipeError(null);
    setWipeSuccess(null);

    if (!confirmPassword) {
      setWipeError('يرجى إدخال كلمة مرور المدير العام للمتابعة');
      return;
    }

    setIsWiping(true);
    try {
      const formData = new FormData();
      formData.set('password', confirmPassword);
      formData.set('mode', wipeMode);

      const res = await wipeDatabaseAction(formData);

      if (res.success) {
        setWipeSuccess(res.message || 'تمت العملية بنجاح');
        setConfirmPassword('');
        // Trigger live sync event
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('app:sync'));
        }
        setTimeout(() => {
          setShowWipeModal(false);
          router.refresh();
        }, 2000);
      } else {
        setWipeError(res.error || 'فشلت عملية مسح البيانات');
      }
    } catch (err: any) {
      setWipeError(err.message || 'حدث خطأ غير متوقع أثناء المسح');
    } finally {
      setIsWiping(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">
            <Settings className="w-4 h-4 text-emerald-600" />
            <span>لوحة الضبط والتحكم بالبيانات (System Control)</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            إعدادات النظام والنسخ الاحتياطي
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            إدارة أمان البيانات، استخراج النسخ الاحتياطية للشركة، والتحكم الآمن في ضبط المصنع
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3.5 py-2 rounded-2xl bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>المدير: {branding.managerName || adminName}</span>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* SECTION 0: WHITE-LABEL BRANDING & MULTI-CLIENT REBRANDING   */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded-3xl border border-emerald-200/80 shadow-md shadow-emerald-600/5 overflow-hidden">
        <div className="p-6 border-b border-emerald-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-emerald-50 via-teal-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-600/20">
              <Palette className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-black text-slate-900 break-words">
                  تخصيص الهوية التجارية والـ White-Label
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 shrink-0">
                  White-Label B2B Ready
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                أعد تخصيص اسم الشركة، الشعار، العملة، التذييل وبيانات الفواتير الميدانية لبيع النظام وتخصيصه لأي عميل فورياً دون تعديل في الكود
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetBranding}
              disabled={isSavingBrand}
              className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition"
            >
              استعادة الافتراضي
            </button>
          </div>
        </div>

        {brandSavedMsg && (
          <div className="m-6 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-xs font-bold text-emerald-800 animate-fadeIn">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{brandSavedMsg}</span>
          </div>
        )}

        <form onSubmit={handleSaveBranding} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            {/* Company Name */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">اسم الشركة / المنشأة *</label>
              <input
                type="text"
                required
                value={brandForm.companyName}
                onChange={(e) => setBrandForm({ ...brandForm, companyName: e.target.value })}
                placeholder="مثال: شركة النور للمواد الغذائية"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-semibold focus:border-emerald-600 focus:outline-none"
              />
            </div>

            {/* App Commercial Name */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">اسم التطبيق التجاري *</label>
              <input
                type="text"
                required
                value={brandForm.appName}
                onChange={(e) => setBrandForm({ ...brandForm, appName: e.target.value })}
                placeholder="الوسيط"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-semibold focus:border-emerald-600 focus:outline-none"
              />
            </div>

            {/* Manager / Organization Name */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                اسم المدير العام / المسؤول *
              </label>
              <input
                type="text"
                required
                value={brandForm.managerName}
                onChange={(e) => setBrandForm({ ...brandForm, managerName: e.target.value })}
                placeholder="مثال: أ/ أحمد محمد (المدير العام)"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-semibold focus:border-emerald-600 focus:outline-none"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                يظهر أعلى لوحة التحكم، في البروفايل، وعلى إيصالات الفواتير
              </span>
            </div>

            {/* Tagline */}
            <div className="lg:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">شعار الشركة / الوصف التسويقي</label>
              <input
                type="text"
                value={brandForm.tagline}
                onChange={(e) => setBrandForm({ ...brandForm, tagline: e.target.value })}
                placeholder="نظام إدارة المبيعات الميدانية والتوزيع B2B"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-semibold focus:border-emerald-600 focus:outline-none"
              />
            </div>

            {/* Currency Symbol */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">رمز العملة النقدية *</label>
              <input
                type="text"
                required
                value={brandForm.currency}
                onChange={(e) => setBrandForm({ ...brandForm, currency: e.target.value })}
                placeholder="مثال: ج.م أو ر.س أو د.إ أو $"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-bold focus:border-emerald-600 focus:outline-none"
              />
            </div>

            {/* Phone */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">رقم هاتف المنشأة / خدمة العملاء</label>
              <input
                type="text"
                value={brandForm.phone}
                onChange={(e) => setBrandForm({ ...brandForm, phone: e.target.value })}
                placeholder="010XXXXXXXX"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-mono focus:border-emerald-600 focus:outline-none"
              />
            </div>

            {/* Commercial Register */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">رقم السجل التجاري (C.R)</label>
              <input
                type="text"
                value={brandForm.commercialRegister}
                onChange={(e) => setBrandForm({ ...brandForm, commercialRegister: e.target.value })}
                placeholder="1234567"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-mono focus:border-emerald-600 focus:outline-none"
              />
            </div>

            {/* Tax Number */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">رقم البطاقة الضريبية (Tax ID)</label>
              <input
                type="text"
                value={brandForm.taxNumber}
                onChange={(e) => setBrandForm({ ...brandForm, taxNumber: e.target.value })}
                placeholder="987-654-321"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-mono focus:border-emerald-600 focus:outline-none"
              />
            </div>

            {/* Address */}
            <div className="lg:col-span-3">
              <label className="block font-bold text-slate-700 mb-1">العنوان الجغرافي للمقر الرئيسي</label>
              <input
                type="text"
                value={brandForm.address}
                onChange={(e) => setBrandForm({ ...brandForm, address: e.target.value })}
                placeholder="مثال: المنطقة الصناعية - التجمع الخامس - القاهرة"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-semibold focus:border-emerald-600 focus:outline-none"
              />
            </div>

            {/* Receipt Footer */}
            <div className="lg:col-span-3">
              <label className="block font-bold text-slate-700 mb-1">نص تذييل الفاتورة الحرارية ورسائل الواتساب</label>
              <input
                type="text"
                value={brandForm.receiptFooter}
                onChange={(e) => setBrandForm({ ...brandForm, receiptFooter: e.target.value })}
                placeholder="شكراً لتعاملكم معنا - نسعد بخدمتكم دائماً"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-semibold focus:border-emerald-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Live Preview Card */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
            <div className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>معاينة حية لشكل الفاتورة وترويسة النظام لعميلك الجديد (Live White-Label Preview):</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 max-w-md mx-auto shadow-xs text-center font-mono text-xs">
              <div className="font-black text-slate-900 text-sm">{brandForm.companyName || 'اسم الشركة'}</div>
              <div className="text-[11px] text-emerald-700 font-bold">{brandForm.managerName || 'الإدارة العامة'}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{brandForm.tagline}</div>
              <div className="my-2 border-b border-dashed border-slate-300" />
              <div className="text-right text-[11px] text-slate-600 space-y-0.5">
                <div>العملة المعتمدة: <strong className="text-emerald-700 font-sans">{brandForm.currency}</strong></div>
                <div>خدمة العملاء: {brandForm.phone || '010XXXXXXXX'}</div>
                {brandForm.taxNumber && <div>رقم ضريبي: {brandForm.taxNumber}</div>}
              </div>
              <div className="my-2 border-b border-dashed border-slate-300" />
              <div className="text-[10px] text-slate-500 font-sans">{brandForm.receiptFooter}</div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={isSavingBrand}
              className="w-full sm:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black rounded-xl text-xs shadow-md shadow-emerald-600/20 transition flex items-center justify-center gap-2"
            >
              {isSavingBrand ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>جاري حفظ الهوية الجديدة...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>حفظ وتطبيق الهوية فوراً (Apply White-Label)</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* SECTION 1: FULL DATABASE BACKUP (النسخ الاحتياطي الكامل)     */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-50/80 to-white">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-black text-slate-900 break-words">
                  سحب وتحميل نسخة احتياطية كاملة (Full Backup)
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-100 text-blue-800 shrink-0">
                  JSON موثق
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                تفريغ شامل لكافة جداول وسجلات النظام بما يضمن الحفظ التام لبيانات المبيعات والمخزن والعملاء والموردين
              </p>
            </div>
          </div>

          <button
            onClick={handleDownloadBackup}
            disabled={isDownloading}
            className="w-full sm:w-auto px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-black shadow-md shadow-blue-600/20 transition flex items-center justify-center gap-2 active:scale-95 shrink-0"
          >
            {isDownloading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>جاري تجميع وحفظ البيانات...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>تحميل النسخة الاحتياطية الآن</span>
              </>
            )}
          </button>
        </div>

        {downloadSuccess && (
          <div className="m-6 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-xs font-bold text-emerald-800 animate-fadeIn">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>تم استخراج وتنزيل ملف النسخة الاحتياطية بنجاح على جهازك! احتفظ بالملف في مكان آمن.</span>
          </div>
        )}

        {/* Live Database Content Metrics Grid */}
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-slate-700">محتويات النسخة الاحتياطية الحالية (إجمالي السجلات: {totalRecordsCount})</h3>
            <span className="text-[11px] text-slate-400 font-semibold">تحديث فوري ومباشر</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 text-center">
              <Boxes className="w-5 h-5 text-indigo-600 mx-auto mb-1.5" />
              <div className="text-lg font-black text-slate-900">{stats.products}</div>
              <div className="text-[11px] font-bold text-slate-500">الأصناف والمنتجات</div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 text-center">
              <FileText className="w-5 h-5 text-blue-600 mx-auto mb-1.5" />
              <div className="text-lg font-black text-slate-900">{stats.invoices}</div>
              <div className="text-[11px] font-bold text-slate-500">فواتير المبيعات</div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 text-center">
              <Truck className="w-5 h-5 text-teal-600 mx-auto mb-1.5" />
              <div className="text-lg font-black text-slate-900">{stats.supplierPurchases}</div>
              <div className="text-[11px] font-bold text-slate-500">فواتير الموردين</div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 text-center">
              <Store className="w-5 h-5 text-amber-600 mx-auto mb-1.5" />
              <div className="text-lg font-black text-slate-900">{stats.clients}</div>
              <div className="text-[11px] font-bold text-slate-500">العملاء والمنافذ</div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 text-center">
              <Users className="w-5 h-5 text-purple-600 mx-auto mb-1.5" />
              <div className="text-lg font-black text-slate-900">{stats.users}</div>
              <div className="text-[11px] font-bold text-slate-500">المستخدمين والمناديب</div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 text-center">
              <Wallet className="w-5 h-5 text-emerald-600 mx-auto mb-1.5" />
              <div className="text-lg font-black text-slate-900">{stats.payrollPayments + stats.advances}</div>
              <div className="text-[11px] font-bold text-slate-500">المرتبات والسلف</div>
            </div>
          </div>

          <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <span className="text-blue-900 font-bold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
              <span>صيغة النسخة الاحتياطية: ملف JSON قياسي متوافق مع كافة أنظمة الاسترجاع ومعايير الأمان العالمية.</span>
            </span>
            <span className="text-blue-700 font-mono text-[11px] shrink-0">UTF-8 • JSON Schema 2.0</span>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* SECTION 2: DANGER ZONE (مسح وإعادة ضبط بيانات النظام)        */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded-3xl border-2 border-rose-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-rose-100 bg-rose-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-black text-rose-950 break-words">
                  منطقة العمليات الحساسة (Danger Zone) — مسح وضبط النظام
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-200 text-rose-900 shrink-0">
                  محمي بكلمة السر
                </span>
              </div>
              <p className="text-xs text-rose-700 mt-0.5 font-medium">
                إجراءات إدارية مشددة لمسح وتصفير العمليات أو إعادة ضبط المصنع الكاملة، لا يمكن التراجع عنها
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              setWipeError(null);
              setWipeSuccess(null);
              setConfirmPassword('');
              setShowWipeModal(true);
            }}
            className="w-full sm:w-auto px-5 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-xs font-black shadow-md shadow-rose-600/20 transition flex items-center justify-center gap-2 active:scale-95 shrink-0"
          >
            <AlertTriangle className="w-4 h-4" />
            <span>مسح أو إعادة ضبط بيانات النظام</span>
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Mode A Description */}
            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-2">
              <div className="flex items-center gap-2 text-slate-900 font-black text-sm">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                <span>خيار 1: مسح العمليات والحركات فقط (Transactions Only)</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                يمسح كافة فواتير المبيعات، عهد المناديب والسيارات، تشغيلات المخزن، المرتجعات، التحصيلات، التسويات، وسلف المناديب، ومشتريات الموردين.
              </p>
              <div className="text-[11px] font-bold text-emerald-700 pt-1 border-t border-slate-200">
                ✓ يحتفظ ببيانات الأصناف، العملاء والمنافذ، الموردين، والموظفين.
              </div>
            </div>

            {/* Mode B Description */}
            <div className="p-4 rounded-2xl border border-rose-200 bg-rose-50/30 space-y-2">
              <div className="flex items-center gap-2 text-rose-950 font-black text-sm">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-600"></span>
                <span>خيار 2: إعادة ضبط المصنع الكاملة (Full Factory Reset)</span>
              </div>
              <p className="text-xs text-rose-800 leading-relaxed">
                مسح وتصفير شامل لكافة قواعد البيانات لتبدأ الشركة من نقطة الصفر بشكل نظيف تماماً.
              </p>
              <div className="text-[11px] font-black text-rose-900 pt-1 border-t border-rose-200">
                ★ يحافظ بشكل دائم ومؤكد على حساب المدير العام وكلمة مروره للدخول.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* WIPE CONFIRMATION MODAL WITH PASSWORD VALIDATION             */}
      {/* ------------------------------------------------------------- */}
      {showWipeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-lg w-full p-6 sm:p-7 shadow-2xl relative space-y-5">
            {/* Modal Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-lg text-slate-900">
                    تأكيد مسح وإعادة ضبط بيانات النظام
                  </h3>
                  <p className="text-xs text-slate-500">إجراء حرج يتطلب التحقق الأمني من هوية المدير</p>
                </div>
              </div>

              <button
                onClick={() => setShowWipeModal(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error or Success Alerts */}
            {wipeError && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{wipeError}</span>
              </div>
            )}

            {wipeSuccess && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-bold text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{wipeSuccess}</span>
              </div>
            )}

            {/* Wipe Form */}
            <form onSubmit={handleExecuteWipe} className="space-y-4">
              {/* Select Wipe Scope / Mode */}
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-800 block">نطاق المسح المطلوب:</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setWipeMode('transactions_only')}
                    className={`p-3 rounded-2xl text-right border transition ${
                      wipeMode === 'transactions_only'
                        ? 'border-amber-500 bg-amber-50/80 ring-2 ring-amber-500/20 text-amber-950 font-bold'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs'
                    }`}
                  >
                    <div className="font-black text-xs mb-0.5">مسح الحركات والعمليات فقط</div>
                    <div className="text-[10px] text-slate-500">حذف الفواتير والمخزون والتسويات مع بقاء الأصناف والعملاء</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setWipeMode('all')}
                    className={`p-3 rounded-2xl text-right border transition ${
                      wipeMode === 'all'
                        ? 'border-rose-500 bg-rose-50/80 ring-2 ring-rose-500/20 text-rose-950 font-bold'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs'
                    }`}
                  >
                    <div className="font-black text-xs mb-0.5">إعادة ضبط المصنع الكاملة</div>
                    <div className="text-[10px] text-slate-500">مسح كل شيء وتصفير النظام مع بقاء حساب المدير العام</div>
                  </button>
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5 pt-2">
                <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-rose-600" />
                  <span>أدخل كلمة مرور المدير العام الحالية لتأكيد الإجراء:</span>
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="كلمة مرور المدير العام..."
                  required
                  autoFocus
                  className="w-full px-4 py-2.5 rounded-2xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 font-mono"
                />
                <p className="text-[11px] text-slate-400">
                  لن يتم تنفيذ مسح البيانات إلا إذا تطابقت كلمة المرور تماماً مع حساب المدير المسجل بالنظام.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowWipeModal(false)}
                  disabled={isWiping}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition"
                >
                  إلغاء الأمر
                </button>

                <button
                  type="submit"
                  disabled={isWiping || !confirmPassword}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-black shadow-md shadow-rose-600/20 transition flex items-center gap-2 active:scale-95"
                >
                  {isWiping ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>جاري التحقق والمسح...</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>تأكيد مسح البيانات نهائياً</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
