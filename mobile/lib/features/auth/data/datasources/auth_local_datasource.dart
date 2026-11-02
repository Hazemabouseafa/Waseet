import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/user_model.dart';
import '../../../../core/network/jwt_interceptor.dart';

abstract class AuthLocalDataSource {
  Future<void> saveToken(String token);
  Future<String?> getToken();
  Future<void> saveUser(UserModel user);
  Future<UserModel?> getCachedUser();
  Future<void> clearAuth();
}

class AuthLocalDataSourceImpl implements AuthLocalDataSource {
  final FlutterSecureStorage _secureStorage;
  static const String _userCacheKey = 'al_waseet_cached_user';

  AuthLocalDataSourceImpl({
    FlutterSecureStorage? secureStorage,
  }) : _secureStorage = secureStorage ?? const FlutterSecureStorage();

  @override
  Future<void> saveToken(String token) async {
    await _secureStorage.write(key: JwtInterceptor.tokenKey, value: token);
  }

  @override
  Future<String?> getToken() async {
    return await _secureStorage.read(key: JwtInterceptor.tokenKey);
  }

  @override
  Future<void> saveUser(UserModel user) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_userCacheKey, jsonEncode(user.toJson()));
  }

  @override
  Future<UserModel?> getCachedUser() async {
    final prefs = await SharedPreferences.getInstance();
    final userJson = prefs.getString(_userCacheKey);
    if (userJson != null) {
      try {
        final decoded = jsonDecode(userJson) as Map<String, dynamic>;
        final token = await getToken();
        return UserModel.fromJson(decoded, token: token);
      } catch (_) {
        return null;
      }
    }
    return null;
  }

  @override
  Future<void> clearAuth() async {
    await _secureStorage.delete(key: JwtInterceptor.tokenKey);
    await _secureStorage.delete(key: JwtInterceptor.refreshTokenKey);
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_userCacheKey);
  }
}
