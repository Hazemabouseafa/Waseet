import '../../domain/entities/inventory_batch_entity.dart';
import '../../domain/entities/live_order_entity.dart';
import '../../domain/repositories/inventory_repository.dart';
import '../datasources/inventory_remote_datasource.dart';

class InventoryRepositoryImpl implements InventoryRepository {
  final InventoryRemoteDataSource _remoteDataSource;

  InventoryRepositoryImpl(this._remoteDataSource);

  @override
  Future<List<InventoryStockEntity>> getStockLevels() async {
    return await _remoteDataSource.getStockLevels();
  }

  @override
  Future<List<LiveOrderEntity>> getLiveOrdersFeed() async {
    return await _remoteDataSource.getLiveOrdersFeed();
  }
}
