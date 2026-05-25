import { type NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  // ปิด auth ทุก route ชั่วคราว
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
