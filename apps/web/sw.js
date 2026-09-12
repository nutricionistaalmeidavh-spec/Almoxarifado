const CACHE='artisys-almoxarifado-shell-v3';
const SHELL=['/','/index.html','/app.js','/barcode.js','/styles.css','/manifest.webmanifest'];
self.addEventListener('install',(event)=>event.waitUntil(caches.open(CACHE).then((cache)=>cache.addAll(SHELL))));
self.addEventListener('activate',(event)=>event.waitUntil(caches.keys().then((keys)=>Promise.all(keys.filter((key)=>key!==CACHE).map((key)=>caches.delete(key))))));
self.addEventListener('fetch',(event)=>{if(event.request.method!=='GET'||new URL(event.request.url).pathname.startsWith('/api/'))return;event.respondWith(caches.match(event.request).then((hit)=>hit||fetch(event.request)));});
