'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Service, ServiceAddon, Branch, VEHICLE_SIZE_LABEL, CCPriceGroup } from '@/lib/types'
import ImageUpload from '@/components/ImageUpload'
import { Plus, Trash2, Edit2, Check, X as XIcon, ChevronDown, CheckSquare, Square, Wrench, Package, TrendingUp, Building2 } from 'lucide-react'
import ConfirmModal from '@/components/Global/ConfirmModal'
import styles from './services.module.css'
import { trackAuditLog } from '@/lib/audit'

type Tab = 'services' | 'addons' | 'groups'

export default function ServicesPage() {
    const [tab, setTab] = useState<Tab>('services')
    const [services, setServices] = useState<Service[]>([])
    const [addons, setAddons] = useState<ServiceAddon[]>([])
    const [branches, setBranches] = useState<Branch[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [priceGroups, setPriceGroups] = useState<CCPriceGroup[]>([])
    const [editingSvc, setEditingSvc] = useState<Service | null>(null)
    const [editingAddon, setEditingAddon] = useState<ServiceAddon | null>(null)
    const [editingGroup, setEditingGroup] = useState<CCPriceGroup | null>(null)
    const [showGroupModal, setShowGroupModal] = useState(false)
    const [groupForm, setGroupForm] = useState({
        name: '',
        branch_ids: [] as string[],
        service_ids: [] as string[],
        prices: { S: '0', M: '0', L: '0' } as Record<string, string>,
        is_active: true
    })
    const [svcForm, setSvcForm] = useState({
        name: '', description: '', price: '0',
        imageUrl: '',
        addons: [] as string[],
        is_addon_required: false
    })
    const [addonForm, setAddonForm] = useState({
        name: '', description: '',
        priceType: 'fixed' as 'free' | 'fixed' | 'by_size' | 'variable',
        imageUrl: '',
        price: '0',
        dynamicPrices: [{ label: '', price: '0', imageUrl: '' }]
    })
    const [saving, setSaving] = useState(false)
    const [confirmConfig, setConfirmConfig] = useState<{
        isOpen: boolean;
        type: 'svc' | 'addon' | 'group';
        id: string;
        title: string;
        message: string;
    }>({ isOpen: false, type: 'svc', id: '', title: '', message: '' })

    const load = useCallback(async () => {
        setLoading(true)
        const [{ data: svcs }, { data: ads }, { data: brs }, { data: pgs }] = await Promise.all([
            supabase.from('services').select('*').order('name'),
            supabase.from('service_addons').select('*').order('name'),
            supabase.from('branches').select('*').order('name'),
            supabase.from('cc_price_groups').select('*').order('name')
        ])
        setServices(svcs || [])
        setAddons(ads || [])
        setBranches(brs || [])
        setPriceGroups(pgs || [])
        setLoading(false)
    }, [])

    useEffect(() => { load() }, [load])

    useEffect(() => {
        const handleRefresh = () => load()
        window.addEventListener('foami:refresh', handleRefresh)
        return () => window.removeEventListener('foami:refresh', handleRefresh)
    }, [load])

    const saveSvc = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        try {
            const addonsInfo = svcForm.addons.length > 0 ? `\n[Addons: ${svcForm.addons.join(',')}]` : ''
            const payload: any = {
                name: svcForm.name,
                description: svcForm.description.trim() + addonsInfo,
                price_s: +svcForm.price,
                price_m: +svcForm.price,
                price_l: +svcForm.price,
                is_active: true,
                is_addon_required: svcForm.is_addon_required,
                image_url: svcForm.imageUrl
            }
            if (editingSvc) {
                const { error } = await supabase.from('services').update(payload).eq('id', editingSvc.id)
                if (error) throw error
                
                // [AUDIT Phase 17] Update service
                await trackAuditLog({
                    action_type: 'UPDATE',
                    entity_type: 'service',
                    entity_id: editingSvc.id,
                    old_data: editingSvc,
                    new_data: { ...editingSvc, ...payload },
                    description: `แก้ไขค่าบริการ: ${payload.name}`
                })
            } else {
                const { data, error } = await supabase.from('services').insert(payload).select().single()
                if (error) throw error
                
                // [AUDIT Phase 17] Create service
                if (data) {
                    await trackAuditLog({
                        action_type: 'CREATE',
                        entity_type: 'service',
                        entity_id: data.id,
                        new_data: payload,
                        description: `เพิ่มบริการใหม่: ${payload.name}`
                    })
                }
            }
            setShowModal(false); load(); setSaving(false)
        } catch (err: any) {
            alert(err.message)
            setSaving(false)
        }
    }

    const saveAddon = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        try {
            let descInfo = ''
            let finalPrice = +addonForm.price
            let finalType: any = addonForm.priceType === 'variable' ? 'notify_later' : addonForm.priceType
            
            if (addonForm.priceType === 'free') {
                descInfo = '\n[Pricing: Free]'
                finalPrice = 0
            } else if (addonForm.priceType === 'variable') {
                descInfo = '\n[Pricing: Variable]'
                finalPrice = 0
            } else if (addonForm.priceType === 'by_size') {
                const validPrices = addonForm.dynamicPrices.filter(p => p.label.trim() !== '')
                const priceStrings = validPrices.map(p => `${p.label}=${p.price}`)
                descInfo = `\n[Prices: ${priceStrings.join(', ')}]`
                finalPrice = validPrices.length > 0 ? +validPrices[0].price : 0
                finalType = 'fixed'
            }

            const payload: any = {
                name: addonForm.name,
                description: addonForm.description.trim() + descInfo,
                price: finalPrice,
                is_active: true,
                pricing_type: finalType,
                sub_options: addonForm.priceType === 'by_size' ? addonForm.dynamicPrices.map(p => ({
                    name: p.label,
                    price: +p.price,
                    image_url: p.imageUrl
                })) : []
            }
            if (editingAddon) {
                const { error } = await supabase.from('service_addons').update(payload).eq('id', editingAddon.id)
                if (error) throw error
                
                // [AUDIT Phase 17] Update addon
                await trackAuditLog({
                    action_type: 'UPDATE',
                    entity_type: 'service', // Using 'service' as generic entity or custom 'addon' if added
                    entity_id: editingAddon.id,
                    old_data: editingAddon,
                    new_data: { ...editingAddon, ...payload },
                    description: `แก้ไขบริการเสริม: ${payload.name}`
                })
            } else {
                const { data, error } = await supabase.from('service_addons').insert(payload).select().single()
                if (error) throw error
                
                // [AUDIT Phase 17] Create addon
                if (data) {
                    await trackAuditLog({
                        action_type: 'CREATE',
                        entity_type: 'service',
                        entity_id: data.id,
                        new_data: payload,
                        description: `เพิ่มบริการเสริมใหม่: ${payload.name}`
                    })
                }
            }
            setShowModal(false); load(); setSaving(false)
        } catch (err: any) {
            alert(err.message)
            setSaving(false)
        }
    }

    const openGroupModal = (group: CCPriceGroup | null) => {
        if (group) {
            setEditingGroup(group)
            const prices: Record<string, string> = {}
            Object.entries(group.prices || {}).forEach(([k, v]) => prices[k] = String(v))
            setGroupForm({
                name: group.name,
                branch_ids: group.branch_ids || [],
                service_ids: group.service_ids || [],
                prices: { S: '0', M: '0', L: '0', ...prices },
                is_active: group.is_active ?? true
            })
        } else {
            setEditingGroup(null)
            setGroupForm({
                name: '',
                branch_ids: [],
                service_ids: [],
                prices: { S: '0', M: '0', L: '0' },
                is_active: true
            })
        }
        setShowGroupModal(true)
    }

    const saveGroup = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        try {
            const numPrices: Record<string, number> = {}
            Object.entries(groupForm.prices).forEach(([k, v]) => numPrices[k] = Number(v))

            const groupPayload = {
                name: groupForm.name,
                branch_ids: groupForm.branch_ids,
                service_ids: groupForm.service_ids,
                prices: numPrices,
                is_active: groupForm.is_active
            }

            let groupId = editingGroup?.id
            if (editingGroup) {
                const { error } = await supabase.from('cc_price_groups').update(groupPayload).eq('id', editingGroup.id)
                if (error) throw error
                
                // [AUDIT Phase 17] Update price group
                await trackAuditLog({
                    action_type: 'UPDATE',
                    entity_type: 'service',
                    entity_id: editingGroup.id,
                    old_data: editingGroup,
                    new_data: { ...editingGroup, ...groupPayload },
                    description: `แก้ไขกลุ่มราคา: ${groupPayload.name}`
                })
            } else {
                const { data, error } = await supabase.from('cc_price_groups').insert(groupPayload).select().single()
                if (error) throw error
                groupId = data.id
                
                // [AUDIT Phase 17] Create price group
                if (data) {
                    await trackAuditLog({
                        action_type: 'CREATE',
                        entity_type: 'service',
                        entity_id: data.id,
                        new_data: groupPayload,
                        description: `สร้างกลุ่มราคาใหม่: ${groupPayload.name}`
                    })
                }
            }

            if (groupId) {
                // First remove this groupId from any branches that are NOT in the new list
                const { error: clearErr } = await supabase.from('branches').update({ price_group_id: null }).eq('price_group_id', groupId)
                if (clearErr) throw clearErr
                
                // Then set it for the new ones
                if (groupForm.branch_ids.length > 0) {
                    const { error: setErr } = await supabase.from('branches').update({ price_group_id: groupId }).in('id', groupForm.branch_ids)
                    if (setErr) throw setErr
                }
            }

            setShowGroupModal(false)
            load()
        } catch (err: any) {
            alert(err.message)
        } finally {
            setSaving(false)
        }
    }

    const deleteGroup = async (id: string) => {
        const pg = priceGroups.find(p => p.id === id)
        if (!pg) return
        
        setConfirmConfig({
            isOpen: true,
            type: 'group',
            id: id,
            title: 'ยืนยันการลบกลุ่มราคา',
            message: `ยืนยันการลบกลุ่มราคา "${pg.name}"?`
        })
    }

    const toggleGroupStatus = async (id: string, current: boolean) => {
        const pg = priceGroups.find(p => p.id === id)
        const nextState = !current
        const { error } = await supabase.from('cc_price_groups').update({ is_active: nextState }).eq('id', id)
        if (error) alert(error.message)
        else {
            // [AUDIT Phase 17] Toggle status
            if (pg) {
                await trackAuditLog({
                    action_type: 'TOGGLE_STATUS',
                    entity_type: 'service',
                    entity_id: id,
                    old_data: { is_active: current },
                    new_data: { is_active: nextState },
                    description: `${nextState ? 'เปิด' : 'ปิด'}การใช้งานกลุ่มราคา: ${pg.name}`
                })
            }
            load()
        }
    }

    const toggleSvcStatus = async (id: string, current: boolean) => {
        const s = services.find(item => item.id === id)
        const nextState = !current
        
        let updateRes
        if (typeof window !== 'undefined' && localStorage.getItem('foami_mock_db_enabled') === 'true') {
            updateRes = await supabase.from('services').update({ is_active: nextState }).eq('id', id)
        } else {
            updateRes = await supabase.from('services').update({ is_active: nextState }).eq('id', id)
        }
        
        if (updateRes.error) alert(updateRes.error.message)
        else {
            // [AUDIT Phase 17] Toggle status
            if (s) {
                await trackAuditLog({
                    action_type: 'TOGGLE_STATUS',
                    entity_type: 'service',
                    entity_id: id,
                    old_data: { is_active: current },
                    new_data: { is_active: nextState },
                    description: `${nextState ? 'เปิด' : 'ปิด'}การใช้งานบริการ: ${s.name}`
                })
            }
            load()
        }
    }

    const toggleAddonStatus = async (id: string, current: boolean) => {
        const a = addons.find(item => item.id === id)
        const nextState = !current
        
        const { error } = await supabase.from('service_addons').update({ is_active: nextState }).eq('id', id)
        
        if (error) alert(error.message)
        else {
            // [AUDIT Phase 21] Toggle status
            if (a) {
                await trackAuditLog({
                    action_type: 'TOGGLE_STATUS',
                    entity_type: 'service_addon', // Using specific type
                    entity_id: id,
                    old_data: { is_active: current },
                    new_data: { is_active: nextState },
                    description: `${nextState ? 'เปิด' : 'ปิด'}การใช้งานบริการเสริม: ${a.name}`
                })
            }
            load()
        }
    }

    const deleteSvc = async (id: string) => {
        const s = services.find(item => item.id === id)
        if (!s) return
        
        setConfirmConfig({
            isOpen: true,
            type: 'svc',
            id: id,
            title: 'ยืนยันการลบบริการ',
            message: `ยืนยันการลบบริการ "${s.name}"?`
        })
    }

    const deleteAddon = async (id: string) => {
        const a = addons.find(item => item.id === id)
        if (!a) return
        
        setConfirmConfig({
            isOpen: true,
            type: 'addon',
            id: id,
            title: 'ยืนยันการลบบริการเสริม',
            message: `ยืนยันการลบบริการเสริม "${a.name}"?`
        })
    }

    const handleConfirmDelete = async () => {
        const { id, type } = confirmConfig
        setConfirmConfig(p => ({ ...p, isOpen: false }))
        setSaving(true)

        try {
            if (type === 'svc') {
                const s = services.find(item => item.id === id)
                if (!s) return
                const { error } = await supabase.from('services').delete().eq('id', id)
                if (error) {
                    if (error.code === '23503') alert('ไม่สามารถลบบริการนี้ได้ เนื่องจากยังมีการจองงานที่เกี่ยวข้อง\n\nกรุณาปิดการใช้งานแทน')
                    else throw error
                    return
                }
                await trackAuditLog({ action_type: 'DELETE', entity_type: 'service', entity_id: id, old_data: s, description: `ลบบริการ: ${s.name}` })
            } else if (type === 'addon') {
                const a = addons.find(item => item.id === id)
                if (!a) return
                const { error } = await supabase.from('service_addons').delete().eq('id', id)
                if (error) {
                    if (error.code === '23503') alert('ไม่สามารถลบบริการเสริมนี้ได้ เนื่องจากมีการใช้งานอยู่ในรายการจอง')
                    else throw error
                    return
                }
                await trackAuditLog({ action_type: 'DELETE', entity_type: 'service_addon', entity_id: id, old_data: a, description: `ลบบริการเสริม: ${a.name}` })
            } else if (type === 'group') {
                const pg = priceGroups.find(p => p.id === id)
                if (!pg) return
                const { error } = await supabase.from('cc_price_groups').delete().eq('id', id)
                if (error) {
                    if (error.code === '23503') alert('ไม่สามารถลบกลุ่มราคานี้ได้ เนื่องจากยังมีสาขาที่ใช้งานอยู่')
                    else throw error
                    return
                }
                await trackAuditLog({ action_type: 'DELETE', entity_type: 'cc_price_group', entity_id: id, old_data: pg, description: `ลบกลุ่มราคา: ${pg.name}` })
            }
            
            load()
            alert('ลบข้อมูลเรียบร้อยแล้ว')
        } catch (err: any) {
            alert('เกิดข้อผิดพลาดในการลบ: ' + err.message)
        } finally {
            setSaving(false)
        }
    }

    const openSvcModal = (s?: Service) => {
        setEditingSvc(s || null)
        if (s) {
            const descParts = s.description.split('\n[Addons: ')
            const desc = s.description.includes('\n[Addons: ') ? descParts[0] : s.description
            let selectedAddons: string[] = []
            if (descParts.length > 1) {
                const addonsStr = descParts[1].replace(']', '')
                selectedAddons = addonsStr.split(',').map(name => name.trim()).filter(Boolean)
            }
            setSvcForm({ 
                name: s.name, 
                description: desc, 
                price: String(s.price_s), 
                imageUrl: s.image_url || '', 
                addons: selectedAddons,
                is_addon_required: s.is_addon_required || false
            })
        } else {
            setSvcForm({ name: '', description: '', price: '0', imageUrl: '', addons: [], is_addon_required: false })
        }
        setShowModal(true)
    }

    const openAddonModal = (a?: ServiceAddon) => {
        setEditingAddon(a || null)
        if (a) {
            const desc = a.description.includes('\n[') ? a.description.split('\n[')[0] : a.description
            const isFree = a.pricing_type === 'free' || a.description.includes('[Pricing: Free]')
            const isVariable = a.pricing_type === 'notify_later' || a.description.includes('[Pricing: Variable]')
            const hasSubOptions = a.sub_options && a.sub_options.length > 0
            const hasLegacyPrices = a.description.includes('[Prices:')

            const isBySize = hasSubOptions || hasLegacyPrices
            
            let dynPrices = a.sub_options?.map(o => ({ label: o.name, price: String(o.price), imageUrl: o.image_url })) || [{ label: '', price: '0', imageUrl: '' }]
            
            if (hasLegacyPrices && (!a.sub_options || a.sub_options.length === 0)) {
                const match = a.description.match(/\[Prices:\s*(.+?)\]/)
                if (match && match[1]) {
                    dynPrices = match[1].split(',').map(part => {
                        const [label, price] = part.split('=').map(s => s.trim())
                        return { label, price: price || '0', imageUrl: '' }
                    })
                }
            }

            setAddonForm({ 
                name: a.name, 
                description: desc, 
                priceType: isFree ? 'free' : isVariable ? 'variable' : isBySize ? 'by_size' : 'fixed', 
                price: String(a.price), 
                imageUrl: a.image_url || '', 
                dynamicPrices: dynPrices as any 
            })
        } else {
            setAddonForm({ name: '', description: '', priceType: 'fixed', imageUrl: '', price: '0', dynamicPrices: [{ label: '', price: '0', imageUrl: '' }] })
        }
        setShowModal(true)
    }


    return (
        <div style={{ paddingBottom: 60 }}>
            <div className="page-header animate-fade">
                <div>
                    <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Wrench size={28} color="var(--brand-dominant)" /> บริการ & ราคา</h1>
                    <p className="page-subtitle">จัดการแพ็กเกจ บริการเสริม และส่วนต่างราคาตามสาขา</p>
                </div>
                <button className="btn btn-primary" onClick={() => {
                    if (tab === 'services') openSvcModal()
                    else if (tab === 'addons') openAddonModal()
                    else if (tab === 'groups') openGroupModal(null)
                }}>
                    + {tab === 'services' ? 'เพิ่มบริการ' : tab === 'addons' ? 'เพิ่มบริการเสริม' : 'สร้างกลุ่มราคาใหม่'}
                </button>
            </div>

            <div className={styles.tabs} style={{ marginBottom: 24 }}>
                <button className={`${styles.tab} ${tab === 'services' ? styles.tabActive : ''}`} onClick={() => setTab('services')}><Package size={18} /> แพ็กเกจหลัก</button>
                <button className={`${styles.tab} ${tab === 'addons' ? styles.tabActive : ''}`} onClick={() => setTab('addons')}><Plus size={18} /> บริการเสริม</button>
                <button className={`${styles.tab} ${tab === 'groups' ? styles.tabActive : ''}`} onClick={() => setTab('groups')}><TrendingUp size={18} /> กลุ่มราคาตาม CC</button>
            </div>

            {loading ? <div className="empty-state animate-fade"><div className="spinner" /></div> : (
                <div className="animate-fade">
                    {tab === 'services' && (
                        <div className="table-wrapper">
                            <table>
                                <thead><tr><th>บริการ</th><th>คำอธิบาย</th><th>ราคาเริ่มต้น</th><th>บริการเสริม</th><th>สถานะ</th><th></th></tr></thead>
                                <tbody>
                                    {services.length === 0 ? (
                                        <tr><td colSpan={6}><div className="empty-state"><Package size={48} color="var(--text-muted)" /><p className="empty-state-title">ยังไม่มีบริการ</p></div></td></tr>
                                    ) : services.map(s => {
                                        const descParts = s.description.split('\n[Addons: ')
                                        const desc = descParts[0]
                                        const hasAddons = descParts.length > 1
                                        return (
                                            <tr key={s.id}>
                                                <td><strong>{s.name}</strong></td>
                                                <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{desc}</td>
                                                <td><strong>฿{s.price_s}</strong></td>
                                                <td>{hasAddons ? <span className="badge badge-picking">มีบริการเสริม</span> : <span className="badge badge-waiting">ไม่มี</span>}</td>
                                                <td>
                                                    <button 
                                                        className={`badge ${s.is_active ? 'badge-completed' : 'badge-cancelled'}`} 
                                                        onClick={() => toggleSvcStatus(s.id, s.is_active)}
                                                        style={{ cursor: 'pointer', border: 'none' }}
                                                    >
                                                        {s.is_active ? 'เปิด' : 'ปิด'}
                                                    </button>
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                                        <button className="btn btn-outline btn-sm" onClick={() => openSvcModal(s)}><Edit2 size={16} /></button>
                                                        <button className="btn-delete-premium" onClick={() => deleteSvc(s.id)} title="ลบบริการ"><Trash2 size={16} /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {tab === 'addons' && (
                        <div className="table-wrapper">
                            <table>
                                <thead><tr><th>บริการเสริม</th><th>คำอธิบาย</th><th>ราคา</th><th>สถานะ</th><th></th></tr></thead>
                                <tbody>
                                    {addons.length === 0 ? (
                                        <tr><td colSpan={5}><div className="empty-state"><Plus size={48} color="var(--text-muted)" /><p className="empty-state-title">ยังไม่มีบริการเสริม</p></div></td></tr>
                                    ) : addons.map(a => (
                                        <tr key={a.id}>
                                            <td><strong>{a.name}</strong></td>
                                            <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{a.description}</td>
                                            <td>฿{a.price}</td>
                                            <td>
                                                <button 
                                                    className={`badge ${a.is_active ? 'badge-completed' : 'badge-cancelled'}`} 
                                                    onClick={() => toggleAddonStatus(a.id, a.is_active)}
                                                    style={{ cursor: 'pointer', border: 'none' }}
                                                >
                                                    {a.is_active ? 'เปิด' : 'ปิด'}
                                                </button>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: 8 }}>
                                                    <button className="btn btn-outline btn-sm" onClick={() => openAddonModal(a)}><Edit2 size={16} /></button>
                                                    <button className="btn-delete-premium" onClick={() => deleteAddon(a.id)} title="ลบบริการเสริม"><Trash2 size={16} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {tab === 'groups' && (
                        <div className="table-wrapper">
                            <table>
                                <thead><tr><th>ชื่อกลุ่ม</th><th>สาขาที่ใช้</th><th>แพ็กเกจที่ใช้</th><th>ราคา (S/M/L)</th><th>สถานะ</th><th></th></tr></thead>
                                <tbody>
                                    {priceGroups.length === 0 ? (
                                        <tr><td colSpan={5}><div className="empty-state"><TrendingUp size={48} color="var(--text-muted)" /><p className="empty-state-title">ยังไม่มีกลุ่มราคา</p></div></td></tr>
                                    ) : priceGroups.map(pg => {
                                        const groupBrs = branches.filter(b => pg.branch_ids?.includes(b.id))
                                        const groupSvcs = services.filter(s => pg.service_ids?.includes(s.id))
                                        const p = pg.prices || {}
                                        return (
                                            <tr key={pg.id}>
                                                <td><strong>{pg.name}</strong></td>
                                                <td>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                                        {groupBrs.map(b => <span key={b.id} className="badge" style={{ fontSize: '0.7rem' }}>{b.name}</span>)}
                                                        {groupBrs.length === 0 && <span className="badge badge-waiting">ไม่มีสาขา</span>}
                                                    </div>
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                                        {groupSvcs.map(s => <span key={s.id} className="badge badge-pending" style={{ fontSize: '0.7rem' }}>{s.name}</span>)}
                                                        {groupSvcs.length === 0 && <span className="badge badge-waiting">ทุกแพ็กเกจ</span>}
                                                    </div>
                                                </td>
                                                <td>
                                                    <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                                                        ฿{p.S}/{p.M}/{p.L}
                                                    </div>
                                                </td>
                                                <td>
                                                    <button 
                                                        className={`badge ${pg.is_active ? 'badge-completed' : 'badge-cancelled'}`} 
                                                        onClick={() => toggleGroupStatus(pg.id, pg.is_active)}
                                                        style={{ cursor: 'pointer', border: 'none' }}
                                                    >
                                                        {pg.is_active ? 'เปิด' : 'ปิด'}
                                                    </button>
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: 8 }}>
                                                        <button className="btn btn-outline btn-sm" onClick={() => openGroupModal(pg)}><Edit2 size={16} /></button>
                                                        <button className="btn btn-ghost btn-sm" onClick={() => deleteGroup(pg.id)}><Trash2 size={16} /></button>
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

            {/* Price Group Modal */}
            {showGroupModal && (
                <div className="overlay" onClick={() => setShowGroupModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 840, maxWidth: '95vw', borderRadius: 24 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
                            <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--brand-dominant)', display: 'flex', alignItems: 'center', gap: 12 }}>
                                <TrendingUp size={28} /> {editingGroup ? 'แก้ไขกลุ่มราคา' : 'สร้างกลุ่มราคาใหม่'}
                            </h2>
                            <button className="btn btn-ghost" onClick={() => setShowGroupModal(false)}><XIcon size={20} /></button>
                        </div>

                        <form onSubmit={saveGroup}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: 32 }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                                    <div className="form-group">
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                            <label className="form-label" style={{ fontWeight: 700, margin: 0 }}>ชื่อกลุ่มราคา</label>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700, color: groupForm.is_active ? 'var(--brand-dominant)' : 'var(--text-muted)' }}>
                                                <input type="checkbox" checked={groupForm.is_active} onChange={e => setGroupForm(p => ({ ...p, is_active: e.target.checked }))} />
                                                เปิดใช้งาน
                                            </label>
                                        </div>
                                        <input className="form-input" style={{ borderRadius: 12 }} value={groupForm.name} onChange={e => setGroupForm(p => ({ ...p, name: e.target.value }))} required placeholder="เช่น ราคามาตรฐาน, โปรโมชั่นพิเศษ" />
                                    </div>
                                    
                                    <div style={{ border: '1px solid var(--border)', borderRadius: 20, overflow: 'hidden', background: 'var(--surface)' }}>
                                        <div style={{ background: 'var(--surface-2)', padding: '16px 20px', fontWeight: 900, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, color: 'var(--brand-dominant)' }}>
                                            <TrendingUp size={18} /> กำหนดราคากลางตามขนาดรถ (CC)
                                        </div>
                                        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                                            {(['S', 'M', 'L'] as const).map((cc, idx, arr) => (
                                                <div key={cc} style={{ display: 'grid', gridTemplateColumns: '140px 1fr', alignItems: 'center', gap: 20 }}>
                                                    <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>
                                                        Size {cc} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500, display: 'block' }}>({VEHICLE_SIZE_LABEL[cc]?.split(' ')[0]})</span>
                                                    </div>
                                                    <div style={{ position: 'relative' }}>
                                                        <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', fontWeight: 900, color: 'var(--brand-dominant)', fontSize: '1rem' }}>฿</span>
                                                        <input type="number" className="form-input" style={{ paddingLeft: 40, borderRadius: 12, fontWeight: 700 }} value={groupForm.prices[cc]} 
                                                            onChange={e => {
                                                                const val = e.target.value
                                                                const nextPrices = { ...groupForm.prices, [cc]: val }
                                                                if (val && !isNaN(Number(val))) {
                                                                    let currentVal = Number(val)
                                                                    for (let i = idx + 1; i < arr.length; i++) {
                                                                        const nextCC = arr[i]
                                                                        currentVal += 30
                                                                        nextPrices[nextCC] = currentVal.toString()
                                                                    }
                                                                }
                                                                setGroupForm(p => ({ ...p, prices: nextPrices }))
                                                            }} 
                                                        />
                                                        {idx > 0 && Number(groupForm.prices[cc]) === Number(groupForm.prices[arr[idx-1]]) + 30 && (
                                                            <span style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', fontSize: '0.7rem', background: 'var(--success-ghost)', color: 'var(--success)', padding: '2px 8px', borderRadius: 8, fontWeight: 800 }}>+30 Step</span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
                                            <Package size={16} color="var(--brand-dominant)" /> แพ็กเกจที่ใช้ราคานี้
                                        </label>
                                        <div style={{ background: 'var(--surface-2)', padding: 16, borderRadius: 16, border: '1px solid var(--border)', maxHeight: 200, overflowY: 'auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                            {services.map(s => (
                                                <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', cursor: 'pointer', background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', transition: 'all 0.2s' }}>
                                                    <input type="checkbox" checked={groupForm.service_ids.includes(s.id)} onChange={e => {
                                                        const checked = e.target.checked
                                                        setGroupForm(p => ({ ...p, service_ids: checked ? [...p.service_ids, s.id] : p.service_ids.filter(id => id !== s.id) }))
                                                    }} />
                                                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{s.name}</span>
                                                </label>
                                            ))}
                                            {services.length === 0 && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', gridColumn: 'span 2', padding: 12 }}>ยังไม่มีข้อมูลแพ็กเกจ</div>}
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                    <div className="form-group" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
                                            <Building2 size={16} color="var(--brand-dominant)" /> เลือกสาขาที่ใช้ราคานี้
                                        </label>
                                        <div style={{ flex: 1, background: 'var(--surface-2)', padding: 16, borderRadius: 16, border: '1px solid var(--border)', overflowY: 'auto' }}>
                                            {branches.map(b => (
                                                <label key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', cursor: 'pointer', background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', marginBottom: 8, transition: 'all 0.2s' }}>
                                                    <input type="checkbox" checked={groupForm.branch_ids.includes(b.id)} onChange={e => {
                                                        const checked = e.target.checked
                                                        setGroupForm(p => ({ ...p, branch_ids: checked ? [...p.branch_ids, b.id] : p.branch_ids.filter(id => id !== b.id) }))
                                                    }} />
                                                    <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{b.name}</span>
                                                </label>
                                            ))}
                                            {branches.length === 0 && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: 12 }}>ยังไม่มีข้อมูลสาขา</div>}
                                        </div>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 8 }}>* 1 สาขาสามารถสังกัดได้ 1 กลุ่มราคาเท่านั้น</p>
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: 16, justifyContent: 'flex-end', marginTop: 32, borderTop: '1px solid var(--border)', paddingTop: 24 }}>
                                <button type="button" className="btn btn-ghost" style={{ borderRadius: 12, padding: '10px 24px' }} onClick={() => setShowGroupModal(false)}>ยกเลิก</button>
                                <button type="submit" className="btn btn-primary" style={{ borderRadius: 12, padding: '10px 32px', fontWeight: 800, boxShadow: '0 4px 12px rgba(49, 94, 195, 0.2)' }} disabled={saving || groupForm.branch_ids.length === 0}>
                                    {saving ? <span className="spinner" /> : (editingGroup ? 'บันทึกการแก้ไข' : 'สร้างกลุ่มราคา')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showModal && (
                <div className="overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        {tab === 'services' ? (
                            <form onSubmit={saveSvc}>
                                <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 24 }}>{editingSvc ? '✏️ แก้ไขบริการ' : '+ เพิ่มบริการ'}</h2>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                    <div className="form-group"><label className="form-label">ชื่อแพ็กเกจ</label><input className="form-input" value={svcForm.name} onChange={e => setSvcForm(p => ({ ...p, name: e.target.value }))} required /></div>
                                    <div className="form-group"><label className="form-label">คำอธิบาย</label><input className="form-input" value={svcForm.description} onChange={e => setSvcForm(p => ({ ...p, description: e.target.value }))} /></div>
                                    <div className="form-group">
                                        <ImageUpload
                                            label="รูปภาพบริการ"
                                            value={svcForm.imageUrl}
                                            onChange={(url) => setSvcForm(p => ({ ...p, imageUrl: url }))}
                                            folder="services"
                                            skipCompression={true}
                                        />
                                    </div>
                                    <div className="form-group"><label className="form-label">ราคาพื้นฐาน (฿)</label><input type="number" className="form-input" value={svcForm.price} onChange={e => setSvcForm(p => ({ ...p, price: e.target.value }))} required /></div>
                                    <div className="form-group">
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '12px 16px', background: 'var(--surface-2)', borderRadius: 12, border: '2px solid var(--border)' }}>
                                            <input 
                                                type="checkbox" 
                                                checked={svcForm.is_addon_required} 
                                                onChange={e => setSvcForm(p => ({ ...p, is_addon_required: e.target.checked }))} 
                                            />
                                            <div>
                                                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>บังคับเลือกบริการเสริม</div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>ลูกค้าจะไม่สามารถสั่งจองได้หากไม่เลือกบริการเสริมอย่างน้อย 1 อย่าง</div>
                                            </div>
                                        </label>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">บริการเสริมที่พ่วงได้</label>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, background: 'var(--surface-2)', padding: 12, borderRadius: 12 }}>
                                            {addons.map(a => (
                                                <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
                                                    <input type="checkbox" checked={svcForm.addons.includes(a.name)} onChange={e => {
                                                        const isChecked = e.target.checked
                                                        setSvcForm(p => ({ ...p, addons: isChecked ? [...p.addons, a.name] : p.addons.filter(n => n !== a.name) }))
                                                    }} />
                                                    {a.name}
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24 }}>
                                    <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>ยกเลิก</button>
                                    <button type="submit" className="btn btn-primary" disabled={saving}>บันทึก</button>
                                </div>
                            </form>
                        ) : (
                            <form onSubmit={saveAddon}>
                                <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 24 }}>{editingAddon ? '✏️ แก้ไขบริการเสริม' : '+ เพิ่มบริการเสริม'}</h2>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                    <div className="form-group"><label className="form-label">ชื่อบริการเสริม</label><input className="form-input" value={addonForm.name} onChange={e => setAddonForm(p => ({ ...p, name: e.target.value }))} required /></div>
                                    <div className="form-group"><label className="form-label">คำอธิบาย</label><input className="form-input" value={addonForm.description} onChange={e => setAddonForm(p => ({ ...p, description: e.target.value }))} /></div>
                                    
                                    <div className="form-group">
                                        <label className="form-label">รูปแบบราคา</label>
                                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                            {(['fixed', 'by_size', 'free', 'variable'] as const).map(t => (
                                                <button key={t} type="button" className={`btn btn-sm ${addonForm.priceType === t ? 'btn-primary' : 'btn-outline'}`} onClick={() => setAddonForm(p => ({ ...p, priceType: t }))}>
                                                    {t === 'fixed' ? 'ราคาปกติ' : t === 'by_size' ? 'ระบุตามยี่ห้อ/รุ่น' : t === 'free' ? 'ฟรี' : 'แจ้งภายหลัง'}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {addonForm.priceType === 'fixed' && (
                                        <div className="form-group">
                                            <label className="form-label">ราคา (฿)</label>
                                            <input type="number" className="form-input" value={addonForm.price} onChange={e => setAddonForm(p => ({ ...p, price: e.target.value }))} required />
                                        </div>
                                    )}

                                    {addonForm.priceType === 'by_size' && (
                                        <div className="form-group">
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                                <label className="form-label" style={{ marginBottom: 0 }}>รายการตัวเลือกย่อย (ระบุมูลค่า)</label>
                                                <button type="button" className="btn btn-outline btn-sm" onClick={() => setAddonForm(p => ({ ...p, dynamicPrices: [...p.dynamicPrices, { label: '', price: '0', imageUrl: '' }] }))}>+ เพิ่มตัวเลือก</button>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                                {addonForm.dynamicPrices.map((dp: any, i) => (
                                                    <div key={i} style={{ padding: 12, border: '2px solid var(--border)', borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                                                        <div style={{ display: 'flex', gap: 8 }}>
                                                            <input className="form-input" style={{ flex: 1 }} placeholder="ชื่อตัวเลือก (เช่น ยี่ห้อรถ, ขนาดขวด)" value={dp.label} onChange={e => {
                                                                const newP = [...addonForm.dynamicPrices]; newP[i].label = e.target.value; setAddonForm(p => ({ ...p, dynamicPrices: newP } as any))
                                                            }} required />
                                                            <input type="number" className="form-input" style={{ width: 100 }} placeholder="ราคา" value={dp.price} onChange={e => {
                                                                const newP = [...addonForm.dynamicPrices]; newP[i].price = e.target.value; setAddonForm(p => ({ ...p, dynamicPrices: newP } as any))
                                                            }} required />
                                                            <button type="button" className="btn btn-ghost" onClick={() => {
                                                                setAddonForm(p => ({ ...p, dynamicPrices: p.dynamicPrices.filter((_, idx) => idx !== i) } as any))
                                                            }}>✕</button>
                                                        </div>
                                                        <ImageUpload
                                                            value={dp.imageUrl}
                                                            onChange={(url) => {
                                                                const newP = [...addonForm.dynamicPrices]; newP[i].imageUrl = url; setAddonForm(p => ({ ...p, dynamicPrices: newP } as any))
                                                            }}
                                                            label="รูปภาพประกอบ (ถ้ามี)"
                                                            folder="addons"
                                                            skipCompression={true}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {addonForm.priceType === 'variable' && (
                                        <div style={{ padding: 12, background: 'var(--primary-ghost)', borderRadius: 12, fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 600 }}>
                                            * แจ้งราคาภายหลังที่หน้างาน (พนักงานจะเป็นคนระบุราคา)
                                        </div>
                                    )}
                                </div>
                                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24 }}>
                                    <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>ยกเลิก</button>
                                    <button type="submit" className="btn btn-primary" disabled={saving}>บันทึก</button>
                                </div>
                            </form>
                        )}
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
