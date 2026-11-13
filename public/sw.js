const CACHE = 'nulls-v1';
const ASSETS = ['./', './index.html'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      await cache.addAll(ASSETS);
      // Precache every built asset referenced by index.html.
      const res = await fetch('./index.html');
      const html = await res.text();
      const urls = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
        .map((m) => m[1])
        .filter((u) => !u.startsWith('http') && !u.startsWith('data:'))
        .map((u) => './' + u.replace(/^\.\//, '').replace(/^\//, ''));
      await cache.addAll(urls).catch(() => undefined);
      // Generated game assets
      const paths = [];
      for (const c of ['riff', 'prism', 'brass', 'loop']) {
        paths.push(`./assets/sprites/skater_${c}.png`, `./assets/sprites/skater_${c}.json`);
      }
      for (const lvl of ['alley', 'subway', 'warehouse']) {
        paths.push(`./assets/backgrounds/${lvl}_far.png`, `./assets/backgrounds/${lvl}_mid.png`);
      }
      paths.push('./assets/sprites/fx.png', './assets/sprites/board.png', './assets/ui/font.png');
      const props = ['kicker', 'rail', 'dumpster', 'quarter', 'funbox', 'bench', 'letter_S', 'letter_K',
        'letter_A', 'letter_T', 'letter_E', 'token_arcade', 'token_metro', 'spray', 'wrench',
        'trashcan', 'drum', 'barrier', 'manualpad'];
      for (const p of props) paths.push(`./assets/props/${p}.png`);
      paths.push('./assets/backgrounds/alley_near.png', './assets/ref_scaled/ref_env_alley.png', './assets/ref_scaled/ref_env_subway.png');
      await cache.addAll(paths).catch(() => undefined);
    }),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      if (res.ok && new URL(req.url).origin === location.origin) {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(req, copy));
      }
      return res;
    }).catch(() => caches.match('./index.html'))),
  );
});
