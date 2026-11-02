'use server';

import { revalidatePath } from 'next/cache';
import { dbStore, calculateExpiry } from './store';
import { signToken, setAuthCookie, clearAuthCookie, getCurrentUser } from './auth';
import { AdvanceStatus } from '@/types';

export async function loginAction(formData: FormData) {
  const username = formData.get('username') as string;
  const password = formData.get('password') as string;

  if (!username || !password) {
    return { success: false, error: 'يرجى إدخال اسم المستخدم وكلمة المرور' };
  }

  const user = await dbStore.getUserByUsername(username);
  if (!user) {
    return { success: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' };
  }

  if (!user.isActive) {
    return { success: false, error: 'هذا الحساب معطل حالياً من قِبل الإدارة' };
  }

  // Support direct password check for demo/seeded and fallback
  if (user.password !== password) {
    return { success: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' };
  }

  const token = signToken(user);
  await setAuthCookie(token);

  return {
    success: true,
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
    },
    redirectTo: user.role === 'admin' ? '/admin' : '/rep',
  };
}

export async function logoutAction() {
  await clearAuthCookie();
  return { success: true };
}

// ----------------------------------------------------
// ADMIN: Rep Management (إدارة المناديب)
// ----------------------------------------------------
export async function createRepAction(formData: FormData) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return { success: false, error: 'غير مصرح لك بإجراء هذه العملية' };
    }

    const name = formData.get('name') as string;
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;
    const phone = (formData.get('phone') as string) || '';
    const assignedRoute = (formData.get('assignedRoute') as string) || '';

    if (!name || !username || !password) {
      return { success: false, error: 'يرجى استكمال جميع الحقول المطلوبة' };
    }

    const newRep = await dbStore.createUser({
      name: name.trim(),
      username: username.trim(),
      password: password.trim(),
      role: 'rep',
      isActive: true,
      phone: phone.trim(),
      assignedRoute: assignedRoute.trim(),
    });

    revalidatePath('/admin/reps');
    revalidatePath('/admin');
    return { success: true, message: 'تم إضافة المندوب بنجاح', user: newRep };
  } catch (err: any) {
    return { success: false, error: err.message || 'حدث خطأ أثناء إضافة المندوب' };
  }
}

export async function toggleRepStatusAction(repId: string, currentStatus: boolean) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return { success: false, error: 'غير مصرح لك بإجراء هذه العملية' };
    }

    const updatedUser = await dbStore.updateUser(repId, { isActive: !currentStatus });
    revalidatePath('/admin/reps');
    return { success: true, user: updatedUser };
  } catch (err: any) {
    return { success: false, error: err.message || 'فشل تعديل حالة الحساب' };
  }
}

export async function resetRepPasswordAction(repId: string, newPass: string) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return { success: false, error: 'غير مصرح لك بإجراء هذه العملية' };
    }

    if (!newPass || newPass.trim().length < 3) {
      return { success: false, error: 'كلمة المرور يجب أن لا تقل عن 3 أحرف أو أرقام' };
    }

    const updatedUser = await dbStore.updateUser(repId, { password: newPass.trim() });
    revalidatePath('/admin/reps');
    revalidatePath('/admin');
    return {
      success: true,
      message: `تم تحديث كلمة المرور للمندوب (${updatedUser.name}) بنجاح`,
      user: updatedUser,
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'فشل تحديث كلمة المرور' };
  }
}

export async function updateAdminPasswordAction(oldPass: string, newPass: string) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return { success: false, error: 'غير مصرح لك بتغيير كلمة مرور المدير' };
    }

    if (!oldPass) {
      return { success: false, error: 'يرجى إدخال كلمة المرور الحالية' };
    }

    if (!newPass || newPass.trim().length < 3) {
      return { success: false, error: 'كلمة المرور الجديدة يجب أن تكون 3 أحرف أو أرقام على الأقل' };
    }

    const fullUser = await dbStore.getUserById(user.id);
    if (!fullUser) {
      return { success: false, error: 'تعذر العثور على حساب المدير' };
    }

    if (fullUser.password !== oldPass) {
      return { success: false, error: 'كلمة المرور الحالية غير صحيحة' };
    }

    await dbStore.updateUser(user.id, { password: newPass.trim() });
    return { success: true, message: 'تم تغيير كلمة مرور المدير العام بنجاح!' };
  } catch (err: any) {
    return { success: false, error: err.message || 'حدث خطأ أثناء تغيير كلمة المرور' };
  }
}

