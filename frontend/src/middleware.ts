import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('accessToken')?.value;
  const { pathname } = request.nextUrl;

  // Public routes — no auth needed
  const publicRoutes = ['/login', '/'];
  if (publicRoutes.includes(pathname)) {
    if (token && pathname === '/login') {
      return NextResponse.redirect(new URL('/employee/dashboard', request.url));
    }
    return NextResponse.next();
  }

  // Protected routes — need auth
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
