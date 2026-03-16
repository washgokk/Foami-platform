'use client'
import { useState, useEffect, useCallback } from 'react'
import { X, Maximize2, ChevronLeft, ChevronRight } from 'lucide-react'

interface ImageData {
    src: string
    alt?: string
}

interface ImageZoomProps {
    images: (string | ImageData)[]
    initialIndex?: number
    onClose: () => void
}

export default function ImageZoom({ images, initialIndex = 0, onClose }: ImageZoomProps) {
    const [currentIndex, setCurrentIndex] = useState(initialIndex)
    const [isLoaded, setIsLoaded] = useState(false)
    const [direction, setDirection] = useState(0) // -1 for left, 1 for right

    // Normalize images to ImageData[]
    const normalizedImages: ImageData[] = images.map(img => 
        typeof img === 'string' ? { src: img } : img
    )

    const currentImage = normalizedImages[currentIndex]

    useEffect(() => {
        document.body.style.overflow = 'hidden'
        return () => {
            document.body.style.overflow = 'unset'
        }
    }, [])

    const handleNext = useCallback((e?: React.MouseEvent) => {
        e?.stopPropagation()
        if (currentIndex < normalizedImages.length - 1) {
            setDirection(1)
            setIsLoaded(false)
            setCurrentIndex(prev => prev + 1)
        }
    }, [currentIndex, normalizedImages.length])

    const handlePrev = useCallback((e?: React.MouseEvent) => {
        e?.stopPropagation()
        if (currentIndex > 0) {
            setDirection(-1)
            setIsLoaded(false)
            setCurrentIndex(prev => prev - 1)
        }
    }, [currentIndex])

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight') handleNext()
            if (e.key === 'ArrowLeft') handlePrev()
            if (e.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [handleNext, handlePrev, onClose])

    return (
        <div 
            className="animate-fade"
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                background: 'rgba(0, 0, 0, 0.9)',
                backdropFilter: 'blur(20px)',
                zIndex: 9999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '24px',
                cursor: 'zoom-out'
            }}
            onClick={onClose}
        >
            {/* Top Controls */}
            <div 
                style={{
                    position: 'absolute',
                    top: 'calc(env(safe-area-inset-top, 24px) + 8px)',
                    right: 'calc(env(safe-area-inset-right, 24px) + 8px)',
                    display: 'flex',
                    gap: 16,
                    zIndex: 10000
                }}
                onClick={e => e.stopPropagation()}
            >
                <button 
                    className="btn btn-ghost" 
                    style={{ 
                        background: 'rgba(255,255,255,0.15)', 
                        color: 'white', 
                        borderRadius: '14px',
                        width: 48,
                        height: 48,
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backdropFilter: 'blur(10px)'
                    }}
                    onClick={() => window.open(currentImage.src, '_blank')}
                >
                    <Maximize2 size={22} />
                </button>
                <button 
                    className="btn btn-ghost" 
                    style={{ 
                        background: 'rgba(255,255,255,0.25)', 
                        color: 'white', 
                        borderRadius: '14px',
                        width: 48,
                        height: 48,
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backdropFilter: 'blur(10px)'
                    }}
                    onClick={onClose}
                >
                    <X size={28} />
                </button>
            </div>

            {/* Image Counter (Top Center) */}
            {normalizedImages.length > 1 && (
                <div 
                    style={{
                        position: 'absolute',
                        top: 'calc(env(safe-area-inset-top, 24px) + 18px)',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        color: 'white',
                        background: 'rgba(0,0,0,0.4)',
                        backdropFilter: 'blur(10px)',
                        padding: '6px 16px',
                        borderRadius: '20px',
                        fontSize: '0.9rem',
                        fontWeight: 700,
                        zIndex: 10000,
                        pointerEvents: 'none',
                        border: '1px solid rgba(255,255,255,0.1)'
                    }}
                >
                    {currentIndex + 1} / {normalizedImages.length}
                </div>
            )}

            {/* Navigation Buttons */}
            {normalizedImages.length > 1 && (
                <>
                    {currentIndex > 0 && (
                        <button 
                            className="btn btn-ghost" 
                            style={{ 
                                position: 'absolute',
                                left: 'calc(env(safe-area-inset-left, 24px) + 8px)',
                                zIndex: 10000,
                                background: 'rgba(255,255,255,0.1)', 
                                color: 'white', 
                                borderRadius: '50%',
                                width: 56,
                                height: 56,
                                padding: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backdropFilter: 'blur(10px)'
                            }}
                            onClick={handlePrev}
                        >
                            <ChevronLeft size={32} />
                        </button>
                    )}
                    {currentIndex < normalizedImages.length - 1 && (
                        <button 
                            className="btn btn-ghost" 
                            style={{ 
                                position: 'absolute',
                                right: 'calc(env(safe-area-inset-right, 24px) + 8px)',
                                zIndex: 10000,
                                background: 'rgba(255,255,255,0.1)', 
                                color: 'white', 
                                borderRadius: '50%',
                                width: 56,
                                height: 56,
                                padding: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backdropFilter: 'blur(10px)'
                            }}
                            onClick={handleNext}
                        >
                            <ChevronRight size={32} />
                        </button>
                    )}
                </>
            )}

            {/* Main Image Container */}
            <div 
                style={{
                    position: 'relative',
                    maxWidth: '100%',
                    maxHeight: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease',
                    transform: isLoaded ? 'scale(1)' : `scale(0.92) translateX(${direction * 40}px)`,
                    opacity: isLoaded ? 1 : 0
                }}
                onClick={e => e.stopPropagation()}
            >
                {!isLoaded && (
                    <div className="spinner" style={{ position: 'absolute', color: 'white' }} />
                )}
                <img 
                    key={currentImage.src}
                    src={currentImage.src} 
                    alt={currentImage.alt || 'Zoomed image'} 
                    onLoad={() => setIsLoaded(true)}
                    style={{
                        maxWidth: '92vw',
                        maxHeight: '80vh',
                        borderRadius: '16px',
                        boxShadow: '0 32px 64px rgba(0,0,0,0.6)',
                        objectFit: 'contain',
                        border: '1px solid rgba(255,255,255,0.1)'
                    }}
                />
            </div>

            {/* Caption */}
            {currentImage.alt && (
                <div 
                    style={{
                        position: 'absolute',
                        bottom: 'calc(env(safe-area-inset-bottom, 48px) + 16px)',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        color: 'white',
                        background: 'rgba(0,0,0,0.6)',
                        backdropFilter: 'blur(12px)',
                        padding: '12px 28px',
                        borderRadius: '24px',
                        fontSize: '1rem',
                        fontWeight: 600,
                        pointerEvents: 'none',
                        textAlign: 'center',
                        boxShadow: '0 8px 16px rgba(0,0,0,0.3)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        zIndex: 10000
                    }}
                >
                    {currentImage.alt}
                </div>
            )}
        </div>
    )
}
