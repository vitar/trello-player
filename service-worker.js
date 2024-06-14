// Optional service worker for offline support
self.addEventListener('install', function(event) {
    event.waitUntil(
        caches.open('trello-player-v1').then(function(cache) {
            return cache.addAll([
                '/',
                '/index.html',
                '/manifest.json',
                '/icon.png',
                '/icon-512.png',
                // Add other assets that need to be cached for offline use
            ]);
        })
    );
});

self.addEventListener('fetch', function(event) {
    event.respondWith(
        caches.match(event.request).then(function(response) {
            return response || fetch(event.request);
        })
    );
});
