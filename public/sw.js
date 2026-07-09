/* MyMark PWA Service Worker — 정적 자산 + 네트워크 우선 네비게이션 */
const CACHE = "mymark-static-v1";
const PRECACHE = [
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // API·인증은 항상 네트워크
  if (url.pathname.startsWith("/api/")) return;

  // 동일 출처 정적 자산: 캐시 우선
  if (
    url.origin === self.location.origin &&
    (url.pathname.startsWith("/icons/") ||
      url.pathname.endsWith(".webmanifest") ||
      url.pathname.endsWith(".svg") ||
      url.pathname.endsWith(".ico"))
  ) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          const copy = res.clone();
          if (res.ok) {
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        });
      })
    );
    return;
  }

  // 문서 네비게이션: 네트워크 우선, 실패 시 캐시 폴백
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          if (res.ok) {
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() =>
          caches.match(req).then((c) => c || caches.match("/dashboard"))
        )
    );
  }
});
