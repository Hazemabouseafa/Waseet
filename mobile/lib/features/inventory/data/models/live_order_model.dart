import '../../domain/entities/live_order_entity.dart';

class LiveOrderModel extends LiveOrderEntity {
  const LiveOrderModel({
    required super.id,
    required super.invoiceNumber,
    required super.repName,
    required super.clientName,
    required super.totalAmount,
    required super.paymentType,
    required super.itemsCount,
    required super.timestamp,
  });

  factory LiveOrderModel.fromJson(Map<String, dynamic> json) {
    final rep = json['rep'] as Map<String, dynamic>?;
    final client = json['client'] as Map<String, dynamic>?;
    final itemsList = json['items'] as List<dynamic>?;

    return LiveOrderModel(
      id: json['id']?.toString() ?? '',
      invoiceNumber: json['invoiceNumber']?.toString() ?? 'INV-000',
      repName: json['repName']?.toString() ?? rep?['name']?.toString() ?? 'مندوب ميداني',
      clientName: json['clientName']?.toString() ?? client?['name']?.toString() ?? 'عميل',
      totalAmount: (json['totalAmount'] as num?)?.toDouble() ?? 0.0,
      paymentType: json['paymentType']?.toString() ?? 'cash',
      itemsCount: itemsList?.length ?? (json['itemsCount'] as num?)?.toInt() ?? 1,
      timestamp: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'].toString()) ?? DateTime.now()
          : DateTime.now(),
    );
  }
}
