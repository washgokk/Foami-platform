'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { AuditLog } from '@/lib/types'
import { 
    X, 
    History, 
    RotateCcw, 
    User, 
    CheckCircle2, 
    AlertCircle,
    ArrowLeft,
    Clock,
    Tag,
    Hash
} from 'lucide-react'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'

interface AuditLogModalProps {
    isOpen: boolean
    onClose: () => void
}

export default function AuditLogModal({ isOpen, onClose }: AuditLogModalProps) {
    const [logs, setLogs] = useState<AuditLog[]>([])
    const [loading, setLoading] = useState(true)
    const [restoringId, setRestoringId] = useState<string | null>(null)

    const fetchLogs = async () => {
        setLoading(true)
        const { data } = await supabase
            .from('audit_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50)
        setLogs(data || [])
        setLoading(false)
    }

    useEffect(() => {
        if (isOpen) fetchLogs()
    }, [isOpen])

    const handleRestore = async (log: AuditLog) => {
        if (!log.old_data) return
        if (!confirm('ต้องการย้อนกลับสถานะข้อมูลนี้ใช่หรือไม่? ข้อมูลปัจจุบันจะถูกแทนที่ด้วยข้อมูลเดิม')) return

        setRestoringId(log.id)
        try {
            const { error } = await supabase
                .from(log.entity_type)
                .update(log.old_data)
                .eq('id', log.entity_id)

            if (error) throw error

            // Record the restore action itself
            await supabase.from('audit_logs').insert({
                admin_id: localStorage.getItem('admin_token') || 'system',
                action_type: 'RESTORE',
                entity_type: log.entity_type,
                entity_id: log.entity_id,
                description: `ย้อนกลับสถานะ: ${log.description}`,
                created_at: new Date().toISOString()
            })

            alert('ย้อนกลับสถานะเรียบร้อยแล้ว')
            fetchLogs()
        } catch (err) {
            console.error(err)
            alert('เกิดข้อผิดพลาดในการกดย้อนกลับ')
        } finally {
            setRestoringId(null)
        }
    }

    if (!isOpen) return null

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20
        }}>
            {/* Backdrop */}
            <div 
                onClick={onClose}
                style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(15, 23, 42, 0.4)',
                    backdropFilter: 'blur(8px)'
                }}
            />

            {/* Modal Content */}
            <div style={{
                position: 'relative',
                width: '100%',
                maxWidth: 800,
                maxHeight: '85vh',
                background: 'white',
                borderRadius: 24,
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                animation: 'modalFadeUp 0.3s ease-out'
            }}>
                <header style={{
                    padding: '24px 32px',
                    borderBottom: '1px solid #f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: '#f8fafc'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                            width: 40,
                            height: 40,
                            borderRadius: 12,
                            background: 'var(--brand-dominant)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white'
                        }}>
                            <History size={20} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>ประวัติการแก้ไข</h2>
                            <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>ติดตามการเปลี่ยนแปลงข้อมูลระบบย้อนหลัง</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        style={{
                            width: 40,
                            height: 40,
                            borderRadius: '50%',
                            border: 'none',
                            background: 'white',
                            color: '#64748b',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
                            transition: 'all 0.2s'
                        }}
                    >
                        <X size={20} />
                    </button>
                </header>

                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '24px 32px',
                    background: '#fff'
                }}>
                    {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner" /></div>
                    ) : logs.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
                            <History size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
                            <p>ยังไม่มีประวัติการบันทึกข้อมูล</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {logs.map((log) => (
                                <div key={log.id} style={{
                                    padding: 20,
                                    borderRadius: 16,
                                    border: '1px solid #e2e8f0',
                                    background: '#f8fafc',
                                    position: 'relative',
                                    transition: 'all 0.2s'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{
                                                padding: '4px 10px',
                                                borderRadius: 6,
                                                fontSize: '0.7rem',
                                                fontWeight: 800,
                                                background: log.action_type === 'DELETE' ? '#fee2e2' : log.action_type === 'CREATE' ? '#dcfce7' : '#e0f2fe',
                                                color: log.action_type === 'DELETE' ? '#ef4444' : log.action_type === 'CREATE' ? '#22c55e' : '#0ea5e9'
                                            }}>
                                                {log.action_type}
                                            </span>
                                            <span style={{ fontSize: '0.85rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <Tag size={12} /> {log.entity_type}
                                            </span>
                                        </div>
                                        <span style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <Clock size={12} /> {format(new Date(log.created_at), 'd MMM yyyy HH:mm', { locale: th })}
                                        </span>
                                    </div>

                                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>{log.description}</h3>
                                    
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.8rem', color: '#64748b' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <User size={12} /> {log.admin_id === 'mock_admin_token' ? 'แอดมิน (Super)' : log.admin_id}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <Hash size={12} /> ID: {log.entity_id.slice(-8)}
                                        </div>
                                    </div>

                                    {log.old_data && (log.action_type === 'UPDATE' || log.action_type === 'TOGGLE_STATUS') && (
                                        <button 
                                            onClick={() => handleRestore(log)}
                                            disabled={restoringId === log.id}
                                            style={{
                                                position: 'absolute',
                                                right: 20,
                                                bottom: 20,
                                                padding: '8px 16px',
                                                borderRadius: 10,
                                                border: '1.5px solid #0ea5e9',
                                                background: 'white',
                                                color: '#0ea5e9',
                                                fontSize: '0.85rem',
                                                fontWeight: 700,
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 6,
                                                transition: 'all 0.2s'
                                            }}
                                            onMouseEnter={(e) => { e.currentTarget.style.background = '#e0f2fe' }}
                                            onMouseLeave={(e) => { e.currentTarget.style.background = 'white' }}
                                        >
                                            <RotateCcw size={16} /> {restoringId === log.id ? 'กำลังคืนค่า...' : 'ย้อนกลับสถานะ'}
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <footer style={{
                    padding: '24px 32px',
                    borderTop: '1px solid #f1f5f9',
                    background: '#f8fafc',
                    display: 'flex',
                    justifyContent: 'flex-end'
                }}>
                   <button 
                        onClick={onClose}
                        style={{
                            padding: '12px 24px',
                            borderRadius: 12,
                            border: '1px solid #cbd5e1',
                            background: 'white',
                            color: '#475569',
                            fontSize: '0.95rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                        }}
                    >
                        ปิดหน้าต่าง
                    </button>
                </footer>
            </div>
            
            <style jsx global>{`
                @keyframes modalFadeUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    )
}
