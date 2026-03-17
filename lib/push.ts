import webpush from 'web-push'
import { createServiceClient } from './supabase'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || ''

webpush.setVapidDetails(
    'mailto:admin@foami.th',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
)

interface PushNotificationPayload {
    title: string
    body: string
    url?: string
    actions?: Array<{ action: string; title: string; icon?: string }>
}

/**
 * Sends a push notification to a specific user on a specific platform
 */
export async function sendPushNotification(
    userId: string,
    platform: 'customer' | 'staff' | 'admin',
    payload: PushNotificationPayload
) {
    const supabase = createServiceClient()

    // 1. Get subscription from DB
    const { data: subs, error } = await supabase
        .from('push_subscriptions')
        .select('subscription')
        .eq('user_id', userId)
        .eq('platform', platform)

    if (error || !subs || subs.length === 0) {
        console.log(`No subscription found for user ${userId} on platform ${platform}`)
        return false
    }

    // 2. Send to all devices for this user/platform (Foami currently upserts to one, but could be many)
    console.log(`[Push] Found ${subs.length} subscriptions for user ${userId}`)
    
    const notificationPromises = subs.map(async (s, idx) => {
        try {
            console.log(`[Push] Sending to device ${idx + 1}...`)
            const response = await webpush.sendNotification(
                s.subscription as any,
                JSON.stringify(payload)
            )
            console.log(`[Push] Device ${idx + 1} success:`, response.statusCode)
            return true
        } catch (err: any) {
            console.error(`[Push] Device ${idx + 1} error:`, {
                status: err.statusCode,
                message: err.message,
                endpoint: (s.subscription as any)?.endpoint
            })
            // If subscription is expired/invalid, remove it
            if (err.statusCode === 410 || err.statusCode === 404) {
                console.log(`[Push] Removing expired subscription for user ${userId}`)
                await supabase
                    .from('push_subscriptions')
                    .delete()
                    .eq('subscription', JSON.stringify(s.subscription))
            }
            return false
        }
    })

    const results = await Promise.all(notificationPromises)
    const successCount = results.filter(r => r === true).length
    console.log(`[Push] Delivery summary for ${userId}: ${successCount}/${subs.length} successful`)
    return results.some(r => r === true)
}

/**
 * Sends notifications to all active staff in a specific branch or zone
 */
export async function notifyTargetStaff(
    targetIds: string[],
    payload: PushNotificationPayload
) {
    const results = await Promise.all(
        targetIds.map(id => sendPushNotification(id, 'staff', payload))
    )
    return results
}
