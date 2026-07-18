import type { Metadata, Viewport } from "next";
import Providers from "./providers";
import "./globals.css";

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
  themeColor: "#E8A4B8",
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
    <html lang="es">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}