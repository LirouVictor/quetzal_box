// Service worker (gerado no build a partir de src/sw-template.js).
// - App: precache de todos os arquivos do build; navegação responde do cache e atualiza em segundo plano.
// - Sprites (PokeAPI/sprites): cache-first, guardando os que já foram vistos para uso offline.

const VERSION = '__VERSION__';
const PRECACHE = __PRECACHE__;
const APP_CACHE = 'qsv-app-' + VERSION;
const SPRITE_CACHE = 'qsv-sprites-v1';
const MAX_SPRITES = 1500;
const SPRITE_PREFIX = 'https://raw.githubusercontent.com/PokeAPI/sprites/';

self.addEventListener('install', event => {
  event.waitUntil(caches.open(APP_CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('qsv-app-') && key !== APP_CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

async function trimSprites(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_SPRITES; i++) await cache.delete(keys[i]);
}

async function spriteFirst(request) {
  const cache = await caches.open(SPRITE_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) {
    await cache.put(request, res.clone());
    trimSprites(cache);
  }
  return res;
}

async function appFirst(request, event) {
  const cache = await caches.open(APP_CACHE);
  const isNav = request.mode === 'navigate';
  const key = isNav ? './' : request;
  const hit = await cache.match(key, { ignoreSearch: isNav });
  const update = () => fetch(request).then(res => {
    if (res.ok) cache.put(key, res.clone());
    return res;
  });
  if (hit) {
    // Arquivos do build têm hash no nome e não mudam; só a página é atualizada em segundo plano.
    if (isNav) event.waitUntil(update().catch(() => {}));
    return hit;
  }
  return update();
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (request.url.startsWith(SPRITE_PREFIX)) { event.respondWith(spriteFirst(request)); return; }
  if (new URL(request.url).origin === location.origin) event.respondWith(appFirst(request, event));
});
