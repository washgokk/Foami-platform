'use client'
import { useState, useEffect } from 'react'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''

export function usePushNotifications(userId: string | undefined, platform: 'customer' | 'staff' | 'admin') {
    const [subscription, setSubscription] = useState<PushSubscription | null>(null)
    const [isSubscribed, setIsSubscribed] = useState(false)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!userId) {
            setLoading(false)
            return
        }

        const checkSubscription = async () => {
            if (!('serviceWorker' in navigator)) return
            
            try {
                // Ensure SW is registered
                let registration = await navigator.serviceWorker.getRegistration()
                if (!registration) {
                    console.log('Registering SW manually...')
                    registration = await navigator.serviceWorker.register('/sw.js')
                }

                // Wait for SW to be active if it's not
                if (!registration.active) {
                    console.log('SW not active - waiting for activation...')
                    await new Promise<void>((resolve) => {
                        const checkActive = () => {
                            if (registration?.active) {
                                console.log('SW is now active!')
                                resolve()
                            } else {
                                setTimeout(checkActive, 500)
                            }
                        }
                        checkActive()
                        // Force resolve after 4 seconds to avoid infinite loop
                        setTimeout(resolve, 4000)
                    })
                }

                // Get current subscription
                const sub = await registration.pushManager.getSubscription()
                setSubscription(sub)
                setIsSubscribed(!!sub)
                console.log('Push sub check done. Subscribed:', !!sub)
            } catch (err: any) {
                console.warn('Push subscription check warning:', err)
            } finally {
                setLoading(false)
            }
        }

        if ('serviceWorker' in navigator && 'PushManager' in window) {
            checkSubscription()
        } else {
            setLoading(false)
        }
    }, [userId])

    const subscribe = async () => {
        if (!userId) return
        setLoading(true)
        setError(null)

        try {
            // Safety timeout for ready
            const registrationPromise = navigator.serviceWorker.ready
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Service Worker not ready after 5s')), 5000))
            const registration = await Promise.race([registrationPromise, timeoutPromise]) as ServiceWorkerRegistration
            
            // Convert VAPID public key to correct format
            const base64String = VAPID_PUBLIC_KEY
            if (!base64String) throw new Error('VAPID public key is missing')

            const padding = '='.repeat((4 - base64String.length % 4) % 4)
            const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
            const rawData = window.atob(base64)
            const outputArray = new Uint8Array(rawData.length)
            for (let i = 0; i < rawData.length; ++i) {
                outputArray[i] = rawData.charCodeAt(i)
            }

            const newSubscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: outputArray
            })

            // Save to server
            const res = await fetch('/api/push/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userId,
                    subscription: newSubscription,
                    platform
                })
            })

            if (!res.ok) throw new Error('Failed to save subscription on server')

            setSubscription(newSubscription)
            setIsSubscribed(true)
            return true
        } catch (err: any) {
            console.error('Error subscribing to push:', err)
            setError(err.message)
            alert('ไม่สามารถเปิดแจ้งเตือนได้: ' + (err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ Service Worker'))
            return false
        } finally {
            setLoading(false)
        }
    }

    const unsubscribe = async () => {
        if (!subscription) return
        setLoading(true)

        try {
            await subscription.unsubscribe()
            // Remove from server would be good here too
            setSubscription(null)
            setIsSubscribed(false)
        } catch (err: any) {
            console.error('Error unsubscribing:', err)
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const sendTest = async () => {
        if (!subscription) return
        try {
            await fetch('/api/push/send-test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subscription })
            })
        } catch (err) {
            console.error('Error sending test notification:', err)
        }
    }

    const reset = async () => {
        setLoading(true)
        try {
            const registrations = await navigator.serviceWorker.getRegistrations()
            for (const reg of registrations) {
                await reg.unregister()
            }
            localStorage.clear() // Optional: extreme reset
            window.location.reload()
        } catch (err) {
            console.error('Error resetting SW:', err)
        } finally {
            setLoading(false)
        }
    }

    return {
        subscribe,
        unsubscribe,
        sendTest,
        reset,
        isSubscribed,
        loading,
        error,
        subscription
    }
}
