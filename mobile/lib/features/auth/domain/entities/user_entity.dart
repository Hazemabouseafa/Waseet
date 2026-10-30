enum UserRole {
  rep,
  admin;

  static UserRole fromString(String role) {
    switch (role.toLowerCase()) {
      case 'admin':
      case 'supervisor':
      case 'manager':
        return UserRole.admin;
      case 'rep':
      default:
        return UserRole.rep;
    }
  }

  String toDisplayString() {
    switch (this) {
      case UserRole.admin:
        return 'مدير عام / مشرف';
      case UserRole.rep:
        return 'مندوب مبيعات ميداني';
    }
  }
}

class UserEntity {
  final String id;
  final String name;
  final String username;
  final UserRole role;
  final String? phone;
  final String? assignedRoute;
  final String? token;

  const UserEntity({
    required this.id,
    required this.name,
    required this.username,
    required this.role,
    this.phone,
    this.assignedRoute,
    this.token,
  });

  bool get isAdmin => role == UserRole.admin;
  bool get isRep => role == UserRole.rep;
}
