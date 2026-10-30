import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_strings.dart';
import '../../../../core/utils/currency_formatter.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
import '../../../auth/presentation/screens/login_screen.dart';
import '../../../auth/presentation/widgets/vps_connection_badge.dart';
import '../providers/sales_rep_provider.dart';
import '../providers/invoice_creation_provider.dart';
import '../widgets/quick_stats_card.dart';
import '../widgets/route_outlets_list.dart';
import '../../../sync/presentation/widgets/sync_status_bar.dart';
import 'create_invoice_screen.dart';

class SalesRepDashboardScreen extends ConsumerWidget {
  const SalesRepDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authProvider);
    final salesState = ref.watch(salesRepProvider);
    final user = authState.user;
    final theme = Theme.of(context);

    final routeName = user?.assignedRoute ?? 'خط سير شمال العاصمة';
    final repName = user?.name ?? 'المندوب';

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        appBar: AppBar(
          title: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '${AppStrings.repGreeting}$repName',
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
              const SizedBox(height: 2),
              Row(
                children: [
                  const Icon(Icons.route_outlined, size: 14, color: AppColors.accentEmerald),
                  const SizedBox(width: 4),
                  Text(
                    routeName,
                    style: TextStyle(
                      fontSize: 12,
                      color: Colors.white.withValues(alpha: 0.8),
                    ),
                  ),
                ],
              ),
            ],
          ),
          actions: [
            // VPS Real-time Connection Status Badge (Green dot)
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 8.0),
              child: Center(
                child: VpsConnectionBadge(compact: true),
              ),
            ),
            IconButton(
              icon: const Icon(Icons.logout_rounded, color: Colors.white),
              tooltip: 'تسجيل الخروج',
              onPressed: () async {
                final confirm = await showDialog<bool>(
                  context: context,
                  builder: (ctx) => AlertDialog(
                    title: const Text('تسجيل الخروج'),
                    content: const Text('هل أنت متأكد من رغبتك في تسجيل الخروج من النظام؟'),
                    actions: [
                      TextButton(
                        onPressed: () => Navigator.pop(ctx, false),
                        child: const Text('إلغاء'),
                      ),
                      ElevatedButton(
                        onPressed: () => Navigator.pop(ctx, true),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.danger,
                          minimumSize: const Size(80, 36),
                        ),
                        child: const Text('خروج'),
                      ),
                    ],
                  ),
                );

                if (confirm == true) {
                  await ref.read(authProvider.notifier).logout();
                  if (context.mounted) {
                    Navigator.of(context).pushReplacement(
                      MaterialPageRoute(builder: (_) => const LoginScreen()),
                    );
                  }
                }
              },
            ),
          ],
        ),
        body: Column(
          children: [
            // Persistent Offline Sync Status Bar
            const SyncStatusBar(),

            // Main Content Area
            Expanded(
              child: RefreshIndicator(
                color: AppColors.accentEmerald,
                onRefresh: () async {
                  await ref.read(salesRepProvider.notifier).loadDashboard();
                  await ref.read(authProvider.notifier).refreshVpsStatus();
                },
                child: SingleChildScrollView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // Prominent Action Banner to Create Invoice
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            colors: [AppColors.primaryNavy, AppColors.primaryNavyLight],
                            begin: Alignment.topRight,
                            end: Alignment.bottomLeft,
                          ),
                          borderRadius: BorderRadius.circular(16),
                          boxShadow: [
                            BoxShadow(
                              color: AppColors.primaryNavy.withValues(alpha: 0.2),
                              blurRadius: 10,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        child: Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: AppColors.accentEmerald,
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: const Icon(
                                Icons.post_add_rounded,
                                color: Colors.white,
                                size: 28,
                              ),
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text(
                                    'إصدار فاتورة وطلب ميداني',
                                    style: TextStyle(
                                      fontSize: 16,
                                      fontWeight: FontWeight.bold,
                                      color: Colors.white,
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    'تسجيل مبيعات لحظية مربوطة بـ VPS',
                                    style: TextStyle(
                                      fontSize: 12,
                                      color: Colors.white.withValues(alpha: 0.8),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            ElevatedButton(
                              onPressed: () {
                                ref.read(invoiceCreationProvider.notifier).resetForm();
                                Navigator.of(context).push(
                                  MaterialPageRoute(
                                    builder: (_) => const CreateInvoiceScreen(),
                                  ),
                                );
                              },
                              style: ElevatedButton.styleFrom(
                                backgroundColor: AppColors.accentEmerald,
                                foregroundColor: Colors.white,
                                minimumSize: const Size(96, 44),
                                padding: const EdgeInsets.symmetric(horizontal: 14),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(10),
                                ),
                              ),
                              child: const Text(
                                'إنشاء الآن',
                                style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 18),

                      // Section Title: Quick Stats Row
                      Text(
                        'إحصائيات اليوم الميدانية',
                        style: theme.textTheme.titleMedium?.copyWith(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 10),

                      // Quick Stats Row (Cards)
                      Row(
                        children: [
                          QuickStatsCard(
                            title: AppStrings.todayInvoicesCount,
                            value: '${salesState.todayInvoicesCount}',
                            icon: Icons.receipt_long_rounded,
                            color: AppColors.info,
                          ),
                          const SizedBox(width: 10),
                          QuickStatsCard(
                            title: AppStrings.totalCollectedCash,
                            value: CurrencyFormatter.formatSimple(salesState.totalCollectedCash),
                            icon: Icons.payments_rounded,
                            color: AppColors.accentEmerald,
                          ),
                          const SizedBox(width: 10),
                          QuickStatsCard(
                            title: AppStrings.visitedOutlets,
                            value: '${salesState.visitedOutletsCount}/${salesState.routeOutlets.length}',
                            icon: Icons.check_circle_outline_rounded,
                            color: AppColors.warning,
                          ),
                        ],
                      ),
                      const SizedBox(height: 24),

                      // Section Title: Route Outlets List
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            AppStrings.routeOutletsList,
                            style: theme.textTheme.titleMedium?.copyWith(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          Text(
                            '${salesState.routeOutlets.length} منافذ',
                            style: theme.textTheme.bodyMedium?.copyWith(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              color: AppColors.accentEmerald,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),

                      // Assigned Outlets List
                      if (salesState.isLoading)
                        const Center(
                          child: Padding(
                            padding: EdgeInsets.all(32.0),
                            child: CircularProgressIndicator(color: AppColors.accentEmerald),
                          ),
                        )
                      else
                        RouteOutletsList(
                          outlets: salesState.routeOutlets,
                          onSelectOutlet: (client) {
                            ref.read(invoiceCreationProvider.notifier).resetForm();
                            ref.read(invoiceCreationProvider.notifier).selectClient(client);
                            Navigator.of(context).push(
                              MaterialPageRoute(
                                builder: (_) => const CreateInvoiceScreen(),
                              ),
                            );
                          },
                          onMarkVisited: (client) {
                            ref.read(salesRepProvider.notifier).markOutletVisited(client.id);
                          },
                        ),
                      const SizedBox(height: 40),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
        floatingActionButton: FloatingActionButton.extended(
          onPressed: () {
            ref.read(invoiceCreationProvider.notifier).resetForm();
            Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const CreateInvoiceScreen()),
            );
          },
          backgroundColor: AppColors.accentEmerald,
          foregroundColor: Colors.white,
          icon: const Icon(Icons.add_shopping_cart_rounded),
          label: const Text(
            'فاتورة جديدة',
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
          ),
        ),
      ),
    );
  }
}
