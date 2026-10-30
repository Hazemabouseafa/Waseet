import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../constants/api_endpoints.dart';
import '../errors/exceptions.dart';
import 'jwt_interceptor.dart';

class DioClient {
  late final Dio _dio;
  final FlutterSecureStorage _secureStorage;
  String _currentBaseUrl = ApiEndpoints.defaultBaseUrl;

  DioClient({
    FlutterSecureStorage? secureStorage,
    String? baseUrl,
    void Function()? onSessionExpired,
  }) : _secureStorage = secureStorage ?? const FlutterSecureStorage() {
    if (baseUrl != null && baseUrl.isNotEmpty) {
      _currentBaseUrl = baseUrl;
    }

    _dio = Dio(
      BaseOptions(
        baseUrl: _currentBaseUrl,
        connectTimeout: ApiEndpoints.connectTimeout,
        receiveTimeout: ApiEndpoints.receiveTimeout,
        sendTimeout: ApiEndpoints.sendTimeout,
        responseType: ResponseType.json,
      ),
    );

    _dio.interceptors.add(
      JwtInterceptor(
        secureStorage: _secureStorage,
        onSessionExpired: onSessionExpired,
      ),
    );
  }

  Dio get dio => _dio;
  String get baseUrl => _currentBaseUrl;

  void updateBaseUrl(String newUrl) {
    _currentBaseUrl = newUrl;
    _dio.options.baseUrl = newUrl;
  }

  /// Ping VPS Server to test live connection
  Future<bool> checkVpsConnectivity() async {
    try {
      final response = await _dio.get(
        ApiEndpoints.serverHealth,
        options: Options(
          sendTimeout: const Duration(seconds: 4),
          receiveTimeout: const Duration(seconds: 4),
        ),
      );
      return response.statusCode == 200;
    } catch (_) {
      return false;
    }
  }

  // HTTP GET
  Future<Response> get(
    String path, {
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
  }) async {
    try {
      final response = await _dio.get(
        path,
        queryParameters: queryParameters,
        options: options,
        cancelToken: cancelToken,
      );
      return response;
    } on DioException catch (e) {
      throw _handleDioError(e);
    }
  }

  // HTTP POST
  Future<Response> post(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
  }) async {
    try {
      final response = await _dio.post(
        path,
        data: data,
        queryParameters: queryParameters,
        options: options,
        cancelToken: cancelToken,
      );
      return response;
    } on DioException catch (e) {
      throw _handleDioError(e);
    }
  }

  // HTTP PUT
  Future<Response> put(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    try {
      final response = await _dio.put(
        path,
        data: data,
        queryParameters: queryParameters,
        options: options,
      );
      return response;
    } on DioException catch (e) {
      throw _handleDioError(e);
    }
  }

  // HTTP DELETE
  Future<Response> delete(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    try {
      final response = await _dio.delete(
        path,
        data: data,
        queryParameters: queryParameters,
        options: options,
      );
      return response;
    } on DioException catch (e) {
      throw _handleDioError(e);
    }
  }

  Exception _handleDioError(DioException error) {
    if (error.type == DioExceptionType.connectionTimeout ||
        error.type == DioExceptionType.receiveTimeout ||
        error.type == DioExceptionType.sendTimeout) {
      return const NetworkException('انتهت مهلة الاتصال بالخادم. تحقق من سرعة الإنترنت');
    }

    if (error.type == DioExceptionType.connectionError) {
      return const NetworkException('تعذر الاتصال بسيرفر VPS. تحقق من اتصالك أو عنوان السيرفر');
    }

    final response = error.response;
    if (response != null) {
      final statusCode = response.statusCode;
      final responseData = response.data;
      String errorMsg = 'حدث خطأ في استجابة الخادم ($statusCode)';

      if (responseData is Map && responseData['message'] != null) {
        errorMsg = responseData['message'].toString();
      } else if (responseData is Map && responseData['error'] != null) {
        errorMsg = responseData['error'].toString();
      }

      if (statusCode == 401) {
        return UnauthorizedException(errorMsg);
      }

      return ServerException(message: errorMsg, statusCode: statusCode);
    }

    return ServerException(message: error.message ?? 'خطأ غير معروف في الاتصال');
  }
}
