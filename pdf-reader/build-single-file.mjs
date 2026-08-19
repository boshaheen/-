// يبني pdf-reader-local.html كملف HTML واحد مستقل يضمّن CSS وJS ومكتبات pdf.js وJSZip وTesseract.js
// (بما فيها بيانات لغتي OCR العربية والإنجليزية) بالكامل، بحيث يمكن فتحه مباشرة بنقرتين (file://)
// دون تشغيل أي خادم محلي ودون أي اتصال بالإنترنت.
// شغّله بعد أي تعديل على index.html أو css/style.css أو js/app.js: node build-single-file.mjs

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

const css = fs.readFileSync(path.join(ROOT, 'css/style.css'), 'utf8');
const pdfLibRaw = fs.readFileSync(path.join(ROOT, 'vendor/pdf.min.mjs'), 'utf8');
const pdfWorkerRaw = fs.readFileSync(path.join(ROOT, 'vendor/pdf.worker.min.mjs'), 'utf8');
const jszipRaw = fs.readFileSync(path.join(ROOT, 'vendor/jszip.min.js'), 'utf8');
const tesseractMinRaw = fs.readFileSync(path.join(ROOT, 'vendor/tesseract/tesseract.min.js'), 'utf8');
let tessWorkerRaw = fs.readFileSync(path.join(ROOT, 'vendor/tesseract/worker.min.js'), 'utf8');

// إصلاح خلل في Tesseract.js v5.1.1 نفسها: عند تمرير اللغات كمصفوفة كائنات {code, data} (وهو الأسلوب
// الذي نستخدمه هنا لتضمين بيانات اللغة مباشرة بدل تحميلها عبر fetch)، تستخدم دالة initialize() الحقل
// الخطأ (`.data` بدل `.code`) عند بناء نص اللغات المُمرَّر لمحرك Tesseract الأصلي، فيحاول تحميل لغة
// اسمها "بايتات البيانات نفسها" بدل "ara"/"eng" ويفشل التهيئة بالكامل. نرقّع هذا هنا في نسخة worker.min.js
// المضمَّنة فقط (نسخة الخادم لا تتأثر لأنها تُمرِّر اللغات كنص عادي "ara+eng" لا كمصفوفة كائنات).
{
  const buggy = 'return"string"==typeof t?t:t.data}';
  const fixed = 'return"string"==typeof t?t:t.code}';
  const occurrences = tessWorkerRaw.split(buggy).length - 1;
  if (occurrences !== 1) {
    throw new Error(`نمط الرقعة الخاصة بخلل initialize() في worker.min.js غير موجود بالشكل المتوقع (${occurrences} تطابق بدل 1) — قد يكون إصدار tesseract.js قد تغيّر، راجع الرقعة يدويًا`);
  }
  tessWorkerRaw = tessWorkerRaw.replace(buggy, fixed);
}
const tessCoreRaw = fs.readFileSync(path.join(ROOT, 'vendor/tesseract/tesseract-core-simd-lstm.wasm.js'), 'utf8');
const engTrainedDataB64 = fs.readFileSync(path.join(ROOT, 'vendor/tessdata/eng.traineddata')).toString('base64');
const araTrainedDataB64 = fs.readFileSync(path.join(ROOT, 'vendor/tessdata/ara.traineddata')).toString('base64');
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

// 3) استبدال مسارات OCR النسبية (vendor/tesseract/..., vendor/tessdata) بمصادر مضمَّنة داخل الملف.
//
//    ملاحظة مهمة حول العامل (Worker): يعتمد Tesseract.js داخليًا على تحميل عاملَين متداخلَين عبر
//    Blob (يُنشئ Blob يستدعي importScripts على Blob آخر)، وهذا النمط المتداخل من Blob-داخل-Blob
//    يفشل تحديدًا تحت file:// (حِزم Blob تصبح ذات "أصل فارغ/null" هناك ولا يمكن الوصول إليها من
//    عامل آخر مُحمَّل هو نفسه عبر Blob). لتفادي ذلك:
//      - نُعطّل التفاف Tesseract.js الخاص بالعامل (workerBlobURL:false) بحيث يُنشئ Worker مباشرة من
//        الرابط الممرَّر (قفزة Blob واحدة فقط، وهو النمط المُثبَت عمله بالفعل مع عامل pdf.js أعلاه).
//      - نُدمج نص محرك tesseract.js-core قبل نص worker.min.js في Blob واحد فقط، بحيث يكون
//        `TesseractCore` معرَّفًا مسبقًا (متغيّر عام بسيط) قبل أن يتحقق worker.min.js من وجوده،
//        فيتخطى استدعاء importScripts للمحرك تمامًا بدل تحميله ديناميكيًا (لا حاجة إذًا لـ OCR_CORE_PATH).
//    - بيانات اللغة (ara/eng) تُمرَّر مباشرة كـ Uint8Array بدل تحميلها عبر fetch (يُحجب على file://)،
//      عبر الصيغة {code, data} التي يدعمها Tesseract.createWorker خصّيصًا لمثل هذه الحالة.
const ocrPathsBlockOld = `const OCR_CORE_PATH = 'vendor/tesseract/tesseract-core-simd-lstm.wasm.js';
const OCR_WORKER_PATH = 'vendor/tesseract/worker.min.js';
const OCR_LANG_PATH = 'vendor/tessdata';
// يستخدم Tesseract.js داخليًا Blob لتشغيل عامل الـ OCR ثم importScripts لتحميل workerPath منه؛
// هذا يعمل بشكل طبيعي عبر خادم محلي (http). أما في نسخة الملف الواحد (file://) فإن المتصفح يمنع
// تحميل Blob من داخل Blob آخر متداخل، لذلك يُعطَّل هذا الخيار هناك ويُدمَج المحرك مسبقًا داخل نص
// العامل نفسه بدل استيراده ديناميكيًا (انظر build-single-file.mjs).
const OCR_WORKER_BLOB_URL = true;
// عند التضمين داخل ملف واحد تصبح هذه خريطة {code: Uint8Array} بدل null،
// فيُستغنى عن langPath تمامًا وتُمرَّر بيانات اللغة مباشرة.
const OCR_EMBEDDED_LANG_DATA = null;`;

