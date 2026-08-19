// يبني pdf-reader-local.html كملف HTML واحد مستقل يضمّن CSS وJS ومكتبتَي pdf.js/JSZip بالكامل،
// بحيث يمكن فتحه مباشرة بنقرتين (file://) دون تشغيل أي خادم محلي ودون أي اتصال بالإنترنت.
// شغّله بعد أي تعديل على index.html أو css/style.css أو js/app.js: node build-single-file.mjs

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

const css = fs.readFileSync(path.join(ROOT, 'css/style.css'), 'utf8');
const pdfLibRaw = fs.readFileSync(path.join(ROOT, 'vendor/pdf.min.mjs'), 'utf8');
const pdfWorkerRaw = fs.readFileSync(path.join(ROOT, 'vendor/pdf.worker.min.mjs'), 'utf8');
const jszipRaw = fs.readFileSync(path.join(ROOT, 'vendor/jszip.min.js'), 'utf8');
let appJs = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');

// 1) تحويل مكتبة pdf.js من عبارة ES module التصديرية (export{local as Exported,...};)
//    إلى كائن عام window.pdfjsLib = {Exported: local, ...}; بما أن صياغة "as" غير صالحة داخل كائن حرفي عادي.
const marker = 'export{';
const idx = pdfLibRaw.lastIndexOf(marker);
if (idx === -1) throw new Error('لم يتم العثور على export{ في pdf.min.mjs — تحقق من الملف المصدر');
const head = pdfLibRaw.slice(0, idx);
let tail = pdfLibRaw.slice(idx + marker.length).trimEnd();
if (!tail.endsWith('};')) throw new Error('صيغة export{} غير متوقعة في نهاية pdf.min.mjs: ' + tail.slice(-20));
tail = tail.slice(0, -2); // إزالة "};" الختامية
const entries = tail.split(',').map((entry) => {
  const m = entry.match(/^([\w$]+)\s+as\s+([\w$]+)$/);
  if (m) return `${m[2]}: ${m[1]}`;
  if (/^[\w$]+$/.test(entry)) return `${entry}: ${entry}`;
  throw new Error('عنصر export غير متوقع: ' + entry);
});
const pdfLibPatched = head + 'window.pdfjsLib={' + entries.join(',') + '};';

// 2) تعديل app.js: إزالة سطر الاستيراد، واستبدال تعيين workerSrc ببديل يعتمد على Blob محلي
//    (لأن تحميل worker من ملف منفصل عبر file:// يُحجب من قبل المتصفح لأسباب أمنية)
appJs = appJs.replace(
  /^import \* as pdfjsLib from '\.\.\/vendor\/pdf\.min\.mjs';\n/m,
  "const pdfjsLib = window.pdfjsLib;\n"
);
appJs = appJs.replace(
  /pdfjsLib\.GlobalWorkerOptions\.workerSrc = new URL\('\.\.\/vendor\/pdf\.worker\.min\.mjs', import\.meta\.url\)\.href;/,
  [
    "{",
    "  const workerSrcText = document.getElementById('pdf-worker-source').textContent;",
    "  const workerBlob = new Blob([workerSrcText], { type: 'text/javascript' });",
    "  pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(workerBlob);",
    "}",
  ].join('\n')
);

if (appJs.includes('import * as pdfjsLib')) throw new Error('فشل إزالة سطر import من app.js');
if (appJs.includes('import.meta.url')) throw new Error('فشل استبدال سطر workerSrc في app.js');

const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>قارئ PDF المحلي</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>📄</text></svg>">
<style>
${css}
</style>
</head>
<body>

<header class="topbar">
  <div class="brand">
    <span class="brand-icon">📄</span>
    <div>
      <h1>قارئ PDF المحلي</h1>
      <p class="tagline">تصفّح، ابحث، واضغط ملفاتك — كل ذلك من متصفحك فقط</p>
    </div>
  </div>
  <div class="privacy-badge" title="لا يتم رفع أي ملف إلى أي خادم">
    🔒 يعمل بالكامل محليًا — بلا إنترنت وبلا رفع ملفات
  </div>
