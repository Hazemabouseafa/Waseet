import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/network/dio_client.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
import '../../data/datasources/sales_remote_datasource.dart';
import '../../data/repositories/sales_repository_impl.dart';
import '../../domain/entities/client_entity.dart';
import '../../domain/repositories/sales_repository.dart';
import '../../../sync/data/datasources/offline_cache_datasource.dart';

final offlineCacheDataSourceProvider = Provider<OfflineCacheDataSource>((ref) {
  return OfflineCacheDataSourceImpl();
});

final salesRemoteDataSourceProvider = Provider<SalesRemoteDataSource>((ref) {
  final dio = ref.watch(dioClientProvider);
  return SalesRemoteDataSourceImpl(dio);
});

final salesRepositoryProvider = Provider<SalesRepository>((ref) {
  return SalesRepositoryImpl(
    remoteDataSource: ref.watch(salesRemoteDataSourceProvider),
    offlineCacheDataSource: ref.watch(offlineCacheDataSourceProvider),
  );
});

class SalesRepDashboardState {
  final bool isLoading;
  final List<ClientEntity> routeOutlets;
  final int todayInvoicesCount;
  final double totalCollectedCash;
  final int visitedOutletsCount;
  final String? errorMessage;

  const SalesRepDashboardState({
    this.isLoading = false,
    this.routeOutlets = const [],
    this.todayInvoicesCount = 0,
    this.totalCollectedCash = 0.0,
    this.visitedOutletsCount = 0,
    this.errorMessage,
  });

  SalesRepDashboardState copyWith({
    bool? isLoading,
    List<ClientEntity>? routeOutlets,
    int? todayInvoicesCount,
    double? totalCollectedCash,
    int? visitedOutletsCount,
    String? errorMessage,
  }) {
    return SalesRepDashboardState(
      isLoading: isLoading ?? this.isLoading,
      routeOutlets: routeOutlets ?? this.routeOutlets,
      todayInvoicesCount: todayInvoicesCount ?? this.todayInvoicesCount,
      totalCollectedCash: totalCollectedCash ?? this.totalCollectedCash,
      visitedOutletsCount: visitedOutletsCount ?? this.visitedOutletsCount,
      errorMessage: errorMessage,
    );
  }
}

class SalesRepNotifier extends StateNotifier<SalesRepDashboardState> {
  final SalesRepository _repository;

  SalesRepNotifier(this._repository) : super(const SalesRepDashboardState()) {
    loadDashboard();
  }

  Future<void> loadDashboard() async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final outlets = await _repository.getAssignedRoute();
      final visited = outlets.where((o) => o.isVisitedToday).length;

      // In real scenario, stats can also come from a dedicated stats endpoint
      state = state.copyWith(
        isLoading: false,
        routeOutlets: outlets,
        visitedOutletsCount: visited,
      );
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: e.toString().replaceAll('Exception: ', '').replaceAll('ServerException: ', ''),
      );
    }
  }

  void incrementTodayInvoices(double amount) {
    state = state.copyWith(
      todayInvoicesCount: state.todayInvoicesCount + 1,
      totalCollectedCash: state.totalCollectedCash + amount,
    );
  }

  Future<void> markOutletVisited(String clientId) async {
    try {
      await _repository.markStopVisited(clientId);
      final updatedList = state.routeOutlets.map((outlet) {
        if (outlet.id == clientId) {
          return outlet.copyWith(isVisitedToday: true);
        }
        return outlet;
      }).toList();

      state = state.copyWith(
        routeOutlets: updatedList,
        visitedOutletsCount: updatedList.where((o) => o.isVisitedToday).length,
      );
    } catch (_) {
      // Local fallback mark visited
      final updatedList = state.routeOutlets.map((outlet) {
        if (outlet.id == clientId) {
          return outlet.copyWith(isVisitedToday: true);
        }
        return outlet;
      }).toList();

      state = state.copyWith(
        routeOutlets: updatedList,
        visitedOutletsCount: updatedList.where((o) => o.isVisitedToday).length,
      );
    }
  }
}

final salesRepProvider =
    StateNotifierProvider<SalesRepNotifier, SalesRepDashboardState>((ref) {
  return SalesRepNotifier(ref.watch(salesRepositoryProvider));
});
