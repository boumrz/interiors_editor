// Test-only native old-controller fixture: no fetch interception or storage.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('message',event=>{if(event.data?.type==='INTERIORS_RELEASE_MANIFEST')event.ports[0]?.postMessage({kind:'unavailable'});});
