// 記帳アプリ サービスワーカー
// キャッシュ名はファイルを更新するたびに数字を上げてください（例: v1 -> v2）。
// 上げないと、公開後にファイルを更新してもユーザーの端末には古いキャッシュが残り続けます。
const CACHE_NAME = 'kicho-app-cache-v3';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(APP_SHELL);
    }).then(function(){
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(key){ return key !== CACHE_NAME; })
            .map(function(key){ return caches.delete(key); })
      );
    }).then(function(){
      return self.clients.claim();
    })
  );
});

// 同一オリジンのファイルはキャッシュ優先（オフライン対応）。
// Google Fonts など外部ドメインへのリクエストはそのままネットワークへ通す。
self.addEventListener('fetch', function(event) {
  var url = new URL(event.request.url);
  if (url.origin !== self.location.origin) {
    return; // 外部リクエストはSWで処理しない
  }
  if (event.request.method !== 'GET') {
    return;
  }
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) return cached;
      return fetch(event.request).then(function(response) {
        if (response && response.status === 200) {
          var responseClone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      }).catch(function() {
        // オフラインでキャッシュにも無い場合、ナビゲーション要求は index.html を返す
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
