/// Domain Failures for Result and State Management
abstract class Failure {
  final String message;
  final int? statusCode;

  const Failure(this.message, [this.statusCode]);

  @override
  String toString() => message;
}

class ServerFailure extends Failure {
  const ServerFailure(super.message, [super.statusCode]);
}

class NetworkFailure extends Failure {
  const NetworkFailure([super.message = 'لا يوجد اتصال بالإنترنت، يرجى تفعيل وضع العمل دون اتصال']);
}

class AuthFailure extends Failure {
  const AuthFailure([super.message = 'فشل تسجيل الدخول، تأكد من صحة البيانات']);
}

class CacheFailure extends Failure {
  const CacheFailure([super.message = 'تعذر الوصول إلى الذاكرة المحلية']);
}

class ValidationFailure extends Failure {
  const ValidationFailure(super.message);
}