// ----------------------------------------------------
// ADMIN: Inventory & Batches (FIFO)
// ----------------------------------------------------
export async function createBatchAction(formData: FormData) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return { success: false, error: 'غير مصرح لك بإجراء هذه العملية' };
    }

    const productId = ((formData.get('productId') as string) || '').trim();
    const batchNumber = ((formData.get('batchNumber') as string) || '').trim();
    const quantity = parseInt(formData.get('quantity') as string, 10);
    const productionDate = (formData.get('productionDate') as string) || new Date().toISOString();
    const expiryDate = ((formData.get('expiryDate') as string) || '').trim() || undefined;
    const purchaseId = ((formData.get('purchaseId') as string) || '').trim() || undefined;
    const purchaseItemId = ((formData.get('purchaseItemId') as string) || '').trim() || undefined;
    const unitCostRaw = formData.get('unitCost') as string;
    const unitCost = unitCostRaw !== null && unitCostRaw !== '' ? parseFloat(unitCostRaw) : undefined;

    if (!purchaseId && !productId) {
      return {
        success: false,
        error: 'يرجى اختيار الصنف المراد إضافة التشغيلة له أو تحديد فاتورة المورد',
      };
    }

    if (isNaN(quantity) || quantity <= 0) {
      return { success: false, error: 'يرجى إدخال كمية واردة صحيحة أكبر من الصفر' };
    }

    const newBatch = await dbStore.createBatch({
      productId,
      batchNumber: batchNumber || `BAT-${Date.now().toString().slice(-6)}`,
      quantity,
      productionDate,
      expiryDate,
      purchaseId,
      purchaseItemId,
      unitCost,
    });

    revalidatePath('/admin/inventory');
    revalidatePath('/admin/dispatch');
    revalidatePath('/admin/suppliers');
    revalidatePath('/admin/profit-loss');
    revalidatePath('/admin');
    return {
      success: true,
      message: purchaseId
        ? `تم تسجيل التشغيلة (${newBatch.batchNumber}) بنجاح وربطها بفاتورة المورد`
        : `تم إضافة التشغيلة المباشرة (${newBatch.batchNumber}) للمخزن الرئيسي بنجاح`,
      batch: newBatch,
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'حدث خطأ أثناء تسجيل التشغيلة' };
  }
}

export async function updateProductAction(productId: string, formData: FormData) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return { success: false, error: 'غير مصرح لك بتعديل بيانات الأصناف' };
    }

    const name = ((formData.get('name') as string) || '').trim();
    const category = ((formData.get('category') as string) || '').trim();
    const price = parseFloat(formData.get('price') as string);
    const cost = parseFloat(formData.get('cost') as string);
    const unit = ((formData.get('unit') as string) || '').trim();
    const shelfLifeDays = parseInt(formData.get('shelfLifeDays') as string, 10);

    if (!name) {
      return { success: false, error: 'يرجى إدخال اسم الصنف' };
    }
    if (isNaN(price) || price < 0 || isNaN(cost) || cost < 0) {
      return { success: false, error: 'يرجى التأكد من صحة سعر البيع وسعر التكلفة' };
    }

    const updated = await dbStore.updateProduct(productId, {
      name,
      category: category || undefined,
      price,
      cost,
      unit: unit || undefined,
      shelfLifeDays: !isNaN(shelfLifeDays) && shelfLifeDays > 0 ? shelfLifeDays : undefined,
    });

    revalidatePath('/admin/inventory');
    revalidatePath('/admin/dispatch');
    revalidatePath('/admin/profit-loss');
    revalidatePath('/admin');
    return {
      success: true,
      message: `تم تحديث بيانات وأسعار الصنف "${updated.name}" بنجاح`,
      product: updated,
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'فشل تحديث بيانات الصنف' };
  }
}

export async function updateBatchAction(batchId: string, formData: FormData) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return { success: false, error: 'غير مصرح لك بتعديل صلاحية أو بيانات التشغيلات' };
    }

    const batchNumber = ((formData.get('batchNumber') as string) || '').trim();
    const expiryDate = ((formData.get('expiryDate') as string) || '').trim();
    const productionDate = ((formData.get('productionDate') as string) || '').trim();
    const quantityRaw = formData.get('quantity') as string;
    const quantity =
      quantityRaw !== null && quantityRaw !== '' ? parseInt(quantityRaw, 10) : undefined;

    if (!expiryDate) {
      return { success: false, error: 'يرجى تحديد تاريخ انتهاء الصلاحية للتشغيلة' };
    }

    const updated = await dbStore.updateBatch(batchId, {
      batchNumber: batchNumber || undefined,
      expiryDate,
      productionDate: productionDate || undefined,
      quantity: quantity !== undefined && !isNaN(quantity) ? quantity : undefined,
    });

    revalidatePath('/admin/inventory');
    revalidatePath('/admin/dispatch');
    revalidatePath('/admin');
    return {
      success: true,
      message: `تم تحديث تاريخ الصلاحية وبيانات التشغيلة (${updated.batchNumber}) بنجاح`,
      batch: updated,
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'فشل تحديث بيانات التشغيلة' };
  }
}

export async function createProductAction(formData: FormData) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return { success: false, error: 'غير مصرح لك بإجراء هذه العملية' };
    }

    const name = ((formData.get('name') as string) || '').trim();
    const category = ((formData.get('category') as string) || 'ألبان').trim();
    const shelfLifeDays = parseInt(formData.get('shelfLifeDays') as string, 10) || (category.includes('لبن') || category === 'dairy' ? 1 : 7);
    const price = parseFloat(formData.get('price') as string);
    const cost = parseFloat(formData.get('cost') as string);
    const unit = ((formData.get('unit') as string) || 'كرتونة').trim();

    if (!name) {
      return { success: false, error: 'يرجى إدخال اسم الصنف أو المنتج' };
    }

    if (isNaN(price) || price < 0 || isNaN(cost) || cost < 0) {
      return { success: false, error: 'يرجى التحقق من صحة أسعار البيع والتكلفة' };
    }

    const newProduct = await dbStore.createProduct({
      name,
      category,
      shelfLifeDays,
      price,
      cost,
      unit,
    });

    revalidatePath('/admin/inventory');
    revalidatePath('/admin');
    return { success: true, message: `تم إضافة الصنف "${newProduct.name}" بنجاح`, product: newProduct };
  } catch (err: any) {
    return { success: false, error: err.message || 'حدث خطأ أثناء إضافة الصنف' };
  }
}

