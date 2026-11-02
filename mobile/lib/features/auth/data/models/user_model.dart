import '../../domain/entities/user_entity.dart';

class UserModel extends UserEntity {
  const UserModel({
    required super.id,
    required super.name,
    required super.username,
    required super.role,
    super.phone,
    super.assignedRoute,
    super.token,
  });

  factory UserModel.fromJson(Map<String, dynamic> json, {String? token}) {
    // Some APIs wrap user in a 'user' key
    final userData = json.containsKey('user') && json['user'] is Map<String, dynamic>
        ? json['user'] as Map<String, dynamic>
        : json;

    return UserModel(
      id: userData['id']?.toString() ?? '',
      name: userData['name']?.toString() ?? '',
      username: userData['username']?.toString() ?? '',
      role: UserRole.fromString(userData['role']?.toString() ?? 'rep'),
      phone: userData['phone']?.toString(),
      assignedRoute: userData['assignedRoute']?.toString(),
      token: token ?? json['token']?.toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'username': username,
      'role': role.name,
      'phone': phone,
      'assignedRoute': assignedRoute,
      'token': token,
    };
  }
}
