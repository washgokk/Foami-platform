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
    Hash,
    Database,
    ExternalLink
} from 'lucide-react'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'

interface AuditLogModalProps {
    isOpen: boolean
    onClose: () => void
}

export default function AuditLogModal({ isOpen, onClose }: AuditLogModalProps) {
    const [logs, setLogs] = useState<AuditLog[]>([])
    const [adminMap, setAdminMap] = useState<Record<string, string>>({})
    const [loading, setLoading] = useState(true)
    const [restoringId, setRestoringId] = useState<string | null>(null)

    const fetchLogs = async () => {
        setLoading(true)
        
        // Fetch logs and admins in parallel
        const [logsRes, staffRes] = await Promise.all([
            supabase
                .from('audit_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50),
            supabase
                .from('staff')
                .select('id, full_name')
        ])

        if (staffRes.data) {
            const map: Record<string, string> = {}
            staffRes.data.forEach(s => { map[s.id] = s.full_name })
            setAdminMap(map)
        }

        setLogs(logsRes.data || [])
        setLoading(false)
    }

    useEffect(() => {
        if (isOpen) fetchLogs()
    }, [isOpen])

    const handleRestore = async (log: AuditLog) => {
        if (!log.old_data) return
        
        const isDelete = log.action_type === 'DELETE'
        const confirmMsg = isDelete 
            ? 'ต้องการกู้คืนข้อมูลที่ถูกลบไปใช่หรือไม่?' 
            : 'ต้องการย้อนกลับสถานะข้อมูลนี้ใช่หรือไม่? ข้อมูลปัจจุบันจะถูกแทนที่ด้วยข้อมูลเดิม'
            
        if (!confirm(confirmMsg)) return

        setRestoringId(log.id)
        try {
            // Table mapping
            let tableName = log.entity_type as string
            if (tableName === 'branch') tableName = 'branches'
            if (tableName === 'service') {
                // Heuristic for old generic 'service' logs
                if (log.old_data.price_s !== undefined) tableName = 'services'
                else if (log.old_data.prices && typeof log.old_data.prices === 'object') tableName = 'cc_price_groups'
                else if (log.old_data.polygon_coords) tableName = 'zones'
                else tableName = 'service_addons'
            }
            if (tableName === 'service_addon') tableName = 'service_addons'
            if (tableName === 'zone') tableName = 'zones'
            if (tableName === 'discount_code') tableName = 'discount_codes'
            if (tableName === 'cc_price_group') tableName = 'cc_price_groups'

            let query;
            if (isDelete) {
                // Restore by re-inserting
                query = supabase.from(tableName).insert(log.old_data)
            } else {
                // Restore by updating back to old state
                query = supabase.from(tableName).update(log.old_data).eq('id', log.entity_id)
            }

            const { error } = await query

            if (error) throw error

            // Record the restore action
            const adminId = localStorage.getItem('admin_token') || 'system'
            await supabase.from('audit_logs').insert({
                admin_id: adminId,
                action_type: 'RESTORE',
                entity_type: log.entity_type,
                entity_id: log.entity_id,
                description: `กู้คืนข้อมูล: ${log.description}`,
                created_at: new Date().toISOString()
            })

            alert(isDelete ? 'กู้คืนข้อมูลเรียบร้อยแล้ว' : 'ย้อนกลับสถานะเรียบร้อยแล้ว')
            window.dispatchEvent(new CustomEvent('foami:refresh'))
            fetchLogs()
        } catch (err: any) {
            console.error(err)
            alert('เกิดข้อผิดพลาดในการคืนค่า: ' + (err.message || 'Unknown error'))
        } finally {
            setRestoringId(null)
        }
    }

    const getAdminName = (id: string) => {
        if (id === 'mock_admin_token') return 'แอดมิน (Super)'
        if (id === 'system') return 'ระบบอัตโนมัติ'
        return adminMap[id] || id.slice(-8)
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
                                            <User size={12} /> {getAdminName(log.admin_id)}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <Hash size={12} /> ID: {log.entity_id.slice(-8)}
                                        </div>
                                    </div>

                                    {log.old_data && (log.action_type === 'UPDATE' || log.action_type === 'TOGGLE_STATUS' || log.action_type === 'DELETE') && (
                                        <button 
                                            onClick={() => handleRestore(log)}
                                            disabled={restoringId === log.id}
                                            style={{
                                                position: 'absolute',
                                                right: 20,
                                                bottom: 20,
                                                padding: '8px 16px',
                                                borderRadius: 10,
                                                border: log.action_type === 'DELETE' ? '1.5px solid #22c55e' : '1.5px solid #0ea5e9',
                                                background: 'white',
                                                color: log.action_type === 'DELETE' ? '#22c55e' : '#0ea5e9',
                                                fontSize: '0.85rem',
                                                fontWeight: 700,
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 6,
                                                transition: 'all 0.2s'
                                            }}
                                            onMouseEnter={(e) => { e.currentTarget.style.background = log.action_type === 'DELETE' ? '#f0fdf4' : '#e0f2fe' }}
                                            onMouseLeave={(e) => { e.currentTarget.style.background = 'white' }}
                                        >
                                            <RotateCcw size={16} /> 
                                            {restoringId === log.id ? 'กำลังคืนค่า...' : log.action_type === 'DELETE' ? 'กู้คืนข้อมูล' : 'ย้อนกลับสถานะ'}
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
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#94a3b8', fontSize: '0.75rem' }}>
                        <Database size={14} />
                        <span>ระบบบันทึกประวัติอัตโนมัติเพื่อความโปร่งใส</span>
                    </div>
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
                            cursor: 'pointer',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
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
