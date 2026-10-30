/// Centralized API Endpoints for Central VPS Server Connection
class ApiEndpoints {
  ApiEndpoints._();

  // Central VPS / Local Dev Base URL (Configurable via environment or app settings)
  static const String defaultBaseUrl = 'http://localhost:8889/api/v1';

  // Request Timeouts
  static const Duration connectTimeout = Duration(seconds: 15);
  static const Duration receiveTimeout = Duration(seconds: 15);
  static const Duration sendTimeout = Duration(seconds: 15);

  // Authentication Endpoints
  static const String login = '/auth/login';
  static const String me = '/auth/me';
  static const String refreshToken = '/auth/refresh';

  // Sales & Routes Endpoints
  static const String assignedRoutes = '/routes/assigned';
  static const String completeRouteStop = '/routes/stops/complete';

  // Products & Catalog
  static const String products = '/products';

  // Invoices & Field Orders
  static const String invoices = '/invoices';
  static const String liveOrdersFeed = '/invoices/feed';
  static const String syncBatchInvoices = '/invoices/sync-batch';

  // Inventory & Warehouse
  static const String inventoryStock = '/inventory/stock';
  static const String warehouseDispatch = '/inventory/dispatch';

  // VPS Server Health / Connection Ping
  static const String serverHealth = '/health';
}
