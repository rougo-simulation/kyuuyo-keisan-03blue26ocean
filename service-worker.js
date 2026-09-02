// ============================================================================
// service-worker.js — オフライン対応・PWAインストール用のサービスワーカー
// ============================================================================
// 【重要】アプリを更新してGitHubに再アップロードするたびに、下の CACHE_VERSION の
// 数字を1つ増やしてください（例："v1" → "v2"）。増やさないと、スマホ/PCにインストール
// 済みの人には古いキャッシュのままのアプリが表示され続けてしまいます。
const CACHE_VERSION = "v1";
const CACHE_NAME = `payroll-app-${CACHE_VERSION}`;

// オフラインでも最低限アプリが起動できるよう、事前にキャッシュしておくファイル。
// index.htmlは単体で全機能（計算ロジック含む）を内包しているため、これだけで
// 通常の給与計算・年末調整・印刷までオフラインで動作する
// （※国税庁PDFへの自動入力機能は、初回にPyodide/pypdfをネットから取得するため、
// 　その機能だけはオンライン時に一度使っておく必要がある）。
const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-512-maskable.png",
  "./icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // 同一オリジン（このアプリ自身のファイル）以外（Pyodide CDN等）はサービスワーカーで
  // 制御せず、通常のブラウザ処理に任せる（PDF自動入力機能に必要なため）。
  if (new URL(req.url).origin !== self.location.origin) {
    return;
  }

  // HTML本体（index.html／トップページ）は「まずネットワークを試し、失敗したら
  // キャッシュ」の方針にする。アプリを更新した際、オンラインであれば常に最新版が
  // 表示されるようにするため。
  if (req.mode === "navigate" || (req.destination === "document")) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          return res;
        })
        .catch(() => caches.match(req).then((res) => res || caches.match("./index.html")))
    );
    return;
  }

  // それ以外の静的ファイル（マニフェスト・アイコン）は「まずキャッシュ、無ければ
  // ネットワーク」でよい（更新頻度が低いため）。
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req))
  );
});
