import 'package:flutter/material.dart';
import '../constants/app_colors.dart';

class SnackbarService {
  SnackbarService._();

  static final GlobalKey<ScaffoldMessengerState> messengerKey =
      GlobalKey<ScaffoldMessengerState>();

  static void showSuccess(String message, {Duration duration = const Duration(seconds: 3)}) {
    _showSnackBar(
      message: message,
      backgroundColor: AppColors.accentEmerald,
      icon: Icons.check_circle_outline,
      duration: duration,
    );
  }

  static void showError(String message, {Duration duration = const Duration(seconds: 4)}) {
    _showSnackBar(
      message: message,
      backgroundColor: AppColors.danger,
      icon: Icons.error_outline,
      duration: duration,
    );
  }

  static void showWarning(String message, {Duration duration = const Duration(seconds: 3)}) {
    _showSnackBar(
      message: message,
      backgroundColor: AppColors.warning,
      icon: Icons.warning_amber_rounded,
      duration: duration,
    );
  }

  static void showInfo(String message, {Duration duration = const Duration(seconds: 3)}) {
    _showSnackBar(
      message: message,
      backgroundColor: AppColors.info,
      icon: Icons.info_outline,
      duration: duration,
    );
  }

  static void _showSnackBar({
    required String message,
    required Color backgroundColor,
    required IconData icon,
    required Duration duration,
  }) {
    messengerKey.currentState?.hideCurrentSnackBar();
    messengerKey.currentState?.showSnackBar(
      SnackBar(
        duration: duration,
        behavior: SnackBarBehavior.floating,
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        backgroundColor: backgroundColor,
        content: Directionality(
          textDirection: TextDirection.rtl,
          child: Row(
            children: [
              Icon(icon, color: Colors.white, size: 24),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  message,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
