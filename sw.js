// Service worker do PWA. A prioridade é sempre a rede — o painel mostra
// dados reais que mudam com frequência, então cache-first serviria dado
// desatualizado. O cache aqui existe só como fallback de instalação/offline;
// toda resposta de rede bem-sucedida atualiza o cache, então o "offline"
// nunca fica preso numa versão antiga por muito tempo.
const CACHE_NAME = "gp-cache-v1";
const CORE_ASSETS = [
  "inicio.html",
  "index.html",
  "css/styles.css",
  "js/app.js",
  "js/charts.js",
  "manifest.json",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).catch(() => {})
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then((cached) => cached || caches.match("inicio.html")))
  );
});
