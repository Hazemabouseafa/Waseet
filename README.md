# الوسيط (EL-WASEET) — White-Label B2B Van Sales, Distribution & FIFO Inventory System

<p align="center">
  <img src="https://img.shields.io/badge/Architecture-White--Label%20B2B%20SaaS-10B981?style=for-the-badge" alt="Architecture" />
  <img src="https://img.shields.io/badge/Framework-Next.js%2016%20Turbopack-1E293B?style=for-the-badge" alt="Next.js" />
  <img src="https://img.shields.io/badge/Database-PostgreSQL%20%2F%20Neon-3B82F6?style=for-the-badge" alt="Database" />
  <img src="https://img.shields.io/badge/Mobile-Flutter%20%26%20Android%20APK-F59E0B?style=for-the-badge" alt="Mobile" />
  <img src="https://img.shields.io/badge/Language-Arabic%20RTL%20Native-047857?style=for-the-badge" alt="Arabic RTL" />
</p>

---

## 🌟 نظرة عامة (Overview)

**نظام "الوسيط" (El-Waseet)** هو منصة سحابية وهجينة متكاملة بنظام **White-Label** قابلة للبيع وإعادة التخصيص لعدة عملاء وشركات تجارية (شركات التوزيع، تجار الجملة، مصانع الأغذية والألبان، وسلاسل الإمداد).

صُمم النظام ليعمل بكفاءة فائقة على أجهزة الجوال والشاشات اللمسية للمناديب في الشارع، مع لوحة تحكم رقابية لحظية للإدارة، وتتبع صارم لحركة المخزون بنظام الوارد أولاً يصرف أولاً (**FIFO**)، وتسوية نقدية وجردية دقيقة لمنع أي عجز أو تلفيات.

---

## 🎨 ميزة الـ White-Label وإعادة التخصيص للعملاء (Multi-Client Rebranding)

النظام مهيأ بالكامل لبيعه لعدة عملاء بدون الحاجة لتعديل سطر واحد في الكود البرمجي:
1. **لوحة تحكم الهوية التجارية (`/admin/settings`)**:
   - تخصيص **اسم المنشأة / الشركة** وشعارها التجاري فورياً.
   - تغيير **العملة المعتمدة** (ج.م، ر.س، د.إ، $، دينار، إلخ).
   - تخصيص **ترويسة وتذييل الفاتورة الحرارية** ورسائل الواتساب لكل عميل.
   - تسجيل **السجل التجاري والبطاقة الضريبية** وأرقام خدمة العملاء.
   - **معاينة حية (Live Preview)** لشكل الفاتورة والشاشات قبل الحفظ.

2. **التخصيص عبر متغيرات البيئة (`.env`) لعمليات الـ DevOps والـ Multi-Tenancy**:
   ```env
   NEXT_PUBLIC_APP_NAME="الوسيط"
   NEXT_PUBLIC_COMPANY_NAME="شركة الأمل للتوزيع والتوريدات"
   NEXT_PUBLIC_MANAGER_NAME="تحت إدارة: أ/ أحمد محمد"
   NEXT_PUBLIC_TAGLINE="نظام المبيعات الميدانية والتوزيع B2B"
   NEXT_PUBLIC_CURRENCY="ج.م"
   NEXT_PUBLIC_PHONE="01012345678"
   NEXT_PUBLIC_CR="1234567"
   NEXT_PUBLIC_TAX="987-654-321"
   ```

---

## 🚀 الوحدات والميزات الرئيسية (Core Features)

### 1. الرقابة الحية ومؤشرات الإدارة (Real-Time Live Oversight):
- **بث مباشر للعمليات (Live Operations Stream)**: مراقبة فواتير المناديب، تحصيلات الكاش، والمرتجعات لحظة بلحظة.
- **مؤشرات الأداء (KPIs)**: إجمالي المبيعات، الأرباح، ديون العملاء، ورصيد الخزينة.

