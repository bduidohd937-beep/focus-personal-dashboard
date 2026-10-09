/* FOCUS V2.2 service worker: offline app shell, never return HTML for JS/CSS fetches. */
const VERSION='focus-shell-v2.2';
const ASSETS=['./','./index.html','./app.js','./data.js','./cloud.js','./timer.js','./cloud-config.js','./sync-logic.js','./styles.css','./manifest.webmanifest','./icon.svg','./icon-192.png','./icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(VERSION).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('focus-shell-')&&k!==VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==location.origin)return;
 event.respondWith((async()=>{
  try{
   const response=await fetch(request);
   if(response.ok){
    const cloned=response.clone();
    event.waitUntil(caches.open(VERSION).then(c=>c.put(request,cloned)));
   }
   return response;
  }catch{
   const cached=await caches.match(request);
   if(cached)return cached;
   if(request.mode==='navigate')return caches.match('./index.html')||Response.error();
   return Response.error();
  }
 })());
});
