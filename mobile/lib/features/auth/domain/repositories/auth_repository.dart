import '../entities/user_entity.dart';

abstract class AuthRepository {
  Future<UserEntity> login({
    required String username,
    required String password,
  });

  Future<UserEntity?> getCurrentUser();

  Future<void> logout();

  Future<bool> checkVpsHealth();
}
