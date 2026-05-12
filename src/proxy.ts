import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decrypt } from '@/lib/auth/session';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect all /admin routes except login
  if (pathname.startsWith('/admin')) {
    const cookie = request.cookies.get('session')?.value;
    const session = await decrypt(cookie);

    if (!session?.sub) {
      // Not authenticated, redirect to login
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Redirect authenticated admins from /login to /admin/dashboard
  if (pathname === '/login') {
    const cookie = request.cookies.get('session')?.value;
    const session = await decrypt(cookie);

    if (session?.sub) {
      const dashboardUrl = new URL('/admin/dashboard', request.url);
      return NextResponse.redirect(dashboardUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
