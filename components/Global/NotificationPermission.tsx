'use client'
import { useEffect } from 'react'

export default function NotificationPermission() {
    useEffect(() => {
        // Only run in client-side
        if (typeof window === 'undefined') return;

        const requestPermission = async () => {
            // Check if browser supports notifications
            if (!('Notification' in window)) return;

            // Check if already requested or already has permission
            if (Notification.permission !== 'default') return;
            
            const hasRequested = localStorage.getItem('foami_notif_requested');
            if (hasRequested) return;

            // Wait a bit after mount to not be annoying
            setTimeout(async () => {
                try {
                    const permission = await Notification.requestPermission();
                    localStorage.setItem('foami_notif_requested', 'true');
                    console.log('Notification permission:', permission);
                } catch (error) {
                    console.error('Error requesting notification permission:', error);
                }
            }, 3000); // 3 seconds delay
        };

        requestPermission();
    }, []);

    return null; // This component doesn't render anything
}
