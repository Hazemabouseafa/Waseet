import '../../../../core/constants/api_endpoints.dart';
import '../../../../core/errors/exceptions.dart';
import '../../../../core/network/dio_client.dart';
import '../models/client_model.dart';
import '../models/product_model.dart';
import '../models/invoice_model.dart';

abstract class SalesRemoteDataSource {
  Future<List<ClientModel>> getAssignedRoute();
  Future<List<ProductModel>> getProducts();
  Future<InvoiceModel> createInvoice(InvoiceModel invoice);
  Future<void> markStopVisited(String clientId);
}

class SalesRemoteDataSourceImpl implements SalesRemoteDataSource {
  final DioClient _dioClient;

  SalesRemoteDataSourceImpl(this._dioClient);

  @override
  Future<List<ClientModel>> getAssignedRoute() async {
    try {
      final response = await _dioClient.get(ApiEndpoints.assignedRoutes);
      if (response.statusCode == 200) {
        final data = response.data;
        if (data is List) {
          return data.map((json) => ClientModel.fromJson(json as Map<String, dynamic>)).toList();
        } else if (data is Map && data['data'] is List) {
          return (data['data'] as List)
              .map((json) => ClientModel.fromJson(json as Map<String, dynamic>))
              .toList();
        }
      }
      return [];
    } catch (e) {
      if (e is ServerException || e is NetworkException) rethrow;
      throw ServerException(message: 'تعذر جلب خط السير اليومي: ${e.toString()}');
    }
  }

  @override
  Future<List<ProductModel>> getProducts() async {
    try {
      final response = await _dioClient.get(ApiEndpoints.products);
      if (response.statusCode == 200) {
        final data = response.data;
        if (data is List) {
          return data.map((json) => ProductModel.fromJson(json as Map<String, dynamic>)).toList();
        } else if (data is Map && data['data'] is List) {
          return (data['data'] as List)
              .map((json) => ProductModel.fromJson(json as Map<String, dynamic>))
              .toList();
        }
      }
      return [];
    } catch (e) {
      if (e is ServerException || e is NetworkException) rethrow;
      throw ServerException(message: 'تعذر جلب قائمة المنتجات: ${e.toString()}');
    }
  }

  @override
  Future<InvoiceModel> createInvoice(InvoiceModel invoice) async {
    try {
      final response = await _dioClient.post(
        ApiEndpoints.invoices,
        data: invoice.toJson(),
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        final data = response.data;
        if (data is Map<String, dynamic>) {
          return InvoiceModel.fromJson(data['data'] ?? data);
        }
      }
      throw const ServerException(message: 'استجابة غير متوقعة عند إنشاء الفاتورة');
    } catch (e) {
      if (e is ServerException || e is NetworkException) rethrow;
      throw ServerException(message: 'فشل إرسال الفاتورة إلى VPS: ${e.toString()}');
    }
  }

  @override
  Future<void> markStopVisited(String clientId) async {
    try {
      await _dioClient.post(
        ApiEndpoints.completeRouteStop,
        data: {'clientId': clientId},
      );
    } catch (e) {
      if (e is ServerException || e is NetworkException) rethrow;
      throw ServerException(message: 'فشل تحديث حالة الزيارة');
    }
  }
}
