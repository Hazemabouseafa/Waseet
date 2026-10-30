class InvoiceItemEntity {
  final String productId;
  final String productName;
  final String batchId;
  final int quantity;
  final double unitPrice;
  final double totalPrice;

  const InvoiceItemEntity({
    required this.productId,
    required this.productName,
    required this.batchId,
    required this.quantity,
    required this.unitPrice,
    required this.totalPrice,
  });

  Map<String, dynamic> toJson() {
    return {
      'productId': productId,
      'productName': productName,
      'batchId': batchId,
      'quantity': quantity,
      'unitPrice': unitPrice,
      'totalPrice': totalPrice,
    };
  }

  factory InvoiceItemEntity.fromJson(Map<String, dynamic> json) {
    return InvoiceItemEntity(
      productId: json['productId']?.toString() ?? '',
      productName: json['productName']?.toString() ?? '',
      batchId: json['batchId']?.toString() ?? '',
      quantity: (json['quantity'] as num?)?.toInt() ?? 0,
      unitPrice: (json['unitPrice'] as num?)?.toDouble() ?? 0.0,
      totalPrice: (json['totalPrice'] as num?)?.toDouble() ?? 0.0,
    );
  }
}

class InvoiceEntity {
  final String id;
  final String invoiceNumber;
  final String repId;
  final String clientId;
  final String? clientName;
  final double subtotal;
  final double discount;
  final double totalAmount;
  final double paidAmount;
  final String paymentType; // 'cash' or 'credit'
  final List<InvoiceItemEntity> items;
  final DateTime createdAt;
  final bool isSynced;

  const InvoiceEntity({
    required this.id,
    required this.invoiceNumber,
    required this.repId,
    required this.clientId,
    this.clientName,
    required this.subtotal,
    required this.discount,
    required this.totalAmount,
    required this.paidAmount,
    this.paymentType = 'cash',
    required this.items,
    required this.createdAt,
    this.isSynced = true,
  });
}
