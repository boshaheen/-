// قارئ PDF المحلي — كل المعالجة تتم داخل المتصفح فقط.
// لا يوجد أي fetch/XHR لأي خادم خارجي في هذا الملف عن قصد؛ الملفات لا تغادر جهاز المستخدم أبدًا.

import * as pdfjsLib from '../vendor/pdf.min.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdf.worker.min.mjs', import.meta.url).href;

// ---------- الحالة ----------

/** @type {Map<string, FileRecord>} */
const files = new Map();
let nextId = 1;

// حد أدنى تقريبي لعدد الأحرف "الحقيقية" لكل صفحة كي نعتبر الملف يحتوي نصًا قابلًا للبحث.
// أقل من هذا يعني على الأرجح أن الصفحة عبارة عن صورة ممسوحة ضوئيًا بلا طبقة نص.
const MIN_CHARS_PER_PAGE = 10;

// ---------- عناصر DOM ----------

const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const browseBtn = document.getElementById('browseBtn');
const toolbar = document.getElementById('toolbar');
const summary = document.getElementById('summary');
const fileListSection = document.getElementById('fileListSection');
const fileTableBody = document.getElementById('fileTableBody');
const emptyState = document.getElementById('emptyState');
const headerCheck = document.getElementById('headerCheck');

const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const searchResultsEl = document.getElementById('searchResults');

const selectAllBtn = document.getElementById('selectAllBtn');
const selectNoneBtn = document.getElementById('selectNoneBtn');
const zipBtn = document.getElementById('zipBtn');
const clearAllBtn = document.getElementById('clearAllBtn');

const toast = document.getElementById('toast');

