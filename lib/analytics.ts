/**
 * Microsoft Clarity & User Listening Analytics Utility
 * Provides session replay tagging, step funnel tracking, and click tracking.
 */

declare global {
    interface Window {
        clarity?: (action: string, keyOrEvent: string, value?: string) => void
    }
}

export const CLARITY_PROJECT_ID = process.env.NEXT_PUBLIC_CLARITY_ID || 'q3f0g8w9'

/**
 * Send custom tag to Microsoft Clarity session
 * Helps filter sessions by user state e.g. clarity('set', 'step', '2_datetime')
 */
export function trackClarityTag(key: string, value: string) {
    if (typeof window !== 'undefined' && typeof window.clarity === 'function') {
        try {
            window.clarity('set', key, value)
        } catch (e) {
            console.debug('[Clarity] Tag error:', e)
        }
    }
}

/**
 * Send custom event to Microsoft Clarity
 * Shown in Clarity dashboard event timeline
 */
export function trackClarityEvent(eventName: string) {
    if (typeof window !== 'undefined' && typeof window.clarity === 'function') {
        try {
            window.clarity('event', eventName)
        } catch (e) {
            console.debug('[Clarity] Event error:', e)
        }
    }
}

/**
 * Track step in single-page booking flow
 */
export function trackBookingStep(stepIndex: number, stepName: string, meta?: Record<string, any>) {
    if (typeof window === 'undefined') return

    const tagVal = `step_${stepIndex}_${stepName}`
    trackClarityTag('booking_current_step', tagVal)
    trackClarityEvent(`booking_reached_${stepName}`)

    if (meta?.branchSlug) {
        trackClarityTag('booking_branch', String(meta.branchSlug))
    }
    if (meta?.packageName) {
        trackClarityTag('selected_package', String(meta.packageName))
    }

    console.debug(`[Analytics] Step reached: ${stepIndex} (${stepName})`, meta)
}

/**
 * Track specific button click or user intent
 */
export function trackButtonClick(buttonName: string, section?: string) {
    if (typeof window === 'undefined') return
    trackClarityEvent(`click_${buttonName}`)
    if (section) {
        trackClarityTag('last_clicked_section', section)
    }
}
