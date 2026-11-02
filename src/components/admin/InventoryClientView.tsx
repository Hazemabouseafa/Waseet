'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Product, InventoryBatch, Category } from '@/types';
import {
  createBatchAction,
  updateBatchAction,
  createProductAction,
  updateProductAction,
  createCategoryAction,
  deleteCategoryAction,
  createProductAndBatchAction,
  deleteBatchAction,
  deleteProductAction,
} from '@/lib/actions';
import ConfirmDeleteModal from '@/components/admin/ConfirmDeleteModal';
import { exportWorkbookToExcel } from '@/lib/excelExport';
import {
  Boxes,
  Plus,
  Calendar,
  AlertCircle,
  Clock,
  Sparkles,
  CheckCircle2,
  X,
  PackagePlus,
  Package,
  Layers,
  Tags,
  Trash2,
  Building2,
  FileCheck,
  ShieldAlert,
  Search,
  Edit2,
  FileSpreadsheet,
} from 'lucide-react';

export interface AvailablePurchaseItem {
  purchaseId: string;
  purchaseNumber: string;
  supplierId: string;
  supplierName: string;
  purchaseItemId: string;
  productId: string;
  productName: string;
  unitCost: number;
  totalInvoiceQty: number;
  assignedQty: number;
  remainingQty: number;
  productionDate: string;
  createdAt: string;
}

interface Props {
  products: Product[];
  batches: (InventoryBatch & { product: Product; hoursRemaining: number })[];
  categories: Category[];
  availablePurchaseItems?: AvailablePurchaseItem[];
}

