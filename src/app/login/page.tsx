'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { loginAction } from '@/lib/actions';
import { Truck, ShieldCheck, UserCheck, AlertCircle, ArrowLeft, PackageCheck } from 'lucide-react';
import { useBranding } from '@/components/common/BrandingProvider';

export default function LoginPage() {
  const router = useRouter();
  const { branding } = useBranding();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setIsLoading(true);

    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);

    const res = await loginAction(formData);
    if (!res.success) {
      setError(res.error || 'فشل تسجيل الدخول');
      setIsLoading(false);
    } else {
      router.push(res.redirectTo || '/');
      router.refresh();
    }
  };

  const quickLogin = async (user: string, pass: string) => {
    setUsername(user);
    setPassword(pass);
    setError(null);
    setIsLoading(true);

    const formData = new FormData();
    formData.append('username', user);
    formData.append('password', pass);

    const res = await loginAction(formData);
    if (!res.success) {
      setError(res.error || 'فشل تسجيل الدخول');
      setIsLoading(false);
    } else {
      router.push(res.redirectTo || '/');
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-slate-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-700 p-8 text-white text-center relative overflow-hidden">
          <div className="absolute -top-10 -left-10 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none" />
          <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-emerald-400/20 rounded-full blur-xl pointer-events-none" />

          <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-inner border border-white/30">
            <Truck className="w-9 h-9 text-white" />
          </div>

          <h1 className="text-2xl font-bold tracking-tight mb-1">{branding.companyName}</h1>
          <p className="text-emerald-100 text-sm font-medium">{branding.managerName}</p>
          <p className="text-emerald-200 text-xs mt-0.5">{branding.tagline}</p>
          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-800/50 rounded-full text-xs text-emerald-200 border border-emerald-500/30">
            <PackageCheck className="w-3.5 h-3.5" />
            <span>نظام FIFO الصارم والتسوية اللحظية</span>
          </div>
        </div>

        {/* Form Container */}
        <div className="p-6 md:p-8 space-y-6">
          {error && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-3 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600 mt-0.5" />
              <div>{error}</div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                اسم المستخدم
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="أدخل اسم المستخدم (مثلاً: admin أو rep1)"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition text-slate-800 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                كلمة المرور
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition text-slate-800 text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold rounded-xl shadow-lg shadow-emerald-600/20 transition flex items-center justify-center gap-2 disabled:opacity-50 text-base"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>تسجيل الدخول للنظام</span>
                  <ArrowLeft className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Access Buttons */}
          <div className="pt-4 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-500 text-center mb-3">
              دخول تجريبي سريع بنقرة واحدة (Quick Demo Access):
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => quickLogin('admin', '123')}
                disabled={isLoading}
                className="p-3 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-xl text-right transition flex items-center gap-2 group"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-100 group-hover:bg-emerald-200 flex items-center justify-center text-emerald-800">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-800">مدير النظام</div>
                  <div className="text-[10px] text-slate-500">لوحة الإدارة الكاملة</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => quickLogin('rep1', '123')}
                disabled={isLoading}
                className="p-3 bg-slate-50 hover:bg-teal-50 border border-slate-200 hover:border-teal-300 rounded-xl text-right transition flex items-center gap-2 group cursor-pointer"
              >
                <div className="w-8 h-8 rounded-lg bg-teal-100 group-hover:bg-teal-200 flex items-center justify-center text-teal-800">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-800">مندوب مبيعات</div>
                  <div className="text-[10px] text-slate-500">أحمد سمير - واجهة المندوب</div>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 text-center text-xs text-slate-500">
          {branding.companyName} • {branding.tagline}
        </div>
      </div>
    </div>
  );
}
