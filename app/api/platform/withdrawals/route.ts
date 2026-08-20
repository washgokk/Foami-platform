import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function isPlatformAdmin(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') ||
    req.cookies.get('platform_token')?.value
  const secret = process.env.PLATFORM_ADMIN_SECRET || 'foami_platform_admin_2025'
  return token === secret
}

// GET /api/platform/withdrawals — list all withdrawal requests
export async function GET(req: NextRequest) {
  if (!isPlatformAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const status = url.searchParams.get('status') // 'pending' | 'completed' | all

  let query = supabaseAdmin
    .from('withdrawal_requests')
    .select('*')
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Enrich with branch name
  const enriched = await Promise.all((data || []).map(async (wr) => {
    const { data: branch } = await supabaseAdmin
      .from('branches')
      .select('name, slug')
      .eq('id', wr.shop_id)
      .maybeSingle()
    return { ...wr, shop_name: branch?.name || wr.shop_id, shop_slug: branch?.slug }
  }))

  return NextResponse.json({ withdrawals: enriched })
}

// PATCH /api/platform/withdrawals — approve or reject
export async function PATCH(req: NextRequest) {
  if (!isPlatformAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { id, action, admin_note } = body // action: 'approve' | 'reject'

  if (!['approve', 'reject', 'complete'].includes(action)) { // BUG-05 FIX: added 'complete'
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  // Get the withdrawal request
  const { data: wr, error: wrErr } = await supabaseAdmin
    .from('withdrawal_requests')
    .select('*')
    .eq('id', id)
    .single()

  if (wrErr || !wr) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  // BUG-05 FIX: 'complete' action can only be done on 'approved' status
  if (action === 'complete' && wr.status !== 'approved') return NextResponse.json({ error: 'Can only complete an approved withdrawal' }, { status: 400 })
  if (action !== 'complete' && wr.status !== 'pending') return NextResponse.json({ error: 'Already resolved' }, { status: 400 })

  // BUG-05 FIX: 3-stage workflow: pending → approved → completed
  const newStatus = action === 'approve' ? 'approved' : action === 'complete' ? 'completed' : 'rejected'

  // Update withdrawal status
  const { error: updateErr } = await supabaseAdmin
    .from('withdrawal_requests')
    .update({ status: newStatus, admin_note, resolved_at: new Date().toISOString() })
    .eq('id', id)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  // If approved: debit the shop wallet
  if (action === 'approve') {
    const { data: wallet } = await supabaseAdmin
      .from('shop_wallets')
      .select('balance_thb, total_withdrawn_thb')
      .eq('shop_id', wr.shop_id)
      .maybeSingle()

    if (wallet) {
      const newBalance = (wallet.balance_thb || 0) - wr.amount_thb
      const newWithdrawn = (wallet.total_withdrawn_thb || 0) + wr.amount_thb

      await supabaseAdmin
        .from('shop_wallets')
        .update({
          balance_thb: Math.max(0, newBalance),
          total_withdrawn_thb: newWithdrawn,
          updated_at: new Date().toISOString()
        })
        .eq('shop_id', wr.shop_id)

      // Ledger entry
      await supabaseAdmin.from('wallet_ledger').insert({
        shop_id: wr.shop_id,
        type: 'debit',
        amount: wr.amount_thb,
        description: `Withdrawal approved — ${wr.bank_name} ${wr.account_number}`,
        balance_after: Math.max(0, newBalance)
      })
    }
  }

  return NextResponse.json({ success: true, status: newStatus })
}
