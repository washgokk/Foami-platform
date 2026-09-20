import { initializeApp, getApps, getApp } from 'firebase/app'
import {
    getAuth,
    RecaptchaVerifier,
    signInWithPhoneNumber,
    GoogleAuthProvider,
    signInWithPopup,
    type ConfirmationResult
} from 'firebase/auth'

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
}

export const isFirebaseConfigured = () => {
    return !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY && !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
}

// Singleton app init
export const app = getApps().length > 0 ? getApp() : (isFirebaseConfigured() ? initializeApp(firebaseConfig) : null)
export const auth = app ? getAuth(app) : null

if (auth) {
    auth.useDeviceLanguage()
}

/**
 * Setup RecaptchaVerifier for Phone OTP verification
 */
export function setupRecaptcha(containerId: string = 'recaptcha-container') {
    if (typeof window === 'undefined' || !auth) return null
    try {
        if ((window as any).recaptchaVerifier) {
            return (window as any).recaptchaVerifier
        }
        const verifier = new RecaptchaVerifier(auth, containerId, {
            size: 'invisible',
            callback: () => {
                // reCAPTCHA solved
            },
            'expired-callback': () => {
                console.warn('[Firebase Auth] Recaptcha expired')
            }
        })
        ;(window as any).recaptchaVerifier = verifier
        return verifier
    } catch (e) {
        console.error('[Firebase Auth] Error setting up reCAPTCHA:', e)
        return null
    }
}

/**
 * Send Phone OTP
 * Converts 08xxxxxxxx or 09xxxxxxxx to +66xxxxxxxx
 */
export async function sendPhoneOtp(rawPhone: string, containerId: string = 'recaptcha-container'): Promise<ConfirmationResult | { mock: true; phone: string }> {
    const cleanDigits = rawPhone.replace(/\D/g, '')
    let e164 = rawPhone.trim()
    if (cleanDigits.startsWith('0')) {
        e164 = `+66${cleanDigits.slice(1)}`
    } else if (!e164.startsWith('+')) {
        e164 = `+${cleanDigits}`
    }

    // Fallback/Mock mode if Firebase env is not configured
    if (!isFirebaseConfigured() || !auth) {
        console.warn('[Firebase Auth] Firebase keys not detected. Running in Dev/Mock mode. Use OTP: 123456')
        return { mock: true, phone: e164 }
    }

    const appVerifier = setupRecaptcha(containerId)
    if (!appVerifier) {
        throw new Error('ไม่สามารถเตรียมระบบความปลอดภัย reCAPTCHA ได้')
    }

    return await signInWithPhoneNumber(auth, e164, appVerifier)
}

/**
 * Sign in with Google (Client SDK)
 */
export async function signInWithGoogle() {
    if (!isFirebaseConfigured() || !auth) {
        throw new Error('Firebase credentials are not configured in .env.local')
    }
    const provider = new GoogleAuthProvider()
    return await signInWithPopup(auth, provider)
}
