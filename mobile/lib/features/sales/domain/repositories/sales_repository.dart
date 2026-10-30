import '../entities/client_entity.dart';
import '../entities/product_entity.dart';
import '../entities/invoice_entity.dart';

abstract class SalesRepository {
  Future<List<ClientEntity>> getAssignedRoute();
  Future<List<ProductEntity>> getProducts();
  Future<InvoiceEntity> createInvoice(InvoiceEntity invoice);
  Future<void> markStopVisited(String clientId);
}
