'use client'
import { useState, useEffect } from 'react'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''

export function usePushNotifications(
    userId: string | undefined, 
    platform: 'customer' | 'staff' | 'admin',
    scope: string = '/'
) {
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
                    registration = await navigator.serviceWorker.register('/sw.js', { scope })
                }

                // Wait for SW to be active if it's not
                if (!registration.active) {
                    console.log('SW not active - waiting for activation...')
                    await new Promise<void>((resolve) => {
                        const checkActive = () => {
                            if (registration?.active) {
                                console.log('SW is now active!')
                                resolve()
                            } else if (registration?.waiting) {
                                registration.waiting.postMessage({ type: 'SKIP_WAITING' })
                                setTimeout(checkActive, 500)
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

    const subscribe = async (onSuccess?: () => void) => {
        if (!userId) {
            setError('User ID is missing')
            return false
        }
        setLoading(true)
        setError(null)

        try {
            console.log('Starting push subscription flow...')
            if (!('serviceWorker' in navigator)) {
                throw new Error('เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือน (No ServiceWorker support)')
            }

            // Get registration first
            let registration = await navigator.serviceWorker.getRegistration()
            
            // If no registration, try to register it now
            if (!registration) {
                console.log('No SW registration found during subscribe - registering now...')
                registration = await navigator.serviceWorker.register('/sw.js', { scope })
            }

            // Ensure it's ready
            await navigator.serviceWorker.ready

            // Robust check for active state
            if (!registration.active) {
                console.log('SW not active yet, waiting...')
                
                // Helper to wait for active
                const waitForActive = (reg: ServiceWorkerRegistration) => {
                    return new Promise<ServiceWorkerRegistration | null>((resolve) => {
                        const check = () => {
                            if (reg.active) {
                                console.log('SW is now active!')
                                resolve(reg)
                            } else if (reg.waiting) {
                                console.log('SW in waiting state - sending SKIP_WAITING')
                                reg.waiting.postMessage({ type: 'SKIP_WAITING' })
                                setTimeout(check, 500)
                            } else if (reg.installing) {
                                console.log('SW still installing...')
                                setTimeout(check, 500)
                            } else {
                                resolve(null)
                            }
                        }
                        check()
                        setTimeout(() => resolve(null), 8000)
                    })
                }

                const activeReg = await waitForActive(registration)
                if (activeReg) registration = activeReg
            }

            if (!registration || !registration.active) {
                throw new Error('ไม่สามารถเปิดใช้งาน Service Worker ได้ โปรดรีเฟรชหน้าเว็บและลองอีกครั้ง')
            }

            const base64String = VAPID_PUBLIC_KEY
            if (!base64String) throw new Error('VAPID public key is missing (NEXT_PUBLIC_VAPID_PUBLIC_KEY)')

            // Helper to convert VAPID key
            const urlBase64ToUint8Array = (base64String: string) => {
                const padding = '='.repeat((4 - base64String.length % 4) % 4)
                const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
                const rawData = window.atob(base64)
                const outputArray = new Uint8Array(rawData.length)
                for (let i = 0; i < rawData.length; ++i) {
                    outputArray[i] = rawData.charCodeAt(i)
                }
                return outputArray
            }

            let newSubscription;
            try {
                newSubscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(base64String)
                })
            } catch (pSubErr: any) {
                console.error('Initial push subscribe attempt failed:', pSubErr)
                
                // If it's a push service error, try self-healing once
                if (pSubErr.message?.toLowerCase().includes('push service error') || pSubErr.name === 'AbortError') {
                    console.warn('Push service error detected. Attempting to reset Service Worker and retry...')
                    const regs = await navigator.serviceWorker.getRegistrations()
                    for (const r of regs) await r.unregister()
                    
                    // Re-register
                    const newReg = await navigator.serviceWorker.register('/sw.js', { scope })
                    await navigator.serviceWorker.ready
                    
                    // Retry subscribe
                    newSubscription = await newReg.pushManager.subscribe({
                        userVisibleOnly: true,
                        applicationServerKey: urlBase64ToUint8Array(base64String)
                    })
                } else {
                    throw pSubErr
                }
            }

            if (!newSubscription) throw new Error('Could not create push subscription')

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

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}))
                throw new Error(errorData.error || `Server error: ${res.status} ${res.statusText}`)
            }

            setSubscription(newSubscription)
            setIsSubscribed(true)
            if (onSuccess) onSuccess()
            return true
        } catch (err: any) {
            console.error('Critical push subscription error:', err)
            setError(err.message)
            // Display a more helpful message to the user
            let userMsg = err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ'
            if (userMsg.includes('push service error')) {
                userMsg = 'Browser ไม่สามารถเชื่อมต่อกับบริการแจ้งเตือนได้ (Push Service Error) กรุณารีเฟรชหน้าเว็บหรือลองใช้เบราว์เซอร์อื่นครับ'
            }
            alert('ไม่สามารถเปิดแจ้งเตือนได้: ' + userMsg)
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
