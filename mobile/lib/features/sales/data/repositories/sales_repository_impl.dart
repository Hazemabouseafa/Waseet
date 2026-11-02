import '../../domain/entities/client_entity.dart';
import '../../domain/entities/product_entity.dart';
import '../../domain/entities/invoice_entity.dart';
import '../../domain/repositories/sales_repository.dart';
import '../datasources/sales_remote_datasource.dart';
import '../models/invoice_model.dart';
import '../../../sync/data/datasources/offline_cache_datasource.dart';
import '../../../sync/data/models/cached_invoice_model.dart';

class SalesRepositoryImpl implements SalesRepository {
  final SalesRemoteDataSource _remoteDataSource;
  final OfflineCacheDataSource _offlineCacheDataSource;

  SalesRepositoryImpl({
    required SalesRemoteDataSource remoteDataSource,
    required OfflineCacheDataSource offlineCacheDataSource,
  })  : _remoteDataSource = remoteDataSource,
        _offlineCacheDataSource = offlineCacheDataSource;

  @override
  Future<List<ClientEntity>> getAssignedRoute() async {
    return await _remoteDataSource.getAssignedRoute();
  }

  @override
  Future<List<ProductEntity>> getProducts() async {
    return await _remoteDataSource.getProducts();
  }

  @override
  Future<InvoiceEntity> createInvoice(InvoiceEntity invoice) async {
    final invoiceModel = InvoiceModel(
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      repId: invoice.repId,
      clientId: invoice.clientId,
      clientName: invoice.clientName,
      subtotal: invoice.subtotal,
      discount: invoice.discount,
      totalAmount: invoice.totalAmount,
      paidAmount: invoice.paidAmount,
      paymentType: invoice.paymentType,
      items: invoice.items,
      createdAt: invoice.createdAt,
      isSynced: false,
    );

    try {
      // Attempt immediate live sync to central VPS
      final syncedInvoice = await _remoteDataSource.createInvoice(invoiceModel);
      return syncedInvoice;
    } catch (_) {
      // Offline fallback: store in local offline queue
      final cachedModel = CachedInvoiceModel.fromInvoiceEntity(invoice, status: 'pending');
      await _offlineCacheDataSource.cachePendingInvoice(cachedModel);

      // Return invoice entity with isSynced = false
      return invoice;
    }
  }

  @override
  Future<void> markStopVisited(String clientId) async {
    await _remoteDataSource.markStopVisited(clientId);
  }
}