const ocrPathsBlockNew = `const OCR_CORE_PATH = ''; // غير مستخدم: المحرك مُدمَج مسبقًا داخل نص العامل نفسه أدناه
const OCR_WORKER_PATH = URL.createObjectURL(new Blob(
  [
    document.getElementById('tess-core-source').textContent,
    ';\\n',
    document.getElementById('tess-worker-source').textContent,
  ],
  { type: 'text/javascript' },
));
const OCR_WORKER_BLOB_URL = false; // إنشاء العامل مباشرة من الرابط أعلاه دون التفاف Blob إضافي متداخل
const OCR_LANG_PATH = '';
let __ocrLangDataCache = null;
function OCR_EMBEDDED_LANG_DATA() {
  if (__ocrLangDataCache) return __ocrLangDataCache;
  const b64ToBytes = (b64) => {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  };
  __ocrLangDataCache = {
    eng: b64ToBytes(document.getElementById('tess-lang-eng').textContent),
    ara: b64ToBytes(document.getElementById('tess-lang-ara').textContent),
  };
  return __ocrLangDataCache;
}`;

if (!appJs.includes(ocrPathsBlockOld)) throw new Error('لم يتم العثور على قسم مسارات OCR المتوقع في app.js — تحقق من التزامن مع build-single-file.mjs');
appJs = appJs.replace(ocrPathsBlockOld, ocrPathsBlockNew);

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

  <section id="ocrBar" class="ocr-bar hidden">
    <label for="ocrLangSelect">🔎 لغة النص في الصور الممسوحة ضوئيًا:</label>
    <select id="ocrLangSelect">
      <option value="ara+eng" selected>عربي + إنجليزي</option>
      <option value="ara">عربي فقط</option>
      <option value="eng">إنجليزي فقط</option>
    </select>
    <button id="ocrAllBtn" class="btn btn-secondary" type="button">تشغيل OCR على كل الملفات المصنّفة كصور</button>
    <span class="ocr-hint">التعرف الضوئي يعمل بالكامل داخل المتصفح وقد يستغرق بضع ثوانٍ لكل صفحة، وقد يحتوي أخطاء بسيطة خصوصًا في الصور منخفضة الجودة.</span>
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
    <a href="https://stuk.github.io/jszip/" target="_blank" rel="noopener">JSZip</a> و
    <a href="https://tesseract.projectnaptha.com/" target="_blank" rel="noopener">Tesseract.js</a>
    (جميعها مضمّنة داخل هذا الملف بالكامل، بما فيها بيانات لغتَي OCR العربية والإنجليزية) — يعمل بلا خادم وبلا اتصال إنترنت.
  </p>
</footer>

<div id="toast" class="toast hidden"></div>

<!-- كود عامل pdf.js الأصلي مضمَّن كنص خام هنا (لا يُنفَّذ)، ويُحوَّل إلى Worker عبر Blob عند الحاجة -->
<script id="pdf-worker-source" type="text/plain">${pdfWorkerRaw}</script>

<!-- كود worker ومحرّك Tesseract.js الأصليان مضمَّنان كنص خام (لا يُنفَّذان مباشرة)، ويُحوَّلان إلى Blob عند الحاجة -->
<script id="tess-worker-source" type="text/plain">${tessWorkerRaw}</script>
<script id="tess-core-source" type="text/plain">${tessCoreRaw}</script>

<!-- بيانات لغتَي OCR (Tesseract traineddata) بترميز base64 -->
<script id="tess-lang-eng" type="text/plain">${engTrainedDataB64}</script>
<script id="tess-lang-ara" type="text/plain">${araTrainedDataB64}</script>

<!-- مكتبة JSZip (نسخة محلية مضمَّنة بالكامل) -->
<script>
${jszipRaw}
</script>

<!-- مكتبة Tesseract.js (نسخة محلية مضمَّنة بالكامل) -->
<script>
${tesseractMinRaw}
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
