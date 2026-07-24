const CACHE_NAME = "fieldflow-shell-v4";
const APP_SHELL = ["/", "/login", "/studies", "/survey/new", "/drafts", "/review", "/gis", "/analytics", "/reports", "/manifest.webmanifest"];

async function cachePageAndAssets(cache, path) {
  const response = await fetch(path);
  if (!response.ok) return;
  await cache.put(path, response.clone());
  if (!response.headers.get("content-type")?.includes("text/html")) return;
  const html = await response.text();
  const assetPaths = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
    .map((match) => match[1])
    .filter((asset) => asset.startsWith("/_next/static/") || asset.startsWith("/images/") || asset === "/manifest.webmanifest");
  await Promise.allSettled([...new Set(assetPaths)].map((asset) => cache.add(asset)));
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => Promise.all(APP_SHELL.map((path) => cachePageAndAssets(cache, path)))));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || !event.request.url.startsWith(self.location.origin)) return;
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => { const copy = response.clone(); caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)); return response; })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match(new URL(event.request.url).pathname)).then((cached) => cached || caches.match("/"))),
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      if (response.ok) { const copy = response.clone(); caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)); }
      return response;
    })),
  );
});
