import fs from 'fs';
import path from 'path';
import {
  User,
  Product,
  InventoryBatch,
  RepInventory,
  Client,
  Invoice,
  InvoiceItem,
  ReturnItem,
  Collection,
  Settlement,
  BatchStatus,
  Category,
  AdvanceRequest,
  AdvanceStatus,
  InvoiceReturnItem,
  Supplier,
  SupplierPurchase,
  SupplierPurchaseItem,
  SupplierPayment,
  Employee,
  PayrollPayment,
  ProfitLossSummary,
  TreasurySummary,
  ComprehensiveProfitLossData,
  RepTarget,
  RepMonthlyPerformance,
} from '@/types';

interface DatabaseSchema {
  users: User[];
  categories: Category[];
  products: Product[];
  batches: InventoryBatch[];
  repInventory: RepInventory[];
  clients: Client[];
  invoices: Invoice[];
  returns: ReturnItem[];
  collections: Collection[];
  settlements: Settlement[];
  advances: AdvanceRequest[];
  suppliers: Supplier[];
  supplierPurchases: SupplierPurchase[];
  supplierPurchaseItems: SupplierPurchaseItem[];
  supplierPayments: SupplierPayment[];
  employees: Employee[];
  payrollPayments: PayrollPayment[];
  repTargets: RepTarget[];
}

function getDbFilePath(): string {
  if (process.env.VERCEL) {
    return path.join('/tmp', 'al_waseet_db.json');
  }
  return path.join(process.cwd(), 'data', 'al_waseet_db.json');
}

// Helper to calculate expiry date based on shelf life
export function calculateExpiry(productionDateStr: string, shelfLifeDays: number): string {
  const prodDate = new Date(productionDateStr);
  const expDate = new Date(prodDate.getTime() + shelfLifeDays * 24 * 60 * 60 * 1000);
  return expDate.toISOString();
}

// Helper to determine status based on expiry date
export function determineBatchStatus(expiryDateStr: string, remainingQty: number): BatchStatus {
  if (remainingQty <= 0) return 'depleted';
  const now = new Date().getTime();
  const exp = new Date(expiryDateStr).getTime();
  const diffHours = (exp - now) / (1000 * 60 * 60);

  if (diffHours < 0) return 'expired';
  if (diffHours <= 48) return 'expiring_soon';
  return 'active';
}

function getInitialData(): DatabaseSchema {
  const users: User[] = [
    {
      id: 'usr_admin',
      name: 'المدير العام (مسؤول النظام)',
      username: 'admin',
      password: '123',
      role: 'admin',
      isActive: true,
      phone: '01000000001',
      assignedRoute: 'المركز الرئيسي - الإدارة العامة',
      createdAt: new Date().toISOString(),
    },
  ];

  return {
    users,
    categories: [],
    products: [],
    batches: [],
    repInventory: [],
    clients: [],
    invoices: [],
    returns: [],
    collections: [],
    settlements: [],
    advances: [],
    suppliers: [],
    supplierPurchases: [],
    supplierPurchaseItems: [],
    supplierPayments: [],
    employees: [],
    payrollPayments: [],
    repTargets: [],
  };
}

const globalForPrisma = globalThis as unknown as {
  prisma: any | undefined;
};

function getPrisma(): any {
  if (typeof window !== 'undefined') return null;
  const dbUrl = (process.env.DATABASE_URL || '').trim();
  if (!dbUrl || dbUrl.includes('ep-dummy') || !dbUrl.startsWith('postgres')) {
    return null;
  }
  if (!globalForPrisma.prisma) {
    try {
      const { PrismaClient } = require('@prisma/client');
      globalForPrisma.prisma = new PrismaClient({
        datasources: {
          db: {
            url: dbUrl,
          },
        },
        log: ['error'],
      });
    } catch {
      globalForPrisma.prisma = null;
    }
  }
  return globalForPrisma.prisma;
}

// In-Memory, Local VPS PostgreSQL & Persistent File Store with Atomic Locking
class DatabaseStore {
  private data: DatabaseSchema;
  private isLoaded = false;
  private lastRemoteSyncTime = 0;
  private lastFileMtime = 0;
  private lastCheckTime = 0;
  private syncInProgress: Promise<boolean> | null = null;
  private writeLock = Promise.resolve();
  private lastModified: number = Date.now();

  constructor() {
    this.data = getInitialData();
  }

  public async getLatestVersion(): Promise<number> {
    const prisma = getPrisma();
    if (prisma) {
      try {
        const rows: any = await prisma.$queryRawUnsafe(`
          SELECT updated_at FROM al_waseet_state WHERE id = 'store_main' LIMIT 1;
        `);
        if (rows && rows.length > 0 && rows[0].updated_at) {
          return Number(rows[0].updated_at);
        }
      } catch {}
    }
    return this.getLastModified();
  }

  public getLastModified(): number {
    try {
      const dbPath = getDbFilePath();
      if (fs.existsSync(dbPath)) {
        const stats = fs.statSync(dbPath);
        return Math.max(this.lastModified, stats.mtimeMs);
      }
    } catch {}
    return this.lastModified;
  }

  public touch(): void {
    this.lastModified = Date.now();
  }

