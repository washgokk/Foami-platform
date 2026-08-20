import { NextRequest, NextResponse } from 'next/server'

export function proxy(req: NextRequest) {
  const url = req.nextUrl
  const hostname = req.headers.get('host') || ''

  const isAdminSubdomain = hostname.startsWith('admin.')
  const isShopSubdomain = hostname.startsWith('shop.') || hostname.startsWith('partner.')

  const path = url.pathname

  // Block /admin (Platform Admin) from shop subdomains
  if (path.startsWith('/admin') && !path.startsWith('/admin/login')) {
    if (isShopSubdomain) {
      return new NextResponse('Not Found', { status: 404 })
    }
  }

  // Subdomain rewrite: admin.foami.app → /admin/dashboard
  if (isAdminSubdomain && path === '/') {
    return NextResponse.rewrite(new URL('/admin/dashboard', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/:branchSlug/admin/:path*',
    '/',
  ],
}