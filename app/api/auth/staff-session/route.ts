import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const staffId = req.nextUrl.searchParams.get('staff_id')
  const branchId = req.nextUrl.searchParams.get('branch_id')

  if (!staffId) {
    return NextResponse.json({ error: 'staff_id required' }, { status: 400 })
  }

  const supabase = createServiceClient()

  let targetBranchId = branchId
  if (!targetBranchId) {
    const { data: s } = await supabase.from('staff').select('branch_id').eq('id', staffId).maybeSingle()
    targetBranchId = s?.branch_id
  }

  if (!targetBranchId) {
    return NextResponse.json({ active_session_token: null })
  }

  const { data: b } = await supabase.from('branches').select('features').eq('id', targetBranchId).maybeSingle()
  const feat = (b?.features && typeof b.features === 'object') ? b.features : {}
  const activeSession = feat.staff_sessions?.[staffId] || null

  return NextResponse.json({
    staff_id: staffId,
    active_session_token: activeSession
  })
}