### 2. فواتير المناديب الميدانية (Sales Rep POS & Thermal Receipts):
- **واجهة لمسية سريعة**: أزرار عريضة `+` و `-` مصممة للعمل في الشارع وتحت أشعة الشمس.
- **فحص لحظي للرصيد**: منع إصدار أي كمية تتجاوز عهدة السيارة الحقيقية.
- **نظام الخصومات والمرتجعات**: تطبيق خصومات نقدية وتوثيق المرتجعات (تالف/منتهي الصلاحية).
- **طباعة ومشاركة واتساب فورية**: طباعة إيصال حراري (80mm/58mm) وإرسال فاتورة منسقة للعميل بضغطة زر.

### 3. المخزون الصارم بنظام FIFO وعُهد السيارات:
- **تحويل عهدة للسيارات (Dispatch)**: نقل بضاعة من المستودع للسيارة بمعاملة ذرية تمنع أي رصيد سالب.
- **تنبيهات الصلاحية الحرجة**: مراقبة تاريخ انتهاء السلع وتنبيهات ملونة بالأحمر للأصناف الموشكة على الانتهاء.

### 4. تسويات نهاية اليوم (Reconciliation):
- مطابقة آلية للكاش المتوقع تسليمه من المندوب مع الكاش الفعلي في الخزينة.
- جرد البضاعة المتبقية في السيارة وكشف أي عجز في الأموال أو البضائع فورياً.

### 5. محرك الأرباح والخسائر وحسابات الموردين (P&L & Suppliers):
- متابعة تكلفة البضاعة المباعة (COGS) وحساب الأرباح التشغيلية والصافية.
- إدارة فواتير المشتريات الآجلة والنقدية وسداد مستحقات الموردين.

### 6. تطبيق الموبايل الأصلي (Android APK & Flutter):
- حزمة تطبيق أندرويد جاهزة للتثبيت المباشر: [`al-waseet-app.apk`](./al-waseet-app.apk).
- مشروع كامل بإطار عمل **Flutter** بتقسيم Clean Feature-First Architecture في المجلد [`mobile/`](./mobile).

---

## 🔑 بيانات الدخول الافتراضية (Root Admin Credentials)

| الدور | اسم المستخدم | كلمة المرور | الوظيفة |
| :--- | :--- | :--- | :--- |
| **المدير العام (Admin)** | `admin` | `123` | كامل صلاحيات الإدارة، الهوية، والرقابة |
| **مندوب مبيعات (Rep)** | `rep_omar` | `123` | واجهة المندوب الميداني وإصدار الفواتير |

---

## 🛠️ التشغيل والربط المحلي (Local Setup)

```bash
# 1. تثبيت الحزم
npm install

# 2. تشغيل السيرفر على البورت الافتراضي 8889
npm run dev
```

التطبيق سيعمل مباشرة على:
- المحلي: `http://localhost:8889`
- الشبكة المحلية: `http://192.168.8.94:8889`

---

## ☁️ النشر والتشغيل الإنتاجي (Production Deployment)

### 1. باستخدام Docker Compose:
```bash
docker-compose up -d --build
```

### 2. النشر على Vercel أو VPS مع قاعدة بيانات Neon:
1. أنشئ قاعدة بيانات PostgreSQL مجانية على [Neon.tech](https://neon.tech).
2. ضع المتغيرات في ملف `.env`:
   ```env
   DATABASE_URL="postgresql://user:pass@ep-xyz.us-east-2.aws.neon.tech/neondb?sslmode=require"
   JWT_SECRET="your-super-secure-production-jwt-secret-key"
   NODE_ENV="production"
   ```
3. ادفع الجداول وشغّل السيرفر:
   ```bash
   npx prisma db push
   npm run build
   npm run start
   ```

---

<p align="center">
  <b>طُوّر بواسطة المهندس حازم ابوسعيفة</b><br />
  نظام الوسيط B2B — رفيقك الميداني الأذكى لإدارة التوزيع والتوريدات.
</p>
