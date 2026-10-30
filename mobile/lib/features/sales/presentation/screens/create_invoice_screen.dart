import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_strings.dart';
import '../../../../core/utils/currency_formatter.dart';
import '../../../../core/utils/snackbar_service.dart';
import '../../domain/entities/client_entity.dart';
import '../providers/invoice_creation_provider.dart';
import '../providers/sales_rep_provider.dart';
import '../widgets/product_card_stepper.dart';

class CreateInvoiceScreen extends ConsumerStatefulWidget {
  const CreateInvoiceScreen({super.key});

  @override
  ConsumerState<CreateInvoiceScreen> createState() => _CreateInvoiceScreenState();
}

class _CreateInvoiceScreenState extends ConsumerState<CreateInvoiceScreen> {
  final _searchController = TextEditingController();
  final _discountController = TextEditingController();

  @override
  void dispose() {
    _searchController.dispose();
    _discountController.dispose();
    super.dispose();
  }

  void _showSuccessDialog(BuildContext context, String invoiceNumber, String clientName, double totalAmount) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => Directionality(
        textDirection: TextDirection.rtl,
        child: AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: Row(
            children: const [
              Icon(Icons.check_circle_rounded, color: AppColors.accentEmerald, size: 28),
              SizedBox(width: 8),
              Text(
                'تم إصدار الفاتورة بنجاح',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'رقم الفاتورة: $invoiceNumber',
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
              ),
              const SizedBox(height: 6),
              Text('العميل: $clientName'),
              const SizedBox(height: 6),
              Text(
                'الإجمالي الصافي: ${CurrencyFormatter.format(totalAmount)}',
                style: const TextStyle(
                  fontWeight: FontWeight.w800,
                  color: AppColors.accentEmerald,
                  fontSize: 16,
                ),
              ),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppColors.accentEmerald.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.cloud_done_rounded, color: AppColors.accentEmerald, size: 20),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'تم تسجيل البيانات في قاعدة بيانات VPS المركزية وتحديث المخزون فورياً.',
                        style: TextStyle(fontSize: 12, color: AppColors.accentEmeraldDark),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () {
                Navigator.pop(ctx);
                Navigator.pop(context);
              },
              child: const Text('إغلاق والعودة للرئيسية'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final invoiceState = ref.watch(invoiceCreationProvider);
    final salesRepState = ref.watch(salesRepProvider);
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    // Listen for error messages
    ref.listen(invoiceCreationProvider, (previous, next) {
      if (next.errorMessage != null && next.errorMessage != previous?.errorMessage) {
        SnackbarService.showError(next.errorMessage!);
      }
    });

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        appBar: AppBar(
          title: const Text(AppStrings.createInvoiceTitle),
          actions: [
            IconButton(
              icon: const Icon(Icons.refresh_rounded),
              tooltip: 'تحديث المنتجات والمخزون',
              onPressed: () => ref.read(invoiceCreationProvider.notifier).fetchProducts(),
            ),
          ],
        ),
        body: Column(
          children: [
            // Top Section: Client Selection Dropdown
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              color: isDark ? AppColors.cardDark : Colors.white,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    AppStrings.selectClient,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                      fontSize: 13,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                        color: isDark ? AppColors.borderDark : AppColors.borderLight,
                      ),
                    ),
                    child: DropdownButtonHideUnderline(
                      child: DropdownButton<ClientEntity>(
                        isExpanded: true,
                        value: invoiceState.selectedClient,
                        hint: Text(
                          AppStrings.selectClientHint,
                          style: theme.textTheme.bodyMedium?.copyWith(fontSize: 13),
                        ),
                        items: salesRepState.routeOutlets.map((client) {
                          return DropdownMenuItem<ClientEntity>(
                            value: client,
                            child: Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    client.name,
                                    style: const TextStyle(fontWeight: FontWeight.w600),
                                  ),
                                ),
                                Text(
                                  CurrencyFormatter.formatSimple(client.creditBalance),
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: client.creditBalance > 0
                                        ? AppColors.danger
                                        : AppColors.accentEmerald,
                                  ),
                                ),
                              ],
                            ),
                          );
                        }).toList(),
                        onChanged: (client) {
                          if (client != null) {
                            ref.read(invoiceCreationProvider.notifier).selectClient(client);
                          }
                        },
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // Search Bar for Product Catalog
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
              child: TextField(
                controller: _searchController,
                onChanged: (query) =>
                    ref.read(invoiceCreationProvider.notifier).searchProducts(query),
                decoration: InputDecoration(
                  hintText: AppStrings.searchProductHint,
                  prefixIcon: const Icon(Icons.search_rounded),
                  suffixIcon: _searchController.text.isNotEmpty
                      ? IconButton(
                          icon: const Icon(Icons.clear_rounded),
                          onPressed: () {
                            _searchController.clear();
                            ref.read(invoiceCreationProvider.notifier).searchProducts('');
                          },
                        )
                      : null,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                ),
              ),
            ),

            // Product Catalog List
            Expanded(
              child: invoiceState.isLoadingProducts
                  ? const Center(
                      child: CircularProgressIndicator(color: AppColors.accentEmerald),
                    )
                  : invoiceState.filteredProducts.isEmpty
                      ? Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.inventory_2_outlined,
                                  size: 48, color: theme.disabledColor),
                              const SizedBox(height: 12),
                              Text(
                                'لا توجد منتجات مطابقة للبحث أو بالمخزون',
                                style: theme.textTheme.bodyMedium?.copyWith(fontSize: 14),
                              ),
                            ],
                          ),
                        )
                      : ListView.builder(
                          padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                          itemCount: invoiceState.filteredProducts.length,
                          itemBuilder: (context, index) {
                            final product = invoiceState.filteredProducts[index];
                            final qty = invoiceState.itemQuantities[product.id] ?? 0;

                            return ProductCardStepper(
                              product: product,
                              quantity: qty,
                              onIncrement: () => ref
                                  .read(invoiceCreationProvider.notifier)
                                  .incrementQuantity(product),
                              onDecrement: () => ref
                                  .read(invoiceCreationProvider.notifier)
                                  .decrementQuantity(product),
                            );
                          },
                        ),
            ),

            // Cash Discount Input
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              decoration: BoxDecoration(
                color: isDark ? AppColors.cardDark : Colors.white,
                border: Border(
                  top: BorderSide(
                    color: isDark ? AppColors.borderDark : AppColors.borderLight,
                    width: 0.8,
                  ),
                ),
              ),
              child: Row(
                children: [
                  const Icon(Icons.discount_outlined, color: AppColors.accentEmerald, size: 20),
                  const SizedBox(width: 8),
                  Text(
                    AppStrings.discountLabel,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                      fontSize: 13,
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: SizedBox(
                      height: 42,
                      child: TextField(
                        controller: _discountController,
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                        textAlign: TextAlign.center,
                        style: const TextStyle(fontWeight: FontWeight.bold),
                        decoration: InputDecoration(
                          hintText: '0.00',
                          contentPadding: const EdgeInsets.symmetric(vertical: 8, horizontal: 8),
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                        ),
                        onChanged: (val) {
                          final parsed = double.tryParse(val) ?? 0.0;
                          ref.read(invoiceCreationProvider.notifier).setDiscount(parsed);
                        },
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // Sticky Bottom Summary Bar
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              decoration: BoxDecoration(
                color: isDark ? AppColors.primaryNavyDark : Colors.white,
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.08),
                    blurRadius: 10,
                    offset: const Offset(0, -4),
                  ),
                ],
                border: Border(
                  top: BorderSide(
                    color: isDark ? AppColors.borderDark : AppColors.borderLight,
                    width: 1,
                  ),
                ),
              ),
              child: SafeArea(
                top: false,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Total Summary Row
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '${AppStrings.totalItems} ${invoiceState.totalItemsCount} قطعة',
                              style: theme.textTheme.bodyMedium?.copyWith(fontSize: 12),
                            ),
                            if (invoiceState.discount > 0)
                              Text(
                                'الخصم: ${CurrencyFormatter.format(invoiceState.discount)}',
                                style: const TextStyle(fontSize: 12, color: AppColors.danger),
                              ),
                          ],
                        ),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(
                              AppStrings.netTotal,
                              style: theme.textTheme.bodyMedium?.copyWith(fontSize: 11),
                            ),
                            Text(
                              CurrencyFormatter.format(invoiceState.netTotal),
                              style: const TextStyle(
                                fontSize: 20,
                                fontWeight: FontWeight.w900,
                                color: AppColors.accentEmerald,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),

                    // Large Submit Button (Syncs to VPS)
                    ElevatedButton(
                      onPressed: invoiceState.isSubmitting
                          ? null
                          : () async {
                              final success = await ref
                                  .read(invoiceCreationProvider.notifier)
                                  .submitInvoice();

                              if (success && context.mounted) {
                                final created =
                                    ref.read(invoiceCreationProvider).lastCreatedInvoice;
                                final client =
                                    ref.read(invoiceCreationProvider).selectedClient;

                                _showSuccessDialog(
                                  context,
                                  created?.invoiceNumber ?? 'INV-NEW',
                                  client?.name ?? '',
                                  created?.totalAmount ?? 0.0,
                                );
                              }
                            },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.accentEmerald,
                        foregroundColor: Colors.white,
                        minimumSize: const Size(double.infinity, 52), // Large touch target
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      child: invoiceState.isSubmitting
                          ? const SizedBox(
                              height: 24,
                              width: 24,
                              child: CircularProgressIndicator(
                                strokeWidth: 2.5,
                                color: Colors.white,
                              ),
                            )
                          : Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: const [
                                Icon(Icons.cloud_upload_rounded, size: 22),
                                SizedBox(width: 8),
                                Text(
                                  AppStrings.submitInvoice,
                                  style: TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ],
                            ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
