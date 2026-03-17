// SW Version: 2026-03-18-v3-Robust
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('Foami Service Worker v3 Activated');
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
    console.log('[SW] Push Received');
    
    const promise = (async () => {
        let data = { 
            title: 'Foami Wash & Delivery', 
            body: 'คุณมีข้อความใหม่จาก Foami ครับ', 
            url: '/' 
        };

        if (event.data) {
            try {
                // Try parsing as JSON
                const json = event.data.json();
                console.log('[SW] Push JSON:', json);
                if (json && typeof json === 'object') {
                    if (json.title) data.title = String(json.title);
                    if (json.body) data.body = String(json.body);
                    if (json.url) data.url = String(json.url);
                }
            } catch (e) {
                // Fallback to text
                const text = event.data.text();
                console.log('[SW] Push Text Fallback:', text);
                if (text) {
                    try {
                        const parsed = JSON.parse(text);
                        if (parsed.title) data.title = parsed.title;
                        if (parsed.body) data.body = parsed.body;
                        if (parsed.url) data.url = parsed.url;
                    } catch (innerE) {
                        data.body = text;
                    }
                }
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
            // Use a unique tag to avoid collapsing different notifications, 
            // but use the same tag if it's the same URL to update it.
            tag: 'foami-notif-' + (data.url || 'default').replace(/[^a-z0-9]/gi, '-'),
            renotify: true
        };

        console.log('[SW] Showing notification:', data.title);
        return self.registration.showNotification(data.title, options);
    })().catch(err => {
        console.error('[SW] Critical Push Error:', err);
        return self.registration.showNotification('Foami Wash & Delivery', {
            body: 'คุณมีการแจ้งเตือนใหม่ กรุณาเปิดแอปเพื่อตรวจสอบครับ',
            icon: '/icon.svg'
        });
    });

    event.waitUntil(promise);
});

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
