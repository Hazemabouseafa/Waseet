import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/network/dio_client.dart';
import '../../../../core/utils/snackbar_service.dart';
import '../../auth/presentation/providers/auth_provider.dart';
import '../data/datasources/offline_cache_datasource.dart';
import '../data/models/cached_invoice_model.dart';
import '../../sales/presentation/providers/sales_rep_provider.dart';
import '../../sales/data/models/invoice_model.dart';

class SyncState {
  final bool isSyncing;
  final int pendingCount;
  final List<CachedInvoiceModel> pendingInvoices;
  final String? lastSyncMessage;

  const SyncState({
    this.isSyncing = false,
    this.pendingCount = 0,
    this.pendingInvoices = const [],
    this.lastSyncMessage,
  });

  SyncState copyWith({
    bool? isSyncing,
    int? pendingCount,
    List<CachedInvoiceModel>? pendingInvoices,
    String? lastSyncMessage,
  }) {
    return SyncState(
      isSyncing: isSyncing ?? this.isSyncing,
      pendingCount: pendingCount ?? this.pendingCount,
      pendingInvoices: pendingInvoices ?? this.pendingInvoices,
      lastSyncMessage: lastSyncMessage,
    );
  }
}

class SyncNotifier extends StateNotifier<SyncState> {
  final OfflineCacheDataSource _cacheDataSource;
  final Ref _ref;

  SyncNotifier(this._cacheDataSource, this._ref) : super(const SyncState()) {
    checkPendingQueue();
  }

  Future<void> checkPendingQueue() async {
    final list = await _cacheDataSource.getPendingInvoices();
    state = state.copyWith(
      pendingCount: list.length,
      pendingInvoices: list,
    );
  }

  Future<bool> syncPendingInvoices() async {
    final pending = await _cacheDataSource.getPendingInvoices();
    if (pending.isEmpty) {
      SnackbarService.showInfo('لا توجد فواتير معلقة بانتظار المزامنة');
      return true;
    }

    state = state.copyWith(isSyncing: true);

    try {
      // 1. Verify VPS connectivity first
      final dio = _ref.read(dioClientProvider);
      final isOnline = await dio.checkVpsConnectivity();

      if (!isOnline) {
        state = state.copyWith(isSyncing: false);
        SnackbarService.showWarning('تعذر الاتصال بسيرفر VPS. يرجى التأكد من توفر شبكة الإنترنت والمحاولة مجدداً');
        return false;
      }

      int syncedCount = 0;
      final salesRemote = _ref.read(salesRemoteDataSourceProvider);

      for (final cached in pending) {
        try {
          final invoiceModel = InvoiceModel(
            id: cached.id,
            invoiceNumber: cached.invoiceNumber,
            repId: cached.repId,
            clientId: cached.clientId,
            clientName: cached.clientName,
            subtotal: cached.subtotal,
            discount: cached.discount,
            totalAmount: cached.totalAmount,
            paidAmount: cached.paidAmount,
            paymentType: cached.paymentType,
            items: cached.items,
            createdAt: cached.createdAt,
            isSynced: true,
          );

          await salesRemote.createInvoice(invoiceModel);
          // Remove from local cache upon confirmed VPS receipt
          await _cacheDataSource.removeCachedInvoice(cached.id);
          syncedCount++;
        } catch (_) {
          // If individual invoice fails, keep in queue and continue
        }
      }

      await checkPendingQueue();
      state = state.copyWith(isSyncing: false);

      if (syncedCount > 0) {
        SnackbarService.showSuccess('تمت مزامنة $syncedCount فواتير بنجاح إلى قاعدة بيانات VPS!');
        // Refresh dashboard data
        _ref.read(salesRepProvider.notifier).loadDashboard();
      }

      return true;
    } catch (e) {
      state = state.copyWith(isSyncing: false);
      SnackbarService.showError('حدث خطأ أثناء المزامنة: ${e.toString()}');
      return false;
    }
  }
}

final syncProvider = StateNotifierProvider<SyncNotifier, SyncState>((ref) {
  return SyncNotifier(
    ref.watch(offlineCacheDataSourceProvider),
    ref,
  );
});
