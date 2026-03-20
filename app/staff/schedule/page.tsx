'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { TIME_SLOTS } from '@/lib/types'
import { addDays, format, startOfWeek } from 'date-fns'
import { th } from 'date-fns/locale'
import {
    CheckCircle2,
    XCircle,
    Star,
    Home,
    MapPin,
    Bike,
    Camera,
    AlertTriangle,
    Clock,
    Globe,
    Rocket,
    Info,
    Calendar,
    ChevronLeft,
    ChevronRight,
    Save
} from 'lucide-react'
import styles from './schedule.module.css'

export default function StaffSchedulePage() {
    const [staffId, setStaffId] = useState('')
    const [zones, setZones] = useState<any[]>([])
    const [schedules, setSchedules] = useState<any[]>([])
    const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
    const [selectedZone, setSelectedZone] = useState('')
    const [saving, setSaving] = useState(false)
    const [pendingSlots, setPendingSlots] = useState<Record<string, Record<string, string>>>({}) // { "date_slot": { "zone_id": "work_type" } }

    useEffect(() => {
        const data = JSON.parse(localStorage.getItem('staff_data') || '{}')
        setStaffId(data.id || '')
    }, [])

    useEffect(() => {
        if (!staffId) return
        supabase.from('staff').select('branch_id').eq('id', staffId).single().then(({ data }) => {
            if (data) {
                supabase.from('zones').select('*').eq('branch_id', data.branch_id).eq('is_active', true).then(({ data: z }) => {
                    setZones(z || [])
                    if (z && z.length > 0) setSelectedZone(z[0].id)
                })
            }
        })
    }, [staffId])

    const load = useCallback(async () => {
        if (!staffId) return
        const start = format(weekStart, 'yyyy-MM-dd')
        const end = format(addDays(weekStart, 6), 'yyyy-MM-dd')
        const { data } = await supabase.from('staff_schedules').select('*').eq('staff_id', staffId).gte('date', start).lte('date', end)
        setSchedules(data || [])
    }, [staffId, weekStart])

    useEffect(() => { load() }, [load])

    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

    const getSchedules = (date: Date, slot: string) => {
        const d = format(date, 'yyyy-MM-dd')
        return schedules.filter(s => s.date === d && (s.time_slot === slot || s.time_slot?.startsWith(slot)))
    }

    const isPending = (date: Date, slot: string) => !!pendingSlots[`${format(date, 'yyyy-MM-dd')}_${slot}`]?.[selectedZone]

    const toggleSlot = (date: Date, slot: string) => {
        if (!selectedZone) return alert('กรุณาเลือกโซนก่อนลงเวลา')
        const key = `${format(date, 'yyyy-MM-dd')}_${slot}`
        const existingList = getSchedules(date, slot)

        if (existingList.some(s => s.zone_id === selectedZone && s.is_booked)) return

        setPendingSlots(prev => {
            const next = { ...prev }
            const currentSlotZones = { ...(next[key] || {}) }

            // Logic: 
            // 1. One zone must be the "Base" (in_zone or the first out_of_zone)
            // 2. Base Cycle: None -> 🏠 (in_zone) -> 🏠🚀 (out_of_zone) -> None
            // 3. Secondary Cycle: None -> 🌐 (cross_zone) -> 🌐🚀 (out_of_zone) -> None

            const baseZoneId = existingList.find(s => !s.work_type || s.work_type === 'in_zone')?.zone_id
                || Object.keys(currentSlotZones).find(zId => currentSlotZones[zId] === 'in_zone')
                || existingList[0]?.zone_id
                || Object.keys(currentSlotZones)[0]

            const isCurrentBase = !baseZoneId || baseZoneId === selectedZone
            const currentType = currentSlotZones[selectedZone]

            if (isCurrentBase) {
                // Base Cycle: None -> in_zone -> out_of_zone -> None
                if (!currentType) {
                    currentSlotZones[selectedZone] = 'in_zone'
                } else if (currentType === 'in_zone') {
                    currentSlotZones[selectedZone] = 'out_of_zone'
                } else {
                    delete currentSlotZones[selectedZone]
                }
            } else {
                // Secondary Cycle: None -> cross_zone -> out_of_zone -> None
                if (!currentType) {
                    currentSlotZones[selectedZone] = 'cross_zone'
                } else if (currentType === 'cross_zone') {
                    currentSlotZones[selectedZone] = 'out_of_zone'
                } else {
                    delete currentSlotZones[selectedZone]
                }
            }

            // Consistency Check: If not empty, ensure exactly one zone exists as a base (not cross_zone)
            const finalZoneIds = Object.keys(currentSlotZones)
            if (finalZoneIds.length > 0) {
                const hasPrimary = finalZoneIds.some(zId => currentSlotZones[zId] === 'in_zone' || currentSlotZones[zId] === 'out_of_zone')
                // Wait, if all are cross_zone (which shouldn't happen by cycle), promote one.
                const primaryCount = finalZoneIds.filter(zId => currentSlotZones[zId] === 'in_zone' || (currentSlotZones[zId] === 'out_of_zone' && zId === finalZoneIds[0])).length

                // If the only zone was deleted, we're fine. 
                // If we have zones but no 'in_zone', and we want a base, we ensure the FIRST one is either in_zone or out_of_zone
                if (!finalZoneIds.some(zId => currentSlotZones[zId] === 'in_zone' || (currentSlotZones[zId] === 'out_of_zone' && zId === baseZoneId))) {
                    // This part is tricky. Let's just make it simpler:
                    // If there are assignments, and none is 'in_zone', make the first one 'in_zone' if it was 'cross_zone'
                    if (!finalZoneIds.some(zId => currentSlotZones[zId] === 'in_zone')) {
                        const firstId = finalZoneIds[0]
                        if (currentSlotZones[firstId] === 'cross_zone') currentSlotZones[firstId] = 'in_zone'
                        // if it's already out_of_zone, it's effectively 🏠🚀
                    }
                }
            }

            if (Object.keys(currentSlotZones).length === 0) delete next[key]
            else next[key] = currentSlotZones

            return next
        })
    }

    const save = async () => {
        const keys = Object.keys(pendingSlots)
        if (keys.length === 0) return
        setSaving(true)

        const slots: any[] = []
        keys.forEach(key => {
            const [date, time_slot] = key.split('_')
            const zoneTypes = pendingSlots[key]
            Object.entries(zoneTypes).forEach(([zone_id, work_type]) => {
                slots.push({ date, time_slot, zone_id, staff_id: staffId, work_type, is_booked: false })
            })
        })

        if (localStorage.getItem('foami_mock_db_enabled') === 'true') {
            await supabase.from('staff_schedules').upsert(slots)
        } else {
            const res = await fetch('/api/schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ staff_id: staffId, slots }),
            })
            if (!res.ok) {
                const err = await res.json()
                alert(`ไม่สามารถบันทึกได้: ${err.error || 'Unknown error'}`)
                setSaving(false)
                return
            }
        }

        setPendingSlots({})
        setSaving(false)
        load()
    }

    const removeSlot = async (id: string) => {
        if (localStorage.getItem('foami_mock_db_enabled') === 'true') {
            await supabase.from('staff_schedules').delete().eq('id', id)
        } else {
            await fetch('/api/schedules', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
        }
        load()
    }

    return (
        <div className="animate-fade">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
                <h1 className={styles.title} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Calendar size={28} className="text-primary" /> ตารางเวลา
                </h1>
                <div style={{ display: 'flex', gap: 12 }}>
                    <button className="btn btn-ghost btn-sm" style={{ padding: 8 }} onClick={() => setWeekStart(d => addDays(d, -7))}><ChevronLeft size={20} /></button>
                    <button className="btn btn-ghost btn-sm" style={{ padding: 8 }} onClick={() => setWeekStart(d => addDays(d, 7))}><ChevronRight size={20} /></button>
                </div>
            </div>

            <div className={styles.zoneRow}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>โซน:</span>
                {zones.map(z => (
                    <button key={z.id} className={`btn btn-sm ${selectedZone === z.id ? 'btn-primary' : 'btn-outline'}`} onClick={() => setSelectedZone(z.id)}>
                        {z.name}
                    </button>
                ))}
            </div>

            <div className={styles.helpRow} style={{ marginTop: 10, display: 'flex', gap: 15, flexWrap: 'wrap' }}>
                <span className={styles.typeBadge} style={{ background: 'var(--brand-dominant-ghost)', color: 'var(--brand-dominant)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Home size={12} /> แค่ในโซน
                </span>
                <span className={styles.typeBadge} style={{ background: 'var(--brand-subordinate-ghost)', color: 'var(--brand-subordinate)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Globe size={12} /> ข้ามโซน
                </span>
                <span className={styles.typeBadge} style={{ background: 'var(--brand-accent-ghost)', color: 'var(--brand-accent)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Rocket size={12} /> นอกโซน
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Info size={14} /> แตะที่ช่องเดิมซ้ำๆ เพื่อเปลี่ยนประเภทงาน
                </span>
            </div>

            <p className={styles.weekLabel}>สัปดาห์ {format(weekStart, 'd MMM', { locale: th })} – {format(addDays(weekStart, 6), 'd MMM yyyy', { locale: th })}</p>

            <div className={styles.grid}>
                {/* Header */}
                <div className={styles.cornerCell} />
                {days.map(d => (
                    <div key={d.toString()} className={`${styles.dayHeader} ${format(d, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') ? styles.today : ''}`}>
                        <div>{format(d, 'EEE', { locale: th })}</div>
                        <div className={styles.dayNum}>{format(d, 'd')}</div>
                    </div>
                ))}

                {/* Slots */}
                {TIME_SLOTS.map(slot => (
                    <React.Fragment key={slot}>
                        <div className={styles.timeLabel}>{slot}</div>
                        {days.map(d => {
                            const existingList = getSchedules(d, slot)
                            const pendingForSlot = pendingSlots[`${format(d, 'yyyy-MM-dd')}_${slot}`] || {}
                            const hasPending = Object.keys(pendingForSlot).length > 0
                            const isPast = new Date(`${format(d, 'yyyy-MM-dd')}T${slot}`) < new Date()
                            const isBooked = existingList.some(s => s.is_booked)

                            // Combine all zones (saved + pending) to display
                            const displayZones = [
                                ...existingList.map(s => ({
                                    id: s.id,
                                    zone_id: s.zone_id,
                                    status: s.is_booked ? 'booked' : 'saved',
                                    work_type: pendingSlots[`${format(d, 'yyyy-MM-dd')}_${slot}`]?.[s.zone_id] || s.work_type || 'in_zone'
                                })),
                                ...Object.entries(pendingSlots[`${format(d, 'yyyy-MM-dd')}_${slot}`] || {})
                                    .filter(([zId]) => !existingList.some(s => s.zone_id === zId))
                                    .map(([zId, wType]) => ({ id: `pend-${zId}`, zone_id: zId, status: 'pending', work_type: wType }))
                            ]

                            return (
                                <div
                                    key={`${format(d, 'yyyy-MM-dd')}-${slot}`}
                                    className={`${styles.cell} ${isBooked ? styles.booked : existingList.length > 0 ? styles.available : hasPending ? styles.pending : ''} ${isPast ? styles.past : ''}`}
                                    onClick={() => !isPast && !isBooked && toggleSlot(d, slot)}
                                >
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, padding: 2, alignItems: 'flex-start', justifyContent: 'center' }}>
                                        {displayZones.map((dz, idx) => {
                                            const zObj = zones.find(z => z.id === dz.zone_id)
                                            if (!zObj) return null
                                            const displayName = zObj.name

                                            // Determine context for out_of_zone
                                            const hasInZone = displayZones.some(z => z.work_type === 'in_zone')
                                            const isPrimary = dz.work_type === 'in_zone' || (dz.work_type === 'out_of_zone' && !hasInZone && idx === 0)

                                            const Icons = []
                                            let color = 'var(--brand-dominant)'
                                            let bg = 'var(--brand-dominant-ghost)'

                                            if (dz.work_type === 'in_zone') {
                                                Icons.push(Home)
                                            } else if (dz.work_type === 'cross_zone') {
                                                Icons.push(Globe)
                                                color = 'var(--brand-subordinate)'
                                                bg = 'var(--brand-subordinate-ghost)'
                                            } else if (dz.work_type === 'out_of_zone') {
                                                if (isPrimary) {
                                                    Icons.push(Home, Rocket)
                                                } else {
                                                    Icons.push(Globe, Rocket)
                                                    color = 'var(--brand-subordinate)'
                                                    bg = 'var(--brand-subordinate-ghost)'
                                                }
                                                color = 'var(--brand-accent)'
                                                bg = 'var(--brand-accent-ghost)'
                                            }

                                            return (
                                                <div key={dz.id} style={{
                                                    fontSize: '0.65rem', lineHeight: 1.2, padding: '2px 4px', borderRadius: 4,
                                                    backgroundColor: dz.status === 'booked' ? 'rgba(255,255,255,0.2)' : bg,
                                                    color: dz.status === 'booked' ? 'white' : color,
                                                    display: 'flex', alignItems: 'center', gap: 2,
                                                    maxWidth: '100%',
                                                    overflow: 'hidden',
                                                    whiteSpace: 'nowrap',
                                                    border: dz.status === 'pending' ? `1px dashed ${color}` : 'none',
                                                    textOverflow: 'ellipsis'
                                                }}>
                                                    <span style={{ display: 'flex', gap: 1 }}>
                                                        {Icons.map((Icon, i) => <Icon key={i} size={10} />)}
                                                    </span>
                                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayName}</span>
                                                    {dz.status === 'saved' && (
                                                        <span onClick={e => { e.stopPropagation(); removeSlot(dz.id) }} style={{ cursor: 'pointer', opacity: 0.6, fontSize: '0.5rem', flexShrink: 0 }}>✕</span>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )
                        })}
                    </React.Fragment>
                ))}
            </div>

            {Object.keys(pendingSlots).length > 0 && (
                <div className={styles.saveBar}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Info size={20} />
                        <span>เลือกไว้ {Object.values(pendingSlots).reduce((acc, curr) => acc + Object.keys(curr).length, 0)} ช่อง</span>
                    </div>
                    <button className="btn btn-primary" onClick={save} disabled={saving} style={{ background: 'white', color: 'var(--brand-dominant)', border: 'none', fontWeight: 800 }}>
                        {saving ? <span className="spinner" /> : <><Save size={18} /> บันทึก</>}
                    </button>
                </div>
            )}

            <div style={{ height: 100 }} />

            <div className={styles.legend}>
                <span className={styles.legendItem}><span className={`${styles.dot} ${styles.available}`} /> ลงเวลาแล้ว</span>
                <span className={styles.legendItem}><span className={`${styles.dot} ${styles.booked}`} /> มีงาน</span>
                <span className={styles.legendItem}><span className={`${styles.dot} ${styles.pending}`} /> รอบันทึก</span>
            </div>
        </div>
    )
}