export async function createProductAndBatchAction(formData: FormData) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return { success: false, error: 'غير مصرح لك بإجراء هذه العملية' };
    }

    const productName = ((formData.get('name') as string) || '').trim();
    const category = ((formData.get('category') as string) || '').trim();
    const shelfLifeDays = parseInt(formData.get('shelfLifeDays') as string, 10) || 1;
    const price = parseFloat(formData.get('price') as string) || 0;
    const cost = parseFloat(formData.get('cost') as string) || 0;
    const unit = ((formData.get('unit') as string) || 'كرتونة').trim();

    const batchNumber = ((formData.get('batchNumber') as string) || '').trim();
    const quantity = parseInt(formData.get('quantity') as string, 10);
    const productionDate = (formData.get('productionDate') as string) || new Date().toISOString();
    const expiryDate = ((formData.get('expiryDate') as string) || '').trim() || undefined;

    if (!productName) {
      return { success: false, error: 'يرجى كتابة اسم الصنف أو المنتج الوارد' };
    }

    if (!category) {
      return { success: false, error: 'يرجى اختيار أو تحديد تصنيف للمنتج' };
    }

    if (isNaN(quantity) || quantity <= 0) {
      return { success: false, error: 'يرجى إدخال كمية واردة صحيحة أكبر من الصفر' };
    }

    // 1. Create product
    const newProduct = await dbStore.createProduct({
      name: productName,
      category,
      shelfLifeDays,
      price,
      cost,
      unit,
    });

    // 2. Create batch linked to this product
    const newBatch = await dbStore.createBatch({
      productId: newProduct.id,
      batchNumber: batchNumber || `BAT-${Date.now().toString().slice(-6)}`,
      quantity,
      productionDate,
      expiryDate,
    });

    revalidatePath('/admin/inventory');
    revalidatePath('/admin');

    return {
      success: true,
      message: `تم تعريف الصنف "${newProduct.name}" وتسجيل تشغيلته (${newBatch.batchNumber}) بنجاح!`,
      product: newProduct,
      batch: newBatch,
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'حدث خطأ أثناء حفظ الصنف والتشغيلة' };
  }
}

export async function createCategoryAction(formData: FormData) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return { success: false, error: 'غير مصرح لك بإضافة تصنيفات' };
    }

    const name = (formData.get('name') as string)?.trim();
    const defaultShelfLifeDays = parseInt(formData.get('defaultShelfLifeDays') as string, 10) || 1;

    if (!name) {
      return { success: false, error: 'يرجى إدخال اسم التصنيف' };
    }

    const newCategory = await dbStore.createCategory(name, defaultShelfLifeDays);
    revalidatePath('/admin/inventory');
    return { success: true, category: newCategory, message: `تمت إضافة التصنيف "${name}" بنجاح` };
  } catch (err: any) {
    return { success: false, error: err.message || 'فشل إضافة التصنيف' };
  }
}

export async function deleteCategoryAction(categoryId: string) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return { success: false, error: 'غير مصرح لك بحذف التصنيفات' };
    }

    if (!categoryId) {
      return { success: false, error: 'معرّف التصنيف غير محدد' };
    }

    await dbStore.deleteCategory(categoryId);
    revalidatePath('/admin/inventory');
    return { success: true, message: 'تم حذف التصنيف بنجاح' };
  } catch (err: any) {
    return { success: false, error: err.message || 'فشل حذف التصنيف' };
  }
}

// ----------------------------------------------------
// ADMIN: Dispatch to Rep Van (تحويل العهدة للسيارة)
// ----------------------------------------------------
export async function dispatchStockAction(repId: string, batchId: string, quantity: number) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return { success: false, error: 'غير مصرح' };
    }

    if (!repId || !batchId || quantity <= 0) {
      return { success: false, error: 'بيانات التحويل غير مكتملة' };
    }

    const result = await dbStore.dispatchStockToRep({
      repId,
      batchId,
      quantity,
    });

    revalidatePath('/admin/dispatch');
    revalidatePath('/admin/inventory');
    revalidatePath('/admin');
    revalidatePath('/rep');
    return { success: true, message: result.message };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ----------------------------------------------------
// REP: Mobile POS - Create Invoice (إصدار فاتورة)
// ----------------------------------------------------
export async function createInvoiceAction(data: {
  clientId: string;
  paymentType: 'cash' | 'credit';
  paidAmount?: number;
  discount?: number;
  notes?: string;
  items: {
    productId: string;
    quantity: number;
  }[];
  returns?: {
    productId: string;
    quantity?: number;
    amount?: number;
    reason: 'expired' | 'damaged';
    unitPrice?: number;
    notes?: string;
  }[];
}) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'انتهت الجلسة، يرجى تسجيل الدخول' };
    }

    const invoice = await dbStore.createInvoice({
      repId: user.id,
      clientId: data.clientId,
      paymentType: data.paymentType,
      paidAmount: data.paidAmount,
      discount: data.discount,
      notes: data.notes,
      items: data.items,
      returns: data.returns,
    });

    revalidatePath('/rep');
    revalidatePath('/rep/summary');
    revalidatePath('/rep/returns');
    revalidatePath('/admin');
    revalidatePath('/admin/invoices');
    revalidatePath('/admin/settlements');

    return { success: true, invoice };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ----------------------------------------------------
