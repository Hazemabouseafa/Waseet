import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';
import '../../domain/entities/client_entity.dart';
import '../../domain/entities/product_entity.dart';
import '../../domain/entities/invoice_entity.dart';
import '../../domain/repositories/sales_repository.dart';
import 'sales_rep_provider.dart';
import '../../../auth/presentation/providers/auth_provider.dart';

class InvoiceCreationState {
  final bool isLoadingProducts;
  final bool isSubmitting;
  final ClientEntity? selectedClient;
  final List<ProductEntity> allProducts;
  final List<ProductEntity> filteredProducts;
  final Map<String, int> itemQuantities; // productId -> quantity
  final double discount;
  final String searchQuery;
  final String? errorMessage;
  final InvoiceEntity? lastCreatedInvoice;

  const InvoiceCreationState({
    this.isLoadingProducts = false,
    this.isSubmitting = false,
    this.selectedClient,
    this.allProducts = const [],
    this.filteredProducts = const [],
    this.itemQuantities = const {},
    this.discount = 0.0,
    this.searchQuery = '',
    this.errorMessage,
    this.lastCreatedInvoice,
  });

  // Calculations
  double get subtotal {
    double sum = 0.0;
    for (final product in allProducts) {
      final qty = itemQuantities[product.id] ?? 0;
      if (qty > 0) {
        sum += (product.price * qty);
      }
    }
    return sum;
  }

  double get netTotal {
    final total = subtotal - discount;
    return total > 0 ? total : 0.0;
  }

  int get totalItemsCount {
    int count = 0;
    itemQuantities.forEach((_, qty) {
      if (qty > 0) count += qty;
    });
    return count;
  }

  int get selectedProductsCount {
    int count = 0;
    itemQuantities.forEach((_, qty) {
      if (qty > 0) count += 1;
    });
    return count;
  }

  InvoiceCreationState copyWith({
    bool? isLoadingProducts,
    bool? isSubmitting,
    ClientEntity? selectedClient,
    List<ProductEntity>? allProducts,
    List<ProductEntity>? filteredProducts,
    Map<String, int>? itemQuantities,
    double? discount,
    String? searchQuery,
    String? errorMessage,
    InvoiceEntity? lastCreatedInvoice,
  }) {
    return InvoiceCreationState(
      isLoadingProducts: isLoadingProducts ?? this.isLoadingProducts,
      isSubmitting: isSubmitting ?? this.isSubmitting,
      selectedClient: selectedClient ?? this.selectedClient,
      allProducts: allProducts ?? this.allProducts,
      filteredProducts: filteredProducts ?? this.filteredProducts,
      itemQuantities: itemQuantities ?? this.itemQuantities,
      discount: discount ?? this.discount,
      searchQuery: searchQuery ?? this.searchQuery,
      errorMessage: errorMessage,
      lastCreatedInvoice: lastCreatedInvoice ?? this.lastCreatedInvoice,
    );
  }
}

class InvoiceCreationNotifier extends StateNotifier<InvoiceCreationState> {
  final SalesRepository _repository;
  final Ref _ref;

  InvoiceCreationNotifier(this._repository, this._ref)
      : super(const InvoiceCreationState()) {
    fetchProducts();
  }

  Future<void> fetchProducts() async {
    state = state.copyWith(isLoadingProducts: true, errorMessage: null);
    try {
      final products = await _repository.getProducts();
      state = state.copyWith(
        isLoadingProducts: false,
        allProducts: products,
        filteredProducts: products,
      );
    } catch (e) {
      state = state.copyWith(
        isLoadingProducts: false,
        errorMessage: 'فشل تحميل المنتجات: ${e.toString()}',
      );
    }
  }

  void selectClient(ClientEntity client) {
    state = state.copyWith(selectedClient: client);
  }

