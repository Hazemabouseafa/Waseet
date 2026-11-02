'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { exportWorkbookToExcel } from '@/lib/excelExport';
import {
  ProfitLossSummary,
  PayrollPayment,
  TreasurySummary,
  ComprehensiveProfitLossData,
  Invoice,
  Collection,
  SupplierPurchase,
  AdvanceRequest,
  ReturnItem,
  InventoryBatch,
  Product,
  Supplier,
} from '@/types';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  PieChart,
  ShoppingBag,
  Users,
  Tag,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Search,
  Layers,
  Sparkles,
  Calculator,
  ShieldCheck,
  Percent,
  Calendar,
  CalendarDays,
  Filter,
  CreditCard,
  Wallet,
  HandCoins,
  RotateCcw,
  Truck,
  FileText,
  Package,
  BarChart3,
  Clock,
  CheckCircle2,
  AlertCircle,
  Building2,
  ExternalLink,
  ChevronLeft,
} from 'lucide-react';
import Link from 'next/link';

type PeriodType = 'today' | 'week' | 'month' | 'custom';

interface Props {
  initialData: ComprehensiveProfitLossData;
}

export default function ProfitLossClientView({ initialData }: Props) {
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Time Filter State
  const [period, setPeriod] = useState<PeriodType>('month');

  // Custom Date Range State (defaults to current month)
  const now = new Date();
  const firstDayOfMonthStr = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const todayStr = now.toISOString().split('T')[0];

  const [customStartDate, setCustomStartDate] = useState(firstDayOfMonthStr);
  const [customEndDate, setCustomEndDate] = useState(todayStr);

  // Paid-Only Toggle State
  const [paidOnly, setPaidOnly] = useState(false);

  // Product Table Filters
  const [searchProduct, setSearchProduct] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // Interactive Chart Hover State
  const [hoveredDayIndex, setHoveredDayIndex] = useState<number | null>(null);

  const handleRefresh = () => {
    setIsRefreshing(true);
    router.refresh();
    setTimeout(() => setIsRefreshing(false), 600);
  };

  // Determine active date range [startDate, endDate]
  const { startDate, endDate, periodLabel } = useMemo(() => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    if (period === 'today') {
      const start = new Date(today);
      start.setHours(0, 0, 0, 0);
      return {
        startDate: start,
        endDate: today,
        periodLabel: `اليوم (${today.toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' })})`,
      };
    }

    if (period === 'week') {
      // Egyptian/Arabic workweek starts Saturday (day 6 in JS Date: 0=Sun, 6=Sat)
      const start = new Date(today);
      const day = start.getDay();
      const diff = (day + 1) % 7; // days since Saturday
      start.setDate(start.getDate() - diff);
      start.setHours(0, 0, 0, 0);
      return {
        startDate: start,
        endDate: today,
        periodLabel: `الأسبوع الحالي (من السبت ${start.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' })} وحتى اليوم)`,
      };
    }

    if (period === 'month') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1, 0, 0, 0, 0);
      return {
        startDate: start,
        endDate: today,
        periodLabel: `الشهر الحالي (${today.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' })})`,
      };
    }

    // Custom
    const start = new Date(customStartDate + 'T00:00:00');
    const end = new Date(customEndDate + 'T23:59:59.999');
    return {
      startDate: start,
      endDate: end,
      periodLabel: `فترة مخصصة (من ${customStartDate} إلى ${customEndDate})`,
    };
  }, [period, customStartDate, customEndDate]);

  // Maps for products, batches & suppliers
  const prodMap = useMemo(() => {
    const map = new Map<string, Product>();
    (data.rawProducts || []).forEach((p) => map.set(p.id, p));
    return map;
  }, [data.rawProducts]);

  const batchMap = useMemo(() => {
    const map = new Map<string, InventoryBatch>();
    (data.rawBatches || []).forEach((b) => map.set(b.id, b));
    return map;
  }, [data.rawBatches]);

  const supplierMap = useMemo(() => {
    const map = new Map<string, any>();
    (data.rawSuppliers || []).forEach((s) => map.set(s.id, s));
    return map;
  }, [data.rawSuppliers]);

  // Dynamic Financial Calculations for the active timeframe & paidOnly toggle
  const financialMetrics = useMemo(() => {
    const startTime = startDate.getTime();
    const endTime = endDate.getTime();

    const inRange = (dateStr?: string) => {
      if (!dateStr) return false;
      const t = new Date(dateStr).getTime();
      return t >= startTime && t <= endTime;
    };

    // Filter raw records in range
    const periodInvoices = (data.rawInvoices || []).filter((i) => inRange(i.createdAt));
    const periodCollections = (data.rawCollections || []).filter((c) => inRange(c.createdAt));
    const periodPurchases = (data.rawPurchases || []).filter((p) => inRange(p.createdAt));
    const periodPayroll = (data.rawPayroll || []).filter((p) => inRange(p.paymentDate || p.createdAt));
    const periodAdvances = (data.rawAdvances || []).filter((a) => inRange(a.createdAt));
    const periodReturns = (data.rawReturns || []).filter((r) => inRange(r.createdAt));

    // 1. Total Invoiced Sales Revenue
    const totalSalesRevenue = periodInvoices.reduce((sum, inv) => sum + (Number(inv.totalAmount) || 0), 0);

    // 2. Total Cash Collected in Period
    const cashFromDirectCashInvoices = periodInvoices
      .filter((inv) => inv.paymentType === 'cash')
      .reduce((sum, inv) => sum + (Number(inv.totalAmount) || 0), 0);

    const cashDownPaymentsOnCredit = periodInvoices
      .filter((inv) => inv.paymentType === 'credit')
      .reduce((sum, inv) => sum + (Number(inv.paidAmount) || 0), 0);

    const cashFromCollections = periodCollections.reduce((sum, col) => sum + (Number(col.amount) || 0), 0);

    const totalCollectedCash = cashFromDirectCashInvoices + cashDownPaymentsOnCredit + cashFromCollections;

    // 3. Pending Credit / Client Dues created in this period
    const totalPendingCredit = Math.max(
      0,
      periodInvoices.reduce((sum, inv) => {
        if (inv.paymentType === 'credit') {
          const rem = (Number(inv.totalAmount) || 0) - (Number(inv.paidAmount) || 0);
          return sum + Math.max(0, rem);
        }
        return sum;
      }, 0) - cashFromCollections
    );

    // 4. COGS Calculation
    let periodCogs = 0;
    const productStatsMap = new Map<string, { unitsSold: number; revenue: number; cost: number }>();

    for (const inv of periodInvoices) {
      if (!inv.items || !Array.isArray(inv.items)) continue;
      for (const item of inv.items) {
        const prod = prodMap.get(item.productId);
        const batch = item.batchId ? batchMap.get(item.batchId) : undefined;
        const unitCost =
          batch?.unitCost !== undefined && batch.unitCost > 0 ? batch.unitCost : (prod?.cost || 0);
        const lineCost = (Number(item.quantity) || 0) * unitCost;
        const lineRevenue =
          Number(item.totalPrice) || (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);

        periodCogs += lineCost;

        const curr = productStatsMap.get(item.productId) || { unitsSold: 0, revenue: 0, cost: 0 };
        curr.unitsSold += Number(item.quantity) || 0;
        curr.revenue += lineRevenue;
        curr.cost += lineCost;
        productStatsMap.set(item.productId, curr);
      }
    }

    // 5. Operating Expenses & Deductions
    const totalSalaries = periodPayroll.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const totalApprovedAdvances = periodAdvances
      .filter((a) => a.status === 'approved')
      .reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
    const totalOperatingExpenses = totalSalaries + totalApprovedAdvances;

    const totalDiscounts = periodInvoices.reduce((sum, inv) => sum + (Number(inv.discount) || 0), 0);

    let totalWastageLoss = 0;
    for (const ret of periodReturns) {
      if (ret.amount !== undefined && ret.amount > 0) {
        totalWastageLoss += Number(ret.amount);
      } else {
        const prod = prodMap.get(ret.productId);
        const batch = ret.batchId ? batchMap.get(ret.batchId) : undefined;
        const unitCost =
          batch?.unitCost !== undefined && batch.unitCost > 0 ? batch.unitCost : (prod?.cost || 0);
        totalWastageLoss += (Number(ret.quantity) || 0) * unitCost;
      }
    }

    // 6. Supplier Purchases in period (فواتير الموردين والآجل والمسدد في الفترة)
    const totalSupplierPurchases = periodPurchases.reduce(
      (sum, p) => sum + (Number(p.totalAmount) || 0),
      0
    );

    const periodSupplierDirectPaid = periodPurchases.reduce(
      (sum, p) => sum + (Number(p.paidAmount) || 0),
      0
    );

    const periodSupplierPayments = (data.rawSupplierPayments || []).filter((p) => inRange(p.createdAt));
    const periodSupplierExtraPaid = periodSupplierPayments.reduce(
      (sum, p) => sum + (Number(p.amount) || 0),
      0
    );

    const totalPeriodSupplierCashPaid = periodSupplierDirectPaid + periodSupplierExtraPaid;
    const periodSupplierRemainingDue = Math.max(0, totalSupplierPurchases - totalPeriodSupplierCashPaid);
    const periodCreditPurchasesCount = periodPurchases.filter(
      (p) => p.paymentType === 'credit' || (Number(p.totalAmount) - Number(p.paidAmount)) > 0
    ).length;
    const periodSupplierPaymentRatio = totalSupplierPurchases > 0
      ? (totalPeriodSupplierCashPaid / totalSupplierPurchases) * 100
      : 100;

    // All-time supplier payables (الفواتير الآجلة غير المسددة بالكامل)
    const allPurchases = data.rawPurchases || [];
    const allSupplierPayments = data.rawSupplierPayments || [];
    const allTimePurchasesTotal = allPurchases.reduce((sum, p) => sum + (Number(p.totalAmount) || 0), 0);
    const allTimePaidToSuppliers = allPurchases.reduce((sum, p) => sum + (Number(p.paidAmount) || 0), 0) +
      allSupplierPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const allTimeSupplierPayables = Math.max(0, allTimePurchasesTotal - allTimePaidToSuppliers);

    const pendingCreditPurchases = allPurchases.filter((p) => {
      const remaining = (Number(p.totalAmount) || 0) - (Number(p.paidAmount) || 0);
      return remaining > 0;
    });

    const netFreeTreasuryCash = (data.treasury?.currentBalance ?? 0) - (data.treasury?.totalSupplierPayables ?? allTimeSupplierPayables);

    // 7. Invoices Counts
    const totalInvoicesCount = periodInvoices.length;
    const cashInvoicesCount = periodInvoices.filter((i) => i.paymentType === 'cash').length;
    const creditInvoicesCount = periodInvoices.filter((i) => i.paymentType === 'credit').length;

    // 8. Service Profits (0 if no dedicated service items)
    const serviceProfits = 0;

    // 9. Effective Revenue & COGS based on Paid-Only Toggle
    const effectiveRevenue = paidOnly ? totalCollectedCash : totalSalesRevenue;

    // When Paid-Only is toggled ON: COGS is proportionately adjusted to the cash collection ratio
    const collectionRatio = totalSalesRevenue > 0 ? Math.min(1, totalCollectedCash / totalSalesRevenue) : 1;
    const effectiveCogs = paidOnly ? periodCogs * collectionRatio : periodCogs;

    // Inventory Gross Profit (أرباح مخزون)
    const inventoryProfits = Math.max(0, effectiveRevenue - effectiveCogs);
    const grossMarginPercent = effectiveRevenue > 0 ? (inventoryProfits / effectiveRevenue) * 100 : 0;

    // Net Period Profit (صافي ربح الفترة)
    // Formula: Effective Revenue - (Effective COGS + Total Salaries + Wastage + Discounts)
    const netPeriodProfit =
      effectiveRevenue - (effectiveCogs + totalOperatingExpenses + totalWastageLoss + totalDiscounts);
    const netMarginPercent = effectiveRevenue > 0 ? (netPeriodProfit / effectiveRevenue) * 100 : 0;

    // Cash Flow in Period (Inflows - Outflows in this period)
    const periodCashOutflows = totalPeriodSupplierCashPaid + totalOperatingExpenses;
    const periodNetCashFlow = totalCollectedCash - periodCashOutflows;

    return {
      periodInvoices,
      totalSalesRevenue,
      totalCollectedCash,
      totalPendingCredit,
      periodCogs: effectiveCogs,
      inventoryProfits,
      serviceProfits,
      grossMarginPercent,
      totalSalaries,
      totalApprovedAdvances,
      totalOperatingExpenses,
      totalDiscounts,
      totalWastageLoss,
      totalSupplierPurchases,
      periodSupplierCashPaid: totalPeriodSupplierCashPaid,
      periodSupplierRemainingDue,
      periodCreditPurchasesCount,
      periodSupplierPaymentRatio,
      allTimeSupplierPayables,
      pendingCreditPurchases,
      netFreeTreasuryCash,
      totalInvoicesCount,
      cashInvoicesCount,
      creditInvoicesCount,
      netPeriodProfit,
      netMarginPercent,
      periodNetCashFlow,
      productStatsMap,
    };
  }, [startDate, endDate, paidOnly, data, prodMap, batchMap]);

  // Product profitability breakdown for filtered period
  const filteredProductBreakdown = useMemo(() => {
    return Array.from(financialMetrics.productStatsMap.entries())
      .map(([productId, stats]) => {
        const prod = prodMap.get(productId);
        const profit = stats.revenue - stats.cost;
        const margin = stats.revenue > 0 ? (profit / stats.revenue) * 100 : 0;
        return {
          productId,
          productName: prod?.name || 'صنف غير معروف',
          category: prod?.category || 'عام',
          unitsSold: stats.unitsSold,
          revenue: stats.revenue,
          cost: stats.cost,
          profit,
          marginPercent: margin,
        };
      })
      .filter((item) => {
        const matchSearch = item.productName.toLowerCase().includes(searchProduct.toLowerCase());
        const matchCat = selectedCategory === 'ALL' || item.category === selectedCategory;
        return matchSearch && matchCat;
      })
      .sort((a, b) => b.profit - a.profit);
  }, [financialMetrics.productStatsMap, prodMap, searchProduct, selectedCategory]);

  const allCategories = useMemo(() => {
    return Array.from(new Set(Array.from(prodMap.values()).map((p) => p.category))).filter(Boolean);
  }, [prodMap]);

  // Daily Performance Chart Data
  const chartDays = useMemo(() => {
    const daysCount = 7;
    const days: {
      dayName: string;
      dateStr: string;
      displayDate: string;
      revenue: number;
      collected: number;
      costs: number;
      netProfit: number;
      isToday: boolean;
    }[] = [];

    const arabicDays = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateIso = d.toISOString().split('T')[0];
      const dayName = arabicDays[d.getDay()];
      const displayDate = `${d.getDate()}/${d.getMonth() + 1}`;
      const isToday = i === 0;

      // Filter data for this single day
      const dayInvoices = (data.rawInvoices || []).filter((inv) => inv.createdAt.startsWith(dateIso));
      const dayCollections = (data.rawCollections || []).filter((col) => col.createdAt.startsWith(dateIso));
      const dayPayroll = (data.rawPayroll || []).filter((p) => (p.paymentDate || p.createdAt).startsWith(dateIso));

      const daySales = dayInvoices.reduce((sum, inv) => sum + (Number(inv.totalAmount) || 0), 0);
      const dayCashFromInvoices = dayInvoices.reduce((sum, inv) => sum + (Number(inv.paidAmount) || 0), 0);
      const dayCashFromCol = dayCollections.reduce((sum, col) => sum + (Number(col.amount) || 0), 0);
      const dayCollected = dayCashFromInvoices + dayCashFromCol;

      // COGS for this day
      let dayCogs = 0;
      dayInvoices.forEach((inv) => {
        (inv.items || []).forEach((item) => {
          const prod = prodMap.get(item.productId);
          const batch = item.batchId ? batchMap.get(item.batchId) : undefined;
          const cost = batch?.unitCost !== undefined && batch.unitCost > 0 ? batch.unitCost : (prod?.cost || 0);
          dayCogs += (Number(item.quantity) || 0) * cost;
        });
      });

      const dayExpenses = dayPayroll.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const dayTotalCost = dayCogs + dayExpenses;

      const activeRevenue = paidOnly ? dayCollected : daySales;
      const dayProfit = activeRevenue - dayTotalCost;

      days.push({
        dayName,
        dateStr: dateIso,
        displayDate,
        revenue: daySales,
        collected: dayCollected,
        costs: dayTotalCost,
        netProfit: dayProfit,
        isToday,
      });
    }

    return days;
  }, [data, prodMap, batchMap, paidOnly]);

  const maxChartValue = useMemo(() => {
    let max = 1000;
    chartDays.forEach((d) => {
      const val = paidOnly ? d.collected : d.revenue;
      if (val > max) max = val;
      if (d.costs > max) max = d.costs;
    });
    return max * 1.15; // 15% headroom
  }, [chartDays, paidOnly]);

  const isNetPositive = financialMetrics.netPeriodProfit >= 0;
  const isTreasuryPositive = data.treasury.currentBalance >= 0;

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------- */}
      {/* TOP HEADER & QUICK REFRESH                                    */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-blue-600 text-xs font-black uppercase tracking-wider mb-1">
            <Sparkles className="w-4 h-4" />
            <span>لوحة الرقابة والمؤشرات المالية الفورية (Real-Time P&L)</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            الأرباح والخسائر والسيولة النقدية
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            تحديث فوري ومباشر يربط مبيعات المناديب، توريدات الموردين، مرتبات الموظفين، والتوالف بدقة محاسبية
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() =>
              exportWorkbookToExcel('تقرير_الأرباح_والخسائر_والخزينة', [
                {
                  sheetName: 'ملخص الأرباح والخزينة',
                  headers: ['البند المالي', 'القيمة (ج.م)'],
                  rows: [
                    ['إجمالي إيرادات المبيعات', financialMetrics.totalSalesRevenue],
                    ['النقدية المحصلة فعلياً', financialMetrics.totalCollectedCash],
                    ['المبيعات الآجلة المتبقية بالسوق', financialMetrics.totalPendingCredit],
                    ['تكلفة البضاعة المباعة (COGS)', financialMetrics.periodCogs],
                    ['مجمل ربح المخزون', financialMetrics.inventoryProfits],
                    ['إجمالي المرتبات والمصروفات', financialMetrics.totalOperatingExpenses],
                    ['إجمالي الخصومات الممنوحة', financialMetrics.totalDiscounts],
                    ['خسائر التوالف والمرتجعات', financialMetrics.totalWastageLoss],
                    ['صافي ربح الفترة النهائي', financialMetrics.netPeriodProfit],
                    ['رصيد الخزينة الفعلي الحالي', data.treasury.currentBalance],
                    ['إجمالي مستحقات الموردين الآجلة', financialMetrics.allTimeSupplierPayables],
                    ['صافي السيولة الحرة بعد الموردين', financialMetrics.netFreeTreasuryCash],
                  ],
                },
                {
                  sheetName: 'ربحية الأصناف المباعة',
                  headers: [
                    'اسم الصنف',
                    'التصنيف',
                    'الكمية المباعة (كرتونة)',
                    'إجمالي الإيراد (ج.م)',
                    'إجمالي التكلفة (ج.م)',
                    'صافي الربح (ج.م)',
                    'هامش الربح (%)',
                  ],
                  rows: filteredProductBreakdown.map((item) => [
                    item.productName,
                    item.category,
                    item.unitsSold,
                    item.revenue,
                    item.cost,
                    item.profit,
                    Number(item.marginPercent.toFixed(1)),
                  ]),
                },
              ])
            }
            className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl text-xs font-black shadow-xs transition flex items-center gap-2 active:scale-95 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>تصدير شيت Excel للأرباح والخزينة</span>
          </button>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-2xl text-xs font-bold border border-slate-200/80 shadow-xs transition flex items-center gap-2 active:scale-95"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
            <span>تحديث البيانات</span>
          </button>
          <Link
            href="/admin/employees"
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-bold shadow-sm transition flex items-center gap-2 active:scale-95"
          >
            <Users className="w-3.5 h-3.5 text-blue-400" />
            <span>المرتبات والمصروفات</span>
          </Link>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* REQUIREMENT 1: TOP SUMMARY HERO CARD (بطاقة صافي ربح الفترة)  */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Main Hero: Net Period Profit */}
        <div
          className={`lg:col-span-8 p-6 sm:p-8 rounded-3xl border shadow-md relative overflow-hidden transition-all duration-300 ${
            isNetPositive
              ? 'bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 text-white border-emerald-500/30'
              : 'bg-gradient-to-br from-slate-900 via-slate-800 to-rose-950 text-white border-rose-500/30'
          }`}
        >
          {/* Background Ambient Glow */}
          <div
            className={`absolute top-0 right-0 w-80 h-80 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20 ${
              isNetPositive ? 'bg-emerald-500/15' : 'bg-rose-500/15'
            }`}
          />

          <div className="relative z-10 flex flex-col justify-between h-full space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-inner ${
                    isNetPositive ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  }`}
                >
                  {isNetPositive ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-400">صافي ربح الفترة المحددة</div>
                  <div className="text-xs text-slate-300 font-semibold mt-0.5">{periodLabel}</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black shadow-xs ${
                    isNetPositive
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-rose-500 text-white'
                  }`}
                >
                  <Percent className="w-3.5 h-3.5" />
                  <span>هامش صافي {financialMetrics.netMarginPercent.toFixed(1)}%</span>
                </span>
                {paidOnly && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    <HandCoins className="w-3 h-3" />
                    <span>محسوب على المدفوع فقط</span>
                  </span>
                )}
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-400 font-semibold mb-1">
                {isNetPositive ? 'أرباح صافية فعلية جاهزة للتوزيع' : 'عجز مالي تشغيلي في هذه الفترة'}
              </div>
              <div className="flex items-baseline gap-2">
                <span
                  className={`text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight ${
                    isNetPositive ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {financialMetrics.netPeriodProfit.toLocaleString('ar-EG')}
                </span>
                <span className="text-lg font-bold text-slate-400">جنيه مصري</span>
              </div>
            </div>

            {/* Quick Micro-stats Footer inside Hero */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-4 border-t border-slate-700/60 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">
                  {paidOnly ? 'المحصل الفعلي:' : 'إجمالي المبيعات:'}
                </span>
                <span className="font-bold text-white text-sm">
                  {(paidOnly ? financialMetrics.totalCollectedCash : financialMetrics.totalSalesRevenue).toLocaleString('ar-EG')} ج.م
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">تكلفة البضاعة (COGS):</span>
                <span className="font-bold text-amber-400 text-sm">
                  {financialMetrics.periodCogs.toLocaleString('ar-EG')} ج.م
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">المصاريف والمرتبات:</span>
                <span className="font-bold text-rose-400 text-sm">
                  {financialMetrics.totalOperatingExpenses.toLocaleString('ar-EG')} ج.م
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Secondary Metric: Treasury & Cash Inflows/Outflows Linked to Supplier Debts */}
        <div className="lg:col-span-4 bg-white p-5 sm:p-7 rounded-3xl border border-slate-200/90 shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-500">السيولة النقدية والموردين</div>
                  <h3 className="font-black text-slate-900 text-base">رصيد الخزنة والسيولة الحرة</h3>
                </div>
              </div>
              <span
                className={`text-[11px] font-black px-2.5 py-0.5 rounded-full shrink-0 ${
                  financialMetrics.netFreeTreasuryCash >= 0
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-100 text-rose-800 border border-rose-200'
                }`}
              >
                {financialMetrics.netFreeTreasuryCash >= 0 ? 'فائض سيولة حرة' : 'عجز تغطية موردين'}
              </span>
            </div>

            <div className="mt-2 space-y-3">
              <div>
                <div className="text-xs text-slate-500 font-semibold mb-0.5">رصيد الخزنة الفعلي المتوفر:</div>
                <div className="text-3xl sm:text-4xl font-black text-teal-900 break-words">
                  {data.treasury.currentBalance.toLocaleString('ar-EG')}{' '}
                  <span className="text-sm font-bold text-slate-500">ج.م</span>
                </div>
              </div>

              {/* Net Free Liquidity Callout Box linking Supplier Credit Invoices */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600 font-bold flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-slate-400" />
                    المتبقي لسداد فواتير الموردين:
                  </span>
                  <span className="font-black text-rose-600">
                    {financialMetrics.allTimeSupplierPayables.toLocaleString('ar-EG')} ج.م
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-200">
                  <span className="text-slate-900 font-black flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                    صافي السيولة النقدية الحرة:
                  </span>
                  <span
                    className={`font-black ${
                      financialMetrics.netFreeTreasuryCash >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {financialMetrics.netFreeTreasuryCash.toLocaleString('ar-EG')} ج.م
                  </span>
                </div>

                <p className="text-[10px] text-slate-500 leading-relaxed">
                  {financialMetrics.netFreeTreasuryCash >= 0
                    ? 'السيولة المتبقية بالخزنة بعد خصم كامل ديون وفواتير الموردين الآجلة'
                    : 'الخزنة بحاجة لتحصيل مبيعات لتغطية مستحقات الموردين الآجلة'}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                إجمالي المقبوضات التراكمية:
              </span>
              <span className="font-bold text-slate-900">
                {data.treasury.totalInflows.toLocaleString('ar-EG')} ج.م
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                إجمالي المدفوعات التراكمية:
              </span>
              <span className="font-bold text-slate-900">
                {data.treasury.totalOutflows.toLocaleString('ar-EG')} ج.م
              </span>
            </div>
            <div className="flex items-center justify-between pt-1.5 border-t border-dashed border-slate-100">
              <span className="font-bold text-slate-700">صافي التدفق النقدي للفترة:</span>
              <span
                className={`font-black ${
                  financialMetrics.periodNetCashFlow >= 0 ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {financialMetrics.periodNetCashFlow.toLocaleString('ar-EG')} ج.م
              </span>
            </div>

            {financialMetrics.pendingCreditPurchases.length > 0 && (
              <a
                href="#supplier-payables-section"
                className="block text-center py-1.5 px-2 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded-xl font-bold text-[11px] transition mt-2"
              >
                عرض {financialMetrics.pendingCreditPurchases.length} فاتورة موردين معلقة للسداد ↓
              </a>
            )}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* REQUIREMENT 2: TIME FILTER BAR (أشرطة الفلترة الزمنية)         */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Period Buttons */}
        <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-2xl self-start md:self-auto overflow-x-auto max-w-full scrollbar-none touch-pan-x">
          <button
            onClick={() => setPeriod('today')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap active:scale-95 ${
              period === 'today'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>اليوم</span>
          </button>

          <button
            onClick={() => setPeriod('week')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap active:scale-95 ${
              period === 'week'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>الأسبوع</span>
          </button>

          <button
            onClick={() => setPeriod('month')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap active:scale-95 ${
              period === 'month'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            <span>الشهر</span>
          </button>

          <button
            onClick={() => setPeriod('custom')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap active:scale-95 ${
              period === 'custom'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>مخصص</span>
          </button>
        </div>

        {/* Custom Range Inputs (Shown when period is 'custom') */}
        {period === 'custom' && (
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
              <span className="text-xs font-bold text-slate-500">من:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
              <span className="text-xs font-bold text-slate-500">إلى:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* Active Range Notice */}
        <div className="text-xs text-slate-500 font-semibold flex items-center gap-1.5">
          <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
          <span>{periodLabel}</span>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* REQUIREMENT 3: INTERACTIVE FINANCIAL CHART & PAID-ONLY TOGGLE */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200/90 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-lg text-slate-900">الرسم البياني للأداء المالي اليومي</h3>
              <p className="text-xs text-slate-500">
                مقارنة الإيرادات المحققة مع التكاليف والمصروفات وصافي الربح اليومي على مدار الأسبوع
              </p>
            </div>
          </div>

          {/* Paid-Only Toggle Switch */}
          <div className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-2xl border border-slate-200/80 self-start md:self-auto">
            <div className="text-right">
              <div className="text-xs font-black text-slate-900">حساب المدفوع فقط</div>
              <div className="text-[10px] text-slate-400">احتساب النقدية المحصلة بدلاً من إجمالي الفواتير</div>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={paidOnly}
              onClick={() => setPaidOnly(!paidOnly)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                paidOnly ? 'bg-emerald-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  paidOnly ? '-translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-xs font-semibold">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-md bg-blue-600"></span>
            <span className="text-slate-700">
              {paidOnly ? 'النقدية المحصلة فعلياً (ج.م)' : 'إجمالي المبيعات المصدرة (ج.م)'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-md bg-amber-500"></span>
            <span className="text-slate-700">التكاليف والمصروفات (COGS + مرتبات)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
            <span className="text-slate-700">صافي ربح اليوم</span>
          </div>
        </div>

        {/* The Bar Chart Canvas */}
        <div className="relative pt-8 pb-4 overflow-x-auto touch-pan-x [-webkit-overflow-scrolling:touch]">
          <div className="grid grid-cols-7 gap-2 sm:gap-4 items-end h-64 sm:h-72 border-b border-slate-200 px-2 sm:px-4 min-w-[520px]">
            {chartDays.map((d, idx) => {
              const activeVal = paidOnly ? d.collected : d.revenue;
              const revenueHeight = Math.max(6, Math.min(100, (activeVal / maxChartValue) * 100));
              const costHeight = Math.max(6, Math.min(100, (d.costs / maxChartValue) * 100));
              const isHovered = hoveredDayIndex === idx;

              return (
                <div
                  key={d.dateStr}
                  className="flex flex-col items-center h-full justify-end group cursor-pointer relative"
                  onMouseEnter={() => setHoveredDayIndex(idx)}
                  onMouseLeave={() => setHoveredDayIndex(null)}
                >
                  {/* Floating Tooltip */}
                  {isHovered && (
                    <div className="absolute -top-24 sm:-top-28 left-1/2 -translate-x-1/2 bg-slate-900/95 backdrop-blur-md text-white p-3 rounded-2xl shadow-2xl border border-slate-700/80 z-30 pointer-events-none whitespace-nowrap min-w-44 text-right animate-fadeIn">
                      <div className="flex items-center justify-between border-b border-slate-700 pb-1 mb-1.5 text-[11px] font-bold text-slate-300">
                        <span>{d.dayName}</span>
                        <span>{d.dateStr}</span>
                      </div>
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center justify-between text-blue-300">
                          <span>{paidOnly ? 'المحصل:' : 'المبيعات:'}</span>
                          <span className="font-bold">{activeVal.toLocaleString('ar-EG')} ج.م</span>
                        </div>
                        <div className="flex items-center justify-between text-amber-300">
                          <span>التكاليف:</span>
                          <span className="font-bold">{d.costs.toLocaleString('ar-EG')} ج.م</span>
                        </div>
                        <div className="flex items-center justify-between pt-1 border-t border-slate-700 font-black">
                          <span>الصافي:</span>
                          <span className={d.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                            {d.netProfit.toLocaleString('ar-EG')} ج.م
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Dual Bars Container */}
                  <div className="w-full flex items-end justify-center gap-1 sm:gap-2 h-full pb-1">
                    {/* Revenue Bar */}
                    <div
                      style={{ height: `${revenueHeight}%` }}
                      className={`w-3.5 sm:w-6 rounded-t-xl transition-all duration-300 ${
                        isHovered
                          ? 'bg-blue-500 shadow-md ring-2 ring-blue-400'
                          : d.isToday
                          ? 'bg-blue-600 shadow-xs'
                          : 'bg-blue-600/85 hover:bg-blue-600'
                      }`}
                    />

                    {/* Cost Bar */}
                    <div
                      style={{ height: `${costHeight}%` }}
                      className={`w-3.5 sm:w-6 rounded-t-xl transition-all duration-300 ${
                        isHovered
                          ? 'bg-amber-400 shadow-md ring-2 ring-amber-300'
                          : 'bg-amber-500/80 hover:bg-amber-500'
                      }`}
                    />
                  </div>

                  {/* Day Label Under Bar */}
                  <div className="text-center pt-2">
                    <span
                      className={`block text-[11px] sm:text-xs font-black truncate ${
                        d.isToday ? 'text-blue-700' : 'text-slate-700'
                      }`}
                    >
                      {d.dayName}
                    </span>
                    <span className="block text-[10px] text-slate-400">{d.displayDate}</span>
                    {d.isToday && (
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-600 mt-0.5"></span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* REQUIREMENT 4: COMPREHENSIVE FINANCIAL CARDS GRID (9 CARDS)   */}
      {/* ------------------------------------------------------------- */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-blue-600" />
            <h3 className="font-black text-lg text-slate-900">المؤشرات المالية للفترة المحددة</h3>
          </div>
          <span className="text-xs text-slate-400 font-semibold">9 مؤشرات مالية مترابطة في الوقت الفعلي</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* 1. أرباح مخزون (Inventory Profits) */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-xs flex flex-col justify-between hover:border-indigo-300 hover:shadow-md transition">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-500">أرباح مخزون (Gross Inventory Profit)</span>
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Package className="w-5 h-5" />
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-indigo-950">
                {financialMetrics.inventoryProfits.toLocaleString('ar-EG')}{' '}
                <span className="text-xs font-bold text-slate-500">ج.م</span>
              </div>
              <div className="flex items-center gap-1.5 mt-2 text-xs font-bold text-emerald-700">
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>هامش مجمل ربح البضاعة: {financialMetrics.grossMarginPercent.toFixed(1)}%</span>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-400">
              {paidOnly ? 'المحصل - تكلفة البضاعة المقابلة' : 'المبيعات - تكلفة البضاعة المباعة (COGS)'}
            </div>
          </div>

          {/* 2. أرباح خدمات (Service Profits) */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-xs flex flex-col justify-between hover:border-slate-300 hover:shadow-md transition">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-500">أرباح خدمات (Service Profits)</span>
              <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-slate-800">
                {financialMetrics.serviceProfits.toLocaleString('ar-EG')}{' '}
                <span className="text-xs font-bold text-slate-500">ج.م</span>
              </div>
              <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600">
                لا توجد خدمات حالياً
              </span>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-400">
              خدمات الشحن أو النقل أو الرسوم الإضافية
            </div>
          </div>

          {/* 3. المصاريف (Operating Expenses / Employee Salaries) */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-xs flex flex-col justify-between hover:border-purple-300 hover:shadow-md transition">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-500">المصاريف (مرتبات وسلف)</span>
              <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <CreditCard className="w-5 h-5" />
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-rose-700">
                {financialMetrics.totalOperatingExpenses.toLocaleString('ar-EG')}{' '}
                <span className="text-xs font-bold text-slate-500">ج.م</span>
              </div>
              <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                <span>مرتبات: {financialMetrics.totalSalaries.toLocaleString('ar-EG')} ج.م</span>
                <span>•</span>
                <span>سلف: {financialMetrics.totalApprovedAdvances.toLocaleString('ar-EG')} ج.م</span>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-400">
              رواتب العاملين وسلف المناديب المعتمدة في الفترة
            </div>
          </div>

          {/* 4. المديونيات (Pending Credit / Client Dues) */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-xs flex flex-col justify-between hover:border-amber-300 hover:shadow-md transition">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-500">المديونيات (الآجل غير المحصل)</span>
              <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-amber-800">
                {financialMetrics.totalPendingCredit.toLocaleString('ar-EG')}{' '}
                <span className="text-xs font-bold text-slate-500">ج.م</span>
              </div>
              <div className="mt-2 text-xs font-semibold text-amber-700">
                فواتير آجلة قيد التحصيل طرف العملاء
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-400">
              المتبقي من فواتير البيع الآجل الصادرة خلال الفترة
            </div>
          </div>

          {/* 5. المحصل (Total Cash Collected) */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-xs flex flex-col justify-between hover:border-emerald-300 hover:shadow-md transition">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-500">المحصل (النقدية المستلمة)</span>
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <HandCoins className="w-5 h-5" />
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-emerald-800">
                {financialMetrics.totalCollectedCash.toLocaleString('ar-EG')}{' '}
                <span className="text-xs font-bold text-slate-500">ج.م</span>
              </div>
              <div className="mt-2 text-xs text-slate-500">
                كاش فوري + مقدمات فواتير + تحصيلات ديون
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-400">
              إجمالي السيولة النقدية التي دخلت خزينة الشركة في الفترة
            </div>
          </div>

          {/* 6. المبيعات (Total Sales Revenue) */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-xs flex flex-col justify-between hover:border-blue-300 hover:shadow-md transition">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-500">المبيعات (إجمالي الفواتير)</span>
              <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-blue-950">
                {financialMetrics.totalSalesRevenue.toLocaleString('ar-EG')}{' '}
                <span className="text-xs font-bold text-slate-500">ج.م</span>
              </div>
              <div className="mt-2 text-xs text-slate-500">
                إجمالي قيمة البضاعة المباعة للعملاء
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-400">
              قيمة كافة فواتير المبيعات الصادرة في الفترة
            </div>
          </div>

          {/* 7. المرتجعات (Returns & Wastage Cost) */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-xs flex flex-col justify-between hover:border-rose-300 hover:shadow-md transition">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-500">المرتجعات والتوالف</span>
              <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <RotateCcw className="w-5 h-5" />
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-rose-700">
                {financialMetrics.totalWastageLoss.toLocaleString('ar-EG')}{' '}
                <span className="text-xs font-bold text-slate-500">ج.م</span>
              </div>
              <div className="mt-2 text-xs font-semibold text-rose-600">
                خسائر منتجات منتهية الصلاحية أو تالفة
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-400">
              محسوبة بسعر تكلفة التوريد من الموردين
            </div>
          </div>

          {/* 8. المشتريات والتزامات الموردين (Supplier Purchases & Credit Payables) */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-xs flex flex-col justify-between hover:border-teal-300 hover:shadow-md transition">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-500">المشتريات والتزامات الموردين</span>
              <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
                <Truck className="w-5 h-5" />
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-teal-950 break-words">
                {financialMetrics.totalSupplierPurchases.toLocaleString('ar-EG')}{' '}
                <span className="text-xs font-bold text-slate-500">ج.م</span>
              </div>
              <div className="mt-2 text-xs space-y-1">
                <div className="flex items-center justify-between text-slate-600">
                  <span>المسدد نقداً للموردين:</span>
                  <span className="font-bold text-emerald-700">
                    {financialMetrics.periodSupplierCashPaid.toLocaleString('ar-EG')} ج.م
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>المتبقي الآجل للفترة:</span>
                  <span className="font-bold text-rose-600">
                    {financialMetrics.periodSupplierRemainingDue.toLocaleString('ar-EG')} ج.م
                  </span>
                </div>
              </div>

              {/* Payment Ratio Progress Bar */}
              <div className="mt-2.5">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 mb-1">
                  <span>نسبة السداد: {financialMetrics.periodSupplierPaymentRatio.toFixed(0)}%</span>
                  <span>{financialMetrics.periodCreditPurchasesCount} فواتير آجلة</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      financialMetrics.periodSupplierRemainingDue === 0 ? 'bg-emerald-500' : 'bg-teal-600'
                    }`}
                    style={{
                      width: `${Math.min(100, Math.max(0, financialMetrics.periodSupplierPaymentRatio))}%`,
                    }}
                  />
                </div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
              <span>المتبقي التراكمي للموردين:</span>
              <span className="font-black text-rose-600">
                {financialMetrics.allTimeSupplierPayables.toLocaleString('ar-EG')} ج.م
              </span>
            </div>
          </div>

          {/* 9. عدد الفواتير (Total Invoice Count) */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-xs flex flex-col justify-between hover:border-cyan-300 hover:shadow-md transition">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-500">عدد الفواتير الصادرة</span>
              <div className="w-10 h-10 rounded-2xl bg-cyan-50 text-cyan-600 flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900">
                {financialMetrics.totalInvoicesCount}{' '}
                <span className="text-xs font-bold text-slate-500">فاتورة</span>
              </div>
              <div className="flex items-center gap-2 mt-2 text-xs text-slate-600 font-semibold">
                <span>{financialMetrics.cashInvoicesCount} نقدية</span>
                <span>•</span>
                <span>{financialMetrics.creditInvoicesCount} آجلة</span>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-400">
              إجمالي فواتير البيع المنفذة للعملاء خلال الفترة
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* STEP-BY-STEP P&L STATEMENT (قائمة الدخل التفصيلية)             */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-7 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-lg text-slate-900">
                قائمة الدخل والأرباح التفصيلية للفترة (P&L Breakdown)
              </h3>
              <p className="text-xs text-slate-500">
                تسلسل احتساب صافي الربح خطوة بخطوة وفقاً لمعايير المحاسبة المعتمدة
              </p>
            </div>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            دقة حسابية 100%
          </span>
        </div>

        <div className="space-y-3 font-mono text-sm">
          {/* Revenue */}
          <div className="p-3.5 rounded-2xl bg-blue-50/50 border border-blue-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                +
              </span>
              <span className="font-bold text-slate-800">
                {paidOnly
                  ? 'النقدية المحصلة فعلياً للفترة (Collected Cash)'
                  : 'إجمالي إيرادات المبيعات المصدرة (Total Revenue)'}
              </span>
            </div>
            <span className="font-black text-blue-900 text-base">
              {(paidOnly ? financialMetrics.totalCollectedCash : financialMetrics.totalSalesRevenue).toLocaleString('ar-EG')} ج.م
            </span>
          </div>

          {/* COGS */}
          <div className="p-3.5 rounded-2xl bg-amber-50/50 border border-amber-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-lg bg-amber-600 text-white flex items-center justify-center font-bold text-xs">
                -
              </span>
              <span className="font-bold text-slate-800">
                تكلفة البضاعة المباعة (Cost of Goods Sold - COGS)
              </span>
            </div>
            <span className="font-black text-amber-900 text-base">
              ({financialMetrics.periodCogs.toLocaleString('ar-EG')} ج.م)
            </span>
          </div>

          {/* Gross Profit Subtotal */}
          <div className="p-3.5 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-lg bg-slate-700 text-white flex items-center justify-center font-bold text-xs">
                =
              </span>
              <span className="font-black text-slate-900">
                مجمل الربح التجاري للمخزون (Gross Profit) — هامش {financialMetrics.grossMarginPercent.toFixed(1)}%
              </span>
            </div>
            <span className="font-black text-slate-900 text-base">
              {financialMetrics.inventoryProfits.toLocaleString('ar-EG')} ج.م
            </span>
          </div>

          {/* Salaries */}
          <div className="p-3.5 rounded-2xl bg-rose-50/40 border border-rose-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-lg bg-rose-500 text-white flex items-center justify-center font-bold text-xs">
                -
              </span>
              <span className="font-bold text-slate-800">مرتبات وأجور العاملين المصروفة</span>
            </div>
            <span className="font-black text-rose-700 text-base">
              ({financialMetrics.totalSalaries.toLocaleString('ar-EG')} ج.م)
            </span>
          </div>

          {/* Approved Advances */}
          {financialMetrics.totalApprovedAdvances > 0 && (
            <div className="p-3.5 rounded-2xl bg-rose-50/40 border border-rose-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-lg bg-rose-500 text-white flex items-center justify-center font-bold text-xs">
                  -
                </span>
                <span className="font-bold text-slate-800">سلف المناديب المالية المعتمدة</span>
              </div>
              <span className="font-black text-rose-700 text-base">
                ({financialMetrics.totalApprovedAdvances.toLocaleString('ar-EG')} ج.م)
              </span>
            </div>
          )}

          {/* Discounts */}
          <div className="p-3.5 rounded-2xl bg-rose-50/40 border border-rose-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-lg bg-rose-500 text-white flex items-center justify-center font-bold text-xs">
                -
              </span>
              <span className="font-bold text-slate-800">إجمالي الخصومات الممنوحة للعملاء</span>
            </div>
            <span className="font-black text-rose-700 text-base">
              ({financialMetrics.totalDiscounts.toLocaleString('ar-EG')} ج.م)
            </span>
          </div>

          {/* Wastage */}
          <div className="p-3.5 rounded-2xl bg-rose-50/40 border border-rose-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-lg bg-rose-500 text-white flex items-center justify-center font-bold text-xs">
                -
              </span>
              <span className="font-bold text-slate-800">خسائر توالف البضاعة والمرتجعات</span>
            </div>
            <span className="font-black text-rose-700 text-base">
              ({financialMetrics.totalWastageLoss.toLocaleString('ar-EG')} ج.م)
            </span>
          </div>

          {/* Final Net Period Profit */}
          <div
            className={`p-4 rounded-2xl border-2 flex items-center justify-between mt-3 transition ${
              isNetPositive
                ? 'bg-emerald-50 border-emerald-500 text-emerald-950'
                : 'bg-rose-50 border-rose-500 text-rose-950'
            }`}
          >
            <div className="flex items-center gap-3">
              <span
                className={`w-9 h-9 rounded-xl text-white flex items-center justify-center font-black text-sm ${
                  isNetPositive ? 'bg-emerald-600' : 'bg-rose-600'
                }`}
              >
                =
              </span>
              <div>
                <div className="font-black text-lg">صافي ربح الفترة الحقيقي (Net Period Profit)</div>
                <div className="text-xs text-slate-500 font-sans">
                  الأرباح الحقيقية الصافية القابلة للتوزيع بعد تغطية كافة التكاليف والمصروفات
                </div>
              </div>
            </div>
            <div className="text-right">
              <div
                className={`text-2xl sm:text-3xl font-black ${
                  isNetPositive ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {financialMetrics.netPeriodProfit.toLocaleString('ar-EG')} ج.م
              </div>
              <div className="text-xs font-bold text-slate-500">
                نسبة الهامش الصافي: {financialMetrics.netMarginPercent.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* SUPPLIER CREDIT INVOICES & OUTSTANDING DEBT TRACKER           */}
      {/* (جدول فواتير الموردين الآجلة والمتبقي للسداد)                 */}
      {/* ------------------------------------------------------------- */}
      <div id="supplier-payables-section" className="bg-white border border-slate-200/90 rounded-3xl shadow-sm overflow-hidden scroll-mt-6">
        <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-lg text-slate-900">
                  فواتير الموردين الآجلة والمتبقي للسداد
                </h3>
                {financialMetrics.pendingCreditPurchases.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-200">
                    {financialMetrics.pendingCreditPurchases.length} فاتورة معلقة
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                متابعة دقيقة لكافة فواتير التوريد الآجلة وحساب المتبقي لكل فاتورة لتخطيط السيولة النقدية وسداد المستحقات
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Link
              href="/admin/suppliers"
              className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 active:scale-95 shadow-xs"
            >
              <span>سداد دفعات الموردين</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Micro-summary Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse border-b border-slate-100 bg-slate-50/50 text-xs">
          <div className="p-4 flex items-center justify-between">
            <span className="text-slate-500 font-bold">إجمالي المتبقي الفعلي للموردين:</span>
            <span className="font-black text-rose-600 text-sm">
              {financialMetrics.allTimeSupplierPayables.toLocaleString('ar-EG')} ج.م
            </span>
          </div>
          <div className="p-4 flex items-center justify-between">
            <span className="text-slate-500 font-bold">الفواتير الآجلة غير المسددة:</span>
            <span className="font-black text-slate-800 text-sm">
              {financialMetrics.pendingCreditPurchases.length} فواتير
            </span>
          </div>
          <div className="p-4 flex items-center justify-between">
            <span className="text-slate-500 font-bold">صافي السيولة النقدية الحرة:</span>
            <span
              className={`font-black text-sm ${
                financialMetrics.netFreeTreasuryCash >= 0 ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {financialMetrics.netFreeTreasuryCash.toLocaleString('ar-EG')} ج.م
            </span>
          </div>
        </div>

        {/* Invoices List / Table */}
        {financialMetrics.pendingCreditPurchases.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="w-14 h-14 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h4 className="text-slate-800 font-black text-base">لا توجد فواتير موردين آجلة معلقة للسداد</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              جميع التزامات الشراء والتوريد تم تسويتها بالكامل. الخزنة في أمان ولا توجد مديونيات خارجية للموردين حالياً.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop / Tablet Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold">
                    <th className="py-3 px-4">رقم الفاتورة</th>
                    <th className="py-3 px-4">اسم المورد</th>
                    <th className="py-3 px-4">تاريخ التوريد</th>
                    <th className="py-3 px-4">إجمالي الفاتورة</th>
                    <th className="py-3 px-4">المدفوع نقداً</th>
                    <th className="py-3 px-4 text-rose-700">المتبقي للسداد</th>
                    <th className="py-3 px-4 text-center">نسبة السداد</th>
                    <th className="py-3 px-4 text-center">حالة السداد</th>
                    <th className="py-3 px-4 text-center">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {financialMetrics.pendingCreditPurchases.map((purchase) => {
                    const sup = supplierMap.get(purchase.supplierId);
                    const total = Number(purchase.totalAmount) || 0;
                    const paid = Number(purchase.paidAmount) || 0;
                    const remaining = Math.max(0, total - paid);
                    const ratio = total > 0 ? (paid / total) * 100 : 100;
                    const isFullyUnpaid = paid === 0;

                    return (
                      <tr key={purchase.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                          {purchase.purchaseNumber || `#${purchase.id.slice(-6)}`}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-800">{sup?.name || 'مورد عام'}</div>
                          {sup?.phone && <div className="text-[11px] text-slate-400 font-mono">{sup.phone}</div>}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500">
                          {new Date(purchase.createdAt).toLocaleDateString('ar-EG', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          {total.toLocaleString('ar-EG')} ج.م
                        </td>
                        <td className="py-3.5 px-4 font-bold text-emerald-700">
                          {paid.toLocaleString('ar-EG')} ج.م
                        </td>
                        <td className="py-3.5 px-4 font-black text-rose-600 text-sm">
                          {remaining.toLocaleString('ar-EG')} ج.م
                        </td>
                        <td className="py-3.5 px-4 text-center min-w-32">
                          <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 mb-1">
                            <span>{ratio.toFixed(0)}%</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-teal-600 h-full rounded-full"
                              style={{ width: `${Math.min(100, Math.max(0, ratio))}%` }}
                            />
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-black ${
                              isFullyUnpaid
                                ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                : 'bg-amber-100 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {isFullyUnpaid ? 'آجل كلياً' : 'مسدد جزئياً'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <Link
                            href="/admin/suppliers"
                            className="inline-flex items-center gap-1 px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition shadow-2xs"
                          >
                            <span>سداد</span>
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Touch-Friendly Card View (sm:hidden) */}
            <div className="md:hidden divide-y divide-slate-100 p-3 sm:p-4 space-y-3">
              {financialMetrics.pendingCreditPurchases.map((purchase) => {
                const sup = supplierMap.get(purchase.supplierId);
                const total = Number(purchase.totalAmount) || 0;
                const paid = Number(purchase.paidAmount) || 0;
                const remaining = Math.max(0, total - paid);
                const ratio = total > 0 ? (paid / total) * 100 : 100;
                const isFullyUnpaid = paid === 0;

                return (
                  <div
                    key={purchase.id}
                    className="p-4 bg-slate-50/70 rounded-2xl border border-slate-200/80 space-y-3 hover:bg-white transition"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-mono font-black text-slate-900 text-sm">
                          {purchase.purchaseNumber || `#${purchase.id.slice(-6)}`}
                        </span>
                        <div className="text-[11px] text-slate-400">
                          {new Date(purchase.createdAt).toLocaleDateString('ar-EG', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </div>
                      </div>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-black ${
                          isFullyUnpaid
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {isFullyUnpaid ? 'آجل كلياً' : 'مسدد جزئياً'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60">
                      <span className="text-slate-500 font-bold">المورد:</span>
                      <span className="font-black text-slate-800">{sup?.name || 'مورد عام'}</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 bg-white p-2.5 rounded-xl border border-slate-200/60 text-center text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block">الإجمالي</span>
                        <span className="font-bold text-slate-900 text-[11px]">
                          {total.toLocaleString('ar-EG')} ج.م
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">المدفوع</span>
                        <span className="font-bold text-emerald-700 text-[11px]">
                          {paid.toLocaleString('ar-EG')} ج.م
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-rose-500 font-bold block">المتبقي</span>
                        <span className="font-black text-rose-600 text-xs">
                          {remaining.toLocaleString('ar-EG')} ج.م
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-bold text-slate-500">
                        <span>نسبة السداد للمورد</span>
                        <span>{ratio.toFixed(0)}%</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-teal-600 h-full rounded-full"
                          style={{ width: `${Math.min(100, Math.max(0, ratio))}%` }}
                        />
                      </div>
                    </div>

                    <div className="pt-1">
                      <Link
                        href="/admin/suppliers"
                        className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-95"
                      >
                        <span>سداد دفعة للمورد الآن</span>
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* PRODUCT PROFITABILITY BREAKDOWN (تحليل ربحية الأصناف للفترة)  */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white border border-slate-200/90 rounded-3xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-lg text-slate-900">تحليل ربحية الأصناف في الفترة المحددة</h3>
              <p className="text-xs text-slate-500">
                متابعة حركة مبيعات وهوامش ربح كل منتج خلال: {periodLabel}
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2">
            <div className="relative w-48 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchProduct}
                onChange={(e) => setSearchProduct(e.target.value)}
                placeholder="بحث عن صنف..."
                className="w-full pl-3 pr-9 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            {allCategories.length > 0 && (
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-700"
              >
                <option value="ALL">جميع التصنيفات</option>
                {allCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="overflow-x-auto touch-pan-x">
          {filteredProductBreakdown.length === 0 ? (
            <div className="text-center py-12 px-4">
              <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-600 font-bold">لا توجد مبيعات مسجلة للأصناف في هذه الفترة</p>
              <p className="text-xs text-slate-400 mt-1">
                جرّب تغيير الفلتر الزمني أو تسجيل فواتير بيع للأصناف لتظهر الأرباح هنا
              </p>
            </div>
          ) : (
            <table className="w-full text-right border-collapse min-w-[650px]">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200 text-xs font-bold text-slate-500">
                  <th className="py-3 px-4">الصنف</th>
                  <th className="py-3 px-4">التصنيف</th>
                  <th className="py-3 px-4 text-center">الكمية المباعة</th>
                  <th className="py-3 px-4">إجمالي الإيراد</th>
                  <th className="py-3 px-4">إجمالي التكلفة</th>
                  <th className="py-3 px-4">مجمل ربح الصنف</th>
                  <th className="py-3 px-4 text-center">هامش الربح</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredProductBreakdown.map((p) => {
                  const isPositive = p.profit >= 0;
                  return (
                    <tr key={p.productId} className="hover:bg-slate-50/50 transition">
                      <td className="py-3.5 px-4 font-bold text-slate-900">{p.productName}</td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                          {p.category}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-slate-700">
                        {p.unitsSold.toLocaleString('ar-EG')}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        {p.revenue.toLocaleString('ar-EG')} ج.م
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-500">
                        {p.cost.toLocaleString('ar-EG')} ج.م
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`font-black ${
                            isPositive ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {p.profit.toLocaleString('ar-EG')} ج.م
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                            isPositive
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                              : 'bg-rose-50 text-rose-700 border border-rose-100'
                          }`}
                        >
                          {isPositive ? (
                            <ArrowUpRight className="w-3 h-3" />
                          ) : (
                            <ArrowDownRight className="w-3 h-3" />
                          )}
                          {p.marginPercent.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
