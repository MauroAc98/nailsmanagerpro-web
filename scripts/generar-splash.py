"""Genera las imágenes de splash de iOS en public/splash.

Por cada tamaño de lib/appleSplash.ts crea dos PNG con el logo centrado:
  apple-splash-<tamaño>.png        fondo hueso   (--color-surface en modo claro)
  apple-splash-dark-<tamaño>.png   fondo oscuro  (--color-surface en modo oscuro)

El fondo coincide con el del BootSplash de la app, así el paso del splash nativo
a la app no muestra un destello de otro color.

Uso (desde la raíz del repo):  python scripts/generar-splash.py
Requiere Pillow (pip install pillow).
"""
import re
from pathlib import Path

from PIL import Image

RAIZ = Path(__file__).resolve().parent.parent
LOGO = RAIZ / "public" / "logo-turnetto.png"
SALIDA = RAIZ / "public" / "splash"
TAMANOS = RAIZ / "lib" / "appleSplash.ts"

FONDOS = {
    "": (0xFA, 0xF6, 0xF0),       # #faf6f0
    "dark-": (0x1E, 0x1E, 0x22),  # #1e1e22
}
# Tamaño máximo con el que se dibuja el logo (px del splash). El archivo es de
# 1270 px (scripts/limpiar-logo.py), así que siempre se reduce y queda nítido.
ANCHO_LOGO_NATIVO = 635
FRACCION_DEL_ANCHO = 0.55


def tamanos():
    return re.findall(r'size:\s*"(\d+)-(\d+)"', TAMANOS.read_text(encoding="utf-8"))


def main():
    logo = Image.open(LOGO).convert("RGBA")
    SALIDA.mkdir(parents=True, exist_ok=True)
    for ancho_txt, alto_txt in tamanos():
        ancho, alto = int(ancho_txt), int(alto_txt)
        ancho_logo = min(ANCHO_LOGO_NATIVO, round(ancho * FRACCION_DEL_ANCHO))
        alto_logo = round(logo.height * ancho_logo / logo.width)
        escalado = logo.resize((ancho_logo, alto_logo), Image.LANCZOS)
        for prefijo, fondo in FONDOS.items():
            lienzo = Image.new("RGB", (ancho, alto), fondo)
            lienzo.paste(escalado, ((ancho - ancho_logo) // 2, (alto - alto_logo) // 2), escalado)
            lienzo.save(SALIDA / f"apple-splash-{prefijo}{ancho_txt}-{alto_txt}.png", optimize=True)
        print(f"{ancho_txt}-{alto_txt}: logo {ancho_logo}px")


if __name__ == "__main__":
    main()
