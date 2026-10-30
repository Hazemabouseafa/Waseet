import '../entities/inventory_batch_entity.dart';
import '../entities/live_order_entity.dart';

abstract class InventoryRepository {
  Future<List<InventoryStockEntity>> getStockLevels();
  Future<List<LiveOrderEntity>> getLiveOrdersFeed();
}
