import 'package:intl/intl.dart';

class CurrencyFormatter {
  CurrencyFormatter._();

  static final NumberFormat _formatter = NumberFormat('#,##0.00', 'ar');
  static final NumberFormat _simpleFormatter = NumberFormat('#,##0', 'ar');

  static String format(double amount) {
    return '${_formatter.format(amount)} ج.م';
  }

  static String formatSimple(double amount) {
    return '${_simpleFormatter.format(amount)} ج.م';
  }
}
