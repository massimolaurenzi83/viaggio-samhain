// Service worker: tutta l'app (foto comprese) disponibile offline.
// VERSIONE viene riscritta da scripts/build_web.py (hash dei contenuti): cambia a ogni modifica dei file.
const VERSIONE = '4ee9758b5516';
const NOME_CACHE = 'samhain-2026-' + VERSIONE;
const PREFISSO = 'samhain-2026-';

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(NOME_CACHE);
    let elenco = ['./', './index.html'];
    try {
      const r = await fetch('./precache.json', { cache: 'no-store' });
      if (r.ok) elenco = elenco.concat(await r.json());
    } catch (e) { /* senza elenco si precarica il minimo */ }
    elenco = [...new Set(elenco)];
    // a gruppi, e tollerante: un file mancante non deve far fallire l'installazione
    const GRUPPO = 12;
    for (let i = 0; i < elenco.length; i += GRUPPO) {
      await Promise.all(elenco.slice(i, i + GRUPPO).map(async (url) => {
        try {
          const risposta = await fetch(url, { cache: 'reload' });
          if (risposta.ok) await cache.put(url, risposta);
        } catch (e) { /* file non scaricato: verrà preso alla prima richiesta */ }
      }));
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const nomi = await caches.keys();
    await Promise.all(nomi.filter((n) => n.startsWith(PREFISSO) && n !== NOME_CACHE).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // API esterne (open-meteo, noaa) e ogni altra origine: rete diretta, nessuna cache del service worker
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(NOME_CACHE);
    const trovato = await cache.match(req, { ignoreSearch: true });
    if (trovato) return trovato;
    try {
      const risposta = await fetch(req);
      if (risposta.ok && risposta.type === 'basic') cache.put(req, risposta.clone()).catch(() => {});
      return risposta;
    } catch (e) {
      if (req.mode === 'navigate') {
        const home = (await cache.match('./index.html')) || (await cache.match('./'));
        if (home) return home;
      }
      return new Response('Contenuto non disponibile offline', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
  })());
});
