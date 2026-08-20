/*******************************************************************
 * Service Worker — ทำให้แอปเปิดใช้ได้แม้ไม่มีอินเทอร์เน็ต
 *
 * หลักการ
 *   ไฟล์โครงแอป (หน้าเว็บ ไอคอน manifest) → เอาจากแคชก่อน เปิดเร็ว
 *   ไฟล์ systems.json                         → เอาจากเน็ตก่อน จะได้เห็นรายการล่าสุด
 *                                             ถ้าเน็ตไม่มี ค่อยใช้ของในแคช
 *
 * เวลาแก้ไฟล์แอป ให้เปลี่ยนเลข รุ่นแคช ด้านล่าง
 * เบราว์เซอร์จะได้รู้ว่าต้องโหลดไฟล์ใหม่ ไม่ใช้ของเก่าค้าง
 *******************************************************************/

var รุ่นแคช = 'ศูนย์รวมระบบ-v1';

var ไฟล์โครงแอป = [
  '.',
  'index.html',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'icons/favicon.png'
];

/* ---------- ติดตั้ง : เก็บไฟล์โครงแอปลงแคช ---------- */
self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(รุ่นแคช)
      .then(function (c) { return c.addAll(ไฟล์โครงแอป); })
      .then(function () { return self.skipWaiting(); })
      .catch(function (err) { console.log('แคชไฟล์เริ่มต้นไม่ครบ', err); })
  );
});

/* ---------- เปิดใช้ : ลบแคชรุ่นเก่าทิ้ง ---------- */
self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (รายชื่อ) {
      return Promise.all(รายชื่อ.map(function (k) {
        if (k !== รุ่นแคช) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

/* ---------- ดักการเรียกไฟล์ ---------- */
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);

  // ข้ามลิงก์ไปเว็บอื่น เช่น ระบบปลายทางหรือฟอนต์จาก Google
  if (url.origin !== self.location.origin) return;

  // systems.json : เอาจากเน็ตก่อนเสมอ เพื่อให้เห็นรายการที่อัปเดตแล้ว
  if (url.pathname.indexOf('.json') !== -1 && url.pathname.indexOf('manifest') === -1) {
    e.respondWith(
      fetch(req)
        .then(function (res) {
          var สำเนา = res.clone();
          caches.open(รุ่นแคช).then(function (c) { c.put(req, สำเนา); });
          return res;
        })
        .catch(function () { return caches.match(req); })
    );
    return;
  }

  // ไฟล์อื่น : เอาจากแคชก่อน ถ้าไม่มีค่อยไปเอาจากเน็ต
  e.respondWith(
    caches.match(req).then(function (พบ) {
      if (พบ) return พบ;
      return fetch(req).then(function (res) {
        if (res && res.status === 200 && res.type === 'basic') {
          var สำเนา = res.clone();
          caches.open(รุ่นแคช).then(function (c) { c.put(req, สำเนา); });
        }
        return res;
      }).catch(function () {
        // ถ้าเปิดหน้าเว็บไม่ได้เลย ให้ย้อนไปหน้าแรกที่แคชไว้
        if (req.mode === 'navigate') return caches.match('index.html');
      });
    })
  );
});
