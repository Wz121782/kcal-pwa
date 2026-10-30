/* ============================================================
   sw.js — 离线缓存
   改版时把 VERSION 加一，旧缓存会自动清掉
   ============================================================ */
var VERSION = 'kcal-v1';

var ASSETS = [
  './',
  'index.html',
  'css/app.css',
  'js/rough.js',
  'js/data.js',
  'js/engine.js',
  'js/icons.js',
  'js/annotate.js',
  'js/summary.js',
  'js/ui.js',
  'js/pwa.js',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(VERSION).then(function (cache) {
      // 单个文件失败不要导致整个安装失败
      return Promise.all(
        ASSETS.map(function (url) {
          return cache.add(new Request(url, { cache: 'reload' })).catch(function () { });
        })
      );
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== VERSION) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // 页面导航：先走网络（保证拿到最新 HTML），失败再回落缓存
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(VERSION).then(function (c) { c.put('index.html', copy); });
        return res;
      }).catch(function () {
        return caches.match('index.html').then(function (hit) {
          return hit || caches.match('./');
        });
      })
    );
    return;
  }

  // 静态资源：先用缓存，同时后台更新
  e.respondWith(
    caches.match(req).then(function (hit) {
      var net = fetch(req).then(function (res) {
        if (res && res.status === 200) {
          var copy = res.clone();
          caches.open(VERSION).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () { return hit; });

      return hit || net;
    })
  );
});
