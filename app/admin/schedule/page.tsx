'use client'
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { TIME_SLOTS } from '@/lib/types'
import { addDays, format, startOfWeek } from 'date-fns'
import { th } from 'date-fns/locale'
import { Calendar, ChevronLeft, ChevronRight, MapPin, Layers } from 'lucide-react'
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
            .select('id, staff_id, zone_id, date, time_slot, is_booked')
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
                                    <div key={key} className={styles.cell} style={{ opacity: isPast ? 0.6 : 1 }}>
                                        <div className={styles.staffList}>
                                            {cellSchedules.map(cs => {
                                                const staffInfo = staffList.find(st => st.id === cs.staff_id)
                                                if (!staffInfo) return null
                                                // Take first name or first 8 chars max
                                                const shortName = staffInfo.full_name.split(' ')[0]

                                                return (
                                                    <div key={cs.id} className={`${styles.staffPill} ${cs.is_booked ? styles['status-booked'] : styles['status-available']}`} title={`${staffInfo.full_name} (${cs.is_booked ? 'มีงาน' : 'ว่าง'})`}>
                                                        <span>{shortName}</span>
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
