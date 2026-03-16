'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { TIME_SLOTS } from '@/lib/types'
import { addDays, format, startOfWeek } from 'date-fns'
import { th } from 'date-fns/locale'
import { Calendar, ChevronLeft, ChevronRight, Save, X, Info } from 'lucide-react'
import styles from './schedule.module.css'

export default function StaffSchedulePage() {
    const [staffId, setStaffId] = useState('')
    const [zones, setZones] = useState<any[]>([])
    const [schedules, setSchedules] = useState<any[]>([])
    const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
    const [selectedZone, setSelectedZone] = useState('')
    const [saving, setSaving] = useState(false)
    const [pendingSlots, setPendingSlots] = useState<Record<string, string[]>>({})

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
        return schedules.filter(s => s.date === d && s.time_slot === slot)
    }

    const isPending = (date: Date, slot: string) => (pendingSlots[`${format(date, 'yyyy-MM-dd')}_${slot}`] || []).includes(selectedZone)

    const toggleSlot = (date: Date, slot: string) => {
        if (!selectedZone) return alert('กรุณาเลือกโซนก่อนลงเวลา')
        const key = `${format(date, 'yyyy-MM-dd')}_${slot}`
        const existingList = getSchedules(date, slot)

        // If the selected zone is already in the database for this slot, do nothing
        if (existingList.some(s => s.zone_id === selectedZone)) return

        setPendingSlots(prev => {
            const next = { ...prev }
            const currentZones = next[key] || []

            if (currentZones.includes(selectedZone)) {
                // Remove it
                next[key] = currentZones.filter(z => z !== selectedZone)
                if (next[key].length === 0) delete next[key]
            } else {
                // Add it
                next[key] = [...currentZones, selectedZone]
            }
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
            pendingSlots[key].forEach(zone_id => {
                slots.push({ date, time_slot, zone_id, staff_id: staffId, is_booked: false })
            })
        })

        if (localStorage.getItem('foami_mock_db_enabled') === 'true') {
            await supabase.from('staff_schedules').upsert(slots)
        } else {
            await fetch('/api/schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ staff_id: staffId, slots }),
            })
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
                            const pendingList = pendingSlots[`${format(d, 'yyyy-MM-dd')}_${slot}`] || []
                            const isPast = new Date(`${format(d, 'yyyy-MM-dd')}T${slot}`) < new Date()
                            const isBooked = existingList.some(s => s.is_booked)

                            // Combine all zones (saved + pending) to display
                            const displayZones = [
                                ...existingList.map(s => ({ id: s.id, zone_id: s.zone_id, status: s.is_booked ? 'booked' : 'saved' })),
                                ...pendingList.map(zId => ({ id: `pend-${zId}`, zone_id: zId, status: 'pending' }))
                            ]

                            return (
                                <div
                                    key={`${format(d, 'yyyy-MM-dd')}-${slot}`}
                                    className={`${styles.cell} ${isBooked ? styles.booked : existingList.length > 0 ? styles.available : pendingList.length > 0 ? styles.pending : ''} ${isPast ? styles.past : ''}`}
                                    onClick={() => !isPast && !isBooked && toggleSlot(d, slot)}
                                >
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, padding: 2, height: '100%', alignItems: 'flex-start', justifyContent: 'center', overflow: 'hidden' }}>
                                        {displayZones.map(dz => {
                                            const zObj = zones.find(z => z.id === dz.zone_id)
                                            if (!zObj) return null
                                            // Removing aggressive JS truncation in favor of CSS ellipsis
                                            const displayName = zObj.name
                                            return (
                                                <div key={dz.id} style={{
                                                    fontSize: '0.65rem', lineHeight: 1.2, padding: '2px 4px', borderRadius: 4,
                                                    backgroundColor: dz.status === 'booked' ? 'var(--gray-200)' : dz.status === 'pending' ? 'var(--orange-100)' : 'var(--blue-100)',
                                                    color: dz.status === 'booked' ? 'var(--gray-600)' : dz.status === 'pending' ? 'var(--orange-700)' : 'var(--blue-700)',
                                                    display: 'flex', alignItems: 'center', gap: 2,
                                                    maxWidth: '100%',
                                                    overflow: 'hidden',
                                                    whiteSpace: 'nowrap',
                                                    textOverflow: 'ellipsis'
                                                }}>
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
                        <span>เลือกไว้ {Object.keys(pendingSlots).length} ช่อง</span>
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
