# 🎬 تحويل الفيديو إلى نص (Speech to Text)

ارفع فيديو أو ملف صوت، والبرنامج يطلّع الكلام مكتوب — مع تحميل TXT أو SRT (ملف ترجمة).
HTML + CSS + JavaScript فقط، بدون سيرفر.

## المحركات
| المحرك | الدقة في العربي | السرعة | التكلفة | الخصوصية |
|---|---|---|---|---|
| **Azure** | ممتازة (فيه مصري) | سريع جدًا | 5 ساعات مجانًا شهريًا | الصوت بيترفع لـ Microsoft |
| **Whisper** | جيدة (Small أدق من Base) | أبطأ، حسب قوة الجهاز | مجاني بالكامل | الفيديو مش بيخرج من جهازك |

## تجهيز Azure
نفس مفتاح برنامج تحويل النص لصوت:
1. https://portal.azure.com ← Create a resource ← **Speech** ← باقة **Free F0**.
2. Keys and Endpoint ← انسخ **Key 1** والـ **Region**.
3. في البرنامج: ⚙️ الإعدادات ← الصق ← حفظ.

## ملاحظات
- يفضّل Chrome أو Edge.
- Whisper بيحمّل الموديل أول مرة بس (80–250MB)، وبعدين بيتخزن في المتصفح.
- الملفات الطويلة جدًا (أكتر من ساعة) ممكن تستهلك رامات كتير.
- البرنامج لازم يشتغل من سيرفر (زي GitHub Pages) مش بفتح الملف مباشرة، عشان الـ Worker يشتغل.

## النشر على GitHub Pages
1. ارفع الملفات (index.html, style.css, script.js, worker.js) على Repository.
2. Settings ← Pages ← Branch: `main` / root ← Save.
3. الرابط: `https://USERNAME.github.io/REPO-NAME/`

للتجربة على جهازك: `npx serve` أو `python -m http.server` جوه الفولدر.
