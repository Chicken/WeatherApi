self.addEventListener('install', event => {
    event.waitUntil((async () => {
        const cache = await caches.open("offline");
        await cache.add(new Request("./media/offline.html", { cache: 'reload' }));
    })());
});

self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        if ('navigationPreload' in self.registration) {
            await self.registration.navigationPreload.enable();
        }
    })());
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    if (event.request.mode === 'navigate') {
        event.respondWith((async () => {
            try {
                const preloadResponse = await event.preloadResponse;
                if (preloadResponse) {
                    return preloadResponse;
                }
                return await fetch(event.request);
            } catch (err) {
                const cache = await caches.open("offline");
                return await cache.match("./media/offline.html");;
            }
        })());
    }
});