'use client'
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { TIME_SLOTS } from '@/lib/types'
import { addDays, format, startOfWeek } from 'date-fns'
import { th } from 'date-fns/locale'
import { Calendar, ChevronLeft, ChevronRight, MapPin, Layers, Home, Globe, Rocket } from 'lucide-react'
import styles from './schedule.module.css'

export default function AdminSchedulePage() {
    const [branches, setBranches] = useState<any[]>([])
    const [zones, setZones] = useState<any[]>([])
    const [staffList, setStaffList] = useState<any[]>([])
    const [schedules, setSchedules] = useState<any[]>([])

    const [selectedBranchId, setSelectedBranchId] = useState<string>('')
    const [selectedZoneId, setSelectedZoneId] = useState<string>('')
    const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
    const [loading, setLoading] = useState(true)

    // Load static data
    useEffect(() => {
        Promise.all([
            supabase.from('branches').select('*').eq('is_active', true),
            supabase.from('zones').select('*').eq('is_active', true),
            supabase.from('staff').select('id, full_name, branch_id').eq('is_active', true)
        ]).then(([{ data: br }, { data: zn }, { data: st }]) => {
            if (br) {
                setBranches(br)
                if (br.length > 0) setSelectedBranchId(br[0].id)
            }
            if (zn) setZones(zn)
            if (st) setStaffList(st)
        })
    }, [])

    // Ensure zone resets to 'all' or a valid one when branch changes
    useEffect(() => {
        if (!selectedBranchId) return
        const branchZones = zones.filter(z => z.branch_id === selectedBranchId)
        if (branchZones.length > 0 && !branchZones.find(z => z.id === selectedZoneId)) {
            setSelectedZoneId('') // '' means all zones in branch
        }
    }, [selectedBranchId, zones, selectedZoneId])

    // Load schedules based on week + branch (and optional zone)
    const loadSchedules = useCallback(async () => {
        if (!selectedBranchId) return
        setLoading(true)
        const start = format(weekStart, 'yyyy-MM-dd')
        const end = format(addDays(weekStart, 6), 'yyyy-MM-dd')

        // We fetch all schedules in the date range. To filter by branch/zone, we examine the staff or the zone_id.
        // It's easier to fetch schedules linked to the active branch's zones.
        const activeZones = selectedZoneId
            ? [selectedZoneId]
            : zones.filter(z => z.branch_id === selectedBranchId).map(z => z.id)

        if (activeZones.length === 0) {
            setSchedules([])
            setLoading(false)
            return
        }

        const { data } = await supabase
            .from('staff_schedules')
            .select('id, staff_id, zone_id, date, time_slot, is_booked, work_type')
            .in('zone_id', activeZones)
            .gte('date', start)
            .lte('date', end)

        setSchedules(data || [])
        setLoading(false)
    }, [selectedBranchId, selectedZoneId, weekStart, zones])

    useEffect(() => { loadSchedules() }, [loadSchedules])

    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

    // Pre-process schedules for O(1) rendering lookups
    // Map: date_timeSlot -> Array of Schedule objects
    const gridData = useMemo(() => {
        const map: Record<string, any[]> = {}
        for (const s of schedules) {
            // Postgres TIME might be 09:00:00, slice to 09:00 to match slot format
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
                </h1>
            </div>

            <div className={styles.filters}>
                <div className={styles.filterGroup}>
                    <span className={styles.filterLabel} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <MapPin size={14} /> สาขา:
                    </span>
                    <select className="form-input" style={{ width: 160, padding: '6px 12px', borderRadius: '10px' }} value={selectedBranchId} onChange={e => setSelectedBranchId(e.target.value)}>
                        {branches.map(b => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                    </select>
                </div>

                <div className={styles.filterGroup}>
                    <span className={styles.filterLabel} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Layers size={14} /> โซน:
                    </span>
                    <select className="form-input" style={{ width: 160, padding: '6px 12px', borderRadius: '10px' }} value={selectedZoneId} onChange={e => setSelectedZoneId(e.target.value)}>
                        <option value="">ทุกโซนในสาขา</option>
                        {zones.filter(z => z.branch_id === selectedBranchId).map(z => (
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
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#10b981' }} /> มีงาน (สีเขียว)
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#8fa89b' }} /> มีงานแต่ผ่านมาแล้ว (สีเขียวเทา)
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: 'var(--surface-2)', border: '1px solid var(--border)' }} /> ผ่านมาแล้ว (สีเทา)
                </span>
            </div>

            {loading ? (
                <div className={styles.loadingEmpty}>กำลังโหลดขัอมูล... <span className="spinner" style={{ marginLeft: 8 }} /></div>
            ) : (
                <div className={styles.grid}>
                    {/* Header Row */}
                    <div className={styles.cornerCell} />
                    {days.map(d => (
                        <div key={d.toString()} className={`${styles.dayHeader} ${format(d, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') ? styles.today : ''}`}>
                            <div>{format(d, 'EEE', { locale: th })}</div>
                            <div className={styles.dayNum}>{format(d, 'd')}</div>
                        </div>
                    ))}

                    {/* Time Slots */}
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
                                                        acc[cs.staff_id] = { staff_id: cs.staff_id, is_booked: cs.is_booked, zones: [{ zone_id: cs.zone_id, work_type: cs.work_type }] };
                                                    } else {
                                                        if (!acc[cs.staff_id].zones.find((z: any) => z.zone_id === cs.zone_id)) {
                                                            acc[cs.staff_id].zones.push({ zone_id: cs.zone_id, work_type: cs.work_type });
                                                        }
                                                        if (cs.is_booked) acc[cs.staff_id].is_booked = true;
                                                    }
                                                    return acc;
                                                }, {} as Record<string, any>)
                                            ).map((cs: any) => {
                                                const staffInfo = staffList.find(st => st.id === cs.staff_id)
                                                if (!staffInfo) return null
                                                // Take first name or first 8 chars max
                                                const shortName = staffInfo.full_name.split(' ')[0]

                                                let pillClass = styles['status-available']
                                                if (isPast && cs.is_booked) pillClass = styles['status-past-booked']
                                                else if (isPast && !cs.is_booked) pillClass = styles['status-past-available']
                                                else if (!isPast && cs.is_booked) pillClass = styles['status-booked']

                                                return (
                                                    <div key={cs.staff_id} className={`${styles.staffPill} ${pillClass}`}>
                                                        <span style={{ fontWeight: 800 }}>{shortName}</span>
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginTop: 2 }}>
                                                            {cs.zones.map((zInfo: any, idx: number) => {
                                                                const zObj = zones.find(z => z.id === zInfo.zone_id)
                                                                if (!zObj) return null
                                                                const displayName = zObj.name
                                                                
                                                                const hasInZone = cs.zones.some((z: any) => z.work_type === 'in_zone')
                                                                const isPrimary = zInfo.work_type === 'in_zone' || (zInfo.work_type === 'out_of_zone' && !hasInZone && idx === 0)
                                                                
                                                                const Icons = []
                                                                let color = 'var(--brand-dominant)'
                                                                let bg = 'var(--brand-dominant-ghost)'

                                                                const wType = zInfo.work_type || 'in_zone'

                                                                if (wType === 'in_zone') {
                                                                    Icons.push(Home)
                                                                } else if (wType === 'cross_zone') {
                                                                    Icons.push(Globe)
                                                                    color = 'var(--brand-subordinate)'
                                                                    bg = 'var(--brand-subordinate-ghost)'
                                                                } else if (wType === 'out_of_zone') {
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

                                                                let tagBg = bg
                                                                let tagColor = color
                                                                if (cs.is_booked) {
                                                                    tagBg = 'rgba(255,255,255,0.25)'
                                                                    tagColor = 'white'
                                                                } else if (isPast) {
                                                                    tagBg = 'rgba(0,0,0,0.06)'
                                                                    tagColor = 'var(--text-muted)'
                                                                }

                                                                return (
                                                                    <div key={zInfo.zone_id} style={{
                                                                        fontSize: '0.65rem', lineHeight: 1.2, padding: '2px 4px', borderRadius: 4,
                                                                        backgroundColor: tagBg,
                                                                        color: tagColor,
                                                                        display: 'flex', alignItems: 'center', gap: 2,
                                                                        maxWidth: '100%',
                                                                        overflow: 'hidden',
                                                                        whiteSpace: 'nowrap',
                                                                        textOverflow: 'ellipsis'
                                                                    }} title={`${displayName} (${wType})`}>
                                                                        <span style={{ display: 'flex', gap: 1 }}>
                                                                            {Icons.map((Icon, i) => <Icon key={i} size={10} />)}
                                                                        </span>
                                                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayName}</span>
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
