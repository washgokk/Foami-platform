'use client'
import React, { createContext, useContext, useEffect, useState } from 'react'
import liff from '@line/liff'

interface LiffContextType {
    liff: typeof liff | null
    profile: any | null
    isLoggedIn: boolean
    error: string | null
}

const LiffContext = createContext<LiffContextType>({
    liff: null,
    profile: null,
    isLoggedIn: false,
    error: null,
})

export const useLiff = () => useContext(LiffContext)

export const LiffProvider = ({ 
    children, 
    liffId 
}: { 
    children: React.ReactNode, 
    liffId: string 
}) => {
    const [liffObject, setLiffObject] = useState<typeof liff | null>(null)
    const [profile, setProfile] = useState<any | null>(null)
    const [isLoggedIn, setIsLoggedIn] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!liffId) return

        const isManagePath = window.location.pathname.startsWith('/admin') || 
                            window.location.pathname.startsWith('/staff')

        liff.init({ liffId })
            .then(() => {
                setLiffObject(liff)
                if (liff.isLoggedIn()) {
                    setIsLoggedIn(true)
                    liff.getProfile()
                        .then((p) => {
                            setProfile(p)
                            localStorage.setItem('liff_line_user_id', p.userId)
                            localStorage.setItem('liff_display_name', p.displayName)
                            if (p.pictureUrl) localStorage.setItem('liff_picture_url', p.pictureUrl)
                        })
                } else if (!isManagePath && liff.isInClient()) {
                    // Only auto-login if in LINE client and NOT on admin/staff pages
                    liff.login()
                }
            })
            .catch((err) => {
                console.error('LIFF init failed:', err)
                setError(err.toString())
            })
    }, [liffId])

    return (
        <LiffContext.Provider value={{ liff: liffObject, profile, isLoggedIn, error }}>
            {children}
        </LiffContext.Provider>
    )
}
