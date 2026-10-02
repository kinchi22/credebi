import { NextResponse, type NextRequest } from 'next/server';
import { REQUESTED_PATH_HEADER, requestedPath } from './server/return-path';
import {
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
  renewsSessionCookie,
} from './server/session-cookie';

export function proxy(request: NextRequest): NextResponse {
  const headers = new Headers(request.headers);
  headers.set(REQUESTED_PATH_HEADER, requestedPath(request.nextUrl));
  const response = NextResponse.next({ request: { headers } });
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token !== undefined && renewsSessionCookie(request.method, request.nextUrl.pathname)) {
    response.cookies.set(SESSION_COOKIE, token, SESSION_COOKIE_OPTIONS);
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
