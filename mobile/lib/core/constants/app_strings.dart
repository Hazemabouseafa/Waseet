/// Arabic App Strings for "Al-Waseet" B2B System
class AppStrings {
  AppStrings._();

  // App Branding
  static const String appName = 'الوسيط';
  static const String appTagline = 'نظام المبيعات الميدانية وإدارة التوزيع B2B';

  // Login
  static const String loginTitle = 'تسجيل الدخول';
  static const String loginSubtitle = 'أدخل بيانات حسابك للمزامنة مع خادم المركز (VPS)';
  static const String usernameLabel = 'اسم المستخدم / كود المندوب';
  static const String passwordLabel = 'كلمة المرور';
  static const String loginButton = 'تسجيل الدخول';
  static const String loggingIn = 'جارٍ التحقق والاتصال بالخادم...';
  static const String vpsConnected = 'متصل بخادم VPS المركزي';
  static const String vpsDisconnected = 'غير متصل (الوضع غير المتصل)';
  static const String checkingConnection = 'جارٍ فحص الاتصال بالخادم...';

  // Dashboard - Sales Rep
  static const String repDashboardTitle = 'لوحة المندوب الميداني';
  static const String repGreeting = 'أهلاً بك، ';
  static const String todayRoute = 'خط السير اليومي';
  static const String todayInvoicesCount = 'فواتير اليوم';
  static const String totalCollectedCash = 'التحصيل النقدي';
  static const String visitedOutlets = 'المنافذ المزارة';
  static const String createInvoiceButton = 'إنشاء طلب / فاتورة جديدة';
  static const String routeOutletsList = 'قائمة منافذ خط السير اليومي';
  static const String visitDone = 'تمت الزيارة';
  static const String visitPending = 'قيد الانتظار';
  static const String markVisited = 'تحديد كتمت الزيارة';

  // Create Invoice
  static const String createInvoiceTitle = 'إنشاء فاتورة ميدانية';
  static const String selectClient = 'اختر العميل / المنفذ';
  static const String selectClientHint = 'اختر عميلاً من خط السير';
  static const String clientBalance = 'المديونية الحالية: ';
  static const String searchProductHint = 'ابحث عن صنف أو كود المنتج...';
  static const String availableStock = 'المخزون المتاح: ';
  static const String unitPrice = 'سعر الوحدة: ';
  static const String discountLabel = 'قيمة الخصم النقدي (ج.م)';
  static const String subtotal = 'المجموع قبل الخصم:';
  static const String discount = 'الخصم الممنوح:';
  static const String netTotal = 'الصافي النهائي:';
  static const String totalItems = 'عدد الأصناف:';
  static const String submitInvoice = 'إرسال الطلب وإصدار الفاتورة';
  static const String submittingInvoice = 'جارٍ حفظ وإرسال الفاتورة...';
  static const String invoiceSuccess = 'تم حفظ الفاتورة بنجاح في قاعدة بيانات VPS!';
  static const String invoiceOfflineSaved = 'تم حفظ الفاتورة محلياً وسيتم المزامنة تلقائياً عند عودة الاتصال.';
  static const String emptyCartError = 'برجاء اختيار صنف واحد على الأقل قبل إصدار الفاتورة.';
  static const String noClientSelected = 'يرجى اختيار العميل أولاً.';

  // Supervisor View
  static const String supervisorDashboardTitle = 'لوحة تحكم المدير / المشرف';
  static const String liveOrdersFeed = 'البث المباشر للطلبات الميدانية';
  static const String warehouseStock = 'جرد المخزون اللحظي';
  static const String repName = 'المندوب';
  static const String clientName = 'العميل';
  static const String amount = 'المبلغ';
  static const String time = 'التوقيت';
  static const String stockLow = 'مخزون منخفض';
  static const String stockGood = 'متوفر';
  static const String outOfStock = 'نفذ المخزون';

  // Offline & Sync
  static const String syncNow = 'مزامنة الآن';
  static const String syncing = 'جارٍ المزامنة مع VPS...';
  static const String pendingSyncOrders = 'فواتير غير مرفوعة بانتظار المزامنة';
  static const String syncCompleted = 'تمت مزامنة كافة الفواتير بنجاح!';
  static const String allDataSynced = 'جميع البيانات محدثة ومتزامنة مع الخادم';

  // Common & Errors
  static const String currency = 'ج.م';
  static const String currencyEgp = 'جنيه';
  static const String ok = 'حسناً';
  static const String cancel = 'إلغاء';
  static const String retry = 'إعادة المحاولة';
  static const String errorGeneric = 'حدث خطأ غير متوقع، يرجى المحاولة مرة أخرى.';
  static const String errorTimeout = 'انتهت مهلة الاتصال بالسيرفر. تحقق من جودة الشبكة.';
  static const String errorUnauthorized = 'انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجدداً.';
  static const String errorServer = 'خطأ في خادم VPS المركزي (500). تم إخطار الدعم الفني.';
  static const String errorNoInternet = 'لا يوجد اتصال بالإنترنت. تم تفعيل الوضع غير المتصل (Offline-First).';
}
