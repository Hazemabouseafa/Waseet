import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_strings.dart';
import '../../../../core/utils/currency_formatter.dart';
import '../../domain/entities/client_entity.dart';

class RouteOutletsList extends StatelessWidget {
  final List<ClientEntity> outlets;
  final void Function(ClientEntity client) onSelectOutlet;
  final void Function(ClientEntity client) onMarkVisited;

  const RouteOutletsList({
    super.key,
    required this.outlets,
    required this.onSelectOutlet,
    required this.onMarkVisited,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    if (outlets.isEmpty) {
      return Container(
        padding: const EdgeInsets.symmetric(vertical: 36, horizontal: 16),
        alignment: Alignment.center,
        child: Column(
          children: [
            Icon(Icons.map_outlined, size: 48, color: theme.disabledColor),
            const SizedBox(height: 12),
            Text(
              'لا يوجد منافذ مسجلة في خط السير اليوم',
              style: theme.textTheme.bodyMedium?.copyWith(fontSize: 14),
            ),
          ],
        ),
      );
    }

    return ListView.separated(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: outlets.length,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (context, index) {
        final outlet = outlets[index];
        final isVisited = outlet.isVisitedToday;

        return Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: theme.cardColor,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isVisited
                  ? AppColors.accentEmerald.withValues(alpha: 0.3)
                  : (theme.brightness == Brightness.dark
                      ? AppColors.borderDark
                      : AppColors.borderLight),
            ),
          ),
          child: Row(
            children: [
              // Store Icon with Status Indicator
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: isVisited
                      ? AppColors.accentEmerald.withValues(alpha: 0.12)
                      : AppColors.primaryNavy.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(
                  isVisited ? Icons.check_circle_rounded : Icons.storefront_rounded,
                  color: isVisited ? AppColors.accentEmerald : AppColors.primaryNavy,
                  size: 22,
                ),
              ),
              const SizedBox(width: 12),

              // Outlet Details
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            outlet.name,
                            style: theme.textTheme.titleMedium?.copyWith(
                              fontSize: 15,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                        // Status Badge
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: isVisited
                                ? AppColors.accentEmerald.withValues(alpha: 0.12)
                                : AppColors.warning.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            isVisited ? AppStrings.visitDone : AppStrings.visitPending,
                            style: TextStyle(
                              color: isVisited ? AppColors.accentEmerald : AppColors.warning,
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    if (outlet.address != null) ...[
                      Text(
                        outlet.address!,
                        style: theme.textTheme.bodyMedium?.copyWith(fontSize: 12),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 2),
                    ],
                    Row(
                      children: [
                        Text(
                          'المديونية: ',
                          style: theme.textTheme.bodyMedium?.copyWith(fontSize: 11),
                        ),
                        Text(
                          CurrencyFormatter.formatSimple(outlet.creditBalance),
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            color: outlet.creditBalance > 0
                                ? AppColors.danger
                                : AppColors.accentEmerald,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),

              // Action: Quick Invoice Button
              IconButton(
                icon: const Icon(Icons.add_shopping_cart_rounded),
                tooltip: 'إنشاء فاتورة',
                color: AppColors.accentEmerald,
                onPressed: () => onSelectOutlet(outlet),
              ),
            ],
          ),
        );
      },
    );
  }
}
