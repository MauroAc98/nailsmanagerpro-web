"""Genera public/logo-turnetto.png a partir de design/turnetto-logo-fuente.png.

La fuente es un PNG de 1024x1536 con el logo en el centro, bordes suavizados y
transparencia, pero con ruido: píxeles casi invisibles repartidos por toda la
imagen (un resplandor) y un relleno que varía levemente de verde. Este script:

  1. Descarta los píxeles sueltos que no están pegados al logo.
  2. Recorta al logo.
  3. Lo escala al doble del tamaño que se usaba antes (1270 px de ancho) y le
     devuelve la nitidez al contorno que el escalado suaviza.
  4. Pinta todo del verde de la marca: solo varía la transparencia, así no hay
     franjas claras ni oscuras en el borde sobre ningún fondo.
  5. Lo deja en un lienzo de proporción 635:499, la que declaran las pantallas
     que lo muestran.

Además genera public/logo-turnetto-encabezado.png, una versión chica (~3x del
tamaño en pantalla) para el encabezado de la Agenda: el servidor no reduce las
imágenes, y achicar 1270 px a ~51 px en el navegador deja el borde entrecortado.
Tiene su propio nombre de archivo para no heredar la copia vieja que cacheó el
navegador del logo anterior.

Uso (desde la raíz del repo):  python scripts/limpiar-logo.py [fuente.png]
Requiere Pillow y numpy.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

RAIZ = Path(__file__).resolve().parent.parent
FUENTE = RAIZ / "design" / "turnetto-logo-fuente.png"
SALIDA = RAIZ / "public" / "logo-turnetto.png"
SALIDA_ENCABEZADO = RAIZ / "public" / "logo-turnetto-encabezado.png"

VERDE = (107, 143, 106)  # #6b8f6a, el verde de la marca (--color-primary)
ANCHO_FINAL, ALTO_FINAL = 1270, 998  # proporción 635:499, al doble de resolución
ANCHO_ENCABEZADO, ALTO_ENCABEZADO = 160, 126  # ~3x de los 51x40 px que ocupa en pantalla
CERCANIA_PX = 6  # un píxel tenue a más de esto del logo es ruido
NITIDEZ = 1.5  # >1 afina el contorno tras el escalado


def main():
    fuente = Path(sys.argv[1]) if len(sys.argv) > 1 else FUENTE
    alfa = np.asarray(Image.open(fuente).convert("RGBA"))[..., 3].astype(np.float32) / 255

    nucleo = Image.fromarray(((alfa >= 0.5) * 255).astype(np.uint8)).filter(
        ImageFilter.MaxFilter(CERCANIA_PX * 2 + 1)
    )
    alfa = np.where(np.asarray(nucleo) > 0, alfa, 0)

    ys, xs = np.where(alfa > 0)
    recorte = alfa[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    alto_logo = round(ANCHO_FINAL * recorte.shape[0] / recorte.shape[1])
    escalado = Image.fromarray((recorte * 255).round().astype(np.uint8), mode="L").resize(
        (ANCHO_FINAL, alto_logo), Image.LANCZOS
    )
    afinado = np.clip((np.asarray(escalado).astype(np.float32) / 255 - 0.5) * NITIDEZ + 0.5, 0, 1)

    lienzo = np.zeros((ALTO_FINAL, ANCHO_FINAL), dtype=np.float32)
    arriba = (ALTO_FINAL - alto_logo) // 2
    lienzo[arriba:arriba + alto_logo, :] = afinado

    alfa_final = Image.fromarray((lienzo * 255).round().astype(np.uint8), mode="L")
    for destino, tam in ((SALIDA, (ANCHO_FINAL, ALTO_FINAL)), (SALIDA_ENCABEZADO, (ANCHO_ENCABEZADO, ALTO_ENCABEZADO))):
        salida = Image.new("RGBA", tam, VERDE + (0,))
        salida.putalpha(alfa_final if tam == alfa_final.size else alfa_final.resize(tam, Image.LANCZOS))
        salida.save(destino, optimize=True)
        print(f"{destino.name}: {tam[0]}x{tam[1]}px")


if __name__ == "__main__":
    main()