  void searchProducts(String query) {
    final cleanQuery = query.trim().toLowerCase();
    if (cleanQuery.isEmpty) {
      state = state.copyWith(
        searchQuery: '',
        filteredProducts: state.allProducts,
      );
    } else {
      final filtered = state.allProducts.where((p) {
        return p.name.toLowerCase().contains(cleanQuery) ||
            p.category.toLowerCase().contains(cleanQuery);
      }).toList();
      state = state.copyWith(
        searchQuery: query,
        filteredProducts: filtered,
      );
    }
  }

  void incrementQuantity(ProductEntity product) {
    final currentQty = state.itemQuantities[product.id] ?? 0;

    // Strict stock validation against VPS stock
    if (currentQty >= product.availableStock) {
      state = state.copyWith(
        errorMessage: 'عفواً، الكمية المطلوبة تتجاوز المخزون المتاح (${product.availableStock})',
      );
      return;
    }

    final newMap = Map<String, int>.from(state.itemQuantities);
    newMap[product.id] = currentQty + 1;
    state = state.copyWith(itemQuantities: newMap, errorMessage: null);
  }

  void decrementQuantity(ProductEntity product) {
    final currentQty = state.itemQuantities[product.id] ?? 0;
    if (currentQty <= 0) return;

    final newMap = Map<String, int>.from(state.itemQuantities);
    if (currentQty == 1) {
      newMap.remove(product.id);
    } else {
      newMap[product.id] = currentQty - 1;
    }
    state = state.copyWith(itemQuantities: newMap, errorMessage: null);
  }

  void setDiscount(double discount) {
    state = state.copyWith(discount: discount < 0 ? 0.0 : discount);
  }

  Future<bool> submitInvoice() async {
    if (state.selectedClient == null) {
      state = state.copyWith(errorMessage: 'يرجى اختيار العميل أولاً');
      return false;
    }

    if (state.selectedProductsCount == 0) {
      state = state.copyWith(errorMessage: 'يرجى إضافة صنف واحد على الأقل للفاتورة');
      return false;
    }

    state = state.copyWith(isSubmitting: true, errorMessage: null);

    try {
      final currentUser = _ref.read(authProvider).user;
      final repId = currentUser?.id ?? 'rep-01';

      final List<InvoiceItemEntity> items = [];
      state.itemQuantities.forEach((productId, qty) {
        if (qty > 0) {
          final product = state.allProducts.firstWhere((p) => p.id == productId);
          items.add(
            InvoiceItemEntity(
              productId: product.id,
              productName: product.name,
              batchId: product.batchId ?? 'batch-${product.id}',
              quantity: qty,
              unitPrice: product.price,
              totalPrice: product.price * qty,
            ),
          );
        }
      });

      final invoiceNumber = 'INV-${DateTime.now().millisecondsSinceEpoch.toString().substring(5)}';

      final newInvoice = InvoiceEntity(
        id: const Uuid().v4(),
        invoiceNumber: invoiceNumber,
        repId: repId,
        clientId: state.selectedClient!.id,
        clientName: state.selectedClient!.name,
        subtotal: state.subtotal,
        discount: state.discount,
        totalAmount: state.netTotal,
        paidAmount: state.netTotal,
        paymentType: 'cash',
        items: items,
        createdAt: DateTime.now(),
        isSynced: true,
      );

      final result = await _repository.createInvoice(newInvoice);

      // Update rep dashboard counters
      _ref.read(salesRepProvider.notifier).incrementTodayInvoices(result.totalAmount);
      _ref.read(salesRepProvider.notifier).markOutletVisited(state.selectedClient!.id);

      state = state.copyWith(
        isSubmitting: false,
        lastCreatedInvoice: result,
      );

      return true;
    } catch (e) {
      state = state.copyWith(
        isSubmitting: false,
        errorMessage: 'فشل حفظ الفاتورة: ${e.toString()}',
      );
      return false;
    }
  }

  void resetForm() {
    state = InvoiceCreationState(
      allProducts: state.allProducts,
      filteredProducts: state.allProducts,
    );
  }
}

final invoiceCreationProvider =
    StateNotifierProvider<InvoiceCreationNotifier, InvoiceCreationState>((ref) {
  return InvoiceCreationNotifier(
    ref.watch(salesRepositoryProvider),
    ref,
  );
});
