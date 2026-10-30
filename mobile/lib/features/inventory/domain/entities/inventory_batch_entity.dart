class InventoryStockEntity {
  final String id;
  final String productId;
  final String productName;
  final String category;
  final String batchNumber;
  final int warehouseQuantity;
  final int vanQuantity;
  final int totalQuantity;
  final DateTime? expiryDate;
  final DateTime lastUpdated;

  const InventoryStockEntity({
    required this.id,
    required this.productId,
    required this.productName,
    required this.category,
    required this.batchNumber,
    required this.warehouseQuantity,
    this.vanQuantity = 0,
    required this.totalQuantity,
    this.expiryDate,
    required this.lastUpdated,
  });

  bool get isCriticalLow => totalQuantity <= 10;
  bool get isDepleted => totalQuantity <= 0;
}