// REP: Returns & Collections (المرتجعات والتحصيلات)
// ----------------------------------------------------
export async function createReturnAction(data: {
  productId: string;
  quantity?: number;
  amount?: number;
  reason: 'expired' | 'damaged';
  notes?: string;
}) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'يرجى تسجيل الدخول' };

    await dbStore.createReturn({
      repId: user.id,
      productId: data.productId,
      quantity: data.quantity ?? 1,
      amount: data.amount,
      reason: data.reason,
      notes: data.notes,
    });

    revalidatePath('/rep/returns');
    revalidatePath('/rep/summary');
    revalidatePath('/admin');
    return { success: true, message: 'تم تسجيل المرتجع بنجاح' };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function createCollectionAction(data: {
  clientId: string;
  amount: number;
  notes?: string;
}) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'يرجى تسجيل الدخول' };

    await dbStore.createCollection({
      repId: user.id,
      clientId: data.clientId,
      amount: data.amount,
      notes: data.notes,
    });

    revalidatePath('/rep/collections');
    revalidatePath('/rep/summary');
    revalidatePath('/admin');
    return { success: true, message: 'تم تسجيل التحصيل النقدي بنجاح وتحديث حساب العميل' };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function createClientAction(formData: FormData) {
  try {
    const name = (formData.get('name') as string)?.trim();
    const phone = (formData.get('phone') as string)?.trim() || '';
    const address = (formData.get('address') as string)?.trim() || '';
    const initialCredit = parseFloat(formData.get('creditBalance') as string) || 0;

    if (!name) return { success: false, error: 'اسم المنفذ أو السوبرماركت إجباري ومطلوب' };

    const client = await dbStore.createClient({
      name,
      phone,
      address,
      creditBalance: initialCredit,
    });

    revalidatePath('/admin/clients');
    revalidatePath('/admin');
    revalidatePath('/rep/new-invoice');
    return { success: true, client, message: 'تم إضافة المنفذ بنجاح' };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateClientAction(id: string, formData: FormData) {
  try {
    const name = (formData.get('name') as string)?.trim();
    const phone = (formData.get('phone') as string)?.trim() || '';
    const address = (formData.get('address') as string)?.trim() || '';

    if (!name) return { success: false, error: 'اسم المنفذ مطلوب' };

    await dbStore.updateClient(id, { name, phone, address });

    revalidatePath('/admin/clients');
    revalidatePath('/admin');
    revalidatePath('/rep/new-invoice');
    return { success: true, message: 'تم تحديث بيانات المنفذ بنجاح' };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteClientAction(id: string) {
  try {
    await dbStore.deleteClient(id);
    revalidatePath('/admin/clients');
    revalidatePath('/admin');
    revalidatePath('/rep/new-invoice');
    return { success: true, message: 'تم حذف المنفذ بنجاح' };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ----------------------------------------------------
// ADMIN: End-of-Day Settlement (تسوية نهاية اليوم)
// ----------------------------------------------------
export async function saveSettlementAction(data: {
  repId: string;
  actualCash: number;
  stockDiscrepancies?: string;
  notes?: string;
}) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return { success: false, error: 'غير مصرح' };
    }

    const settlement = await dbStore.saveSettlement(data);

    revalidatePath('/admin/settlements');
    revalidatePath('/admin');
    return { success: true, settlement };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ----------------------------------------------------
// REP & ADMIN: Cash Advances (سلف المناديب)
// ----------------------------------------------------
export async function createAdvanceRequestAction(formData: FormData) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'يرجى تسجيل الدخول أولاً' };
    }

    const amount = parseFloat(formData.get('amount') as string);
    const reason = ((formData.get('reason') as string) || '').trim();

    if (isNaN(amount) || amount <= 0) {
      return { success: false, error: 'يرجى إدخال مبلغ سلفة صحيح أكبر من الصفر' };
    }

    if (!reason) {
      return { success: false, error: 'يرجى كتابة سبب طلب السلفة' };
    }

    const advance = await dbStore.createAdvanceRequest({
      repId: user.id,
      amount,
      reason,
    });

    revalidatePath('/rep/advances');
    revalidatePath('/rep');
    revalidatePath('/admin/advances');
    revalidatePath('/admin');

    return {
      success: true,
      message: 'تم إرسال طلب السلفة إلى الإدارة بنجاح، بانتظار المراجعة والاعتماد',
      advance,
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'فشل إرسال طلب السلفة' };
  }
}

export async function updateAdvanceStatusAction(
  id: string,
  status: AdvanceStatus,
  managerNotes?: string
) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return { success: false, error: 'غير مصرح لك بإجراء هذه العملية' };
    }

    const updated = await dbStore.updateAdvanceStatus(id, status, managerNotes);

    revalidatePath('/admin/advances');
    revalidatePath('/admin');
    revalidatePath('/rep/advances');
    revalidatePath('/rep');

    const statusText = status === 'approved' ? 'الموافقة على السلفة' : status === 'rejected' ? 'رفض السلفة' : 'تحديث الطلب';
    return {
      success: true,
      message: `تم ${statusText} بنجاح`,
      advance: updated,
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'فشل تحديث حالة السلفة' };
  }
}