export default function InventoryClientView({
  products: initialProducts,
  batches: initialBatches,
  categories: initialCategories,
  availablePurchaseItems: initialAvailableItems = [],
}: Props) {
  const router = useRouter();
  const [productsList, setProductsList] = useState<Product[]>(initialProducts || []);
  const [batchesList, setBatchesList] = useState(initialBatches || []);
  const [categories, setCategories] = useState<Category[]>(initialCategories || []);
  const [availableInvoices, setAvailableInvoices] = useState<AvailablePurchaseItem[]>(
    initialAvailableItems || []
  );
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showCategoriesModal, setShowCategoriesModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Products Directory Modal State
  const [showProductsModal, setShowProductsModal] = useState(false);
  const [productSearch, setProductSearch] = useState('');

  // Universal Delete Confirmation Modal State
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'batch' | 'product';
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setMsg(null);
    try {
      if (deleteTarget.type === 'batch') {
        const res = await deleteBatchAction(deleteTarget.id);
        if (res.success) {
          setBatchesList((prev) => prev.filter((b) => b.id !== deleteTarget.id));
          setMsg({ type: 'success', text: res.message || 'تم حذف التشغيلة بنجاح' });
        } else {
          setMsg({ type: 'error', text: res.error || 'فشل حذف التشغيلة' });
        }
      } else {
        const res = await deleteProductAction(deleteTarget.id);
        if (res.success) {
          setProductsList((prev) => prev.filter((p) => p.id !== deleteTarget.id));
          setMsg({ type: 'success', text: res.message || 'تم حذف المنتج بنجاح' });
        } else {
          setMsg({ type: 'error', text: res.error || 'فشل حذف المنتج' });
        }
      }
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('app:sync'));
      router.refresh();
    } catch (err: any) {
      setMsg({ type: 'error', text: err?.message || 'حدث خطأ أثناء الحذف' });
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  // Synchronize state when server props update
  useEffect(() => {
    setProductsList(initialProducts || []);
  }, [initialProducts]);

  useEffect(() => {
    setBatchesList(initialBatches || []);
  }, [initialBatches]);

  useEffect(() => {
    setCategories(initialCategories || []);
  }, [initialCategories]);

  useEffect(() => {
    setAvailableInvoices(initialAvailableItems || []);
  }, [initialAvailableItems]);

  // Category Modal Form State
  const [newCatName, setNewCatName] = useState('');
  const [newCatShelfLife, setNewCatShelfLife] = useState(1);
  const [catLoading, setCatLoading] = useState(false);
  const [catError, setCatError] = useState<string | null>(null);
  const [catSuccess, setCatSuccess] = useState<string | null>(null);

  // Product Modal State
  const [productCategory, setProductCategory] = useState<string>(
    initialCategories[0]?.name || ''
  );
  const [productShelfLife, setProductShelfLife] = useState<number>(
    initialCategories[0]?.defaultShelfLifeDays || 1
  );

  // Synchronize productCategory when categories change
  useEffect(() => {
    if (categories.length > 0 && (!productCategory || !categories.some((c) => c.name === productCategory))) {
      setProductCategory(categories[0].name);
      setProductShelfLife(categories[0].defaultShelfLifeDays || 1);
    }
  }, [categories, productCategory]);

  // Supplier Purchase Invoice Linkage State
  const unassignedInvoices = availableInvoices.filter((i) => i.remainingQty > 0);
  const [selectedPurchaseItemId, setSelectedPurchaseItemId] = useState<string>(
    unassignedInvoices[0]?.purchaseItemId || ''
  );

  // Synchronize selectedPurchaseItemId when unassigned invoices change
  useEffect(() => {
    if (unassignedInvoices.length > 0) {
      if (!selectedPurchaseItemId || !unassignedInvoices.some((i) => i.purchaseItemId === selectedPurchaseItemId)) {
        const first = unassignedInvoices[0];
        setSelectedPurchaseItemId(first.purchaseItemId);
        setBatchProductId(first.productId);
        setBatchQuantity(Math.min(first.remainingQty, 50));
      }
    }
  }, [unassignedInvoices, selectedPurchaseItemId]);

  const selectedPurchaseItem = unassignedInvoices.find(
    (i) => i.purchaseItemId === selectedPurchaseItemId
  );

  // Batch Form State & On-the-spot Product Creation
  const [batchSourceMode, setBatchSourceMode] = useState<'direct' | 'supplier'>(
    unassignedInvoices.length > 0 ? 'supplier' : 'direct'
  );
  const [batchMode, setBatchMode] = useState<'existing' | 'new'>('existing');
  const [batchProductId, setBatchProductId] = useState(initialProducts[0]?.id || '');
  const [batchNumber, setBatchNumber] = useState('');
  const [batchQuantity, setBatchQuantity] = useState(50);
  const [productionDate, setProductionDate] = useState(new Date().toISOString().slice(0, 16));
  const [expiryDate, setExpiryDate] = useState(() => {
    const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 16);
  });
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [editBatch, setEditBatch] = useState<
    (InventoryBatch & { product: Product; hoursRemaining: number }) | null
  >(null);

  const applyExpiryPresetDays = (days: number, baseDateStr?: string) => {
    const base = baseDateStr ? new Date(baseDateStr) : new Date(productionDate || Date.now());
    const validBase = isNaN(base.getTime()) ? new Date() : base;
    const target = new Date(validBase.getTime() + days * 24 * 60 * 60 * 1000);
    return target.toISOString().slice(0, 16);
  };

  // Inline product fields when adding an incoming batch for a brand new product
  const [newProductName, setNewProductName] = useState('');
  const [newProductCategory, setNewProductCategory] = useState(
    initialCategories[0]?.name || ''
  );
  const [newProductShelfLife, setNewProductShelfLife] = useState(
    initialCategories[0]?.defaultShelfLifeDays || 1
  );
  const [newProductPrice, setNewProductPrice] = useState(35);
  const [newProductCost, setNewProductCost] = useState(28);
  const [newProductUnit, setNewProductUnit] = useState('كرتونة');

  // Synchronize category selection for new product in batch modal
  useEffect(() => {
    if (categories.length > 0) {
      if (!newProductCategory || !categories.some((c) => c.name === newProductCategory)) {
        setNewProductCategory(categories[0].name);
        setNewProductShelfLife(categories[0].defaultShelfLifeDays || 1);
      }
    }
  }, [categories, newProductCategory]);

  // Automatically keep batchProductId in sync with available products
  useEffect(() => {
    if (productsList.length > 0) {
      if (!batchProductId || !productsList.some((p) => p.id === batchProductId)) {
        setBatchProductId(productsList[0].id);
      }
    }
  }, [productsList, batchProductId]);

  const selectedProduct =
    productsList.find((p) => p.id === batchProductId) || productsList[0];

  // Calculate projected expiry based on mode and production date
  const getProjectedExpiry = () => {
    const d = new Date(productionDate);
    if (isNaN(d.getTime())) return '';
    const days =
      batchMode === 'new'
        ? newProductShelfLife || 1
        : selectedProduct?.shelfLifeDays || 1;
    const exp = new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
    return exp.toLocaleString('ar-EG', {
      weekday: 'short',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const filteredBatches = batchesList.filter((b) => {
    if (selectedCategory === 'all') return true;
    return b.product.category === selectedCategory;
  });

  const handleAddBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    try {
      const qty = Number(batchQuantity);
      if (isNaN(qty) || qty <= 0) {
        setMsg({ type: 'error', text: 'يرجى إدخال كمية صحيحة للتشغيلة أكبر من الصفر' });
        setLoading(false);
        return;
      }

      if (batchSourceMode === 'supplier') {
        if (!selectedPurchaseItem) {
          setMsg({
            type: 'error',
            text: 'يرجى تحديد فاتورة الشراء والتوريد التابعة للمورد أو التبديل إلى (إضافة مباشرة للمخزن)',
          });
          setLoading(false);
          return;
        }

        if (qty > selectedPurchaseItem.remainingQty) {
          setMsg({
            type: 'error',
            text: `عذراً، الكمية المراد إدخالها للتشغيلة (${qty}) أكبر من الكمية المتبقية في فاتورة المورد المحددة (المتبقي: ${selectedPurchaseItem.remainingQty})`,
          });
          setLoading(false);
          return;
        }

        const formData = new FormData();
        formData.append('productId', selectedPurchaseItem.productId);
        formData.append(
          'batchNumber',
          batchNumber.trim() || `BAT-${Date.now().toString().slice(-6)}`
        );
        formData.append('quantity', qty.toString());
        formData.append('productionDate', new Date(productionDate).toISOString());
        if (expiryDate) {
          formData.append('expiryDate', new Date(expiryDate).toISOString());
        }
        formData.append('purchaseId', selectedPurchaseItem.purchaseId);
        formData.append('purchaseItemId', selectedPurchaseItem.purchaseItemId);

        const res = await createBatchAction(formData);
        setLoading(false);

        if (res.success && res.batch) {
          const prod =
            productsList.find((p) => p.id === selectedPurchaseItem.productId) || selectedProduct;
          if (prod) {
            const expMs = new Date(res.batch.expiryDate).getTime();
            const newBat = {
              ...res.batch,
              product: prod,
              hoursRemaining: Math.round((expMs - Date.now()) / (1000 * 60 * 60)),
            };
            setBatchesList((prev) => [newBat, ...prev]);
          }

          setAvailableInvoices((prev) =>
            prev.map((inv) =>
              inv.purchaseItemId === selectedPurchaseItem.purchaseItemId
                ? {
                    ...inv,
                    assignedQty: inv.assignedQty + qty,
                    remainingQty: Math.max(0, inv.remainingQty - qty),
                  }
                : inv
            )
          );

          setMsg({
            type: 'success',
            text: res.message || 'تم تسجيل التشغيلة بنجاح وربطها بفاتورة المورد بنظام FIFO',
          });
          setShowBatchModal(false);
          setBatchNumber('');
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('app:sync'));
          }
          router.refresh();
        } else {
          setMsg({ type: 'error', text: res.error || 'حدث خطأ أثناء تسجيل التشغيلة' });
        }
        return;
      }

      // Direct Warehouse Entry Mode (رصيد أول المدة / إضافة تشغيلة مباشرة للمخزن)
      if (!batchProductId) {
        setMsg({ type: 'error', text: 'يرجى اختيار الصنف المراد إضافة التشغيلة له' });
        setLoading(false);
        return;
      }

      const formData = new FormData();
      formData.append('productId', batchProductId);
      formData.append(
        'batchNumber',
        batchNumber.trim() || `BAT-DIR-${Date.now().toString().slice(-6)}`
      );
      formData.append('quantity', qty.toString());
      formData.append('productionDate', new Date(productionDate).toISOString());
      if (expiryDate) {
        formData.append('expiryDate', new Date(expiryDate).toISOString());
      }

      const res = await createBatchAction(formData);
      setLoading(false);

      if (res.success && res.batch) {
        const prod = productsList.find((p) => p.id === batchProductId) || selectedProduct;
        if (prod) {
          const expMs = new Date(res.batch.expiryDate).getTime();
          const newBat = {
            ...res.batch,
            product: prod,
            hoursRemaining: Math.round((expMs - Date.now()) / (1000 * 60 * 60)),
          };
          setBatchesList((prev) => [newBat, ...prev]);
        }
        setMsg({
          type: 'success',
          text: res.message || 'تم إضافة التشغيلة المباشرة للمخزن الرئيسي بنجاح',
        });
        setShowBatchModal(false);
        setBatchNumber('');
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('app:sync'));
        }
        router.refresh();
      } else {
        setMsg({ type: 'error', text: res.error || 'حدث خطأ أثناء إضافة التشغيلة' });
      }
    } catch (err: any) {
      setLoading(false);
      setMsg({ type: 'error', text: err.message || 'حدث خطأ غير متوقع' });
    }
  };

  const handleUpdateBatch = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editBatch) return;
    setLoading(true);
    setMsg(null);
    const formData = new FormData(e.currentTarget);
    const expVal = formData.get('expiryDate') as string;
    const prodVal = formData.get('productionDate') as string;
    if (expVal) formData.set('expiryDate', new Date(expVal).toISOString());
    if (prodVal) formData.set('productionDate', new Date(prodVal).toISOString());

    const res = await updateBatchAction(editBatch.id, formData);
    setLoading(false);

    if (res.success && res.batch) {
      const expMs = new Date(res.batch.expiryDate).getTime();
      setBatchesList((prev) =>
        prev.map((b) =>
          b.id === res.batch!.id
            ? {
                ...b,
                ...res.batch!,
                hoursRemaining: Math.round((expMs - Date.now()) / (1000 * 60 * 60)),
              }
            : b
        )
      );
      setMsg({ type: 'success', text: res.message || 'تم تحديث صلاحية وبيانات التشغيلة بنجاح' });
      setEditBatch(null);
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('app:sync'));
      router.refresh();
    } else {
      setMsg({ type: 'error', text: res.error || 'فشل تحديث بيانات التشغيلة' });
    }
  };

  const handleUpdateProduct = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editProduct) return;
    setLoading(true);
    setMsg(null);
    const formData = new FormData(e.currentTarget);
    const res = await updateProductAction(editProduct.id, formData);
    setLoading(false);

    if (res.success && res.product) {
      setProductsList((prev) => prev.map((p) => (p.id === res.product!.id ? res.product! : p)));
      setMsg({ type: 'success', text: res.message || 'تم تحديث بيانات وأسعار المنتج بنجاح' });
      setEditProduct(null);
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('app:sync'));
      router.refresh();
    } else {
      setMsg({ type: 'error', text: res.error || 'فشل تحديث بيانات المنتج' });
    }
  };

  const handleAddProduct = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    const formData = new FormData(e.currentTarget);
    const res = await createProductAction(formData);
    setLoading(false);

    if (res.success) {
      if (res.product) {
        setProductsList((prev) => [...prev, res.product!]);
        setBatchProductId(res.product.id);
      }
      setMsg({ type: 'success', text: res.message || 'تم إضافة المنتج بنجاح' });
      setShowProductModal(false);
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('app:sync'));
      router.refresh();
    } else {
      setMsg({ type: 'error', text: res.error || 'حدث خطأ أثناء إضافة الصنف' });
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    setCatLoading(true);
    setCatError(null);
    setCatSuccess(null);

    const formData = new FormData();
    formData.append('name', newCatName.trim());
    formData.append('defaultShelfLifeDays', newCatShelfLife.toString());

    const res = await createCategoryAction(formData);
    setCatLoading(false);

    if (res.success && res.category) {
      setCategories((prev) => [...prev.filter((c) => c.id !== res.category!.id), res.category!]);
      setProductCategory(res.category.name);
      setProductShelfLife(res.category.defaultShelfLifeDays);
      setCatSuccess(res.message || `تم إضافة التصنيف "${newCatName}" بنجاح`);
      setNewCatName('');
      setNewCatShelfLife(1);
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('app:sync'));
      router.refresh();
    } else {
      setCatError(res.error || 'فشل إضافة التصنيف');
    }
  };

  const handleDeleteCategory = async (catId: string, catName: string) => {
    if (!confirm(`هل أنت متأكد من حذف تصنيف "${catName}"؟`)) return;

    setCatLoading(true);
    setCatError(null);
    setCatSuccess(null);

    const res = await deleteCategoryAction(catId);
    setCatLoading(false);

    if (res.success) {
      setCategories((prev) => prev.filter((c) => c.id !== catId));
      setCatSuccess('تم حذف التصنيف بنجاح');
      if (selectedCategory === catName) setSelectedCategory('all');
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('app:sync'));
      router.refresh();
    } else {
      setCatError(res.error || 'فشل حذف التصنيف');
    }
  };

  const handleCategoryChange = (catName: string) => {
    setProductCategory(catName);
    const found = categories.find((c) => c.name === catName);
    if (found) {
      setProductShelfLife(found.defaultShelfLifeDays);
    }
  };

  const handleExportInventoryExcel = () => {
    exportWorkbookToExcel('جرد_المخزن_والصلاحيات', [
      {
        sheetName: 'تشغيلات المخزن والصلاحيات',
        headers: [
          'رقم التشغيلة',
          'اسم المنتج',
          'التصنيف',
          'الكمية المتبقية بالمخزن',
          'الكمية الأولية',
          'الوحدة',
          'تاريخ الإنتاج',
          'تاريخ انتهاء الصلاحية',
          'الساعات المتبقية',
          'حالة الصلاحية',
        ],
        rows: filteredBatches.map((b) => [
          b.batchNumber,
          b.product.name,
          b.product.category === 'dairy'
            ? 'ألبان'
            : b.product.category === 'juice'
            ? 'عصائر'
            : b.product.category,
          b.quantity,
          b.initialQuantity,
          b.product.unit,
          new Date(b.productionDate).toLocaleDateString('ar-EG'),
          new Date(b.expiryDate).toLocaleDateString('ar-EG'),
          b.hoursRemaining,
          b.quantity === 0
            ? 'نفدت الكمية'
            : b.hoursRemaining <= 0
            ? 'منتهية الصلاحية'
            : b.hoursRemaining <= 48
            ? 'تقترب من الانتهاء'
            : 'صالحة وطازجة',
        ]),
      },
      {
        sheetName: 'دليل الأصناف والأسعار',
        headers: [
          'اسم المنتج',
          'التصنيف',
          'سعر البيع (ج.م)',
          'سعر التكلفة (ج.م)',
          'ربح الكرتونة (ج.م)',
          'الوحدة',
          'الصلاحية الافتراضية (يوم)',
        ],
        rows: productsList.map((p) => [
          p.name,
          p.category,
          p.price,
          p.cost,
          p.price - p.cost,
          p.unit,
          p.shelfLifeDays,
        ]),
      },
    ]);
  };

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Dynamic Category Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-white border border-slate-200 rounded-xl overflow-x-auto scrollbar-none touch-pan-x shadow-xs max-w-full">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap shrink-0 ${
              selectedCategory === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            جميع التشغيلات ({batchesList.length})
          </button>

          {categories.map((cat) => {
            const isSelected =
              selectedCategory === cat.name ||
              (cat.name === 'ألبان' && selectedCategory === 'dairy') ||
              (cat.name === 'عصائر' && selectedCategory === 'juice');

            const count = batchesList.filter(
              (b) =>
                b.product.category === cat.name ||
                (cat.name === 'ألبان' && b.product.category === 'dairy') ||
                (cat.name === 'عصائر' && b.product.category === 'juice')
            ).length;

            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.name)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap shrink-0 ${
                  isSelected
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                {cat.name} ({count})
              </button>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <button
            type="button"
            onClick={handleExportInventoryExcel}
            className="flex-1 sm:flex-none justify-center px-3.5 py-2 rounded-xl border border-teal-200 hover:bg-teal-50 text-teal-800 text-xs font-bold transition flex items-center gap-1.5 bg-teal-50/70 shadow-xs whitespace-nowrap cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-teal-600" />
            <span>تصدير Excel للمخزن</span>
          </button>

          {/* Manage Categories Button */}
          <button
            onClick={() => {
              setCatError(null);
              setCatSuccess(null);
              setShowCategoriesModal(true);
            }}
            className="flex-1 sm:flex-none justify-center px-3.5 py-2 rounded-xl border border-indigo-200 hover:bg-indigo-50 text-indigo-700 text-xs font-bold transition flex items-center gap-1.5 bg-indigo-50/60 shadow-xs whitespace-nowrap"
          >
            <Tags className="w-4 h-4 text-indigo-600" />
            <span>إدارة التصنيفات ({categories.length})</span>
          </button>

          <button
            onClick={() => {
              setProductSearch('');
              setShowProductsModal(true);
            }}
            className="flex-1 sm:flex-none justify-center px-3.5 py-2 rounded-xl border border-emerald-200 hover:bg-emerald-50 text-emerald-800 text-xs font-bold transition flex items-center gap-1.5 bg-emerald-50/60 shadow-xs whitespace-nowrap"
          >
            <Package className="w-4 h-4 text-emerald-600" />
            <span>دليل الأصناف ({productsList.length})</span>
          </button>

          <button
            onClick={() => setShowProductModal(true)}
            className="flex-1 sm:flex-none justify-center px-3.5 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 bg-white shadow-xs whitespace-nowrap"
          >
            <PackagePlus className="w-4 h-4 text-slate-500" />
            <span>تعريف صنف جديد</span>
          </button>

          <Link
            href="/admin/suppliers"
            className="flex-1 sm:flex-none justify-center px-3.5 py-2 rounded-xl border border-blue-200 hover:bg-blue-100/70 text-blue-800 text-xs font-bold transition flex items-center gap-1.5 bg-blue-50/70 shadow-xs whitespace-nowrap"
          >
            <Building2 className="w-4 h-4 text-blue-600" />
            <span>توريد من مورد للمخزن</span>
          </Link>

          <button
            onClick={() => setShowBatchModal(true)}
            className="w-full sm:w-auto justify-center px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm shadow-emerald-600/20 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>تسجيل تشغيلة واردة (FIFO Batch)</span>
          </button>
        </div>
      </div>

      {msg && (
        <div
          className={`p-4 rounded-xl text-sm flex items-center gap-2 ${
            msg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {msg.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600" />
          )}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Batches Table with FIFO Sorting */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-4">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-600 shrink-0" />
            <h2 className="text-sm font-bold text-slate-800">
              سجل تشغيلات المستودع الرئيسي (مرتبة حسب الأقدم انتهاءً أولاً - FIFO)
            </h2>
          </div>
          <span className="text-xs text-slate-500">
            الصرف الآلي يعتمد على أقرب تاريخ انتهاء
          </span>
        </div>

        {filteredBatches.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500">
            <Layers className="w-10 h-10 text-slate-300 mx-auto mb-2.5" />
            <p className="font-bold text-slate-700 text-sm">لا توجد تشغيلات مسجلة بالمخزن مطابقة للتصفية</p>
            <p className="text-slate-400 mt-1">انقر على زر "+ تسجيل تشغيلة واردة" بالأعلى لإدخال تشغيلة جديدة بنظام FIFO</p>
          </div>
        ) : (
          <>
            {/* 1. Mobile Touch Cards View (md:hidden) — Completely avoids table column collisions on phones */}
            <div className="block md:hidden divide-y divide-slate-100 p-3 sm:p-4 space-y-3">
              {filteredBatches.map((batch) => {
                const isDairy = batch.product.category === 'dairy';
                const isUrgent = batch.hoursRemaining <= (isDairy ? 16 : 48);
                const isExpired = batch.hoursRemaining <= 0;
                const stockPercent = batch.initialQuantity > 0
                  ? Math.min(100, Math.max(0, Math.round((batch.quantity / batch.initialQuantity) * 100)))
                  : 0;

                return (
                  <div
                    key={batch.id}
                    className="bg-slate-50/70 rounded-2xl p-4 border border-slate-200/90 space-y-3 hover:bg-white transition shadow-2xs"
                  >
                    {/* Header: Product Name + Category + Expiry Status */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="font-bold text-slate-900 text-sm break-words">
                            {batch.product.name}
                          </h3>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[11px] font-bold shrink-0 ${
                              isDairy
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            {isDairy ? 'ألبان (1 يوم)' : `عصائر (${batch.product.shelfLifeDays} أيام)`}
                          </span>
                        </div>
                        <div className="text-xs font-mono font-bold text-slate-500 mt-1">
                          رقم التشغيلة: <span className="text-slate-900 font-bold">{batch.batchNumber}</span>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {batch.quantity === 0 ? (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-500">
                            نفدت الكمية
                          </span>
                        ) : isExpired ? (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            منتهية الصلاحية
                          </span>
                        ) : isUrgent ? (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200 animate-pulse">
                            تقترب من الانتهاء
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            صالحة وطازجة
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Stock Quantity & Progress Bar */}
                    <div className="bg-white p-3 rounded-xl border border-slate-200/80 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 font-medium">الكمية المتبقية بالمخزن:</span>
                        <div className="font-mono">
                          <strong className="text-slate-900 font-black text-sm">{batch.quantity}</strong>
                          <span className="text-slate-400 text-xs"> / {batch.initialQuantity} {batch.product.unit}</span>
                          <span className="text-emerald-700 font-bold mr-1.5">({stockPercent}%)</span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            stockPercent > 50
                              ? 'bg-emerald-500'
                              : stockPercent > 20
                              ? 'bg-amber-500'
                              : 'bg-rose-500'
                          }`}
                          style={{ width: `${stockPercent}%` }}
                        />
                      </div>
                    </div>

                    {/* Production & Expiry Dates */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 bg-white rounded-xl border border-slate-200/60">
                        <span className="text-[10px] text-slate-400 block mb-0.5 font-bold">تاريخ الإنتاج:</span>
                        <span className="font-mono text-slate-700 font-semibold text-[11px]">
                          {new Date(batch.productionDate).toLocaleDateString('ar-EG', {
                            month: 'numeric',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      <div className="p-2.5 bg-white rounded-xl border border-slate-200/60">
                        <span className="text-[10px] text-slate-400 block mb-0.5 font-bold">تاريخ الانتهاء:</span>
                        <span className="font-mono text-slate-900 font-bold text-[11px]">
                          {new Date(batch.expiryDate).toLocaleDateString('ar-EG', {
                            month: 'numeric',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Countdown Badge & Delete Action */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                      <div className="text-xs">
                        {batch.quantity === 0 ? (
                          <span className="text-xs text-slate-400">-</span>
                        ) : (
                          <div
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${
                              isExpired
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : isUrgent
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            <Clock className="w-3.5 h-3.5" />
                            <span>
                              {isExpired ? 'منتهية الصلاحية' : `متبقي ${batch.hoursRemaining} ساعة`}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditBatch(batch)}
                          title="تعديل الصلاحية والكمية"
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold transition flex items-center gap-1 border border-emerald-200 active:scale-95"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>الصلاحية</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setDeleteTarget({
                              type: 'batch',
                              id: batch.id,
                              name: `تشغيلة رقم ${batch.batchNumber} (${batch.product.name})`,
                            })
                          }
                          title="حذف التشغيلة"
                          className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition flex items-center gap-1 border border-rose-200 active:scale-95"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>حذف</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 2. Desktop Full Table View (hidden md:block) */}
            <div className="hidden md:block overflow-x-auto touch-pan-x">
              <table className="w-full text-right text-sm min-w-[760px]">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 text-xs bg-slate-50/40">
                    <th className="py-3 pr-4">رقم التشغيلة</th>
                    <th className="py-3">اسم المنتج</th>
                    <th className="py-3">النوع وفترة الصلاحية</th>
                    <th className="py-3">تاريخ الإنتاج</th>
                    <th className="py-3">تاريخ الانتهاء</th>
                    <th className="py-3">المتبقي / الأولي</th>
                    <th className="py-3">حالة الصلاحية</th>
                    <th className="py-3">الوقت المتبقي</th>
                    <th className="py-3 pl-4 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredBatches.map((batch) => {
                    const isDairy = batch.product.category === 'dairy';
                    const isUrgent = batch.hoursRemaining <= (isDairy ? 16 : 48);
                    const isExpired = batch.hoursRemaining <= 0;

                    return (
                      <tr key={batch.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 pr-4 font-mono font-bold text-slate-800">
                          {batch.batchNumber}
                        </td>
                        <td className="py-3 font-semibold text-slate-900">
                          {batch.product.name}
                        </td>
                        <td className="py-3 text-xs">
                          <span
                            className={`px-2 py-0.5 rounded-md font-bold ${
                              isDairy
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            {isDairy ? 'ألبان (1 يوم)' : `عصائر (${batch.product.shelfLifeDays} أيام)`}
                          </span>
                        </td>
                        <td className="py-3 text-xs text-slate-600 font-mono">
                          {new Date(batch.productionDate).toLocaleDateString('ar-EG', {
                            month: 'numeric',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="py-3 text-xs font-mono font-bold text-slate-800">
                          {new Date(batch.expiryDate).toLocaleDateString('ar-EG', {
                            month: 'numeric',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="py-3 text-xs">
                          <strong className="text-slate-900 font-mono text-sm">{batch.quantity}</strong>
                          <span className="text-slate-400"> / {batch.initialQuantity} {batch.product.unit}</span>
                        </td>
                        <td className="py-3">
                          {batch.quantity === 0 ? (
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-500">
                              نفدت الكمية
                            </span>
                          ) : isExpired ? (
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                              منتهية الصلاحية
                            </span>
                          ) : isUrgent ? (
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              تقترب من الانتهاء
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              صالحة وطازجة
                            </span>
                          )}
                        </td>
                        <td className="py-3 pl-4">
                          {batch.quantity === 0 ? (
                            <span className="text-xs text-slate-400">-</span>
                          ) : (
                            <div
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${
                                isExpired
                                  ? 'bg-rose-50 text-rose-700'
                                  : isUrgent
                                  ? 'bg-amber-50 text-amber-700'
                                  : 'bg-emerald-50 text-emerald-700'
                              }`}
                            >
                              <Clock className="w-3.5 h-3.5" />
                              <span>
                                {isExpired ? 'منتهية' : `${batch.hoursRemaining} ساعة`}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="py-3 pl-4 text-center">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setEditBatch(batch)}
                              title="تعديل تاريخ الصلاحية أو الكمية"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setDeleteTarget({
                                  type: 'batch',
                                  id: batch.id,
                                  name: `تشغيلة رقم ${batch.batchNumber} (${batch.product.name})`,
                                })
                              }
                              title="حذف التشغيلة"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Modal: Add New Batch (تسجيل تشغيلة واردة مع احتساب آلي للصلاحية) */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Boxes className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    تسجيل تشغيلة واردة جديدة (FIFO Batch)
                  </h3>
                  <div className="text-[11px] text-slate-500">
                    إدخال البضاعة الواردة وحساب الصلاحية تلقائياً
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowBatchModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl mb-4">
              <button
                type="button"
                onClick={() => setBatchSourceMode('direct')}
                className={`py-2 rounded-lg text-xs font-black transition ${
                  batchSourceMode === 'direct'
                    ? 'bg-white text-emerald-700 shadow-2xs'
                    : 'text-slate-600'
                }`}
              >
                إضافة مباشرة للمخزن (سريع)
              </button>
              <button
                type="button"
                onClick={() => setBatchSourceMode('supplier')}
                className={`py-2 rounded-lg text-xs font-black transition ${
                  batchSourceMode === 'supplier'
                    ? 'bg-white text-blue-700 shadow-2xs'
                    : 'text-slate-600'
                }`}
              >
                ربط بفاتورة مورد ({unassignedInvoices.length})
              </button>
            </div>

            {batchSourceMode === 'supplier' && unassignedInvoices.length === 0 ? (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-sm space-y-2">
                  <div className="flex items-center gap-2 font-bold text-amber-950">
                    <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
                    <span>لا توجد فواتير شراء موردين معلقة حالياً</span>
                  </div>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    جميع فواتير الموردين تم استلام تشغيلاتها بالمخزن، أو يمكنك التبديل إلى تبويب{' '}
                    <strong>(إضافة مباشرة للمخزن)</strong> بالأعلى لإدخال رصيد فوري دون فاتورة مورد.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setBatchSourceMode('direct')}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition"
                  >
                    إضافة مباشرة للمخزن الآن
                  </button>
                  <Link
                    href="/admin/suppliers"
                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition flex items-center gap-1.5"
                  >
                    <Building2 className="w-4 h-4" />
                    <span>تسجيل فاتورة مورد جديدة</span>
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleAddBatch} className="space-y-4">
                {batchSourceMode === 'direct' ? (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      اختر الصنف المراد إضافة التشغيلة له بالمخزن *
                    </label>
                    <select
                      value={batchProductId}
                      onChange={(e) => setBatchProductId(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 bg-white font-bold"
                    >
                      {productsList.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} — سعر البيع: {p.price} ج.م — التكلفة: {p.cost} ج.م
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <>
                    {/* 1. Mandatory Supplier Purchase Linkage Dropdown */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-slate-700">
                          فاتورة شراء وتوريد المورد <span className="text-rose-500">*</span>
                        </label>
                        <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100 flex items-center gap-1">
                          <FileCheck className="w-3 h-3" />
                          <span>تدقيق مالي ومخزني</span>
                        </span>
                      </div>
                      <select
                        value={selectedPurchaseItemId}
                        onChange={(e) => {
                          setSelectedPurchaseItemId(e.target.value);
                          const item = availableInvoices.find((i) => i.purchaseItemId === e.target.value);
                          if (item) {
                            setBatchProductId(item.productId);
                            setBatchQuantity(Math.min(item.remainingQty, 50));
                          }
                        }}
                        required
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 bg-white font-medium"
                      >
                        {unassignedInvoices.map((inv) => (
                          <option key={inv.purchaseItemId} value={inv.purchaseItemId}>
                            [{inv.purchaseNumber}] — {inv.supplierName} — {inv.productName} (المتبقي: {inv.remainingQty} كرتونة)
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* 2. Detailed Purchase Item Badge & Info Card */}
                    {selectedPurchaseItem && (
                      <div className="p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-2xl space-y-2.5">
                        <div className="flex items-center justify-between text-xs font-bold text-blue-950">
                          <span className="flex items-center gap-1">
                            <span>رقم الفاتورة:</span>
                            <strong className="font-mono text-blue-700">{selectedPurchaseItem.purchaseNumber}</strong>
                          </span>
                          <span>المورد: <strong className="text-slate-900">{selectedPurchaseItem.supplierName}</strong></span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                          <div className="bg-white/90 p-2 rounded-xl text-center border border-slate-100 shadow-xs">
                            <div className="text-[10px] text-slate-400 font-bold">إجمالي كمية الفاتورة</div>
                            <div className="font-black text-slate-800 text-sm mt-0.5">{selectedPurchaseItem.totalInvoiceQty} كرتونة</div>
                          </div>
                          <div className="bg-white/90 p-2 rounded-xl text-center border border-slate-100 shadow-xs">
                            <div className="text-[10px] text-slate-400 font-bold">مسند سابقاً لتشغيلات</div>
                            <div className="font-black text-slate-800 text-sm mt-0.5">{selectedPurchaseItem.assignedQty} كرتونة</div>
                          </div>
                          <div className="bg-emerald-50/90 p-2 rounded-xl text-center border border-emerald-300 shadow-xs">
                            <div className="text-[10px] text-emerald-800 font-bold">المتبقي المتاح للإدخال</div>
                            <div className="font-black text-emerald-700 text-sm mt-0.5">{selectedPurchaseItem.remainingQty} كرتونة</div>
                          </div>
                        </div>

                        <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-blue-100">
                          <span>الصنف المربوط: <strong className="text-slate-800">{selectedPurchaseItem.productName}</strong></span>
                          <span>سعر التكلفة: <strong className="text-emerald-700 font-mono">{selectedPurchaseItem.unitCost} ج.م</strong></span>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* 3. Real-time Quantity Validation Warning */}
                {batchSourceMode === 'supplier' && selectedPurchaseItem && batchQuantity > selectedPurchaseItem.remainingQty && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-xs font-bold text-rose-800 flex items-center gap-2 animate-pulse">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>
                      عذراً، الكمية المراد إدخالها للتشغيلة ({batchQuantity}) أكبر من الكمية المتبقية في فاتورة المورد المحددة (المتبقي: {selectedPurchaseItem.remainingQty})
                    </span>
                  </div>
                )}

                {/* 4. Batch Code & Quantity Inputs */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      رقم التشغيلة (Batch Code)
                    </label>
                    <input
                      type="text"
                      value={batchNumber}
                      onChange={(e) => setBatchNumber(e.target.value)}
                      placeholder="مثلاً: BAT-001 (تلقائي)"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 font-mono"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-700">
                        الكمية الواردة (بالكرتونة) *
                      </label>
                      {batchSourceMode === 'supplier' && selectedPurchaseItem && (
                        <span className="text-[10px] text-emerald-700 font-bold">
                          الحد الأقصى: {selectedPurchaseItem.remainingQty}
                        </span>
                      )}
                    </div>
                    <input
                      type="number"
                      min="1"
                      max={batchSourceMode === 'supplier' ? (selectedPurchaseItem?.remainingQty || 9999) : 99999}
                      required
                      value={batchQuantity}
                      onChange={(e) => setBatchQuantity(parseInt(e.target.value, 10) || 0)}
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:ring-2 font-bold ${
                        batchSourceMode === 'supplier' && selectedPurchaseItem && batchQuantity > selectedPurchaseItem.remainingQty
                          ? 'border-rose-400 focus:ring-rose-500/20 focus:border-rose-600 bg-rose-50/50 text-rose-800'
                          : 'border-slate-200 focus:ring-emerald-500/20 focus:border-emerald-600'
                      }`}
                    />
                  </div>
                </div>

                {/* 5. Production & Manual Expiry Dates (Controlled directly by Manager) */}
                <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-emerald-600" />
                      <span>تحديد تاريخ الصلاحية (يتحكم فيه المدير مباشرة)</span>
                    </span>
                    <span className="text-[10px] font-bold text-emerald-700 bg-white px-2 py-0.5 rounded-full border border-emerald-200">
                      تحكم يدوي كامل
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        تاريخ وتوقيت الإنتاج *
                      </label>
                      <input
                        type="datetime-local"
                        required
                        value={productionDate}
                        onChange={(e) => setProductionDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-black text-emerald-900 mb-1">
                        تاريخ انتهاء الصلاحية (يحدده المدير) *
                      </label>
                      <input
                        type="datetime-local"
                        required
                        value={expiryDate}
                        onChange={(e) => setExpiryDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border-2 border-emerald-400 bg-white text-xs focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 font-mono font-bold text-emerald-950"
                      />
                    </div>
                  </div>

                  {/* Quick Preset Chips for Manager convenience */}
                  <div className="pt-1">
                    <div className="text-[10px] font-bold text-emerald-800 mb-1.5">
                      اختصارات سريعة لضبط الصلاحية من تاريخ الإنتاج (أو اختر أي تاريخ يدوي بالأعلى):
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { label: '+ يوم (24س)', days: 1 },
                        { label: '+ 3 أيام', days: 3 },
                        { label: '+ 7 أيام', days: 7 },
                        { label: '+ 15 يوم', days: 15 },
                        { label: '+ شهر', days: 30 },
                        { label: '+ 3 شهور', days: 90 },
                        { label: '+ 6 شهور', days: 180 },
                        { label: '+ سنة', days: 365 },
                      ].map((preset) => (
                        <button
                          key={preset.days}
                          type="button"
                          onClick={() => applyExpiryPresetDays(preset.days)}
                          className="px-2 py-1 rounded-lg bg-white hover:bg-emerald-600 hover:text-white text-emerald-800 border border-emerald-200 text-[10px] font-bold transition shadow-2xs"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowBatchModal(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={
                      loading ||
                      batchQuantity <= 0 ||
                      (batchSourceMode === 'supplier' &&
                        (!selectedPurchaseItem || batchQuantity > selectedPurchaseItem.remainingQty))
                    }
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition disabled:opacity-50"
                  >
                    {loading ? 'جاري الحفظ...' : 'تأكيد وحفظ التشغيلة بالمخزن (FIFO)'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal: Add New Product (تعريف منتج جديد) */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <PackagePlus className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-base">تعريف منتج جديد في النظام</h3>
              </div>
              <button
                onClick={() => setShowProductModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddProduct} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم المنتج</label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="مثلاً: حليب خالي الدسم 1 لتر"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">تصنيف المنتج</label>
                    <button
                      type="button"
                      onClick={() => setShowCategoriesModal(true)}
                      className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800"
                    >
                      + تصنيف جديد
                    </button>
                  </div>
                  <select
                    name="category"
                    value={productCategory}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 bg-white font-medium"
                  >
                    {categories.length === 0 ? (
                      <option value="">-- اضغط على "+ تصنيف جديد" أولاً --</option>
                    ) : (
                      categories.map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name} (صلاحية: {c.defaultShelfLifeDays} يوم)
                        </option>
                      ))
                    )}
                  </select>
                  {categories.length === 0 && (
                    <p className="text-[11px] text-amber-700 mt-1 font-medium">
                      ⚠️ يرجى إضافة تصنيف أولاً عبر الزر أعلاه
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    أيام الصلاحية الافتراضية
                  </label>
                  <input
                    type="number"
                    name="shelfLifeDays"
                    value={productShelfLife}
                    onChange={(e) => setProductShelfLife(parseInt(e.target.value, 10) || 1)}
                    min="1"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    سعر البيع للعميل (ج.م)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    name="price"
                    required
                    placeholder="35"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    سعر التكلفة (ج.م)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    name="cost"
                    required
                    placeholder="28"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الوحدة</label>
                  <input
                    type="text"
                    name="unit"
                    defaultValue="كرتونة"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition disabled:opacity-50"
                >
                  {loading ? 'جاري الحفظ...' : 'حفظ المنتج الجديد'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Manage Categories (إضافة وإلغاء تصنيفات المنتجات) */}
      {showCategoriesModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                  <Tags className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">إدارة تصنيفات المنتجات</h3>
                  <div className="text-[11px] text-slate-500">إضافة أو إلغاء وحذف أسماء التصنيفات</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCategoriesModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {catError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2 text-xs">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>{catError}</span>
              </div>
            )}

            {catSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2 text-xs font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>{catSuccess}</span>
              </div>
            )}

            {/* Existing Categories List */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-700">التصنيفات المسجلة حالياً:</div>
              <div className="max-h-52 overflow-y-auto space-y-1.5 pr-0.5">
                {categories.length === 0 ? (
                  <div className="text-xs text-slate-400 text-center py-4 bg-slate-50 rounded-xl">
                    لا توجد تصنيفات مسجلة
                  </div>
                ) : (
                  categories.map((c) => {
                    const count = productsList.filter(
                      (p) =>
                        p.category === c.name ||
                        (c.name === 'ألبان' && p.category === 'dairy') ||
                        (c.name === 'عصائر' && p.category === 'juice')
                    ).length;

                    return (
                      <div
                        key={c.id}
                        className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-100/70 transition"
                      >
                        <div>
                          <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                            <span>{c.name}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-normal">
                              صلاحية: {c.defaultShelfLifeDays} يوم
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {count} أصناف مرتبطة بهذا التصنيف
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteCategory(c.id, c.name)}
                          disabled={catLoading}
                          title="حذف التصنيف"
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition disabled:opacity-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Form to Add New Category */}
            <form onSubmit={handleCreateCategory} className="pt-3 border-t border-slate-100 space-y-3">
              <div className="text-xs font-bold text-slate-800">إضافة تصنيف جديد:</div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    اسم التصنيف (مثل: أجبان، زبادي، مياه)
                  </label>
                  <input
                    type="text"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    required
                    placeholder="اسم التصنيف..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    أيام الصلاحية
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newCatShelfLife}
                    onChange={(e) => setNewCatShelfLife(parseInt(e.target.value, 10) || 1)}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-bold text-center"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowCategoriesModal(false)}
                  className="px-3 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100"
                >
                  إغلاق
                </button>
                <button
                  type="submit"
                  disabled={catLoading || !newCatName.trim()}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  {catLoading ? (
                    'جاري الإضافة...'
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>إضافة التصنيف</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Products Directory & Management (دليل المنتجات والأصناف وحذفها) */}
      {showProductsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    دليل المنتجات والأصناف المعرفة ({productsList.length})
                  </h3>
                  <div className="text-[11px] text-slate-500">
                    استعراض جميع السلع وتكاليفها وإمكانية حذف أي صنف
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowProductsModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Bar */}
            <div className="relative shrink-0">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
              <input
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="بحث عن منتج بالاسم أو التصنيف..."
                className="w-full pr-9 pl-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>

            {/* Products Table */}
            <div className="overflow-y-auto overflow-x-auto touch-pan-x border border-slate-200 rounded-2xl flex-1 text-xs">
              <table className="w-full text-right min-w-[500px]">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="py-2.5 pr-3">اسم المنتج</th>
                    <th className="py-2.5">التصنيف</th>
                    <th className="py-2.5">سعر البيع</th>
                    <th className="py-2.5">التكلفة</th>
                    <th className="py-2.5">الصلاحية</th>
                    <th className="py-2.5 pl-3 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {productsList
                    .filter((p) => {
                      if (!productSearch.trim()) return true;
                      const q = productSearch.toLowerCase();
                      return (
                        p.name.toLowerCase().includes(q) ||
                        (p.category && p.category.toLowerCase().includes(q))
                      );
                    })
                    .map((prod) => (
                      <tr key={prod.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-2.5 pr-3 font-bold text-slate-900">{prod.name}</td>
                        <td className="py-2.5">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold text-[11px]">
                            {prod.category}
                          </span>
                        </td>
                        <td className="py-2.5 font-mono font-bold text-emerald-700">
                          {prod.price} ج.م
                        </td>
                        <td className="py-2.5 font-mono text-slate-600">
                          {prod.cost} ج.م
                        </td>
                        <td className="py-2.5 text-slate-500">
                          {prod.shelfLifeDays} يوم
                        </td>
                        <td className="py-2.5 pl-3 text-center">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setEditProduct(prod)}
                              title="تعديل السعر والبيانات"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setDeleteTarget({
                                  type: 'product',
                                  id: prod.id,
                                  name: `المنتج: ${prod.name}`,
                                })
                              }
                              title="حذف المنتج"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={() => setShowProductsModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit Product Prices & Details */}
      {editProduct && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Edit2 className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">
                  تعديل أسعار وبيانات: {editProduct.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditProduct(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateProduct} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم الصنف *</label>
                <input
                  type="text"
                  name="name"
                  required
                  defaultValue={editProduct.name}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    سعر البيع للعميل (ج.م) *
                  </label>
                  <input
                    type="number"
                    name="price"
                    step="any"
                    min={0}
                    required
                    defaultValue={editProduct.price}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-black text-emerald-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    سعر التكلفة (ج.م) *
                  </label>
                  <input
                    type="number"
                    name="cost"
                    step="any"
                    min={0}
                    required
                    defaultValue={editProduct.cost}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">التصنيف</label>
                  <input
                    type="text"
                    name="category"
                    defaultValue={editProduct.category}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الوحدة</label>
                  <input
                    type="text"
                    name="unit"
                    defaultValue={editProduct.unit}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    الصلاحية (أيام)
                  </label>
                  <input
                    type="number"
                    name="shelfLifeDays"
                    min={1}
                    defaultValue={editProduct.shelfLifeDays}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditProduct(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition"
                >
                  {loading ? 'جاري التحديث...' : 'حفظ التعديلات'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Batch Expiry & Quantity directly by Manager */}
      {editBatch && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    تعديل صلاحية وبيانات التشغيلة: {editBatch.batchNumber}
                  </h3>
                  <div className="text-[11px] text-slate-500">
                    {editBatch.product.name}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditBatch(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateBatch} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    رقم التشغيلة *
                  </label>
                  <input
                    type="text"
                    name="batchNumber"
                    required
                    defaultValue={editBatch.batchNumber}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    الكمية المتبقية بالمخزن *
                  </label>
                  <input
                    type="number"
                    name="quantity"
                    min={0}
                    required
                    defaultValue={editBatch.quantity}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-black text-emerald-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  تاريخ الإنتاج *
                </label>
                <input
                  type="datetime-local"
                  name="productionDate"
                  required
                  defaultValue={new Date(editBatch.productionDate).toISOString().slice(0, 16)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono"
                />
              </div>

              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200">
                <label className="block text-xs font-black text-emerald-950 mb-1">
                  تاريخ انتهاء الصلاحية الجديد (يحدده المدير) *
                </label>
                <input
                  type="datetime-local"
                  name="expiryDate"
                  required
                  defaultValue={new Date(editBatch.expiryDate).toISOString().slice(0, 16)}
                  className="w-full px-3 py-2 rounded-xl border-2 border-emerald-400 bg-white text-xs font-mono font-bold text-emerald-950"
                />
                <div className="text-[10px] text-emerald-700 mt-1.5 font-medium">
                  سيتم إعادة حساب الساعات المتبقية وترتيب الأولوية (FIFO) فوراً بناءً على التاريخ الذي تحدده.
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditBatch(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition"
                >
                  {loading ? 'جاري الحفظ...' : 'حفظ الصلاحية والبيانات'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Universal Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={deleteTarget !== null}
        itemName={deleteTarget?.name}
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          if (!isDeleting) setDeleteTarget(null);
        }}
      />
    </div>
  );
}
