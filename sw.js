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

var รุ่นแคช = 'ศูนย์รวมระบบ-v7';

var ไฟล์โครงแอป = [
  '.',
  'index.html',
  'manifest.json',
  'apple-touch-icon.png',
  'icon-192.png',
  'icon-512.png'
];

/* ---------- ติดตั้ง : เก็บไฟล์โครงแอปลงแคช ----------
 * เก็บทีละไฟล์ ไม่ใช้ addAll เพราะถ้าใช้ addAll แล้วมีไฟล์ใดหายไปแม้ไฟล์เดียว
 * (เช่น ลืมอัปโหลดโฟลเดอร์ icons) จะล้มทั้งชุด ไม่ได้แคชอะไรเลย
 * วิธีนี้ไฟล์ที่มีอยู่จะถูกเก็บไว้ได้ ส่วนไฟล์ที่หายจะข้ามไปเฉย ๆ
 */
self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(รุ่นแคช).then(function (c) {
      return Promise.all(ไฟล์โครงแอป.map(function (ไฟล์) {
        return c.add(ไฟล์).catch(function () {
          console.log('ข้ามไฟล์ที่โหลดไม่ได้ :', ไฟล์);
        });
      }));
    }).then(function () { return self.skipWaiting(); })
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

  // หน้าเว็บ (index.html) : เอาจากเน็ตก่อนเสมอ
  // ถ้าใช้แคชก่อน เวลาอัปไฟล์ใหม่ขึ้นโฮสต์ เครื่องที่เคยเปิดจะยังเห็นหน้าเก่าค้างอยู่
  // ต้องกดล้างแคชเองซึ่งผู้ใช้ทั่วไปทำไม่เป็น
  if (req.mode === 'navigate' || url.pathname.indexOf('.html') !== -1) {
    e.respondWith(
      fetch(req)
        .then(function (res) {
          var สำเนา = res.clone();
          caches.open(รุ่นแคช).then(function (c) { c.put(req, สำเนา); });
          return res;
        })
        .catch(function () {
          return caches.match(req).then(function (พบ) {
            return พบ || caches.match('index.html');
          });
        })
    );
    return;
  }

  // ไฟล์อื่น (ไอคอน) : เอาจากแคชก่อน ถ้าไม่มีค่อยไปเอาจากเน็ต
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