// ----------------------------------------------------
// ADMIN: Suppliers & Central Warehouse Purchases (الموردين والمخزن الرئيسي)
// ----------------------------------------------------
export async function createSupplierAction(formData: FormData) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return { success: false, error: 'غير مصرح لك بإجراء هذه العملية' };
    }

    const name = ((formData.get('name') as string) || '').trim();
    const phone = ((formData.get('phone') as string) || '').trim();
    const address = ((formData.get('address') as string) || '').trim();
    const initialDue = parseFloat(formData.get('initialDue') as string) || 0;

    if (!name) {
      return { success: false, error: 'يرجى إدخال اسم المورد أو الشركة' };
    }

    const supplier = await dbStore.createSupplier({
      name,
      phone,
      address,
      initialDue,
    });

    revalidatePath('/admin/suppliers');
    revalidatePath('/admin');
    return { success: true, message: `تم إضافة المورد "${name}" بنجاح`, supplier };
  } catch (err: any) {
    return { success: false, error: err.message || 'حدث خطأ أثناء إضافة المورد' };
  }
}

export async function updateSupplierAction(
  supplierId: string,
  formData: FormData
) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return { success: false, error: 'غير مصرح لك بإجراء هذه العملية' };
    }

    const name = ((formData.get('name') as string) || '').trim();
    const phone = ((formData.get('phone') as string) || '').trim();
    const address = ((formData.get('address') as string) || '').trim();

    if (!name) {
      return { success: false, error: 'اسم المورد مطلوب' };
    }

    const updated = await dbStore.updateSupplier(supplierId, {
      name,
      phone,
      address,
    });

    revalidatePath('/admin/suppliers');
    revalidatePath('/admin');
    return { success: true, message: 'تم تحديث بيانات المورد بنجاح', supplier: updated };
  } catch (err: any) {
    return { success: false, error: err.message || 'فشل تحديث بيانات المورد' };
  }
}

export async function recordSupplierPaymentAction(formData: FormData) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return { success: false, error: 'غير مصرح لك بإجراء هذه العملية' };
    }

    const supplierId = formData.get('supplierId') as string;
    const amount = parseFloat(formData.get('amount') as string);
    const notes = ((formData.get('notes') as string) || '').trim();

    if (!supplierId) {
      return { success: false, error: 'يرجى تحديد المورد' };
    }

    if (isNaN(amount) || amount <= 0) {
      return { success: false, error: 'يرجى إدخال مبلغ سداد صحيح أكبر من الصفر' };
    }

    const payment = await dbStore.recordSupplierPayment({
      supplierId,
      amount,
      notes,
    });

    revalidatePath('/admin/suppliers');
    revalidatePath('/admin/profit-loss');
    revalidatePath('/admin');
    return {
      success: true,
      message: `تم تسجيل سداد مبلغ ${amount} ج.م للمورد وخصمها من الرصيد المستحق بنجاح`,
      payment,
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'فشل تسجيل الدفعة' };
  }
}

export async function createSupplierPurchaseAction(data: {
  supplierId: string;
  paymentType: 'cash' | 'credit';
  paidAmount?: number;
  notes?: string;
  autoReceiveBatches?: boolean;
  items: {
    productId: string;
    quantity: number;
    unitCost: number;
    productionDate: string;
    expiryDate?: string;
  }[];
}) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return { success: false, error: 'غير مصرح لك بإجراء هذه العملية' };
    }

    if (!data.supplierId) {
      return { success: false, error: 'يرجى اختيار المورد أولاً' };
    }

    if (!data.items || data.items.length === 0) {
      return { success: false, error: 'يرجى إضافة صنف واحد على الأقل للفاتورة' };
    }

    const purchase = await dbStore.createSupplierPurchase(data);

    revalidatePath('/admin/suppliers');
    revalidatePath('/admin/inventory');
    revalidatePath('/admin/dispatch');
    revalidatePath('/admin/profit-loss');
    revalidatePath('/admin');

    return {
      success: true,
      message: `تم تسجيل فاتورة الشراء (${purchase.purchaseNumber}) وإيداع البضاعة بالمخزن الرئيسي بنجاح (FIFO)`,
      purchase,
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'حدث خطأ أثناء تسجيل فاتورة الشراء' };
  }
}

// ----------------------------------------------------
// ADMIN: Employee & Payroll Management (شؤون الموظفين والمرتبات)
// ----------------------------------------------------
export async function createEmployeeAction(formData: FormData) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return { success: false, error: 'غير مصرح لك بإجراء هذه العملية' };
    }

    const name = (formData.get('name') as string)?.trim();
    const phone = (formData.get('phone') as string)?.trim() || '';
    const role = (formData.get('role') as string)?.trim();
    const baseSalary = parseFloat(formData.get('baseSalary') as string) || 0;

    if (!name) {
      return { success: false, error: 'يرجى إدخال اسم الموظف' };
    }

    if (!role) {
      return { success: false, error: 'يرجى تحديد المسمى الوظيفي للموظف' };
    }

    const employee = await dbStore.createEmployee({
      name,
      phone,
      role,
      baseSalary,
    });

    revalidatePath('/admin/employees');
    revalidatePath('/admin/profit-loss');
    revalidatePath('/admin');

    return {
      success: true,
      message: `تمت إضافة الموظف ${employee.name} بنجاح`,
      employee,
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'فشلت إضافة الموظف' };
  }
}

