import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { password } = await req.json()
  const secret = process.env.PLATFORM_ADMIN_SECRET || 'foami_platform_admin_2025'

  if (password !== secret) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
  }

  // Simple token = the secret itself (stateless, checked in every API call)
  return NextResponse.json({ token: secret })
}
