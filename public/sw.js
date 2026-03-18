// SW Version: 2026-03-18-v4-Final
self.addEventListener('push', function (event) {
    console.log('[SW] Push Received V4');
    
    const promise = (async () => {
        let data = { 
            title: 'Foami Wash & Delivery', 
            body: 'คุณมีการแจ้งเตือนใหม่ กรุณาเปิดแอปเพื่อตรวจสอบครับ', 
            url: '/' 
        };

        if (event.data) {
            try {
                const json = event.data.json();
                console.log('[SW] Push JSON:', json);
                if (json && typeof json === 'object') {
                    if (json.title) data.title = String(json.title);
                    if (json.body) data.body = String(json.body);
                    if (json.url) data.url = String(json.url);
                }
            } catch (e) {
                const text = event.data.text();
                console.log('[SW] Push Text:', text);
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
            tag: 'foami-notif-' + (data.url || 'default').replace(/[^a-z0-9]/gi, '-'),
            renotify: true
        };

        return self.registration.showNotification(data.title, options);
    })().catch(err => {
        console.error('[SW] Push Error:', err);
        return self.registration.showNotification('Foami: การแจ้งเตือนใหม่', {
            body: 'กรุณาแตะที่นี่เพื่อตรวจสอบรายละเอียดในแอปครับ',
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
