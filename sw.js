// Service worker: lưu khung ứng dụng để mở được khi mạng yếu/mất mạng.
// KHÔNG lưu dữ liệu API (Supabase) — dữ liệu luôn lấy mới; báo cáo chờ gửi nằm trong IndexedDB.
const CACHE = 'hpcons-shell-v4'
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png']

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', event => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return // API, font, CDN: để trình duyệt xử lý

  // Trang: ưu tiên mạng (luôn có bản mới), mất mạng thì dùng bản đã lưu.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(res => {
        const copy = res.clone()
        caches.open(CACHE).then(c => c.put('./index.html', copy))
        return res
      }).catch(() => caches.match('./index.html')),
    )
    return
  }

  // Tệp tĩnh có mã băm trong tên (assets/*): dùng bản lưu, chưa có thì tải và lưu.
  if (url.pathname.includes('/assets/') || url.pathname.includes('/icons/')) {
    event.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)) }
        return res
      })),
    )
  }
})

// ---------- Thông báo đẩy ----------
self.addEventListener('push', event => {
  let msg = { title: 'HP CONS Maintenance', body: '', url: './' }
  try { msg = { ...msg, ...event.data.json() } } catch { if (event.data) msg.body = event.data.text() }
  event.waitUntil(self.registration.showNotification(msg.title, {
    body: msg.body,
    tag: msg.tag,
    renotify: !!msg.tag,
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    data: { url: msg.url || './' },
  }))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const target = new URL(event.notification.data?.url || './', self.registration.scope).href
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) {
      if (c.url.startsWith(self.registration.scope)) { c.navigate(target); return c.focus() }
    }
    return self.clients.openWindow(target)
  }))
})
