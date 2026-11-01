import { NextResponse } from 'next/server';
import { getWhiteLabelConfig, saveWhiteLabelConfig, resetWhiteLabelConfig } from '@/lib/white-label';
import { getCurrentUser } from '@/lib/auth';
import { dbStore } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const branding = getWhiteLabelConfig();
  return NextResponse.json(branding);
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'غير مصرح لك بتعديل هوية النظام' }, { status: 403 });
    }

    const body = await req.json();

    if (body.reset) {
      const resetConfig = resetWhiteLabelConfig();
      try {
        const users = await dbStore.getUsers();
        const adminUser = users.find((u) => u.username === 'admin' || u.role === 'admin');
        if (adminUser) {
          await dbStore.updateUser(adminUser.id, { name: resetConfig.managerName });
        }
      } catch (_) {}
      return NextResponse.json({ success: true, branding: resetConfig });
    }

    const updated = saveWhiteLabelConfig(body);

    // Sync admin user profile name in database
    if (body.managerName && typeof body.managerName === 'string') {
      try {
        const users = await dbStore.getUsers();
        const adminUser = users.find((u) => u.username === 'admin' || u.role === 'admin');
        if (adminUser) {
          await dbStore.updateUser(adminUser.id, { name: body.managerName.trim() });
        }
      } catch (err) {
        console.error('Failed to sync admin user name in store:', err);
      }
    }

    return NextResponse.json({ success: true, branding: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'فشل تحديث هوية النظام' }, { status: 500 });
  }
}
