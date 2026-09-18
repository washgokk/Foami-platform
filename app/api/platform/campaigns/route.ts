import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const supabaseAdmin = createServiceClient()

// GET /api/platform/campaigns?branchId=xxx
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const branchId = url.searchParams.get('branchId')

  const { data: setting } = await supabaseAdmin
    .from('app_settings')
    .select('value')
    .eq('key', 'platform_campaign_proposals')
    .maybeSingle()

  const proposals: any[] = Array.isArray(setting?.value) ? setting.value : []

  if (branchId) {
    // Filter / map proposals for this specific branch
    const branchProposals = proposals.filter(p => {
      if (!p.target_branches || p.target_branches.includes('all') || p.target_branches.includes(branchId)) return true
      return false
    }).map(p => {
      const response = p.branch_responses?.[branchId] || { status: 'pending' }
      return {
        ...p,
        my_status: response.status,
        my_responded_at: response.responded_at || null
      }
    })
    return NextResponse.json({ proposals: branchProposals })
  }

  return NextResponse.json({ proposals })
}

// POST /api/platform/campaigns — Super Admin creates a campaign proposal to shops
export async function POST(req: NextRequest) {
  const body = await req.json()
  const campaignName = body.name || body.title
  const campaignCode = (body.code || ('CAMP_' + (body.name || body.title || 'FOAMI').replace(/[^a-zA-Z0-9]/g, '').slice(0, 6) + '_' + Date.now().toString(36))).toUpperCase().trim()
  const discount_type = body.discount_type || 'fixed'
  const discount_value = Number(body.discount_value)
  const max_discount_amount = body.max_discount_amount ? Number(body.max_discount_amount) : null
  const funding_type = body.funding_type || 'platform'
  const valid_from = body.valid_from || null
  const valid_until = body.valid_until || null
  const target_branches = body.target_branches || body.target_branch_ids || ['all']
  const description = body.description || ''

  if (!campaignName || !discount_value) {
    return NextResponse.json({ error: 'กรุณากรอกข้อมูลชื่อแคมเปญและมูลค่าส่วนลดให้ครบถ้วน' }, { status: 400 })
  }

  const name = campaignName
  const code = campaignCode

  const cleanCode = code.toUpperCase().trim()

  // 1. Create discount code in discount_codes table
  const segmentPayload = {
    campaign_proposal: true,
    funding_type: funding_type || 'platform',
    created_by_role: 'platform'
  }

  const { data: newCode, error: codeErr } = await supabaseAdmin
    .from('discount_codes')
    .upsert({
      code: cleanCode,
      discount_type: discount_type || 'fixed',
      discount_value: Number(discount_value),
      max_discount_amount: max_discount_amount ? Number(max_discount_amount) : null,
      max_uses: 1000,
      target_segment: JSON.stringify(segmentPayload),
      usage_type: valid_from && valid_until ? 'date_range' : 'all',
      valid_from: valid_from || null,
      valid_until: valid_until || null,
      allowed_branch_ids: Array.isArray(target_branches) && !target_branches.includes('all') ? target_branches : null,
      is_active: true
    }, { onConflict: 'code' })
    .select()
    .single()

  if (codeErr) {
    return NextResponse.json({ error: `ไม่สามารถสร้างโค้ดส่วนลดได้: ${codeErr.message}` }, { status: 400 })
  }

  // 2. Add to platform_campaign_proposals in app_settings
  const { data: curSetting } = await supabaseAdmin
    .from('app_settings')
    .select('value')
    .eq('key', 'platform_campaign_proposals')
    .maybeSingle()

  const currentList: any[] = Array.isArray(curSetting?.value) ? curSetting.value : []

  const proposalId = `prop_${Date.now()}`
  const newProposal = {
    id: proposalId,
    name,
    code: cleanCode,
    description: description || '',
    discount_type: discount_type || 'fixed',
    discount_value: Number(discount_value),
    max_discount_amount: max_discount_amount ? Number(max_discount_amount) : null,
    funding_type, // 'platform' (100% Foami), 'shared_50_50' (50/50), 'shop' (100% Shop)
    valid_from: valid_from || null,
    valid_until: valid_until || null,
    target_branches: target_branches || ['all'],
    branch_responses: {}, // { [branchId]: { status: 'accepted'|'declined', responded_at: '...' } }
    created_at: new Date().toISOString()
  }

  const updatedList = [newProposal, ...currentList]

  await supabaseAdmin.from('app_settings').upsert({
    key: 'platform_campaign_proposals',
    value: updatedList
  })

  return NextResponse.json({ success: true, proposal: newProposal })
}

// PATCH /api/platform/campaigns — Shop Admin accepts or declines proposal
export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { proposal_id, branch_id, action } = body // action: 'accept' | 'decline'

  if (!proposal_id || !branch_id || !action) {
    return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
  }

  const { data: curSetting } = await supabaseAdmin
    .from('app_settings')
    .select('value')
    .eq('key', 'platform_campaign_proposals')
    .maybeSingle()

  const currentList: any[] = Array.isArray(curSetting?.value) ? curSetting.value : []
  const proposalIndex = currentList.findIndex(p => p.id === proposal_id)

  if (proposalIndex === -1) {
    return NextResponse.json({ error: 'ไม่พบข้อเสนอแคมเปญ' }, { status: 404 })
  }

  const prop = currentList[proposalIndex]
  const newStatus = action === 'accept' ? 'accepted' : 'declined'

  prop.branch_responses = prop.branch_responses || {}
  prop.branch_responses[branch_id] = {
    status: newStatus,
    responded_at: new Date().toISOString()
  }

  currentList[proposalIndex] = prop

  await supabaseAdmin.from('app_settings').upsert({
    key: 'platform_campaign_proposals',
    value: currentList
  })

  // ── Sync allowed_branch_ids in discount_codes table so the code is actually usable in reality! ──
  if (prop.code) {
    const { data: discCode } = await supabaseAdmin
      .from('discount_codes')
      .select('id, allowed_branch_ids')
      .eq('code', prop.code)
      .maybeSingle()

    if (discCode) {
      let allowed = Array.isArray(discCode.allowed_branch_ids) ? [...discCode.allowed_branch_ids] : []
      if (action === 'accept') {
        if (!allowed.includes(branch_id)) allowed.push(branch_id)
      } else {
        allowed = allowed.filter(id => id !== branch_id)
      }
      await supabaseAdmin
        .from('discount_codes')
        .update({ allowed_branch_ids: allowed.length > 0 ? allowed : null })
        .eq('id', discCode.id)
    }
  }

  return NextResponse.json({
    success: true,
    status: newStatus,
    message: newStatus === 'accepted' ? 'ยอมรับข้อเสนอแคมเปญสำเร็จ แคมเปญพร้อมใช้งานสำหรับสาขาของคุณ' : 'ปฏิเสธข้อเสนอแคมเปญเรียบร้อยแล้ว'
  })
}
