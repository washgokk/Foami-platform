'use client'
import { useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Car, Bike, FileCheck, AlertCircle, Clock, Search,
  Calendar, Phone, Edit3, X, Save, CheckCircle2,
  ExternalLink, Filter, MessageSquare, ShieldCheck
} from 'lucide-react'

export interface VehicleRecord {
  license_plate?: string
  vehicle_brand?: string
  vehicle_model?: string
  vehicle_color?: string
  vehicle_size?: string
  vehicle_type?: 'car' | 'motorcycle'
  motorcycle_cc?: string
  act_expiry_date?: string
  tax_expiry_date?: string
  insurance_company?: string
  insurance_type?: string
  act_note?: string
}

interface Props {
  customers: any[]
  onRefreshCustomers: () => void
}

const MOTORCYCLE_CC_OPTIONS = [
  'ไม่เกิน 75 cc',
  '75 - 125 cc (เช่น Wave, Click, Scoopy)',
  '125 - 150 cc (เช่น PCX, NMAX, Aerox)',
  'เกิน 150 cc ขึ้นไป (Big Bike)',
  'รถจักรยานยนต์ไฟฟ้า (EV Bike)',
]

const INSURANCE_TYPE_OPTIONS = [
  'พ.ร.บ. บังคับอย่างเดียว',
  'ประกันภัยชั้น 1',
  'ประกันภัยชั้น 2+',
  'ประกันภัยชั้น 2',
  'ประกันภัยชั้น 3+',
  'ประกันภัยชั้น 3',
]

const INSURANCE_COMPANIES = [
  'วิริยะประกันภัย',
  'ทิพยประกันภัย',
  'กรุงเทพประกันภัย',
  'คุ้มภัยโตเกียวมารีน',
  'เมืองไทยประกันภัย',
  'ธนชาตประกันภัย',
  'สินมั่นคงประกันภัย',
  'เอไอจี (AIG)',
  'อื่นๆ / ไม่ระบุ',
]

