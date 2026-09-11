'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { MessageCircle, User, Clock, CheckCircle2, ChevronRight, Shield, RefreshCw } from 'lucide-react'
import BookingChat from '@/components/Chat/BookingChat'
import PlatformShopChatModal from '@/components/Chat/PlatformShopChatModal'

export default function ShopChatPage() {
    const { branchSlug } = useParams() as { branchSlug: string }
    const searchParams = useSearchParams()
    const defaultTab = searchParams.get('tab') === 'hq' ? 'hq' : 'bookings'
    
    const [activeTab, setActiveTab] = useState<'bookings' | 'hq'>(defaultTab)
    const [branchInfo, setBranchInfo] = useState<{ id: string; name: string } | null>(null)
    const [bookings, setBookings] = useState<any[]>([])
    const [selectedBooking, setSelectedBooking] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [hqUnread, setHqUnread] = useState(0)

    useEffect(() => {
        async function load() {
            setLoading(true)
            const { data: b } = await supabase.from('branches').select('id, name').eq('slug', branchSlug).single()
            if (b) {
                setBranchInfo(b)
                // Load unread count from HQ
                fetch(`/api/platform/chat?type=shop_unread&branchId=${b.id}`)
                    .then(r => r.json())
                    .then(d => {
                        if (d.unreadCount) setHqUnread(d.unreadCount)
                    })
                    .catch(() => {})

                // Load booking chats
                const { data } = await supabase
                    .from('bookings')
                    .select('id, created_at, status, customers(full_name, phone, license_plate), staff(full_name)')
                    .eq('branch_id', b.id)
                    .order('created_at', { ascending: false })
                    .limit(30)
                setBookings(data || [])
                if (data && data.length > 0) {
                    setSelectedBooking(data[0])
                }
            }
            setLoading(false)
        }
        load()
    }, [branchSlug])

    return (
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            {/* Page Header with Tabs */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <MessageCircle size={26} color="var(--brand, #315EC3)" /> ศูนย์ข้อความ & แชท ({branchSlug})
                    </h1>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                        สนทนากับลูกค้าตามออเดอร์ หรือติดต่อปรึกษาตรงกับทีม Platform HQ
                    </div>
                </div>

                {/* Tab Switcher */}
                <div style={{ display: 'flex', gap: 6, background: '#F1F5F9', padding: 4, borderRadius: 14 }}>
                    <button
                        onClick={() => setActiveTab('bookings')}
                        style={{
                            padding: '8px 16px',
                            borderRadius: 10,
                            border: 'none',
                            background: activeTab === 'bookings' ? '#FFFFFF' : 'transparent',
                            color: activeTab === 'bookings' ? '#1E293B' : '#64748B',
                            fontWeight: activeTab === 'bookings' ? 800 : 600,
                            fontSize: 13,
                            cursor: 'pointer',
                            boxShadow: activeTab === 'bookings' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none'
                        }}
                    >
                        แชทกับลูกค้า ({bookings.length})
                    </button>

                    <button
                        onClick={() => {
                            setActiveTab('hq')
                            setHqUnread(0)
                        }}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '8px 16px',
                            borderRadius: 10,
                            border: 'none',
                            background: activeTab === 'hq' ? '#315EC3' : 'transparent',
                            color: activeTab === 'hq' ? '#FFFFFF' : '#64748B',
                            fontWeight: activeTab === 'hq' ? 800 : 600,
                            fontSize: 13,
                            cursor: 'pointer',
                            boxShadow: activeTab === 'hq' ? '0 4px 12px rgba(49, 94, 195, 0.25)' : 'none'
                        }}
                    >
                        <Shield size={14} />
                        <span>แชทกับ Platform HQ</span>
                        {hqUnread > 0 && (
                            <span style={{
                                background: '#EF4444',
                                color: '#FFFFFF',
                                borderRadius: 999,
                                padding: '1px 6px',
                                fontSize: 10.5,
                                fontWeight: 900
                            }}>
                                {hqUnread}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* TAB 1: Platform HQ Direct Chat View */}
            {activeTab === 'hq' && branchInfo && (
                <div style={{ height: '75vh', maxHeight: 720 }}>
                    <PlatformShopChatModal
                        branchId={branchInfo.id}
                        branchName={branchInfo.name}
                        branchSlug={branchSlug}
                        currentUserRole="shop_admin"
                        currentUserName={`${branchInfo.name} (ผู้ดูแลสาขา)`}
                        onClose={() => setActiveTab('bookings')}
                    />
                </div>
            )}

            {/* TAB 2: Bookings Customer Chat */}
            {activeTab === 'bookings' && (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '320px 1fr',
                    gap: 20,
                    background: '#FFFFFF',
                    borderRadius: 20,
                    border: '1px solid var(--border)',
                    height: '75vh',
                    overflow: 'hidden'
                }}>
                    {/* Bookings List */}
                    <div style={{ borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 13, color: 'var(--text-muted)' }}>
                            รายการจองล่าสุด ({bookings.length})
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto' }}>
                            {loading ? (
                                <div style={{ padding: 20, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>กำลังโหลด...</div>
                            ) : bookings.length === 0 ? (
                                <div style={{ padding: 20, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>ไม่มีการจองล่าสุด</div>
                            ) : (
                                bookings.map(bk => {
                                    const isSel = selectedBooking?.id === bk.id
                                    return (
                                        <div
                                            key={bk.id}
                                            onClick={() => setSelectedBooking(bk)}
                                            style={{
                                                padding: '12px 16px',
                                                borderBottom: '1px solid #F1F5F9',
                                                cursor: 'pointer',
                                                background: isSel ? '#EFF6FF' : 'transparent',
                                                borderLeft: isSel ? '4px solid var(--brand, #315EC3)' : '4px solid transparent'
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ fontSize: 13.5, fontWeight: 700, color: '#1E293B' }}>
                                                    {bk.customers?.full_name || 'ลูกค้าทั่วไป'}
                                                </span>
                                                <span style={{ fontSize: 10.5, color: '#94A3B8' }}>
                                                    {bk.customers?.license_plate}
                                                </span>
                                            </div>
                                            <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                                                <span>ผู้รับงาน: {bk.staff?.full_name || 'ยังไม่กำหนด'}</span>
                                                <span style={{ textTransform: 'capitalize', color: bk.status === 'completed' ? '#16A34A' : '#D97706', fontWeight: 600 }}>
                                                    {bk.status}
                                                </span>
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </div>

                    {/* Chat Area */}
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {selectedBooking ? (
                            <BookingChat
                                bookingId={selectedBooking.id}
                                senderType="admin"
                                senderId={`shop_admin_${branchSlug}`}
                                senderName={`${branchSlug.toUpperCase()} Admin`}
                            />
                        ) : (
                            <div style={{ margin: 'auto', textAlign: 'center', color: '#94A3B8' }}>
                                <MessageCircle size={40} style={{ opacity: 0.3, marginBottom: 8 }} />
                                <div>เลือกรายการจองเพื่อดูการสนทนา</div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
