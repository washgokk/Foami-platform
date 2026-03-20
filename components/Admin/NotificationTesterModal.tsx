'use client'
import { useState, useEffect } from 'react'
import { X, Bell, User, UserCircle2, Send, CheckCircle2, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface NotificationTesterModalProps {
    isOpen: boolean
    onClose: () => void
}

const STAFF_CASES = [
    { id: 'new_job', label: 'งานเข้าใหม่ (New Job)', icon: '🔔', desc: 'แจ้งเตือนพนักงานในโซนเมื่อมีงานใหม่รอรับ' },
    { id: 'auto_assign', label: 'มอบหมายออโต้ (Auto Assign)', icon: '🚨', desc: 'แจ้งเตือนพนักงานเมื่อระบบบังคับมอบหมายงานให้' },
]

const CUSTOMER_CASES = [
    { id: 'accepted', label: 'พนักงานรับงาน (Accepted)', icon: '✅', desc: 'แจ้งเตือนลูกค้าเมื่อพนักงานกดรับงานแล้ว' },
    { id: 'on_the_way', label: 'กำลังเดินทาง (On the way)', icon: '🏍️', desc: 'แจ้งเตือนลูกค้าเมื่อพนักงานกดเริ่มเดินทาง' },
    { id: 'washing', label: 'กำลังล้าง (Washing)', icon: '🫧', desc: 'แจ้งเตือนลูกค้าเมื่อพนักงานกดเริ่มงานล้าง' },
    { id: 'completed', label: 'เสร็จสมบูรณ์ (Completed)', icon: '🎉', desc: 'แจ้งเตือนลูกค้าเมื่อพนักงานล้างเสร็จและกดปิดงาน' },
    { id: 'extra_fee', label: 'ค่าใช้จ่ายเพิ่ม (Extra Fee)', icon: '💰', desc: 'แจ้งเตือนลูกค้าเมื่อมีการเพิ่มค่าบริการพิเศษ' },
]

export default function NotificationTesterModal({ isOpen, onClose }: NotificationTesterModalProps) {
    const [targetType, setTargetType] = useState<'staff' | 'customer'>('staff')
    const [users, setUsers] = useState<any[]>([])
    const [selectedUser, setSelectedUser] = useState<string>('')
    const [branches, setBranches] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [simulating, setSimulating] = useState(false)
    const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null)

    useEffect(() => {
        if (isOpen) {
            loadUsers()
            loadBranches()
            setStatus(null)
        }
    }, [isOpen, targetType])

    const loadBranches = async () => {
        const { data } = await supabase.from('branches').select('id, slug, name').limit(10)
        if (data) setBranches(data)
    }

    const loadUsers = async () => {
        const table = targetType === 'staff' ? 'staff' : 'customers'
        
        // Load users
        const { data: userData } = await supabase.from(table).select('id, full_name, line_user_id').limit(40)
        if (!userData) return

        // Load push subscriptions for these users
        const { data: pushData } = await supabase
            .from('push_subscriptions')
            .select('user_id')
            .eq('platform', targetType)
            .in('user_id', userData.map(u => u.id))

        const pushedUserIds = new Set(pushData?.map(p => p.user_id) || [])

        const processedUsers = userData.map(u => ({
            ...u,
            hasPush: pushedUserIds.has(u.id)
        }))

        setUsers(processedUsers)
        if (processedUsers.length > 0) setSelectedUser(processedUsers[0].id)
    }

    const handleTest = async (caseId: string) => {
        if (!selectedUser) return
        setLoading(true)
        setStatus(null)

        try {
            const res = await fetch('/api/admin/test-notification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    targetType,
                    userId: selectedUser,
                    caseId
                })
            })
            const result = await res.json()
            if (result.error) throw new Error(result.error)
            
            setStatus({ 
                type: 'success', 
                msg: `ส่งสำเร็จ! (Push: ${result.push ? '✅' : '❌'}, Line: ${result.line ? '✅' : '❌'})` 
            })
        } catch (err: any) {
            setStatus({ type: 'error', msg: err.message })
        } finally {
            setLoading(false)
        }
    }

    const handleSimulate = async () => {
        if (!selectedUser || targetType !== 'customer') return
        setSimulating(true)
        try {
            // Fetch full customer data
            const { data, error } = await supabase
                .from('customers')
                .select('*')
                .eq('id', selectedUser)
                .single()
            
            if (error) throw error
            if (!data) throw new Error('Customer not found')

            // Pick a branch (first one or default)
            const branch = branches[0]?.slug || 'foami-demo'

            // Inject to localStorage
            localStorage.setItem('liff_customer', JSON.stringify(data))
            localStorage.setItem('liff_line_user_id', data.line_user_id || '')
            localStorage.setItem('last_branch_slug', branch)

            // Redirect to menu in new tab (or same if preferred, but new tab is better for admin)
            const url = `/${branch}/menu`
            window.open(url, '_blank')
            
            setStatus({ type: 'success', msg: `จำลองเป็น ${data.full_name} สำเร็จ! (เปิดหน้าต่างใหม่แล้ว)` })
        } catch (err: any) {
            setStatus({ type: 'error', msg: `จำลองล้มเหลว: ${err.message}` })
        } finally {
            setSimulating(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: 600, width: '95%' }}>
                <div className="modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ background: 'var(--primary-subtle)', padding: 8, borderRadius: 10, color: 'var(--primary)' }}>
                            <Bell size={20} />
                        </div>
                        <h2 className="modal-title">ทดสอบระบบแจ้งเตือน</h2>
                    </div>
                    <button className="modal-close" onClick={onClose}><X size={20} /></button>
                </div>

                <div className="modal-body">
                    {/* Target Selector */}
                    <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                        <button 
                            className={`btn ${targetType === 'staff' ? 'btn-primary' : 'btn-outline'}`}
                            onClick={() => setTargetType('staff')}
                            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                        >
                            <UserCircle2 size={18} /> สำหรับพนักงาน
                        </button>
                        <button 
                            className={`btn ${targetType === 'customer' ? 'btn-primary' : 'btn-outline'}`}
                            onClick={() => setTargetType('customer')}
                            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                        >
                            <User size={18} /> สำหรับลูกค้า
                        </button>
                    </div>

                    {/* User Selection */}
                    <div className="form-group" style={{ marginBottom: 25 }}>
                        <label className="form-label" style={{ fontWeight: 700 }}>1. เลือกผู้รับการทดสอบ (ทดสอบจริง)</label>
                        <select 
                            className="form-input" 
                            value={selectedUser} 
                            onChange={(e) => setSelectedUser(e.target.value)}
                            style={{ fontSize: '1rem', height: 48 }}
                        >
                            <option value="">-- เลือก{targetType === 'staff' ? 'พนักงาน' : 'ลูกค้า'} --</option>
                            {users.map(u => (
                                <option key={u.id} value={u.id}>
                                    {u.full_name} {u.hasPush ? ' (Push ✅)' : ' (Push ❌)'} {u.line_user_id ? ' (Line ✅)' : ' (Line ❌)'}
                                </option>
                            ))}
                        </select>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 6 }}>
                            * ควรเลือกบัญชีที่คุณใช้งานอยู่ เพื่อตรวจสอบข้อความในเครื่องตัวเองครับ
                        </p>

                        {/* Simulation Button (Only for Customer) */}
                        {targetType === 'customer' && selectedUser && (
                            <div style={{ marginTop: 15, padding: 12, background: 'var(--primary-ghost)', borderRadius: 12, border: '1px dashed var(--primary)' }}>
                                <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary)', marginBottom: 10 }}>
                                    🛠️ ตัวจำลองลูกค้า (สำหรับ Local Testing เท่านั้น)
                                </p>
                                <button 
                                    className="btn btn-primary"
                                    onClick={handleSimulate}
                                    disabled={simulating}
                                    style={{ width: '100%', borderRadius: 10, background: 'var(--brand-dominant)', border: 'none' }}
                                >
                                    {simulating ? 'กำลังเตรียมข้อมูล...' : '🚀 จำลองเป็นลูกค้าคนนี้ (Bypass Login)'}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Notification Cases */}
                    <label className="form-label" style={{ fontWeight: 700, marginBottom: 12 }}>2. เลือกเคสที่ต้องการทดสอบ</label>
                    <div style={{ display: 'grid', gap: 10 }}>
                        {(targetType === 'staff' ? STAFF_CASES : CUSTOMER_CASES).map(c => (
                            <div 
                                key={c.id} 
                                style={{ 
                                    padding: '12px 16px', 
                                    border: '1px solid var(--border)', 
                                    borderRadius: 12,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    transition: 'all 0.2s',
                                    background: 'var(--card-bg)'
                                }}
                            >
                                <div style={{ display: 'flex', gap: 15, alignItems: 'center' }}>
                                    <div style={{ fontSize: '1.5rem' }}>{c.icon}</div>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{c.label}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{c.desc}</div>
                                    </div>
                                </div>
                                <button 
                                    className="btn btn-primary btn-sm"
                                    onClick={() => handleTest(c.id)}
                                    disabled={loading || !selectedUser}
                                    style={{ padding: '8px 16px', borderRadius: 8 }}
                                >
                                    <Send size={14} style={{ marginRight: 6 }} /> ทดสอบ
                                </button>
                            </div>
                        ))}
                    </div>

                    {status && (
                        <div style={{ 
                            marginTop: 20, 
                            padding: 15, 
                            borderRadius: 10, 
                            background: status.type === 'success' ? '#ECFDF5' : '#FEF2F2',
                            color: status.type === 'success' ? '#059669' : '#DC2626',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            fontWeight: 600,
                            fontSize: '0.9rem'
                        }}>
                            {status.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                            {status.msg}
                        </div>
                    )}
                </div>

                <div className="modal-footer" style={{ marginTop: 20 }}>
                    <button className="btn btn-outline btn-full" onClick={onClose}>ปิดหน้าต่าง</button>
                </div>
            </div>

            <style jsx>{`
                .modal-overlay {
                    position: fixed;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(0,0,0,0.5);
                    z-index: 1000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    backdrop-filter: blur(4px);
                }
                .modal-content {
                    background: white;
                    border-radius: 20px;
                    padding: 24px;
                    box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
                    animation: slideUp 0.3s ease-out;
                }
                @keyframes slideUp {
                    from { transform: translateY(20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
                .modal-title { margin: 0; font-size: 1.25rem; font-weight: 800; color: #1e293b; }
                .modal-close { background: none; border: none; cursor: pointer; color: #64748b; }
            `}</style>
        </div>
    )
}