  private ensureDir(targetPath: string) {
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch (err) {
        console.error('Error creating directory:', err);
      }
    }
  }

  // Guarantees data is freshly synchronized from Local VPS PostgreSQL (or local disk fallback)
  public async ensureLoaded(forceSync = false): Promise<void> {
    const now = Date.now();
    // Cache for 1500ms within same process to keep reads microsecond-fast
    if (!forceSync && this.isLoaded && now - this.lastCheckTime < 1500) {
      return;
    }

    if (this.syncInProgress) {
      await this.syncInProgress;
      return;
    }

    this.syncInProgress = (async () => {
      try {
        const dbSynced = await this.syncWithDatabase();
        if (!dbSynced) {
          this.loadFromDisk();
        }
        this.lastCheckTime = Date.now();
        return true;
      } catch {
        this.loadFromDisk();
        this.lastCheckTime = Date.now();
        return false;
      } finally {
        this.syncInProgress = null;
      }
    })();

    await this.syncInProgress;
  }

  private async syncWithDatabase(): Promise<boolean> {
    const prisma = getPrisma();
    if (!prisma) return false;
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS al_waseet_state (
          id VARCHAR(50) PRIMARY KEY,
          data JSONB NOT NULL,
          updated_at BIGINT NOT NULL
        );
      `);

      const rows: any = await prisma.$queryRawUnsafe(`
        SELECT data, updated_at FROM al_waseet_state WHERE id = 'store_main' LIMIT 1;
      `);

      if (rows && rows.length > 0 && rows[0].data) {
        const remoteTime = Number(rows[0].updated_at || 0);
        if (remoteTime > this.lastRemoteSyncTime || !this.isLoaded) {
          const raw = typeof rows[0].data === 'string' ? JSON.parse(rows[0].data) : rows[0].data;

          if (!raw.users || !Array.isArray(raw.users) || raw.users.length === 0) {
            raw.users = getInitialData().users;
          }
          const adminUser = raw.users.find((u: any) => u.username === 'admin');
          if (adminUser && !adminUser.name) {
            adminUser.name = 'المدير العام (مسؤول النظام)';
          }
          if (!raw.categories || !Array.isArray(raw.categories)) raw.categories = [];
          if (!raw.products || !Array.isArray(raw.products)) raw.products = [];
          if (!raw.batches || !Array.isArray(raw.batches)) raw.batches = [];
          if (!raw.clients || !Array.isArray(raw.clients)) raw.clients = [];
          if (!raw.invoices || !Array.isArray(raw.invoices)) raw.invoices = [];
          if (!raw.returns || !Array.isArray(raw.returns)) raw.returns = [];
          if (!raw.collections || !Array.isArray(raw.collections)) raw.collections = [];
          if (!raw.advances || !Array.isArray(raw.advances)) raw.advances = [];
          if (!raw.suppliers || !Array.isArray(raw.suppliers)) raw.suppliers = [];
          if (!raw.supplierPurchases || !Array.isArray(raw.supplierPurchases)) raw.supplierPurchases = [];
          if (!raw.supplierPurchaseItems || !Array.isArray(raw.supplierPurchaseItems)) raw.supplierPurchaseItems = [];
          if (!raw.supplierPayments || !Array.isArray(raw.supplierPayments)) raw.supplierPayments = [];
          if (!raw.employees || !Array.isArray(raw.employees)) raw.employees = [];
          if (!raw.payrollPayments || !Array.isArray(raw.payrollPayments)) raw.payrollPayments = [];
          if (!raw.repTargets || !Array.isArray(raw.repTargets)) raw.repTargets = [];

          this.data = raw;
          this.lastRemoteSyncTime = remoteTime;
          this.lastModified = remoteTime;
          this.isLoaded = true;
          this.persistToDisk();
        }
        return true;
      } else {
        if (!this.isLoaded) {
          this.loadFromDisk();
        }
        const str = JSON.stringify(this.data);
        const now = Date.now();
        await prisma.$executeRawUnsafe(`
          INSERT INTO al_waseet_state (id, data, updated_at)
          VALUES ('store_main', $1::jsonb, $2)
          ON CONFLICT (id) DO NOTHING;
        `, str, now);
        this.lastRemoteSyncTime = now;
        this.lastModified = now;
        this.isLoaded = true;
        return true;
      }
    } catch (e) {
      console.error('syncWithDatabase error:', e);
      return false;
    }
  }

  private async persistToDatabase(): Promise<boolean> {
    const prisma = getPrisma();
    if (!prisma) return false;
    try {
      const now = Date.now();
      const str = JSON.stringify(this.data);
      await prisma.$executeRawUnsafe(`
        INSERT INTO al_waseet_state (id, data, updated_at)
        VALUES ('store_main', $1::jsonb, $2)
        ON CONFLICT (id) DO UPDATE SET data = $1::jsonb, updated_at = $2;
      `, str, now);
      this.lastRemoteSyncTime = now;
      this.lastModified = now;
      return true;
    } catch (e) {
      console.error('persistToDatabase error:', e);
      return false;
    }
  }

  private loadFromDisk(forceReload = false) {
    try {
      const dbPath = getDbFilePath();
      this.ensureDir(dbPath);

      // On Vercel, copy initial bundled database to /tmp if it doesn't exist yet
      if (process.env.VERCEL && !fs.existsSync(dbPath)) {
        const bundledPath = path.join(process.cwd(), 'data', 'al_waseet_db.json');
        if (fs.existsSync(bundledPath)) {
          try {
            fs.copyFileSync(bundledPath, dbPath);
          } catch (e) {
            console.error('Failed to copy bundled db to /tmp:', e);
          }
        }
      }

      if (fs.existsSync(dbPath)) {
        const stats = fs.statSync(dbPath);
        if (!forceReload && this.isLoaded && stats.mtimeMs <= this.lastFileMtime) {
          return;
        }

        const raw = fs.readFileSync(dbPath, 'utf-8');
        this.data = JSON.parse(raw);
        this.lastFileMtime = stats.mtimeMs;
        this.isLoaded = true;

        const adminUser = this.data.users?.find((u) => u.username === 'admin');
        if (adminUser && !adminUser.name) {
          adminUser.name = 'المدير العام (مسؤول النظام)';
          this.persistToDisk();
        }

        if (!this.data.categories || !Array.isArray(this.data.categories)) {
          this.data.categories = [];
          this.persistToDisk();
        }

        if (!this.data.advances || !Array.isArray(this.data.advances)) {
          this.data.advances = [];
          this.persistToDisk();
        }

        if (!this.data.suppliers || !Array.isArray(this.data.suppliers)) {
          this.data.suppliers = [];
          this.persistToDisk();
        }

        if (!this.data.supplierPurchases || !Array.isArray(this.data.supplierPurchases)) {
          this.data.supplierPurchases = [];
          this.persistToDisk();
        }

        if (!this.data.supplierPurchaseItems || !Array.isArray(this.data.supplierPurchaseItems)) {
          this.data.supplierPurchaseItems = [];
          this.persistToDisk();
        }

        if (!this.data.supplierPayments || !Array.isArray(this.data.supplierPayments)) {
          this.data.supplierPayments = [];
          this.persistToDisk();
        }

        if (!this.data.employees || !Array.isArray(this.data.employees)) {
          this.data.employees = [];
          this.persistToDisk();
        }

        if (!this.data.payrollPayments || !Array.isArray(this.data.payrollPayments)) {
          this.data.payrollPayments = [];
          this.persistToDisk();
        }

        if (!this.data.repTargets || !Array.isArray(this.data.repTargets)) {
          this.data.repTargets = [];
          this.persistToDisk();
        }
      } else {
        this.data = getInitialData();
        this.persistToDisk();
        this.isLoaded = true;
      }
    } catch (e) {
      console.error('Failed to load database file:', e);
      if (!this.isLoaded) {
        this.data = getInitialData();
        this.isLoaded = true;
      }
    }
  }

  private persistToDisk() {
    try {
      const dbPath = getDbFilePath();
      this.ensureDir(dbPath);
      fs.writeFileSync(dbPath, JSON.stringify(this.data, null, 2), 'utf-8');
      try {
        const stats = fs.statSync(dbPath);
        this.lastFileMtime = stats.mtimeMs;
      } catch {}
    } catch (e) {
      console.error('Failed to write database file:', e);
    }
  }

  // Atomic transaction runner: ensures sequential execution preventing race conditions
  public async transaction<T>(fn: (db: DatabaseSchema) => Promise<T> | T): Promise<T> {
    let result: T;
    let thrownError: any = null;

    this.writeLock = this.writeLock
      .catch(() => {})
      .then(async () => {
        try {
          const dbSynced = await this.syncWithDatabase();
          if (!dbSynced) {
            this.loadFromDisk(true);
          }
          result = await fn(this.data);
          this.lastModified = Date.now();
          this.persistToDisk();
          await this.persistToDatabase();
        } catch (err) {
          thrownError = err;
        }
      });

    await this.writeLock;
    if (thrownError) {
      throw thrownError;
    }
    return result!;
  }

  // -------------------------------------------------------------
  // USERS
  // -------------------------------------------------------------
  async getUsers(): Promise<User[]> {
    await this.ensureLoaded();
    const users = this.data.users || [];
    users.forEach((u) => {
      if ((u.role === 'admin' || u.username === 'admin') && !u.name) {
        u.name = 'المدير العام (مسؤول النظام)';
      }
    });
    return users;
  }

  async getUserById(id: string): Promise<User | null> {
    await this.ensureLoaded();
    const targetId = String(id).trim();
    const targetLower = targetId.toLowerCase();
    const user =
      this.data.users.find(
        (u) =>
          u.id === targetId ||
          u.id.toLowerCase() === targetLower ||
          u.username.toLowerCase() === targetLower
      ) || null;
    if (user && (user.role === 'admin' || user.username === 'admin') && !user.name) {
      user.name = 'المدير العام (مسؤول النظام)';
    }
    return user;
  }

  async getUserByUsername(username: string): Promise<User | null> {
    await this.ensureLoaded();
    const target = username.toLowerCase().trim();
    const user = this.data.users.find((u) => u.username.toLowerCase() === target) || null;
    if (user && (user.role === 'admin' || user.username === 'admin') && !user.name) {
      user.name = 'المدير العام (مسؤول النظام)';
    }
    return user;
  }

  async createUser(user: Omit<User, 'id' | 'createdAt'>): Promise<User> {
    return this.transaction((db) => {
      const existing = db.users.find((u) => u.username.toLowerCase() === user.username.toLowerCase().trim());
      if (existing) {
        throw new Error('اسم المستخدم مسجل مسبقاً، يرجى اختيار اسم مستخدم آخر');
      }

      const newUser: User = {
        ...user,
        id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        createdAt: new Date().toISOString(),
      };
      db.users.push(newUser);
      return newUser;
    });
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    return this.transaction((db) => {
      const targetId = String(id).trim();
      const targetLower = targetId.toLowerCase();
      const idx = db.users.findIndex(
        (u) =>
          u.id === targetId ||
          u.id.toLowerCase() === targetLower ||
          u.username.toLowerCase() === targetLower
      );
      if (idx === -1) throw new Error('المندوب أو المستخدم غير موجود');
      const updated = { ...db.users[idx], ...updates };
      db.users[idx] = updated;
      return updated;
    });
  }

  // -------------------------------------------------------------
  // CATEGORIES
  // -------------------------------------------------------------
  async getCategories(): Promise<Category[]> {
    await this.ensureLoaded();
    return this.data.categories || [];
  }

  async createCategory(name: string, defaultShelfLifeDays: number = 1): Promise<Category> {
    return this.transaction((db) => {
      if (!db.categories) db.categories = [];
      const trimmed = name.trim();
      if (!trimmed) {
        throw new Error('يرجى إدخال اسم التصنيف');
      }
      const exists = db.categories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase());
      if (exists) {
        throw new Error(`التصنيف "${trimmed}" موجود مسبقاً`);
      }
      const newCategory: Category = {
        id: `cat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: trimmed,
        defaultShelfLifeDays: Math.max(1, defaultShelfLifeDays || 1),
        createdAt: new Date().toISOString(),
      };
      db.categories.push(newCategory);
      return newCategory;
    });
  }

  async deleteCategory(id: string): Promise<void> {
    return this.transaction((db) => {
      if (!db.categories) db.categories = [];
      const cat = db.categories.find((c) => c.id === id || c.name === id);
      if (!cat) {
        throw new Error('التصنيف المراد حذفه غير موجود');
      }
      // Check if any product is currently using this category
      const inUse = db.products.some(
        (p) => p.category === cat.name || p.category === cat.id
      );
      if (inUse) {
        throw new Error(`لا يمكن حذف التصنيف "${cat.name}" لأنه مرتبط بأصناف حالية. يرجى تعديل أو حذف تلك الأصناف أولاً`);
      }
      db.categories = db.categories.filter((c) => c.id !== cat.id && c.name !== cat.name);
    });
  }

  // -------------------------------------------------------------
  // PRODUCTS & BATCHES (FIFO)
  // -------------------------------------------------------------
  async getProducts(): Promise<Product[]> {
    await this.ensureLoaded();
    return this.data.products;
  }

  async createProduct(product: Omit<Product, 'id' | 'createdAt'>): Promise<Product> {
    return this.transaction((db) => {
      if (!db.products) db.products = [];
      const newProd: Product = {
        ...product,
        id: `prd_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        createdAt: new Date().toISOString(),
      };
      db.products.push(newProd);
      return newProd;
    });
  }

  async updateProduct(
    id: string,
    updates: Partial<Omit<Product, 'id' | 'createdAt'>>
  ): Promise<Product> {
    return this.transaction((db) => {
      if (!db.products) db.products = [];
      const idx = db.products.findIndex((p) => p.id === id);
      if (idx === -1) throw new Error('المنتج المحدد غير موجود');

      const current = db.products[idx];
      const updated: Product = {
        ...current,
        name: updates.name !== undefined ? updates.name.trim() || current.name : current.name,
        category: updates.category !== undefined ? updates.category.trim() || current.category : current.category,
        price: updates.price !== undefined && !isNaN(Number(updates.price)) ? Math.max(0, Number(updates.price)) : current.price,
        cost: updates.cost !== undefined && !isNaN(Number(updates.cost)) ? Math.max(0, Number(updates.cost)) : current.cost,
        unit: updates.unit !== undefined ? updates.unit.trim() || current.unit : current.unit,
        shelfLifeDays:
          updates.shelfLifeDays !== undefined && !isNaN(Number(updates.shelfLifeDays))
            ? Math.max(1, Number(updates.shelfLifeDays))
            : current.shelfLifeDays,
      };

      db.products[idx] = updated;
      return updated;
    });
  }

  async getBatches(): Promise<(InventoryBatch & { product: Product; hoursRemaining: number })[]> {
    await this.ensureLoaded();
    const now = new Date().getTime();
    const products = this.data.products || [];
    return (this.data.batches || [])
      .map((b) => {
        const prod = products.find((p) => p.id === b.productId);
        if (!prod) return null;
        const expTime = new Date(b.expiryDate).getTime();
        const hoursRemaining = Math.round((expTime - now) / (1000 * 60 * 60));
        const status = determineBatchStatus(b.expiryDate, b.quantity);
        return {
          ...b,
          status,
          product: prod,
          hoursRemaining,
        };
      })
      .filter((b): b is NonNullable<typeof b> => b !== null);
  }

  async getAvailableSupplierPurchaseItems() {
    await this.ensureLoaded();
    const purchases = this.data.supplierPurchases || [];
    const suppliers = this.data.suppliers || [];
    const products = this.data.products || [];
    const batches = this.data.batches || [];

    const availableItems: {
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
      expiryDate?: string;
      createdAt: string;
    }[] = [];

    for (const purchase of purchases) {
      const supplier = suppliers.find((s) => s.id === purchase.supplierId);
      const items = purchase.items || [];
      for (const item of items) {
        const prod = products.find((p) => p.id === item.productId);
        // Calculate how much quantity of this purchase item has already been assigned to warehouse batches
        const assignedQty = batches
          .filter((b) => b.purchaseItemId === item.id || (b.purchaseId === purchase.id && b.productId === item.productId))
          .reduce((sum, b) => sum + (Number(b.initialQuantity) || Number(b.quantity) || 0), 0);

        const remainingQty = Math.max(0, item.quantity - assignedQty);

        availableItems.push({
          purchaseId: purchase.id,
          purchaseNumber: purchase.purchaseNumber,
          supplierId: purchase.supplierId,
          supplierName: supplier?.name || 'مورد غير مسجل',
          purchaseItemId: item.id,
          productId: item.productId,
          productName: prod?.name || item.productName || 'صنف',
          unitCost: item.unitCost,
          totalInvoiceQty: item.quantity,
          assignedQty,
          remainingQty,
          productionDate: item.productionDate,
          expiryDate: item.expiryDate,
          createdAt: purchase.createdAt,
        });
      }
    }

    return availableItems;
  }

  async createBatch(data: {
    productId: string;
    batchNumber: string;
    quantity: number;
    productionDate: string;
    expiryDate?: string;
    purchaseId?: string;
    purchaseItemId?: string;
    unitCost?: number;
  }): Promise<InventoryBatch> {
    return this.transaction((db) => {
      if (!db.batches) db.batches = [];
      if (!db.suppliers) db.suppliers = [];
      if (!db.supplierPurchases) db.supplierPurchases = [];
      if (!db.supplierPurchaseItems) db.supplierPurchaseItems = [];

      const qty = Number(data.quantity);
      if (isNaN(qty) || qty <= 0) {
        throw new Error('يرجى إدخال كمية صحيحة للتشغيلة أكبر من الصفر');
      }

      const resolveExpiry = (prodDateStr: string, shelfDays: number, fallbackExpiry?: string) => {
        if (data.expiryDate) {
          const parsed = new Date(data.expiryDate);
          if (!isNaN(parsed.getTime())) {
            return parsed.toISOString();
          }
        }
        if (fallbackExpiry) {
          const parsed = new Date(fallbackExpiry);
          if (!isNaN(parsed.getTime())) {
            return parsed.toISOString();
          }
        }
        return calculateExpiry(prodDateStr, shelfDays);
      };

      // Case 1: Linked to a Supplier Purchase Invoice
      if (data.purchaseId && data.purchaseItemId) {
        const purchase = db.supplierPurchases.find((p) => p.id === data.purchaseId);
        if (!purchase) {
          throw new Error('فاتورة الشراء المحددة للمورد غير موجودة بالنظام');
        }

        const purchaseItem =
          (purchase.items || []).find((i) => i.id === data.purchaseItemId) ||
          db.supplierPurchaseItems.find((i) => i.id === data.purchaseItemId);
        if (!purchaseItem) {
          throw new Error('الصنف المحدد غير مدرج في فاتورة الشراء المختارة للمورد');
        }

        const targetProdId = String(purchaseItem.productId || data.productId).trim();
        const prod = db.products.find(
          (p) =>
            p.id === targetProdId ||
            p.id.toLowerCase() === targetProdId.toLowerCase() ||
            p.name === targetProdId
        );
        if (!prod) throw new Error('المنتج المحدد غير موجود، يرجى إعادة المحاولة');

        // Quantity Validation Check (منع تجاوز الكمية الواردة)
        const assignedQty = db.batches
          .filter(
            (b) =>
              b.purchaseItemId === purchaseItem.id ||
              (b.purchaseId === purchase.id && b.productId === prod.id)
          )
          .reduce((sum, b) => sum + (Number(b.initialQuantity) || Number(b.quantity) || 0), 0);

        const remainingQty = Math.max(0, purchaseItem.quantity - assignedQty);

        if (qty > remainingQty) {
          throw new Error(
            `عذراً، الكمية المراد إدخالها للتشغيلة (${qty}) أكبر من الكمية الواردة والمتبقية في فاتورة المورد المحددة (المتبقي: ${remainingQty})`
          );
        }

        const shelfDays = prod.shelfLifeDays || 1;
        const prodDate =
          data.productionDate || purchaseItem.productionDate || new Date().toISOString();
        const expiryDate = resolveExpiry(prodDate, shelfDays, purchaseItem.expiryDate);
        const status = determineBatchStatus(expiryDate, qty);

        const unitCost = purchaseItem.unitCost || prod.cost || 0;
        if (unitCost > 0) {
          prod.cost = unitCost;
        }

        const newBatch: InventoryBatch = {
          id: `bat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          productId: prod.id,
          batchNumber: data.batchNumber || `BAT-${Date.now().toString().slice(-6)}`,
          initialQuantity: qty,
          quantity: qty,
          productionDate: prodDate,
          expiryDate,
          status,
          supplierId: purchase.supplierId,
          purchaseId: purchase.id,
          purchaseItemId: purchaseItem.id,
          unitCost,
          createdAt: new Date().toISOString(),
        };

        db.batches.push(newBatch);
        return newBatch;
      }

      // Case 2: Direct Warehouse Opening Stock / Direct Batch Entry (رصيد أول المدة / إضافة مباشرة للمخزن)
      const targetProdId = String(data.productId || '').trim();
      const prod = db.products.find(
        (p) =>
          p.id === targetProdId ||
          p.id.toLowerCase() === targetProdId.toLowerCase() ||
          p.name === targetProdId
      );
      if (!prod) throw new Error('المنتج المحدد غير موجود بالمخزن');

      const shelfDays = prod.shelfLifeDays || 1;
      const prodDate = data.productionDate || new Date().toISOString();
      const expiryDate = resolveExpiry(prodDate, shelfDays);
      const status = determineBatchStatus(expiryDate, qty);

      const unitCost =
        data.unitCost !== undefined && !isNaN(Number(data.unitCost)) && Number(data.unitCost) > 0
          ? Number(data.unitCost)
          : prod.cost || 0;
      if (unitCost > 0) {
        prod.cost = unitCost;
      }

      const newBatch: InventoryBatch = {
        id: `bat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        productId: prod.id,
        batchNumber: data.batchNumber || `BAT-DIR-${Date.now().toString().slice(-6)}`,
        initialQuantity: qty,
        quantity: qty,
        productionDate: prodDate,
        expiryDate,
        status,
        unitCost,
        createdAt: new Date().toISOString(),
      };

      db.batches.push(newBatch);
      return newBatch;
    });
  }

  async updateBatch(
    id: string,
    updates: {
      expiryDate?: string;
      productionDate?: string;
      quantity?: number;
      batchNumber?: string;
    }
  ): Promise<InventoryBatch> {
    return this.transaction((db) => {
      if (!db.batches) db.batches = [];
      const idx = db.batches.findIndex((b) => b.id === id);
      if (idx === -1) throw new Error('التشغيلة المحددة غير موجودة بالمخزن');

      const current = db.batches[idx];
      const nextQty =
        updates.quantity !== undefined && !isNaN(Number(updates.quantity))
          ? Math.max(0, Number(updates.quantity))
          : current.quantity;

      let nextExpiry = current.expiryDate;
      if (updates.expiryDate) {
        const parsedExp = new Date(updates.expiryDate);
        if (!isNaN(parsedExp.getTime())) {
          nextExpiry = parsedExp.toISOString();
        }
      }

      let nextProdDate = current.productionDate;
      if (updates.productionDate) {
        const parsedProd = new Date(updates.productionDate);
        if (!isNaN(parsedProd.getTime())) {
          nextProdDate = parsedProd.toISOString();
        }
      }

      const updated: InventoryBatch = {
        ...current,
        batchNumber:
          updates.batchNumber !== undefined && updates.batchNumber.trim()
            ? updates.batchNumber.trim()
            : current.batchNumber,
        quantity: nextQty,
        initialQuantity: Math.max(current.initialQuantity, nextQty),
        productionDate: nextProdDate,
        expiryDate: nextExpiry,
        status: determineBatchStatus(nextExpiry, nextQty),
      };

      db.batches[idx] = updated;
      return updated;
    });
  }

  async deleteProduct(id: string): Promise<boolean> {
    return this.transaction((db) => {
      if (!db.products) db.products = [];
      const prod = db.products.find((p) => p.id === id);
      if (!prod) throw new Error('المنتج المراد حذفه غير موجود');
      db.products = db.products.filter((p) => p.id !== id);
      if (db.batches) {
        db.batches = db.batches.filter((b) => b.productId !== id);
      }
      if (db.repInventory) {
        db.repInventory = db.repInventory.filter((r) => r.productId !== id);
      }
      return true;
    });
  }

  async deleteBatch(id: string): Promise<boolean> {
    return this.transaction((db) => {
      if (!db.batches) db.batches = [];
      const batch = db.batches.find((b) => b.id === id);
      if (!batch) throw new Error('التشغيلة المراد حذفها غير موجودة');
      db.batches = db.batches.filter((b) => b.id !== id);
      if (db.repInventory) {
        db.repInventory = db.repInventory.filter((r) => r.batchId !== id);
      }
      return true;
    });
  }

  // -------------------------------------------------------------
  // VAN INVENTORY & DISPATCH (تحويل العهدة للسيارة)
  // -------------------------------------------------------------
  async getRepVanStock(repId: string): Promise<
    (RepInventory & {
      product: Product;
      batch: InventoryBatch;
      hoursRemaining: number;
    })[]
  > {
    await this.ensureLoaded();
    const now = new Date().getTime();
    const products = this.data.products || [];
    const batches = this.data.batches || [];
    const items = (this.data.repInventory || []).filter((r) => r.repId === repId && r.quantity > 0);

    return items
      .map((item) => {
        const product = products.find((p) => p.id === item.productId);
        const batch = batches.find((b) => b.id === item.batchId);
        if (!product || !batch) return null;

        const expTime = new Date(batch.expiryDate).getTime();
        const hoursRemaining = Math.round((expTime - now) / (1000 * 60 * 60));

        return {
          ...item,
          product,
          batch,
          hoursRemaining,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => new Date(a.batch.expiryDate).getTime() - new Date(b.batch.expiryDate).getTime());
  }

  // Atomic dispatch from warehouse to rep's van
  async dispatchStockToRep(data: {
    repId: string;
    batchId: string;
    quantity: number;
  }): Promise<{ success: boolean; message: string }> {
    return this.transaction((db) => {
      const batch = db.batches.find((b) => b.id === data.batchId);
      if (!batch) throw new Error('التشغيلة المحددة غير موجودة بالمستودع');
      if (batch.quantity < data.quantity) {
        throw new Error(
          `الكمية المتاحة في المستودع (${batch.quantity}) أقل من الكمية المطلوبة للتحويل (${data.quantity})`
        );
      }

      // Check rep
      const rep = db.users.find((u) => u.id === data.repId && u.role === 'rep');
      if (!rep) throw new Error('المندوب المحدد غير موجود');

      // Deduct from warehouse batch
      batch.quantity -= data.quantity;
      if (batch.quantity === 0) batch.status = 'depleted';

      // Add to rep's van stock
      let repItem = db.repInventory.find(
        (r) => r.repId === data.repId && r.batchId === data.batchId
      );

      if (repItem) {
        repItem.quantity += data.quantity;
        repItem.updatedAt = new Date().toISOString();
      } else {
        db.repInventory.push({
          id: `rep_inv_${Date.now()}`,
          repId: data.repId,
          productId: batch.productId,
          batchId: batch.id,
          quantity: data.quantity,
          updatedAt: new Date().toISOString(),
        });
      }

      return {
        success: true,
        message: `تم تحويل ${data.quantity} كرتونة إلى سيارة المندوب ${rep.name} بنجاح`,
      };
    });
  }

  // Atomic return of unsold stock from rep's van back to main warehouse batch
  async returnStockFromRepToWarehouse(data: {
    repId: string;
    batchId: string;
    quantity: number;
  }): Promise<{ success: boolean; message: string }> {
    return this.transaction((db) => {
      const qty = Number(data.quantity);
      if (isNaN(qty) || qty <= 0) {
        throw new Error('يرجى إدخال كمية صحيحة للإرجاع أكبر من الصفر');
      }

      const rep = db.users.find((u) => u.id === data.repId);
      if (!rep) throw new Error('المندوب المحدد غير موجود');

      const repItem = (db.repInventory || []).find(
        (r) => r.repId === data.repId && r.batchId === data.batchId
      );
      if (!repItem || repItem.quantity < qty) {
        throw new Error(
          `الكمية المتاحة في سيارة المندوب (${repItem?.quantity || 0}) أقل من الكمية المطلوبة للإرجاع للمخزن (${qty})`
        );
      }

      const batch = (db.batches || []).find((b) => b.id === data.batchId);
      if (!batch) {
        throw new Error('التشغيلة الأصلية غير موجودة بالمستودع الرئيسي');
      }

      // Deduct from rep's van
      repItem.quantity -= qty;
      repItem.updatedAt = new Date().toISOString();

      // Add back to main warehouse batch
      batch.quantity += qty;
      batch.status = determineBatchStatus(batch.expiryDate, batch.quantity);

      const prod = (db.products || []).find((p) => p.id === batch.productId);

      return {
        success: true,
        message: `تم إرجاع ${qty} ${prod?.unit || 'كرتونة'} من "${prod?.name || 'الصنف'}" من سيارة ${rep.name} إلى المستودع الرئيسي بنجاح`,
      };
    });
  }

  // -------------------------------------------------------------
  // CLIENTS & OUTLETS (إدارة المنافذ والعملاء)
  // -------------------------------------------------------------
  async getClients(): Promise<Client[]> {
    await this.ensureLoaded();
    return this.data.clients;
  }

  async getClientById(id: string): Promise<Client | null> {
    await this.ensureLoaded();
    return this.data.clients.find((c) => c.id === id) || null;
  }

  async createClient(client: {
    name: string;
    phone?: string;
    address?: string;
    creditBalance?: number;
  }): Promise<Client> {
    return this.transaction((db) => {
      if (!client.name || !client.name.trim()) {
        throw new Error('اسم المنفذ / العميل إجباري ومطلوب');
      }
      const newClient: Client = {
        id: `clt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: client.name.trim(),
        phone: client.phone?.trim() || '',
        address: client.address?.trim() || '',
        creditBalance: client.creditBalance || 0,
        createdAt: new Date().toISOString(),
      };
      db.clients.unshift(newClient);
      return newClient;
    });
  }

  async updateClient(id: string, updates: Partial<Client>): Promise<Client> {
    return this.transaction((db) => {
      const idx = db.clients.findIndex((c) => c.id === id);
      if (idx === -1) throw new Error('المنفذ غير مسجل بالنظام');
      const updated = { ...db.clients[idx], ...updates };
      db.clients[idx] = updated;
      return updated;
    });
  }

  async deleteClient(id: string): Promise<boolean> {
    return this.transaction((db) => {
      const hasInvoices = db.invoices.some((i) => i.clientId === id);
      if (hasInvoices) {
        throw new Error('لا يمكن حذف هذا المنفذ لوجود فواتير مبيعات سابقة مسجلة باسمه');
      }
      db.clients = db.clients.filter((c) => c.id !== id);
      return true;
    });
  }

  // -------------------------------------------------------------
  // INVOICING (فاتورة مبيعات بنظام FIFO الفوري مع دعم الخصم والمرتجعات)
  // -------------------------------------------------------------
  async createInvoice(data: {
    repId: string;
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
  }): Promise<Invoice> {
    return this.transaction((db) => {
      const rep = db.users.find((u) => u.id === data.repId);
      if (!rep) throw new Error('المندوب غير مسجل');

      const client = db.clients.find((c) => c.id === data.clientId);
      if (!client) throw new Error('العميل أو المنفذ المحدد غير موجود');

      if ((!data.items || data.items.length === 0) && (!data.returns || data.returns.length === 0)) {
        throw new Error('يجب إضافة منتج واحد أو مرتجع واحد على الأقل في الفاتورة');
      }

      const invoiceId = `inv_${Date.now()}`;
      const invoiceNumber = `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

      let subtotal = 0;
      const invoiceItems: InvoiceItem[] = [];

      // Process each requested product using FIFO from the rep's vehicle batches
      if (data.items && data.items.length > 0) {
        for (const reqItem of data.items) {
          const product = db.products.find((p) => p.id === reqItem.productId);
          if (!product) throw new Error(`المنتج ${reqItem.productId} غير معرف`);

          let neededQty = reqItem.quantity;
          if (neededQty <= 0) continue;

          // Find available batches for this product in rep's van, sorted by earliest expiry (FIFO!)
          const availableVanBatches = db.repInventory
            .filter((r) => r.repId === data.repId && r.productId === reqItem.productId && r.quantity > 0)
            .map((r) => {
              const batch = db.batches.find((b) => b.id === r.batchId)!;
              return {
                repInvItem: r,
                batch,
              };
            })
            .sort((a, b) => new Date(a.batch.expiryDate).getTime() - new Date(b.batch.expiryDate).getTime());

          const totalVanStock = availableVanBatches.reduce((sum, item) => sum + item.repInvItem.quantity, 0);

          if (totalVanStock < neededQty) {
            throw new Error(
              `الكمية المتاحة في سيارتك من "${product.name}" (${totalVanStock}) لا تكفي للكمية المطلوبة (${neededQty})`
            );
          }

          // Deduct from batches starting from earliest expiry (FIFO)
          for (const item of availableVanBatches) {
            if (neededQty <= 0) break;

            const deductQty = Math.min(item.repInvItem.quantity, neededQty);
            item.repInvItem.quantity -= deductQty;
            neededQty -= deductQty;

            const itemTotal = deductQty * product.price;
            subtotal += itemTotal;

            invoiceItems.push({
              id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              invoiceId,
              productId: product.id,
              batchId: item.batch.id,
              quantity: deductQty,
              unitPrice: product.price,
              totalPrice: itemTotal,
            });
          }
        }
      }

      // Process Returns in the same invoice transaction
      let returnsTotal = 0;
      const invoiceReturnItems: InvoiceReturnItem[] = [];

      if (data.returns && data.returns.length > 0) {
        if (!db.returns) db.returns = [];

        for (const retItem of data.returns) {
          const qty = Number(retItem.quantity) || 0;
          const prod = db.products.find((p) => p.id === retItem.productId);
          const unitPrice = retItem.unitPrice !== undefined ? retItem.unitPrice : (prod?.price || 0);
          const lineTotal =
            retItem.amount !== undefined && retItem.amount > 0
              ? Number(retItem.amount)
              : qty * unitPrice;
          if (lineTotal <= 0 && qty <= 0) continue;
          returnsTotal += lineTotal;

          // Record in db.returns tied directly to this invoice
          const newReturn: ReturnItem = {
            id: `ret_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            repId: data.repId,
            productId: retItem.productId,
            quantity: qty > 0 ? qty : 1,
            amount: lineTotal,
            reason: retItem.reason || 'expired',
            notes: retItem.notes || `مرتجع مخصوم من فاتورة ${invoiceNumber}`,
            invoiceId,
            createdAt: new Date().toISOString(),
          };
          db.returns.unshift(newReturn);

          invoiceReturnItems.push({
            productId: retItem.productId,
            productName: prod?.name || 'صنف مرتجع',
            quantity: qty > 0 ? qty : 1,
            unitPrice,
            totalPrice: lineTotal,
            amount: lineTotal,
            reason: retItem.reason || 'expired',
            notes: retItem.notes,
          });
        }
      }

      const discount = Math.max(0, data.discount || 0);
      const totalAmount = Math.max(0, subtotal - discount - returnsTotal);

      const paid = data.paymentType === 'cash' ? totalAmount : (data.paidAmount ?? 0);
      const remainingUnpaid = Math.max(0, totalAmount - paid);

      // Update client credit balance
      if (remainingUnpaid > 0) {
        client.creditBalance += remainingUnpaid;
      }

      const invoice: Invoice = {
        id: invoiceId,
        invoiceNumber,
        repId: data.repId,
        clientId: data.clientId,
        subtotal,
        discount,
        returnsTotal: returnsTotal > 0 ? returnsTotal : undefined,
        totalAmount,
        paidAmount: paid,
        paymentType: data.paymentType,
        notes: data.notes || '',
        createdAt: new Date().toISOString(),
        items: invoiceItems,
        returnItems: invoiceReturnItems.length > 0 ? invoiceReturnItems : undefined,
      };

      db.invoices.unshift(invoice);
      return invoice;
    });
  }

  // Direct Wholesale / Warehouse Invoice issued by Admin directly from Central Warehouse FIFO batches
  async createDirectWarehouseInvoice(data: {
    adminId?: string;
    clientId: string;
    paymentType: 'cash' | 'credit';
    paidAmount?: number;
    discount?: number;
    notes?: string;
    items: {
      productId: string;
      quantity: number;
    }[];
  }): Promise<Invoice> {
    return this.transaction((db) => {
      const adminUser =
        db.users.find((u) => u.id === data.adminId) ||
        db.users.find((u) => u.role === 'admin') ||
        db.users[0];
      if (!adminUser) throw new Error('حساب الإدارة غير موجود');

      const client = db.clients.find((c) => c.id === data.clientId);
      if (!client) throw new Error('العميل أو المنفذ المحدد غير موجود');

      if (!data.items || data.items.length === 0) {
        throw new Error('يرجى إضافة صنف واحد على الأقل في فاتورة البيع المباشر من المخزن');
      }

      const invoiceId = `inv_wh_${Date.now()}`;
      const invoiceNumber = `WH-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

      let subtotal = 0;
      const invoiceItems: InvoiceItem[] = [];

      for (const reqItem of data.items) {
        const product = db.products.find((p) => p.id === reqItem.productId);
        if (!product) throw new Error(`المنتج ${reqItem.productId} غير معرف`);

        let neededQty = Number(reqItem.quantity);
        if (isNaN(neededQty) || neededQty <= 0) continue;

        // Find available batches in Main Warehouse sorted by earliest expiry (FIFO)
        const warehouseBatches = (db.batches || [])
          .filter((b) => b.productId === reqItem.productId && b.quantity > 0)
          .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());

        const totalWarehouseStock = warehouseBatches.reduce((sum, b) => sum + b.quantity, 0);
        if (totalWarehouseStock < neededQty) {
          throw new Error(
            `الكمية المتاحة في المخزن الرئيسي من "${product.name}" (${totalWarehouseStock}) لا تكفي للكمية المطلوبة (${neededQty})`
          );
        }

        for (const batch of warehouseBatches) {
          if (neededQty <= 0) break;
          const deductQty = Math.min(batch.quantity, neededQty);
          batch.quantity -= deductQty;
          batch.status = determineBatchStatus(batch.expiryDate, batch.quantity);
          neededQty -= deductQty;

          const itemTotal = deductQty * product.price;
          subtotal += itemTotal;

          invoiceItems.push({
            id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            invoiceId,
            productId: product.id,
            batchId: batch.id,
            quantity: deductQty,
            unitPrice: product.price,
            totalPrice: itemTotal,
          });
        }
      }

      const discount = Math.max(0, Number(data.discount) || 0);
      const totalAmount = Math.max(0, subtotal - discount);
      const paid = data.paymentType === 'cash' ? totalAmount : Math.max(0, Number(data.paidAmount) || 0);
      const remainingUnpaid = Math.max(0, totalAmount - paid);

      if (remainingUnpaid > 0) {
        client.creditBalance += remainingUnpaid;
      }

      const invoice: Invoice = {
        id: invoiceId,
        invoiceNumber,
        repId: adminUser.id,
        clientId: data.clientId,
        subtotal,
        discount,
        totalAmount,
        paidAmount: paid,
        paymentType: data.paymentType,
        notes: data.notes ? `[بيع مباشر من المخزن الرئيسي] ${data.notes}` : '[بيع مباشر من المخزن الرئيسي]',
        createdAt: new Date().toISOString(),
        items: invoiceItems,
      };

      db.invoices.unshift(invoice);
      return invoice;
    });
  }

  async deleteInvoice(id: string): Promise<boolean> {
    return this.transaction((db) => {
      if (!db.invoices) db.invoices = [];
      const idx = db.invoices.findIndex((inv) => inv.id === id);
      if (idx === -1) throw new Error('الفاتورة المراد حذفها غير موجودة');
      const invoice = db.invoices[idx];

      // 1. Restore client credit balance if unpaid amount existed
      if (invoice.paymentType === 'credit') {
        const remaining = (invoice.totalAmount || 0) - (invoice.paidAmount || 0);
        if (remaining > 0 && db.clients) {
          const client = db.clients.find((c) => c.id === invoice.clientId);
          if (client) {
            client.creditBalance = Math.max(0, client.creditBalance - remaining);
          }
        }
      }

      // 2. Restore stock quantities back to Van or Main Warehouse
      const isDirectWarehouse =
        invoice.invoiceNumber?.startsWith('WH-') ||
        invoice.notes?.includes('بيع مباشر من المخزن');
      const repUser = (db.users || []).find((u) => u.id === invoice.repId);

      for (const item of invoice.items || []) {
        if (!item.batchId || item.quantity <= 0) continue;
        if (isDirectWarehouse || repUser?.role === 'admin') {
          const batch = (db.batches || []).find((b) => b.id === item.batchId);
          if (batch) {
            batch.quantity += item.quantity;
            batch.status = determineBatchStatus(batch.expiryDate, batch.quantity);
          }
        } else {
          let repItem = (db.repInventory || []).find(
            (r) => r.repId === invoice.repId && r.batchId === item.batchId
          );
          if (repItem) {
            repItem.quantity += item.quantity;
            repItem.updatedAt = new Date().toISOString();
          } else {
            const batch = (db.batches || []).find((b) => b.id === item.batchId);
            if (batch) {
              batch.quantity += item.quantity;
              batch.status = determineBatchStatus(batch.expiryDate, batch.quantity);
            }
          }
        }
      }

      // 3. Remove any returns linked directly to this invoice
      if (db.returns) {
        db.returns = db.returns.filter((r) => r.invoiceId !== invoice.id);
      }

      db.invoices.splice(idx, 1);
      return true;
    });
  }

  // -------------------------------------------------------------
  // RETURNS (المرتجعات)
  // -------------------------------------------------------------
  async createReturn(data: {
    repId: string;
    productId: string;
    quantity?: number;
    amount?: number;
    reason: 'expired' | 'damaged';
    notes?: string;
    invoiceId?: string;
  }): Promise<ReturnItem> {
    return this.transaction((db) => {
      const rep = db.users.find((u) => u.id === data.repId);
      if (!rep) throw new Error('المندوب غير مسجل');

      const product = db.products.find((p) => p.id === data.productId);
      if (!product) throw new Error('المنتج المحدد غير موجود');

      const newReturn: ReturnItem = {
        id: `ret_${Date.now()}`,
        repId: data.repId,
        productId: data.productId,
        quantity: data.quantity ?? 1,
        amount: data.amount,
        reason: data.reason,
        notes: data.notes,
        invoiceId: data.invoiceId,
        createdAt: new Date().toISOString(),
      };

      db.returns.unshift(newReturn);
      return newReturn;
    });
  }

  // -------------------------------------------------------------
  // COLLECTIONS (التحصيلات النقدية)
  // -------------------------------------------------------------
  async createCollection(data: {
    repId: string;
    clientId: string;
    amount: number;
    notes?: string;
  }): Promise<Collection> {
    return this.transaction((db) => {
      const client = db.clients.find((c) => c.id === data.clientId);
      if (!client) throw new Error('العميل غير موجود');

      // Reduce client balance
      client.creditBalance = Math.max(0, client.creditBalance - data.amount);

      const col: Collection = {
        id: `col_${Date.now()}`,
        repId: data.repId,
        clientId: data.clientId,
        amount: data.amount,
        notes: data.notes,
        createdAt: new Date().toISOString(),
      };

      db.collections.unshift(col);
      return col;
    });
  }

  // -------------------------------------------------------------
  // INVOICES & REPORTS
  // -------------------------------------------------------------
  async getInvoices(filters?: { repId?: string; clientId?: string } | string): Promise<
    (Invoice & {
      client: Client;
      rep: User;
      itemsWithProducts: (InvoiceItem & { product: Product })[];
    })[]
  > {
    await this.ensureLoaded();
    let list = this.data.invoices;
    const repId = typeof filters === 'string' ? filters : filters?.repId;
    const clientId = typeof filters === 'object' ? filters?.clientId : undefined;

    if (repId) {
      list = list.filter((i) => i.repId === repId);
    }
    if (clientId) {
      list = list.filter((i) => i.clientId === clientId);
    }

    return list.map((inv) => ({
      ...inv,
      client: this.data.clients.find((c) => c.id === inv.clientId) || {
        id: inv.clientId,
        name: 'عميل غير مسجل',
        creditBalance: 0,
        createdAt: '',
      },
      rep: this.data.users.find((u) => u.id === inv.repId) || {
        id: inv.repId,
        name: 'مندوب سابق',
        username: '',
        password: '',
        role: 'rep',
        isActive: false,
        createdAt: '',
      },
      itemsWithProducts: inv.items.map((it) => ({
        ...it,
        product: this.data.products.find((p) => p.id === it.productId) || {
          id: it.productId,
          name: 'صنف',
          category: 'dairy',
          shelfLifeDays: 1,
          price: it.unitPrice,
          cost: 0,
          unit: 'كرتونة',
          createdAt: '',
        },
      })),
    }));
  }

  async getCollections(repId?: string): Promise<
    (Collection & {
      client: Client;
      rep: User;
    })[]
  > {
    await this.ensureLoaded();
    let list = this.data.collections;
    if (repId) {
      list = list.filter((c) => c.repId === repId);
    }
    return list.map((col) => ({
      ...col,
      client: this.data.clients.find((c) => c.id === col.clientId)!,
      rep: this.data.users.find((u) => u.id === col.repId)!,
    }));
  }

  async getReturns(repId?: string): Promise<
    (ReturnItem & {
      product: Product;
      rep: User;
    })[]
  > {
    await this.ensureLoaded();
    let list = this.data.returns;
    if (repId) {
      list = list.filter((r) => r.repId === repId);
    }
    return list.map((ret) => ({
      ...ret,
      product: this.data.products.find((p) => p.id === ret.productId)!,
      rep: this.data.users.find((u) => u.id === ret.repId)!,
    }));
  }

  // -------------------------------------------------------------
  // END-OF-DAY RECONCILIATION & SETTLEMENTS (تسوية نهاية اليوم)
  // -------------------------------------------------------------
  async getRepDaySummary(repId: string, dateStr?: string): Promise<{
    rep: User;
    todayInvoices: Invoice[];
    todayCashFromSales: number;
    todayCreditSales: number;
    todayCollections: number;
    expectedCash: number;
    currentVanStock: {
      product: Product;
      quantity: number;
    }[];
    todayReturns: ReturnItem[];
  }> {
    await this.ensureLoaded();
    const rep = this.data.users.find((u) => u.id === repId);
    if (!rep) throw new Error('المندوب غير مسجل');

    const targetDate = dateStr || new Date().toISOString().split('T')[0];

    // Filter invoices created on this date
    const todayInvoices = this.data.invoices.filter(
      (inv) => inv.repId === repId && inv.createdAt.startsWith(targetDate)
    );

    const todayCashFromSales = todayInvoices
      .filter((i) => i.paymentType === 'cash')
      .reduce((sum, i) => sum + i.paidAmount, 0);

    const todayCreditPartialCash = todayInvoices
      .filter((i) => i.paymentType === 'credit')
      .reduce((sum, i) => sum + (i.paidAmount || 0), 0);

    const todayCreditSales = todayInvoices
      .filter((i) => i.paymentType === 'credit')
      .reduce((sum, i) => sum + (i.totalAmount - i.paidAmount), 0);

    const todayCollections = this.data.collections
      .filter((col) => col.repId === repId && col.createdAt.startsWith(targetDate))
      .reduce((sum, col) => sum + col.amount, 0);

    // Expected total cash that rep must hand in
    const expectedCash = todayCashFromSales + todayCreditPartialCash + todayCollections;

    // Remaining stock in vehicle
    const vanStockItems = (this.data.repInventory || []).filter((r) => r.repId === repId && r.quantity > 0);
    const stockMap = new Map<string, number>();
    vanStockItems.forEach((item) => {
      stockMap.set(item.productId, (stockMap.get(item.productId) || 0) + item.quantity);
    });

    const products = this.data.products || [];
    const currentVanStock = Array.from(stockMap.entries())
      .map(([productId, quantity]) => {
        const prod = products.find((p) => p.id === productId);
        if (!prod) return null;
        return {
          product: prod,
          quantity,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    const todayReturns = this.data.returns.filter(
      (ret) => ret.repId === repId && ret.createdAt.startsWith(targetDate)
    );

    return {
      rep,
      todayInvoices,
      todayCashFromSales: todayCashFromSales + todayCreditPartialCash,
      todayCreditSales,
      todayCollections,
      expectedCash,
      currentVanStock,
      todayReturns,
    };
  }

  async saveSettlement(data: {
    repId: string;
    actualCash: number;
    stockDiscrepancies?: string;
    notes?: string;
  }): Promise<Settlement> {
    return this.transaction((db) => {
      const targetDate = new Date().toISOString().split('T')[0];
      const todayInvoices = db.invoices.filter(
        (inv) => inv.repId === data.repId && inv.createdAt.startsWith(targetDate)
      );

      const cashFromInvoices = todayInvoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);

      const collections = db.collections
        .filter((c) => c.repId === data.repId && c.createdAt.startsWith(targetDate))
        .reduce((sum, c) => sum + c.amount, 0);

      const expectedCash = cashFromInvoices + collections;
      const cashDifference = data.actualCash - expectedCash;
      const status = Math.abs(cashDifference) < 0.01 && !data.stockDiscrepancies ? 'balanced' : 'discrepancy';

      const settlement: Settlement = {
        id: `set_${Date.now()}`,
        repId: data.repId,
        date: new Date().toISOString(),
        expectedCash,
        actualCash: data.actualCash,
        cashDifference,
        stockDiscrepancies: data.stockDiscrepancies,
        status,
        notes: data.notes,
        createdAt: new Date().toISOString(),
      };

      db.settlements.unshift(settlement);
      return settlement;
    });
  }

  async getSettlements(): Promise<(Settlement & { rep: User })[]> {
    await this.ensureLoaded();
    const users = this.data.users || [];
    return (this.data.settlements || []).map((s) => ({
      ...s,
      rep: users.find((u) => u.id === s.repId) || {
        id: s.repId,
        name: 'مندوب غير مسجل',
        username: '',
        password: '',
        role: 'rep',
        isActive: false,
        createdAt: '',
      },
    }));
  }

  async deleteSettlement(id: string): Promise<boolean> {
    return this.transaction((db) => {
      if (!db.settlements) db.settlements = [];
      const settlement = db.settlements.find((s) => s.id === id);
      if (!settlement) throw new Error('سجل التسوية المراد حذفه غير موجود');
      db.settlements = db.settlements.filter((s) => s.id !== id);
      return true;
    });
  }

  // -------------------------------------------------------------
  // ANALYTICS & DASHBOARD KPIS
  // -------------------------------------------------------------
  async getAnalytics() {
    await this.ensureLoaded();
    const todayStr = new Date().toISOString().split('T')[0];

    const todayInvoices = this.data.invoices.filter((i) => i.createdAt.startsWith(todayStr));
    const todaySalesAmount = todayInvoices.reduce((sum, i) => sum + i.totalAmount, 0);
    const todayCashCollected =
      todayInvoices.reduce((sum, i) => sum + i.paidAmount, 0) +
      this.data.collections
        .filter((c) => c.createdAt.startsWith(todayStr))
        .reduce((sum, c) => sum + c.amount, 0);

    const activeReps = this.data.users.filter((u) => u.role === 'rep' && u.isActive).length;

    // Critical Expiry Batches: Dairy expiring in <= 24h, Juices expiring in <= 48h
    const now = new Date().getTime();
    const criticalBatches = this.data.batches
      .filter((b) => b.quantity > 0)
      .map((b) => {
        const prod = this.data.products.find((p) => p.id === b.productId)!;
        const expTime = new Date(b.expiryDate).getTime();
        const hoursRemaining = Math.round((expTime - now) / (1000 * 60 * 60));
        return {
          ...b,
          product: prod,
          hoursRemaining,
        };
      })
      .filter((b) => {
        const isOneDay = (b.product.shelfLifeDays || 1) <= 1 || b.product.category?.includes('لبن') || b.product.category === 'dairy';
        if (isOneDay && b.hoursRemaining <= 24) return true;
        if (!isOneDay && b.hoursRemaining <= 48) return true;
        return false;
      })
      .sort((a, b) => a.hoursRemaining - b.hoursRemaining);

    // Top Selling Products
    const productSalesMap = new Map<string, { product: Product; quantitySold: number; totalRevenue: number }>();
    this.data.invoices.forEach((inv) => {
      inv.items.forEach((item) => {
        const prod = this.data.products.find((p) => p.id === item.productId);
        if (!prod) return;
        const current = productSalesMap.get(prod.id) || {
          product: prod,
          quantitySold: 0,
          totalRevenue: 0,
        };
        current.quantitySold += item.quantity;
        current.totalRevenue += item.totalPrice;
        productSalesMap.set(prod.id, current);
      });
    });

    const topProducts = Array.from(productSalesMap.values()).sort((a, b) => b.quantitySold - a.quantitySold);

    // Top Clients by purchase volume
    const clientSalesMap = new Map<string, { client: Client; totalPurchases: number; invoiceCount: number }>();
    this.data.invoices.forEach((inv) => {
      const client = this.data.clients.find((c) => c.id === inv.clientId);
      if (!client) return;
      const current = clientSalesMap.get(client.id) || {
        client,
        totalPurchases: 0,
        invoiceCount: 0,
      };
      current.totalPurchases += inv.totalAmount;
      current.invoiceCount += 1;
      clientSalesMap.set(client.id, current);
    });

    const topClients = Array.from(clientSalesMap.values()).sort((a, b) => b.totalPurchases - a.totalPurchases);

    // Live Reps tracking
    const repPerformance = this.data.users
      .filter((u) => u.role === 'rep')
      .map((rep) => {
        const repTodayInvoices = this.data.invoices.filter(
          (i) => i.repId === rep.id && i.createdAt.startsWith(todayStr)
        );
        const repTodaySales = repTodayInvoices.reduce((s, i) => s + i.totalAmount, 0);
        const repTodayCash = repTodayInvoices.reduce((s, i) => s + i.paidAmount, 0);
        const repVanUnits = this.data.repInventory
          .filter((r) => r.repId === rep.id)
          .reduce((s, r) => s + r.quantity, 0);

        return {
          rep,
          todaySales: repTodaySales,
          todayCash: repTodayCash,
          vanUnitsRemaining: repVanUnits,
          invoicesCount: repTodayInvoices.length,
        };
      });

    const pendingAdvancesCount = (this.data.advances || []).filter(
      (a) => a.status === 'pending'
    ).length;

    return {
      todaySalesAmount,
      todayCashCollected,
      activeReps,
      criticalBatches,
      topProducts,
      topClients,
      repPerformance,
      totalInvoicesCount: this.data.invoices.length,
      pendingAdvancesCount,
    };
  }

  // -------------------------------------------------------------
  // ADVANCES (سلف المناديب المالية)
  // -------------------------------------------------------------
  async getAdvances(repId?: string): Promise<(AdvanceRequest & { rep: User })[]> {
    await this.ensureLoaded();
    const list = this.data.advances || [];
    const filtered = repId ? list.filter((a) => a.repId === repId) : list;
    return filtered.map((adv) => ({
      ...adv,
      rep: this.data.users.find((u) => u.id === adv.repId) || {
        id: adv.repId,
        name: 'مندوب',
        username: '',
        password: '',
        role: 'rep',
        isActive: false,
        createdAt: '',
      },
    }));
  }

  async createAdvanceRequest(data: {
    repId: string;
    amount: number;
    reason: string;
  }): Promise<AdvanceRequest> {
    return this.transaction((db) => {
      if (!db.advances) db.advances = [];
      const rep = db.users.find((u) => u.id === data.repId);
      if (!rep) throw new Error('المندوب غير مسجل بالنظام');
      if (isNaN(data.amount) || data.amount <= 0) {
        throw new Error('يرجى إدخال مبلغ سلفة صحيح أكبر من الصفر');
      }
      if (!data.reason || !data.reason.trim()) {
        throw new Error('يرجى توضيح سبب طلب السلفة');
      }

      const newAdvance: AdvanceRequest = {
        id: `adv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        repId: data.repId,
        amount: data.amount,
        reason: data.reason.trim(),
        status: 'pending',
        createdAt: new Date().toISOString(),
      };

      db.advances.unshift(newAdvance);
      return newAdvance;
    });
  }

  async updateAdvanceStatus(
    id: string,
    status: AdvanceStatus,
    managerNotes?: string
  ): Promise<AdvanceRequest> {
    return this.transaction((db) => {
      if (!db.advances) db.advances = [];
      const idx = db.advances.findIndex((a) => a.id === id);
      if (idx === -1) throw new Error('طلب السلفة غير موجود');

      db.advances[idx] = {
        ...db.advances[idx],
        status,
        managerNotes: managerNotes !== undefined ? managerNotes.trim() : db.advances[idx].managerNotes,
        updatedAt: new Date().toISOString(),
      };

      return db.advances[idx];
    });
  }

  async deleteAdvance(id: string): Promise<boolean> {
    return this.transaction((db) => {
      if (!db.advances) db.advances = [];
      const initialCount = db.advances.length;
      db.advances = db.advances.filter((a) => a.id !== id);
      return db.advances.length < initialCount;
    });
  }

  // -------------------------------------------------------------
  // SUPPLIERS & PURCHASES (إدارة الموردين وفواتير الشراء)
  // -------------------------------------------------------------
  async getSuppliers(): Promise<Supplier[]> {
    await this.ensureLoaded();
    return this.data.suppliers || [];
  }

  async getSupplierById(id: string): Promise<Supplier | null> {
    await this.ensureLoaded();
    return (this.data.suppliers || []).find((s) => s.id === id) || null;
  }

  async createSupplier(data: {
    name: string;
    phone?: string;
    address?: string;
    initialDue?: number;
  }): Promise<Supplier> {
    return this.transaction((db) => {
      if (!db.suppliers) db.suppliers = [];
      const trimmedName = (data.name || '').trim();
      if (!trimmedName) throw new Error('يرجى إدخال اسم المورد أو الشركة الموردة');

      const newSupplier: Supplier = {
        id: `sup_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: trimmedName,
        phone: data.phone?.trim() || '',
        address: data.address?.trim() || '',
        totalDue: Math.max(0, Number(data.initialDue) || 0),
        createdAt: new Date().toISOString(),
      };

      db.suppliers.unshift(newSupplier);
      return newSupplier;
    });
  }

  async updateSupplier(
    id: string,
    updates: Partial<Omit<Supplier, 'id' | 'createdAt'>>
  ): Promise<Supplier> {
    return this.transaction((db) => {
      if (!db.suppliers) db.suppliers = [];
      const idx = db.suppliers.findIndex((s) => s.id === id);
      if (idx === -1) throw new Error('المورد المحدد غير موجود');

      db.suppliers[idx] = {
        ...db.suppliers[idx],
        ...updates,
      };
      return db.suppliers[idx];
    });
  }

  async recordSupplierPayment(data: {
    supplierId: string;
    amount: number;
    notes?: string;
  }): Promise<SupplierPayment> {
    return this.transaction((db) => {
      if (!db.suppliers) db.suppliers = [];
      if (!db.supplierPayments) db.supplierPayments = [];

      const supplier = db.suppliers.find((s) => s.id === data.supplierId);
      if (!supplier) throw new Error('المورد المحدد غير موجود');

      const amount = Number(data.amount);
      if (isNaN(amount) || amount <= 0) {
        throw new Error('يرجى إدخال مبلغ سداد صحيح أكبر من الصفر');
      }

      supplier.totalDue = Math.max(0, (supplier.totalDue || 0) - amount);

      const payment: SupplierPayment = {
        id: `spay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        supplierId: data.supplierId,
        amount,
        notes: data.notes?.trim() || '',
        createdAt: new Date().toISOString(),
      };

      db.supplierPayments.unshift(payment);
      return payment;
    });
  }

  async getSupplierPurchases(): Promise<(SupplierPurchase & { supplier: Supplier })[]> {
    await this.ensureLoaded();
    const purchases = this.data.supplierPurchases || [];
    const suppliers = this.data.suppliers || [];

    return purchases.map((p) => ({
      ...p,
      supplier: suppliers.find((s) => s.id === p.supplierId) || {
        id: p.supplierId,
        name: 'مورد غير مسجل',
        totalDue: 0,
        createdAt: '',
      },
    }));
  }

  async createSupplierPurchase(data: {
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
  }): Promise<SupplierPurchase> {
    return this.transaction((db) => {
      if (!db.suppliers) db.suppliers = [];
      if (!db.supplierPurchases) db.supplierPurchases = [];
      if (!db.supplierPurchaseItems) db.supplierPurchaseItems = [];
      if (!db.batches) db.batches = [];

      const supplier = db.suppliers.find((s) => s.id === data.supplierId);
      if (!supplier) throw new Error('المورد المحدد غير موجود');

      if (!data.items || data.items.length === 0) {
        throw new Error('يرجى إضافة صنف واحد على الأقل في فاتورة الشراء');
      }

      const purchaseId = `pur_${Date.now()}`;
      const purchaseNumber = `PO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

      let totalAmount = 0;
      const purchaseItems: SupplierPurchaseItem[] = [];
      const autoReceive = data.autoReceiveBatches === true;

      // Process each item and inject into Central Main Warehouse batches if autoReceive is true
      for (const item of data.items) {
        const prod = db.products.find((p) => p.id === item.productId);
        if (!prod) throw new Error(`المنتج ${item.productId} غير موجود`);

        const qty = Number(item.quantity);
        const cost = Number(item.unitCost);
        if (isNaN(qty) || qty <= 0) {
          throw new Error(`يرجى تحديد كمية صحيحة للمنتج ${prod.name}`);
        }
        if (isNaN(cost) || cost < 0) {
          throw new Error(`يرجى تحديد سعر تكلفة صحيح للمنتج ${prod.name}`);
        }

        const lineTotal = qty * cost;
        totalAmount += lineTotal;

        const shelfDays = prod.shelfLifeDays || 1;
        const productionDate = item.productionDate || new Date().toISOString();
        let expiryDate = calculateExpiry(productionDate, shelfDays);
        if (item.expiryDate) {
          const parsedExp = new Date(item.expiryDate);
          if (!isNaN(parsedExp.getTime())) {
            expiryDate = parsedExp.toISOString();
          }
        }
        const status = determineBatchStatus(expiryDate, qty);

        const batchNumber = `BAT-SUP-${Date.now().toString().slice(-5)}-${Math.floor(Math.random() * 900 + 100)}`;
        const purchaseItemId = `pitem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        let createdBatchId: string | undefined = undefined;

        if (autoReceive) {
          // Create the batch in the Central Warehouse
          const newBatch: InventoryBatch = {
            id: `bat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            productId: prod.id,
            batchNumber,
            initialQuantity: qty,
            quantity: qty,
            productionDate,
            expiryDate,
            status,
            supplierId: supplier.id,
            purchaseId,
            purchaseItemId,
            unitCost: cost,
            createdAt: new Date().toISOString(),
          };
          db.batches.push(newBatch);
          createdBatchId = newBatch.id;
        }

        // Update product cost in catalog
        if (cost > 0) {
          prod.cost = cost;
        }

        const purchaseItem: SupplierPurchaseItem = {
          id: purchaseItemId,
          purchaseId,
          productId: prod.id,
          productName: prod.name,
          quantity: qty,
          unitCost: cost,
          totalCost: lineTotal,
          productionDate,
          expiryDate,
          batchId: createdBatchId,
          createdAt: new Date().toISOString(),
        };

        purchaseItems.push(purchaseItem);
        db.supplierPurchaseItems.push(purchaseItem);
      }

      const paid = data.paymentType === 'cash' ? totalAmount : Math.max(0, Number(data.paidAmount) || 0);
      const remainingDue = Math.max(0, totalAmount - paid);

      // Update supplier dues
      if (remainingDue > 0) {
        supplier.totalDue = (supplier.totalDue || 0) + remainingDue;
      }

      const purchase: SupplierPurchase = {
        id: purchaseId,
        purchaseNumber,
        supplierId: data.supplierId,
        totalAmount,
        paidAmount: paid,
        remainingDue,
        paymentType: data.paymentType,
        notes: data.notes?.trim() || '',
        createdAt: new Date().toISOString(),
        items: purchaseItems,
      };

      db.supplierPurchases.unshift(purchase);
      return purchase;
    });
  }

  async deleteSupplier(id: string): Promise<boolean> {
    return this.transaction((db) => {
      if (!db.suppliers) db.suppliers = [];
      const supplier = db.suppliers.find((s) => s.id === id);
      if (!supplier) throw new Error('المورد المراد حذفه غير موجود');
      db.suppliers = db.suppliers.filter((s) => s.id !== id);
      return true;
    });
  }

  async deleteSupplierPurchase(id: string): Promise<boolean> {
    return this.transaction((db) => {
      if (!db.supplierPurchases) db.supplierPurchases = [];
      const idx = db.supplierPurchases.findIndex((p) => p.id === id);
      if (idx === -1) throw new Error('فاتورة الشراء المراد حذفها غير موجودة');
      const purchase = db.supplierPurchases[idx];

      if (purchase.remainingDue > 0 && db.suppliers) {
        const supp = db.suppliers.find((s) => s.id === purchase.supplierId);
        if (supp) {
          supp.totalDue = Math.max(0, (supp.totalDue || 0) - purchase.remainingDue);
        }
      }

      if (db.batches) {
        db.batches = db.batches.filter((b) => b.purchaseId !== id);
      }

      db.supplierPurchases.splice(idx, 1);
      return true;
    });
  }

  // -------------------------------------------------------------
  // REP 360° COMPREHENSIVE PERFORMANCE ANALYTICS
  // -------------------------------------------------------------
  async getRep360Analytics(repId: string) {
    await this.ensureLoaded();

    const rep = (this.data.users || []).find((u) => u.id === repId);
    if (!rep) throw new Error('المندوب غير مسجل بالنظام');

    const now = new Date().getTime();

    // 1. Invoices & Sales
    const repInvoices = (this.data.invoices || []).filter((i) => i.repId === repId);
    const totalSales = repInvoices.reduce((s, i) => s + (i.totalAmount || 0), 0);
    const totalSubtotal = repInvoices.reduce((s, i) => s + (i.subtotal || i.totalAmount || 0), 0);
    const totalDiscounts = repInvoices.reduce((s, i) => s + (i.discount || 0), 0);
    const totalReturnsDeducted = repInvoices.reduce((s, i) => s + (i.returnsTotal || 0), 0);

    const cashSales = repInvoices
      .filter((i) => i.paymentType === 'cash')
      .reduce((s, i) => s + i.totalAmount, 0);

    const creditSales = repInvoices
      .filter((i) => i.paymentType === 'credit')
      .reduce((s, i) => s + i.totalAmount, 0);

    const cashPaidOnCredit = repInvoices
      .filter((i) => i.paymentType === 'credit')
      .reduce((s, i) => s + (i.paidAmount || 0), 0);

    const totalCashGeneratedFromInvoices = cashSales + cashPaidOnCredit;

    // 2. Collections
    const repCollections = (this.data.collections || []).filter((c) => c.repId === repId);
    const totalCollected = repCollections.reduce((s, c) => s + (c.amount || 0), 0);

    // 3. Clients in route
    const allClients = this.data.clients || [];
    const clientIdsWithInvoices = new Set(repInvoices.map((i) => i.clientId));
    const repClients = allClients.filter((c) => clientIdsWithInvoices.has(c.id));
    const totalClientsDebt = repClients.reduce((s, c) => s + (c.creditBalance || 0), 0);

    // 4. Returns & Wastage
    const repReturns = (this.data.returns || []).filter((r) => r.repId === repId);
    const totalReturnedItems = repReturns.reduce((s, r) => s + (r.quantity || 0), 0);
    const expiredReturns = repReturns.filter((r) => r.reason === 'expired');
    const damagedReturns = repReturns.filter((r) => r.reason === 'damaged');
    const expiredCount = expiredReturns.reduce((s, r) => s + (r.quantity || 0), 0);
    const damagedCount = damagedReturns.reduce((s, r) => s + (r.quantity || 0), 0);

    // 5. Current Van Stock
    const rawVanStock = (this.data.repInventory || []).filter(
      (r) => r.repId === repId && r.quantity > 0
    );
    const vanStockItems = rawVanStock.map((item) => {
      const product = (this.data.products || []).find((p) => p.id === item.productId)!;
      const batch = (this.data.batches || []).find((b) => b.id === item.batchId)!;
      const expTime = batch ? new Date(batch.expiryDate).getTime() : now;
      const hoursRemaining = Math.round((expTime - now) / (1000 * 60 * 60));
      return {
        ...item,
        product,
        batch,
        hoursRemaining,
      };
    });

    const totalVanCartons = vanStockItems.reduce((s, i) => s + i.quantity, 0);
    const totalVanValue = vanStockItems.reduce(
      (s, i) => s + i.quantity * (i.product?.price || 0),
      0
    );
    const urgentVanStock = vanStockItems.filter((i) => i.hoursRemaining <= 24);

    // 6. Settlements
    const repSettlements = (this.data.settlements || []).filter((s) => s.repId === repId);
    const balancedSettlements = repSettlements.filter((s) => s.status === 'balanced').length;
    const discrepancySettlements = repSettlements.filter((s) => s.status === 'discrepancy').length;
    const totalCashDifference = repSettlements.reduce((s, item) => s + (item.cashDifference || 0), 0);

    // 7. Advances
    const repAdvances = (this.data.advances || []).filter((a) => a.repId === repId);
    const totalAdvancesApproved = repAdvances
      .filter((a) => a.status === 'approved')
      .reduce((s, a) => s + a.amount, 0);

    return {
      rep,
      sales: {
        totalSales,
        totalSubtotal,
        totalDiscounts,
        totalReturnsDeducted,
        cashSales,
        creditSales,
        cashPaidOnCredit,
        totalCashGeneratedFromInvoices,
        invoicesCount: repInvoices.length,
        invoices: repInvoices.map((inv) => {
          const client = allClients.find((c) => c.id === inv.clientId);
          return {
            ...inv,
            clientName: client?.name || 'عميل',
          };
        }),
      },
      collections: {
        totalCollected,
        collectionsCount: repCollections.length,
        collectionsList: repCollections.map((col) => {
          const client = allClients.find((c) => c.id === col.clientId);
          return {
            ...col,
            clientName: client?.name || 'عميل',
          };
        }),
        totalClientsDebt,
        clientsCount: repClients.length,
        clients: repClients,
      },
      returns: {
        totalReturnedItems,
        expiredCount,
        damagedCount,
        returnsList: repReturns.map((ret) => {
          const prod = (this.data.products || []).find((p) => p.id === ret.productId);
          return {
            ...ret,
            productName: prod?.name || 'صنف',
            unitPrice: prod?.price || 0,
          };
        }),
      },
      vanStock: {
        totalVanCartons,
        totalVanValue,
        items: vanStockItems,
        urgentCount: urgentVanStock.length,
      },
      settlements: {
        totalSettlements: repSettlements.length,
        balancedSettlements,
        discrepancySettlements,
        totalCashDifference,
        settlementsList: repSettlements,
      },
      advances: {
        totalAdvancesApproved,
        advancesList: repAdvances,
      },
    };
  }

  // -------------------------------------------------------------
  // EMPLOYEES & PAYROLL MANAGEMENT (شؤون الموظفين والمرتبات)
  // -------------------------------------------------------------
  async getEmployees(): Promise<Employee[]> {
    await this.ensureLoaded();
    return [...(this.data.employees || [])];
  }

  async createEmployee(data: {
    name: string;
    phone?: string;
    role: string;
    baseSalary: number;
  }): Promise<Employee> {
    return this.transaction((db) => {
      if (!db.employees) db.employees = [];
      const trimmedName = (data.name || '').trim();
      if (!trimmedName) throw new Error('يرجى إدخال اسم الموظف');
      const role = (data.role || '').trim();
      if (!role) throw new Error('يرجى تحديد المسمى الوظيفي للموظف');

      const newEmployee: Employee = {
        id: `emp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: trimmedName,
        phone: data.phone?.trim() || '',
        role,
        baseSalary: Math.max(0, Number(data.baseSalary) || 0),
        createdAt: new Date().toISOString(),
      };

      db.employees.unshift(newEmployee);
      return newEmployee;
    });
  }

  async updateEmployee(
    id: string,
    updates: Partial<Omit<Employee, 'id' | 'createdAt'>>
  ): Promise<Employee> {
    return this.transaction((db) => {
      if (!db.employees) db.employees = [];
      const idx = db.employees.findIndex((e) => e.id === id);
      if (idx === -1) throw new Error('الموظف المحدد غير موجود');

      db.employees[idx] = {
        ...db.employees[idx],
        ...updates,
        baseSalary: updates.baseSalary !== undefined ? Math.max(0, Number(updates.baseSalary) || 0) : db.employees[idx].baseSalary,
      };
      return db.employees[idx];
    });
  }

  async deleteEmployee(id: string): Promise<boolean> {
    return this.transaction((db) => {
      if (!db.employees) db.employees = [];
      const initialCount = db.employees.length;
      db.employees = db.employees.filter((e) => e.id !== id);
      return db.employees.length < initialCount;
    });
  }

  async getPayrollPayments(employeeId?: string): Promise<(PayrollPayment & { employeeName: string; employeeRole: string })[]> {
    await this.ensureLoaded();
    const payments = this.data.payrollPayments || [];
    const employees = this.data.employees || [];

    const filtered = employeeId ? payments.filter((p) => p.employeeId === employeeId) : payments;

    return filtered.map((p) => {
      const emp = employees.find((e) => e.id === p.employeeId);
      return {
        ...p,
        employeeName: emp?.name || 'موظف غير مسجل',
        employeeRole: emp?.role || '-',
      };
    });
  }

  async recordPayrollPayment(data: {
    employeeId: string;
    amount: number;
    month: string;
    paymentDate?: string;
    notes?: string;
  }): Promise<PayrollPayment> {
    return this.transaction((db) => {
      if (!db.employees) db.employees = [];
      if (!db.payrollPayments) db.payrollPayments = [];

      const emp = db.employees.find((e) => e.id === data.employeeId);
      if (!emp) throw new Error('الموظف المحدد غير مسجل بالنظام');

      const amount = Number(data.amount);
      if (isNaN(amount) || amount <= 0) {
        throw new Error('يرجى إدخال مبلغ سداد / مرتب صحيح أكبر من الصفر');
      }

      const month = (data.month || '').trim();
      if (!month) throw new Error('يرجى تحديد الشهر المستحق للصرف');

      const payment: PayrollPayment = {
        id: `pay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        employeeId: emp.id,
        amount,
        month,
        paymentDate: data.paymentDate || new Date().toISOString(),
        notes: data.notes?.trim() || '',
        createdAt: new Date().toISOString(),
      };

      db.payrollPayments.unshift(payment);
      return payment;
    });
  }

  async deletePayrollPayment(id: string): Promise<boolean> {
    return this.transaction((db) => {
      if (!db.payrollPayments) db.payrollPayments = [];
      const initialCount = db.payrollPayments.length;
      db.payrollPayments = db.payrollPayments.filter((p) => p.id !== id);
      return db.payrollPayments.length < initialCount;
    });
  }

  // -------------------------------------------------------------
  // AUTOMATED REAL-TIME PROFIT & LOSS ENGINE (بند الأرباح الصافية)
  // -------------------------------------------------------------
  async getProfitLossEngine() {
    await this.ensureLoaded();

    const invoices = this.data.invoices || [];
    const products = this.data.products || [];
    const batches = this.data.batches || [];
    const returns = this.data.returns || [];
    const payrollPayments = this.data.payrollPayments || [];
    const collections = this.data.collections || [];

    // 1. Total Revenue Calculation
    const totalRevenue = invoices.reduce((sum, inv) => sum + (Number(inv.totalAmount) || 0), 0);

    // Cash collected vs credit
    const cashFromDirectCashInvoices = invoices
      .filter((inv) => inv.paymentType === 'cash')
      .reduce((sum, inv) => sum + (Number(inv.totalAmount) || 0), 0);
    const cashDownPaymentsOnCredit = invoices
      .filter((inv) => inv.paymentType === 'credit')
      .reduce((sum, inv) => sum + (Number(inv.paidAmount) || 0), 0);
    const cashFromCollections = collections.reduce((sum, col) => sum + (Number(col.amount) || 0), 0);
    const totalCollectedCash = cashFromDirectCashInvoices + cashDownPaymentsOnCredit + cashFromCollections;

    const totalPendingCredit = Math.max(0, invoices.reduce((sum, inv) => {
      if (inv.paymentType === 'credit') {
        const remaining = (inv.totalAmount || 0) - (inv.paidAmount || 0);
        return sum + Math.max(0, remaining);
      }
      return sum;
    }, 0) - cashFromCollections);

    // 2. Cost of Goods Sold (COGS)
    const prodMap = new Map<string, Product>();
    products.forEach((p) => prodMap.set(p.id, p));

    const batchMap = new Map<string, InventoryBatch>();
    batches.forEach((b) => batchMap.set(b.id, b));

    let cogs = 0;
    const productSalesMap = new Map<string, { unitsSold: number; revenue: number; cost: number }>();

    for (const inv of invoices) {
      if (!inv.items || !Array.isArray(inv.items)) continue;
      for (const item of inv.items) {
        const prod = prodMap.get(item.productId);
        const batch = item.batchId ? batchMap.get(item.batchId) : undefined;
        // Determine unit cost: batch cost -> product cost -> 0
        const unitCost = batch?.unitCost !== undefined && batch.unitCost > 0 
          ? batch.unitCost 
          : (prod?.cost || 0);
        const lineCost = (Number(item.quantity) || 0) * unitCost;
        const lineRevenue = Number(item.totalPrice) || ((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0));

        cogs += lineCost;

        const curr = productSalesMap.get(item.productId) || { unitsSold: 0, revenue: 0, cost: 0 };
        curr.unitsSold += (Number(item.quantity) || 0);
        curr.revenue += lineRevenue;
        curr.cost += lineCost;
        productSalesMap.set(item.productId, curr);
      }
    }

    // 3. Gross Profit
    const grossProfit = totalRevenue - cogs;
    const grossMarginPercent = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    // 4. Operating Expenses & Deductions
    // A) Total Salaries Paid
    const totalSalaries = payrollPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    // B) Total Discounts Granted
    const totalDiscounts = invoices.reduce((sum, inv) => sum + (Number(inv.discount) || 0), 0);

    // C) Wastage & Returns Losses (Damaged / Expired stock loss)
    let totalWastageLoss = 0;
    for (const ret of returns) {
      if (ret.amount !== undefined && ret.amount > 0) {
        totalWastageLoss += Number(ret.amount);
      } else {
        const prod = prodMap.get(ret.productId);
        const batch = ret.batchId ? batchMap.get(ret.batchId) : undefined;
        const unitCost = batch?.unitCost !== undefined && batch.unitCost > 0 ? batch.unitCost : (prod?.cost || 0);
        totalWastageLoss += (Number(ret.quantity) || 0) * unitCost;
      }
    }

    const totalExpenses = totalSalaries + totalDiscounts + totalWastageLoss;

    // 5. Net Profit: Total Revenue - (COGS + Total Salaries + Total Wastage + Total Discounts)
    const netProfit = grossProfit - totalExpenses;
    const netMarginPercent = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    const summary: ProfitLossSummary = {
      totalRevenue,
      totalCollectedCash,
      totalPendingCredit,
      cogs,
      grossProfit,
      grossMarginPercent,
      totalSalaries,
      totalDiscounts,
      totalWastageLoss,
      totalExpenses,
      netProfit,
      netMarginPercent,
    };

    // 6. Treasury Cash Balance & Supplier Payables (رصيد الخزنة الفعلي والتزامات الموردين)
    const supplierPurchases = this.data.supplierPurchases || [];
    const supplierPayments = this.data.supplierPayments || [];
    const suppliers = this.data.suppliers || [];
    const advances = this.data.advances || [];

    const supplierCashPaid = supplierPurchases.reduce((sum, p) => sum + (Number(p.paidAmount) || 0), 0);
    const supplierExtraPayments = supplierPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const totalSupplierOutflow = supplierCashPaid + supplierExtraPayments;

    const totalSalariesOutflow = payrollPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const totalAdvancesOutflow = advances
      .filter((a) => a.status === 'approved')
      .reduce((sum, a) => sum + (Number(a.amount) || 0), 0);

    const totalCashOutflows = totalSupplierOutflow + totalSalariesOutflow + totalAdvancesOutflow;
    const currentTreasuryBalance = totalCollectedCash - totalCashOutflows;

    // Total supplier purchases & unpaid payables (فواتير الموردين الآجلة غير المسددة)
    const totalAllTimePurchases = supplierPurchases.reduce((sum, p) => sum + (Number(p.totalAmount) || 0), 0);
    const totalSupplierPayables = Math.max(0, totalAllTimePurchases - totalSupplierOutflow);
    const netFreeLiquidity = currentTreasuryBalance - totalSupplierPayables;
    const supplierCoverageRatio = totalSupplierPayables > 0
      ? (currentTreasuryBalance / totalSupplierPayables) * 100
      : 100;

    const treasury: TreasurySummary = {
      currentBalance: currentTreasuryBalance,
      totalInflows: totalCollectedCash,
      totalOutflows: totalCashOutflows,
      totalSupplierPayables,
      netFreeLiquidity,
      supplierCoverageRatio,
    };

    // Product profitability breakdown
    const productBreakdown = Array.from(productSalesMap.entries()).map(([productId, stats]) => {
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
    }).sort((a, b) => b.profit - a.profit);

    const comprehensiveData: ComprehensiveProfitLossData = {
      summary,
      treasury,
      productBreakdown,
      recentPayroll: payrollPayments.slice(0, 10).map((p) => {
        const emp = (this.data.employees || []).find((e) => e.id === p.employeeId);
        return {
          ...p,
          employeeName: emp?.name || 'موظف',
          employeeRole: emp?.role || '-',
        };
      }),
      rawInvoices: invoices,
      rawCollections: collections,
      rawPurchases: supplierPurchases,
      rawPayroll: payrollPayments,
      rawAdvances: advances,
      rawReturns: returns,
      rawBatches: batches,
      rawProducts: products,
      rawSuppliers: suppliers,
      rawSupplierPayments: supplierPayments,
    };

    return comprehensiveData;
  }

  // -------------------------------------------------------------
  // REP TARGETS & MONTHLY PERFORMANCE (تتبع أداء وتارجت المناديب)
  // -------------------------------------------------------------
  async getRepTargets(month?: string): Promise<RepTarget[]> {
    await this.ensureLoaded();
    const targets = this.data.repTargets || [];
    if (!month) return [...targets];
    return targets.filter((t) => t.month === month);
  }

  async setRepTarget(data: {
    repId: string;
    month: string;
    targetAmount: number;
    notes?: string;
  }): Promise<RepTarget> {
    return this.transaction((db) => {
      if (!db.repTargets) db.repTargets = [];
      const rep = db.users.find((u) => u.id === data.repId && u.role === 'rep');
      if (!rep) throw new Error('المندوب المحدد غير مسجل بالنظام');

      const targetAmount = Math.max(0, Number(data.targetAmount) || 0);
      const month = (data.month || '').trim();
      if (!month) throw new Error('يرجى تحديد الشهر المستهدف');

      const existingIdx = db.repTargets.findIndex(
        (t) => t.repId === data.repId && t.month === month
      );

      if (existingIdx !== -1) {
        db.repTargets[existingIdx] = {
          ...db.repTargets[existingIdx],
          targetAmount,
          notes: data.notes?.trim() || db.repTargets[existingIdx].notes,
          updatedAt: new Date().toISOString(),
        };
        return db.repTargets[existingIdx];
      }

      const newTarget: RepTarget = {
        id: `tgt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        repId: rep.id,
        month,
        targetAmount,
        notes: data.notes?.trim() || '',
        createdAt: new Date().toISOString(),
      };

      db.repTargets.push(newTarget);
      return newTarget;
    });
  }

  async getMonthlyRepsPerformance(targetMonth?: string) {
    await this.ensureLoaded();

    const reps = (this.data.users || []).filter((u) => u.role === 'rep');
    const invoices = this.data.invoices || [];
    const collections = this.data.collections || [];
    const targets = this.data.repTargets || [];

    // Determine current month if not provided
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const activeMonth = targetMonth || currentMonthStr;

    // Collect all available months from invoices and targets
    const monthsSet = new Set<string>();
    monthsSet.add(currentMonthStr);
    invoices.forEach((inv) => {
      if (inv.createdAt) {
        monthsSet.add(inv.createdAt.slice(0, 7));
      }
    });
    targets.forEach((t) => {
      if (t.month) monthsSet.add(t.month);
    });
    const availableMonths = Array.from(monthsSet).sort().reverse();

    // Filter transactions for active month
    const monthInvoices = invoices.filter((i) => i.createdAt && i.createdAt.startsWith(activeMonth));
    const monthCollections = collections.filter((c) => c.createdAt && c.createdAt.startsWith(activeMonth));

    const repsPerformance: RepMonthlyPerformance[] = reps.map((rep) => {
      const repInvoices = monthInvoices.filter((i) => i.repId === rep.id);
      const repCollections = monthCollections.filter((c) => c.repId === rep.id);
      const repTarget = targets.find((t) => t.repId === rep.id && t.month === activeMonth);

      const salesAmount = repInvoices.reduce((sum, inv) => sum + (Number(inv.totalAmount) || 0), 0);

      const cashFromInvoices = repInvoices.reduce((sum, inv) => {
        if (inv.paymentType === 'cash') return sum + (Number(inv.totalAmount) || 0);
        return sum + (Number(inv.paidAmount) || 0);
      }, 0);
      const cashFromCols = repCollections.reduce((sum, col) => sum + (Number(col.amount) || 0), 0);
      const collectedAmount = cashFromInvoices + cashFromCols;

      const targetAmount = repTarget?.targetAmount || 0;
      const achievementPercent = targetAmount > 0 ? (salesAmount / targetAmount) * 100 : 0;

      let status: RepMonthlyPerformance['status'] = 'no_target';
      if (targetAmount > 0) {
        if (salesAmount >= targetAmount) {
          status = 'achieved';
        } else if (achievementPercent >= 75) {
          status = 'near_target';
        } else {
          status = 'in_progress';
        }
      }

      return {
        repId: rep.id,
        repName: rep.name,
        repPhone: rep.phone,
        assignedRoute: rep.assignedRoute,
        month: activeMonth,
        targetAmount,
        salesAmount,
        collectedAmount,
        invoicesCount: repInvoices.length,
        achievementPercent,
        status,
      };
    });

    const totalTarget = repsPerformance.reduce((s, r) => s + r.targetAmount, 0);
    const totalSales = repsPerformance.reduce((s, r) => s + r.salesAmount, 0);
    const totalCollected = repsPerformance.reduce((s, r) => s + r.collectedAmount, 0);
    const overallAchievementPercent = totalTarget > 0 ? (totalSales / totalTarget) * 100 : 0;
    const achievedCount = repsPerformance.filter((r) => r.status === 'achieved').length;

    return {
      month: activeMonth,
      availableMonths,
      reps: repsPerformance,
      summary: {
        totalTarget,
        totalSales,
        totalCollected,
        overallAchievementPercent,
        achievedCount,
        totalRepsCount: reps.length,
      },
    };
  }

  // -------------------------------------------------------------
  // SYSTEM BACKUP & SECURE DATA WIPE (النسخ الاحتياطي ومسح البيانات)
  // -------------------------------------------------------------
  async getDatabaseStats() {
    await this.ensureLoaded();
    return {
      users: (this.data.users || []).length,
      categories: (this.data.categories || []).length,
      products: (this.data.products || []).length,
      batches: (this.data.batches || []).length,
      repInventory: (this.data.repInventory || []).length,
      clients: (this.data.clients || []).length,
      invoices: (this.data.invoices || []).length,
      returns: (this.data.returns || []).length,
      collections: (this.data.collections || []).length,
      settlements: (this.data.settlements || []).length,
      advances: (this.data.advances || []).length,
      suppliers: (this.data.suppliers || []).length,
      supplierPurchases: (this.data.supplierPurchases || []).length,
      supplierPayments: (this.data.supplierPayments || []).length,
      employees: (this.data.employees || []).length,
      payrollPayments: (this.data.payrollPayments || []).length,
      repTargets: (this.data.repTargets || []).length,
    };
  }

  async getFullBackup() {
    await this.ensureLoaded();
    const stats = await this.getDatabaseStats();
    return {
      metadata: {
        appName: 'Al-Waseet B2B Distribution ERP',
        appNameAr: 'نظام المراعي للتوزيع والتوريدات B2B',
        systemVersion: '2.0.0',
        exportDate: new Date().toISOString(),
        totalEntitiesCount: Object.values(stats).reduce((a, b) => a + b, 0),
        recordsSummary: stats,
      },
      database: {
        users: (this.data.users || []).map((u) => ({
          ...u,
          password: '***', // Mask password in backup export
        })),
        categories: this.data.categories || [],
        products: this.data.products || [],
        batches: this.data.batches || [],
        repInventory: this.data.repInventory || [],
        clients: this.data.clients || [],
        invoices: this.data.invoices || [],
        returns: this.data.returns || [],
        collections: this.data.collections || [],
        settlements: this.data.settlements || [],
        advances: this.data.advances || [],
        suppliers: this.data.suppliers || [],
        supplierPurchases: this.data.supplierPurchases || [],
        supplierPurchaseItems: this.data.supplierPurchaseItems || [],
        supplierPayments: this.data.supplierPayments || [],
        employees: this.data.employees || [],
        payrollPayments: this.data.payrollPayments || [],
        repTargets: this.data.repTargets || [],
      },
    };
  }

  async wipeDatabase(params: {
    mode: 'all' | 'transactions_only';
    adminPasswordConfirm: string;
    adminUsername?: string;
  }): Promise<{ success: boolean; message: string; mode: string }> {
    return this.transaction((db) => {
      // 1. Find Admin user
      const users = db.users || [];
      const adminUser =
        users.find((u) => u.username === (params.adminUsername || 'admin') && u.role === 'admin') ||
        users.find((u) => u.role === 'admin');

      if (!adminUser) {
        throw new Error('لم يتم العثور على حساب المدير العام للتحقق من الصلاحيات');
      }

      // 2. Strict Security Check: Verify Admin Password
      if (!params.adminPasswordConfirm || params.adminPasswordConfirm.trim() !== adminUser.password.trim()) {
        throw new Error('كلمة مرور المدير العام غير صحيحة! تم إلغاء العملية فوراً لحماية بيانات النظام.');
      }

      // 3. Perform the Wipe based on selected mode
      if (params.mode === 'all') {
        // Full Factory Reset: Wipe everything except the Admin account
        db.users = [adminUser];
        db.categories = [];
        db.products = [];
        db.batches = [];
        db.repInventory = [];
        db.clients = [];
        db.invoices = [];
        db.returns = [];
        db.collections = [];
        db.settlements = [];
        db.advances = [];
        db.suppliers = [];
        db.supplierPurchases = [];
        db.supplierPurchaseItems = [];
        db.supplierPayments = [];
        db.employees = [];
        db.payrollPayments = [];
        db.repTargets = [];

        return {
          success: true,
          mode: 'all',
          message: 'تمت إعادة ضبط المصنع ومسح كافة بيانات النظام بنجاح، مع الحفاظ التام على حساب وبيانات دخول المدير العام.',
        };
      } else {
        // Transactions Only Reset: Keep master records (categories, products, clients, suppliers, employees, users)
        // Wipe all operational / inventory / financial records
        db.batches = [];
        db.repInventory = [];
        db.invoices = [];
        db.returns = [];
        db.collections = [];
        db.settlements = [];
        db.advances = [];
        db.supplierPurchases = [];
        db.supplierPurchaseItems = [];
        db.supplierPayments = [];
        db.payrollPayments = [];
        db.repTargets = [];

        // Reset supplier dues
        if (db.suppliers) {
          db.suppliers.forEach((s) => {
            s.totalDue = 0;
          });
        }

        return {
          success: true,
          mode: 'transactions_only',
          message: 'تم تصفير ومسح كافة الحركات التشغيلية والمالية والمخزنية بنجاح، مع بقاء بيانات الأصناف والعملاء والموردين والموظفين.',
        };
      }
    });
  }

  async restoreBackup(backupPayload: any): Promise<{ success: boolean; message: string }> {
    return this.transaction((db) => {
      const incoming = backupPayload?.database || backupPayload;
      if (!incoming || typeof incoming !== 'object') {
        throw new Error('ملف النسخة الاحتياطية غير صالح أو تالف');
      }

      const existingUsers = db.users || [];
      const existingAdmin =
        existingUsers.find((u) => u.role === 'admin') || getInitialData().users[0];

      if (Array.isArray(incoming.users) && incoming.users.length > 0) {
        db.users = incoming.users.map((u: any) => {
          const prev = existingUsers.find((eu) => eu.id === u.id || eu.username === u.username);
          const password =
            !u.password || u.password === '***' ? prev?.password || '123' : u.password;
          return {
            ...u,
            password,
          };
        });
        if (!db.users.some((u) => u.role === 'admin')) {
          db.users.unshift(existingAdmin);
        }
      }

      if (Array.isArray(incoming.categories)) db.categories = incoming.categories;
      if (Array.isArray(incoming.products)) db.products = incoming.products;
      if (Array.isArray(incoming.batches)) db.batches = incoming.batches;
      if (Array.isArray(incoming.repInventory)) db.repInventory = incoming.repInventory;
      if (Array.isArray(incoming.clients)) db.clients = incoming.clients;
      if (Array.isArray(incoming.invoices)) db.invoices = incoming.invoices;
      if (Array.isArray(incoming.returns)) db.returns = incoming.returns;
      if (Array.isArray(incoming.collections)) db.collections = incoming.collections;
      if (Array.isArray(incoming.settlements)) db.settlements = incoming.settlements;
      if (Array.isArray(incoming.advances)) db.advances = incoming.advances;
      if (Array.isArray(incoming.suppliers)) db.suppliers = incoming.suppliers;
      if (Array.isArray(incoming.supplierPurchases)) db.supplierPurchases = incoming.supplierPurchases;
      if (Array.isArray(incoming.supplierPurchaseItems))
        db.supplierPurchaseItems = incoming.supplierPurchaseItems;
      if (Array.isArray(incoming.supplierPayments)) db.supplierPayments = incoming.supplierPayments;
      if (Array.isArray(incoming.employees)) db.employees = incoming.employees;
      if (Array.isArray(incoming.payrollPayments)) db.payrollPayments = incoming.payrollPayments;
      if (Array.isArray(incoming.repTargets)) db.repTargets = incoming.repTargets;

      return {
        success: true,
        message: 'تم استرجاع النسخة الاحتياطية وتحديث كافة بيانات المخازن والحسابات بنجاح!',
      };
    });
  }

  async seedDemoData(): Promise<{ success: boolean; message: string }> {
    return this.transaction((db) => {
      const now = new Date();
      const isoDaysAgo = (days: number, hourOffset = 0) => {
        const d = new Date(now.getTime() - days * 86400000 + hourOffset * 3600000);
        return d.toISOString();
      };
      const isoDaysAhead = (days: number) => {
        const d = new Date(now.getTime() + days * 86400000);
        return d.toISOString();
      };
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      const existingAdmin = db.users?.find((u) => u.role === 'admin') || {
        id: 'usr_admin',
        name: 'أ/ حازم أبو سيفة (المدير العام)',
        username: 'admin',
        password: '123',
        role: 'admin' as const,
        isActive: true,
        phone: '01000000001',
        assignedRoute: 'المركز الرئيسي - الإدارة العامة',
        createdAt: isoDaysAgo(60),
      };

      // 1. Users (Admin + 3 Field Sales Reps)
      db.users = [
        existingAdmin,
        {
          id: 'rep_1',
          name: 'أحمد سمير (مندوب خط مدينة نصر ومصر الجديدة)',
          username: 'rep1',
          password: '123',
          role: 'rep',
          isActive: true,
          phone: '01012345671',
          assignedRoute: 'خط شرق القاهرة - مدينة نصر ومصر الجديدة',
          createdAt: isoDaysAgo(45),
        },
        {
          id: 'rep_2',
          name: 'محمود طارق (مندوب خط المعادي والتجمع)',
          username: 'rep2',
          password: '123',
          role: 'rep',
          isActive: true,
          phone: '01122334455',
          assignedRoute: 'خط جنوب القاهرة - المعادي والتجمع الخامس',
          createdAt: isoDaysAgo(40),
        },
        {
          id: 'rep_3',
          name: 'كريم عادل (مندوب خط الجيزة والمهندسين)',
          username: 'rep3',
          password: '123',
          role: 'rep',
          isActive: true,
          phone: '01288776655',
          assignedRoute: 'خط الجيزة والمهندسين والدقي',
          createdAt: isoDaysAgo(30),
        },
      ];

      // 2. Categories
      db.categories = [
        { id: 'cat_dairy', name: 'ألبان طازجة', defaultShelfLifeDays: 7, createdAt: isoDaysAgo(45) },
        { id: 'cat_juice', name: 'عصائر طبيعية', defaultShelfLifeDays: 90, createdAt: isoDaysAgo(45) },
        { id: 'cat_cheese', name: 'أجبان ومنتجات ألبان', defaultShelfLifeDays: 60, createdAt: isoDaysAgo(45) },
        { id: 'cat_yogurt', name: 'زبادي ورايب', defaultShelfLifeDays: 14, createdAt: isoDaysAgo(45) },
      ];

      // 3. Products (8 B2B Distribution Products)
      db.products = [
        {
          id: 'prod_1',
          name: 'حليب كامل الدسم 1 لتر (كرتونة 12 عبوة)',
          category: 'dairy',
          shelfLifeDays: 7,
          price: 420,
          cost: 350,
          unit: 'كرتونة',
          createdAt: isoDaysAgo(40),
        },
        {
          id: 'prod_2',
          name: 'حليب خالي الدسم 1 لتر (كرتونة 12 عبوة)',
          category: 'dairy',
          shelfLifeDays: 7,
          price: 430,
          cost: 360,
          unit: 'كرتونة',
          createdAt: isoDaysAgo(40),
        },
        {
          id: 'prod_3',
          name: 'عصير مانجو طبيعي 1 لتر (كرتونة 12 عبوة)',
          category: 'juice',
          shelfLifeDays: 30,
          price: 380,
          cost: 305,
          unit: 'كرتونة',
          createdAt: isoDaysAgo(40),
        },
        {
          id: 'prod_4',
          name: 'عصير برتقال وتفاح 250 مل (كرتونة 27 عبوة)',
          category: 'juice',
          shelfLifeDays: 60,
          price: 295,
          cost: 235,
          unit: 'كرتونة',
          createdAt: isoDaysAgo(38),
        },
        {
          id: 'prod_5',
          name: 'جبنة فيتا طبيعي 500 جم (كرتونة 12 علبة)',
          category: 'أجبان ومنتجات ألبان',
          shelfLifeDays: 45,
          price: 540,
          cost: 450,
          unit: 'كرتونة',
          createdAt: isoDaysAgo(35),
        },
        {
          id: 'prod_6',
          name: 'زبادي طبيعي طازج (شرنك 24 كوب)',
          category: 'dairy',
          shelfLifeDays: 10,
          price: 190,
          cost: 150,
          unit: 'كرتونة',
          createdAt: isoDaysAgo(35),
        },
        {
          id: 'prod_7',
          name: 'لبن رايب طازج 450 مل (كرتونة 12 زجاجة)',
          category: 'dairy',
          shelfLifeDays: 7,
          price: 260,
          cost: 205,
          unit: 'كرتونة',
          createdAt: isoDaysAgo(30),
        },
        {
          id: 'prod_8',
          name: 'كريمة طهي وخفق 1 لتر (كرتونة 6 عبوات)',
          category: 'أجبان ومنتجات ألبان',
          shelfLifeDays: 30,
          price: 680,
          cost: 560,
          unit: 'كرتونة',
          createdAt: isoDaysAgo(28),
        },
      ];

      // 4. Suppliers
      db.suppliers = [
        {
          id: 'sup_1',
          name: 'شركة المراعي الخضراء للألبان والعصائر',
          phone: '01099887766',
          address: 'المنطقة الصناعية الثالثة - مدينة السادات',
          totalDue: 18500,
          createdAt: isoDaysAgo(45),
        },
        {
          id: 'sup_2',
          name: 'مصنع النيل للمنتجات الغذائية والأجبان',
          phone: '01233445566',
          address: 'المنطقة الصناعية - العاشر من رمضان',
          totalDue: 11200,
          createdAt: isoDaysAgo(40),
        },
        {
          id: 'sup_3',
          name: 'شركة الوادي لتعبئة العصائر الطبيعية',
          phone: '01155667788',
          address: 'المنطقة الصناعية - السادس من أكتوبر',
          totalDue: 0,
          createdAt: isoDaysAgo(35),
        },
      ];

      // 5. Supplier Purchases & Items
      const spItems1: SupplierPurchaseItem[] = [
        {
          id: 'spi_1',
          purchaseId: 'pur_1',
          productId: 'prod_1',
          productName: 'حليب كامل الدسم 1 لتر (كرتونة 12 عبوة)',
          quantity: 120,
          unitCost: 350,
          totalCost: 42000,
          productionDate: isoDaysAgo(2),
          expiryDate: isoDaysAhead(5),
          batchId: 'bat_1',
          createdAt: isoDaysAgo(2),
        },
        {
          id: 'spi_2',
          purchaseId: 'pur_1',
          productId: 'prod_3',
          productName: 'عصير مانجو طبيعي 1 لتر (كرتونة 12 عبوة)',
          quantity: 100,
          unitCost: 305,
          totalCost: 30500,
          productionDate: isoDaysAgo(3),
          expiryDate: isoDaysAhead(27),
          batchId: 'bat_3',
          createdAt: isoDaysAgo(2),
        },
      ];

      const spItems2: SupplierPurchaseItem[] = [
        {
          id: 'spi_3',
          purchaseId: 'pur_2',
          productId: 'prod_5',
          productName: 'جبنة فيتا طبيعي 500 جم (كرتونة 12 علبة)',
          quantity: 80,
          unitCost: 450,
          totalCost: 36000,
          productionDate: isoDaysAgo(4),
          expiryDate: isoDaysAhead(41),
          batchId: 'bat_5',
          createdAt: isoDaysAgo(4),
        },
        {
          id: 'spi_4',
          purchaseId: 'pur_2',
          productId: 'prod_6',
          productName: 'زبادي طبيعي طازج (شرنك 24 كوب)',
          quantity: 90,
          unitCost: 150,
          totalCost: 13500,
          productionDate: isoDaysAgo(1),
          expiryDate: isoDaysAhead(1),
          batchId: 'bat_6',
          createdAt: isoDaysAgo(1),
        },
      ];

      db.supplierPurchaseItems = [...spItems1, ...spItems2];
      db.supplierPurchases = [
        {
          id: 'pur_1',
          purchaseNumber: 'PUR-1001',
          supplierId: 'sup_1',
          totalAmount: 72500,
          paidAmount: 54000,
          remainingDue: 18500,
          paymentType: 'credit',
          notes: 'توريد دفعة ألبان وعصائر أسبوعية للمخزن الرئيسي',
          createdAt: isoDaysAgo(2),
          items: spItems1,
        },
        {
          id: 'pur_2',
          purchaseNumber: 'PUR-1002',
          supplierId: 'sup_2',
          totalAmount: 49500,
          paidAmount: 38300,
          remainingDue: 11200,
          paymentType: 'credit',
          notes: 'توريد أجبان وزبادي طازج',
          createdAt: isoDaysAgo(1),
          items: spItems2,
        },
      ];

      db.supplierPayments = [
        {
          id: 'spay_1',
          supplierId: 'sup_1',
          amount: 15000,
          notes: 'دفعة نقدية من حساب المراعي الخضراء',
          createdAt: isoDaysAgo(1),
        },
      ];

      // 6. Warehouse Batches (FIFO with varied expiry dates & low stock alerts)
      db.batches = [
        {
          id: 'bat_1',
          productId: 'prod_1',
          batchNumber: 'BAT-201',
          initialQuantity: 120,
          quantity: 65,
          productionDate: isoDaysAgo(1),
          expiryDate: isoDaysAhead(6),
          status: 'active',
          supplierId: 'sup_1',
          purchaseId: 'pur_1',
          purchaseItemId: 'spi_1',
          unitCost: 350,
          createdAt: isoDaysAgo(1),
        },
        {
          id: 'bat_2',
          productId: 'prod_2',
          batchNumber: 'BAT-202',
          initialQuantity: 80,
          quantity: 42,
          productionDate: isoDaysAgo(1),
          expiryDate: isoDaysAhead(5),
          status: 'active',
          unitCost: 360,
          createdAt: isoDaysAgo(1),
        },
        {
          id: 'bat_3',
          productId: 'prod_3',
          batchNumber: 'BAT-203',
          initialQuantity: 100,
          quantity: 58,
          productionDate: isoDaysAgo(3),
          expiryDate: isoDaysAhead(27),
          status: 'active',
          supplierId: 'sup_1',
          purchaseId: 'pur_1',
          purchaseItemId: 'spi_2',
          unitCost: 305,
          createdAt: isoDaysAgo(2),
        },
        {
          id: 'bat_4',
          productId: 'prod_4',
          batchNumber: 'BAT-204',
          initialQuantity: 90,
          quantity: 50,
          productionDate: isoDaysAgo(5),
          expiryDate: isoDaysAhead(55),
          status: 'active',
          unitCost: 235,
          createdAt: isoDaysAgo(5),
        },
        {
          id: 'bat_5',
          productId: 'prod_5',
          batchNumber: 'BAT-205',
          initialQuantity: 80,
          quantity: 44,
          productionDate: isoDaysAgo(4),
          expiryDate: isoDaysAhead(41),
          status: 'active',
          supplierId: 'sup_2',
          purchaseId: 'pur_2',
          purchaseItemId: 'spi_3',
          unitCost: 450,
          createdAt: isoDaysAgo(4),
        },
        {
          id: 'bat_6',
          productId: 'prod_6',
          batchNumber: 'BAT-206',
          initialQuantity: 90,
          quantity: 28,
          productionDate: isoDaysAgo(1),
          // Expiring soon (< 24 hours) to showcase FIFO urgent alert
          expiryDate: new Date(now.getTime() + 14 * 3600000).toISOString(),
          status: 'expiring_soon',
          supplierId: 'sup_2',
          purchaseId: 'pur_2',
          purchaseItemId: 'spi_4',
          unitCost: 150,
          createdAt: isoDaysAgo(1),
        },
        {
          id: 'bat_7',
          productId: 'prod_7',
          batchNumber: 'BAT-207',
          initialQuantity: 50,
          // Low stock (7 units) to showcase Low Stock Alert on Dashboard
          quantity: 7,
          productionDate: isoDaysAgo(1),
          expiryDate: isoDaysAhead(6),
          status: 'active',
          unitCost: 205,
          createdAt: isoDaysAgo(1),
        },
        {
          id: 'bat_8',
          productId: 'prod_8',
          batchNumber: 'BAT-208',
          initialQuantity: 40,
          // Low stock (5 units) to showcase Low Stock Alert on Dashboard
          quantity: 5,
          productionDate: isoDaysAgo(2),
          expiryDate: isoDaysAhead(28),
          status: 'active',
          unitCost: 560,
          createdAt: isoDaysAgo(2),
        },
      ];

      // 7. Rep Vehicle Inventory (بضاعة محملة حالياً بسيارات المناديب)
      db.repInventory = [
        {
          id: 'rinv_1',
          repId: 'rep_1',
          productId: 'prod_1',
          batchId: 'bat_1',
          quantity: 18,
          updatedAt: isoDaysAgo(0, -3),
        },
        {
          id: 'rinv_2',
          repId: 'rep_1',
          productId: 'prod_3',
          batchId: 'bat_3',
          quantity: 15,
          updatedAt: isoDaysAgo(0, -3),
        },
        {
          id: 'rinv_3',
          repId: 'rep_1',
          productId: 'prod_5',
          batchId: 'bat_5',
          quantity: 10,
          updatedAt: isoDaysAgo(0, -3),
        },
        {
          id: 'rinv_4',
          repId: 'rep_2',
          productId: 'prod_1',
          batchId: 'bat_1',
          quantity: 14,
          updatedAt: isoDaysAgo(0, -2),
        },
        {
          id: 'rinv_5',
          repId: 'rep_2',
          productId: 'prod_4',
          batchId: 'bat_4',
          quantity: 20,
          updatedAt: isoDaysAgo(0, -2),
        },
        {
          id: 'rinv_6',
          repId: 'rep_3',
          productId: 'prod_2',
          batchId: 'bat_2',
          quantity: 12,
          updatedAt: isoDaysAgo(0, -4),
        },
        {
          id: 'rinv_7',
          repId: 'rep_3',
          productId: 'prod_6',
          batchId: 'bat_6',
          quantity: 16,
          updatedAt: isoDaysAgo(0, -4),
        },
      ];

      // 8. Clients (سوبر ماركت وهايبر ماركت ومنافذ بيع)
      db.clients = [
        {
          id: 'cli_1',
          name: 'هايبر ماركت الفردوس - مدينة نصر',
          phone: '01011122233',
          address: 'شارع عباس العقاد - مدينة نصر',
          creditBalance: 6400,
          createdAt: isoDaysAgo(40),
        },
        {
          id: 'cli_2',
          name: 'أسواق العائلة الحديثة - مصر الجديدة',
          phone: '01022233344',
          address: 'ميدان الحجاز - مصر الجديدة',
          creditBalance: 0,
          createdAt: isoDaysAgo(38),
        },
        {
          id: 'cli_3',
          name: 'سوبر ماركت الهدى والنور - المعادي',
          phone: '01133344455',
          address: 'شارع 9 - المعادي',
          creditBalance: 4850,
          createdAt: isoDaysAgo(35),
        },
        {
          id: 'cli_4',
          name: 'ماركت الرحاب المركزي - التجمع الخامس',
          phone: '01244455566',
          address: 'شارع التسعين الشمالي - التجمع الخامس',
          creditBalance: 3200,
          createdAt: isoDaysAgo(30),
        },
        {
          id: 'cli_5',
          name: 'سوبر ماركت الصفوة - المهندسين',
          phone: '01055566677',
          address: 'شارع جامعة الدول العربية - المهندسين',
          creditBalance: 0,
          createdAt: isoDaysAgo(25),
        },
        {
          id: 'cli_6',
          name: 'ميني ماركت البركة - الدقي',
          phone: '01166677788',
          address: 'شارع مصدق - الدقي',
          creditBalance: 2150,
          createdAt: isoDaysAgo(20),
        },
      ];

      // 9. Invoices (فواتير مبيعات ميدانية + مبيعات مباشرة من المخزن)
      db.invoices = [
        {
          id: 'inv_1',
          invoiceNumber: 'INV-5001',
          repId: 'rep_1',
          clientId: 'cli_1',
          subtotal: 19400,
          discount: 400,
          returnsTotal: 0,
          totalAmount: 19000,
          paidAmount: 12600,
          paymentType: 'credit',
          notes: 'توريد صباحي لهايبر الفردوس - دفع جزء نقدي والباقي آجل',
          createdAt: isoDaysAgo(1, -2),
          items: [
            {
              id: 'ii_1',
              invoiceId: 'inv_1',
              productId: 'prod_1',
              batchId: 'bat_1',
              quantity: 20,
              unitPrice: 420,
              totalPrice: 8400,
            },
            {
              id: 'ii_2',
              invoiceId: 'inv_1',
              productId: 'prod_3',
              batchId: 'bat_3',
              quantity: 15,
              unitPrice: 380,
              totalPrice: 5700,
            },
            {
              id: 'ii_3',
              invoiceId: 'inv_1',
              productId: 'prod_5',
              batchId: 'bat_5',
              quantity: 10,
              unitPrice: 530,
              totalPrice: 5300,
            },
          ],
        },
        {
          id: 'inv_2',
          invoiceNumber: 'INV-5002',
          repId: 'rep_1',
          clientId: 'cli_2',
          subtotal: 13000,
          discount: 200,
          returnsTotal: 0,
          totalAmount: 12800,
          paidAmount: 12800,
          paymentType: 'cash',
          notes: 'فاتورة نقدية مسددة بالكامل',
          createdAt: isoDaysAgo(0, -5),
          items: [
            {
              id: 'ii_4',
              invoiceId: 'inv_2',
              productId: 'prod_2',
              batchId: 'bat_2',
              quantity: 15,
              unitPrice: 430,
              totalPrice: 6450,
            },
            {
              id: 'ii_5',
              invoiceId: 'inv_2',
              productId: 'prod_6',
              batchId: 'bat_6',
              quantity: 20,
              unitPrice: 190,
              totalPrice: 3800,
            },
            {
              id: 'ii_6',
              invoiceId: 'inv_2',
              productId: 'prod_4',
              batchId: 'bat_4',
              quantity: 9,
              unitPrice: 305,
              totalPrice: 2750,
            },
          ],
        },
        {
          id: 'inv_3',
          invoiceNumber: 'INV-5003',
          repId: 'rep_2',
          clientId: 'cli_3',
          subtotal: 14850,
          discount: 0,
          returnsTotal: 0,
          totalAmount: 14850,
          paidAmount: 10000,
          paymentType: 'credit',
          notes: 'توريد خط المعادي',
          createdAt: isoDaysAgo(0, -4),
          items: [
            {
              id: 'ii_7',
              invoiceId: 'inv_3',
              productId: 'prod_1',
              batchId: 'bat_1',
              quantity: 15,
              unitPrice: 420,
              totalPrice: 6300,
            },
            {
              id: 'ii_8',
              invoiceId: 'inv_3',
              productId: 'prod_5',
              batchId: 'bat_5',
              quantity: 10,
              unitPrice: 540,
              totalPrice: 5400,
            },
            {
              id: 'ii_9',
              invoiceId: 'inv_3',
              productId: 'prod_4',
              batchId: 'bat_4',
              quantity: 11,
              unitPrice: 286.36,
              totalPrice: 3150,
            },
          ],
        },
        {
          id: 'inv_4',
          invoiceNumber: 'INV-5004',
          repId: 'rep_3',
          clientId: 'cli_5',
          subtotal: 11200,
          discount: 200,
          returnsTotal: 0,
          totalAmount: 11000,
          paidAmount: 11000,
          paymentType: 'cash',
          notes: 'توريد نقدي خط المهندسين',
          createdAt: isoDaysAgo(0, -2),
          items: [
            {
              id: 'ii_10',
              invoiceId: 'inv_4',
              productId: 'prod_3',
              batchId: 'bat_3',
              quantity: 20,
              unitPrice: 380,
              totalPrice: 7600,
            },
            {
              id: 'ii_11',
              invoiceId: 'inv_4',
              productId: 'prod_6',
              batchId: 'bat_6',
              quantity: 19,
              unitPrice: 189.47,
              totalPrice: 3600,
            },
          ],
        },
        {
          id: 'inv_5',
          invoiceNumber: 'WH-5005',
          repId: existingAdmin.id,
          clientId: 'cli_4',
          subtotal: 16200,
          discount: 200,
          returnsTotal: 0,
          totalAmount: 16000,
          paidAmount: 12800,
          paymentType: 'credit',
          notes: 'بيع جملة مباشر من المخزن الرئيسي بمعرفة الإدارة',
          createdAt: isoDaysAgo(0, -1),
          items: [
            {
              id: 'ii_12',
              invoiceId: 'inv_5',
              productId: 'prod_8',
              batchId: 'bat_8',
              quantity: 15,
              unitPrice: 680,
              totalPrice: 10200,
            },
            {
              id: 'ii_13',
              invoiceId: 'inv_5',
              productId: 'prod_7',
              batchId: 'bat_7',
              quantity: 23,
              unitPrice: 260.87,
              totalPrice: 6000,
            },
          ],
        },
      ];

      // 10. Collections (تحصيلات مديونيات العملاء)
      db.collections = [
        {
          id: 'col_1',
          repId: 'rep_1',
          clientId: 'cli_1',
          amount: 4500,
          notes: 'تحصيل دفعة نقدية من حساب الأسبوع الماضي',
          createdAt: isoDaysAgo(0, -3),
        },
        {
          id: 'col_2',
          repId: 'rep_2',
          clientId: 'cli_3',
          amount: 3200,
          notes: 'تحصيل نقدي ميداني',
          createdAt: isoDaysAgo(0, -2),
        },
        {
          id: 'col_3',
          repId: existingAdmin.id,
          clientId: 'cli_6',
          amount: 2850,
          notes: 'تحصيل مباشر بمقر الإدارة والخزينة',
          createdAt: isoDaysAgo(0, -1),
        },
      ];

      // 11. Returns (مرتجعات وتوالف)
      db.returns = [
        {
          id: 'ret_1',
          repId: 'rep_1',
          productId: 'prod_6',
          batchId: 'bat_6',
          quantity: 2,
          amount: 380,
          reason: 'damaged',
          notes: 'عبوات تالفة أثناء النقل',
          createdAt: isoDaysAgo(1),
        },
      ];

      // 12. Settlements (تسويات وجرد نهاية اليوم)
      db.settlements = [
        {
          id: 'set_1',
          repId: 'rep_1',
          date: isoDaysAgo(1).split('T')[0],
          expectedCash: 29900,
          actualCash: 29900,
          cashDifference: 0,
          status: 'balanced',
          notes: 'تقفيل مطابق تماماً للنقدية وعهدة السيارة',
          createdAt: isoDaysAgo(1),
        },
        {
          id: 'set_2',
          repId: 'rep_2',
          date: isoDaysAgo(1).split('T')[0],
          expectedCash: 13200,
          actualCash: 13050,
          cashDifference: -150,
          status: 'discrepancy',
          notes: 'عجز بسيط 150 ج.م مسجل على حساب المندوب',
          createdAt: isoDaysAgo(1),
        },
      ];

      // 13. Rep Advances (سلف المناديب)
      db.advances = [
        {
          id: 'adv_1',
          repId: 'rep_1',
          amount: 1000,
          reason: 'مصاريف وقود وصيانة سريعة للسيارة بالخط',
          status: 'approved',
          managerNotes: 'تم الاعتماد والصرف من الخزينة',
          createdAt: isoDaysAgo(2),
          updatedAt: isoDaysAgo(2),
        },
        {
          id: 'adv_2',
          repId: 'rep_3',
          amount: 1500,
          reason: 'سلفة شخصية تخصم من راتب نهاية الشهر',
          status: 'pending',
          createdAt: isoDaysAgo(0, -2),
        },
      ];

      // 14. Employees & Payroll
      db.employees = [
        {
          id: 'emp_1',
          name: 'خالد عبد الرحمن',
          phone: '01098765432',
          role: 'أمين المخزن الرئيسي',
          baseSalary: 8500,
          createdAt: isoDaysAgo(50),
        },
        {
          id: 'emp_2',
          name: 'مصطفى حسن',
          phone: '01187654321',
          role: 'محاسب المبيعات والخزينة',
          baseSalary: 9500,
          createdAt: isoDaysAgo(50),
        },
        {
          id: 'emp_3',
          name: 'سيد إبراهيم',
          phone: '01276543210',
          role: 'مسؤول التحميل واللوجستيات',
          baseSalary: 6500,
          createdAt: isoDaysAgo(45),
        },
      ];

      db.payrollPayments = [
        {
          id: 'pay_1',
          employeeId: 'emp_1',
          amount: 4000,
          month: currentMonth,
          paymentDate: isoDaysAgo(3),
          notes: 'دفعة تحت حساب راتب الشهر',
          createdAt: isoDaysAgo(3),
        },
      ];

      // 15. Rep Monthly Targets
      db.repTargets = [
        {
          id: 'trg_1',
          repId: 'rep_1',
          month: currentMonth,
          targetAmount: 45000,
          notes: 'تارجت خط شرق القاهرة',
          createdAt: isoDaysAgo(10),
        },
        {
          id: 'trg_2',
          repId: 'rep_2',
          month: currentMonth,
          targetAmount: 35000,
          notes: 'تارجت خط المعادي والتجمع',
          createdAt: isoDaysAgo(10),
        },
        {
          id: 'trg_3',
          repId: 'rep_3',
          month: currentMonth,
          targetAmount: 30000,
          notes: 'تارجت خط الجيزة والمهندسين',
          createdAt: isoDaysAgo(10),
        },
      ];

      return {
        success: true,
        message:
          'تم تحميل البيانات التجريبية المتكاملة (أصناف، تشغيلات، مناديب، سيارات محملة، عملاء، فواتير، موردين، وخزينة) بنجاح لعرض النظام للعملاء!',
      };
    });
  }
}

export const dbStore = new DatabaseStore();
