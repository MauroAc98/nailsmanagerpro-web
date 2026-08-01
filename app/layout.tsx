import type { Metadata, Viewport } from "next";
import { Playfair_Display } from "next/font/google";
import Providers from "./providers";
import { primaryRaw } from "@/theme/colors";
import "./globals.css";

// Playfair Display — display serif loaded globally via CSS variable so any
// component can opt in with `fontFamily: 'var(--font-serif-display), serif'`
// (currently: TarjetaPrecios's price-list title, see historia-precios).
// Self-hosted by next/font/google (no runtime request to Google, no CLS).
// `display: 'swap'` means the fallback renders first and the browser swaps
// in Playfair Display once it's loaded — capture code that rasterizes this
// DOM (html-to-image in useHistoriaPrecios) MUST await `document.fonts.ready`
// before calling toBlob(), otherwise it can bake in the fallback font.
const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-serif-display",
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
  title: "Nailsmanagerpro",
  description: "Gestión de turnos para profesionales de uñas",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Nailsmanagerpro",
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

// Sin estos, iOS genera la splash screen automáticamente a partir del
// ícono del manifest — y ese proceso automático es conocido por estirar
// el logo para llenar la pantalla en vez de centrarlo. Con una imagen a
// medida por tamaño de dispositivo, Safari la muestra 1:1 sin escalar.
// Generadas con `npx pwa-asset-generator public/icon-512.png public/splash
// --background "#ffffff" --splash-only --portrait-only --type png`.
const APPLE_SPLASH_SCREENS = [
  { size: "2064-2752", media: "(device-width: 1032px) and (device-height: 1376px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" },
  { size: "2048-2732", media: "(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" },
  { size: "1668-2420", media: "(device-width: 834px) and (device-height: 1210px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" },
  { size: "1668-2388", media: "(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" },
  { size: "1668-2224", media: "(device-width: 834px) and (device-height: 1112px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" },
  { size: "1536-2048", media: "(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" },
  { size: "1640-2360", media: "(device-width: 820px) and (device-height: 1180px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" },
  { size: "1620-2160", media: "(device-width: 810px) and (device-height: 1080px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" },
  { size: "1488-2266", media: "(device-width: 744px) and (device-height: 1133px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" },
  { size: "1320-2868", media: "(device-width: 440px) and (device-height: 956px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
  { size: "1206-2622", media: "(device-width: 402px) and (device-height: 874px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
  { size: "1260-2736", media: "(device-width: 420px) and (device-height: 912px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
  { size: "1290-2796", media: "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
  { size: "1179-2556", media: "(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
  { size: "1170-2532", media: "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
  { size: "1284-2778", media: "(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
  { size: "1080-2340", media: "(device-width: 360px) and (device-height: 780px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
  { size: "1242-2688", media: "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
  { size: "1125-2436", media: "(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
  { size: "828-1792",  media: "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" },
  { size: "1242-2208", media: "(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
  { size: "750-1334",  media: "(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" },
  { size: "640-1136",  media: "(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning className={playfairDisplay.variable}>
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
        {APPLE_SPLASH_SCREENS.map(({ size, media }) => (
          <link
            key={size}
            rel="apple-touch-startup-image"
            href={`/splash/apple-splash-${size}.png`}
            media={media}
          />
        ))}
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}