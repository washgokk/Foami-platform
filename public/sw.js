self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

self.addEventListener('fetch', (event) => {
    // Standard fetch handler to satisfy PWA requirements
    // For now, just pass through to network
    event.respondWith(fetch(event.request));
});

self.addEventListener('push', function (event) {
    try {
        let data = { title: 'Foami Wash & Delivery', body: 'คุณมีข้อความใหม่ครับ', url: '/' }
        
        if (event.data) {
            try {
                const json = event.data.json()
                data = { ...data, ...json }
            } catch (e) {
                const text = event.data.text()
                if (text) data.body = text
            }
        }

        const options = {
            body: data.body,
            icon: '/icon.svg',
            badge: '/icon.svg',
            vibrate: [100, 50, 100],
            data: {
                url: data.url || '/'
            },
            // For iOS/Android: ensure it shows up prominently
            tag: 'foami-notification-' + Date.now(),
            renotify: true
        }

        event.waitUntil(
            self.registration.showNotification(data.title, options)
        )
    } catch (err) {
        console.error('Service Worker Push Error:', err)
    }
})

self.addEventListener('notificationclick', function (event) {
    event.notification.close()
    
    // Use an absolute URL if possible
    let urlToOpen = event.notification.data.url || '/'
    if (!urlToOpen.startsWith('http')) {
        urlToOpen = self.location.origin + urlToOpen
    }
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
            for (let i = 0; i < clientList.length; i++) {
                let client = clientList[i];
                if (client.url === urlToOpen && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    )
})
