import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import AdminNav from '@/components/admin/AdminNav';
import RealtimeSync from '@/components/common/RealtimeSync';
import { getWhiteLabelConfig } from '@/lib/white-label';
import {
  Boxes,
  Truck,
  Store,
  Building2,
  Scale,
  TrendingUp,
  Settings,
  ShieldCheck,
} from 'lucide-react';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  if (user.role !== 'admin') {
    redirect('/rep');
  }

  const branding = getWhiteLabelConfig();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* Right-Side Vertical Sidebar (في وضع RTL يظهر على اليمين تلقائياً) */}
      <AdminNav userName={user.name} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Desktop Quick-Actions Top Toolbar */}
        <header className="hidden lg:flex items-center justify-between gap-4 px-6 py-3 bg-white border-b border-slate-200 sticky top-0 z-30 shadow-2xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-black text-slate-400 ml-1">اختصارات سريعة:</span>
            <Link
              href="/admin/inventory"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition"
            >
              <Boxes className="w-3.5 h-3.5 text-emerald-600" />
              <span>+ صنف / تشغيلة بالمخزن</span>
            </Link>
            <Link
              href="/admin/dispatch"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 text-xs font-bold transition"
            >
              <Truck className="w-3.5 h-3.5 text-blue-600" />
              <span>تحميل / تفريغ سيارة</span>
            </Link>
            <Link
              href="/admin/clients"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold transition"
            >
              <Store className="w-3.5 h-3.5 text-amber-600" />
              <span>تحصيل مديونية عميل</span>
            </Link>
            <Link
              href="/admin/suppliers"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 text-xs font-bold transition"
            >
              <Building2 className="w-3.5 h-3.5 text-purple-600" />
              <span>فاتورة شراء مورد</span>
            </Link>
            <Link
              href="/admin/settlements"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold transition"
            >
              <Scale className="w-3.5 h-3.5 text-slate-600" />
              <span>تقفيل يومية مندوب</span>
            </Link>
            <Link
              href="/admin/profit-loss"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-bold transition"
            >
              <TrendingUp className="w-3.5 h-3.5 text-teal-600" />
              <span>الخزينة والأرباح</span>
            </Link>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <RealtimeSync />
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-black text-slate-800">
                {branding.managerName || user.name}
              </span>
            </div>
            <Link
              href="/admin/settings"
              className="p-2 rounded-xl bg-slate-100 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 border border-slate-200 transition"
              title="إعدادات الهوية والنسخ الاحتياطي"
            >
              <Settings className="w-4 h-4" />
            </Link>
          </div>
        </header>

        <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 lg:p-8">
          {children}
        </main>

        <footer className="border-t border-slate-200 bg-white py-3.5 px-6 text-center text-xs text-slate-500">
          {branding.companyName} • بإدارة: <span className="font-bold text-slate-700">{branding.managerName}</span> • {branding.tagline}
        </footer>
      </div>
    </div>
  );
}
