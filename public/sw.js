/* MyMark PWA Service Worker — 공개 정적 자산만 캐시 (인증 HTML 캐시 금지) */
const CACHE = "mymark-static-v2";
const PRECACHE = [
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];

/** 이 앱이 만든 캐시만 관리 */
function isMyMarkCache(name) {
  return typeof name === "string" && name.startsWith("mymark-");
}

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
          keys
            .filter((k) => isMyMarkCache(k) && k !== CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

/** 로그아웃 등에서 캐시 전부 비우기 */
self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.type !== "MYMARK_CLEAR_CACHES") return;
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(isMyMarkCache).map((k) => caches.delete(k)))
    )
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // API·인증·앱 문서는 항상 네트워크 (개인 HTML 캐시 금지)
  if (url.pathname.startsWith("/api/")) return;

  // 문서 네비게이션: 캐시하지 않음. 오프라인 시 간단 안내만.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(
        () =>
          new Response(
            "<!doctype html><meta charset=utf-8><title>오프라인</title>" +
              "<body style='font-family:system-ui;padding:2rem'>" +
              "<h1>오프라인</h1><p>네트워크 연결 후 다시 시도하세요.</p></body>",
            {
              status: 503,
              headers: { "Content-Type": "text/html; charset=utf-8" },
            }
          )
      )
    );
    return;
  }

  // 동일 출처 공개 정적 자산만 캐시 우선
  if (
    url.origin === self.location.origin &&
    (url.pathname.startsWith("/icons/") ||
      url.pathname.endsWith(".webmanifest") ||
      url.pathname.endsWith(".svg") ||
      url.pathname.endsWith(".ico") ||
      url.pathname === "/sw.js")
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
  }
});
