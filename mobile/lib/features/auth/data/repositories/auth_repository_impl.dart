import '../../domain/entities/user_entity.dart';
import '../../domain/repositories/auth_repository.dart';
import '../datasources/auth_local_datasource.dart';
import '../datasources/auth_remote_datasource.dart';

class AuthRepositoryImpl implements AuthRepository {
  final AuthRemoteDataSource _remoteDataSource;
  final AuthLocalDataSource _localDataSource;

  AuthRepositoryImpl({
    required AuthRemoteDataSource remoteDataSource,
    required AuthLocalDataSource localDataSource,
  })  : _remoteDataSource = remoteDataSource,
        _localDataSource = localDataSource;

  @override
  Future<UserEntity> login({
    required String username,
    required String password,
  }) async {
    final userModel = await _remoteDataSource.login(
      username: username,
      password: password,
    );

    // Save token securely and cache user profile
    if (userModel.token != null) {
      await _localDataSource.saveToken(userModel.token!);
    }
    await _localDataSource.saveUser(userModel);

    return userModel;
  }

  @override
  Future<UserEntity?> getCurrentUser() async {
    return await _localDataSource.getCachedUser();
  }

  @override
  Future<void> logout() async {
    await _localDataSource.clearAuth();
  }

  @override
  Future<bool> checkVpsHealth() async {
    return await _remoteDataSource.pingVps();
  }
}
