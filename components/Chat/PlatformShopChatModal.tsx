'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
  MessageCircle, Send, X, Store, Shield, Check, CheckCheck,
  Paperclip, Image as ImageIcon, RefreshCw, Bell, Sparkles
} from 'lucide-react'

interface Message {
  id: string
  booking_id: string
  sender_type: string
  sender_id: string
  sender_name: string
  message: string
  image_url?: string | null
  is_read: boolean
  created_at: string
}

interface Props {
  branchId: string
  branchName: string
  branchSlug?: string
  currentUserRole: 'platform_admin' | 'shop_admin'
  currentUserName?: string
  onClose: () => void
}

// Gentle notification beep using Web Audio API
function playNotifySound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(587.33, ctx.currentTime) // D5
    osc.frequency.setValueAtTime(880.00, ctx.currentTime + 0.1) // A5
    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.35)
  } catch (e) {
    // Ignore audio context errors if blocked by browser autoplay
  }
}

export default function PlatformShopChatModal({
  branchId,
  branchName,
  branchSlug,
  currentUserRole,
  currentUserName,
  onClose
}: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const channelId = `HQ_SHOP_${branchId}`

  const isPlatform = currentUserRole === 'platform_admin'

  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' })
  }, [])

  // 1. Fetch Messages
  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/platform/chat?branchId=${branchId}&markReadBy=${currentUserRole}`)
      const data = await res.json()
      if (data.messages) {
        setMessages(data.messages)
        setTimeout(() => scrollToBottom(false), 50)
      }
    } catch (err) {
      console.error('[Chat] Fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [branchId, currentUserRole, scrollToBottom])

  useEffect(() => {
    fetchMessages()
  }, [fetchMessages])

  // 2. Realtime Subscription
  useEffect(() => {
    const channel = supabase
      .channel(`hq_shop_chat_${branchId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'booking_messages',
          filter: `booking_id=eq.${channelId}`
        },
        payload => {
          const newMsg = payload.new as Message
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev
            return [...prev, newMsg]
          })

          // Play sound if incoming from other party
          const isMyMessage = isPlatform
            ? newMsg.sender_id === 'platform_hq'
            : newMsg.sender_id !== 'platform_hq'

          if (!isMyMessage) {
            playNotifySound()
            // Mark read immediately since modal is open
            fetch(`/api/platform/chat?branchId=${branchId}&markReadBy=${currentUserRole}`)
          }

          setTimeout(() => scrollToBottom(true), 60)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [branchId, channelId, currentUserRole, isPlatform, scrollToBottom])

  // 3. Send Message
  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const text = inputText.trim()
    if (!text || sending) return

    setInputText('')
    setSending(true)

    try {
      const defaultName = isPlatform ? 'Platform HQ (Super Admin)' : `${branchName} (ผู้ดูแลสาขา)`
      const res = await fetch('/api/platform/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId,
          senderRole: currentUserRole,
          senderName: currentUserName || defaultName,
          message: text
        })
      })

      const data = await res.json()
      if (data.success && data.message) {
        setMessages(prev => {
          if (prev.some(m => m.id === data.message.id)) return prev
          return [...prev, data.message]
        })
        setTimeout(() => scrollToBottom(true), 50)
      }
    } catch (err) {
      console.error('[Chat] Send error:', err)
    } finally {
      setSending(false)
    }
  }

  // Format time (HH:mm)
  const formatTime = (ts: string) => {
    try {
      const d = new Date(ts)
      return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.'
    } catch {
      return ''
    }
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(4px)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16
    }}>
      <div style={{
        background: '#FFFFFF',
        borderRadius: 24,
        width: 540,
        maxWidth: '100%',
        height: '82vh',
        maxHeight: 720,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 24px 50px rgba(0,0,0,0.25)',
        border: '1.5px solid #DDE3F5'
      }}>
        {/* Chat Header */}
        <div style={{
          padding: '16px 20px',
          background: isPlatform
            ? 'linear-gradient(135deg, #1E3A8A, #315EC3)'
            : 'linear-gradient(135deg, #0F172A, #1E293B)',
          color: '#FFFFFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              background: 'rgba(255,255,255,0.18)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(255,255,255,0.3)',
              color: '#FFFFFF'
            }}>
              {isPlatform ? <Store size={22} /> : <Shield size={22} />}
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 6 }}>
                {isPlatform ? branchName : 'Platform HQ (Super Admin)'}
                <span style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  background: 'rgba(34, 197, 94, 0.25)',
                  color: '#86EFAC',
                  padding: '2px 7px',
                  borderRadius: 999,
                  border: '1px solid rgba(134, 239, 172, 0.4)'
                }}>
                  ● ออนไลน์
                </span>
              </div>
              <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>
                {isPlatform ? `คุยกับผู้ดูแลสาขา /${branchSlug || ''}` : `คุยตรงกับทีมดูแลระบบ Platform`}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.15)',
              border: 'none',
              borderRadius: 10,
              padding: 7,
              cursor: 'pointer',
              color: '#FFFFFF',
              transition: 'all 0.15s'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Message Feed */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px',
          background: '#F8FAFC',
          display: 'flex',
          flexDirection: 'column',
          gap: 14
        }}>
          {loading ? (
            <div style={{ margin: 'auto', textAlign: 'center', color: '#94A3B8' }}>
              <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 8px', color: '#315EC3' }} />
              <div style={{ fontSize: 13 }}>กำลังโหลดบทสนทนา...</div>
            </div>
          ) : messages.length === 0 ? (
            <div style={{
              margin: 'auto',
              textAlign: 'center',
              padding: '30px 20px',
              background: '#FFFFFF',
              borderRadius: 18,
              border: '1.5px dashed #DDE3F5',
              maxWidth: 360
            }}>
              <MessageCircle size={36} color="#9AA5C4" style={{ margin: '0 auto 10px' }} />
              <div style={{ fontSize: 15, fontWeight: 800, color: '#1E293B', marginBottom: 4 }}>
                เริ่มต้นการสนทนา
              </div>
              <div style={{ fontSize: 12.5, color: '#64748B' }}>
                ส่งข้อความแจ้งเตือน ประสานงาน หรือสอบถามข้อมูลระหว่าง Platform HQ และร้านสาขาได้ที่นี่
              </div>
            </div>
          ) : (
            messages.map(msg => {
              const isMine = isPlatform
                ? msg.sender_id === 'platform_hq'
                : msg.sender_id !== 'platform_hq'

              return (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isMine ? 'flex-end' : 'flex-start',
                    maxWidth: '82%',
                    alignSelf: isMine ? 'flex-end' : 'flex-start'
                  }}
                >
                  <span style={{ fontSize: 11, color: '#94A3B8', marginBottom: 3, padding: '0 4px', fontWeight: 600 }}>
                    {msg.sender_name}
                  </span>

                  <div style={{
                    padding: '12px 16px',
                    borderRadius: isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                    background: isMine
                      ? 'linear-gradient(135deg, #1E3A8A, #315EC3)'
                      : '#FFFFFF',
                    color: isMine ? '#FFFFFF' : '#1E293B',
                    border: isMine ? 'none' : '1.5px solid #E2E8F0',
                    fontSize: 14,
                    lineHeight: 1.5,
                    boxShadow: isMine
                      ? '0 4px 14px rgba(49, 94, 195, 0.22)'
                      : '0 2px 8px rgba(0,0,0,0.04)',
                    wordBreak: 'break-word',
                    whiteSpace: 'pre-wrap'
                  }}>
                    {msg.message}
                  </div>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    marginTop: 3,
                    padding: '0 4px',
                    fontSize: 10.5,
                    color: '#94A3B8'
                  }}>
                    <span>{formatTime(msg.created_at)}</span>
                    {isMine && (
                      msg.is_read ? (
                        <span style={{ color: '#2563EB', display: 'flex', alignItems: 'center' }} title="อ่านแล้ว">
                          <CheckCheck size={13} />
                        </span>
                      ) : (
                        <span style={{ color: '#94A3B8', display: 'flex', alignItems: 'center' }} title="ส่งแล้ว">
                          <Check size={13} />
                        </span>
                      )
                    )}
                  </div>
                </div>
              )
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input Bar */}
        <form
          onSubmit={handleSend}
          style={{
            padding: '14px 18px',
            background: '#FFFFFF',
            borderTop: '1.5px solid #E8EEF8',
            display: 'flex',
            alignItems: 'center',
            gap: 10
          }}
        >
          <input
            type="text"
            placeholder={isPlatform ? `พิมพ์ข้อความถึงสาขา ${branchName}...` : 'พิมพ์ข้อความถึง Platform HQ...'}
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            disabled={sending}
            style={{
              flex: 1,
              padding: '12px 16px',
              borderRadius: 14,
              border: '1.5px solid #DDE3F5',
              fontSize: 13.5,
              fontFamily: 'inherit',
              outline: 'none',
              background: '#F8FAFC',
              color: '#1E293B'
            }}
          />

          <button
            type="submit"
            disabled={!inputText.trim() || sending}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '12px 20px',
              borderRadius: 14,
              border: 'none',
              background: inputText.trim() && !sending
                ? 'linear-gradient(135deg, #1E3A8A, #315EC3)'
                : '#E2E8F0',
              color: '#FFFFFF',
              fontSize: 13.5,
              fontWeight: 800,
              cursor: inputText.trim() && !sending ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit',
              boxShadow: inputText.trim() && !sending ? '0 4px 12px rgba(49, 94, 195, 0.25)' : 'none',
              transition: 'all 0.15s'
            }}
          >
            {sending ? <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={16} />}
            <span>ส่ง</span>
          </button>
        </form>
      </div>

      <style jsx global>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
