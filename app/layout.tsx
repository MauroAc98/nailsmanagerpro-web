import type { Metadata, Viewport } from "next";
import Image from "next/image";
import { Playfair_Display } from "next/font/google";
import Providers from "./providers";

import { enlacesSplashIos } from "@/lib/appleSplash";
import { primaryRaw } from "@/theme/colors";
import "./globals.css";

// Playfair Display — único serif de toda la app, loaded globally via CSS
// variable so any component can opt in with `fontFamily: agendaFontSerif`
// (theme/agendaColors.ts). Usado en títulos de pantalla en toda la app
// (Agenda, Historia, Login, Estadísticas, TarjetaPrecios) — antes convivía
// con Cormorant Garamond (solo TarjetaPrecios) y Georgia/Times New Roman
// sueltos (legal, WelcomeScreen); unificados acá a uno solo (design decision
// 2026-08-17). Self-hosted, no runtime request to Google, no CLS.
// `display: 'swap'` means the fallback renders first and the browser swaps
// in Playfair Display once it's loaded — capture code that rasterizes DOM
// using this font (html-to-image in useGenerarHistoria/useHistoriaPrecios)
// MUST await `document.fonts.ready` before calling toBlob(), otherwise it
// can bake in the fallback font.
const agendaSerif = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-agenda-serif",
  display: "swap",
});

// Metadata queda en español fijo a propósito: es un export estático de un
// Server Component fuera de NextIntlClientProvider, así que traducirlo de
// verdad requeriría generateMetadata() leyendo el locale desde la cookie vía
// next/headers — infraestructura server-side que hoy no existe en el resto
// del proyecto (todo el i18n es client-side, ver store/useLocaleStore.ts).
// Como SUPPORTED solo tiene 'es' hasta la Fase 11, ese trabajo no cambiaría
// nada observable todavía — se hace cuando pt-BR/en se habiliten de verdad.
export const metadata: Metadata = {
  title: "Turnetto",
  description: "La forma más simple de gestionar turnos, clientes y recordatorios de tu negocio",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Turnetto",
  },
};

export const viewport: Viewport = {
  themeColor: primaryRaw,
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning className={agendaSerif.variable}>
      <head>
        {/* Corre antes de la hidratación de React para fijar data-theme y
            lang sin el flash que se vería si esperáramos a que
            useThemeStore/useLocaleStore monten (localStorage/matchMedia
            pueden fallar en algunos contextos — ej. modo privado — de ahí
            el try/catch). El bloque de locale mantiene la misma lista de
            SUPPORTED que lib/locale.ts — si se agrega un locale ahí,
            actualizar también acá (no se puede importar el módulo TS
            dentro de un string inline). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');var dark=t==='dark'||((!t||t==='system')&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=dark?'dark':'light';}catch(e){}try{var SUPPORTED=['es','pt-BR'];var loc=localStorage.getItem('locale');if(!loc||SUPPORTED.indexOf(loc)===-1){try{var au=localStorage.getItem('auth_user');if(au){var u=JSON.parse(au);if(u&&u.locale&&SUPPORTED.indexOf(u.locale)!==-1)loc=u.locale;}}catch(e){}}if(!loc||SUPPORTED.indexOf(loc)===-1)loc='es';document.documentElement.lang=loc;document.cookie='locale='+loc+';path=/;max-age=31536000';}catch(e){}})();`,
          }}
        />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        {enlacesSplashIos().map(({ href, media }) => (
          <link key={href} rel="apple-touch-startup-image" href={href} media={media} />
        ))}
      </head>
      <body>
        <div className="app-shell">
          <Providers>{children}</Providers>
        </div>
        {/* Fuera de NextIntlClientProvider a propósito, mismo motivo que
            `metadata` arriba: todo el i18n de este proyecto es client-side
            (useLocaleStore), y traducir esto agregaría un flash de contenido
            sin traducir antes de que React hidrate — exactamente lo que el
            gate CSS puro (ver globals.css) evita para el resto de la
            pantalla. Español fijo, como el resto de lo pre-hidratación. */}
        <div className="mobile-only-notice" style={{
          minHeight: '100dvh', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', textAlign: 'center', padding: 32, gap: 16,
        }}>
          <Image src="/icon-192.png" alt="" width={72} height={72} priority style={{ borderRadius: 18 }} />
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text-strong)', margin: 0 }}>
            Turnetto es para celular
          </h1>
          {/* Gatea por ANCHO, no por dispositivo (ver globals.css) — un
              celular rotado a horizontal también dispara este aviso, porque
              el ancho real es el mismo problema que en tablet/desktop (los
              layouts fijos de la app tampoco están pensados para esos
              anchos). El texto tiene que cubrir los dos casos sin mentirle
              a quien ya está en su celular. */}
          <p style={{ fontSize: 15, color: 'var(--color-subtext)', margin: 0, maxWidth: 340 }}>
            Esta app está pensada para una pantalla angosta y vertical, como la de un celular. Si ya estás en tu celular, probá girarlo a modo vertical — si no, abrí este mismo enlace desde tu teléfono.
          </p>
        </div>
      </body>
    </html>
  );
}