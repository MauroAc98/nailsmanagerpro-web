"""Cambia el fondo blanco de icon-192.png e icon-512.png por el hueso de la app.

Android arma el splash de la PWA con el background_color del manifest (hueso,
#faf6f0) y el ícono centrado: un ícono con fondo blanco se ve como un cuadrado
blanco sobre el hueso. iOS usa icon-192.png como ícono de inicio.

Cada píxel es una mezcla de la "t" verde con el fondo blanco:
    original = c * verde + (1 - c) * blanco
Se estima c (cuánto cubre la "t") y se rearma con hueso en vez de blanco:
    nuevo = original - (1 - c) * (blanco - hueso)
Así el verde queda intacto y el borde mantiene su suavizado, sin halo blanco.

Uso (desde la raíz del repo):  python scripts/iconos-fondo-hueso.py
Requiere Pillow y numpy. Si el ícono ya tiene fondo hueso, no hace nada.
"""
from pathlib import Path

import numpy as np
from PIL import Image

RAIZ = Path(__file__).resolve().parent.parent
ICONOS = [RAIZ / "public" / "icon-192.png", RAIZ / "public" / "icon-512.png"]

BLANCO = np.array([255, 255, 255], dtype=np.float32)
HUESO = np.array([250, 246, 240], dtype=np.float32)  # #faf6f0, --color-surface
VERDE_R = 107.0  # canal rojo del verde de la marca (#6b8f6a)


def main():
    for ruta in ICONOS:
        original = np.asarray(Image.open(ruta).convert("RGB")).astype(np.float32)
        if np.abs(original[2, 2] - HUESO).max() <= 3:
            print(f"{ruta.name}: ya tiene fondo hueso, no se toca.")
            continue
        cobertura = np.clip((255 - original[..., 0]) / (255 - VERDE_R), 0, 1)[..., None]
        nuevo = original - (1 - cobertura) * (BLANCO - HUESO)
        Image.fromarray(np.clip(nuevo.round(), 0, 255).astype(np.uint8), mode="RGB").save(ruta, optimize=True)
        print(f"{ruta.name}: fondo hueso")


if __name__ == "__main__":
    main()
