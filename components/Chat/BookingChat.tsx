'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Send, X, MessageCircle, Loader2, Camera, User } from 'lucide-react'
import ImageZoom from '@/components/Global/ImageZoom'

interface Message {
    id: string
    booking_id: string
    sender_type: 'customer' | 'staff' | 'admin'
    sender_id: string
    sender_name: string | null
    message: string | null
    image_url: string | null
    is_read: boolean
    created_at: string
}

interface BookingChatProps {
    bookingId: string
    senderId: string
    senderType: 'customer' | 'staff' | 'admin'
    senderName: string
    onClose?: () => void
    isOpen?: boolean
}

export default function BookingChat({
    bookingId,
    senderId,
    senderType,
    senderName,
    onClose,
    isOpen = true
}: BookingChatProps) {
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(true)
    const [sending, setSending] = useState(false)
    const [uploadingImage, setUploadingImage] = useState(false)
    const [sendError, setSendError] = useState<string | null>(null)
    const [zoomConfig, setZoomConfig] = useState<{ src: string } | null>(null)
    const bottomRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const STORAGE_KEY = `chat_last_read_${bookingId}_${senderId}`

    const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
        bottomRef.current?.scrollIntoView({ behavior })
    }, [])

    // ─── Load initial messages ────────────────────────────────
    const loadMessages = useCallback(async () => {
        const res = await fetch(`/api/chat?bookingId=${bookingId}`)
        if (res.ok) {
            const data = await res.json()
            setMessages(data.messages || [])
            // Mark as read
            localStorage.setItem(STORAGE_KEY, new Date().toISOString())
        }
        setLoading(false)
        setTimeout(() => scrollToBottom('auto'), 100)
    }, [bookingId, STORAGE_KEY, scrollToBottom])

    useEffect(() => {
        if (!isOpen) return
        loadMessages()
    }, [isOpen, loadMessages])

    useEffect(() => {
        if (!isOpen) return
        scrollToBottom()
    }, [messages, isOpen, scrollToBottom])

    // ─── Supabase Realtime subscription + polling fallback ───
    useEffect(() => {
        if (!isOpen) return

        const channel = supabase
            .channel(`booking_chat_${bookingId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'booking_messages',
                    filter: `booking_id=eq.${bookingId}`
                },
                (payload) => {
                    const newMsg = payload.new as Message
                    setMessages(prev => {
                        // Deduplicate by id
                        if (prev.find(m => m.id === newMsg.id)) return prev
                        return [...prev, newMsg]
                    })
                    // Mark as read since chat is open
                    localStorage.setItem(STORAGE_KEY, new Date().toISOString())
                }
            )
            .subscribe()

        // Polling fallback — in case realtime publication is not enabled for booking_messages
        const pollInterval = setInterval(async () => {
            const res = await fetch(`/api/chat?bookingId=${bookingId}`)
            if (res.ok) {
                const data = await res.json()
                const fresh = data.messages || []
                setMessages(prev => {
                    if (fresh.length !== prev.length) return fresh
                    return prev
                })
            }
        }, 10000)

        return () => {
            supabase.removeChannel(channel)
            clearInterval(pollInterval)
        }
    }, [bookingId, isOpen, STORAGE_KEY])

    // ─── Send message ─────────────────────────────────────────
    const sendMessage = async (imageUrl?: string) => {
        const text = input.trim()
        if (!text && !imageUrl) return
        if (sending) return
        if (!senderId) {
            setSendError('ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่')
            return
        }

        setSending(true)
        setSendError(null)
        if (!imageUrl) setInput('')

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    booking_id: bookingId,
                    sender_type: senderType,
                    sender_id: senderId,
                    sender_name: senderName,
                    message: text || null,
                    image_url: imageUrl || null
                })
            })
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}))
                throw new Error(errData.error || `ส่งข้อความไม่สำเร็จ (${res.status})`)
            }
        } catch (e: any) {
            console.error('[Chat] Send error:', e)
            if (!imageUrl) setInput(text) // restore on failure
            setSendError(e.message || 'ส่งข้อความไม่สำเร็จ กรุณาลองใหม่')
            // Auto-clear error after 5s
            setTimeout(() => setSendError(null), 5000)
        } finally {
            setSending(false)
            if (!imageUrl) inputRef.current?.focus()
        }
    }

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setUploadingImage(true)
        try {
            const ext = file.name.split('.').pop()
            const path = `chat/${bookingId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
            
            const { data, error } = await supabase.storage
                .from('job-photos') 
                .upload(path, file)

            if (error) throw error

            const { data: { publicUrl } } = supabase.storage.from('job-photos').getPublicUrl(path)
            await sendMessage(publicUrl)
        } catch (err: any) {
            console.error('[Chat] Upload error:', err)
            alert('ไม่สามารถส่งรูปภาพได้: ' + err.message)
        } finally {
            setUploadingImage(false)
            if (e.target) e.target.value = '' 
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            sendMessage()
        }
    }

    const formatTime = (iso: string) => {
        const d = new Date(iso)
        return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' })
    }

    const formatDate = (iso: string) => {
        const d = new Date(iso)
        return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', timeZone: 'Asia/Bangkok' })
    }

    // Group messages by date
    const groupedMessages = messages.reduce<{ date: string; msgs: Message[] }[]>((acc, msg) => {
        const dateLabel = formatDate(msg.created_at)
        const group = acc.find(g => g.date === dateLabel)
        if (group) group.msgs.push(msg)
        else acc.push({ date: dateLabel, msgs: [msg] })
        return acc
    }, [])

    if (!isOpen) return null

    return (
        <div style={{
            display: 'flex', flexDirection: 'column',
            height: '100%', minHeight: 320,
            background: 'var(--surface)',
            overflow: 'hidden', position: 'relative'
        }}>
            {/* Premium Header with integrated handle */}
            <div style={{
                padding: '12px 24px 24px',
                background: 'linear-gradient(135deg, #1E40AF 0%, #315EC3 100%)',
                color: 'white',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                zIndex: 10,
                borderRadius: isOpen ? '0' : '28px 28px 0 0'
            }}>
                <div style={{ width: 44, height: 5, background: 'rgba(255,255,255,0.25)', borderRadius: 10, margin: '0 auto 4px' }} />
                
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ 
                            width: 44, height: 44, borderRadius: '14px', 
                            background: 'rgba(255,255,255,0.15)', 
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            backdropFilter: 'blur(10px)',
                            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.2)'
                        }}>
                            <MessageCircle size={22} fill="white" fillOpacity={0.2} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '1.1rem', fontWeight: 900, marginBottom: 2, letterSpacing: '-0.01em' }}>แชทกับ{senderType === 'staff' ? 'ลูกค้า' : 'พนักงาน'}</h2>
                            <div style={{ fontSize: '0.72rem', opacity: 0.8, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ADE80', boxShadow: '0 0 8px #4ADE80' }} />
                                Real-time Support
                            </div>
                        </div>
                    </div>
                    {onClose && (
                        <button 
                            onClick={onClose} 
                            style={{ 
                                background: 'rgba(255,255,255,0.15)', 
                                border: 'none', color: 'white', 
                                padding: 10, borderRadius: '12px', cursor: 'pointer',
                                transition: 'all 0.2s',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}
                        >
                            <X size={20} />
                        </button>
                    )}
                </div>
            </div>

            {/* Messages area */}
            <div style={{
                flex: 1, overflowY: 'auto', padding: '16px 14px',
                display: 'flex', flexDirection: 'column', gap: 2,
                background: '#F1F4F9'
            }}>
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                        <Loader2 size={32} color="var(--brand-dominant)" style={{ animation: 'spin 1s linear infinite' }} />
                    </div>
                ) : messages.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', paddingBottom: 40 }}>
                        <div style={{ position: 'relative', marginBottom: 20 }}>
                            <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 20px rgba(0,0,0,0.05)' }}>
                                <MessageCircle size={40} color="var(--brand-dominant)" strokeWidth={1.5} style={{ opacity: 0.6 }} />
                            </div>
                        </div>
                        <p style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)', marginBottom: 4 }}>ยังไม่มีข้อความ</p>
                        <p style={{ fontSize: '0.85rem', fontWeight: 500 }}>เริ่มสนทนากับเราได้ที่ด้านล่างนี้ได้เลยครับ</p>
                    </div>
                ) : (
                    groupedMessages.map(({ date, msgs }) => (
                        <div key={date}>
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: 10, margin: '24px 0 16px'
                            }}>
                                <div style={{ flex: 1, height: 1, background: 'var(--border)', opacity: 0.5 }} />
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    {date}
                                </span>
                                <div style={{ flex: 1, height: 1, background: 'var(--border)', opacity: 0.5 }} />
                            </div>
                            {msgs.map((msg) => {
                                const isMine = msg.sender_id === senderId
                                return (
                                    <div key={msg.id} style={{
                                        display: 'flex',
                                        flexDirection: isMine ? 'row-reverse' : 'row',
                                        alignItems: 'flex-start', gap: 10, marginBottom: 12
                                    }}>
                                        {/* Avatar */}
                                        {!isMine && (
                                            <div style={{
                                                width: 34, height: 34, borderRadius: 12,
                                                background: msg.sender_type === 'staff' ? 'linear-gradient(135deg, var(--brand-dominant) 0%, #1E3A8A 100%)' : '#E5E7EB',
                                                color: msg.sender_type === 'staff' ? 'white' : 'var(--text-primary)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '0.8rem', fontWeight: 900, flexShrink: 0,
                                                boxShadow: '0 4px 10px rgba(0,0,0,0.05)'
                                            }}>
                                                {msg.sender_type === 'staff' ? (msg.sender_name || 'S')[0] : <User size={18} />}
                                            </div>
                                        )}
                                        <div style={{ maxWidth: '75%', display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start' }}>
                                            {!isMine && (
                                                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 700, marginLeft: 4 }}>
                                                    {msg.sender_name || 'พนักงาน'}
                                                </span>
                                            )}
                                            
                                            <div style={{
                                                padding: msg.image_url ? 4 : '10px 14px',
                                                borderRadius: isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                                                background: isMine ? 'linear-gradient(135deg, #315EC3 0%, #2563EB 100%)' : 'white',
                                                color: isMine ? 'white' : 'var(--text-primary)',
                                                fontSize: '0.92rem', lineHeight: 1.5,
                                                boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                                                wordBreak: 'break-word', whiteSpace: 'pre-wrap',
                                                overflow: 'hidden'
                                            }}>
                                                {msg.image_url && (
                                                    <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden' }}>
                                                        <img 
                                                            src={msg.image_url} 
                                                            alt="Chat attached" 
                                                            style={{ 
                                                                width: '100%', 
                                                                maxHeight: 300, 
                                                                objectFit: 'cover', 
                                                                display: 'block', 
                                                                cursor: 'zoom-in',
                                                            }} 
                                                            onClick={() => setZoomConfig({ src: msg.image_url! })}
                                                        />
                                                    </div>
                                                )}
                                                {msg.message && (
                                                    <div style={{ padding: msg.image_url ? '8px 10px' : 0 }}>
                                                        {msg.message}
                                                    </div>
                                                )}
                                            </div>
                                            
                                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 4, fontWeight: 500 }}>
                                                {formatTime(msg.created_at)}
                                            </span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    ))
                )}
                <div ref={bottomRef} />
            </div>

            {/* Error Banner */}
            {sendError && (
                <div style={{
                    padding: '8px 16px',
                    background: '#FEF2F2',
                    borderTop: '1px solid #FECACA',
                    color: '#B91C1C',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    flexShrink: 0
                }}>
                    <span style={{ fontSize: '1rem' }}>⚠️</span>
                    {sendError}
                </div>
            )}

            {/* Input area */}
            <div style={{
                padding: '12px 16px',
                borderTop: '1px solid var(--border)',
                display: 'flex', alignItems: 'flex-end', gap: 10,
                background: 'white', flexShrink: 0
            }}>
                <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImage || sending}
                    style={{
                        width: 42, height: 42, borderRadius: 12,
                        background: 'var(--surface-2)', border: '1px solid var(--border)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', color: 'var(--text-secondary)'
                    }}
                >
                    {uploadingImage ? <Loader2 size={20} className="animate-spin" /> : <Camera size={20} />}
                </button>
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    style={{ display: 'none' }} 
                    accept="image/*" 
                    onChange={handleFileUpload} 
                />

                <textarea
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="เขียนข้อความ..."
                    rows={1}
                    style={{
                        flex: 1, resize: 'none', border: '1.5px solid var(--border)',
                        borderRadius: 14, padding: '10px 14px', fontSize: '0.95rem',
                        outline: 'none', fontFamily: 'inherit',
                        background: '#F9FAFB', lineHeight: 1.4,
                        maxHeight: 120, overflowY: 'auto'
                    }}
                    onInput={e => {
                        const el = e.currentTarget
                        el.style.height = 'auto'
                        el.style.height = Math.min(el.scrollHeight, 120) + 'px'
                    }}
                />
                
                <button
                    onClick={() => sendMessage()}
                    disabled={!input.trim() || sending || uploadingImage}
                    style={{
                        width: 44, height: 44, borderRadius: 14,
                        background: input.trim() ? 'var(--brand-dominant)' : 'var(--border)',
                        border: 'none', color: 'white',
                        cursor: input.trim() ? 'pointer' : 'default',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0
                    }}
                >
                    {sending
                        ? <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
                        : <Send size={20} />
                    }
                </button>
            </div>

            {zoomConfig && (
                <ImageZoom 
                    images={[{ src: zoomConfig.src }]} 
                    initialIndex={0} 
                    onClose={() => setZoomConfig(null)} 
                />
            )}
            
            <style jsx>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .animate-spin { animation: spin 1s linear infinite; }
            `}</style>
        </div>
    )
}

// ─── Static helper: count unread messages ────────────────────
export async function getChatUnreadCount(bookingId: string, senderId: string): Promise<number> {
    const storageKey = `chat_last_read_${bookingId}_${senderId}`
    const lastRead = localStorage.getItem(storageKey)
    if (!lastRead) return 0 

    const { createClient } = await import('@supabase/supabase-js')
    const client = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { count } = await client
        .from('booking_messages')
        .select('id', { count: 'exact', head: true })
        .eq('booking_id', bookingId)
        .neq('sender_id', senderId)
        .gt('created_at', lastRead)

    return count || 0
}
