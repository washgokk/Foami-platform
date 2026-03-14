'use client'
import { useState, useEffect } from 'react'

export default function MockDbToggle() {
    const [enabled, setEnabled] = useState(false)
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
        setEnabled(localStorage.getItem('foami_mock_db_enabled') === 'true')
    }, [])

    if (!mounted) return null

    const toggle = () => {
        const newVal = !enabled
        setEnabled(newVal)
        localStorage.setItem('foami_mock_db_enabled', String(newVal))
        window.location.reload()
    }

    return (
        <div style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 9999,
            background: enabled ? 'var(--warning-light)' : 'var(--surface)',
            border: enabled ? '2px solid var(--warning)' : '1px solid var(--border)',
            padding: '8px 16px',
            borderRadius: 100,
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            cursor: 'pointer',
            transition: 'all 0.2s',
            fontWeight: 600,
            fontSize: '0.85rem'
        }} onClick={toggle}>
            <div style={{
                width: 14, height: 14, borderRadius: '50%',
                background: enabled ? 'var(--warning)' : 'var(--text-disabled)',
            }} />
            {enabled ? 'Mock DB: ON' : 'Mock DB: OFF'}
        </div>
    )
}
