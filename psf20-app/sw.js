const C='psf20-v2';
const FILES=['./','./index.html','./app.css','./manifest.webmanifest','./icon-192.png','./icon-512.png',
  './js/app.js','./js/render.js','./js/printer.js','./js/raster.js','./js/qr.js','./js/barcode.js','./js/templates.js'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
// network first so updates arrive; cache is the offline fallback
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  e.respondWith(fetch(e.request).then(r=>{const cp=r.clone();caches.open(C).then(c=>c.put(e.request,cp));return r})
    .catch(()=>caches.match(e.request).then(m=>m||caches.match('./index.html'))))
});
