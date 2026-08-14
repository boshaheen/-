// خادم ثابت محلي بسيط جدًا (بدون أي مكتبات خارجية) لتشغيل موقع "قارئ PDF المحلي".
// يعمل على 127.0.0.1 فقط (وليس 0.0.0.0) بحيث لا يكون الموقع متاحًا لأي جهاز آخر على الشبكة —
// يبقى الوصول من نفس الجهاز فقط، ولا حاجة لاتصال إنترنت بعد أول تشغيل.

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = process.env.PORT ? Number(process.env.PORT) : 5500;
const HOST = '127.0.0.1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  try {
    const urlPath = decodeURIComponent(req.url.split('?')[0]);
    let relPath = urlPath === '/' ? '/index.html' : urlPath;
    const filePath = path.normalize(path.join(ROOT, relPath));

    // منع الخروج خارج مجلد المشروع (path traversal)
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('الملف غير موجود');
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(data);
    });
  } catch (e) {
    res.writeHead(500);
    res.end('خطأ داخلي');
  }
});

server.listen(PORT, HOST, () => {
  console.log(`قارئ PDF المحلي يعمل الآن على: http://${HOST}:${PORT}`);
  console.log('اضغط Ctrl+C لإيقاف الخادم.');
});
