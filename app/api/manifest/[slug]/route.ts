import { NextRequest, NextResponse } from 'next/server';

// Manifest dinámico por negocio — el estático en public/manifest.json tiene
// start_url fijo ("/"), así que "Agregar a Inicio" desde /login/{slug}
// siempre terminaba instalando un ícono que abre en el login genérico (sin
// slug, sin logo). En iOS esto es más filoso que en Android: el standalone
// instalado NO comparte localStorage con Safari (aislamiento de WebKit), así
// que el fallback vía KEYS.negocioSlug (services/authService.ts) nunca llega
// a ese contexto — el start_url tiene que traer el slug ya "horneado" desde
// el momento de instalar, no depender de storage compartido.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  return NextResponse.json(
    {
      name: 'Turnetto',
      short_name: 'Turnetto',
      description: 'Gestión de turnos, clientes y recordatorios para salones de belleza y estética',
      start_url: `/login/${slug}`,
      // Sin esto, el scope por defecto se calcula como el directorio del
      // start_url (o sea "/login/") en vez de toda la app — en cuanto se
      // navega fuera de /login/* (ej. a /agenda tras loguearse), iOS lo
      // trata como "salir" del PWA instalado y muestra la interfaz del
      // navegador. El manifest estático (public/manifest.json) no lo
      // necesitaba porque su start_url ya era "/", así que su scope
      // implícito ya cubría toda la app.
      scope: '/',
      display: 'standalone',
      background_color: '#ffffff',
      theme_color: '#d79ea4',
      orientation: 'portrait',
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
    },
    { headers: { 'Content-Type': 'application/manifest+json' } },
  );
}
