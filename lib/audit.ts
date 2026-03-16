import { supabase } from './supabase'
import { AuditAction, AuditEntity } from './types'

export async function trackAuditLog(params: {
    action_type: AuditAction
    entity_type: AuditEntity
    entity_id: string
    old_data?: any
    new_data?: any
    description: string
}) {
    const adminToken = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : 'system'
    
    try {
        await supabase.from('audit_logs').insert({
            admin_id: adminToken || 'unknown',
            action_type: params.action_type,
            entity_type: params.entity_type,
            entity_id: params.entity_id,
            old_data: params.old_data || null,
            new_data: params.new_data || null,
            description: params.description,
            created_at: new Date().toISOString()
        })
    } catch (err) {
        console.error('Failed to track audit log:', err)
    }
}
