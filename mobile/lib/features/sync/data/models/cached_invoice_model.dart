import 'dart:convert';
import '../../sales/domain/entities/invoice_entity.dart';

class CachedInvoiceModel {
  final String id;
  final String invoiceNumber;
  final String repId;
  final String clientId;
  final String? clientName;
  final double subtotal;
  final double discount;
  final double totalAmount;
  final double paidAmount;
  final String paymentType;
  final List<InvoiceItemEntity> items;
  final DateTime createdAt;
  final String syncStatus; // 'pending', 'syncing', 'failed'

  const CachedInvoiceModel({
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
    this.syncStatus = 'pending',
  });

  factory CachedInvoiceModel.fromInvoiceEntity(InvoiceEntity entity, {String status = 'pending'}) {
    return CachedInvoiceModel(
      id: entity.id,
      invoiceNumber: entity.invoiceNumber,
      repId: entity.repId,
      clientId: entity.clientId,
      clientName: entity.clientName,
      subtotal: entity.subtotal,
      discount: entity.discount,
      totalAmount: entity.totalAmount,
      paidAmount: entity.paidAmount,
      paymentType: entity.paymentType,
      items: entity.items,
      createdAt: entity.createdAt,
      syncStatus: status,
    );
  }

  InvoiceEntity toInvoiceEntity() {
    return InvoiceEntity(
      id: id,
      invoiceNumber: invoiceNumber,
      repId: repId,
      clientId: clientId,
      clientName: clientName,
      subtotal: subtotal,
      discount: discount,
      totalAmount: totalAmount,
      paidAmount: paidAmount,
      paymentType: paymentType,
      items: items,
      createdAt: createdAt,
      isSynced: syncStatus == 'synced',
    );
  }

  Map<String, dynamic> toMap() {
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
      'items': items.map((x) => x.toJson()).toList(),
      'createdAt': createdAt.toIso8601String(),
      'syncStatus': syncStatus,
    };
  }

  factory CachedInvoiceModel.fromMap(Map<String, dynamic> map) {
    return CachedInvoiceModel(
      id: map['id'] ?? '',
      invoiceNumber: map['invoiceNumber'] ?? '',
      repId: map['repId'] ?? '',
      clientId: map['clientId'] ?? '',
      clientName: map['clientName'],
      subtotal: (map['subtotal'] as num?)?.toDouble() ?? 0.0,
      discount: (map['discount'] as num?)?.toDouble() ?? 0.0,
      totalAmount: (map['totalAmount'] as num?)?.toDouble() ?? 0.0,
      paidAmount: (map['paidAmount'] as num?)?.toDouble() ?? 0.0,
      paymentType: map['paymentType'] ?? 'cash',
      items: (map['items'] as List<dynamic>?)
              ?.map((x) => InvoiceItemEntity.fromJson(x as Map<String, dynamic>))
              .toList() ??
          [],
      createdAt: DateTime.tryParse(map['createdAt'] ?? '') ?? DateTime.now(),
      syncStatus: map['syncStatus'] ?? 'pending',
    );
  }

  String toJson() => json.encode(toMap());

  factory CachedInvoiceModel.fromJson(String source) =>
      CachedInvoiceModel.fromMap(json.decode(source));
}
