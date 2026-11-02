import '../../domain/entities/invoice_entity.dart';

class InvoiceModel extends InvoiceEntity {
  const InvoiceModel({
    required super.id,
    required super.invoiceNumber,
    required super.repId,
    required super.clientId,
    super.clientName,
    required super.subtotal,
    required super.discount,
    required super.totalAmount,
    required super.paidAmount,
    super.paymentType = 'cash',
    required super.items,
    required super.createdAt,
    super.isSynced = true,
  });

  factory InvoiceModel.fromJson(Map<String, dynamic> json) {
    var rawItems = json['items'];
    List<InvoiceItemEntity> parsedItems = [];

    if (rawItems is List) {
      parsedItems = rawItems
          .whereType<Map<String, dynamic>>()
          .map((itemJson) => InvoiceItemEntity.fromJson(itemJson))
          .toList();
    }

    return InvoiceModel(
      id: json['id']?.toString() ?? '',
      invoiceNumber: json['invoiceNumber']?.toString() ?? '',
      repId: json['repId']?.toString() ?? '',
      clientId: json['clientId']?.toString() ?? '',
      clientName: json['clientName']?.toString() ?? json['client']?['name']?.toString(),
      subtotal: (json['subtotal'] as num?)?.toDouble() ?? 0.0,
      discount: (json['discount'] as num?)?.toDouble() ?? 0.0,
      totalAmount: (json['totalAmount'] as num?)?.toDouble() ?? 0.0,
      paidAmount: (json['paidAmount'] as num?)?.toDouble() ?? 0.0,
      paymentType: json['paymentType']?.toString() ?? 'cash',
      items: parsedItems,
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'].toString()) ?? DateTime.now()
          : DateTime.now(),
      isSynced: json['isSynced'] as bool? ?? true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'invoiceNumber': invoiceNumber,
      'repId': repId,
      'clientId': clientId,
      'clientName': clientName,
      'subtotal': subtotal,
      'discount': discount,
      'totalAmount': totalAmount,
      'paidAmount': paidAmount,
      'paymentType': paymentType,
      'items': items.map((i) => i.toJson()).toList(),
      'createdAt': createdAt.toIso8601String(),
      'isSynced': isSynced,
    };
  }
}
