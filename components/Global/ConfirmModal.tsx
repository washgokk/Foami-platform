'use client'
import React from 'react'
import { X, AlertCircle, Info, Trash2 } from 'lucide-react'

interface ConfirmModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: () => void
    title: string
    message: string
    confirmText?: string
    cancelText?: string
    variant?: 'danger' | 'primary' | 'warning'
    isLoading?: boolean
}

export default function ConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'ยืนยัน',
    cancelText = 'ยกเลิก',
    variant = 'danger',
    isLoading = false
}: ConfirmModalProps) {
    if (!isOpen) return null

    const getIcon = () => {
        switch (variant) {
            case 'danger': return <Trash2 size={24} />
            case 'warning': return <AlertCircle size={24} />
            default: return <Info size={24} />
        }
    }

    const getBrandColor = () => {
        switch (variant) {
            case 'danger': return '#e11d48' // Rose 600
            case 'warning': return '#f59e0b'
            default: return 'var(--brand-dominant)'
        }
    }

    const getBgColor = () => {
        switch (variant) {
            case 'danger': return '#fff1f2' // Rose 50
            case 'warning': return '#fffbeb'
            default: return 'var(--brand-dominant-ghost)'
        }
    }

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20
        }}>
            {/* Backdrop */}
            <div 
                onClick={isLoading ? undefined : onClose}
                style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(15, 23, 42, 0.4)',
                    backdropFilter: 'blur(12px)',
                    animation: 'fadeIn 0.2s ease-out'
                }}
            />

            {/* Modal Content */}
            <div style={{
                position: 'relative',
                width: '100%',
                maxWidth: 420,
                background: 'white',
                borderRadius: 28,
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                padding: '32px',
                textAlign: 'center',
                animation: 'modalPop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
            }}>
                <div style={{
                    width: 64,
                    height: 64,
                    borderRadius: 20,
                    background: getBgColor(),
                    color: getBrandColor(),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 24px'
                }}>
                    {getIcon()}
                </div>

                <h3 style={{
                    fontSize: '1.4rem',
                    fontWeight: 900,
                    color: '#0f172a',
                    marginBottom: 12,
                    letterSpacing: '-0.02em'
                }}>
                    {title}
                </h3>

                <p style={{
                    fontSize: '1rem',
                    color: '#64748b',
                    lineHeight: 1.6,
                    marginBottom: 32
                }}>
                    {message}
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        style={{
                            padding: '14px',
                            borderRadius: 16,
                            border: '1.5px solid #e2e8f0',
                            background: 'white',
                            color: '#64748b',
                            fontSize: '0.95rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#cbd5e1' }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = '#e2e8f0' }}
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isLoading}
                        style={{
                            padding: '14px',
                            borderRadius: 16,
                            border: 'none',
                            background: getBrandColor(),
                            color: 'white',
                            fontSize: '0.95rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            boxShadow: `0 8px 20px ${getBrandColor()}40`,
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 12px 24px ${getBrandColor()}60` }}
                        onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `0 8px 20px ${getBrandColor()}40` }}
                    >
                        {isLoading ? <div className="spinner-white" /> : confirmText}
                    </button>
                </div>
            </div>

            <style jsx>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes modalPop {
                    from { opacity: 0; transform: scale(0.9) translateY(20px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }
                .spinner-white {
                    width: 20px;
                    height: 20px;
                    border: 2.5px solid rgba(255,255,255,0.3);
                    border-top-color: white;
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    )
}
