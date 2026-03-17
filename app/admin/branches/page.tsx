'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabase'
import { Branch, Zone } from '@/lib/types'
import ConfirmModal from '@/components/Global/ConfirmModal'
import { Store, Map as MapIcon, List, Plus, MapPin, Copy, Edit3, Pause, Play, Trash2, Globe, Phone, Clock, ArrowRight, Coins, Fuel as GasStation, Wrench, Settings } from 'lucide-react'
import styles from './branches.module.css'
import { trackAuditLog } from '@/lib/audit'

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
        out_of_zone_type: 'per_km' as 'per_km' | 'flat_rate', out_of_zone_fee: 5,
        labor_cost_per_job: 30, max_capital_per_job: 0, vehicle_rental_per_job: 0, fuel_cost_per_job: 0
    }
    const [form, setForm] = useState(defaultForm)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [confirmConfig, setConfirmConfig] = useState<{
        isOpen: boolean;
        id: string;
        title: string;
        message: string;
    }>({ isOpen: false, id: '', title: '', message: '' })
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

    useEffect(() => {
        const handleRefresh = () => load()
        window.addEventListener('foami:refresh', handleRefresh)
        return () => window.removeEventListener('foami:refresh', handleRefresh)
    }, [load])

    const openAdd = () => {
        setEditing(null)
        setForm(defaultForm)
        setError('')
        setShowModal(true)
    }
    const openEdit = (b: Branch) => {
        setEditing(b)
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
            
            if (!err) {
                await trackAuditLog({
                    action_type: 'UPDATE',
                    entity_type: 'branch',
                    entity_id: editing.id,
                    old_data: editing,
                    new_data: { ...editing, ...payload },
                    description: `แก้ไขสาขา: ${payload.name}`
                })
            }
        } else {
            const { data, error } = await supabase.from('branches').insert({ ...payload, is_active: true }).select().single()
            err = error
            
            if (!err && data) {
                await trackAuditLog({
                    action_type: 'CREATE',
                    entity_type: 'branch',
                    entity_id: data.id,
                    new_data: { ...payload, is_active: true },
                    description: `เพิ่มสาขาใหม่: ${payload.name}`
                })
            }
        }
        if (err) { setError(err.message) } else { setShowModal(false); load() }
        setSaving(false)
    }

    const toggleActive = async (b: Branch) => {
        const nextState = !b.is_active
        await supabase.from('branches').update({ is_active: nextState }).eq('id', b.id)
        
        await trackAuditLog({
            action_type: 'TOGGLE_STATUS',
            entity_type: 'branch',
            entity_id: b.id,
            old_data: { is_active: b.is_active },
            new_data: { is_active: nextState },
            description: `${nextState ? 'เปิด' : 'ปิด'}การใช้งานสาขา: ${b.name}`
        })
        
        load()
    }

    const deleteBranch = async (id: string) => {
        const b = branches.find(item => item.id === id)
        if (!b) return
        
        setConfirmConfig({
            isOpen: true,
            id: id,
            title: 'ยืนยันการลบสาขา',
            message: `คุณแน่ใจหรือไม่ว่าต้องการลบสาขา "${b.name}"? การลบนี้จะไม่สามารถย้อนคืนได้`
        })
    }

    const handleConfirmDelete = async () => {
        const id = confirmConfig.id
        const b = branches.find(item => item.id === id)
        if (!b) return

        setConfirmConfig(p => ({ ...p, isOpen: false }))
        setSaving(true)
        
        try {
            const { error: delError } = await supabase.from('branches').delete().eq('id', id)
            if (delError) {
                if (delError.code === '23503') {
                    alert('ไม่สามารถลบสาขานี้ได้ เนื่องจากยังมีพนักงานหรือการจองงานที่ค้างอยู่ในระบบของสาขานี้\n\nกรุณาย้ายหรือลบข้อมูลเหล่านั้นก่อนทำการลบสาขา')
                } else {
                    throw delError
                }
                setSaving(false)
                return
            }
            
            await trackAuditLog({
                action_type: 'DELETE',
                entity_type: 'branch',
                entity_id: id,
                old_data: b,
                description: `ลบสาขา: ${b.name}`
            })
            
            load()
            alert('ลบสาขาเรียบร้อยแล้ว')
        } catch (err: any) {
            alert('เกิดข้อผิดพลาดในการลบ: ' + err.message)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div>
            <div className="page-header animate-fade">
                <div>
                    <h2 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Store size={28} style={{ color: 'var(--brand-dominant)' }} /> จัดการสาขา
                    </h2>
                    <p className="page-subtitle">จัดการตำแหน่งและพื้นที่ให้บริการทั้งหมด {branches.length} แห่ง</p>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
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
                    <button className="btn btn-primary" style={{ borderRadius: '12px', gap: 8 }} onClick={openAdd}>
                        <Plus size={20} /> เพิ่มสาขา
                    </button>
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
                    <div style={{ background: 'var(--surface-2)', width: 80, height: 80, borderRadius: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: 'var(--text-muted)' }}>
                        <Store size={40} />
                    </div>
                    <p className="empty-state-title" style={{ fontWeight: 800 }}>ยังไม่มีสาขาที่เปิดให้บริการ</p>
                    <button className="btn btn-primary" style={{ marginTop: 12, borderRadius: 12 }} onClick={openAdd}>เพิ่มสาขาแรก</button>
                </div>
            ) : (
                <div className={`${styles.grid} animate-fade`}>
                    {branches.map(b => (
                        <div key={b.id} className={`${styles.branchCard} ${!b.is_active ? styles.inactive : ''}`}>
                            <div className={styles.cardTop}>
                                <div>
                                    <h3 className={styles.branchName}>{b.name}</h3>
                                    <p className={styles.branchAddr}>
                                        <MapPin size={14} style={{ color: 'var(--brand-dominant)', marginRight: 4, display: 'inline' }} /> {b.address}
                                    </p>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
                                        <code style={{ background: 'var(--brand-dominant-ghost)', color: 'var(--brand-dominant)', padding: '4px 8px', borderRadius: 8, fontSize: '0.75rem', fontWeight: 700 }}>/{b.slug || 'no-slug'}</code>
                                        <button className="btn btn-ghost btn-xs" style={{ borderRadius: 6, gap: 4 }} onClick={() => {
                                            const url = `${window.location.origin}/${b.slug}`;
                                            navigator.clipboard.writeText(url);
                                            alert('คัดลอกลิงก์สาขาแล้ว: ' + url);
                                        }}>
                                            <Copy size={12} /> คัดลอกลิงก์แชร์
                                        </button>
                                    </div>
                                    {b.lat && b.lng && (
                                        <p className={styles.branchCoords} style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <MapIcon size={12} /> {b.lat.toFixed(4)}, {b.lng.toFixed(4)}
                                        </p>
                                    )}
                                </div>
                                <span className={`badge ${b.is_active ? 'badge-completed' : 'badge-cancelled'}`} style={{ borderRadius: 8, padding: '4px 10px', fontSize: '0.75rem' }}>
                                    {b.is_active ? 'เปิดให้บริการ' : 'ปิดชั่วคราว'}
                                </span>
                            </div>
                            <div className={styles.cardActions} style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <Link href={`/admin/branches/${b.id}/zones`} className="btn btn-ghost btn-sm" style={{ borderRadius: 8, gap: 6 }}>
                                        <MapIcon size={14} /> โซน
                                    </Link>
                                    <button className="btn btn-outline btn-sm" style={{ borderRadius: 8, gap: 6 }} onClick={() => openEdit(b)}>
                                        <Edit3 size={14} /> แก้ไข
                                    </button>
                                    <button className="btn btn-ghost btn-sm" style={{ borderRadius: 8, gap: 6 }} onClick={() => toggleActive(b)}>
                                        {b.is_active ? <><Pause size={14} /> ปิด</> : <><Play size={14} /> เปิด</>}
                                    </button>
                                </div>
                                <button className="btn-delete-premium" onClick={() => deleteBranch(b.id)} title="ลบสาขา">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add/Edit Modal with Map Picker */}
            {showModal && (
                <div className="overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" style={{ maxWidth: 600, width: '95vw' }} onClick={e => e.stopPropagation()}>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: 'var(--space-6)', display: 'flex', alignItems: 'center', gap: 12, color: 'var(--brand-dominant)' }}>
                            {editing ? <><Edit3 size={24} /> แก้ไขสาขา</> : <><Plus size={24} /> เพิ่มสาขาใหม่</>}
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
                                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <MapPin size={16} /> ตำแหน่งสาขาบนแผนที่ *
                                </label>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                                    คลิกบนแผนที่ หรือลากหมุดเพื่อเลือกตำแหน่งที่ตั้งของสาขา
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
                            <div style={{ background: 'var(--surface-2)', padding: 'var(--space-5)', borderRadius: '16px', border: '1px solid var(--border)', marginTop: 'var(--space-2)' }}>
                                <h3 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 10, color: 'var(--brand-dominant)' }}>
                                    <GasStation size={20} /> การคิดค่าบริการนอกโซน
                                </h3>
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

                            <div style={{ background: 'var(--brand-dominant-ghost)', padding: 'var(--space-5)', borderRadius: '16px', border: '1px solid var(--brand-dominant-light)', marginTop: 'var(--space-2)' }}>
                                <h3 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 10, color: 'var(--brand-dominant)' }}>
                                    <Coins size={20} /> ข้อมูลการเงินรายทริป
                                </h3>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-4)' }}>
                                    <div className="form-group">
                                        <label className="form-label" style={{ fontWeight: 700 }}>ค่าแรงพนักงาน (บาท)</label>
                                        <input type="number" className="form-input" style={{ background: 'white' }} value={form.labor_cost_per_job} onChange={e => setForm(p => ({ ...p, labor_cost_per_job: Number(e.target.value) }))} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" style={{ fontWeight: 700 }}>ค่าน้ำมัน (บาท)</label>
                                        <input type="number" className="form-input" style={{ background: 'white' }} value={form.fuel_cost_per_job} onChange={e => setForm(p => ({ ...p, fuel_cost_per_job: Number(e.target.value) }))} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" style={{ fontWeight: 700 }}>ค่าเช่ารถ (บาท)</label>
                                        <input type="number" className="form-input" style={{ background: 'white' }} value={form.vehicle_rental_per_job} onChange={e => setForm(p => ({ ...p, vehicle_rental_per_job: Number(e.target.value) }))} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" style={{ fontWeight: 700 }}>ต้นทุนสูงสุด (บาท)</label>
                                        <input type="number" className="form-input" style={{ background: 'white' }} value={form.max_capital_per_job} onChange={e => setForm(p => ({ ...p, max_capital_per_job: Number(e.target.value) }))} />
                                    </div>
                                </div>
                                <p style={{ fontSize: '0.75rem', color: 'var(--brand-dominant)', marginTop: 12, opacity: 0.8, fontWeight: 500 }}>
                                    * ข้อมูลนี้ใช้สำหรับคำนวณกำไรและค่าตอบแทนพนักงานต่อ 1 รายการงาน
                                </p>
                            </div>

                            {error && <div className="alert alert-error">{error}</div>}
                            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
                                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>ยกเลิก</button>
                                <button type="submit" className="btn btn-primary" style={{ borderRadius: 12, padding: '10px 24px', gap: 8 }} disabled={saving}>
                                    {saving ? <span className="spinner" /> : <><Settings size={18} /> บันทึกข้อมูล</>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <ConfirmModal 
                isOpen={confirmConfig.isOpen}
                onClose={() => setConfirmConfig(p => ({ ...p, isOpen: false }))}
                onConfirm={handleConfirmDelete}
                title={confirmConfig.title}
                message={confirmConfig.message}
                isLoading={saving}
            />
        </div>
    )
}
