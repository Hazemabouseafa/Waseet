'use client';

import { useState, useRef } from 'react';
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
  ChevronRight,
  ChevronLeft,
  Building2,
  Wallet,
  TrendingUp,
  Settings,
} from 'lucide-react';

interface AdminNavProps {
  userName: string;
}

export default function AdminNav({ userName }: AdminNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { branding } = useBranding();
  const navContainerRef = useRef<HTMLDivElement>(null);

  // Password Modal State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passLoading, setPassLoading] = useState(false);
  const [passError, setPassError] = useState<string | null>(null);
  const [passSuccess, setPassSuccess] = useState<string | null>(null);

  const navItems = [
    { href: '/admin', label: 'الرقابة الحية والمؤشرات', icon: LayoutDashboard },
    { href: '/admin/profit-loss', label: 'الأرباح والخسائر (P&L)', icon: TrendingUp },
    { href: '/admin/suppliers', label: 'الموردين وفواتير الشراء', icon: Building2 },
    { href: '/admin/inventory', label: 'المخزن الرئيسي (FIFO)', icon: Boxes },
    { href: '/admin/dispatch', label: 'تحويل عهدة للسيارات', icon: Truck },
    { href: '/admin/invoices', label: 'فواتير المناديب والخصومات', icon: FileText },
    { href: '/admin/clients', label: 'المنافذ والسوبرماركتات', icon: Store },
    { href: '/admin/settlements', label: 'تسويات نهاية اليوم', icon: Scale },
    { href: '/admin/employees', label: 'الموظفين والمرتبات', icon: Wallet },
    { href: '/admin/advances', label: 'سلف المناديب', icon: HandCoins },
    { href: '/admin/reps', label: 'إدارة المناديب', icon: Users },
    { href: '/admin/analytics', label: 'التحليلات والمبيعات', icon: BarChart3 },
    { href: '/admin/settings', label: 'إعدادات النظام والنسخ الاحتياطي', icon: Settings },
  ];

  const handleLogout = async () => {
    await logoutAction();
    router.push('/login');
    router.refresh();
  };

  const scrollNav = (direction: 'left' | 'right') => {
    if (!navContainerRef.current) return;
    const distance = 250;
    navContainerRef.current.scrollBy({
      left: direction === 'left' ? -distance : distance,
      behavior: 'smooth',
    });
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

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
      {/* Top Bar */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-2">
          {/* Logo and Brand */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white shadow-md shadow-emerald-600/20 shrink-0">
              <Truck className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <div className="font-black text-sm sm:text-lg text-slate-800 leading-tight truncate">{branding.appName}</div>
              <div className="text-[10px] sm:text-[11px] text-emerald-600 font-semibold truncate hidden sm:block">{branding.managerName}</div>
            </div>
          </div>

          {/* User profile, Live Sync, Password Change & Logout */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Live Sync Status Pill */}
            <RealtimeSync />

            {/* Profile Pill */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-xl border border-slate-200">
              <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="text-right">
                <div className="text-xs font-bold text-slate-800">{branding.managerName || userName}</div>
                <div className="text-[10px] text-emerald-600 font-medium">المدير العام</div>
              </div>
            </div>

            {/* Settings & Backup Button */}
            <Link
              href="/admin/settings"
              title="إعدادات النظام والنسخ الاحتياطي"
              className={`p-2 sm:px-2.5 sm:py-1.5 rounded-xl border transition flex items-center gap-1.5 text-xs font-bold shadow-2xs shrink-0 ${
                pathname === '/admin/settings'
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'text-slate-700 hover:text-emerald-700 hover:bg-emerald-50 bg-slate-50 border-slate-200'
              }`}
            >
              <Settings className={`w-4 h-4 sm:w-3.5 sm:h-3.5 ${pathname === '/admin/settings' ? 'text-white' : 'text-slate-600'}`} />
              <span className="hidden md:inline">الإعدادات والنسخ</span>
            </Link>

            {/* Change Password Button */}
            <button
              onClick={() => {
                setPassError(null);
                setPassSuccess(null);
                setShowPasswordModal(true);
              }}
              title="تغيير كلمة مرور المدير العام"
              className="p-2 sm:px-2.5 sm:py-1.5 text-slate-700 hover:text-emerald-700 hover:bg-emerald-50 bg-slate-50 border border-slate-200 rounded-xl transition flex items-center gap-1.5 text-xs font-bold shadow-2xs shrink-0"
            >
              <KeyRound className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-emerald-600" />
              <span className="hidden md:inline">تغيير الباسوورد</span>
            </button>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              title="تسجيل الخروج"
              className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition flex items-center gap-1 text-xs font-semibold shrink-0"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">خروج</span>
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs Bar with Desktop Scroll Arrows */}
      <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 border-t border-slate-100 flex items-center gap-1.5 relative">
        {/* Right Arrow (Scroll Right / Forward in RTL) */}
        <button
          type="button"
          onClick={() => scrollNav('right')}
          title="تحريك التبويبات لليمين"
          aria-label="تحريك التبويبات لليمين"
          className="hidden md:flex items-center justify-center w-8 h-8 rounded-xl bg-slate-50 hover:bg-emerald-50 text-slate-500 hover:text-emerald-700 border border-slate-200 hover:border-emerald-200 transition shrink-0 active:scale-90 shadow-2xs"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Scrollable Nav Container */}
        <div
          ref={navContainerRef}
          className="flex-1 overflow-x-auto scrollbar-none scroll-smooth py-2 touch-pan-x [-webkit-overflow-scrolling:touch]"
        >
          <nav className="flex space-x-1 space-x-reverse min-w-max">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition whitespace-nowrap ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Left Arrow (Scroll Left / Backward in RTL) */}
        <button
          type="button"
          onClick={() => scrollNav('left')}
          title="تحريك التبويبات لليسار"
          aria-label="تحريك التبويبات لليسار"
          className="hidden md:flex items-center justify-center w-8 h-8 rounded-xl bg-slate-50 hover:bg-emerald-50 text-slate-500 hover:text-emerald-700 border border-slate-200 hover:border-emerald-200 transition shrink-0 active:scale-90 shadow-2xs"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

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
                  <div className="text-[11px] text-slate-500">حساب {branding.managerName || userName}</div>
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
                    minLength={3}
                    placeholder="3 أحرف أو أرقام على الأقل"
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
                    minLength={3}
                    placeholder="أعد إدخال كلمة المرور الجديدة"
                    className="w-full pr-9 pl-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="px-3 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={passLoading}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  {passLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>حفظ كلمة المرور</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
}
