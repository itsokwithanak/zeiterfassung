/* AK-Zeit Service Worker — macht die App offline verfügbar.
   App-Dateien: network-first (Updates kommen sofort an, offline aus dem Cache; nach 4 s ohne Antwort ebenfalls Cache).
   Google-Fonts: cache-first. Alles andere (Dropbox-API, Tesseract-CDN) wird nicht angefasst.
   Bei Änderungen an CORE die Versionsnummer in CACHE erhöhen. */
const CACHE='ak-zeit-v2';
const CORE=['./','./manifest.webmanifest','./icon-192.png','./icon-512.png'];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});

function fromCache(req){
  return caches.match(req,{ignoreSearch:true}).then(r=>r||(req.mode==='navigate'?caches.match('./'):undefined));
}
function networkFirst(req){
  return new Promise(resolve=>{
    let done=false;
    const finish=r=>{if(!done&&r){done=true;resolve(r);}};
    const t=setTimeout(()=>fromCache(req).then(finish),4000);  /* schlechtes Netz: nicht ewig warten */
    fetch(req).then(res=>{
      clearTimeout(t);
      if(res.ok){const cp=res.clone();caches.open(CACHE).then(c=>c.put(req,cp));}
      finish(res);
    }).catch(()=>{
      clearTimeout(t);
      fromCache(req).then(r=>{if(!done){done=true;resolve(r||Response.error());}});
    });
  });
}
function cacheFirst(req){
  return caches.match(req).then(r=>r||fetch(req).then(res=>{
    const cp=res.clone();caches.open(CACHE).then(c=>c.put(req,cp));return res;
  }));
}

self.addEventListener('fetch',e=>{
  const req=e.request;if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin===self.location.origin){e.respondWith(networkFirst(req));return;}
  if(url.hostname==='fonts.googleapis.com'||url.hostname==='fonts.gstatic.com'){e.respondWith(cacheFirst(req));}
});