</header>

<main>

  <section id="dropzone" class="dropzone">
    <input type="file" id="fileInput" accept=".pdf,application/pdf" multiple hidden>
    <div class="dropzone-inner">
      <span class="dropzone-icon">⬆️</span>
      <p><strong>اسحب وأفلت ملفات PDF هنا</strong> أو</p>
      <button id="browseBtn" class="btn btn-primary" type="button">اختر ملفات من الجهاز</button>
      <p class="hint">يمكن اختيار عدة ملفات دفعة واحدة. لا تُرسل الملفات لأي مكان — تبقى في متصفحك فقط.</p>
    </div>
  </section>

  <section id="toolbar" class="toolbar hidden">
    <div class="search-box">
      <input type="text" id="searchInput" placeholder="ابحث عن كلمة أو عبارة داخل محتوى الملفات المرفوعة…">
      <button id="searchBtn" class="btn btn-secondary" type="button">🔍 بحث</button>
      <button id="clearSearchBtn" class="btn btn-ghost" type="button">مسح البحث</button>
    </div>
    <div class="actions-box">
      <button id="selectAllBtn" class="btn btn-ghost" type="button">تحديد الكل</button>
      <button id="selectNoneBtn" class="btn btn-ghost" type="button">إلغاء التحديد</button>
      <button id="zipBtn" class="btn btn-primary" type="button">🗜️ ضغط المحدد كـ ZIP</button>
      <button id="clearAllBtn" class="btn btn-danger" type="button">🗑️ حذف الكل</button>
    </div>
  </section>

  <section id="summary" class="summary hidden"></section>

  <section id="searchResults" class="search-results hidden"></section>

  <section id="fileListSection" class="file-list-section hidden">
    <table class="file-table">
      <thead>
        <tr>
          <th class="col-check"><input type="checkbox" id="headerCheck"></th>
          <th>اسم الملف</th>
          <th>الحجم</th>
          <th>الصفحات</th>
          <th>الحالة</th>
          <th>إجراءات</th>
        </tr>
      </thead>
      <tbody id="fileTableBody"></tbody>
    </table>
  </section>

  <section id="emptyState" class="empty-state">
    <p>لم تُرفع أي ملفات بعد. ابدأ برفع ملفات PDF لتصفّحها والبحث داخلها.</p>
  </section>

</main>

<footer class="footer">
  <p>
    مبني بتقنية <a href="https://mozilla.github.io/pdf.js/" target="_blank" rel="noopener">pdf.js</a> و
    <a href="https://stuk.github.io/jszip/" target="_blank" rel="noopener">JSZip</a> (مضمّنتان داخل هذا الملف بالكامل) — تعمل بلا خادم وبلا اتصال إنترنت.
  </p>
</footer>

<div id="toast" class="toast hidden"></div>

<!-- كود عامل pdf.js الأصلي مضمَّن كنص خام هنا (لا يُنفَّذ)، ويُحوَّل إلى Worker عبر Blob عند الحاجة -->
<script id="pdf-worker-source" type="text/plain">${pdfWorkerRaw}</script>

<!-- مكتبة JSZip (نسخة محلية مضمَّنة بالكامل) -->
<script>
${jszipRaw}
</script>

<!-- مكتبة pdf.js (نسخة محلية مضمَّنة بالكامل، مُحوَّلة من ES module إلى window.pdfjsLib) ثم منطق التطبيق -->
<script type="module">
${pdfLibPatched}

${appJs}
</script>

</body>
</html>
`;

const outPath = path.join(ROOT, 'pdf-reader-local.html');
fs.writeFileSync(outPath, html, 'utf8');
console.log('تم إنشاء الملف:', outPath);
console.log('الحجم:', (html.length / 1024 / 1024).toFixed(2), 'ميغابايت');
