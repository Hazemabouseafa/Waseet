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
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';

interface AdminNavProps {
  userName: string;
}

export default function AdminNav({ userName }: AdminNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { branding } = useBranding();

  // Desktop collapse state & Mobile drawer state
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
      title: 'الرئيسية',
      items: [
        {
          href: '/admin',
          label: 'الرئيسية والعمليات السريعة',
          icon: LayoutDashboard,
          accent: 'text-emerald-400',
        },
        {
          href: '/admin/analytics',
          label: 'تقارير المبيعات والتحليلات',
          icon: BarChart3,
          accent: 'text-sky-400',
        },
      ],
    },
    {
      title: 'المخازن والسيارات',
      items: [
        {
          href: '/admin/inventory',
          label: 'المخزن الرئيسي والصلاحيات',
          icon: Boxes,
          accent: 'text-emerald-400',
        },
        {
          href: '/admin/dispatch',
          label: 'تحميل وتفريغ السيارات',
          icon: Truck,
          accent: 'text-blue-400',
        },
        {
          href: '/admin/settlements',
          label: 'جرد وتسوية نهاية اليوم',
          icon: Scale,
          accent: 'text-amber-400',
        },
      ],
    },
    {
      title: 'المبيعات والعملاء والموردين',
      items: [
        {
          href: '/admin/invoices',
          label: 'فواتير المبيعات والخصومات',
          icon: FileText,
          accent: 'text-teal-400',
        },
        {
          href: '/admin/clients',
          label: 'العملاء وتحصيل المديونيات',
          icon: Store,
          accent: 'text-amber-400',
        },
        {
          href: '/admin/suppliers',
          label: 'الموردين وفواتير الشراء',
          icon: Building2,
          accent: 'text-purple-400',
        },
      ],
    },
    {
      title: 'الخزينة والمناديب والنظام',
      items: [
        {
          href: '/admin/profit-loss',
          label: 'الأرباح والخسائر والخزينة',
          icon: TrendingUp,
          accent: 'text-emerald-400',
        },
        {
          href: '/admin/reps',
          label: 'إدارة المناديب والتارجت',
          icon: Users,
          accent: 'text-indigo-400',
        },
        {
          href: '/admin/advances',
          label: 'سلف وعهد المناديب',
          icon: HandCoins,
          accent: 'text-amber-400',
        },
        {
          href: '/admin/employees',
          label: 'شؤون الموظفين والرواتب',
          icon: Wallet,
          accent: 'text-cyan-400',
        },
        {
          href: '/admin/settings',
          label: 'الهوية التجارية والإعدادات',
          icon: Settings,
          accent: 'text-slate-300',
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

  const renderSidebarContent = (isMobile = false) => {
    const isMini = !isMobile && collapsed;

    return (
      <div className="flex flex-col h-full bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white select-none">
        {/* Top Brand & Collapse Toggle */}
        <div
          className={`h-16 px-3.5 border-b border-white/10 flex items-center ${
            isMini ? 'justify-center' : 'justify-between'
          } gap-2`}
        >
          <Link
            href="/admin"
            onClick={() => isMobile && setMobileMenuOpen(false)}
            className="flex items-center gap-2.5 min-w-0 group"
            title={branding.appName}
          >
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-emerald-500/25 shrink-0 group-hover:scale-105 transition">
              <Truck className="w-5 h-5" />
            </div>
            {!isMini && (
              <div className="min-w-0">
                <div className="font-black text-sm text-white leading-tight truncate">
                  {branding.appName}
                </div>
                <div className="text-[10px] text-emerald-400 font-bold truncate mt-0.5">
                  {branding.companyName}
                </div>
              </div>
            )}
          </Link>

          {isMobile ? (
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="p-1.5 rounded-xl bg-white/10 text-slate-300 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          ) : (
            !isMini && (
              <button
                type="button"
                onClick={() => setCollapsed(true)}
                title="تصغير الشريط الجانبي"
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
              >
                <PanelRightClose className="w-4 h-4" />
              </button>
            )
          )}
        </div>

        {/* Expand button when collapsed */}
        {isMini && (
          <div className="px-2 pt-2 flex justify-center">
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              title="توسيع الشريط الجانبي"
              className="w-10 h-8 rounded-xl bg-white/5 hover:bg-emerald-600/30 text-emerald-400 flex items-center justify-center transition cursor-pointer"
            >
              <PanelRightOpen className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Sleek Manager Pill */}
        <div className="px-3 py-2.5 border-b border-white/5">
          {isMini ? (
            <Link
              href="/admin/settings"
              title={`المدير العام: ${branding.managerName || userName} (تعديل الهوية)`}
              className="w-10 h-10 mx-auto rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center hover:bg-emerald-600 hover:text-white transition"
            >
              <ShieldCheck className="w-5 h-5" />
            </Link>
          ) : (
            <div className="px-3 py-2 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-black text-white truncate">
                    {branding.managerName || userName}
                  </div>
                  <div className="text-[10px] text-emerald-400/90 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>المدير العام</span>
                  </div>
                </div>
              </div>
              <Link
                href="/admin/settings"
                onClick={() => isMobile && setMobileMenuOpen(false)}
                className="px-2 py-1 rounded-lg bg-white/10 hover:bg-emerald-600 text-[10px] font-bold text-slate-200 hover:text-white transition shrink-0"
              >
                الهوية
              </Link>
            </div>
          )}
        </div>

        {/* Clean Single-Line Navigation Pills */}
        <div className="flex-1 overflow-y-auto px-2.5 py-2.5 space-y-3.5 scrollbar-thin">
          {navSections.map((section) => (
            <div key={section.title} className="space-y-1">
              {!isMini && (
                <div className="px-3 pb-0.5 text-[10px] font-bold text-slate-400/80">
                  {section.title}
                </div>
              )}

              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => isMobile && setMobileMenuOpen(false)}
                      title={item.label}
                      className={`group relative flex items-center ${
                        isMini ? 'justify-center p-2.5' : 'gap-2.5 px-3 py-2'
                      } rounded-xl text-xs transition-all duration-150 ${
                        isActive
                          ? 'bg-gradient-to-l from-emerald-600 to-teal-600 text-white font-black shadow-md shadow-emerald-950/50'
                          : 'text-slate-300 hover:bg-white/[0.06] hover:text-white font-bold'
                      }`}
                    >
                      {/* Active Right-Edge Indicator Pill */}
                      {isActive && !isMini && (
                        <span className="absolute right-0 top-2 bottom-2 w-1 rounded-l-full bg-white shadow-xs" />
                      )}

                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition ${
                          isActive
                            ? 'bg-white/20 text-white'
                            : `bg-white/[0.04] ${item.accent} group-hover:bg-white/10`
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>

                      {!isMini && <span className="truncate">{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Sleek Footer Actions */}
        <div className="p-2.5 border-t border-white/10 bg-slate-950/60">
          {isMini ? (
            <div className="flex flex-col items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setPassError(null);
                  setPassSuccess(null);
                  setShowPasswordModal(true);
                }}
                title="تغيير كلمة المرور"
                className="w-10 h-9 rounded-xl bg-white/5 hover:bg-white/15 text-emerald-400 flex items-center justify-center transition cursor-pointer"
              >
                <KeyRound className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleLogout}
                title="تسجيل الخروج"
                className="w-10 h-9 rounded-xl bg-rose-500/15 hover:bg-rose-600 text-rose-300 hover:text-white flex items-center justify-center transition cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setPassError(null);
                  setPassSuccess(null);
                  setShowPasswordModal(true);
                }}
                className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl bg-white/[0.06] hover:bg-white/15 text-slate-200 text-[11px] font-bold transition cursor-pointer"
              >
                <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
                <span>كلمة المرور</span>
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl bg-rose-500/15 hover:bg-rose-600 text-rose-300 hover:text-white text-[11px] font-bold transition cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>خروج آمن</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* DESKTOP RIGHT SIDEBAR (شريط التبويبات الرأسي الأنيق على اليمين) */}
      <aside
        className={`hidden lg:block ${
          collapsed ? 'w-20' : 'w-64'
        } shrink-0 bg-slate-950 border-l border-slate-800/80 min-h-screen sticky top-0 h-screen z-40 shadow-xl transition-all duration-200`}
      >
        {renderSidebarContent(false)}
      </aside>

      {/* MOBILE / TABLET TOP BAR + RIGHT DRAWER TRIGGER */}
      <div className="lg:hidden sticky top-0 z-40 bg-slate-950 text-white border-b border-slate-800 px-3 py-2.5 flex items-center justify-between gap-2 shadow-md">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="px-3 py-2 rounded-xl bg-emerald-600 text-white shadow-sm flex items-center gap-1.5 text-xs font-black shrink-0"
          >
            <Menu className="w-4 h-4" />
            <span>الأقسام</span>
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
          <div className="relative w-72 max-w-[85vw] h-full bg-slate-950 z-10 shadow-2xl">
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
