import { NextRequest, NextResponse } from 'next/server';

// Proxy same-origin para el "fondo fijo" de la historia (fondo_historia_url).
// El backend sirve esas imágenes sin Access-Control-Allow-Origin, así que
// html-to-image (que las embebe con su propio fetch()) no puede leerlas
// directo desde el browser — de ahí que compartir/guardar fallara en
// silencio. Sirviéndolas desde nuestro propio origin evitamos el CORS por
// completo. Restringido al origin del backend para no ser un proxy abierto.
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  if (!url) {
    return NextResponse.json({ error: 'Falta el parámetro url' }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return NextResponse.json({ error: 'url inválida' }, { status: 400 });
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  const allowedOrigin = apiUrl ? new URL(apiUrl).origin : null;
  if (!allowedOrigin || target.origin !== allowedOrigin) {
    return NextResponse.json({ error: 'Origin no permitido' }, { status: 403 });
  }

  const upstream = await fetch(target.toString());
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: 'No se pudo obtener la imagen' }, { status: 502 });
  }

  return new NextResponse(upstream.body, {
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? 'image/jpeg',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
