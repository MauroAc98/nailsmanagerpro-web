// Splash de iOS al abrir la PWA instalada. Sin estas imágenes iOS genera la
// pantalla sola a partir del ícono del manifest y es conocido por estirar el
// logo; con una imagen a medida por dispositivo Safari la muestra 1:1.
//
// Cada tamaño tiene dos imágenes, para que el destello previo a la app no sea un
// blanco ajeno a ella: `apple-splash-<tamaño>.png` (hueso, como --color-surface
// en claro) y `apple-splash-dark-<tamaño>.png` (como --color-surface en oscuro).
// Se eligen por `prefers-color-scheme`. Se generan con scripts/generar-splash.py.
export const APPLE_SPLASH_SCREENS = [
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

export interface EnlaceSplash {
  href: string;
  media: string;
}

export function enlacesSplashIos(): EnlaceSplash[] {
  return APPLE_SPLASH_SCREENS.flatMap(({ size, media }) => [
    { href: `/splash/apple-splash-${size}.png`, media: `${media} and (prefers-color-scheme: light)` },
    { href: `/splash/apple-splash-dark-${size}.png`, media: `${media} and (prefers-color-scheme: dark)` },
  ]);
}
