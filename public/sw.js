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
    const promise = (async () => {
        try {
            let data = { 
                title: 'Foami Wash & Delivery', 
                body: 'คุณมีข้อความใหม่จาก Foami ครับ', 
                url: '/' 
            }
            
            if (event.data) {
                try {
                    const json = event.data.json()
                    if (json && typeof json === 'object') {
                        if (json.title) data.title = String(json.title)
                        if (json.body) data.body = String(json.body)
                        if (json.url) data.url = String(json.url)
                    }
                } catch (e) {
                    const text = event.data.text()
                    if (text) data.body = text
                }
            }

            // Ensure title and body are never empty/null
            const title = data.title || 'Foami Wash & Delivery'
            const body = data.body || 'คุณมีข้อความใหม่ครับ'

            const options = {
                body: body,
                icon: '/icon.svg',
                badge: '/icon.svg',
                vibrate: [100, 50, 100],
                data: {
                    url: data.url || '/'
                },
                tag: 'foami-notif-' + (data.url || 'default').replace(/[^a-z0-9]/gi, '-'),
                renotify: true
            }

            return await self.registration.showNotification(title, options)
        } catch (err) {
            console.error('Service Worker Push Error:', err)
            // Fallback to show SOMETHING so the browser doesn't show the generic message
            return await self.registration.showNotification('Foami Wash & Delivery', {
                body: 'คุณมีการแจ้งเตือนใหม่ กรุณาเปิดแอปเพื่อตรวจสอบครับ',
                icon: '/icon.svg'
            })
        }
    })()

    event.waitUntil(promise)
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
