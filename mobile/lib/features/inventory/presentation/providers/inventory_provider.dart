import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/network/dio_client.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
import '../../data/datasources/inventory_remote_datasource.dart';
import '../../data/repositories/inventory_repository_impl.dart';
import '../../domain/entities/inventory_batch_entity.dart';
import '../../domain/entities/live_order_entity.dart';
import '../../domain/repositories/inventory_repository.dart';

final inventoryRemoteDataSourceProvider = Provider<InventoryRemoteDataSource>((ref) {
  final dio = ref.watch(dioClientProvider);
  return InventoryRemoteDataSourceImpl(dio);
});

final inventoryRepositoryProvider = Provider<InventoryRepository>((ref) {
  return InventoryRepositoryImpl(ref.watch(inventoryRemoteDataSourceProvider));
});

class InventoryState {
  final bool isLoading;
  final List<InventoryStockEntity> stocks;
  final List<LiveOrderEntity> liveOrders;
  final DateTime lastSyncedAt;
  final String? errorMessage;
  final String searchQuery;

  InventoryState({
    this.isLoading = false,
    this.stocks = const [],
    this.liveOrders = const [],
    DateTime? lastSyncedAt,
    this.errorMessage,
    this.searchQuery = '',
  }) : lastSyncedAt = lastSyncedAt ?? DateTime.now();

  List<InventoryStockEntity> get filteredStocks {
    if (searchQuery.trim().isEmpty) return stocks;
    final q = searchQuery.toLowerCase().trim();
    return stocks.where((s) {
      return s.productName.toLowerCase().contains(q) ||
          s.batchNumber.toLowerCase().contains(q) ||
          s.category.toLowerCase().contains(q);
    }).toList();
  }

  InventoryState copyWith({
    bool? isLoading,
    List<InventoryStockEntity>? stocks,
    List<LiveOrderEntity>? liveOrders,
    DateTime? lastSyncedAt,
    String? errorMessage,
    String? searchQuery,
  }) {
    return InventoryState(
      isLoading: isLoading ?? this.isLoading,
      stocks: stocks ?? this.stocks,
      liveOrders: liveOrders ?? this.liveOrders,
      lastSyncedAt: lastSyncedAt ?? this.lastSyncedAt,
      errorMessage: errorMessage,
      searchQuery: searchQuery ?? this.searchQuery,
    );
  }
}

class InventoryNotifier extends StateNotifier<InventoryState> {
  final InventoryRepository _repository;

  InventoryNotifier(this._repository) : super(InventoryState()) {
    refreshAll();
  }

  Future<void> refreshAll() async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final stockResults = await _repository.getStockLevels();
      final orderResults = await _repository.getLiveOrdersFeed();

      state = state.copyWith(
        isLoading: false,
        stocks: stockResults,
        liveOrders: orderResults,
        lastSyncedAt: DateTime.now(),
      );
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: 'تعذر تحديث بيانات الإدارة: ${e.toString()}',
      );
    }
  }

  void searchStock(String query) {
    state = state.copyWith(searchQuery: query);
  }
}

final inventoryProvider =
    StateNotifierProvider<InventoryNotifier, InventoryState>((ref) {
  return InventoryNotifier(ref.watch(inventoryRepositoryProvider));
});
