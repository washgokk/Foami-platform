'use client'
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { TIME_SLOTS } from '@/lib/types'
import { addDays, format, startOfWeek } from 'date-fns'
import { th } from 'date-fns/locale'
import { Calendar, ChevronLeft, ChevronRight, MapPin, Layers, Home, Globe, Rocket } from 'lucide-react'
import styles from '@/app/admin/schedule/schedule.module.css'

// B5 FIX: Shop-specific schedule page — locked to current branchSlug
// Does NOT import the platform /admin/schedule page (which shows all branches)
export default function ShopSchedulePage() {
    const params = useParams()
    const branchSlug = params?.branchSlug as string

    const [branch, setBranch] = useState<any>(null)
    const [zones, setZones] = useState<any[]>([])
    const [staffList, setStaffList] = useState<any[]>([])
    const [schedules, setSchedules] = useState<any[]>([])
    const [selectedZoneId, setSelectedZoneId] = useState<string>('')
    const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
    const [loading, setLoading] = useState(true)

    // Load static data — filtered to THIS branch only
    useEffect(() => {
        if (!branchSlug) return
        Promise.all([
            supabase.from('branches').select('*').eq('slug', branchSlug).eq('is_active', true).maybeSingle(),
            supabase.from('zones').select('*').eq('is_active', true),
            supabase.from('staff').select('id, full_name, branch_id').eq('is_active', true)
        ]).then(([{ data: br }, { data: zn }, { data: st }]) => {
            if (br) {
                setBranch(br)
                // Filter zones and staff to this branch only
                if (zn) setZones(zn.filter((z: any) => z.branch_id === br.id))
                if (st) setStaffList(st.filter((s: any) => s.branch_id === br.id))
            }
        })
    }, [branchSlug])

    // Load schedules based on week + this branch's zones
    const loadSchedules = useCallback(async () => {
        if (!branch) return
        setLoading(true)
        const start = format(weekStart, 'yyyy-MM-dd')
        const end = format(addDays(weekStart, 6), 'yyyy-MM-dd')

        const branchZoneIds = selectedZoneId
            ? [selectedZoneId]
            : zones.map(z => z.id)

        if (branchZoneIds.length === 0) {
            setSchedules([])
            setLoading(false)
            return
        }

        const { data } = await supabase
            .from('staff_schedules')
            .select('id, staff_id, zone_id, date, time_slot, is_booked, work_type')
            .in('zone_id', branchZoneIds)
            .gte('date', start)
            .lte('date', end)

        setSchedules(data || [])
        setLoading(false)
    }, [branch, selectedZoneId, weekStart, zones])

    useEffect(() => { loadSchedules() }, [loadSchedules])

    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

    const gridData = useMemo(() => {
        const map: Record<string, any[]> = {}
        for (const s of schedules) {
            const timeKey = s.time_slot?.slice(0, 5) || s.time_slot
            const key = `${s.date}_${timeKey}`
            if (!map[key]) map[key] = []
            map[key].push(s)
        }
        return map
    }, [schedules])

    return (
        <div className="animate-fade">
            <div className={styles.header}>
                <h1 className={styles.title}>
                    <Calendar size={28} style={{ color: 'var(--brand-dominant)' }} /> ตารางงานพนักงาน
                    {branch && <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-muted)', marginLeft: 10 }}>— สาขา {branch.name}</span>}
                </h1>
            </div>

            <div className={styles.filters}>
                {/* Branch display — locked, no dropdown */}
                <div className={styles.filterGroup}>
                    <span className={styles.filterLabel} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <MapPin size={14} /> สาขา:
                    </span>
                    <span style={{
                        padding: '6px 14px', borderRadius: '10px', background: 'var(--brand-ghost)',
                        color: 'var(--brand)', fontWeight: 700, fontSize: '0.875rem'
                    }}>
                        {branch?.name || branchSlug}
                    </span>
                </div>

                <div className={styles.filterGroup}>
                    <span className={styles.filterLabel} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Layers size={14} /> โซน:
                    </span>
                    <select
                        className="form-input"
                        style={{ width: 160, padding: '6px 12px', borderRadius: '10px' }}
                        value={selectedZoneId}
                        onChange={e => setSelectedZoneId(e.target.value)}
                    >
                        <option value="">ทุกโซนในสาขา</option>
                        {zones.map(z => (
                            <option key={z.id} value={z.id}>{z.name}</option>
                        ))}
                    </select>
                </div>

                <div style={{ flex: 1 }} />

                <div className={styles.weekControl}>
                    <button className="btn btn-ghost btn-sm" style={{ borderRadius: 8 }} onClick={() => setWeekStart(d => addDays(d, -7))}>
                        <ChevronLeft size={18} />
                    </button>
                    <div className={styles.weekLabel}>
                        {format(weekStart, 'd MMM', { locale: th })} – {format(addDays(weekStart, 6), 'd MMM yy', { locale: th })}
                    </div>
                    <button className="btn btn-ghost btn-sm" style={{ borderRadius: 8 }} onClick={() => setWeekStart(d => addDays(d, 7))}>
                        <ChevronRight size={18} />
                    </button>
                </div>
            </div>

            <div style={{ display: 'flex', gap: 15, flexWrap: 'wrap', marginBottom: 'var(--space-4)', padding: '0 var(--space-2)' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Home size={14} color="var(--brand-dominant)" /> แค่ในโซน
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Globe size={14} color="var(--brand-subordinate)" /> ข้ามโซน
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Rocket size={14} color="var(--brand-accent)" /> นอกโซน
                </span>
            </div>

            {loading ? (
                <div className={styles.loadingEmpty}>กำลังโหลดตารางงาน... <span className="spinner" style={{ marginLeft: 8 }} /></div>
            ) : zones.length === 0 ? (
                <div className={styles.loadingEmpty} style={{ color: 'var(--text-muted)' }}>ยังไม่มีโซนในสาขานี้</div>
            ) : (
                <div className={styles.grid}>
                    <div className={styles.cornerCell} />
                    {days.map(d => (
                        <div key={d.toString()} className={`${styles.dayHeader} ${format(d, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') ? styles.today : ''}`}>
                            <div>{format(d, 'EEE', { locale: th })}</div>
                            <div className={styles.dayNum}>{format(d, 'd')}</div>
                        </div>
                    ))}
                    {TIME_SLOTS.map(slot => (
                        <React.Fragment key={slot}>
                            <div className={styles.timeLabel}>{slot}</div>
                            {days.map(d => {
                                const dateStr = format(d, 'yyyy-MM-dd')
                                const key = `${dateStr}_${slot}`
                                const cellSchedules = gridData[key] || []
                                const isPast = new Date(`${dateStr}T${slot}`) < new Date()
                                return (
                                    <div key={key} className={styles.cell} style={{ opacity: isPast ? 0.7 : 1 }}>
                                        <div className={styles.staffList}>
                                            {Object.values(
                                                cellSchedules.reduce((acc, cs) => {
                                                    if (!acc[cs.staff_id]) {
                                                        acc[cs.staff_id] = { staff_id: cs.staff_id, is_booked: cs.is_booked, zones: [{ zone_id: cs.zone_id, work_type: cs.work_type }] }
                                                    } else {
                                                        if (!acc[cs.staff_id].zones.find((z: any) => z.zone_id === cs.zone_id)) {
                                                            acc[cs.staff_id].zones.push({ zone_id: cs.zone_id, work_type: cs.work_type })
                                                        }
                                                        if (cs.is_booked) acc[cs.staff_id].is_booked = true
                                                    }
                                                    return acc
                                                }, {} as Record<string, any>)
                                            ).map((cs: any) => {
                                                const staffInfo = staffList.find(st => st.id === cs.staff_id)
                                                if (!staffInfo) return null
                                                const shortName = staffInfo.full_name.split(' ')[0]
                                                let pillClass = styles['status-available']
                                                if (isPast && cs.is_booked) pillClass = styles['status-past-booked']
                                                else if (isPast && !cs.is_booked) pillClass = styles['status-past-available']
                                                else if (!isPast && cs.is_booked) pillClass = styles['status-booked']
                                                return (
                                                    <div key={cs.staff_id} className={`${styles.staffPill} ${pillClass}`}>
                                                        <span style={{ fontWeight: 800 }}>{shortName}</span>
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginTop: 2 }}>
                                                            {cs.zones.map((zInfo: any) => {
                                                                const zObj = zones.find(z => z.id === zInfo.zone_id)
                                                                if (!zObj) return null
                                                                const wType = zInfo.work_type || 'in_zone'
                                                                const Icons = wType === 'cross_zone' ? [Globe] : wType === 'out_of_zone' ? [Rocket] : [Home]
                                                                const color = wType === 'cross_zone' ? 'var(--brand-subordinate)' : wType === 'out_of_zone' ? 'var(--brand-accent)' : 'var(--brand-dominant)'
                                                                return (
                                                                    <div key={zInfo.zone_id} style={{
                                                                        fontSize: '0.65rem', padding: '2px 4px', borderRadius: 4,
                                                                        background: cs.is_booked ? 'rgba(255,255,255,0.25)' : isPast ? 'rgba(0,0,0,0.06)' : 'var(--brand-dominant-ghost)',
                                                                        color: cs.is_booked ? 'white' : isPast ? 'var(--text-muted)' : color,
                                                                        display: 'flex', alignItems: 'center', gap: 2, whiteSpace: 'nowrap'
                                                                    }}>
                                                                        {Icons.map((Icon, i) => <Icon key={i} size={10} />)}
                                                                        <span>{zObj.name}</span>
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
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
            )}
        </div>
    )
}