export default function VehicleActTracker({ customers, onRefreshCustomers }: Props) {
  const [statusFilter, setStatusFilter] = useState<'all' | 'expired' | 'expiring_30' | 'valid'>('all')
  const [typeFilter, setTypeFilter] = useState<'all' | 'car' | 'motorcycle'>('all')
  const [searchTerm, setSearchTerm] = useState('')

  // Edit Modal State
  const [editingItem, setEditingItem] = useState<{
    customerId: string
    customerName: string
    customerPhone: string
    vehicleIndex: number
    vehicle: VehicleRecord
  } | null>(null)
  const [saving, setSaving] = useState(false)

  // Flatten all vehicles with their customer owner
  const allVehicles = useMemo(() => {
    const list: {
      customerId: string
      customerName: string
      customerPhone: string
      vehicleIndex: number
      vehicle: VehicleRecord
      daysLeftAct: number | null
      daysLeftTax: number | null
      actStatus: 'expired' | 'expiring_30' | 'valid' | 'unknown'
    }[] = []

    customers.forEach(c => {
      const vehicles: VehicleRecord[] = Array.isArray(c.saved_vehicles) ? c.saved_vehicles : []
      vehicles.forEach((v, idx) => {
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        let daysLeftAct: number | null = null
        let actStatus: 'expired' | 'expiring_30' | 'valid' | 'unknown' = 'unknown'

        if (v.act_expiry_date) {
          const actDate = new Date(v.act_expiry_date)
          actDate.setHours(0, 0, 0, 0)
          daysLeftAct = Math.ceil((actDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

          if (daysLeftAct < 0) {
            actStatus = 'expired'
          } else if (daysLeftAct <= 30) {
            actStatus = 'expiring_30'
          } else {
            actStatus = 'valid'
          }
        }

        let daysLeftTax: number | null = null
        if (v.tax_expiry_date) {
          const taxDate = new Date(v.tax_expiry_date)
          taxDate.setHours(0, 0, 0, 0)
          daysLeftTax = Math.ceil((taxDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        }

        list.push({
          customerId: c.id,
          customerName: c.full_name || 'ลูกค้าทั่วไป',
          customerPhone: c.phone || '',
          vehicleIndex: idx,
          vehicle: v,
          daysLeftAct,
          daysLeftTax,
          actStatus
        })
      })
    })

    // Sort: Expired first, then Expiring soon, then Valid, then Unknown
    return list.sort((a, b) => {
      const order = { expired: 0, expiring_30: 1, valid: 2, unknown: 3 }
      if (order[a.actStatus] !== order[b.actStatus]) {
        return order[a.actStatus] - order[b.actStatus]
      }
      return (a.daysLeftAct ?? 9999) - (b.daysLeftAct ?? 9999)
    })
  }, [customers])

  // Filtered List
  const filteredVehicles = useMemo(() => {
    return allVehicles.filter(item => {
      // Status Filter
      if (statusFilter !== 'all' && item.actStatus !== statusFilter) return false

      // Type Filter
      if (typeFilter === 'car' && item.vehicle.vehicle_type === 'motorcycle') return false
      if (typeFilter === 'motorcycle' && item.vehicle.vehicle_type !== 'motorcycle') return false

      // Search
      if (searchTerm) {
        const q = searchTerm.toLowerCase()
        const matchPlate = (item.vehicle.license_plate || '').toLowerCase().includes(q)
        const matchBrand = (item.vehicle.vehicle_brand || '').toLowerCase().includes(q)
        const matchModel = (item.vehicle.vehicle_model || '').toLowerCase().includes(q)
        const matchCust = item.customerName.toLowerCase().includes(q)
        const matchPhone = item.customerPhone.includes(q)
        if (!matchPlate && !matchBrand && !matchModel && !matchCust && !matchPhone) return false
      }

      return true
    })
  }, [allVehicles, statusFilter, typeFilter, searchTerm])

  // Counts
  const counts = useMemo(() => {
    return {
      all: allVehicles.length,
      expired: allVehicles.filter(v => v.actStatus === 'expired').length,
      expiring_30: allVehicles.filter(v => v.actStatus === 'expiring_30').length,
      valid: allVehicles.filter(v => v.actStatus === 'valid').length,
    }
  }, [allVehicles])

  // Save Vehicle Data to Supabase
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingItem) return
    setSaving(true)
    try {
      const customer = customers.find(c => c.id === editingItem.customerId)
      if (!customer) throw new Error('ไม่พบข้อมูลลูกค้า')

      const updatedVehicles = [...(customer.saved_vehicles || [])]
      updatedVehicles[editingItem.vehicleIndex] = {
        ...updatedVehicles[editingItem.vehicleIndex],
        ...editingItem.vehicle
      }

      const { error } = await supabase
        .from('customers')
        .update({ saved_vehicles: updatedVehicles })
        .eq('id', editingItem.customerId)

      if (error) throw error

      alert('บันทึกข้อมูล พ.ร.บ. & ภาษีรถ เรียบร้อยแล้ว')
      setEditingItem(null)
      onRefreshCustomers()
    } catch (err: any) {
      alert('บันทึกไม่สำเร็จ: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Overview Metric Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 16
      }}>
        <div style={{
          background: '#FFFFFF', border: '1.5px solid #E8EEF8',
          borderRadius: 18, padding: '18px 20px', boxShadow: '0 4px 16px rgba(49, 94, 195, 0.04)'
        }}>
          <div style={{ fontSize: 12, color: '#5A6589', fontWeight: 700, textTransform: 'uppercase' }}>
            รถที่บันทึกทั้งหมด
          </div>
          <div style={{ fontSize: 26, fontWeight: 900, color: '#1A2340', marginTop: 4 }}>
            {counts.all} <span style={{ fontSize: 13, color: '#7E8BAA', fontWeight: 600 }}>คัน</span>
          </div>
        </div>

        <div style={{
          background: '#FFFFFF', border: '1.5px solid #FEE2E2',
          borderRadius: 18, padding: '18px 20px', boxShadow: '0 4px 16px rgba(220, 38, 38, 0.04)'
        }}>
          <div style={{ fontSize: 12, color: '#DC2626', fontWeight: 700, textTransform: 'uppercase' }}>
            พ.ร.บ. หมดอายุแล้ว
          </div>
          <div style={{ fontSize: 26, fontWeight: 900, color: '#DC2626', marginTop: 4 }}>
            {counts.expired} <span style={{ fontSize: 13, color: '#DC2626', fontWeight: 600 }}>คัน</span>
          </div>
        </div>

        <div style={{
          background: '#FFFFFF', border: '1.5px solid #FEF3C7',
          borderRadius: 18, padding: '18px 20px', boxShadow: '0 4px 16px rgba(217, 119, 6, 0.04)'
        }}>
          <div style={{ fontSize: 12, color: '#D97706', fontWeight: 700, textTransform: 'uppercase' }}>
            ใกล้หมดอายุ (ใน 30 วัน)
          </div>
          <div style={{ fontSize: 26, fontWeight: 900, color: '#D97706', marginTop: 4 }}>
            {counts.expiring_30} <span style={{ fontSize: 13, color: '#D97706', fontWeight: 600 }}>คัน</span>
          </div>
        </div>

        <div style={{
          background: '#FFFFFF', border: '1.5px solid #DCFCE7',
          borderRadius: 18, padding: '18px 20px', boxShadow: '0 4px 16px rgba(22, 163, 74, 0.04)'
        }}>
          <div style={{ fontSize: 12, color: '#16A34A', fontWeight: 700, textTransform: 'uppercase' }}>
            พ.ร.บ. ยังไม่หมดอายุ
          </div>
          <div style={{ fontSize: 26, fontWeight: 900, color: '#16A34A', marginTop: 4 }}>
            {counts.valid} <span style={{ fontSize: 13, color: '#16A34A', fontWeight: 600 }}>คัน</span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div style={{
        background: '#FFFFFF', border: '1.5px solid #E8EEF8',
        borderRadius: 18, padding: '14px 18px',
        display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', justifyContent: 'space-between'
      }}>
        {/* Status Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflowX: 'auto' }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: '#5A6589', marginRight: 4 }}>สถานะ:</span>
          {[
            { label: `ทั้งหมด (${counts.all})`, value: 'all' },
            { label: `หมดอายุแล้ว (${counts.expired})`, value: 'expired', color: '#DC2626' },
            { label: `ใกล้หมดอายุ (${counts.expiring_30})`, value: 'expiring_30', color: '#D97706' },
            { label: `ยังไม่หมดอายุ (${counts.valid})`, value: 'valid', color: '#16A34A' },
          ].map(opt => {
            const active = statusFilter === opt.value
            return (
              <button
                key={opt.value}
                onClick={() => setStatusFilter(opt.value as any)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 10,
                  border: `1.5px solid ${active ? (opt.color || '#315EC3') : '#E8EEF8'}`,
                  background: active ? (opt.color ? `${opt.color}15` : '#EFF3FD') : '#FFFFFF',
                  color: active ? (opt.color || '#315EC3') : '#5A6589',
                  fontSize: 12.5,
                  fontWeight: active ? 800 : 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  whiteSpace: 'nowrap'
                }}
              >
                {opt.label}
              </button>
            )
          })}
        </div>

        {/* Type Filter & Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Vehicle Type Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#F1F5F9', padding: 3, borderRadius: 10 }}>
            <button
              onClick={() => setTypeFilter('all')}
              style={{
                padding: '5px 10px', borderRadius: 7, border: 'none',
                background: typeFilter === 'all' ? '#FFFFFF' : 'transparent',
                color: typeFilter === 'all' ? '#315EC3' : '#64748B',
                fontSize: 12, fontWeight: 700, cursor: 'pointer'
              }}
            >
              ทั้งหมด
            </button>
            <button
              onClick={() => setTypeFilter('car')}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '5px 10px', borderRadius: 7, border: 'none',
                background: typeFilter === 'car' ? '#FFFFFF' : 'transparent',
                color: typeFilter === 'car' ? '#315EC3' : '#64748B',
                fontSize: 12, fontWeight: 700, cursor: 'pointer'
              }}
            >
              <Car size={13} /> รถยนต์
            </button>
            <button
              onClick={() => setTypeFilter('motorcycle')}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '5px 10px', borderRadius: 7, border: 'none',
                background: typeFilter === 'motorcycle' ? '#FFFFFF' : 'transparent',
                color: typeFilter === 'motorcycle' ? '#315EC3' : '#64748B',
                fontSize: 12, fontWeight: 700, cursor: 'pointer'
              }}
            >
              <Bike size={13} /> มอเตอร์ไซค์
            </button>
          </div>

          {/* Search */}
          <div style={{ position: 'relative', width: 220 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9AA5C4' }} />
            <input
              type="text"
              placeholder="ค้นหาทะเบียน, รุ่น, หรือเจ้าของ..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{
                width: '100%', padding: '7px 10px 7px 32px', borderRadius: 10,
                border: '1.5px solid #E8EEF8', fontSize: 12.5, outline: 'none',
                fontFamily: 'inherit', color: '#1A2340', boxSizing: 'border-box'
              }}
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={{
        background: '#FFFFFF', border: '1.5px solid #E8EEF8',
        borderRadius: 20, overflow: 'hidden', boxShadow: '0 4px 18px rgba(49, 94, 195, 0.04)'
      }}>
        {filteredVehicles.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#7E8BAA' }}>
            <FileCheck size={36} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.4 }} />
            ไม่พบข้อมูลรถหรือ พ.ร.บ. ตามเงื่อนไขที่เลือก
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 860 }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1.5px solid #E8EEF8' }}>
                  <th style={{ padding: '14px 20px', fontSize: 12, fontWeight: 700, color: '#5A6589', textTransform: 'uppercase' }}>ป้ายทะเบียน / ยานพาหนะ</th>
                  <th style={{ padding: '14px 16px', fontSize: 12, fontWeight: 700, color: '#5A6589', textTransform: 'uppercase' }}>ประเภท / ขนาดเครื่องยนต์</th>
                  <th style={{ padding: '14px 16px', fontSize: 12, fontWeight: 700, color: '#5A6589', textTransform: 'uppercase' }}>เจ้าของ (ลูกค้า)</th>
                  <th style={{ padding: '14px 16px', fontSize: 12, fontWeight: 700, color: '#5A6589', textTransform: 'uppercase' }}>วันหมดอายุ พ.ร.บ.</th>
                  <th style={{ padding: '14px 16px', fontSize: 12, fontWeight: 700, color: '#5A6589', textTransform: 'uppercase' }}>วันต่อภาษีประจำปี</th>
                  <th style={{ padding: '14px 16px', fontSize: 12, fontWeight: 700, color: '#5A6589', textTransform: 'uppercase' }}>สถานะ พ.ร.บ.</th>
                  <th style={{ padding: '14px 20px', fontSize: 12, fontWeight: 700, color: '#5A6589', textTransform: 'uppercase', textAlign: 'right' }}>การจัดการ</th>
                </tr>
              </thead>
              <tbody>
                {filteredVehicles.map((item, idx) => {
                  const isMotorcycle = item.vehicle.vehicle_type === 'motorcycle'
                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid #E8EEF8', transition: 'background 0.15s' }}>
                      {/* Vehicle & Plate */}
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 38, height: 38, borderRadius: 10,
                            background: isMotorcycle ? '#EFF3FD' : '#F1F5F9',
                            color: isMotorcycle ? '#315EC3' : '#475569',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}>
                            {isMotorcycle ? <Bike size={20} /> : <Car size={20} />}
                          </div>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: 14, color: '#1A2340' }}>
                              {item.vehicle.license_plate || 'ไม่ระบุทะเบียน'}
                            </div>
                            <div style={{ fontSize: 12, color: '#7E8BAA' }}>
                              {item.vehicle.vehicle_brand || ''} {item.vehicle.vehicle_model || ''} {item.vehicle.vehicle_color ? `(${item.vehicle.vehicle_color})` : ''}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Vehicle Subtype / CC */}
                      <td style={{ padding: '16px 16px' }}>
                        {isMotorcycle ? (
                          <div>
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#315EC3', background: '#EFF3FD', padding: '3px 8px', borderRadius: 6 }}>
                              มอเตอร์ไซค์
                            </span>
                            <div style={{ fontSize: 11.5, color: '#5A6589', marginTop: 3 }}>
                              {item.vehicle.motorcycle_cc || 'ไม่ระบุขนาด CC'}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#475569', background: '#F1F5F9', padding: '3px 8px', borderRadius: 6 }}>
                              รถยนต์ (Size {item.vehicle.vehicle_size || 'M'})
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Customer Owner */}
                      <td style={{ padding: '16px 16px' }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: '#1A2340' }}>
                          {item.customerName}
                        </div>
                        <div style={{ fontSize: 11.5, color: '#7E8BAA', display: 'flex', alignItems: 'center', gap: 3 }}>
                          <Phone size={10} /> {item.customerPhone || '-'}
                        </div>
                      </td>

                      {/* ACT Expiry Date */}
                      <td style={{ padding: '16px 16px' }}>
                        {item.vehicle.act_expiry_date ? (
                          <div>
                            <div style={{ fontWeight: 800, fontSize: 13, color: '#1A2340' }}>
                              {new Date(item.vehicle.act_expiry_date).toLocaleDateString('th-TH')}
                            </div>
                            {item.daysLeftAct !== null && (
                              <div style={{
                                fontSize: 11, fontWeight: 700,
                                color: item.daysLeftAct < 0 ? '#DC2626' : item.daysLeftAct <= 30 ? '#D97706' : '#16A34A'
                              }}>
                                {item.daysLeftAct < 0 ? `หมดอายุแล้ว ${Math.abs(item.daysLeftAct)} วัน` : `เหลืออีก ${item.daysLeftAct} วัน`}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, color: '#9AA5C4' }}>ยังไม่ระบุ</span>
                        )}
                      </td>

                      {/* Tax Expiry Date */}
                      <td style={{ padding: '16px 16px' }}>
                        {item.vehicle.tax_expiry_date ? (
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13, color: '#1A2340' }}>
                              {new Date(item.vehicle.tax_expiry_date).toLocaleDateString('th-TH')}
                            </div>
                            {item.daysLeftTax !== null && (
                              <div style={{ fontSize: 11, color: '#5A6589' }}>
                                {item.daysLeftTax < 0 ? `เกินกำหนด ${Math.abs(item.daysLeftTax)} วัน` : `เหลืออีก ${item.daysLeftTax} วัน`}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, color: '#9AA5C4' }}>ยังไม่ระบุ</span>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td style={{ padding: '16px 16px' }}>
                        {item.actStatus === 'expired' ? (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '4px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 800,
                            background: '#FEE2E2', color: '#DC2626'
                          }}>
                            <AlertCircle size={12} /> หมดอายุแล้ว
                          </span>
                        ) : item.actStatus === 'expiring_30' ? (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '4px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 800,
                            background: '#FEF3C7', color: '#D97706'
                          }}>
                            <Clock size={12} /> ใกล้หมดอายุ
                          </span>
                        ) : item.actStatus === 'valid' ? (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '4px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 800,
                            background: '#DCFCE7', color: '#16A34A'
                          }}>
                            <CheckCircle2 size={12} /> ยังไม่หมดอายุ
                          </span>
                        ) : (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '4px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 600,
                            background: '#F1F5F9', color: '#64748B'
                          }}>
                            รอลงบันทึก
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                          <button
                            onClick={() => setEditingItem({
                              customerId: item.customerId,
                              customerName: item.customerName,
                              customerPhone: item.customerPhone,
                              vehicleIndex: item.vehicleIndex,
                              vehicle: { ...item.vehicle }
                            })}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              padding: '6px 12px', borderRadius: 8,
                              background: '#EFF3FD', color: '#315EC3',
                              border: '1px solid rgba(49, 94, 195, 0.15)',
                              cursor: 'pointer', fontSize: 12, fontWeight: 700,
                              fontFamily: 'inherit'
                            }}
                          >
                            <Edit3 size={12} /> บันทึก พ.ร.บ.
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Vehicle ACT Modal */}
      {editingItem && (
        <>
          <div
            onClick={() => setEditingItem(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)', zIndex: 100, backdropFilter: 'blur(2px)' }}
          />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            zIndex: 101, background: '#FFFFFF', borderRadius: 24, padding: '28px',
            width: 580, maxWidth: '95vw', maxHeight: '88vh', overflowY: 'auto',
            boxShadow: '0 20px 40px rgba(0,0,0,0.18)', border: '1.5px solid #E8EEF8'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 900, color: '#1A2340', margin: 0 }}>
                  บันทึกข้อมูล พ.ร.บ. & ภาษีรถ
                </h2>
                <div style={{ fontSize: 13, color: '#5A6589', marginTop: 4 }}>
                  เจ้าของ: <strong>{editingItem.customerName}</strong> ({editingItem.customerPhone})
                </div>
              </div>
              <button onClick={() => setEditingItem(null)} style={{ background: '#F1F5F9', border: 'none', borderRadius: 10, padding: 6, cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Vehicle Type Choice */}
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 700, color: '#1A2340', display: 'block', marginBottom: 6 }}>
                  ประเภทยานพาหนะ
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setEditingItem({
                      ...editingItem,
                      vehicle: { ...editingItem.vehicle, vehicle_type: 'car' }
                    })}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      padding: '10px', borderRadius: 12,
                      border: `1.5px solid ${editingItem.vehicle.vehicle_type !== 'motorcycle' ? '#315EC3' : '#E8EEF8'}`,
                      background: editingItem.vehicle.vehicle_type !== 'motorcycle' ? '#EFF3FD' : '#FFFFFF',
                      color: editingItem.vehicle.vehicle_type !== 'motorcycle' ? '#315EC3' : '#5A6589',
                      fontWeight: 800, fontSize: 13, cursor: 'pointer'
                    }}
                  >
                    <Car size={18} /> รถยนต์ (Car)
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditingItem({
                      ...editingItem,
                      vehicle: { ...editingItem.vehicle, vehicle_type: 'motorcycle' }
                    })}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      padding: '10px', borderRadius: 12,
                      border: `1.5px solid ${editingItem.vehicle.vehicle_type === 'motorcycle' ? '#315EC3' : '#E8EEF8'}`,
                      background: editingItem.vehicle.vehicle_type === 'motorcycle' ? '#EFF3FD' : '#FFFFFF',
                      color: editingItem.vehicle.vehicle_type === 'motorcycle' ? '#315EC3' : '#5A6589',
                      fontWeight: 800, fontSize: 13, cursor: 'pointer'
                    }}
                  >
                    <Bike size={18} /> มอเตอร์ไซค์ (Motorcycle)
                  </button>
                </div>
              </div>

              {/* Motorcycle CC Options (Only if Motorcycle) */}
              {editingItem.vehicle.vehicle_type === 'motorcycle' && (
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 700, color: '#1A2340', display: 'block', marginBottom: 6 }}>
                    ขนาดเครื่องยนต์ / ประเภทมอเตอร์ไซค์ตาม พ.ร.บ.
                  </label>
                  <select
                    value={editingItem.vehicle.motorcycle_cc || ''}
                    onChange={e => setEditingItem({
                      ...editingItem,
                      vehicle: { ...editingItem.vehicle, motorcycle_cc: e.target.value }
                    })}
                    style={{
                      width: '100%', padding: '10px 12px', borderRadius: 10,
                      border: '1.5px solid #E8EEF8', fontSize: 13, fontFamily: 'inherit',
                      outline: 'none', color: '#1A2340', background: '#FFFFFF'
                    }}
                  >
                    <option value="">เลือกขนาดเครื่องยนต์</option>
                    {MOTORCYCLE_CC_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* License Plate & Brand/Model */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 700, color: '#1A2340', display: 'block', marginBottom: 6 }}>
                    ป้ายทะเบียน
                  </label>
                  <input
                    type="text"
                    value={editingItem.vehicle.license_plate || ''}
                    onChange={e => setEditingItem({
                      ...editingItem,
                      vehicle: { ...editingItem.vehicle, license_plate: e.target.value }
                    })}
                    placeholder="เช่น 1กข 1234 ขอนแก่น"
                    style={{
                      width: '100%', padding: '10px 12px', borderRadius: 10,
                      border: '1.5px solid #E8EEF8', fontSize: 13, fontFamily: 'inherit',
                      outline: 'none', boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 700, color: '#1A2340', display: 'block', marginBottom: 6 }}>
                    ยี่ห้อ / รุ่น
                  </label>
                  <input
                    type="text"
                    value={`${editingItem.vehicle.vehicle_brand || ''} ${editingItem.vehicle.vehicle_model || ''}`.trim()}
                    onChange={e => setEditingItem({
                      ...editingItem,
                      vehicle: { ...editingItem.vehicle, vehicle_brand: e.target.value }
                    })}
                    placeholder="เช่น Honda Click 125i"
                    style={{
                      width: '100%', padding: '10px 12px', borderRadius: 10,
                      border: '1.5px solid #E8EEF8', fontSize: 13, fontFamily: 'inherit',
                      outline: 'none', boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              {/* ACT & Tax Expiry Dates */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 700, color: '#DC2626', display: 'block', marginBottom: 6 }}>
                    วันหมดอายุ พ.ร.บ. *
                  </label>
                  <input
                    type="date"
                    value={editingItem.vehicle.act_expiry_date || ''}
                    onChange={e => setEditingItem({
                      ...editingItem,
                      vehicle: { ...editingItem.vehicle, act_expiry_date: e.target.value }
                    })}
                    style={{
                      width: '100%', padding: '10px 12px', borderRadius: 10,
                      border: '1.5px solid #E8EEF8', fontSize: 13, fontFamily: 'inherit',
                      outline: 'none', boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 700, color: '#1A2340', display: 'block', marginBottom: 6 }}>
                    วันต่อภาษีประจำปี (ป้ายวงกลม)
                  </label>
                  <input
                    type="date"
                    value={editingItem.vehicle.tax_expiry_date || ''}
                    onChange={e => setEditingItem({
                      ...editingItem,
                      vehicle: { ...editingItem.vehicle, tax_expiry_date: e.target.value }
                    })}
                    style={{
                      width: '100%', padding: '10px 12px', borderRadius: 10,
                      border: '1.5px solid #E8EEF8', fontSize: 13, fontFamily: 'inherit',
                      outline: 'none', boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              {/* Insurance Info */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 700, color: '#1A2340', display: 'block', marginBottom: 6 }}>
                    ประเภทประกันภัย
                  </label>
                  <select
                    value={editingItem.vehicle.insurance_type || ''}
                    onChange={e => setEditingItem({
                      ...editingItem,
                      vehicle: { ...editingItem.vehicle, insurance_type: e.target.value }
                    })}
                    style={{
                      width: '100%', padding: '10px 12px', borderRadius: 10,
                      border: '1.5px solid #E8EEF8', fontSize: 13, fontFamily: 'inherit',
                      outline: 'none', color: '#1A2340', background: '#FFFFFF'
                    }}
                  >
                    <option value="">เลือกประเภทประกัน</option>
                    {INSURANCE_TYPE_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 700, color: '#1A2340', display: 'block', marginBottom: 6 }}>
                    บริษัทประกันภัย
                  </label>
                  <select
                    value={editingItem.vehicle.insurance_company || ''}
                    onChange={e => setEditingItem({
                      ...editingItem,
                      vehicle: { ...editingItem.vehicle, insurance_company: e.target.value }
                    })}
                    style={{
                      width: '100%', padding: '10px 12px', borderRadius: 10,
                      border: '1.5px solid #E8EEF8', fontSize: 13, fontFamily: 'inherit',
                      outline: 'none', color: '#1A2340', background: '#FFFFFF'
                    }}
                  >
                    <option value="">เลือกบริษัทประกัน</option>
                    {INSURANCE_COMPANIES.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Submit Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  style={{
                    padding: '10px 18px', borderRadius: 12, border: '1.5px solid #E8EEF8',
                    background: '#FFFFFF', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    color: '#5A6589', fontFamily: 'inherit'
                  }}
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    padding: '10px 22px', borderRadius: 12, border: 'none',
                    background: '#315EC3', color: '#FFFFFF', fontSize: 13, fontWeight: 800,
                    cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6
                  }}
                >
                  <Save size={14} /> {saving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  )
}
