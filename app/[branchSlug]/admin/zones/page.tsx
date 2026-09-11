'use client'
/**
 * /[branchSlug]/admin/zones
 * Zone management for shop admin — redirects to the branch-specific zones editor
 * Partners can only manage zones (not create/delete branches)
 */
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { MapPin, Plus, Edit3, Trash2, AlertTriangle } from 'lucide-react'
import { isPointInPolygon, haversine } from '@/lib/geo-utils'
import dynamic from 'next/dynamic'

const ZoneEditorMap = dynamic(() => import('@/components/ZoneEditorMap'), { ssr: false, loading: () => <div style={{height:400,background:'#F1F5F9',borderRadius:16,display:'flex',alignItems:'center',justifyContent:'center',color:'#94A3B8'}}>กำลังโหลดแผนที่...</div> })

const MAX_ZONE_RADIUS_KM = 20

/** คำนวณรัศมีสูงสุดของ polygon จาก centroid */
function calcMaxRadius(coords: [number, number][]): number {
    if (!coords || coords.length < 3) return 0
    const cLat = coords.reduce((s, p) => s + p[0], 0) / coords.length
    const cLng = coords.reduce((s, p) => s + p[1], 0) / coords.length
    return Math.max(...coords.map(p => haversine(cLat, cLng, p[0], p[1])))
}

