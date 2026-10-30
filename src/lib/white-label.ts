import fs from 'fs';
import path from 'path';

export interface WhiteLabelConfig {
  appName: string;
  companyName: string;
  managerName: string;
  tagline: string;
  currency: string;
  phone: string;
  address: string;
  commercialRegister: string;
  taxNumber: string;
  receiptHeader: string;
  receiptFooter: string;
  primaryColor: string;
  secondaryColor: string;
}

export const DEFAULT_BRANDING: WhiteLabelConfig = {
  appName: 'الوسيط',
  companyName: 'الوسيط للتوزيع والتوريدات',
  managerName: 'الإدارة العامة',
  tagline: 'نظام إدارة المبيعات الميدانية والتوزيع B2B',
  currency: 'ج.م',
  phone: '01000000000',
  address: 'القاهرة - جمهورية مصر العربية',
  commercialRegister: '1029384',
  taxNumber: '987-654-321',
  receiptHeader: 'فاتورة مبيعات ميدانية إلكترونية',
  receiptFooter: 'شكراً لتعاملكم معنا - نسعد دائماً بخدمتكم',
  primaryColor: '#10b981',
  secondaryColor: '#1e293b',
};

const BRANDING_FILE_PATH = path.join(process.cwd(), 'data', 'branding.json');

export function getWhiteLabelConfig(): WhiteLabelConfig {
  try {
    if (fs.existsSync(BRANDING_FILE_PATH)) {
      const content = fs.readFileSync(BRANDING_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(content);
      return { ...DEFAULT_BRANDING, ...parsed };
    }
  } catch (e) {
    console.error('Error reading branding file, fallback to env/defaults:', e);
  }

  // Fallback to Environment Variables or Defaults
  return {
    appName: process.env.NEXT_PUBLIC_APP_NAME || DEFAULT_BRANDING.appName,
    companyName: process.env.NEXT_PUBLIC_COMPANY_NAME || DEFAULT_BRANDING.companyName,
    managerName: process.env.NEXT_PUBLIC_MANAGER_NAME || DEFAULT_BRANDING.managerName,
    tagline: process.env.NEXT_PUBLIC_TAGLINE || DEFAULT_BRANDING.tagline,
    currency: process.env.NEXT_PUBLIC_CURRENCY || DEFAULT_BRANDING.currency,
    phone: process.env.NEXT_PUBLIC_PHONE || DEFAULT_BRANDING.phone,
    address: process.env.NEXT_PUBLIC_ADDRESS || DEFAULT_BRANDING.address,
    commercialRegister: process.env.NEXT_PUBLIC_CR || DEFAULT_BRANDING.commercialRegister,
    taxNumber: process.env.NEXT_PUBLIC_TAX || DEFAULT_BRANDING.taxNumber,
    receiptHeader: process.env.NEXT_PUBLIC_RECEIPT_HEADER || DEFAULT_BRANDING.receiptHeader,
    receiptFooter: process.env.NEXT_PUBLIC_RECEIPT_FOOTER || DEFAULT_BRANDING.receiptFooter,
    primaryColor: process.env.NEXT_PUBLIC_PRIMARY_COLOR || DEFAULT_BRANDING.primaryColor,
    secondaryColor: process.env.NEXT_PUBLIC_SECONDARY_COLOR || DEFAULT_BRANDING.secondaryColor,
  };
}

export function saveWhiteLabelConfig(config: Partial<WhiteLabelConfig>): WhiteLabelConfig {
  const current = getWhiteLabelConfig();
  const updated: WhiteLabelConfig = {
    ...current,
    ...config,
  };

  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  fs.writeFileSync(BRANDING_FILE_PATH, JSON.stringify(updated, null, 2), 'utf-8');
  return updated;
}

export function resetWhiteLabelConfig(): WhiteLabelConfig {
  if (fs.existsSync(BRANDING_FILE_PATH)) {
    try {
      fs.unlinkSync(BRANDING_FILE_PATH);
    } catch (_) {}
  }
  return DEFAULT_BRANDING;
}
