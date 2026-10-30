class ClientEntity {
  final String id;
  final String name;
  final String? phone;
  final String? address;
  final double creditBalance;
  final bool isVisitedToday;

  const ClientEntity({
    required this.id,
    required this.name,
    this.phone,
    this.address,
    this.creditBalance = 0.0,
    this.isVisitedToday = false,
  });

  ClientEntity copyWith({
    String? id,
    String? name,
    String? phone,
    String? address,
    double? creditBalance,
    bool? isVisitedToday,
  }) {
    return ClientEntity(
      id: id ?? this.id,
      name: name ?? this.name,
      phone: phone ?? this.phone,
      address: address ?? this.address,
      creditBalance: creditBalance ?? this.creditBalance,
      isVisitedToday: isVisitedToday ?? this.isVisitedToday,
    );
  }
}