export default function ZonesPage() {
    const { branchSlug } = useParams() as { branchSlug: string }
    // use global supabase
    const [branch, setBranch] = useState<any>(null)
    const [zones, setZones] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [editZone, setEditZone] = useState<any>(null)
    const [showEditor, setShowEditor] = useState(false)
    const [saving, setSaving] = useState(false)
    const [form, setForm] = useState({ name: '', description: '', extra_fee: '0', color: '#315EC3' })
    const [draftCoords, setDraftCoords] = useState<[number, number][]>([])
    const [radiusError, setRadiusError] = useState('')

    const load = async () => {
        setLoading(true)
        const { data: b } = await supabase.from('branches').select('*').eq('slug', branchSlug).single()
        setBranch(b)
        if (b) {
            const { data: z } = await supabase.from('zones').select('*').eq('branch_id', b.id).order('name')
            setZones(z || [])
        }
        setLoading(false)
    }

    useEffect(() => { load() }, [branchSlug])

    const openNew = () => {
        setEditZone(null)
        setForm({ name: '', description: '', extra_fee: '0', color: '#315EC3' })
        setDraftCoords([])
        setRadiusError('')
        setShowEditor(true)
    }

    const openEdit = (z: any) => {
        setEditZone(z)
        setForm({ name: z.name, description: z.description || '', extra_fee: String(z.extra_fee || 0), color: z.color || '#315EC3' })
        setDraftCoords(z.polygon_coords || [])
        setRadiusError('')
        setShowEditor(true)
    }

    const handleSave = async () => {
        if (!form.name) return alert('กรุณาใส่ชื่อโซน')
        if (draftCoords.length < 3) return alert('กรุณาวาดโซนบนแผนที่ (อย่างน้อย 3 จุด)')

        // F-02: Validate 20km radius limit
        const radius = calcMaxRadius(draftCoords)
        if (radius > MAX_ZONE_RADIUS_KM) {
            setRadiusError(`โซนมีรัศมีสูงสุด ${MAX_ZONE_RADIUS_KM} กม. แต่ตอนนี้ ${radius.toFixed(1)} กม. — กรุณาวาดใหม่ให้เล็กลง`)
            return
        }
        setRadiusError('')
        setSaving(true)

        const payload = {
            branch_id: branch.id,
            name: form.name,
            description: form.description,
            extra_fee: Number(form.extra_fee) || 0,
            color: form.color,
            polygon_coords: draftCoords,
            radius_km: radius,
            is_active: true
        }

        if (editZone) {
            await supabase.from('zones').update(payload).eq('id', editZone.id)
        } else {
            await supabase.from('zones').insert(payload)
        }
        setSaving(false)
        setShowEditor(false)
        load()
    }

    const handleDelete = async (zoneId: string) => {
        if (!confirm('ลบโซนนี้? การจองที่ผูกกับโซนนี้จะยังอยู่')) return
        await supabase.from('zones').delete().eq('id', zoneId)
        load()
    }

    const handleToggle = async (zone: any) => {
        await supabase.from('zones').update({ is_active: !zone.is_active }).eq('id', zone.id)
        load()
    }

    return (
        <div style={{ padding: '24px', maxWidth: 900, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <MapPin size={26} color="#315EC3" />
                    <div>
                        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>โซนบริการ</h1>
                        <div style={{ fontSize: 13, color: '#7E8BAA' }}>รัศมีสูงสุด {MAX_ZONE_RADIUS_KM} กม. ต่อโซน</div>
                    </div>
                </div>
                <button onClick={openNew} style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 20px', background:'#315EC3', color:'#fff', border:'none', borderRadius:12, fontWeight:700, fontSize:14, cursor:'pointer' }}>
                    <Plus size={18} /> เพิ่มโซน
                </button>
            </div>

            {loading ? (
                <div style={{ textAlign:'center', padding:60, color:'#94A3B8' }}>กำลังโหลด...</div>
            ) : zones.length === 0 ? (
                <div style={{ textAlign:'center', padding:60 }}>
                    <MapPin size={48} color="#CBD5E1" />
                    <div style={{ marginTop:12, color:'#94A3B8' }}>ยังไม่มีโซนบริการ กดปุ่มเพิ่มโซนเพื่อเริ่มต้น</div>
                </div>
            ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                    {zones.map(z => {
                        const radius = calcMaxRadius(z.polygon_coords || [])
                        return (
                            <div key={z.id} style={{ background:'#fff', border:`1.5px solid ${z.is_active ? '#E2E8F0' : '#FEE2E2'}`, borderRadius:16, padding:20 }}>
                                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                                    <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                                        <div style={{ width:14, height:14, borderRadius:'50%', background: z.color || '#315EC3' }} />
                                        <div>
                                            <div style={{ fontWeight:800, fontSize:15 }}>{z.name}</div>
                                            <div style={{ fontSize:12, color:'#94A3B8', marginTop:2 }}>
                                                รัศมี ~{radius.toFixed(1)} กม.
                                                {z.extra_fee > 0 && ` · ค่าบริการ +฿${z.extra_fee}`}
                                                {!z.is_active && ' · หยุดให้บริการ'}
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ display:'flex', gap:8 }}>
                                        <button onClick={() => openEdit(z)} style={{ padding:'6px 14px', borderRadius:10, border:'1.5px solid #E2E8F0', background:'#F8FAFC', cursor:'pointer', fontWeight:700, fontSize:13 }}>
                                            <Edit3 size={14} />
                                        </button>
                                        <button onClick={() => handleToggle(z)} style={{ padding:'6px 14px', borderRadius:10, border:'1.5px solid', borderColor: z.is_active ? '#FCA5A5' : '#86EFAC', background: z.is_active ? '#FEF2F2' : '#F0FDF4', cursor:'pointer', fontWeight:700, fontSize:12, color: z.is_active ? '#EF4444' : '#16A34A' }}>
                                            {z.is_active ? 'หยุด' : 'เปิด'}
                                        </button>
                                        <button onClick={() => handleDelete(z.id)} style={{ padding:'6px 14px', borderRadius:10, border:'1.5px solid #FCA5A5', background:'#FEF2F2', cursor:'pointer', color:'#EF4444', fontWeight:700, fontSize:13 }}>
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Zone Editor Modal */}
            {showEditor && (
                <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }} onClick={() => setShowEditor(false)}>
                    <div onClick={e => e.stopPropagation()} style={{ background:'#fff', borderRadius:24, padding:28, width:'100%', maxWidth:660, maxHeight:'90vh', overflowY:'auto' }}>
                        <h2 style={{ margin:'0 0 20px', fontWeight:800 }}>{editZone ? 'แก้ไขโซน' : 'เพิ่มโซนใหม่'}</h2>

                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:16 }}>
                            <div>
                                <label style={{ fontSize:13, fontWeight:700, display:'block', marginBottom:6 }}>ชื่อโซน *</label>
                                <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="เช่น โซน A, มหาวิทยาลัย" style={{ width:'100%', padding:'10px 14px', border:'1.5px solid #E2E8F0', borderRadius:10, fontSize:14, boxSizing:'border-box' }} />
                            </div>
                            <div>
                                <label style={{ fontSize:13, fontWeight:700, display:'block', marginBottom:6 }}>ค่าบริการเพิ่ม (฿)</label>
                                <input type="number" value={form.extra_fee} onChange={e => setForm(f => ({...f, extra_fee: e.target.value}))} style={{ width:'100%', padding:'10px 14px', border:'1.5px solid #E2E8F0', borderRadius:10, fontSize:14, boxSizing:'border-box' }} />
                            </div>
                        </div>

                        <div style={{ marginBottom:16 }}>
                            <label style={{ fontSize:13, fontWeight:700, display:'block', marginBottom:6 }}>สีโซน</label>
                            <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                                {['#315EC3','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899'].map(c => (
                                    <div key={c} onClick={() => setForm(f => ({...f, color: c}))} style={{ width:32, height:32, borderRadius:'50%', background:c, cursor:'pointer', border: form.color===c ? '3px solid #1A2340' : '2px solid transparent' }} />
                                ))}
                            </div>
                        </div>

                        {radiusError && (
                            <div style={{ background:'#FEF2F2', border:'1.5px solid #FCA5A5', borderRadius:10, padding:'10px 14px', marginBottom:16, display:'flex', gap:8, alignItems:'center', color:'#EF4444', fontSize:13, fontWeight:600 }}>
                                <AlertTriangle size={16} /> {radiusError}
                            </div>
                        )}

                        <div style={{ marginBottom:20 }}>
                            <label style={{ fontSize:13, fontWeight:700, display:'block', marginBottom:6 }}>วาดโซนบนแผนที่ (รัศมีสูงสุด {MAX_ZONE_RADIUS_KM} กม.)</label>
                            <div style={{ borderRadius:12, overflow:'hidden', border:'1.5px solid #E2E8F0' }}>
                                <ZoneEditorMap
                                    center={branch ? [branch.lat, branch.lng] : [16.44, 102.83]}
                                    initialCoords={draftCoords}
                                    color={form.color}
                                    onCoordsChange={(coords: [number, number][]) => {
                                        const r = calcMaxRadius(coords)
                                        if (r > MAX_ZONE_RADIUS_KM) {
                                            setRadiusError(`รัศมี ${r.toFixed(1)} กม. เกิน ${MAX_ZONE_RADIUS_KM} กม.`)
                                        } else {
                                            setRadiusError('')
                                        }
                                        setDraftCoords(coords)
                                    }}
                                />
                            </div>
                            {draftCoords.length >= 3 && (
                                <div style={{ marginTop:8, fontSize:12, color:'#64748B' }}>
                                    รัศมี ~{calcMaxRadius(draftCoords).toFixed(1)} กม. · {draftCoords.length} จุด
                                </div>
                            )}
                        </div>

                        <div style={{ display:'flex', gap:10 }}>
                            <button onClick={handleSave} disabled={saving} style={{ flex:1, padding:'14px', background:'#315EC3', color:'#fff', border:'none', borderRadius:14, fontWeight:800, fontSize:15, cursor:'pointer', opacity: saving ? 0.7 : 1 }}>
                                {saving ? 'กำลังบันทึก...' : editZone ? '💾 บันทึก' : '+ เพิ่มโซน'}
                            </button>
                            <button onClick={() => setShowEditor(false)} style={{ flex:1, padding:'14px', background:'#F1F5F9', color:'#1A2340', border:'none', borderRadius:14, fontWeight:700, fontSize:15, cursor:'pointer' }}>
                                ยกเลิก
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}