// ---------- أدوات مساعدة ----------

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} بايت`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} كيلوبايت`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} ميغابايت`;
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// تطبيع بسيط للنص العربي لتحسين نتائج البحث (توحيد الألف والياء، وإزالة التشكيل).
function normalizeText(str) {
  return str
    .replace(/[ؗ-ًؚ-ْٰۖ-ۭ]/g, '') // تشكيل
    .replace(/[إأآا]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .toLowerCase();
}

let toastTimer = null;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('hidden'), 3200);
}

async function readMagicBytes(file, n = 5) {
  const buf = await file.slice(0, n).arrayBuffer();
  return new Uint8Array(buf);
}

function bytesToAscii(bytes) {
  return Array.from(bytes).map((b) => String.fromCharCode(b)).join('');
}

// ---------- سجل الملف ----------

class FileRecord {
  constructor(file) {
    this.id = String(nextId++);
    this.file = file;
    this.name = file.name;
    this.size = file.size;
    this.status = 'loading'; // loading | ok | image | invalid | error
    this.statusLabel = 'جارٍ التحليل…';
    this.numPages = null;
    /** نص كل صفحة على حدة، مطبّع مسبقًا لتسريع البحث */
    this.pagesText = [];
    /** النسخة الأصلية (غير المطبّعة) من نص كل صفحة، لعرض المقتطفات */
    this.pagesRawText = [];
    this.selected = true;
    this.objectUrl = null;
  }
}

// ---------- معالجة الرفع ----------

async function handleFiles(fileList) {
  const arr = Array.from(fileList).filter((f) => f);
  if (arr.length === 0) return;

  for (const file of arr) {
    const rec = new FileRecord(file);
    files.set(rec.id, rec);
  }
  render();
  toggleSections();

  for (const file of arr) {
    const rec = [...files.values()].find((r) => r.file === file);
    if (rec) await processFile(rec);
  }
}

async function processFile(rec) {
  try {
    const magic = await readMagicBytes(rec.file, 5);
    if (bytesToAscii(magic) !== '%PDF-') {
      rec.status = 'invalid';
      rec.statusLabel = '❌ ليس ملف PDF فعليًا (رغم الامتداد)';
      render();
      return;
    }

    const arrayBuffer = await rec.file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    rec.numPages = pdf.numPages;

    let totalChars = 0;
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const raw = content.items.map((it) => it.str).join(' ').replace(/\s+/g, ' ').trim();
      rec.pagesRawText.push(raw);
      rec.pagesText.push(normalizeText(raw));
      totalChars += raw.length;
    }

    const avgCharsPerPage = totalChars / pdf.numPages;
    if (avgCharsPerPage < MIN_CHARS_PER_PAGE) {
      rec.status = 'image';
      rec.statusLabel = '⚠️ يبدو أنه صورة ممسوحة ضوئيًا (بلا نص قابل للبحث)';
    } else {
      rec.status = 'ok';
      rec.statusLabel = '✅ نص قابل للبحث';
    }
  } catch (err) {
    console.error('تعذّر تحليل الملف', rec.name, err);
    rec.status = 'error';
    rec.statusLabel = '❌ تعذّر فتح الملف (قد يكون تالفًا أو محميًا بكلمة مرور)';
  }
  render();
}

// ---------- العرض ----------

function toggleSections() {
  const hasFiles = files.size > 0;
  toolbar.classList.toggle('hidden', !hasFiles);
  summary.classList.toggle('hidden', !hasFiles);
  fileListSection.classList.toggle('hidden', !hasFiles);
  emptyState.classList.toggle('hidden', hasFiles);
}

function render() {
  toggleSections();

  const list = [...files.values()];
  const totalPages = list.reduce((sum, r) => sum + (r.numPages || 0), 0);
  summary.textContent = `${list.length} ملف • ${totalPages} صفحة إجمالًا • ${list.filter((r) => r.selected).length} محدَّد للضغط`;

  fileTableBody.innerHTML = '';
  for (const rec of list) {
    const tr = document.createElement('tr');

    const statusClass = {
      loading: 'status-loading', ok: 'status-ok', image: 'status-image',
      invalid: 'status-invalid', error: 'status-invalid',
    }[rec.status];

    tr.innerHTML = `
      <td><input type="checkbox" class="row-check" data-id="${rec.id}" ${rec.selected ? 'checked' : ''}></td>
      <td class="file-name">${escapeHtml(rec.name)}</td>
      <td>${formatSize(rec.size)}</td>
      <td>${rec.numPages ?? '—'}</td>
      <td><span class="status-badge ${statusClass}">${rec.statusLabel}</span></td>
      <td class="row-actions">
        <button class="btn btn-ghost btn-sm view-btn" data-id="${rec.id}" ${rec.status === 'invalid' || rec.status === 'error' ? 'disabled' : ''}>👁️ فتح</button>
        <button class="btn btn-danger btn-sm remove-btn" data-id="${rec.id}">حذف</button>
      </td>
    `;
    fileTableBody.appendChild(tr);
  }

  headerCheck.checked = list.length > 0 && list.every((r) => r.selected);
}

// ---------- البحث ----------

function runSearch() {
  const query = searchInput.value.trim();
  if (!query) {
    searchResultsEl.classList.add('hidden');
    searchResultsEl.innerHTML = '';
    return;
  }
  const normQuery = normalizeText(query);
  const list = [...files.values()];
  const searchable = list.filter((r) => r.status === 'ok');
  const excluded = list.filter((r) => r.status === 'image' || r.status === 'invalid' || r.status === 'error');

  const groups = [];
  for (const rec of searchable) {
    const hits = [];
    rec.pagesText.forEach((pageText, idx) => {
      if (pageText.includes(normQuery)) {
        const raw = rec.pagesRawText[idx];
        hits.push({ page: idx + 1, snippet: buildSnippet(raw, rec.pagesText[idx], normQuery) });
      }
    });
    if (hits.length) groups.push({ rec, hits });
  }

  searchResultsEl.classList.remove('hidden');
  let html = `<h2>نتائج البحث عن "${escapeHtml(query)}"</h2>`;

  if (groups.length === 0) {
    html += `<p class="no-results">لا توجد نتائج مطابقة في الملفات القابلة للبحث.</p>`;
  } else {
    for (const { rec, hits } of groups) {
      html += `<div class="result-group"><h3>📄 ${escapeHtml(rec.name)} (${hits.length} نتيجة)</h3>`;
      for (const hit of hits) {
        html += `<div class="result-item" data-id="${rec.id}" data-page="${hit.page}">
          ${hit.snippet}<span class="result-page">صفحة ${hit.page}</span>
        </div>`;
      }
      html += `</div>`;
    }
  }

  if (excluded.length) {
    html += `<p class="excluded-note">ملاحظة: ${excluded.length} ملف مستبعَد من البحث لأنه صورة ممسوحة ضوئيًا أو غير صالح: ${excluded.map((r) => escapeHtml(r.name)).join('، ')}</p>`;
  }

  searchResultsEl.innerHTML = html;

  searchResultsEl.querySelectorAll('.result-item').forEach((el) => {
    el.addEventListener('click', () => {
      const rec = files.get(el.dataset.id);
      if (rec) openFile(rec, Number(el.dataset.page));
    });
  });
}

function buildSnippet(rawText, normText, normQuery) {
  const idx = normText.indexOf(normQuery);
  const start = Math.max(0, idx - 40);
  const end = Math.min(rawText.length, idx + normQuery.length + 40);
  const snippetRaw = rawText.slice(start, end);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < rawText.length ? '…' : '';
  const highlighted = highlightApprox(snippetRaw, normQuery);
  return `${prefix}${highlighted}${suffix}`;
}

function highlightApprox(text, normQuery) {
  // تمييز تقريبي: نطبّع النص، نجد الموضع، ثم نميّز نفس الطول في النص الأصلي.
  const normSnippet = normalizeText(text);
  const idx = normSnippet.indexOf(normQuery);
  if (idx === -1) return escapeHtml(text);
  const before = escapeHtml(text.slice(0, idx));
  const match = escapeHtml(text.slice(idx, idx + normQuery.length));
  const after = escapeHtml(text.slice(idx + normQuery.length));
  return `${before}<mark>${match}</mark>${after}`;
}

// ---------- فتح ملف ----------

function openFile(rec, page) {
  if (!rec.objectUrl) {
    rec.objectUrl = URL.createObjectURL(rec.file);
  }
  const url = page ? `${rec.objectUrl}#page=${page}` : rec.objectUrl;
  window.open(url, '_blank', 'noopener');
}

