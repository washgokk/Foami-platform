'use client'
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { TIME_SLOTS } from '@/lib/types'
import { addDays, format, startOfWeek } from 'date-fns'
import { th } from 'date-fns/locale'
import {
  Calendar, ChevronLeft, ChevronRight, Save, Check, X,
  Clock, Sparkles, Sun, Sunset
} from 'lucide-react'

export default function StaffScheduleComponent() {
  const params = useParams()
  const branchSlug = (params?.branchSlug as string) || ''

  const [staffId, setStaffId] = useState('')
  const [branch, setBranch] = useState<any>(null)
  const [zones, setZones] = useState<any[]>([])
  const [schedules, setSchedules] = useState<any[]>([])
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // pendingSlots: Record<"YYYY-MM-DD_HH:MM", boolean> where true = Available, false = Off
  const [pendingSlots, setPendingSlots] = useState<Record<string, boolean>>({})

  // Drag-to-select states
  const [isDragging, setIsDragging] = useState(false)
  const dragModeRef = useRef<'add' | 'remove'>('add')

  // Load staff & branch
  useEffect(() => {
    const data = JSON.parse(localStorage.getItem('staff_data') || '{}')
    if (data?.id) setStaffId(data.id)

    let bQuery = supabase.from('branches').select('*')
    if (branchSlug) {
      bQuery = bQuery.eq('slug', branchSlug)
    }
    bQuery.limit(1).maybeSingle().then(({ data: b }) => {
      if (b) {
        setBranch(b)
        supabase.from('zones').select('*').eq('branch_id', b.id).eq('is_active', true).then(({ data: z }) => {
          setZones(z || [])
        })
      }
    })
  }, [branchSlug])

  // Window mouseup listener to stop drag
  useEffect(() => {
    const handleMouseUp = () => setIsDragging(false)
    window.addEventListener('mouseup', handleMouseUp)
    return () => window.removeEventListener('mouseup', handleMouseUp)
  }, [])

  const loadSchedules = useCallback(async () => {
    if (!staffId) return
    const start = format(weekStart, 'yyyy-MM-dd')
    const end = format(addDays(weekStart, 6), 'yyyy-MM-dd')
    const { data } = await supabase
      .from('staff_schedules')
      .select('*')
      .eq('staff_id', staffId)
      .gte('date', start)
      .lte('date', end)
    setSchedules(data || [])
    setPendingSlots({})
  }, [staffId, weekStart])

  useEffect(() => { loadSchedules() }, [loadSchedules])

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const getDbSlot = (dateKey: string, slot: string) => {
    return schedules.find(s => s.date === dateKey && (s.time_slot === slot || s.time_slot?.startsWith(slot)))
  }

  // Check if slot is active (either pending modified or in DB)
  const isSlotActive = (dateKey: string, slot: string) => {
    const key = `${dateKey}_${slot}`
    if (key in pendingSlots) return pendingSlots[key]
    const db = getDbSlot(dateKey, slot)
    return !!(db && !db.is_booked)
  }

  const isSlotBooked = (dateKey: string, slot: string) => {
    const db = getDbSlot(dateKey, slot)
    return !!(db && db.is_booked)
  }

  // Check if slot is in the past (locked)
  const isSlotPast = (dateKey: string, slot: string) => {
    const timePart = slot.length === 5 ? `${slot}:00` : slot
    return new Date(`${dateKey}T${timePart}`) < new Date()
  }

  // Toggle slot value
  const setSlotValue = (dateKey: string, slot: string, value: boolean) => {
    if (isSlotBooked(dateKey, slot) || isSlotPast(dateKey, slot)) return
    const key = `${dateKey}_${slot}`
    setPendingSlots(prev => ({ ...prev, [key]: value }))
  }

  // Desktop Drag handlers
  const handleCellMouseDown = (dateKey: string, slot: string, e: React.MouseEvent) => {
    if (e.button !== 0) return // Left click only
    if (isSlotBooked(dateKey, slot) || isSlotPast(dateKey, slot)) return
    const currentlyActive = isSlotActive(dateKey, slot)
    const newMode = currentlyActive ? 'remove' : 'add'
    dragModeRef.current = newMode
    setIsDragging(true)
    setSlotValue(dateKey, slot, newMode === 'add')
  }

  const handleCellMouseEnter = (dateKey: string, slot: string) => {
    if (!isDragging) return
    if (isSlotBooked(dateKey, slot) || isSlotPast(dateKey, slot)) return
    setSlotValue(dateKey, slot, dragModeRef.current === 'add')
  }

  // Quick Preset Handlers (Mobile & Desktop)
  const applyPreset = (type: 'morning' | 'afternoon' | 'full' | 'clear') => {
    const next = { ...pendingSlots }
    days.forEach(d => {
      const dateKey = format(d, 'yyyy-MM-dd')
      TIME_SLOTS.forEach(slot => {
        // Never allow applying presets to past slots or booked slots
        if (isSlotBooked(dateKey, slot) || isSlotPast(dateKey, slot)) return

        const hour = parseInt(slot.split(':')[0], 10)
        const key = `${dateKey}_${slot}`

        if (type === 'morning') {
          // 08:00 - 16:00
          if (hour >= 8 && hour < 16) next[key] = true
        } else if (type === 'afternoon') {
          // 12:00 - 20:00
          if (hour >= 12 && hour < 20) next[key] = true
        } else if (type === 'full') {
          // 08:00 - 20:00
          if (hour >= 8 && hour <= 20) next[key] = true
        } else if (type === 'clear') {
          next[key] = false
        }
      })
    })
    setPendingSlots(next)
  }

  const hasPendingChanges = Object.keys(pendingSlots).length > 0

  const save = async () => {
    if (!staffId) return alert('ไม่พบข้อมูลพนักงาน')
    const primaryZoneId = zones[0]?.id || branch?.id
    if (!primaryZoneId) return alert('ไม่พบข้อมูลโซนบริการของสาขา')

    setSaving(true)
    setSaveSuccess(false)

    const slotsToUpsert: any[] = []
    const idsToDelete: string[] = []

    // Process all pending slot keys
    Object.entries(pendingSlots).forEach(([key, isActive]) => {
      const [date, time_slot] = key.split('_')
      if (isSlotPast(date, time_slot)) return // Guard: Never modify past slots
      const existing = getDbSlot(date, time_slot)

      if (isActive) {
        if (!existing) {
          slotsToUpsert.push({
            date,
            time_slot,
            zone_id: primaryZoneId,
            staff_id: staffId,
            work_type: 'in_zone',
            is_booked: false
          })
        }
      } else {
        if (existing && !existing.is_booked) {
          idsToDelete.push(existing.id)
        }
      }
    })

    try {
      if (idsToDelete.length > 0) {
        await supabase.from('staff_schedules').delete().in('id', idsToDelete)
      }
      if (slotsToUpsert.length > 0) {
        const res = await fetch('/api/schedules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ staff_id: staffId, slots: slotsToUpsert }),
        })
        if (!res.ok) {
          const err = await res.json()
          alert(`บันทึกไม่สำเร็จ: ${err.error || 'โปรดลองใหม่'}`)
          return
        }
      }
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3500)
      loadSchedules()
    } catch (e: any) {
      alert(`เกิดข้อผิดพลาด: ${e.message}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ maxWidth: 1160, margin: '0 auto', padding: '24px 16px', userSelect: isDragging ? 'none' : 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 14 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calendar size={24} color="var(--brand-dominant, #315EC3)" /> ตารางงานพนักงาน
            {branch && <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--brand)', background: 'var(--brand-ghost, rgba(49,94,195,0.08))', padding: '2px 10px', borderRadius: 8 }}>สาขา {branch.name}</span>}
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748B' }}>
            เลือกช่วงเวลาที่คุณสะดวกรับงาน ลูกค้าในพื้นที่บริการของสาขาจะสามารถจองคิวกับคุณได้
          </p>
        </div>

        {/* Week navigation & Save */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface, #fff)', border: '1px solid var(--border, #E2E8F0)', borderRadius: 12, padding: '4px 8px', gap: 4 }}>
            <button
              type="button"
              onClick={() => setWeekStart(d => addDays(d, -7))}
              style={{ padding: '6px 8px', border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 6 }}
              title="สัปดาห์ก่อนหน้า"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
              style={{ padding: '4px 10px', borderRadius: 8, border: 'none', background: 'var(--surface-2, #F8FAFC)', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
            >
              สัปดาห์นี้
            </button>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, minWidth: 120, textAlign: 'center', color: 'var(--brand-dominant, #315EC3)' }}>
              {format(weekStart, 'd MMM', { locale: th })} – {format(addDays(weekStart, 6), 'd MMM yy', { locale: th })}
            </span>
            <button
              type="button"
              onClick={() => setWeekStart(d => addDays(d, 7))}
              style={{ padding: '6px 8px', border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 6 }}
              title="สัปดาห์ถัดไป"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <button
            type="button"
            disabled={!hasPendingChanges || saving}
            onClick={save}
            style={{
              padding: '10px 22px',
              borderRadius: 12,
              background: hasPendingChanges ? 'var(--brand-dominant, #315EC3)' : '#94A3B8',
              color: '#fff',
              border: 'none',
              fontWeight: 800,
              fontSize: '0.9rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              cursor: hasPendingChanges ? 'pointer' : 'default',
              boxShadow: hasPendingChanges ? '0 4px 12px rgba(49,94,195,0.25)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            <Save size={16} />
            {saving ? 'กำลังบันทึก...' : 'บันทึกตารางงาน'}
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div style={{ padding: '10px 18px', background: '#DCFCE7', color: '#166534', border: '1px solid #86EFAC', borderRadius: 12, marginBottom: 14, fontWeight: 700, fontSize: '0.875rem' }}>
          ✓ บันทึกตารางงานเรียบร้อยแล้ว
        </div>
      )}

      {/* Quick Presets Bar (Fast Fill for Mobile & Desktop) */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 8,
        padding: '10px 16px',
        background: 'var(--surface, #fff)',
        border: '1px solid var(--border, #E2E8F0)',
        borderRadius: 14,
        marginBottom: 14
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary, #475569)' }}>
          <Sparkles size={15} color="var(--brand-dominant, #315EC3)" />
          <span>เครื่องมือลงเวลารวดเร็ว:</span>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => applyPreset('morning')}
            style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#F8FAFC', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}
          >
            <Sun size={13} color="#D97706" /> กะเช้า (08:00-16:00)
          </button>
          <button
            type="button"
            onClick={() => applyPreset('afternoon')}
            style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#F8FAFC', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}
          >
            <Sunset size={13} color="#7C3AED" /> กะบ่าย (12:00-20:00)
          </button>
          <button
            type="button"
            onClick={() => applyPreset('full')}
            style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#F8FAFC', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}
          >
            <Clock size={13} color="var(--brand-dominant, #315EC3)" /> เต็มวัน (08:00-20:00)
          </button>
          <button
            type="button"
            onClick={() => applyPreset('clear')}
            style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid #FCA5A5', background: '#FEF2F2', color: '#B91C1C', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}
          >
            <X size={13} /> ล้างสัปดาห์นี้
          </button>
        </div>
      </div>

      {/* Guide Info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12, padding: '0 6px', fontSize: '0.8rem', color: '#64748B' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 14, height: 14, borderRadius: 4, background: '#DCFCE7', border: '1.5px solid #16A34A', display: 'inline-block' }} />
          <strong>สีเขียว</strong> = พร้อมรับงาน (คลิกหรือลากเมาส์เพื่อเปิด/ปิด)
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 14, height: 14, borderRadius: 4, background: '#fff', border: '1.5px solid #E2E8F0', display: 'inline-block' }} />
          <strong>สีขาว</strong> = ว่าง/หยุด
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 14, height: 14, borderRadius: 4, background: '#DBEAFE', border: '1.5px solid #2563EB', display: 'inline-block' }} />
          <strong>สีฟ้า</strong> = มีคิวจองแล้ว
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 14, height: 14, borderRadius: 4, background: '#F1F5F9', border: '1.5px solid #CBD5E1', display: 'inline-block' }} />
          <strong>สีเทา</strong> = ผ่านมาแล้ว (ล็อค)
        </span>
      </div>

      {/* Schedule Grid with Sticky Headers */}
      <div style={{
        background: '#fff',
        border: '1px solid #E2E8F0',
        borderRadius: 18,
        overflow: 'auto',
        maxHeight: 'calc(100vh - 270px)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
        position: 'relative',
        userSelect: 'none'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '70px repeat(7, minmax(100px, 1fr))',
          minWidth: 770
        }}>
          {/* Top Left Corner */}
          <div style={{
            position: 'sticky', top: 0, left: 0, zIndex: 20,
            background: '#F8FAFC', borderBottom: '2px solid #E2E8F0', borderRight: '1px solid #E2E8F0',
            padding: '12px 4px', textAlign: 'center', fontWeight: 800, fontSize: 12, color: '#64748B'
          }}>
            เวลา
          </div>

          {/* Sticky Day Headers */}
          {days.map(d => {
            const isToday = format(d, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
            return (
              <div
                key={d.toISOString()}
                style={{
                  position: 'sticky', top: 0, zIndex: 10,
                  background: isToday ? '#EFF6FF' : '#F8FAFC',
                  borderBottom: '2px solid #E2E8F0',
                  borderRight: '1px solid #E2E8F0',
                  padding: '10px 4px',
                  textAlign: 'center'
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: isToday ? '#2563EB' : '#64748B' }}>
                  {format(d, 'EEE', { locale: th })}
                </div>
                <div style={{
                  fontSize: 16, fontWeight: 800,
                  color: isToday ? '#fff' : '#0F172A',
                  background: isToday ? 'var(--brand-dominant, #315EC3)' : 'transparent',
                  width: 28, height: 28, borderRadius: '50%',
                  margin: '2px auto 0', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  {format(d, 'd')}
                </div>
              </div>
            )
          })}

          {/* Time Rows */}
          {TIME_SLOTS.map(slot => (
            <React.Fragment key={slot}>
              {/* Sticky Time Label */}
              <div style={{
                position: 'sticky', left: 0, zIndex: 5,
                background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #E2E8F0',
                padding: '8px 4px', fontSize: 12, fontWeight: 800, textAlign: 'center', color: '#475569',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                {slot.slice(0, 5)}
              </div>

              {/* Day Cells */}
              {days.map(d => {
                const dateKey = format(d, 'yyyy-MM-dd')
                const isBooked = isSlotBooked(dateKey, slot)
                const active = isSlotActive(dateKey, slot)
                const key = `${dateKey}_${slot}`
                const isModified = key in pendingSlots

                return (
                  <div
                    key={`${dateKey}_${slot}`}
                    onMouseDown={(e) => !isBooked && handleCellMouseDown(dateKey, slot, e)}
                    onMouseEnter={() => !isBooked && handleCellMouseEnter(dateKey, slot)}
                    style={{
                      minHeight: 46,
                      borderBottom: '1px solid #E2E8F0',
                      borderRight: '1px solid #E2E8F0',
                      background: isBooked ? '#DBEAFE' : active ? '#DCFCE7' : '#fff',
                      cursor: isBooked ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 4,
                      position: 'relative',
                      transition: 'background-color 0.1s'
                    }}
                  >
                    {isBooked ? (
                      <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#1E40AF' }}>
                        มีคิวจองแล้ว
                      </span>
                    ) : active ? (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#16A34A', fontSize: '0.75rem', fontWeight: 800 }}>
                        <Check size={14} strokeWidth={3} />
                        <span>พร้อม</span>
                      </div>
                    ) : null}

                    {isModified && (
                      <div style={{ position: 'absolute', top: 3, right: 3, width: 6, height: 6, borderRadius: '50%', background: 'var(--brand-dominant, #315EC3)' }} />
                    )}
                  </div>
                )
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  )
}
