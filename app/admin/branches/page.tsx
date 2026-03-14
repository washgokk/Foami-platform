'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabase'
import { Branch, Zone } from '@/lib/types'
import styles from './branches.module.css'

const BranchMapPicker = dynamic(() => import('./BranchMapPicker'), { ssr: false })
const MasterBranchesMap = dynamic(() => import('./MasterBranchesMap'), { ssr: false })

async function reverseGeocode(lat: number, lng: number) {
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=th`)
        const data = await res.json()
        const a = data.address || {}
        return {
            houseNumber: a.house_number || '',
            moo: a.village || a.hamlet || '',
            street: a.road || '',
            subdistrict: a.suburb || a.quarter || a.town || a.village || '',
            district: a.city_district || a.county || a.city || '',
            province: a.state || a.province || '',
            zipcode: a.postcode || '',
            fullText: data.display_name || ''
        }
    } catch {
        return { houseNumber: '', moo: '', street: '', subdistrict: '', district: '', province: '', zipcode: '', fullText: `${lat.toFixed(5)}, ${lng.toFixed(5)}` }
    }
}

export default function BranchesPage() {
    const [viewMode, setViewMode] = useState<'list' | 'map'>('list')
    const [branches, setBranches] = useState<Branch[]>([])
    const [allZones, setAllZones] = useState<Zone[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editing, setEditing] = useState<Branch | null>(null)
    const defaultForm = {
        name: '', slug: '', lat: 16.4419, lng: 102.836, rawAddress: '',
        houseNumber: '', moo: '', street: '', subdistrict: '', district: '', province: '', zipcode: '',
        out_of_zone_type: 'per_km' as 'per_km' | 'flat_rate', out_of_zone_fee: 10,
        labor_cost_per_job: 0, max_capital_per_job: 0, vehicle_rental_per_job: 0, fuel_cost_per_job: 0
    }
    const [form, setForm] = useState(defaultForm)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [geocoding, setGeocoding] = useState(false)

    const load = useCallback(async () => {
        const [{ data: brData }, { data: zData }] = await Promise.all([
            supabase.from('branches').select('*').order('created_at', { ascending: false }),
            supabase.from('zones').select('*').eq('is_active', true)
        ])
        setBranches(brData || [])
        setAllZones(zData || [])
        setLoading(false)
    }, [])

    useEffect(() => { load() }, [load])

    const openAdd = () => {
        setEditing(null)
        setForm(defaultForm)
        setError('')
        setShowModal(true)
    }
    const openEdit = (b: Branch) => {
        setEditing(b)
        // Naive parsing or just fallback to rawAddress for old data
        // If address contains "ตำบล... อำเภอ... จังหวัด...", they can edit via rawAddress or re-pin
        setForm({
            ...defaultForm, name: b.name, slug: b.slug || '', rawAddress: b.address, lat: b.lat, lng: b.lng,
            out_of_zone_type: b.out_of_zone_type || 'per_km',
            out_of_zone_fee: b.out_of_zone_fee ?? 10,
            labor_cost_per_job: b.labor_cost_per_job ?? 0,
            max_capital_per_job: b.max_capital_per_job ?? 0,
            vehicle_rental_per_job: b.vehicle_rental_per_job ?? 0,
            fuel_cost_per_job: b.fuel_cost_per_job ?? 0
        })
        setError('')
        setShowModal(true)
    }

    const handleMapPick = async (lat: number, lng: number) => {
        setForm(p => ({ ...p, lat, lng }))
        setGeocoding(true)
        const addr = await reverseGeocode(lat, lng)
        setForm(p => ({
            ...p, lat, lng,
            houseNumber: addr.houseNumber, moo: addr.moo, street: addr.street,
            subdistrict: addr.subdistrict, district: addr.district, province: addr.province, zipcode: addr.zipcode,
            rawAddress: addr.fullText
        }))
        setGeocoding(false)
    }

    const save = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!form.name.trim()) { setError('กรุณากรอกชื่อสาขา'); return }
        setSaving(true)
        setError('')

        const detailedParts = [
            form.houseNumber ? `บ้านเลขที่ ${form.houseNumber}` : '',
            form.moo ? `หมู่ ${form.moo}` : '',
            form.street ? `ถนน/ซอย ${form.street}` : '',
            form.subdistrict ? `ต.${form.subdistrict}` : '',
            form.district ? `อ.${form.district}` : '',
            form.province ? `จ.${form.province}` : '',
            form.zipcode
        ].filter(Boolean).join(' ')

        const finalAddress = detailedParts || form.rawAddress || `${form.lat.toFixed(5)}, ${form.lng.toFixed(5)}`

        const payload = {
            name: form.name, slug: form.slug, address: finalAddress, lat: form.lat, lng: form.lng,
            out_of_zone_type: form.out_of_zone_type, out_of_zone_fee: Number(form.out_of_zone_fee),
            labor_cost_per_job: Number(form.labor_cost_per_job),
            max_capital_per_job: Number(form.max_capital_per_job),
            vehicle_rental_per_job: Number(form.vehicle_rental_per_job),
            fuel_cost_per_job: Number(form.fuel_cost_per_job)
        }
        let err
        if (editing) {
            ({ error: err } = await supabase.from('branches').update(payload).eq('id', editing.id))
        } else {
            ({ error: err } = await supabase.from('branches').insert({ ...payload, is_active: true }))
        }
        if (err) { setError(err.message) } else { setShowModal(false); load() }
        setSaving(false)
    }

    const toggleActive = async (b: Branch) => {
        await supabase.from('branches').update({ is_active: !b.is_active }).eq('id', b.id)
        load()
    }

    const deleteBranch = async (id: string) => {
        if (!confirm('ต้องการลบสาขานี้?')) return
        await supabase.from('branches').delete().eq('id', id)
        load()
    }

    return (
        <div>
            <div className="page-header animate-fade">
                <div>
                    <h1 className="page-title">🏪 จัดการสาขา</h1>
                    <p className="page-subtitle">สาขาทั้งหมด {branches.length} สาขา</p>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    <div className="btn-group" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', display: 'flex', overflow: 'hidden' }}>
                        <button className={`btn btn-sm ${viewMode === 'list' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setViewMode('list')} style={{ borderRadius: 0, padding: '4px 12px' }}>📋 รายการ</button>
                        <button className={`btn btn-sm ${viewMode === 'map' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setViewMode('map')} style={{ borderRadius: 0, padding: '4px 12px' }}>🗺️ แผนที่โซน</button>
                    </div>
                    <button className="btn btn-primary" onClick={openAdd}>+ เพิ่มสาขา</button>
                </div>
            </div>

            {loading ? (
                <div className={styles.grid}>
                    {[1, 2, 3].map(i => <div key={i} className={`${styles.branchCard} animate-pulse`} style={{ height: 140 }} />)}
                </div>
            ) : viewMode === 'map' ? (
                <div className="animate-fade" style={{ background: 'var(--surface)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)', padding: 'var(--space-2)', height: '70vh' }}>
                    <MasterBranchesMap branches={branches} zones={allZones} />
                </div>
            ) : branches.length === 0 ? (
                <div className="empty-state animate-fade">
                    <span className="empty-state-icon">🏪</span>
                    <p className="empty-state-title">ยังไม่มีสาขา</p>
                    <button className="btn btn-primary" onClick={openAdd}>เพิ่มสาขาแรก</button>
                </div>
            ) : (
                <div className={`${styles.grid} animate-fade`}>
                    {branches.map(b => (
                        <div key={b.id} className={`${styles.branchCard} ${!b.is_active ? styles.inactive : ''}`}>
                            <div className={styles.cardTop}>
                                <div>
                                    <h3 className={styles.branchName}>{b.name}</h3>
                                    <p className={styles.branchAddr}>📍 {b.address}</p>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                                        <code style={{ background: 'var(--surface-2)', padding: '2px 6px', borderRadius: 4, fontSize: '0.75rem' }}>/{b.slug || 'no-slug'}</code>
                                        <button className="btn btn-ghost btn-xs" onClick={() => {
                                            const url = `${window.location.origin}/${b.slug}`;
                                            navigator.clipboard.writeText(url);
                                            alert('คัดลอกลิงก์สาขาแล้ว: ' + url);
                                        }}>📋 คัดลอกลิงก์แชร์</button>
                                    </div>
                                    {b.lat && b.lng && (
                                        <p className={styles.branchCoords} style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                                            🗺️ {b.lat.toFixed(4)}, {b.lng.toFixed(4)}
                                        </p>
                                    )}
                                </div>
                                <span className={`badge ${b.is_active ? 'badge-completed' : 'badge-cancelled'}`}>
                                    {b.is_active ? 'เปิด' : 'ปิด'}
                                </span>
                            </div>
                            <div className={styles.cardActions}>
                                <Link href={`/admin/branches/${b.id}/zones`} className="btn btn-ghost btn-sm">🗺️ โซน</Link>
                                <button className="btn btn-outline btn-sm" onClick={() => openEdit(b)}>✏️ แก้ไข</button>
                                <button className="btn btn-ghost btn-sm" onClick={() => toggleActive(b)}>
                                    {b.is_active ? '⏸️ ปิด' : '▶️ เปิด'}
                                </button>
                                <button className="btn btn-danger btn-sm" onClick={() => deleteBranch(b.id)}>🗑️</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add/Edit Modal with Map Picker */}
            {showModal && (
                <div className="overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" style={{ maxWidth: 600, width: '95vw' }} onClick={e => e.stopPropagation()}>
                        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 'var(--space-5)' }}>
                            {editing ? '✏️ แก้ไขสาขา' : '+ เพิ่มสาขา'}
                        </h2>
                        <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                            <div className="form-group">
                                <label className="form-label">ชื่อสาขา *</label>
                                <input className="form-input" placeholder="เช่น สาขาหลังมอ" value={form.name}
                                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
                            </div>

                            <div className="form-group">
                                <label className="form-label">URL Slug (ชื่อย่อภาษาอังกฤษ) *</label>
                                <input className="form-input" placeholder="เช่น khonkaen-back" value={form.slug}
                                    onChange={e => {
                                        const val = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
                                        setForm(p => ({ ...p, slug: val }));
                                    }} required />
                                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>
                                    ใช้สำหรับเป็นชื่อใน URL เช่น foami.app/<code>{form.slug || 'slug'}</code>
                                </p>
                            </div>

                            {/* Map picker */}
                            <div className="form-group">
                                <label className="form-label">📍 ปักหมุดตำแหน่งสาขาบนแผนที่</label>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 8 }}>
                                    คลิกบนแผนที่ หรือลากหมุดเพื่อเลือกตำแหน่ง
                                </p>
                                <BranchMapPicker
                                    lat={form.lat} lng={form.lng}
                                    onChange={handleMapPick}
                                />
                            </div>

                            {/* Address details grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                                <div className="form-group">
                                    <label className="form-label">บ้านเลขที่</label>
                                    <input className="form-input" placeholder="บ้านเลขที่" value={form.houseNumber} onChange={e => setForm(p => ({ ...p, houseNumber: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">หมู่</label>
                                    <input className="form-input" placeholder="หมู่ (ถ้ามี)" value={form.moo} onChange={e => setForm(p => ({ ...p, moo: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">ถนน/ซอย</label>
                                    <input className="form-input" placeholder="ถนน หรือ ซอย" value={form.street} onChange={e => setForm(p => ({ ...p, street: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">ตำบล/แขวง</label>
                                    <input className="form-input" placeholder="ตำบล" value={form.subdistrict} onChange={e => setForm(p => ({ ...p, subdistrict: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">อำเภอ/เขต</label>
                                    <input className="form-input" placeholder="อำเภอ" value={form.district} onChange={e => setForm(p => ({ ...p, district: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">จังหวัด</label>
                                    <input className="form-input" placeholder="จังหวัด" value={form.province} onChange={e => setForm(p => ({ ...p, province: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">รหัสไปรษณีย์</label>
                                    <input className="form-input" placeholder="12345" value={form.zipcode} onChange={e => setForm(p => ({ ...p, zipcode: e.target.value }))} />
                                </div>
                            </div>

                            {/* Raw Address Textarea */}
                            <div className="form-group">
                                <label className="form-label">ที่อยู่แบบข้อความ (อ้างอิง) {geocoding && <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>กำลังโหลด…</span>}</label>
                                <textarea className="form-input" rows={2} placeholder="ที่อยู่แบบยาว" value={form.rawAddress} onChange={e => setForm(p => ({ ...p, rawAddress: e.target.value }))} />
                            </div>

                            {/* Out of Zone Settings */}
                            <div style={{ background: 'var(--surface-2)', padding: 'var(--space-4)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', marginTop: 'var(--space-2)' }}>
                                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 'var(--space-3)' }}>🏍️ การคิดค่าบริการนอกโซน</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 'var(--space-3)' }}>
                                    <div className="form-group">
                                        <label className="form-label">รูปแบบการคิดเงิน</label>
                                        <select className="form-input form-select" value={form.out_of_zone_type} onChange={e => setForm(p => ({ ...p, out_of_zone_type: e.target.value as any }))}>
                                            <option value="per_km">คิดตามระยะทาง (บาท/กม.)</option>
                                            <option value="flat_rate">เหมาจ่าย (บาท)</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{form.out_of_zone_type === 'flat_rate' ? 'จำนวนเงินที่บวกเพิ่ม' : 'เรทราคา (บาท/กม.)'}</label>
                                        <input type="number" className="form-input" placeholder="เช่น 10" value={form.out_of_zone_fee} onChange={e => setForm(p => ({ ...p, out_of_zone_fee: Number(e.target.value) }))} />
                                    </div>
                                </div>
                            </div>

                            <div style={{ background: 'var(--accent-blue-ghost)', padding: 'var(--space-4)', borderRadius: 'var(--radius)', border: '1px solid var(--accent-blue)', marginTop: 'var(--space-2)' }}>
                                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 'var(--space-3)', color: 'var(--primary)' }}>💰 ข้อมูลการเงินรายทริป</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)' }}>
                                    <div className="form-group">
                                        <label className="form-label">ค่าแรง (บาท)</label>
                                        <input type="number" className="form-input" value={form.labor_cost_per_job} onChange={e => setForm(p => ({ ...p, labor_cost_per_job: Number(e.target.value) }))} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">ต้นทุนสูงสุด (บาท)</label>
                                        <input type="number" className="form-input" value={form.max_capital_per_job} onChange={e => setForm(p => ({ ...p, max_capital_per_job: Number(e.target.value) }))} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">ค่าเช่ารถ (บาท)</label>
                                        <input type="number" className="form-input" value={form.vehicle_rental_per_job} onChange={e => setForm(p => ({ ...p, vehicle_rental_per_job: Number(e.target.value) }))} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">ค่าน้ำมัน (บาท)</label>
                                        <input type="number" className="form-input" value={form.fuel_cost_per_job} onChange={e => setForm(p => ({ ...p, fuel_cost_per_job: Number(e.target.value) }))} />
                                    </div>
                                </div>
                            </div>

                            {error && <div className="alert alert-error">{error}</div>}
                            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
                                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>ยกเลิก</button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving ? <span className="spinner" /> : '💾 บันทึก'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
