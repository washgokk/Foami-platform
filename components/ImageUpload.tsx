'use client'
import { useState, useRef } from 'react'
import { Upload, X, ImageIcon } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import imageCompression from 'browser-image-compression'

interface ImageUploadProps {
    value?: string
    onChange: (url: string) => void
    bucket?: string
    folder?: string
    label?: string
    placeholderIcon?: React.ReactNode
    className?: string
    skipCompression?: boolean
}

export default function ImageUpload({ 
    value, 
    onChange, 
    bucket = 'images', 
    folder = 'uploads',
    label = 'อัพโหลดรูปภาพ',
    placeholderIcon = <ImageIcon size={24} />,
    className = '',
    skipCompression = false
}: ImageUploadProps) {
    const [uploading, setUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setUploading(true)
        try {
            let uploadData: File | Blob = file

            if (!skipCompression) {
                // Compress Image
                const options = {
                    maxSizeMB: 1,
                    maxWidthOrHeight: 1280,
                    useWebWorker: true
                }
                uploadData = await imageCompression(file, options)
            }

            const ext = file.name.split('.').pop()
            const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
            const path = `${folder}/${fileName}`

            const { data, error } = await supabase.storage
                .from(bucket)
                .upload(path, uploadData)

            if (error) throw error

            const { data: { publicUrl } } = supabase.storage
                .from(bucket)
                .getPublicUrl(path)

            onChange(publicUrl)
        } catch (err: any) {
            console.error('Upload error:', err)
            alert('ล้มเหลวในการอัปโหลด: ' + err.message)
        } finally {
            setUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    return (
        <div className={`image-upload-container ${className}`} style={{ width: '100%' }}>
            {label && <label className="form-label" style={{ marginBottom: 8, display: 'block' }}>{label}</label>}
            
            {value ? (
                <div style={{ position: 'relative', width: '100%', height: 160, borderRadius: 12, overflow: 'hidden', border: '2.5px solid var(--border)' }}>
                    <img src={value} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button 
                        type="button"
                        onClick={() => onChange('')}
                        style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(255,255,255,0.9)', border: 'none', borderRadius: '50%', padding: 4, cursor: 'pointer', display: 'flex' }}
                    >
                        <X size={16} color="var(--danger)" />
                    </button>
                </div>
            ) : (
                <div 
                    onClick={() => fileInputRef.current?.click()}
                    style={{ 
                        width: '100%', height: 160, borderRadius: 12, border: '2.5px dashed var(--border)', 
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', background: 'var(--surface-2)', transition: 'all 0.2s'
                    }}
                >
                    {uploading ? <div className="spinner" /> : (
                        <>
                            <div style={{ color: 'var(--text-muted)', marginBottom: 8 }}>{placeholderIcon}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>คลิกเพื่ออัปโหลดรูปภาพ</div>
                        </>
                    )}
                </div>
            )}
            <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleUpload} 
                style={{ display: 'none' }} 
                accept="image/*" 
            />
        </div>
    )
}
