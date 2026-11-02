import '../../domain/entities/client_entity.dart';

class ClientModel extends ClientEntity {
  const ClientModel({
    required super.id,
    required super.name,
    super.phone,
    super.address,
    super.creditBalance = 0.0,
    super.isVisitedToday = false,
  });

  factory ClientModel.fromJson(Map<String, dynamic> json) {
    return ClientModel(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      phone: json['phone']?.toString(),
      address: json['address']?.toString(),
      creditBalance: (json['creditBalance'] as num?)?.toDouble() ?? 0.0,
      isVisitedToday: json['isVisitedToday'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'phone': phone,
      'address': address,
      'creditBalance': creditBalance,
      'isVisitedToday': isVisitedToday,
    };
  }
}
