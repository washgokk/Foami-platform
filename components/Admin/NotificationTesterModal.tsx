'use client'
import { useState, useEffect } from 'react'
import { X, Bell, User, UserCircle2, Send, CheckCircle2, AlertCircle, Settings, MessageSquare, Smartphone, ChevronDown, ChevronUp, Save } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface NotificationTesterModalProps {
    isOpen: boolean
    onClose: () => void
}

const STAFF_CASES = [
    { id: 'new_job',      label: 'งานเข้าใหม่',         icon: '🔔', desc: 'แจ้งเตือนพนักงานในโซนเมื่อมีงานใหม่รอรับ' },
    { id: 'reminder',     label: 'แจ้งเตือนงานค้าง',    icon: '📢', desc: 'แจ้งเตือนพนักงานเมื่อไม่มีใครรับงานสักพัก' },
    { id: 'auto_assigned',label: 'มอบหมายออโต้',       icon: '🚨', desc: 'แจ้งเตือนพนักงานเมื่อระบบบังคับมอบหมายงานให้' },
    { id: 'cancelled',    label: 'งานถูกยกเลิก',        icon: '❌', desc: 'แจ้งเตือนพนักงานเมื่อลูกค้ากดยกเลิกงาน' },
    { id: 'rescheduled',  label: 'ลูกค้าเลื่อนนัด',     icon: '📅', desc: 'แจ้งเตือนพนักงานเมื่อลูกค้าเลื่อนนัด' },
    { id: 'paid_extra',   label: 'ชำระเงินเพิ่ม',       icon: '✨', desc: 'แจ้งเตือนพนักงานเมื่อลูกค้าชำระเงินส่วนต่างสำเร็จ' },
]

const CUSTOMER_CASES = [
    { id: 'accepted',        label: 'พนักงานรับงาน',        icon: '✅', desc: 'แจ้งลูกค้าเมื่อพนักงานกดรับงาน' },
    { id: 'confirmed',       label: 'ยืนยันนัดหมาย',       icon: '🤝', desc: 'แจ้งลูกค้าเมื่อยืนยันนัดหมายสำเร็จ' },
    { id: 'picking_up',      label: 'มารับรถ',              icon: '🏍️', desc: 'แจ้งลูกค้าเมื่อพนักงานกำลังเดินทางมารับรถ' },
    { id: 'washing',         label: 'กำลังล้าง',            icon: '🫧', desc: 'แจ้งลูกค้าเมื่อพนักงานเริ่มล้างรถ' },
    { id: 'delivering',      label: 'กำลังส่งคืน',         icon: '🚗', desc: 'แจ้งลูกค้าเมื่อพนักงานกำลังนำรถกลับ' },
    { id: 'payment_pending', label: 'รอชำระส่วนต่าง',      icon: '💳', desc: 'แจ้งลูกค้าเมื่อมีค่าบริการเพิ่มเติมต้องชำระ' },
    { id: 'completed',       label: 'เสร็จสมบูรณ์',        icon: '🎉', desc: 'แจ้งลูกค้าเมื่อดูแลรถเสร็จสิ้น' },
    { id: 'auto_assigned',   label: 'มอบหมายออโต้',        icon: '🤖', desc: 'แจ้งลูกค้าเมื่อระบบเลือกพนักงานให้อัตโนมัติ' },
]

type NotifSettings = {
    staff: Record<string, { push: boolean; line: boolean }>
    customer: Record<string, { push: boolean; line: boolean }>
}

function defaultSettings(): NotifSettings {
    const make = (cases: typeof STAFF_CASES) =>
        Object.fromEntries(cases.map(c => [c.id, { push: true, line: true }]))
    return { staff: make(STAFF_CASES), customer: make(CUSTOMER_CASES) }
}

// ─── Toggle component ────────────────────────────────────
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
    return (
        <button
            onClick={() => onChange(!on)}
            style={{
                width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                background: on ? '#315EC3' : '#CBD5E1',
                position: 'relative', transition: 'background 0.2s', flexShrink: 0,
            }}
        >
            <span style={{
                position: 'absolute', top: 3,
                left: on ? 23 : 3,
                width: 18, height: 18, borderRadius: '50%',
                background: 'white',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                transition: 'left 0.2s',
            }} />
        </button>
    )
}

