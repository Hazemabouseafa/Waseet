import type { Metadata } from "next";
import "./globals.css";
import { getWhiteLabelConfig } from "@/lib/white-label";
import { BrandingProvider } from "@/components/common/BrandingProvider";

export async function generateMetadata(): Promise<Metadata> {
  const branding = getWhiteLabelConfig();
  return {
    title: `${branding.companyName} | ${branding.tagline}`,
    description: `${branding.appName} - نظام إدارة المخزون والمبيعات الميدانية B2B المتكامل`,
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const branding = getWhiteLabelConfig();

  return (
    <html lang="ar" dir="rtl" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700;800;900&family=Tajawal:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 antialiased font-sans selection:bg-emerald-500 selection:text-white">
        <BrandingProvider initialBranding={branding}>
          {children}
        </BrandingProvider>
      </body>
    </html>
  );
}
