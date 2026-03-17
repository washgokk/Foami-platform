
'use client'
import React from 'react'
import { CheckCircle2, X, Sparkles } from 'lucide-react'
import styles from './SuccessModal.module.css'

interface SuccessModalProps {
    isOpen: boolean
    onClose: () => void
    title: string
    message: string
    buttonText?: string
}

export default function SuccessModal({ isOpen, onClose, title, message, buttonText = 'ตกลง' }: SuccessModalProps) {
    if (!isOpen) return null

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <button className={styles.closeBtn} onClick={onClose}>
                    <X size={20} />
                </button>
                
                <div className={styles.iconWrapper}>
                    <div className={styles.iconBg}>
                        <CheckCircle2 size={48} className={styles.icon} />
                    </div>
                    <div className={styles.sparkle1}><Sparkles size={16} /></div>
                    <div className={styles.sparkle2}><Sparkles size={16} /></div>
                </div>

                <div className={styles.content}>
                    <h2 className={styles.title}>{title}</h2>
                    <p className={styles.message}>{message}</p>
                </div>

                <button className={styles.actionBtn} onClick={onClose}>
                    {buttonText}
                </button>
            </div>
        </div>
    )
}
