class ProductEntity {
  final String id;
  final String name;
  final String category;
  final double price;
  final String unit;
  final int availableStock; // Synced directly from VPS PostgreSQL database
  final String? batchId;
  final String? batchNumber;

  const ProductEntity({
    required this.id,
    required this.name,
    required this.category,
    required this.price,
    this.unit = 'كرتونة',
    this.availableStock = 0,
    this.batchId,
    this.batchNumber,
  });

  bool get isInStock => availableStock > 0;
  bool get isLowStock => availableStock > 0 && availableStock <= 10;
}
