import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../constants/app_strings.dart';
import '../utils/snackbar_service.dart';

class JwtInterceptor extends Interceptor {
  final FlutterSecureStorage _secureStorage;
  final void Function()? onSessionExpired;

  static const String tokenKey = 'al_waseet_jwt_token';
  static const String refreshTokenKey = 'al_waseet_refresh_token';

  JwtInterceptor({
    required FlutterSecureStorage secureStorage,
    this.onSessionExpired,
  }) : _secureStorage = secureStorage;

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    // Attach JWT Bearer token if available
    try {
      final token = await _secureStorage.read(key: tokenKey);
      if (token != null && token.isNotEmpty) {
        options.headers['Authorization'] = 'Bearer $token';
      }
    } catch (_) {
      // Storage read error ignored
    }

    options.headers['Accept'] = 'application/json';
    options.headers['Content-Type'] = 'application/json';

    return handler.next(options);
  }

  @override
  Future<void> onError(DioException err, ErrorInterceptorHandler handler) async {
    final statusCode = err.response?.statusCode;

    // Handle 401 Unauthorized / Token Expiration
    if (statusCode == 401) {
      await _secureStorage.delete(key: tokenKey);
      await _secureStorage.delete(key: refreshTokenKey);
      SnackbarService.showError(AppStrings.errorUnauthorized);
      onSessionExpired?.call();
      return handler.next(err);
    }

    // Handle 500 Internal Server Error
    if (statusCode != null && statusCode >= 500) {
      SnackbarService.showError(AppStrings.errorServer);
      return handler.next(err);
    }

    // Handle Timeouts
    if (err.type == DioExceptionType.connectionTimeout ||
        err.type == DioExceptionType.receiveTimeout ||
        err.type == DioExceptionType.sendTimeout) {
      SnackbarService.showWarning(AppStrings.errorTimeout);
      return handler.next(err);
    }

    // Handle No Network Connection
    if (err.type == DioExceptionType.connectionError) {
      SnackbarService.showWarning(AppStrings.errorNoInternet);
      return handler.next(err);
    }

    return handler.next(err);
  }
}
