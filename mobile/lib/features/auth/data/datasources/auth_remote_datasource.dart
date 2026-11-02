import '../../../../core/constants/api_endpoints.dart';
import '../../../../core/errors/exceptions.dart';
import '../../../../core/network/dio_client.dart';
import '../models/user_model.dart';

abstract class AuthRemoteDataSource {
  Future<UserModel> login({required String username, required String password});
  Future<UserModel> getMe();
  Future<bool> pingVps();
}

class AuthRemoteDataSourceImpl implements AuthRemoteDataSource {
  final DioClient _dioClient;

  AuthRemoteDataSourceImpl(this._dioClient);

  @override
  Future<UserModel> login({
    required String username,
    required String password,
  }) async {
    try {
      final response = await _dioClient.post(
        ApiEndpoints.login,
        data: {
          'username': username.trim(),
          'password': password.trim(),
        },
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        final data = response.data;
        if (data is Map<String, dynamic>) {
          final token = data['token']?.toString() ?? data['accessToken']?.toString();
          return UserModel.fromJson(data, token: token);
        }
      }
      throw const ServerException(message: 'استجابة غير صالحة من السيرفر المركزي');
    } catch (e) {
      if (e is ServerException || e is UnauthorizedException || e is NetworkException) {
        rethrow;
      }
      throw ServerException(message: 'فشل تسجيل الدخول: ${e.toString()}');
    }
  }

  @override
  Future<UserModel> getMe() async {
    final response = await _dioClient.get(ApiEndpoints.me);
    if (response.statusCode == 200 && response.data is Map<String, dynamic>) {
      return UserModel.fromJson(response.data as Map<String, dynamic>);
    }
    throw const ServerException(message: 'تعذر جلب بيانات المستخدم الحالية');
  }

  @override
  Future<bool> pingVps() async {
    return await _dioClient.checkVpsConnectivity();
  }
}
