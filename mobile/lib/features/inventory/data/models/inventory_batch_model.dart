import '../../domain/entities/inventory_batch_entity.dart';

class InventoryStockModel extends InventoryStockEntity {
  const InventoryStockModel({
    required super.id,
    required super.productId,
    required super.productName,
    required super.category,
    required super.batchNumber,
    required super.warehouseQuantity,
    super.vanQuantity = 0,
    required super.totalQuantity,
    super.expiryDate,
    required super.lastUpdated,
  });

  factory InventoryStockModel.fromJson(Map<String, dynamic> json) {
    final product = json['product'] as Map<String, dynamic>?;
    final warehouseQty = (json['quantity'] as num?)?.toInt() ?? 0;
    final vanQty = (json['vanQuantity'] as num?)?.toInt() ?? 0;

    return InventoryStockModel(
      id: json['id']?.toString() ?? '',
      productId: json['productId']?.toString() ?? product?['id']?.toString() ?? '',
      productName: json['productName']?.toString() ?? product?['name']?.toString() ?? 'صنف غير محدد',
      category: json['category']?.toString() ?? product?['category']?.toString() ?? 'عام',
      batchNumber: json['batchNumber']?.toString() ?? 'BATCH-001',
      warehouseQuantity: warehouseQty,
      vanQuantity: vanQty,
      totalQuantity: warehouseQty + vanQty,
      expiryDate: json['expiryDate'] != null ? DateTime.tryParse(json['expiryDate'].toString()) : null,
      lastUpdated: json['updatedAt'] != null
          ? DateTime.tryParse(json['updatedAt'].toString()) ?? DateTime.now()
          : DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'productId': productId,
      'productName': productName,
      'category': category,
      'batchNumber': batchNumber,
      'warehouseQuantity': warehouseQuantity,
      'vanQuantity': vanQuantity,
      'totalQuantity': totalQuantity,
      'expiryDate': expiryDate?.toIso8601String(),
      'lastUpdated': lastUpdated.toIso8601String(),
    };
  }
}
