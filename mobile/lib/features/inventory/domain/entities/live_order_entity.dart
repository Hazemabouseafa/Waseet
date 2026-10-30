class LiveOrderEntity {
  final String id;
  final String invoiceNumber;
  final String repName;
  final String clientName;
  final double totalAmount;
  final String paymentType;
  final int itemsCount;
  final DateTime timestamp;

  const LiveOrderEntity({
    required this.id,
    required this.invoiceNumber,
    required this.repName,
    required this.clientName,
    required this.totalAmount,
    required this.paymentType,
    required this.itemsCount,
    required this.timestamp,
  });
}