export async function updateEmployeeAction(formData: FormData) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return { success: false, error: 'غير مصرح لك بإجراء هذه العملية' };
    }

    const id = formData.get('id') as string;
    const name = (formData.get('name') as string)?.trim();
    const phone = (formData.get('phone') as string)?.trim() || '';
    const role = (formData.get('role') as string)?.trim();
    const baseSalary = parseFloat(formData.get('baseSalary') as string);

    if (!id) {
      return { success: false, error: 'معرف الموظف غير موجود' };
    }

    if (!name) {
      return { success: false, error: 'يرجى إدخال اسم الموظف' };
    }

    if (!role) {
      return { success: false, error: 'يرجى تحديد المسمى الوظيفي' };
    }

    const employee = await dbStore.updateEmployee(id, {
      name,
      phone,
      role,
      baseSalary: isNaN(baseSalary) ? 0 : baseSalary,
    });

    revalidatePath('/admin/employees');
    revalidatePath('/admin/profit-loss');
    revalidatePath('/admin');

    return {
      success: true,
      message: `تم تعديل بيانات الموظف ${employee.name} بنجاح`,
      employee,
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'فشل تعديل بيانات الموظف' };
  }
}

export async function deleteEmployeeAction(id: string) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return { success: false, error: 'غير مصرح لك بإجراء هذه العملية' };
    }

    if (!id) {
      return { success: false, error: 'معرف الموظف غير صحيح' };
    }

    const ok = await dbStore.deleteEmployee(id);
    if (!ok) {
      return { success: false, error: 'لم يتم العثور على الموظف أو فشل الحذف' };
    }

    revalidatePath('/admin/employees');
    revalidatePath('/admin/profit-loss');
    revalidatePath('/admin');

    return {
      success: true,
      message: 'تم حذف الموظف بنجاح',
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'فشل حذف الموظف' };
  }
}

export async function recordPayrollPaymentAction(formData: FormData) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return { success: false, error: 'غير مصرح لك بإجراء هذه العملية' };
    }

    const employeeId = formData.get('employeeId') as string;
    const amount = parseFloat(formData.get('amount') as string);
    const month = (formData.get('month') as string)?.trim();
    const notes = ((formData.get('notes') as string) || '').trim();
    const paymentDate = (formData.get('paymentDate') as string) || new Date().toISOString();

    if (!employeeId) {
      return { success: false, error: 'يرجى اختيار الموظف المستحق للصرف' };
    }

    if (isNaN(amount) || amount <= 0) {
      return { success: false, error: 'يرجى إدخال مبلغ صحيح للصرف أكبر من الصفر' };
    }

    if (!month) {
      return { success: false, error: 'يرجى تحديد الشهر المستحق للصرف' };
    }

    const payment = await dbStore.recordPayrollPayment({
      employeeId,
      amount,
      month,
      paymentDate,
      notes,
    });

    revalidatePath('/admin/employees');
    revalidatePath('/admin/profit-loss');
    revalidatePath('/admin');

    return {
      success: true,
      message: `تم تسجيل صرف راتب/سلفة بمبلغ ${amount} ج.م بنجاح وخصمها من أرباح الشركة`,
      payment,
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'فشل تسجيل صرف الراتب' };
  }
}

// ----------------------------------------------------
// ADMIN: Rep Monthly Target Management (تحديد تارجت المندوب شهرياً)
// ----------------------------------------------------
export async function setRepTargetAction(formData: FormData) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return { success: false, error: 'غير مصرح لك بإجراء هذه العملية' };
    }

    const repId = (formData.get('repId') as string)?.trim();
    const month = (formData.get('month') as string)?.trim();
    const targetAmount = parseFloat(formData.get('targetAmount') as string) || 0;
    const notes = ((formData.get('notes') as string) || '').trim();

    if (!repId) {
      return { success: false, error: 'يرجى اختيار المندوب' };
    }

    if (!month) {
      return { success: false, error: 'يرجى تحديد الشهر المستهدف للتارجت' };
    }

    if (isNaN(targetAmount) || targetAmount < 0) {
      return { success: false, error: 'يرجى إدخال مبلغ تارجت صحيح' };
    }

    const target = await dbStore.setRepTarget({
      repId,
      month,
      targetAmount,
      notes,
    });

    revalidatePath('/admin/reps');
    revalidatePath(`/admin/reps/${repId}`);
    revalidatePath('/admin');

    return {
      success: true,
      message: `تم حفظ تارجت المندوب لشهر (${month}) بمبلغ ${targetAmount.toLocaleString('ar-EG')} ج.م بنجاح`,
      target,
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'فشل حفظ تارجت المندوب' };
  }
}

// -------------------------------------------------------------
// UNIVERSAL ADMIN DELETE ACTIONS (خاصية الحذف الشامل للمدير)
// -------------------------------------------------------------

export async function deleteProductAction(productId: string) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return { success: false, error: 'غير مصرح لك بإجراء هذه العملية' };
    }

    await dbStore.deleteProduct(productId);

    revalidatePath('/admin/inventory');
    revalidatePath('/admin/profit-loss');
    revalidatePath('/admin');

    return { success: true, message: 'تم حذف الصنف وتشغيلاته بنجاح' };
  } catch (err: any) {
    return { success: false, error: err.message || 'فشل حذف الصنف' };
  }
}

