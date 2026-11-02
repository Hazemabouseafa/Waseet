import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/cached_invoice_model.dart';

abstract class OfflineCacheDataSource {
  Future<void> cachePendingInvoice(CachedInvoiceModel invoice);
  Future<List<CachedInvoiceModel>> getPendingInvoices();
  Future<void> removeCachedInvoice(String invoiceId);
  Future<void> clearAllCachedInvoices();
  Future<int> getPendingCount();
}

class OfflineCacheDataSourceImpl implements OfflineCacheDataSource {
  static const String _offlineQueueKey = 'al_waseet_offline_invoices_queue';

  @override
  Future<void> cachePendingInvoice(CachedInvoiceModel invoice) async {
    final prefs = await SharedPreferences.getInstance();
    final list = await getPendingInvoices();
    // Add new or update
    final index = list.indexWhere((item) => item.id == invoice.id);
    if (index >= 0) {
      list[index] = invoice;
    } else {
      list.add(invoice);
    }
    final rawList = list.map((e) => jsonEncode(e.toMap())).toList();
    await prefs.setStringList(_offlineQueueKey, rawList);
  }

  @override
  Future<List<CachedInvoiceModel>> getPendingInvoices() async {
    final prefs = await SharedPreferences.getInstance();
    final rawList = prefs.getStringList(_offlineQueueKey) ?? [];
    return rawList.map((str) {
      final map = jsonDecode(str) as Map<String, dynamic>;
      return CachedInvoiceModel.fromMap(map);
    }).toList();
  }

  @override
  Future<void> removeCachedInvoice(String invoiceId) async {
    final prefs = await SharedPreferences.getInstance();
    final list = await getPendingInvoices();
    list.removeWhere((item) => item.id == invoiceId);
    final rawList = list.map((e) => jsonEncode(e.toMap())).toList();
    await prefs.setStringList(_offlineQueueKey, rawList);
  }

  @override
  Future<void> clearAllCachedInvoices() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_offlineQueueKey);
  }

  @override
  Future<int> getPendingCount() async {
    final list = await getPendingInvoices();
    return list.length;
  }
}
