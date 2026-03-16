'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Zone, Branch } from '@/lib/types'
import { Map, Plus, Edit2, Trash2, ArrowLeft, CheckCircle, AlertCircle, Save, MousePointer2, MapPin } from 'lucide-react'
import { trackAuditLog } from '@/lib/audit'

// Distinct colors for each zone
const ZONE_COLORS = ['#3B5FCC', '#16A34A', '#D97706', '#DC2626', '#7C3AED', '#0891B2', '#DB2777', '#059669']

export default function ZonesPage() {
    const { id } = useParams<{ id: string }>()
    const [branch, setBranch] = useState<Branch | null>(null)
    const [zones, setZones] = useState<Zone[]>([])
    const [loading, setLoading] = useState(true)

    // Creation state — "create" mode replaces the overview map with a drawing canvas
    const [createMode, setCreateMode] = useState<'idle' | 'naming' | 'drawing'>('idle')
    const [newName, setNewName] = useState('')
    const [newDesc, setNewDesc] = useState('')
    const [saving, setSaving] = useState(false)

    // Which zone's polygon is being re-drawn
    const [redrawZone, setRedrawZone] = useState<Zone | null>(null)

    const load = useCallback(async () => {
        const [{ data: br }, { data: zns }] = await Promise.all([
            supabase.from('branches').select('*').eq('id', id).single(),
            supabase.from('zones').select('*').eq('branch_id', id).order('name'),
        ])
        setBranch(br as Branch)
        setZones((zns || []) as Zone[])
        setLoading(false)
    }, [id])

    useEffect(() => { load() }, [load])

    const saveNewZone = async (polygon_coords: [number, number][]) => {
        if (!newName.trim()) return
        setSaving(true)
        const color = ZONE_COLORS[zones.length % ZONE_COLORS.length]
        const { data, error } = await supabase.from('zones').insert({
            name: newName.trim(),
            description: newDesc.trim(),
            branch_id: id,
            is_active: true,
            extra_fee: 0,
            polygon_coords,
            color,
        }).select().single()
        
        if (!error && data) {
            // [AUDIT Phase 22] Create zone
            await trackAuditLog({
                action_type: 'CREATE',
                entity_type: 'service', // Using service as generic for zones too or we could add 'zone' if supported
                entity_id: data.id,
                new_data: data,
                description: `สร้างโซนใหม่: ${data.name} (สาขา ${branch?.name || id})`
            })
        }
        
        setSaving(false)
        setCreateMode('idle')
        setNewName('')
        setNewDesc('')
        load()
    }

    const saveRedraw = async (polygon_coords: [number, number][]) => {
        if (!redrawZone) return
        setSaving(true)
        const { error } = await supabase.from('zones').update({ polygon_coords }).eq('id', redrawZone.id)
        
        if (!error) {
            // [AUDIT Phase 22] Redraw zone
            await trackAuditLog({
                action_type: 'UPDATE',
                entity_type: 'service',
                entity_id: redrawZone.id,
                old_data: { polygon_coords: redrawZone.polygon_coords },
                new_data: { polygon_coords },
                description: `แก้ไขพื้นที่ (วาดใหม่) โซน: ${redrawZone.name}`
            })
        }
        
        setSaving(false)
        setRedrawZone(null)
        load()
    }

    const deleteZone = async (zid: string) => {
        const z = zones.find(item => item.id === zid)
        if (!z) return
        if (!confirm('ลบโซนนี้?')) return
        const { error } = await supabase.from('zones').delete().eq('id', zid)
        
        if (!error) {
            // [AUDIT Phase 22] Delete zone
            await trackAuditLog({
                action_type: 'DELETE',
                entity_type: 'service',
                entity_id: zid,
                old_data: z,
                description: `ลบโซน: ${z.name}`
            })
        }
        
        load()
    }

    const toggleActive = async (z: Zone) => {
        const nextState = !z.is_active
        const { error } = await supabase.from('zones').update({ is_active: nextState }).eq('id', z.id)
        
        if (!error) {
            // [AUDIT Phase 22] Toggle status
            await trackAuditLog({
                action_type: 'TOGGLE_STATUS',
                entity_type: 'service',
                entity_id: z.id,
                old_data: { is_active: z.is_active },
                new_data: { is_active: nextState },
                description: `${nextState ? 'เปิด' : 'ปิด'}การใช้งานโซน: ${z.name}`
            })
        }
        
        load()
    }

    const branchCenter: [number, number] = branch ? [branch.lat, branch.lng] : [16.4419, 102.836]

    return (
        <div className="animate-fade">
            <div className="page-header">
                <div>
                    <Link href="/admin/branches" style={{ color: 'var(--brand-dominant)', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
                        <ArrowLeft size={16} /> กลับไปยังสาขา
                    </Link>
                    <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Map size={28} color="var(--brand-dominant)" /> โซนบริการ — {branch?.name}
                    </h1>
                    <p className="page-subtitle">แต่ละโซนแสดงเป็นสีต่างกันบนแผนที่ · นอกโซน = 10 บาท/กม.</p>
                </div>
                {createMode === 'idle' && !redrawZone && (
                    <button className="btn btn-primary" style={{ borderRadius: 12, gap: 8 }} onClick={() => setCreateMode('naming')}>
                        <Plus size={18} /> เพิ่มโซน
                    </button>
                )}
            </div>

            {/* ─── Step 1: Name + Description form (shown before drawing) ─── */}
            {createMode === 'naming' && (
                <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-6)', border: '2px solid var(--primary)', marginBottom: 'var(--space-6)' }}>
                    <h3 style={{ fontWeight: 700, marginBottom: 'var(--space-4)', color: 'var(--brand-dominant)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Edit2 size={20} /> ขั้นตอนที่ 1: ตั้งชื่อและคำอธิบาย
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                        <input className="form-input" style={{ borderRadius: 12 }} placeholder="ชื่อโซน (เช่น หลังมอ, กังสดาล) *" value={newName}
                            onChange={e => setNewName(e.target.value)} autoFocus />
                        <input className="form-input" style={{ borderRadius: 12 }} placeholder="คำอธิบาย (ไม่บังคับ)" value={newDesc}
                            onChange={e => setNewDesc(e.target.value)} />
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
                        <button className="btn btn-ghost" onClick={() => { setCreateMode('idle'); setNewName(''); setNewDesc('') }}>ยกเลิก</button>
                        <button className="btn btn-primary" disabled={!newName.trim()} onClick={() => setCreateMode('drawing')}>
                            ถัดไป: วาดกรอบบนแผนที่ →
                        </button>
                    </div>
                </div>
            )}

            {/* ─── Step 2: Drawing mode (inline) ─── */}
            {(createMode === 'drawing' || redrawZone) && (
                <ZoneDrawMap
                    center={branchCenter}
                    zones={zones}
                    editingZoneId={redrawZone?.id}
                    title={redrawZone ? <><Edit2 size={18} /> วาดกรอบใหม่: {redrawZone.name}</> : <><Map size={18} /> วาดกรอบโซน: "{newName}"</>}
                    accentColor={redrawZone
                        ? (zones.find(z => z.id === redrawZone.id) as any)?.color || ZONE_COLORS[0]
                        : ZONE_COLORS[zones.length % ZONE_COLORS.length]}
                    existingCoords={redrawZone?.polygon_coords || []}
                    saving={saving}
                    onSave={redrawZone ? saveRedraw : saveNewZone}
                    onCancel={() => { setCreateMode('idle'); setRedrawZone(null) }}
                />
            )}

            {/* ─── Overview map (all zones) ─── */}
            {createMode === 'idle' && !redrawZone && (
                <div style={{ position: 'relative' }}>
                    {loading && (
                        <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.7)', borderRadius: 'var(--radius-xl)' }}>
                            <span className="spinner" />
                        </div>
                    )}
                    <ZoneOverviewMap
                        center={branchCenter}
                        zones={zones}
                        onRedraw={setRedrawZone}
                    />
                </div>
            )}

            {/* ─── Zone list ─── */}
            {loading ? (
                <div className="empty-state"><div className="spinner" /></div>
            ) : (
                <div style={{ marginTop: 'var(--space-6)' }}>
                    {zones.length === 0 ? (
                        <div className="empty-state">
                            <div style={{ background: 'var(--surface-2)', width: 64, height: 64, borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: 'var(--text-muted)' }}>
                                <Map size={32} />
                            </div>
                            <p className="empty-state-title" style={{ fontWeight: 800 }}>ยังไม่มีโซน</p>
                            <p className="empty-state-subtitle">กดปุ่ม + เพิ่มโซน เพื่อเริ่มต้น</p>
                        </div>
                    ) : (
                        <div className="table-wrapper">
                            <table>
                                <thead>
                                    <tr>
                                        <th>สี</th>
                                        <th>ชื่อโซน</th>
                                        <th>จุดกรอบ</th>
                                        <th>สถานะ</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {zones.map((z, idx) => {
                                        const color = (z as any).color || ZONE_COLORS[idx % ZONE_COLORS.length]
                                        return (
                                            <tr key={z.id}>
                                                <td>
                                                    <div style={{ width: 18, height: 18, borderRadius: 4, background: color }} />
                                                </td>
                                                <td>
                                                    <strong>{z.name}</strong>
                                                    {z.description && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{z.description}</div>}
                                                </td>
                                                <td>
                                                    {z.polygon_coords?.length >= 3
                                                        ? <span className="badge" style={{ background: 'var(--success-ghost)', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 4, width: 'fit-content' }}><CheckCircle size={12} /> {z.polygon_coords.length} จุด</span>
                                                        : <span className="badge" style={{ background: 'var(--danger-ghost)', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 4, width: 'fit-content' }}><AlertCircle size={12} /> ยังไม่มีกรอบ</span>
                                                    }
                                                </td>
                                                <td>
                                                    <button onClick={() => toggleActive(z)}
                                                        className="badge"
                                                        style={{ border: 'none', cursor: 'pointer', background: z.is_active ? 'var(--success-ghost)' : 'var(--danger-ghost)', color: z.is_active ? 'var(--success)' : 'var(--danger)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                        {z.is_active ? <><CheckCircle size={12} /> เปิด</> : <><AlertCircle size={12} /> ปิด</>}
                                                    </button>
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: 6 }}>
                                                        <button className="btn btn-ghost btn-sm" style={{ gap: 4 }} onClick={() => setRedrawZone(z)}>
                                                            <Edit2 size={14} /> วาดกรอบ
                                                        </button>
                                                        <button className="btn btn-outline btn-sm" style={{ color: 'var(--danger)', border: 'none' }} onClick={() => deleteZone(z.id)}>
                                                            <Trash2 size={14} />
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
            )}
        </div>
    )
}

// ─── Overview Map Component ──────────────────────────────────────────────────
function ZoneOverviewMap({ center, zones, onRedraw }: {
    center: [number, number]; zones: Zone[]; onRedraw: (z: Zone) => void
}) {
    const mapRef = useRef<HTMLDivElement>(null)
    const mapInstanceRef = useRef<any>(null)
    const layerGroupRef = useRef<any>(null)
    const [mapReady, setMapReady] = useState(false)

    // 1. Initialize Map once
    useEffect(() => {
        if (mapInstanceRef.current || !mapRef.current) return
        import('leaflet').then(L => {
            if (!document.querySelector('link[href*="leaflet.css"]')) {
                const link = document.createElement('link')
                link.rel = 'stylesheet'
                link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
                document.head.appendChild(link)
            }

            const map = L.map(mapRef.current!, { center, zoom: 15, zoomControl: true })
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map)

            // Center marker
            L.circleMarker(center, { radius: 8, fillColor: '#fff', color: '#3B5FCC', weight: 3, fillOpacity: 1 })
                .addTo(map).bindTooltip('สาขา')

            layerGroupRef.current = L.featureGroup().addTo(map)
            mapInstanceRef.current = map
            setMapReady(true)
        })
        return () => {
            mapInstanceRef.current?.remove();
            mapInstanceRef.current = null;
            setMapReady(false);
        }
    }, [center]) // Only re-init if center truly changes

    // 2. Redraw zones when zones prop changes
    useEffect(() => {
        if (!mapReady || !mapInstanceRef.current || !layerGroupRef.current) return
        import('leaflet').then(L => {
            layerGroupRef.current.clearLayers()
            const COLORS = ZONE_COLORS

            // Draw all active polygons
            zones.forEach((z, idx) => {
                if (!z.is_active) return // Optionally hide inactive ones
                const color = (z as any).color || COLORS[idx % COLORS.length]
                if (z.polygon_coords?.length >= 3) {
                    L.polygon(z.polygon_coords, {
                        color, fillColor: color, fillOpacity: 0.15, weight: 2.5,
                    }).addTo(layerGroupRef.current).bindTooltip(`<strong>${z.name}</strong>`, {
                        permanent: true, direction: 'center',
                        className: 'leaflet-zone-label',
                    })
                }
            })

            // Auto-fit bounds if we have drawn polygons
            if (layerGroupRef.current.getLayers().length > 0) {
                mapInstanceRef.current.fitBounds(layerGroupRef.current.getBounds(), { padding: [20, 20], maxZoom: 16 })
            }
        })
    }, [zones, mapReady])

    return (
        <div style={{ marginBottom: 'var(--space-6)', borderRadius: 'var(--radius-xl)', overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface)' }}>
            <div style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Map size={18} color="var(--brand-dominant)" /> แผนที่โซนบริการทั้งหมด
                </span>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {zones.map((z, idx) => (
                        <span key={z.id} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', fontWeight: 600 }}>
                            <span style={{ width: 10, height: 10, borderRadius: 2, background: (z as any).color || ZONE_COLORS[idx % ZONE_COLORS.length], display: 'inline-block' }} />
                            {z.name}
                        </span>
                    ))}
                </div>
            </div>
            <div style={{ position: 'relative', isolation: 'isolate' }}>
                <div ref={mapRef} style={{ width: '100%', height: 340 }} />
            </div>
            {zones.filter(z => !z.polygon_coords?.length || z.polygon_coords.length < 3).length > 0 && (
                <div style={{ padding: 'var(--space-3) var(--space-5)', background: '#FFFBEB', fontSize: '0.82rem', color: '#92400E', borderTop: '1px solid #FDE68A', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <AlertCircle size={14} /> โซนที่ยังไม่มีกรอบ: {zones.filter(z => !z.polygon_coords?.length || z.polygon_coords.length < 3).map(z => z.name).join(', ')} — กด <Edit2 size={12} style={{ display: 'inline' }} /> วาดกรอบ ในตารางด้านล่าง
                </div>
            )}
        </div>
    )
}

// ─── Draw Map Component ──────────────────────────────────────────────────────
function ZoneDrawMap({ center, zones, editingZoneId, title, accentColor, existingCoords, saving, onSave, onCancel }: {
    center: [number, number]; zones: Zone[]; editingZoneId?: string
    title: React.ReactNode; accentColor: string
    existingCoords: [number, number][]
    saving: boolean
    onSave: (coords: [number, number][]) => void
    onCancel: () => void
}) {
    const mapRef = useRef<HTMLDivElement>(null)
    const mapInstanceRef = useRef<any>(null)
    const polyRef = useRef<any>(null)
    const markerRefs = useRef<any[]>([])
    const [points, setPoints] = useState<[number, number][]>(existingCoords || [])

    useEffect(() => {
        if (mapInstanceRef.current || !mapRef.current) return
        import('leaflet').then(L => {
            if (!document.querySelector('link[href*="leaflet.css"]')) {
                const link = document.createElement('link')
                link.rel = 'stylesheet'
                link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
                document.head.appendChild(link)
            }

            const map = L.map(mapRef.current!, { center, zoom: 15 })
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map)

            // Show OTHER zones for reference
            zones.forEach((z, idx) => {
                if (z.id === editingZoneId || !z.polygon_coords?.length) return
                const color = (z as any).color || ZONE_COLORS[idx % ZONE_COLORS.length]
                L.polygon(z.polygon_coords, { color, fillColor: color, fillOpacity: 0.1, weight: 1.5, dashArray: '6,4' })
                    .addTo(map).bindTooltip(z.name, { direction: 'center' })
            })

            // Draw existing points if re-drawing
            if (existingCoords?.length >= 3) {
                existingCoords.forEach(([la, lo]) => {
                    const m = L.circleMarker([la, lo], { radius: 6, fillColor: accentColor, color: '#fff', weight: 2, fillOpacity: 1 }).addTo(map)
                    markerRefs.current.push(m)
                })
                polyRef.current = L.polygon(existingCoords, { color: accentColor, fillColor: accentColor, fillOpacity: 0.2, weight: 2.5 }).addTo(map)
            }

            map.on('click', (e: any) => {
                const coord: [number, number] = [e.latlng.lat, e.latlng.lng]
                setPoints(prev => {
                    const next = [...prev, coord]
                    polyRef.current?.remove()
                    if (next.length > 1) {
                        polyRef.current = L.polygon(next, { color: accentColor, fillColor: accentColor, fillOpacity: 0.2, weight: 2.5 }).addTo(map)
                    }
                    const m = L.circleMarker(coord, { radius: 6, fillColor: accentColor, color: '#fff', weight: 2, fillOpacity: 1 }).addTo(map)
                    markerRefs.current.push(m)
                    return next
                })
            })

            map.on('contextmenu', (e: any) => {
                e.originalEvent.preventDefault()
                setPoints(prev => {
                    markerRefs.current.pop()?.remove()
                    const next = prev.slice(0, -1)
                    polyRef.current?.remove()
                    if (next.length > 1) {
                        polyRef.current = L.polygon(next, { color: accentColor, fillColor: accentColor, fillOpacity: 0.2, weight: 2.5 }).addTo(map)
                    }
                    return next
                })
            })

            mapInstanceRef.current = map
        })
        return () => { mapInstanceRef.current?.remove(); mapInstanceRef.current = null }
    }, [])

    const clearAll = () => {
        markerRefs.current.forEach(m => m.remove()); markerRefs.current = []
        polyRef.current?.remove(); polyRef.current = null
        setPoints([])
    }

    return (
        <div style={{ marginBottom: 'var(--space-6)', borderRadius: 'var(--radius-xl)', overflow: 'hidden', border: `2px solid ${accentColor}` }}>
            <div style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--border)', background: `${accentColor}12`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <span style={{ fontWeight: 700, color: accentColor }}>{title}</span>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={14} /> คลิกซ้าย = เพิ่มจุด</span>
                    <span>·</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MousePointer2 size={14} /> คลิกขวา = ลบจุดล่าสุด</span>
                    <span style={{ fontWeight: 700, color: accentColor, background: `${accentColor}18`, padding: '2px 10px', borderRadius: 'var(--radius-full)' }}>
                        {points.length} จุด
                    </span>
                </div>
            </div>
            <div style={{ position: 'relative', isolation: 'isolate' }}>
                <div ref={mapRef} style={{ width: '100%', height: 420, cursor: 'crosshair' }} />
            </div>
            <div style={{ padding: 'var(--space-4)', display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', background: 'var(--surface-2)', borderTop: '1px solid var(--border)' }}>
                <button className="btn btn-ghost btn-sm" style={{ gap: 4 }} onClick={clearAll}><Trash2 size={14} /> ล้างจุดทั้งหมด</button>
                <button className="btn btn-ghost btn-sm" onClick={onCancel}>ยกเลิก</button>
                <button className="btn btn-primary btn-sm" style={{ background: accentColor, borderColor: accentColor, borderRadius: 10, gap: 8 }}
                    disabled={points.length < 3 || saving}
                    onClick={() => onSave(points)}>
                    {saving ? <span className="spinner" /> : <><Save size={16} /> บันทึกกรอบ ({points.length} จุด)</>}
                </button>
            </div>
        </div>
    )
}
