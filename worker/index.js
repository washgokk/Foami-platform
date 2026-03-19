// SW Version: 2026-03-20-v5.1 (Production Merged)
self.addEventListener('push', function (event) {
    console.log('[SW] Push Received V5.1');

    let title = 'Foami Wash & Delivery';
    let body = 'คุณมีการแจ้งเตือนใหม่ กรุณาเปิดแอปครับ';
    let url = '/';
    let icon = '/icon.svg';

    if (event.data) {
        try {
            const json = event.data.json();
            console.log('[SW] Push data:', json);
            if (json.title) title = json.title;
            if (json.body)  body  = json.body;
            if (json.url)   url   = json.url;
            if (json.icon)  icon  = json.icon;
        } catch (e) {
            try {
                const text = event.data.text();
                const parsed = JSON.parse(text);
                if (parsed.title) title = parsed.title;
                if (parsed.body)  body  = parsed.body;
                if (parsed.url)   url   = parsed.url;
            } catch (e2) {
                console.warn('[SW] Could not parse push data', e2);
            }
        }
    }

    const notifOptions = {
        body,
        icon,
        badge: '/icon.svg',
        vibrate: [200, 100, 200],
        data: { url },
        tag: 'foami-' + url.replace(/[^a-z0-9]/gi, '-'),
        renotify: true,
        requireInteraction: false,
    };

    event.waitUntil(
        self.registration.showNotification(title, notifOptions)
            .catch(function(err) {
                console.error('[SW] showNotification failed:', err);
                return self.registration.showNotification('Foami: การแจ้งเตือนใหม่', {
                    body: 'กรุณาเปิดแอปเพื่อตรวจสอบสถานะครับ',
                    icon: '/icon.svg'
                });
            })
    );
});

self.addEventListener('notificationclick', function (event) {
    event.notification.close()
    
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
