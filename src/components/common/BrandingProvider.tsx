'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import type { WhiteLabelConfig } from '@/lib/white-label';

const defaultBranding: WhiteLabelConfig = {
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

interface BrandingContextType {
  branding: WhiteLabelConfig;
  refreshBranding: () => Promise<void>;
  updateBranding: (newConfig: Partial<WhiteLabelConfig>) => Promise<boolean>;
  resetBranding: () => Promise<boolean>;
}

const BrandingContext = createContext<BrandingContextType>({
  branding: defaultBranding,
  refreshBranding: async () => {},
  updateBranding: async () => false,
  resetBranding: async () => false,
});

export function BrandingProvider({
  children,
  initialBranding,
}: {
  children: React.ReactNode;
  initialBranding?: WhiteLabelConfig;
}) {
  const [branding, setBranding] = useState<WhiteLabelConfig>(initialBranding || defaultBranding);

  const refreshBranding = async () => {
    try {
      const res = await fetch('/api/branding');
      if (res.ok) {
        const data = await res.json();
        setBranding(data);
      }
    } catch (_) {}
  };

  const updateBranding = async (newConfig: Partial<WhiteLabelConfig>): Promise<boolean> => {
    try {
      const res = await fetch('/api/branding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.branding) {
          setBranding(data.branding);
          return true;
        }
      }
      return false;
    } catch (_) {
      return false;
    }
  };

  const resetBranding = async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/branding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reset: true }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.branding) {
          setBranding(data.branding);
          return true;
        }
      }
      return false;
    } catch (_) {
      return false;
    }
  };

  return (
    <BrandingContext.Provider value={{ branding, refreshBranding, updateBranding, resetBranding }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  return useContext(BrandingContext);
}
