import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
    try {
        // v42: Parse body ONCE to avoid req.json() double-read bug
        const body = await req.json()
        const { code, bridgeId, redirectUri: clientRedirectUri, branchSlug } = body
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID || process.env.NEXT_PUBLIC_LINE_LIFF_ID
        const channelSecret = process.env.LINE_CHANNEL_SECRET
        
        if (!code || !bridgeId) {
            return NextResponse.json({ error: 'Missing code or bridgeId' }, { status: 400 })
        }

        if (!liffId || !channelSecret) {
            return NextResponse.json({ error: 'System configuration missing (LIFF/Secret)' }, { status: 500 })
        }

        const channelId = liffId.includes('-') ? liffId.split('-')[0] : liffId;
        const redirectUri = clientRedirectUri || `${process.env.NEXT_PUBLIC_APP_URL || 'https://foami-app.vercel.app'}/login`

        // 1. Exchange Code for Token
        const tokenParams = new URLSearchParams()
        tokenParams.append('grant_type', 'authorization_code')
        tokenParams.append('code', code)
        tokenParams.append('redirect_uri', redirectUri)
        tokenParams.append('client_id', channelId)
        tokenParams.append('client_secret', channelSecret)

        const tokenRes = await fetch('https://api.line.me/oauth2/v2.1/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: tokenParams
        })

        const tokenData = await tokenRes.json()
        if (!tokenRes.ok) {
            console.error('LINE Token Error:', tokenData)
            return NextResponse.json({ error: tokenData.error_description || 'Failed to exchange token' }, { status: 401 })
        }

        // 2. Get User Profile
        const profileRes = await fetch('https://api.line.me/v2/profile', {
            headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
        })
        const profile = await profileRes.json()
        if (!profileRes.ok) {
            return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 401 })
        }

        // 3. Sync to Supabase
        const supabase = createServiceClient()
        // branchSlug already parsed from body above (v42 fix)

        // Upsert customer with last branch memory
        const upsertData: any = { 
            line_user_id: profile.userId, 
            full_name: profile.displayName,
            picture_url: profile.pictureUrl
        }
        if (branchSlug) {
            upsertData.last_branch_slug = branchSlug;
        }

        const { data: upsertedCustomer, error: custError } = await supabase
            .from('customers')
            .upsert(upsertData, { onConflict: 'line_user_id' })
            .select()
            .maybeSingle()
 
        if (custError) {
            console.error('Customer Sync Error:', custError)
        }

        // If upsert returned no data (no-change upsert), fetch the existing row
        let customer = upsertedCustomer
        if (!customer) {
            const { data: existingCustomer } = await supabase
                .from('customers')
                .select('*')
                .eq('line_user_id', profile.userId)
                .maybeSingle()
            customer = existingCustomer
        }

        const customerData = customer || { 
            line_user_id: profile.userId,
            full_name: profile.displayName,
            picture_url: profile.pictureUrl,
            ...(branchSlug ? { last_branch_slug: branchSlug } : {})
        }

        // Sync to bridge
        const { error: bridgeError } = await supabase
            .from('pwa_auth_bridges')
            .upsert({ 
                id: bridgeId, 
                customer_data: customerData,
                created_at: new Date().toISOString()
            }, { onConflict: 'id' })

        if (bridgeError) {
            return NextResponse.json({ error: bridgeError.message }, { status: 500 })
        }

        return NextResponse.json({ 
            success: true, 
            displayName: profile.displayName,
            customerData
        })
    } catch (err: any) {
        console.error('Sync Code Error:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
