/// Custom App Exceptions
class ServerException implements Exception {
  final String message;
  final int? statusCode;

  const ServerException({
    required this.message,
    this.statusCode,
  });

  @override
  String toString() => 'ServerException: $message (code: $statusCode)';
}

class UnauthorizedException implements Exception {
  final String message;
  const UnauthorizedException([this.message = 'انتهت صلاحية الجلسة، يرجى إعادة تسجيل الدخول']);

  @override
  String toString() => 'UnauthorizedException: $message';
}

class NetworkException implements Exception {
  final String message;
  const NetworkException([this.message = 'تعذر الاتصال بخادم VPS المركزي. تحقق من الإنترنت']);

  @override
  String toString() => 'NetworkException: $message';
}

class CacheException implements Exception {
  final String message;
  const CacheException([this.message = 'فشل في حفظ أو قراءة البيانات من الكاش المحلي']);

  @override
  String toString() => 'CacheException: $message';
}
