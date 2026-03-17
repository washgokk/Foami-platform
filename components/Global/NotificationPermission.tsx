'use client'
import { useEffect, useState } from 'react'
import { usePushNotifications } from '@/lib/hooks/usePushNotifications'

export default function NotificationPermission() {
    const [userId, setUserId] = useState<string | undefined>(undefined);
    const [platform, setPlatform] = useState<'customer' | 'staff' | 'admin'>('customer');

    const { subscribe } = usePushNotifications(userId, platform);

    useEffect(() => {
        // Detect userId and platform from localStorage
        const staff = localStorage.getItem('staff_data');
        const admin = localStorage.getItem('admin_token');
        const customer = localStorage.getItem('liff_customer');

        if (admin) {
            setUserId('admin_user'); // Admin might need a specific ID strategy
            setPlatform('admin');
        } else if (staff) {
            try {
                const s = JSON.parse(staff);
                setUserId(s.id);
                setPlatform('staff');
            } catch (e) {}
        } else if (customer) {
            try {
                const c = JSON.parse(customer);
                setUserId(c.id);
                setPlatform('customer');
            } catch (e) {}
        }
    }, []);

    useEffect(() => {
        // Only run in client-side
        if (typeof window === 'undefined') return;

        const requestPermission = async () => {
            // Check if browser supports notifications
            if (!('Notification' in window)) return;
            if (!('serviceWorker' in navigator)) return;

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
                    
                    if (permission === 'granted' && userId) {
                        console.log('Permission granted! Automatically subscribing...');
                        await subscribe();
                    }
                } catch (error) {
                    console.error('Error requesting notification permission:', error);
                }
            }, 3000); // 3 seconds delay
        };

        if (userId) {
            requestPermission();
        }
    }, [userId, subscribe]);

    return null; // This component doesn't render anything
}
