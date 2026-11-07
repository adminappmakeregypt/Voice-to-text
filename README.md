# 🔊 تحويل النص إلى صوت (Text to Speech)

برنامج ويب يحوّل النص لصوت بجودة عالية — HTML + CSS + JavaScript فقط، بدون سيرفر.

## المحركات
| المحرك | الجودة | التكلفة | تحميل MP3 |
|---|---|---|---|
| **Azure Neural** (أصوات مصرية وخليجية وشامية ومغربية) | ممتازة | 500 ألف حرف مجانًا شهريًا | ✅ |
| أصوات المتصفح | متوسطة (أفضلها على Edge) | مجاني | ❌ |

## تجهيز Azure (مرة واحدة)
1. اعمل حساب على https://portal.azure.com
2. Create a resource ← ابحث عن **Speech** ← Create.
3. اختار Pricing tier: **Free F0**، واختار Region (مثلاً `westeurope`).
4. بعد الإنشاء: Keys and Endpoint ← انسخ **Key 1** والـ **Location/Region**.
5. في البرنامج: افتح ⚙️ إعدادات Azure ← الصق المفتاح والمنطقة ← حفظ.

> المفتاح بيتحفظ في متصفحك بس، ومش موجود في الكود، فآمن ترفع المشروع على GitHub.

## النشر على GitHub Pages
1. ارفع الملفات على Repository جديد.
2. Settings ← Pages ← Branch: `main` / root ← Save.
3. الرابط: `https://USERNAME.github.io/REPO-NAME/`
