import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import AdminNav from '@/components/admin/AdminNav';
import { getWhiteLabelConfig } from '@/lib/white-label';

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
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <AdminNav userName={user.name} />
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 lg:p-8">
        {children}
      </main>
      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        {branding.companyName} • {branding.managerName} • {branding.tagline}
      </footer>
    </div>
  );
}
