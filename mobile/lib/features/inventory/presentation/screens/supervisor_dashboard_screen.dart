import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_strings.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
import '../../../auth/presentation/screens/login_screen.dart';
import '../../../auth/presentation/widgets/vps_connection_badge.dart';
import '../providers/inventory_provider.dart';
import '../widgets/stock_data_table.dart';
import '../widgets/live_orders_feed.dart';

class SupervisorDashboardScreen extends ConsumerStatefulWidget {
  const SupervisorDashboardScreen({super.key});

  @override
  ConsumerState<SupervisorDashboardScreen> createState() =>
      _SupervisorDashboardScreenState();
}

class _SupervisorDashboardScreenState
    extends ConsumerState<SupervisorDashboardScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);
    final invState = ref.watch(inventoryProvider);
    final user = authState.user;

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        appBar: AppBar(
          title: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'لوحة تحكم المدير العام',
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                user?.name ?? 'الإدارة المركزية',
                style: TextStyle(
                  fontSize: 12,
                  color: Colors.white.withValues(alpha: 0.8),
                ),
              ),
            ],
          ),
          actions: [
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 8.0),
              child: Center(
                child: VpsConnectionBadge(compact: true),
              ),
            ),
            IconButton(
              icon: const Icon(Icons.refresh_rounded, color: Colors.white),
              tooltip: 'تحديث البيانات من VPS',
              onPressed: () => ref.read(inventoryProvider.notifier).refreshAll(),
            ),
            IconButton(
              icon: const Icon(Icons.logout_rounded, color: Colors.white),
              tooltip: 'تسجيل الخروج',
              onPressed: () async {
                await ref.read(authProvider.notifier).logout();
                if (context.mounted) {
                  Navigator.of(context).pushReplacement(
                    MaterialPageRoute(builder: (_) => const LoginScreen()),
                  );
                }
              },
            ),
          ],
          bottom: TabBar(
            controller: _tabController,
            indicatorColor: AppColors.accentEmerald,
            indicatorWeight: 3,
            labelColor: Colors.white,
            unselectedLabelColor: Colors.white.withValues(alpha: 0.7),
            labelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
            tabs: const [
              Tab(
                icon: Icon(Icons.sensors_rounded, size: 20),
                text: 'البث المباشر للطلبات',
              ),
              Tab(
                icon: Icon(Icons.warehouse_rounded, size: 20),
                text: 'جرد المخزون اللحظي',
              ),
            ],
          ),
        ),
        body: RefreshIndicator(
          color: AppColors.accentEmerald,
          onRefresh: () async {
            await ref.read(inventoryProvider.notifier).refreshAll();
            await ref.read(authProvider.notifier).refreshVpsStatus();
          },
          child: TabBarView(
            controller: _tabController,
            children: [
              // Tab 1: Live Feed / Stream
              SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          AppStrings.liveOrdersFeed,
                          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: AppColors.accentEmerald.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Row(
                            children: const [
                              Icon(Icons.circle, color: AppColors.accentEmerald, size: 8),
                              SizedBox(width: 6),
                              Text(
                                'مباشر من الميدان',
                                style: TextStyle(
                                  color: AppColors.accentEmerald,
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    if (invState.isLoading)
                      const Center(
                        child: Padding(
                          padding: EdgeInsets.all(40.0),
                          child: CircularProgressIndicator(color: AppColors.accentEmerald),
                        ),
                      )
                    else
                      LiveOrdersFeed(orders: invState.liveOrders),
                  ],
                ),
              ),

              // Tab 2: Inventory Stock Check
              SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    StockDataTable(
                      stocks: invState.filteredStocks,
                      lastSyncedAt: invState.lastSyncedAt,
                      onSearch: (q) => ref.read(inventoryProvider.notifier).searchStock(q),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