// ---------- ضغط ZIP ----------

async function zipSelected() {
  const selected = [...files.values()].filter((r) => r.selected);
  if (selected.length === 0) {
    showToast('اختر ملفًا واحدًا على الأقل أولًا');
    return;
  }
  zipBtn.disabled = true;
  zipBtn.textContent = '⏳ جارٍ الضغط…';
  try {
    const zip = new JSZip();
    const usedNames = new Set();
    for (const rec of selected) {
      let name = rec.name;
      let counter = 1;
      while (usedNames.has(name)) {
        const dot = rec.name.lastIndexOf('.');
        name = dot === -1 ? `${rec.name} (${counter})` : `${rec.name.slice(0, dot)} (${counter})${rec.name.slice(dot)}`;
        counter++;
      }
      usedNames.add(name);
      zip.file(name, rec.file);
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pdf-files-${new Date().toISOString().slice(0, 10)}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    showToast(`تم إنشاء ملف ZIP يحتوي ${selected.length} ملف بنجاح`);
  } catch (err) {
    console.error(err);
    showToast('حدث خطأ أثناء إنشاء ملف ZIP');
  } finally {
    zipBtn.disabled = false;
    zipBtn.textContent = '🗜️ ضغط المحدد كـ ZIP';
  }
}

// ---------- الأحداث ----------

browseBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => {
  handleFiles(e.target.files);
  fileInput.value = '';
});

['dragenter', 'dragover'].forEach((evt) => {
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
});
['dragleave', 'drop'].forEach((evt) => {
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
  });
});
dropzone.addEventListener('drop', (e) => {
  const dt = e.dataTransfer;
  if (dt?.files?.length) handleFiles(dt.files);
});

fileTableBody.addEventListener('click', (e) => {
  const target = e.target;
  if (target.matches('.view-btn')) {
    const rec = files.get(target.dataset.id);
    if (rec) openFile(rec);
  } else if (target.matches('.remove-btn')) {
    const rec = files.get(target.dataset.id);
    if (rec?.objectUrl) URL.revokeObjectURL(rec.objectUrl);
    files.delete(target.dataset.id);
    render();
  }
});

fileTableBody.addEventListener('change', (e) => {
  if (e.target.matches('.row-check')) {
    const rec = files.get(e.target.dataset.id);
    if (rec) rec.selected = e.target.checked;
    render();
  }
});

headerCheck.addEventListener('change', () => {
  for (const rec of files.values()) rec.selected = headerCheck.checked;
  render();
});

selectAllBtn.addEventListener('click', () => {
  for (const rec of files.values()) rec.selected = true;
  render();
});
selectNoneBtn.addEventListener('click', () => {
  for (const rec of files.values()) rec.selected = false;
  render();
});

zipBtn.addEventListener('click', zipSelected);

clearAllBtn.addEventListener('click', () => {
  if (files.size === 0) return;
  if (!confirm('هل تريد حذف جميع الملفات المرفوعة؟')) return;
  for (const rec of files.values()) {
    if (rec.objectUrl) URL.revokeObjectURL(rec.objectUrl);
  }
  files.clear();
  searchInput.value = '';
  searchResultsEl.classList.add('hidden');
  searchResultsEl.innerHTML = '';
  render();
});

searchBtn.addEventListener('click', runSearch);
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') runSearch();
});
clearSearchBtn.addEventListener('click', () => {
  searchInput.value = '';
  searchResultsEl.classList.add('hidden');
  searchResultsEl.innerHTML = '';
});