// ─── Settings Section ──────────────────────────────────
function SettingsSection({
    title, icon, cases, settings, onToggle
}: {
    title: string
    icon: string
    cases: typeof STAFF_CASES
    settings: Record<string, { push: boolean; line: boolean }>
    onToggle: (id: string, channel: 'push' | 'line', val: boolean) => void
}) {
    const [open, setOpen] = useState(true)

    const allPush = cases.every(c => settings[c.id]?.push)
    const allLine = cases.every(c => settings[c.id]?.line)

    return (
        <div style={{ border: '1.5px solid var(--border)', borderRadius: 16, overflow: 'hidden', marginBottom: 16 }}>
            {/* Header */}
            <button
                onClick={() => setOpen(o => !o)}
                style={{
                    width: '100%', padding: '14px 18px', background: 'var(--surface-2)',
                    border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700, fontSize: '0.95rem' }}>
                    <span style={{ fontSize: '1.2rem' }}>{icon}</span> {title}
                </div>
                {open ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
            </button>

            {open && (
                <div style={{ padding: '0 18px 18px' }}>
                    {/* All-toggle header */}
                    <div style={{
                        display: 'grid', gridTemplateColumns: '1fr 100px 100px',
                        gap: 8, padding: '10px 0 8px',
                        borderBottom: '1px solid var(--border)', marginBottom: 8,
                        fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase',
                    }}>
                        <span>เหตุการณ์</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                            <Smartphone size={13} /> Push
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                            <MessageSquare size={13} /> LINE
                        </div>
                    </div>

                    {/* Master toggle row */}
                    <div style={{
                        display: 'grid', gridTemplateColumns: '1fr 100px 100px',
                        gap: 8, padding: '8px 0 12px',
                        borderBottom: '2px solid var(--border)', marginBottom: 10,
                    }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--brand-dominant)', alignSelf: 'center' }}>
                            เปิด/ปิดทั้งหมด
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <Toggle on={allPush} onChange={val => cases.forEach(c => onToggle(c.id, 'push', val))} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <Toggle on={allLine} onChange={val => cases.forEach(c => onToggle(c.id, 'line', val))} />
                        </div>
                    </div>

                    {/* Individual rows */}
                    {cases.map(c => (
                        <div
                            key={c.id}
                            style={{
                                display: 'grid', gridTemplateColumns: '1fr 100px 100px',
                                gap: 8, padding: '10px 0',
                                borderBottom: '1px solid var(--border)',
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{c.icon}</span>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{c.label}</div>
                                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{c.desc}</div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                <Toggle
                                    on={settings[c.id]?.push ?? true}
                                    onChange={val => onToggle(c.id, 'push', val)}
                                />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                <Toggle
                                    on={settings[c.id]?.line ?? true}
                                    onChange={val => onToggle(c.id, 'line', val)}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

// ─── Main Modal ──────────────────────────────────────────
export default function NotificationTesterModal({ isOpen, onClose }: NotificationTesterModalProps) {
    const [activeTab, setActiveTab] = useState<'tester' | 'settings'>('tester')
    const [targetType, setTargetType] = useState<'staff' | 'customer'>('staff')
    const [users, setUsers] = useState<any[]>([])
    const [selectedUser, setSelectedUser] = useState<string>('')
    const [branches, setBranches] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [simulating, setSimulating] = useState(false)
    const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null)
    const [settings, setSettings] = useState<NotifSettings>(defaultSettings())
    const [saved, setSaved] = useState(false)

    const [loadingSettings, setLoadingSettings] = useState(true)

    useEffect(() => {
        if (isOpen) {
            loadGlobalSettings()
            setStatus(null)
            loadBranches()
        }
    }, [isOpen])

    const loadGlobalSettings = async () => {
        setLoadingSettings(true)
        try {
            const res = await fetch('/api/admin/settings')
            const result = await res.json()
            if (result.settings) {
                setSettings(result.settings as NotifSettings)
            } else {
                setSettings(defaultSettings())
            }
        } catch (err) {
            console.error('Failed to load settings', err)
            setSettings(defaultSettings())
        } finally {
            setLoadingSettings(false)
        }
    }

    useEffect(() => {
        if (isOpen) { loadUsers(); setStatus(null) }
    }, [isOpen, targetType])

    const loadBranches = async () => {
        const { data } = await supabase.from('branches').select('id, slug, name').limit(10)
        if (data) setBranches(data)
    }

    const loadUsers = async () => {
        const table = targetType === 'staff' ? 'staff' : 'customers'
        const { data: userData } = await supabase.from(table).select('id, full_name, line_user_id').limit(40)
        if (!userData) return
        const { data: pushData } = await supabase.from('push_subscriptions').select('user_id')
            .eq('platform', targetType).in('user_id', userData.map(u => u.id))
        const pushedUserIds = new Set(pushData?.map(p => p.user_id) || [])
        const processedUsers = userData.map(u => ({ ...u, hasPush: pushedUserIds.has(u.id) }))
        setUsers(processedUsers)
        if (processedUsers.length > 0) setSelectedUser(processedUsers[0].id)
    }

    const handleTest = async (caseId: string) => {
        if (!selectedUser) return
        setLoading(true)
        setStatus(null)
        try {
            const s = settings[targetType][caseId] ?? { push: true, line: true }
            const res = await fetch('/api/admin/test-notification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    targetType, 
                    userId: selectedUser, 
                    caseId,
                    enablePush: s.push,
                    enableLine: s.line
                })
            })
            const result = await res.json()
            if (result.error) throw new Error(result.error)
            setStatus({
                type: 'success',
                msg: `ส่งสำเร็จ! (Push: ${result.push ? '✅' : '❌'}, LINE: ${result.line ? '✅' : '❌'})`
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
            const { data, error } = await supabase.from('customers').select('*').eq('id', selectedUser).single()
            if (error) throw error
            if (!data) throw new Error('Customer not found')
            const branch = branches[0]?.slug || 'foami-demo'
            localStorage.setItem('liff_customer', JSON.stringify(data))
            localStorage.setItem('liff_line_user_id', data.line_user_id || '')
            localStorage.setItem('last_branch_slug', branch)
            // Open the entry page (not /menu directly) so liff_customer is picked up correctly
            window.open(`/${branch}`, '_blank')
            setStatus({ type: 'success', msg: `จำลองเป็น ${data.full_name} สำเร็จ!` })
        } catch (err: any) {
            setStatus({ type: 'error', msg: `จำลองล้มเหลว: ${err.message}` })
        } finally {
            setSimulating(false)
        }
    }

    const toggleSetting = (group: 'staff' | 'customer', id: string, channel: 'push' | 'line', val: boolean) => {
        setSettings(prev => ({
            ...prev,
            [group]: {
                ...prev[group],
                [id]: { ...prev[group][id], [channel]: val }
            }
        }))
        setSaved(false)
    }

    const handleSaveSettings = async () => {
        setSaved(false)
        try {
            const res = await fetch('/api/admin/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ settings })
            })
            if (!res.ok) throw new Error('Save failed')
            setSaved(true)
            setTimeout(() => setSaved(false), 2000)
        } catch (err) {
            console.error(err)
            alert('บันทึกการตั้งค่าล้มเหลว')
        }
    }

    if (!isOpen) return null

    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(4px)', padding: '16px',
        }}>
            <div style={{
                background: 'var(--surface)', borderRadius: 24, width: '100%', maxWidth: 680,
                maxHeight: '92vh', display: 'flex', flexDirection: 'column',
                boxShadow: '0 32px 64px rgba(0,0,0,0.18)',
                animation: 'slideUp 0.25s ease-out',
            }}>
                {/* Header */}
                <div style={{
                    padding: '22px 28px', display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between', borderBottom: '1px solid var(--border)', flexShrink: 0,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ background: 'var(--brand-dominant)', padding: '9px', borderRadius: 13, color: 'white', display: 'flex' }}>
                            <Bell size={19} />
                        </div>
                        <div>
                            <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>ระบบแจ้งเตือน</div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>ทดสอบและตั้งค่าการแจ้งเตือน</div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{ width: 36, height: 36, borderRadius: 10, border: 'none', background: 'var(--surface-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}
                    ><X size={17} /></button>
                </div>

                {/* Tab Bar */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 28px', background: 'var(--surface)', flexShrink: 0 }}>
                    {[
                        { id: 'tester' as const, icon: <Send size={14} />, label: 'ทดสอบส่ง' },
                        { id: 'settings' as const, icon: <Settings size={14} />, label: 'ตั้งค่าแจ้งเตือน' },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            style={{
                                padding: '13px 18px', border: 'none', background: 'transparent', cursor: 'pointer',
                                borderBottom: activeTab === tab.id ? '2.5px solid var(--brand-dominant)' : '2.5px solid transparent',
                                color: activeTab === tab.id ? 'var(--brand-dominant)' : 'var(--text-muted)',
                                fontWeight: 700, fontSize: '0.88rem',
                                display: 'flex', alignItems: 'center', gap: 7, transition: 'all 0.15s',
                            }}
                        >
                            {tab.icon} {tab.label}
                        </button>
                    ))}
                </div>

                {/* Body */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>

                    {/* ──────────── TESTER TAB ──────────── */}
                    {activeTab === 'tester' && (
                        <>
                            {/* Target selector */}
                            <div style={{ display: 'flex', gap: 10, marginBottom: 22 }}>
                                {([['staff', <UserCircle2 size={17} />, 'สำหรับพนักงาน'], ['customer', <User size={17} />, 'สำหรับลูกค้า']] as const).map(([type, icon, label]) => (
                                    <button
                                        key={type}
                                        onClick={() => setTargetType(type)}
                                        style={{
                                            flex: 1, padding: '11px', borderRadius: 14, border: '2px solid',
                                            borderColor: targetType === type ? 'var(--brand-dominant)' : 'var(--border)',
                                            background: targetType === type ? 'var(--brand-dominant)' : 'var(--surface)',
                                            color: targetType === type ? 'white' : 'var(--text-muted)',
                                            fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                            transition: 'all 0.15s',
                                        }}
                                    >{icon} {label}</button>
                                ))}
                            </div>

                            {/* User dropdown */}
                            <div style={{ marginBottom: 24 }}>
                                <label style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
                                    1. เลือกผู้รับการทดสอบ
                                </label>
                                <select
                                    className="form-input"
                                    value={selectedUser}
                                    onChange={e => setSelectedUser(e.target.value)}
                                    style={{ height: 46 }}
                                >
                                    <option value="">-- เลือก{targetType === 'staff' ? 'พนักงาน' : 'ลูกค้า'} --</option>
                                    {users.map(u => (
                                        <option key={u.id} value={u.id}>
                                            {u.full_name}{u.hasPush ? ' 🔔' : ''}{u.line_user_id ? ' 💬' : ''}
                                        </option>
                                    ))}
                                </select>
                                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 6 }}>
                                    🔔 = มี Push subscription &nbsp; 💬 = มี LINE account
                                </p>

                                {targetType === 'customer' && selectedUser && (
                                    <div style={{ marginTop: 12, padding: 14, background: '#EFF3FD', borderRadius: 12, border: '1px dashed var(--brand-dominant)' }}>
                                        <p style={{ fontSize: '0.83rem', fontWeight: 700, color: 'var(--brand-dominant)', marginBottom: 10 }}>
                                            🛠️ ตัวจำลองลูกค้า
                                        </p>
                                        <button
                                            className="btn btn-primary"
                                            onClick={handleSimulate}
                                            disabled={simulating}
                                            style={{ width: '100%', borderRadius: 10 }}
                                        >
                                            {simulating ? 'กำลังเตรียมข้อมูล...' : '🚀 จำลองเป็นลูกค้าคนนี้ (Bypass Login)'}
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Case list */}
                            <label style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 12 }}>
                                2. เลือกเคสที่ต้องการทดสอบ
                            </label>
                            <div style={{ display: 'grid', gap: 10 }}>
                                {(targetType === 'staff' ? STAFF_CASES : CUSTOMER_CASES).map(c => {
                                    const s = settings[targetType][c.id] ?? { push: true, line: true }
                                    return (
                                        <div
                                            key={c.id}
                                            style={{
                                                padding: '13px 16px',
                                                border: '1.5px solid var(--border)',
                                                borderRadius: 14,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                background: 'var(--surface)',
                                            }}
                                        >
                                            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                                <span style={{ fontSize: '1.4rem' }}>{c.icon}</span>
                                                <div>
                                                    <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>{c.label}</div>
                                                    <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: 2 }}>{c.desc}</div>
                                                    <div style={{ display: 'flex', gap: 6, marginTop: 5 }}>
                                                        <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: 20, background: s.push ? '#EFF3FD' : '#FEF2F2', color: s.push ? 'var(--brand-dominant)' : '#EF4444', fontWeight: 600 }}>
                                                            Push {s.push ? 'ON' : 'OFF'}
                                                        </span>
                                                        <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: 20, background: s.line ? '#F0FDF4' : '#FEF2F2', color: s.line ? '#10B981' : '#EF4444', fontWeight: 600 }}>
                                                            LINE {s.line ? 'ON' : 'OFF'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                className="btn btn-primary btn-sm"
                                                onClick={() => handleTest(c.id)}
                                                disabled={loading || !selectedUser}
                                                style={{ borderRadius: 10, flexShrink: 0 }}
                                            >
                                                <Send size={13} style={{ marginRight: 5 }} /> ทดสอบ
                                            </button>
                                        </div>
                                    )
                                })}
                            </div>

                            {status && (
                                <div style={{
                                    marginTop: 18, padding: 14, borderRadius: 12,
                                    background: status.type === 'success' ? '#ECFDF5' : '#FEF2F2',
                                    color: status.type === 'success' ? '#059669' : '#DC2626',
                                    display: 'flex', alignItems: 'center', gap: 10,
                                    fontWeight: 700, fontSize: '0.9rem',
                                }}>
                                    {status.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                                    {status.msg}
                                </div>
                            )}
                        </>
                    )}

                    {/* ──────────── SETTINGS TAB ──────────── */}
                    {activeTab === 'settings' && (
                        <>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: '1rem' }}>ตั้งค่าช่องทางแจ้งเตือน</div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 3 }}>
                                        เลือกว่าแต่ละ event จะส่งผ่าน Push Notification หรือ LINE หรือทั้งคู่
                                    </div>
                                </div>
                                <button
                                    onClick={handleSaveSettings}
                                    style={{
                                        padding: '9px 18px', borderRadius: 12, border: 'none', cursor: 'pointer',
                                        background: saved ? '#10B981' : 'var(--brand-dominant)', color: 'white',
                                        fontWeight: 700, fontSize: '0.85rem',
                                        display: 'flex', alignItems: 'center', gap: 7, transition: 'background 0.2s'
                                    }}
                                >
                                    {saved ? <CheckCircle2 size={15} /> : <Save size={15} />}
                                    {saved ? 'บันทึกแล้ว!' : 'บันทึก'}
                                </button>
                            </div>

                            {/* Legend */}
                            <div style={{
                                display: 'flex', gap: 16, marginBottom: 20, padding: '12px 16px',
                                background: 'var(--surface-2)', borderRadius: 12, fontSize: '0.8rem',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Smartphone size={14} color="var(--brand-dominant)" />
                                    <span><strong>Push</strong> — แจ้งเตือนผ่าน Browser/PWA</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <MessageSquare size={14} color="#10B981" />
                                    <span><strong>LINE</strong> — ส่ง Flex Message ทาง LINE OA</span>
                                </div>
                            </div>

                            <SettingsSection
                                title="แจ้งเตือนพนักงาน"
                                icon="👷"
                                cases={STAFF_CASES}
                                settings={settings.staff}
                                onToggle={(id, ch, val) => toggleSetting('staff', id, ch, val)}
                            />
                            <SettingsSection
                                title="แจ้งเตือนลูกค้า"
                                icon="👤"
                                cases={CUSTOMER_CASES}
                                settings={settings.customer}
                                onToggle={(id, ch, val) => toggleSetting('customer', id, ch, val)}
                            />

                            <div style={{ padding: '12px 16px', background: '#Eff6ff', borderRadius: 12, border: '1px solid #bfdbfe', fontSize: '0.82rem', color: '#1e3a8a' }}>
                                🌍 **ส่งผลต่อระบบแจ้งเตือนหลัก:** การเปลี่ยนแปลงจะมีผลกับการแจ้งเตือนจริงทั้งหมดของทั้งลูกค้าและพนักงาน (Global App Settings)
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div style={{ padding: '16px 28px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
                    <button className="btn btn-outline btn-full" onClick={onClose} style={{ borderRadius: 12 }}>
                        ปิดหน้าต่าง
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes slideUp {
                    from { transform: translateY(20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `}</style>
        </div>
    )
}
