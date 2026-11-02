'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { logoutAction, updateAdminPasswordAction } from '@/lib/actions';
import RealtimeSync from '@/components/common/RealtimeSync';
import { useBranding } from '@/components/common/BrandingProvider';
import {
  LayoutDashboard,
  Boxes,
  Truck,
  Scale,
  Users,
  BarChart3,
  LogOut,
  ShieldCheck,
  FileText,
  Store,
  KeyRound,
  X,
  Lock,
  CheckCircle2,
  AlertCircle,
  HandCoins,
  Building2,
  Wallet,
  TrendingUp,
  Settings,
  Menu,
  Search,
  PlusCircle,
  Sparkles,
  ChevronLeft,
} from 'lucide-react';

interface AdminNavProps {
  userName: string;
}

export default function AdminNav({ userName }: AdminNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { branding } = useBranding();

  // Mobile right drawer state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [navSearch, setNavSearch] = useState('');

  // Password Modal State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passLoading, setPassLoading] = useState(false);
  const [passError, setPassError] = useState<string | null>(null);
  const [passSuccess, setPassSuccess] = useState<string | null>(null);

  const navSections = [
    {
      title: 'الرئيسية والملخص المباشر',
      items: [
        {
          href: '/admin',
          label: 'مركز التحكم والعمليات',
          subtitle: 'بيع مباشر • مؤشرات • تنبيهات',
          icon: LayoutDashboard,
          badge: 'الرئيسية',
        },
        {
          href: '/admin/analytics',
          label: 'تقارير المبيعات والتحليلات',
          subtitle: 'الأعلى مبيعاً وأداء الخطوط',
          icon: BarChart3,
        },
      ],
    },
    {
      title: 'إدارة المخازن والسيارات',
      items: [
        {
          href: '/admin/inventory',
          label: 'المخزن الرئيسي والأصناف',
          subtitle: 'إضافة أصناف • تشغيلات • أسعار',
          icon: Boxes,
        },
        {
          href: '/admin/dispatch',
          label: 'تحميل وتفريغ السيارات',
          subtitle: 'صرف عهدة للمندوب أو إرجاع للمخزن',
          icon: Truck,
        },
        {
          href: '/admin/settlements',
          label: 'جرد وتسوية نهاية اليوم',
          subtitle: 'مطابقة النقدية وعهدة السيارات',
          icon: Scale,
        },
      ],
    },
    {
      title: 'المبيعات والعملاء والموردين',
      items: [
        {
          href: '/admin/invoices',
          label: 'فواتير المبيعات والخصومات',
          subtitle: 'فواتير المناديب والمخزن المباشر',
          icon: FileText,
        },
        {
          href: '/admin/clients',
          label: 'العملاء وتحصيل المديونيات',
          subtitle: 'كشف حساب • تحصيل نقدي فوري',
          icon: Store,
        },
        {
          href: '/admin/suppliers',
          label: 'الموردين وفواتير الشراء',
          subtitle: 'توريد بضاعة وسداد مستحقات',
          icon: Building2,
        },
      ],
    },
    {
      title: 'المناديب والخزينة والحسابات',
      items: [
        {
          href: '/admin/profit-loss',
          label: 'الأرباح والخسائر والخزينة',
          subtitle: 'صافي الربح ورصيد الخزنة الفعلي',
          icon: TrendingUp,
        },
        {
          href: '/admin/reps',
          label: 'إدارة المناديب والتارجت',
          subtitle: 'حسابات المناديب والتارجت الشهري',
          icon: Users,
        },
        {
          href: '/admin/advances',
          label: 'سلف وعهد المناديب',
          subtitle: 'اعتماد وصرف السلف المالية',
          icon: HandCoins,
        },
        {
          href: '/admin/employees',
          label: 'شؤون الموظفين والرواتب',
          subtitle: 'المرتبات الشهرية والمصروفات الإدارية',
          icon: Wallet,
        },
      ],
    },
    {
      title: 'النظام والـ White-Label',
      items: [
        {
          href: '/admin/settings',
          label: 'الهوية التجارية والنسخ الاحتياطي',
          subtitle: 'تغيير اسم الشركة والمدير والألوان',
          icon: Settings,
        },
      ],
    },
  ];

  const allItems = navSections.flatMap((s) => s.items);
  const currentItem = allItems.find((item) => item.href === pathname) || allItems[0];

  const handleLogout = async () => {
    await logoutAction();
    router.push('/login');
    router.refresh();
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError(null);
    setPassSuccess(null);

    if (!oldPassword) {
      setPassError('يرجى إدخال كلمة المرور الحالية');
      return;
    }
    if (newPassword.length < 3) {
      setPassError('كلمة المرور الجديدة يجب أن لا تقل عن 3 أحرف/أرقام');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPassError('كلمة المرور الجديدة وتأكيدها غير متطابقين');
      return;
    }

    setPassLoading(true);
    const res = await updateAdminPasswordAction(oldPassword, newPassword);
    setPassLoading(false);

    if (res.success) {
      setPassSuccess(res.message || 'تم تغيير كلمة المرور بنجاح!');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setShowPasswordModal(false);
        setPassSuccess(null);
      }, 1500);
    } else {
      setPassError(res.error || 'فشل تغيير كلمة المرور');
    }
  };

  const renderSidebarContent = (isMobile = false) => (
    <div className="flex flex-col h-full bg-slate-900 text-white select-none">
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-800/80 flex items-center justify-between gap-3 bg-slate-950/40">
        <Link
          href="/admin"
          onClick={() => isMobile && setMobileMenuOpen(false)}
          className="flex items-center gap-3 min-w-0 group"
        >
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-emerald-600/25 shrink-0 group-hover:scale-105 transition">
            <Truck className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <div className="font-black text-base text-white leading-tight truncate">
              {branding.appName}
            </div>
            <div className="text-[11px] text-emerald-400 font-bold truncate mt-0.5">
              {branding.companyName}
            </div>
          </div>
        </Link>

        {isMobile && (
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Manager Profile Card inside Right Sidebar */}
      <div className="px-4 py-3 bg-slate-800/40 border-b border-slate-800/80 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-black text-white truncate">
              {branding.managerName || userName}
            </div>
            <div className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>المدير العام للنظام</span>
            </div>
          </div>
        </div>
        <Link
          href="/admin/settings"
          onClick={() => isMobile && setMobileMenuOpen(false)}
          title="تعديل اسم المدير والهوية"
          className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-emerald-600 text-[10px] font-bold text-slate-300 hover:text-white transition shrink-0"
        >
          تخصيص
        </Link>
      </div>

      {/* Quick Filter inside Sidebar */}
      <div className="px-3 pt-3 pb-1">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            value={navSearch}
            onChange={(e) => setNavSearch(e.target.value)}
            placeholder="ابحث في أقسام البرنامج..."
            className="w-full pr-8 pl-3 py-1.5 rounded-xl bg-slate-800/70 border border-slate-700/70 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition"
          />
          {navSearch && (
            <button
              type="button"
              onClick={() => setNavSearch('')}
              className="absolute left-2.5 top-2 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Categorized Navigation Links (Right Sidebar) */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-4 scrollbar-thin">
        {navSections.map((section) => {
          const filteredItems = section.items.filter(
            (item) =>
              !navSearch.trim() ||
              item.label.includes(navSearch.trim()) ||
              item.subtitle.includes(navSearch.trim())
          );
          if (filteredItems.length === 0) return null;

          return (
            <div key={section.title} className="space-y-1">
              <div className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>{section.title}</span>
                <span className="h-px flex-1 bg-slate-800 mr-2" />
              </div>

              <div className="space-y-1">
                {filteredItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => isMobile && setMobileMenuOpen(false)}
                      className={`group flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl transition-all ${
                        isActive
                          ? 'bg-gradient-to-l from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-900/40 font-black'
                          : 'text-slate-300 hover:bg-slate-800/80 hover:text-white font-semibold'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition ${
                            isActive
                              ? 'bg-white/20 text-white'
                              : 'bg-slate-800 text-slate-400 group-hover:bg-slate-700 group-hover:text-emerald-400'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs sm:text-[13px] leading-snug truncate">
                            {item.label}
                          </div>
                          <div
                            className={`text-[10px] truncate ${
                              isActive ? 'text-emerald-100' : 'text-slate-400'
                            }`}
                          >
                            {item.subtitle}
                          </div>
                        </div>
                      </div>

                      {item.badge ? (
                        <span
                          className={`px-2 py-0.5 text-[9px] font-black rounded-full shrink-0 ${
                            isActive
                              ? 'bg-white text-emerald-700'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {item.badge}
                        </span>
                      ) : (
                        <ChevronLeft
                          className={`w-3.5 h-3.5 shrink-0 transition-transform ${
                            isActive
                              ? 'text-white translate-x-0'
                              : 'text-slate-600 opacity-0 group-hover:opacity-100'
                          }`}
                        />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Actions inside Right Sidebar */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/60 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              setPassError(null);
              setPassSuccess(null);
              setShowPasswordModal(true);
            }}
            className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition border border-slate-700"
          >
            <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
            <span>الباسوورد</span>
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-600 text-rose-300 hover:text-white text-xs font-bold transition border border-rose-500/30"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>خروج آمن</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* DESKTOP RIGHT SIDEBAR (شريط التبويبات الرأسي على اليمين) */}
      <aside className="hidden lg:block w-72 shrink-0 bg-slate-900 border-l border-slate-800 min-h-screen sticky top-0 h-screen z-40 shadow-xl">
        {renderSidebarContent(false)}
      </aside>

      {/* MOBILE / TABLET TOP BAR + RIGHT DRAWER TRIGGER */}
      <div className="lg:hidden sticky top-0 z-40 bg-slate-900 text-white border-b border-slate-800 px-3 py-2.5 flex items-center justify-between gap-2 shadow-md">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 rounded-xl bg-emerald-600 text-white shadow-sm flex items-center gap-1.5 text-xs font-black shrink-0"
          >
            <Menu className="w-5 h-5" />
            <span>القائمة</span>
          </button>
          <div className="min-w-0">
            <div className="font-black text-sm text-white truncate">{branding.appName}</div>
            <div className="text-[10px] text-emerald-400 font-bold truncate">
              {currentItem.label}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <RealtimeSync />
          <Link
            href="/admin/settings"
            className="p-2 rounded-xl bg-slate-800 text-slate-200 hover:text-white"
            title="الإعدادات والهوية"
          >
            <Settings className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* MOBILE SLIDE-OVER RIGHT DRAWER */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-80 max-w-[85vw] h-full bg-slate-900 z-10 shadow-2xl">
            {renderSidebarContent(true)}
          </div>
        </div>
      )}

      {/* Modal: Change Admin Password */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">تغيير كلمة مرور المدير العام</h3>
                  <div className="text-[11px] text-slate-500">
                    حساب {branding.managerName || userName}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPasswordModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {passError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2 text-xs">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>{passError}</span>
              </div>
            )}

            {passSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2 text-xs font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>{passSuccess}</span>
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  كلمة المرور الحالية
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                  <input
                    type="password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    required
                    placeholder="أدخل كلمة المرور الحالية"
                    className="w-full pr-9 pl-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  كلمة المرور الجديدة
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    placeholder="أدخل كلمة المرور الجديدة"
                    className="w-full pr-9 pl-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  تأكيد كلمة المرور الجديدة
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="أعد كتابة كلمة المرور الجديدة"
                    className="w-full pr-9 pl-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  disabled={passLoading}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white font-bold text-xs shadow-md transition cursor-pointer"
                >
                  {passLoading ? 'جاري التحديث...' : 'حفظ كلمة المرور الجديدة'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold text-xs"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
