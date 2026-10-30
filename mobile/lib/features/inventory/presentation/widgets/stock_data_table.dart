import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../../core/constants/app_colors.dart';
import '../../domain/entities/inventory_batch_entity.dart';

class StockDataTable extends StatelessWidget {
  final List<InventoryStockEntity> stocks;
  final DateTime lastSyncedAt;
  final ValueChanged<String> onSearch;

  const StockDataTable({
    super.key,
    required this.stocks,
    required this.lastSyncedAt,
    required this.onSearch,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final timeFormat = DateFormat('hh:mm:ss a', 'ar');

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Header with Last-Sync Timestamp
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          decoration: BoxDecoration(
            color: AppColors.primaryNavy.withValues(alpha: 0.06),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  const Icon(Icons.sync_rounded, size: 16, color: AppColors.accentEmerald),
                  const SizedBox(width: 6),
                  Text(
                    'آخر تحديث للمخزون من VPS:',
                    style: theme.textTheme.bodyMedium?.copyWith(fontSize: 12),
                  ),
                ],
              ),
              Text(
                timeFormat.format(lastSyncedAt),
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: AppColors.primaryNavy,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),

        // Stock Search Input
        TextField(
          onChanged: onSearch,
          decoration: InputDecoration(
            hintText: 'ابحث عن صنف أو رقم التشغيلة...',
            prefixIcon: const Icon(Icons.search_rounded),
            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            filled: true,
            fillColor: theme.cardColor,
          ),
        ),
        const SizedBox(height: 12),

        // Data Table Cards
        if (stocks.isEmpty)
          Container(
            padding: const EdgeInsets.all(32),
            alignment: Alignment.center,
            child: Text(
              'لا توجد أصناف مسجلة في المخزون حالياً',
              style: theme.textTheme.bodyMedium,
            ),
          )
        else
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: DataTable(
                headingRowColor: WidgetStateProperty.all(
                  AppColors.primaryNavy.withValues(alpha: 0.1),
                ),
                horizontalMargin: 12,
                columnSpacing: 18,
                dataRowMinHeight: 48,
                dataRowMaxHeight: 56,
                columns: const [
                  DataColumn(
                    label: Text(
                      'الصنف',
                      style: TextStyle(fontWeight: FontWeight.bold),
                    ),
                  ),
                  DataColumn(
                    label: Text(
                      'التشغيلة',
                      style: TextStyle(fontWeight: FontWeight.bold),
                    ),
                  ),
                  DataColumn(
                    label: Text(
                      'المستودع',
                      style: TextStyle(fontWeight: FontWeight.bold),
                    ),
                  ),
                  DataColumn(
                    label: Text(
                      'السيارات',
                      style: TextStyle(fontWeight: FontWeight.bold),
                    ),
                  ),
                  DataColumn(
                    label: Text(
                      'الإجمالي',
                      style: TextStyle(fontWeight: FontWeight.bold),
                    ),
                  ),
                  DataColumn(
                    label: Text(
                      'الحالة',
                      style: TextStyle(fontWeight: FontWeight.bold),
                    ),
                  ),
                ],
                rows: stocks.map((stock) {
                  final isCritical = stock.isCriticalLow || stock.isDepleted;

                  return DataRow(
                    color: isCritical
                        ? WidgetStateProperty.all(AppColors.danger.withValues(alpha: 0.05))
                        : null,
                    cells: [
                      DataCell(
                        Text(
                          stock.productName,
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            color: isCritical ? AppColors.danger : null,
                          ),
                        ),
                      ),
                      DataCell(
                        Text(
                          stock.batchNumber,
                          style: const TextStyle(fontSize: 12),
                        ),
                      ),
                      DataCell(
                        Text(
                          '${stock.warehouseQuantity}',
                          style: const TextStyle(fontWeight: FontWeight.w600),
                        ),
                      ),
                      DataCell(
                        Text(
                          '${stock.vanQuantity}',
                          style: const TextStyle(fontWeight: FontWeight.w600),
                        ),
                      ),
                      DataCell(
                        Text(
                          '${stock.totalQuantity}',
                          style: TextStyle(
                            fontWeight: FontWeight.w900,
                            color: isCritical ? AppColors.danger : AppColors.accentEmerald,
                          ),
                        ),
                      ),
                      DataCell(
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: isCritical
                                ? AppColors.danger.withValues(alpha: 0.12)
                                : AppColors.accentEmerald.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            isCritical ? 'مخزون حرج!' : 'آمن',
                            style: TextStyle(
                              color: isCritical ? AppColors.danger : AppColors.accentEmerald,
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ),
                    ],
                  );
                }).toList(),
              ),
            ),
          ),
      ],
    );
  }
}
