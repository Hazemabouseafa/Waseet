import '../../domain/entities/product_entity.dart';

class ProductModel extends ProductEntity {
  const ProductModel({
    required super.id,
    required super.name,
    required super.category,
    required super.price,
    super.unit = 'كرتونة',
    super.availableStock = 0,
    super.batchId,
    super.batchNumber,
  });

  factory ProductModel.fromJson(Map<String, dynamic> json) {
    // If the backend returns batches, compute available stock or take direct availableStock
    int stock = 0;
    String? batchId;
    String? batchNumber;

    if (json.containsKey('availableStock')) {
      stock = (json['availableStock'] as num?)?.toInt() ?? 0;
    } else if (json['batches'] is List) {
      final batches = json['batches'] as List;
      for (final b in batches) {
        if (b is Map) {
          stock += (b['quantity'] as num?)?.toInt() ?? 0;
          batchId ??= b['id']?.toString();
          batchNumber ??= b['batchNumber']?.toString();
        }
      }
    }

    return ProductModel(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      category: json['category']?.toString() ?? 'عام',
      price: (json['price'] as num?)?.toDouble() ?? 0.0,
      unit: json['unit']?.toString() ?? 'كرتونة',
      availableStock: stock,
      batchId: batchId ?? json['batchId']?.toString(),
      batchNumber: batchNumber ?? json['batchNumber']?.toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'category': category,
      'price': price,
      'unit': unit,
      'availableStock': availableStock,
      'batchId': batchId,
      'batchNumber': batchNumber,
    };
  }
}
