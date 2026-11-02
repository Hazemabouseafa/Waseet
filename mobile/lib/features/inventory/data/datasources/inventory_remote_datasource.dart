import '../../../../core/constants/api_endpoints.dart';
import '../../../../core/errors/exceptions.dart';
import '../../../../core/network/dio_client.dart';
import '../models/inventory_batch_model.dart';
import '../models/live_order_model.dart';

abstract class InventoryRemoteDataSource {
  Future<List<InventoryStockModel>> getStockLevels();
  Future<List<LiveOrderModel>> getLiveOrdersFeed();
}

class InventoryRemoteDataSourceImpl implements InventoryRemoteDataSource {
  final DioClient _dioClient;

  InventoryRemoteDataSourceImpl(this._dioClient);

  @override
  Future<List<InventoryStockModel>> getStockLevels() async {
    try {
      final response = await _dioClient.get(ApiEndpoints.inventoryStock);
      if (response.statusCode == 200) {
        final data = response.data;
        if (data is List) {
          return data
              .map((json) => InventoryStockModel.fromJson(json as Map<String, dynamic>))
              .toList();
        } else if (data is Map && data['data'] is List) {
          return (data['data'] as List)
              .map((json) => InventoryStockModel.fromJson(json as Map<String, dynamic>))
              .toList();
        }
      }
      return [];
    } catch (e) {
      if (e is ServerException || e is NetworkException) rethrow;
      throw ServerException(message: 'تعذر جلب بيانات جرد المخزون من VPS');
    }
  }

  @override
  Future<List<LiveOrderModel>> getLiveOrdersFeed() async {
    try {
      final response = await _dioClient.get(ApiEndpoints.liveOrdersFeed);
      if (response.statusCode == 200) {
        final data = response.data;
        if (data is List) {
          return data
              .map((json) => LiveOrderModel.fromJson(json as Map<String, dynamic>))
              .toList();
        } else if (data is Map && data['data'] is List) {
          return (data['data'] as List)
              .map((json) => LiveOrderModel.fromJson(json as Map<String, dynamic>))
              .toList();
        }
      }
      return [];
    } catch (e) {
      if (e is ServerException || e is NetworkException) rethrow;
      throw ServerException(message: 'تعذر جلب البث المباشر للطلبات من VPS');
    }
  }
}
