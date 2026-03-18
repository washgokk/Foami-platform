import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url)
    const url = searchParams.get('url')
    
    if (!url) {
        return NextResponse.json({ error: 'Missing url' }, { status: 400 })
    }

    // Server-side redirect is a better way to break out of PWA on iOS
    return NextResponse.redirect(url, 302)
}