export async function deleteBatchAction(batchId: string) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return { success: false, error: 'غير مصرح لك بإجراء هذه العملية' };
    }

    await dbStore.deleteBatch(batchId);

    revalidatePath('/admin/inventory');
    revalidatePath('/admin/profit-loss');
    revalidatePath('/admin');

    return { success: true, message: 'تم حذف التشغيلة من المخزن بنجاح' };
  } catch (err: any) {
    return { success: false, error: err.message || 'فشل حذف التشغيلة' };
  }
}

export async function deleteSupplierAction(supplierId: string) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return { success: false, error: 'غير مصرح لك بإجراء هذه العملية' };
    }

    await dbStore.deleteSupplier(supplierId);

    revalidatePath('/admin/suppliers');
    revalidatePath('/admin/inventory');
    revalidatePath('/admin/profit-loss');
    revalidatePath('/admin');

    return { success: true, message: 'تم حذف المورد بنجاح' };
  } catch (err: any) {
    return { success: false, error: err.message || 'فشل حذف المورد' };
  }
}

export async function deleteSupplierPurchaseAction(purchaseId: string) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return { success: false, error: 'غير مصرح لك بإجراء هذه العملية' };
    }

    await dbStore.deleteSupplierPurchase(purchaseId);

    revalidatePath('/admin/suppliers');
    revalidatePath('/admin/inventory');
    revalidatePath('/admin/profit-loss');
    revalidatePath('/admin');

    return { success: true, message: 'تم حذف فاتورة الشراء وتحديث الحسابات بنجاح' };
  } catch (err: any) {
    return { success: false, error: err.message || 'فشل حذف فاتورة الشراء' };
  }
}

export async function deleteInvoiceAction(invoiceId: string) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return { success: false, error: 'غير مصرح لك بإجراء هذه العملية' };
    }

    await dbStore.deleteInvoice(invoiceId);

    revalidatePath('/admin/invoices');
    revalidatePath('/admin/clients');
    revalidatePath('/admin/profit-loss');
    revalidatePath('/admin');

    return { success: true, message: 'تم حذف الفاتورة وتحديث الأرصدة بنجاح' };
  } catch (err: any) {
    return { success: false, error: err.message || 'فشل حذف الفاتورة' };
  }
}

export async function deletePayrollPaymentAction(paymentId: string) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return { success: false, error: 'غير مصرح لك بإجراء هذه العملية' };
    }

    await dbStore.deletePayrollPayment(paymentId);

    revalidatePath('/admin/employees');
    revalidatePath('/admin/profit-loss');
    revalidatePath('/admin');

    return { success: true, message: 'تم حذف دفعة الراتب بنجاح' };
  } catch (err: any) {
    return { success: false, error: err.message || 'فشل حذف دفعة الراتب' };
  }
}

export async function deleteAdvanceAction(advanceId: string) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return { success: false, error: 'غير مصرح لك بإجراء هذه العملية' };
    }

    await dbStore.deleteAdvance(advanceId);

    revalidatePath('/admin/advances');
    revalidatePath('/admin/reps');
    revalidatePath('/admin/profit-loss');
    revalidatePath('/admin');

    return { success: true, message: 'تم حذف طلب السلفة بنجاح' };
  } catch (err: any) {
    return { success: false, error: err.message || 'فشل حذف طلب السلفة' };
  }
}

export async function deleteSettlementAction(settlementId: string) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return { success: false, error: 'غير مصرح لك بإجراء هذه العملية' };
    }

    if (!settlementId) {
      return { success: false, error: 'معرف التسوية غير محدد' };
    }

    await dbStore.deleteSettlement(settlementId);

    revalidatePath('/admin/settlements');
    revalidatePath('/admin/reps');
    revalidatePath('/admin');

    return { success: true, message: 'تم حذف سجل التسوية بنجاح' };
  } catch (err: any) {
    return { success: false, error: err.message || 'فشل حذف سجل التسوية' };
  }
}

// ----------------------------------------------------
// ADMIN: System Backup & Secure Database Wipe (النسخ الاحتياطي ومسح البيانات)
// ----------------------------------------------------
export async function wipeDatabaseAction(formData: FormData) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return { success: false, error: 'غير مصرح لك بإجراء هذه العملية الحساسة' };
    }

    const password = (formData.get('password') as string) || '';
    const mode = ((formData.get('mode') as string) || 'transactions_only') as 'all' | 'transactions_only';

    if (!password) {
      return { success: false, error: 'يرجى إدخال كلمة مرور المدير العام الحالية لتأكيد الإجراء' };
    }

    const res = await dbStore.wipeDatabase({
      mode,
      adminPasswordConfirm: password,
      adminUsername: user.username,
    });

    // Revalidate all operational pages
    const paths = [
      '/',
      '/admin',
      '/admin/invoices',
      '/admin/inventory',
      '/admin/dispatch',
      '/admin/suppliers',
      '/admin/profit-loss',
      '/admin/clients',
      '/admin/reps',
      '/admin/settlements',
      '/admin/advances',
      '/admin/employees',
      '/admin/analytics',
      '/admin/settings',
    ];

    paths.forEach((p) => {
      try {
        revalidatePath(p);
      } catch {}
    });

    return {
      success: true,
      message: res.message,
      mode: res.mode,
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'حدث خطأ أثناء تنفيذ عملية مسح البيانات' };
  }
}

