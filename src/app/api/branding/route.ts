import { NextResponse } from 'next/server';
import { getWhiteLabelConfig, saveWhiteLabelConfig, resetWhiteLabelConfig } from '@/lib/white-label';
import { getCurrentUser } from '@/lib/auth';

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
      return NextResponse.json({ success: true, branding: resetConfig });
    }

    const updated = saveWhiteLabelConfig(body);
    return NextResponse.json({ success: true, branding: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'فشل تحديث هوية النظام' }, { status: 500 });
  }
}
