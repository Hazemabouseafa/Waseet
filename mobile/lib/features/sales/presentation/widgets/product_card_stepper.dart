import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/utils/currency_formatter.dart';
import '../../domain/entities/product_entity.dart';

class ProductCardStepper extends StatelessWidget {
  final ProductEntity product;
  final int quantity;
  final VoidCallback onIncrement;
  final VoidCallback onDecrement;

  const ProductCardStepper({
    super.key,
    required this.product,
    required this.quantity,
    required this.onIncrement,
    required this.onDecrement,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isSelected = quantity > 0;

    // Stock status color
    final Color stockBadgeColor;
    final String stockText;

    if (product.availableStock <= 0) {
      stockBadgeColor = AppColors.danger;
      stockText = 'نفذ المخزون';
    } else if (product.isLowStock) {
      stockBadgeColor = AppColors.warning;
      stockText = 'متبقي ${product.availableStock} فقط';
    } else {
      stockBadgeColor = AppColors.accentEmerald;
      stockText = 'متوفر ${product.availableStock} ${product.unit}';
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isSelected
              ? AppColors.accentEmerald
              : (theme.brightness == Brightness.dark
                  ? AppColors.borderDark
                  : AppColors.borderLight),
          width: isSelected ? 1.8 : 1,
        ),
        boxShadow: [
          BoxShadow(
            color: isSelected
                ? AppColors.accentEmerald.withValues(alpha: 0.08)
                : Colors.black.withValues(alpha: 0.02),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Row 1: Name and Category badge
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  product.name,
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: stockBadgeColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  stockText,
                  style: TextStyle(
                    color: stockBadgeColor,
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),

          // Row 2: Price and Stepper Controls
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              // Price Info
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    CurrencyFormatter.format(product.price),
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                      color: theme.colorScheme.primary,
                    ),
                  ),
                  Text(
                    'لكل ${product.unit}',
                    style: theme.textTheme.bodyMedium?.copyWith(fontSize: 11),
                  ),
                ],
              ),

              // Stepper Controls (+ / -) with large touch targets (min 48x48)
              Row(
                children: [
                  // Decrement Button (-)
                  Material(
                    color: quantity > 0
                        ? AppColors.danger.withValues(alpha: 0.12)
                        : Colors.grey.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(10),
                    child: InkWell(
                      onTap: quantity > 0 ? onDecrement : null,
                      borderRadius: BorderRadius.circular(10),
                      child: SizedBox(
                        width: 48,
                        height: 48,
                        child: Center(
                          child: Icon(
                            Icons.remove_rounded,
                            size: 24,
                            color: quantity > 0 ? AppColors.danger : Colors.grey,
                          ),
                        ),
                      ),
                    ),
                  ),

                  // Quantity Counter Display
                  Container(
                    constraints: const BoxConstraints(minWidth: 44),
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                    child: Text(
                      quantity.toString(),
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w900,
                        color: quantity > 0 ? AppColors.accentEmerald : theme.textTheme.bodyMedium?.color,
                      ),
                    ),
                  ),

                  // Increment Button (+)
                  Material(
                    color: product.isInStock
                        ? AppColors.accentEmerald
                        : Colors.grey.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(10),
                    child: InkWell(
                      onTap: product.isInStock ? onIncrement : null,
                      borderRadius: BorderRadius.circular(10),
                      child: SizedBox(
                        width: 48,
                        height: 48,
                        child: Center(
                          child: Icon(
                            Icons.add_rounded,
                            size: 24,
                            color: product.isInStock ? Colors.white : Colors.grey,
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),

          // Subtotal for this item if selected
          if (quantity > 0) ...[
            const Divider(height: 18, thickness: 0.8),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'المجموع الجزئي:',
                  style: theme.textTheme.bodyMedium?.copyWith(fontSize: 12),
                ),
                Text(
                  CurrencyFormatter.format(product.price * quantity),
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                    color: AppColors.accentEmerald,
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
