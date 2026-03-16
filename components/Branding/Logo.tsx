'use client'
import React from 'react'

interface LogoProps {
    variant?: 'landscape' | 'icon'
    width?: number | string
    className?: string
    style?: React.CSSProperties
}

export default function Logo({ 
    variant = 'landscape', 
    width = 140, 
    className = '', 
    style = {} 
}: LogoProps) {
    const src = variant === 'landscape' ? '/logo - lanscape.svg' : '/icon.svg'
    
    // Ensure minimum size of 110px as requested by user
    const finalWidth = typeof width === 'number' ? Math.max(width, 110) : width

    return (
        <img 
            src={src} 
            alt="Foami Logo" 
            className={className}
            style={{ 
                width: finalWidth, 
                height: 'auto', 
                display: 'block',
                margin: '0 auto',
                ...style 
            }}
        />
    )
}