export async function getDatabaseStatsAction() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return { success: false, error: 'غير مصرح لك بعرض هذه البيانات' };
    }

    const stats = await dbStore.getDatabaseStats();
    return { success: true, stats };
  } catch (err: any) {
    return { success: false, error: err.message || 'فشل جلب إحصائيات النظام' };
  }
}

export async function returnStockFromRepAction(
  repId: string,
  batchId: string,
  quantity: number
) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return { success: false, error: 'غير مصرح لك بإرجاع العهدة للمخزن' };
    }

    const res = await dbStore.returnStockFromRepToWarehouse({
      repId,
      batchId,
      quantity: Number(quantity),
    });

    revalidatePath('/admin/dispatch');
    revalidatePath('/admin/inventory');
    revalidatePath('/admin/reps');
    revalidatePath('/admin/settlements');
    revalidatePath('/admin');

    return { success: true, message: res.message, error: undefined };
  } catch (err: any) {
    return { success: false, error: err.message || 'فشل إرجاع البضاعة من السيارة للمخزن', message: undefined };
  }
}

export async function createDirectWarehouseInvoiceAction(data: {
  clientId: string;
  paymentType: 'cash' | 'credit';
  paidAmount?: number;
  discount?: number;
  notes?: string;
  items: { productId: string; quantity: number }[];
}) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return { success: false, error: 'غير مصرح لك بإصدار فاتورة بيع مباشر من المخزن' };
    }

    const invoice = await dbStore.createDirectWarehouseInvoice({
      adminId: user.id,
      ...data,
    });

    revalidatePath('/admin');
    revalidatePath('/admin/invoices');
    revalidatePath('/admin/inventory');
    revalidatePath('/admin/clients');
    revalidatePath('/admin/profit-loss');

    return {
      success: true,
      message: `تم إصدار فاتورة البيع المباشر (${invoice.invoiceNumber}) من المخزن الرئيسي بنجاح!`,
      invoice,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'حدث خطأ أثناء إصدار فاتورة البيع المباشر من المخزن',
    };
  }
}

export async function adminRecordCollectionAction(formData: FormData) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return { success: false, error: 'غير مصرح لك بتسجيل التحصيل' };
    }

    const clientId = ((formData.get('clientId') as string) || '').trim();
    const amount = parseFloat(formData.get('amount') as string);
    const notes = ((formData.get('notes') as string) || '').trim();

    if (!clientId) {
      return { success: false, error: 'يرجى تحديد العميل المراد التحصيل منه' };
    }
    if (isNaN(amount) || amount <= 0) {
      return { success: false, error: 'يرجى إدخال مبلغ تحصيل صحيح أكبر من الصفر' };
    }

    const col = await dbStore.createCollection({
      repId: user.id,
      clientId,
      amount,
      notes: notes ? `[تحصيل مباشر للإدارة] ${notes}` : '[تحصيل مباشر للإدارة]',
    });

    revalidatePath('/admin');
    revalidatePath('/admin/clients');
    revalidatePath('/admin/invoices');
    revalidatePath('/admin/profit-loss');

    return {
      success: true,
      message: `تم تحصيل مبلغ ${amount.toLocaleString('ar-EG')} ج.م وإيداعه في الخزينة بنجاح!`,
      collection: col,
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'فشل تسجيل عملية التحصيل' };
  }
}

export async function restoreBackupAction(jsonString: string) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return { success: false, error: 'غير مصرح لك باسترجاع النسخة الاحتياطية' };
    }

    let parsed: any;
    try {
      parsed = JSON.parse(jsonString);
    } catch {
      return { success: false, error: 'صيغة ملف النسخة الاحتياطية (JSON) غير صالحة' };
    }

    const res = await dbStore.restoreBackup(parsed);

    const paths = [
      '/',
      '/admin',
      '/admin/invoices',
      '/admin/inventory',
      '/admin/dispatch',
      '/admin/suppliers',
      '/admin/profit-loss',
      '/admin/clients',
      '/admin/reps',
      '/admin/settlements',
      '/admin/advances',
      '/admin/employees',
      '/admin/analytics',
      '/admin/settings',
    ];
    paths.forEach((p) => {
      try {
        revalidatePath(p);
      } catch {}
    });

    return { success: true, message: res.message, error: undefined };
  } catch (err: any) {
    return { success: false, error: err.message || 'فشل استرجاع النسخة الاحتياطية', message: undefined };
  }
}

export async function seedDemoDataAction() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return { success: false, error: 'غير مصرح لك بإجراء هذه العملية', message: undefined };
    }

    const res = await dbStore.seedDemoData();

    const paths = [
      '/',
      '/admin',
      '/admin/invoices',
      '/admin/inventory',
      '/admin/dispatch',
      '/admin/suppliers',
      '/admin/profit-loss',
      '/admin/clients',
      '/admin/reps',
      '/admin/settlements',
      '/admin/advances',
      '/admin/employees',
      '/admin/analytics',
      '/admin/settings',
      '/rep',
    ];
    paths.forEach((p) => {
      try {
        revalidatePath(p);
      } catch {}
    });

    return { success: true, message: res.message, error: undefined };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'حدث خطأ أثناء تحميل البيانات التجريبية',
      message: undefined,
    };
  }
}




