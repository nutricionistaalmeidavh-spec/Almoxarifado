const CACHE='artisys-almoxarifado-shell-v6';
const SHELL=['/','/index.html','/app.js','/ui-v2.js','/theme-lote-a.css','/barcode.js','/features-16-20.js','/styles.css','/manifest.webmanifest','/vendor/html5-qrcode.min.js'];
self.addEventListener('install',(event)=>event.waitUntil(caches.open(CACHE).then((cache)=>cache.addAll(SHELL))));
self.addEventListener('activate',(event)=>event.waitUntil(caches.keys().then((keys)=>Promise.all(keys.filter((key)=>key!==CACHE).map((key)=>caches.delete(key))))));
self.addEventListener('fetch',(event)=>{if(event.request.method!=='GET'||new URL(event.request.url).pathname.startsWith('/api/'))return;event.respondWith(caches.match(event.request).then((hit)=>hit||fetch(event.request)));});
