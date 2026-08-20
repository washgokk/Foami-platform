'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Branch, Zone } from '@/lib/types'
import { Store, Map as MapIcon, List, MapPin, Copy, Edit3, Pause, Play, Trash2, Globe, Phone, Clock, ArrowRight, Coins, Fuel as GasStation, Wrench, Settings, Plus, Lock } from 'lucide-react'
import styles from '@/app/admin/branches/branches.module.css'

const MasterBranchesMap = dynamic(() => import('@/app/admin/branches/MasterBranchesMap'), { ssr: false })

export default function ShopBranchesPage() {
    const params = useParams()
    const branchSlug = (params?.branchSlug as string) || 'main'

    const [viewMode, setViewMode] = useState<'list' | 'map'>('list')
    const [branches, setBranches] = useState<Branch[]>([])
    const [allZones, setAllZones] = useState<Zone[]>([])
    const [loading, setLoading] = useState(true)

    const load = useCallback(async () => {
        const [{ data: brData }, { data: zData }] = await Promise.all([
            supabase.from('branches').select('*').eq('slug', branchSlug),
            supabase.from('zones').select('*').eq('is_active', true)
        ])
        setBranches(brData || [])
        setAllZones(zData || [])
        setLoading(false)
    }, [branchSlug])

    useEffect(() => { load() }, [load])

    return (
        <div>
            <div className="page-header animate-fade">
                <div>
                    <h2 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Store size={28} style={{ color: 'var(--brand-dominant)' }} /> ข้อมูลสาขา &amp; โซนบริการ
                    </h2>
                    <p className="page-subtitle">จัดการโซนส่งรถและพื้นที่บริการของสาขา /{branchSlug}</p>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
                    <div className="btn-group" style={{ background: 'var(--surface-2)', padding: 4, borderRadius: '12px', display: 'flex' }}>
                        <button 
                            className={`btn btn-sm ${viewMode === 'list' ? 'btn-primary' : 'btn-ghost'}`} 
                            onClick={() => setViewMode('list')} 
                            style={{ borderRadius: '8px', padding: '6px 16px', background: viewMode === 'list' ? 'var(--brand-dominant)' : 'transparent', color: viewMode === 'list' ? 'white' : 'var(--text-muted)' }}
                        >
                            <List size={16} /> รายการ
                        </button>
                        <button 
                            className={`btn btn-sm ${viewMode === 'map' ? 'btn-primary' : 'btn-ghost'}`} 
                            onClick={() => setViewMode('map')} 
                            style={{ borderRadius: '8px', padding: '6px 16px', background: viewMode === 'map' ? 'var(--brand-dominant)' : 'transparent', color: viewMode === 'map' ? 'white' : 'var(--text-muted)' }}
                        >
                            <MapIcon size={16} /> แผนที่โซน
                        </button>
                    </div>

                    {/* Notice for Shop Admin: Adding Branches restricted */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 7,
                        padding: '8px 14px', borderRadius: '12px', background: '#EDE9FE',
                        color: '#6D28D9', fontSize: '0.8rem', fontWeight: 600, border: '1px solid #DDD6FE'
                    }}>
                        <Lock size={14} /> เพิ่มสาขาเพิ่มเติมติดต่อ Platform Admin
                    </div>
                </div>
            </div>

            {loading ? (
                <div className={styles.grid}>
                    {[1].map(i => <div key={i} className={`${styles.branchCard} animate-pulse`} style={{ height: 140 }} />)}
                </div>
            ) : viewMode === 'map' ? (
                <div className="animate-fade" style={{ background: 'var(--surface)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)', padding: 'var(--space-2)', height: '70vh' }}>
                    <MasterBranchesMap branches={branches} zones={allZones} />
                </div>
            ) : branches.length === 0 ? (
                <div className="empty-state animate-fade">
                    <div style={{ background: 'var(--surface-2)', width: 80, height: 80, borderRadius: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: 'var(--text-muted)' }}>
                        <Store size={40} />
                    </div>
                    <h3>ไม่พบข้อมูลสาขานี้</h3>
                </div>
            ) : (
                <div className={styles.grid}>
                    {branches.map(b => {
                        const zones = allZones.filter(z => z.branch_id === b.id)
                        return (
                            <div key={b.id} className={`${styles.branchCard} animate-fade`}>
                                <div className={styles.cardHeader}>
                                    <div className={styles.cardHeaderInfo}>
                                        <div className={styles.iconBox}>
                                            <Store size={24} />
                                        </div>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <h3 className={styles.branchName}>{b.name}</h3>
                                                <span className={`badge ${b.is_active ? 'badge-success' : 'badge-neutral'}`}>
                                                    {b.is_active ? 'เปิดให้บริการ' : 'ปิดชั่วคราว'}
                                                </span>
                                            </div>
                                            <p className={styles.branchAddress} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                                                <MapPin size={14} style={{ color: 'var(--brand-dominant)', flexShrink: 0 }} /> {b.address}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className={styles.cardBody}>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-4)', margin: 'var(--space-4) 0' }}>
                                        <div style={{ background: 'var(--surface-2)', padding: '12px 16px', borderRadius: '12px' }}>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>โซนให้บริการ</div>
                                            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>{zones.length} โซน</div>
                                        </div>
                                        <div style={{ background: 'var(--surface-2)', padding: '12px 16px', borderRadius: '12px' }}>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>ค่าส่งนอกโซน</div>
                                            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--brand-dominant)', marginTop: 2 }}>
                                                ฿{b.out_of_zone_fee} /{b.out_of_zone_type === 'per_km' ? 'กม.' : 'รอบ'}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Zones Action */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                            วาด/จัดการขอบเขตโซนส่งรถ
                                        </div>
                                        <Link 
                                            href={`/admin/branches/${b.id}/zones`}
                                            className="btn btn-primary btn-sm"
                                            style={{ borderRadius: '10px', gap: 6 }}
                                        >
                                            <MapIcon size={14} /> จัดการโซนบนแผนที่ ({zones.length})
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
