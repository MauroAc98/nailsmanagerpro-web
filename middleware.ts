import { NextRequest, NextResponse } from 'next/server';

// admin.turnetto.com es el mismo build que app.turnetto.com (mismo proceso
// PM2, mismo puerto en nginx — ver nginx sites-available/admin-turnetto),
// separado solo por Host. Sin esto, entrar a admin.turnetto.com/ cae en
// app/page.tsx (redirect a /login, el login de tenant) en vez del panel.
const ADMIN_HOST = 'admin.turnetto.com';

export function middleware(request: NextRequest) {
  const host = request.headers.get('host') ?? '';

  if (host === ADMIN_HOST && !request.nextUrl.pathname.startsWith('/admin')) {
    const url = request.nextUrl.clone();
    url.pathname = '/admin';
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|api|.*\\..*).*)'],
};
